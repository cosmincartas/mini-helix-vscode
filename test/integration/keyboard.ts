import WebSocket from 'ws';

interface Target {
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

/** Real renderer keyboard events exercise VS Code's keybinding resolver. */
export class Keyboard {
  private sequence = 0;
  private readonly pending = new Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', data => {
      const message = JSON.parse(data.toString()) as {
        id?: number;
        error?: { message: string };
        result?: unknown;
      };
      if (message.id === undefined) { return; }
      const request = this.pending.get(message.id);
      if (!request) { return; }
      clearTimeout(request.timeout);
      this.pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
    });
  }

  static async connect(): Promise<Keyboard> {
    const response = await fetch(
      `http://127.0.0.1:${process.env.MINI_HELIX_CDP_PORT}/json/list`
    );
    const targets = await response.json() as Target[];
    const target = targets.find(target =>
      target.type === 'page' && target.url.includes('workbench')
    );
    if (!target) { throw new Error('VS Code workbench debugging target was not found'); }
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    const keyboard = new Keyboard(socket);
    await keyboard.send('Page.bringToFront', {});
    await keyboard.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return keyboard;
  }

  async press(
    key: string,
    code: string,
    virtualKey: number,
    text?: string,
    modifiers = 0,
    isKeypad = false
  ): Promise<void> {
    const event = {
      key, code, windowsVirtualKeyCode: virtualKey, modifiers,
      isKeypad, location: isKeypad ? 3 : 0,
    };
    await this.send('Input.dispatchKeyEvent', {
      ...event, type: 'keyDown',
      ...(text === undefined ? {} : { text, unmodifiedText: text }),
    });
    await this.send('Input.dispatchKeyEvent', { ...event, type: 'keyUp' });
    // CDP acknowledges dispatch before extension-host commands and context-key
    // updates finish their round trip. Allow the keybinding action to settle.
    await new Promise(resolve => setTimeout(resolve, 75));
  }

  /** Presses keys in Helix test notation, e.g. `ihello<ret><esc>U`. */
  async keys(sequence: string): Promise<void> {
    const named: Record<string, Parameters<Keyboard['press']>> = {
      '<esc>': ['Escape', 'Escape', 27],
      '<ret>': ['Enter', 'Enter', 13, '\r'],
      ' ': [' ', 'Space', 32, ' '],
      ',': [',', 'Comma', 188, ','],
      '-': ['-', 'Minus', 189, '-'],
    };
    for (const [key] of sequence.matchAll(/<[^>]+>|[\s\S]/gu)) {
      if (named[key]) {
        await this.press(...named[key]);
      } else if (/^[a-z]$/i.test(key)) {
        const upper = key.toUpperCase();
        await this.press(key, `Key${upper}`, upper.charCodeAt(0), key, key === upper ? 8 : 0);
      } else if (/^[0-9]$/.test(key)) {
        await this.press(key, `Digit${key}`, key.charCodeAt(0), key);
      } else {
        throw new Error(`No key for ${JSON.stringify(key)}`);
      }
    }
  }

  dispose(): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Keyboard connection closed'));
    }
    this.pending.clear();
    this.socket.close();
  }

  async evaluate<T>(expression: string): Promise<T> {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true }) as {
      result: { value: T };
    };
    return response.result.value;
  }

  private send(method: string, params: object): Promise<unknown> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out sending ${method}`));
      }, 5000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

export type Mode = 'normal' | 'insert';

/**
 * The command entering INSERT: `i` has its selections prepared here, while
 * `a` and `c` edit and place carets first. Leaving `a`'s INSERT restores the
 * cursor onto the appended text, like Helix.
 */
export type InsertEntry = 'insert' | 'append' | 'change';

export interface ModeState {
  readonly enabled: boolean;
  readonly mode: Mode;
}

/** VS Code integration is injected so the state machine can be tested in Node. */
export interface ModeHost {
  prepareInsert(): void;
  restoreAppendCursor(): void;
  /** INSERT ended: what it typed becomes one undo revision, as in Helix. */
  commitInsert(): void;
  render(state: ModeState): void;
  publish(state: ModeState): Promise<void>;
}

export class ModeController {
  private state: ModeState;
  private appending = false;

  constructor(initial: ModeState, private readonly host: ModeHost) {
    this.state = Object.freeze({ ...initial });
  }

  get current(): ModeState {
    return this.state;
  }

  async initialize(): Promise<void> {
    await this.refresh();
  }

  async enter(mode: Mode, entry: InsertEntry = 'insert'): Promise<void> {
    if (!this.state.enabled || this.state.mode === mode) {
      return;
    }

    if (mode === 'insert') {
      if (entry === 'insert') { this.host.prepareInsert(); }
      this.appending = entry === 'append';
    } else {
      if (this.appending) { this.host.restoreAppendCursor(); }
      this.appending = false;
      this.host.commitInsert();
    }
    this.state = Object.freeze({ ...this.state, mode });
    await this.refresh();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.state.enabled === enabled) {
      return;
    }
    // Text typed while suspended was not appended by `a`.
    this.appending = false;
    if (this.state.mode === 'insert') { this.host.commitInsert(); }
    this.state = Object.freeze({ ...this.state, enabled });
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    const snapshot = this.state;
    this.host.render(snapshot);
    // Publish immediately, before yielding, so successive key presses enqueue
    // context updates in the same order as state transitions.
    await this.host.publish(snapshot);
  }
}

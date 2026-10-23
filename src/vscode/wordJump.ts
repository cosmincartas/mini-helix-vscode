import * as vscode from 'vscode';
import { ModeState } from '../core/mode';
import { WordTarget, wordTargets } from '../core/wordJump';

interface JumpSession {
  readonly editor: vscode.TextEditor;
  readonly version: number;
  readonly targets: readonly WordTarget[];
  prefix: string;
}

/** Transient, editor-local labels; documents are never modified. */
export class WordJump implements vscode.Disposable {
  private session: JumpSession | undefined;
  private readonly labels = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    color: 'transparent',
    backgroundColor: new vscode.ThemeColor('editor.findMatchBackground'),
    before: {
      color: new vscode.ThemeColor('editor.foreground'),
      fontWeight: 'bold',
      // Paint over the hidden grapheme without moving any document text.
      width: '0',
    },
  });
  private readonly prompt = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
  private readonly subscriptions: vscode.Disposable[];

  constructor() {
    this.prompt.name = 'Mini Helix word jump';
    this.prompt.command = 'miniHelix.cancelWordJump';
    this.subscriptions = [
      vscode.window.onDidChangeActiveTextEditor(() => { void this.cancel(); }),
      vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor === this.session?.editor) { void this.cancel(); }
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges(event => {
        if (event.textEditor === this.session?.editor) { void this.cancel(); }
      }),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document === this.session?.editor.document && event.contentChanges.length) {
          void this.cancel();
        }
      }),
      vscode.workspace.onDidCloseTextDocument(document => {
        if (document === this.session?.editor.document) { void this.cancel(); }
      }),
      vscode.window.onDidChangeWindowState(state => {
        if (!state.focused) { void this.cancel(); }
      }),
    ];
  }

  async start(state: ModeState): Promise<void> {
    // Cancel synchronously before creating another session, even on rapid calls.
    const cleared = this.cancel();
    const editor = vscode.window.activeTextEditor;
    if (!editor || !state.enabled || state.mode !== 'normal') {
      await cleared;
      return;
    }
    const document = editor.document;
    const regions = editor.visibleRanges.map(visible => {
      // Use full visible document lines, as Helix does for soft-wrapped lines.
      const lastLine = visible.end.character === 0 && visible.end.line > visible.start.line
        ? visible.end.line - 1 : visible.end.line;
      const range = new vscode.Range(visible.start.line, 0, lastLine, document.lineAt(lastLine).text.length);
      return { offset: document.offsetAt(range.start), text: document.getText(range) };
    });
    const selection = editor.selection;
    // A forward, end-exclusive selection's Helix cursor is inside its last
    // grapheme, not on the character after the selected word.
    const cursor = document.offsetAt(selection.active) -
      (!selection.isEmpty && !selection.isReversed ? 1 : 0);
    const targets = wordTargets(regions, cursor);
    if (!targets.length) {
      await cleared;
      return;
    }
    this.session = { editor, version: document.version, targets, prefix: '' };
    editor.setDecorations(this.labels, targets.flatMap(target => [
      this.decoration(document, target.start, target.firstEnd, target.label[0]),
      this.decoration(document, target.firstEnd, target.secondEnd, target.label[1]),
    ]));
    this.showPrompt('');
    await Promise.all([
      cleared,
      vscode.commands.executeCommand('setContext', 'miniHelix.wordJumpActive', true),
    ]);
  }

  async input(character: unknown): Promise<void> {
    const session = this.session;
    if (!session) { return; }
    if (vscode.window.activeTextEditor !== session.editor ||
        session.editor.document.version !== session.version ||
        typeof character !== 'string' || !/^[a-z]$/.test(character)) {
      await this.cancel();
      return;
    }
    const label = session.prefix + character;
    if (label.length === 1 && session.targets.some(target => target.label.startsWith(label))) {
      session.prefix = label;
      this.showPrompt(label);
      return;
    }
    const target = session.targets.find(target => target.label === label);
    // Clear synchronously before assigning the selection (which emits an event).
    const cleared = this.cancel();
    if (target) {
      const document = session.editor.document;
      const selection = new vscode.Selection(document.positionAt(target.start), document.positionAt(target.end));
      // Like Helix, a successful jump replaces all cursors with one whole word.
      session.editor.selections = [selection];
      session.editor.revealRange(selection);
    }
    await cleared;
  }

  cancel(): Thenable<unknown> {
    const session = this.session;
    this.session = undefined;
    this.prompt.hide();
    if (!session) { return Promise.resolve(); }
    // Editor disposal can race a tab/window close.
    try { session.editor.setDecorations(this.labels, []); } catch { /* no editor left */ }
    return vscode.commands.executeCommand('setContext', 'miniHelix.wordJumpActive', false);
  }

  dispose(): void {
    void this.cancel();
    this.subscriptions.forEach(subscription => subscription.dispose());
    this.labels.dispose();
    this.prompt.dispose();
  }

  private showPrompt(prefix: string): void {
    this.prompt.text = `Jump to word: ${prefix.padEnd(2, '_')} (Esc to cancel)`;
    this.prompt.show();
  }

  private decoration(document: vscode.TextDocument, start: number, end: number, character: string): vscode.DecorationOptions {
    return {
      range: new vscode.Range(document.positionAt(start), document.positionAt(end)),
      renderOptions: { before: { contentText: character } },
    };
  }
}

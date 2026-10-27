import * as vscode from 'vscode';
import { Count } from '../core/count';
import { Edit } from '../core/editing';
import { addSurround, deleteSurround, replaceSurround, selectTextObjects, TextObjectKind } from '../core/match';
import { ModeController } from '../core/mode';
import { OffsetRange, WordMotionText } from '../core/wordMotion';
import { UndoHistory } from './history';
import { CommandQueue } from './queue';

/** What the key of a pending session does: replaces the old delimiter, or adds a pair. */
type SurroundAction = { readonly kind: 'replace'; readonly old: string; readonly count: number } | { readonly kind: 'add' };

interface SurroundSession {
  readonly action: SurroundAction;
  /** Cancelled, or replaced by a later `mr` or `ms`: it records and applies nothing. */
  cancelled: boolean;
  /** Recorded in the queue, after the edits and motions typed before `mr` or `ms`. */
  recorded?: {
    readonly editor: vscode.TextEditor;
    readonly version: number;
    readonly selections: readonly vscode.Selection[];
  };
}

const pendingKey = 'miniHelix.surroundReplacePending';

function sameSelections(a: readonly vscode.Selection[], b: readonly vscode.Selection[]): boolean {
  return a.length === b.length && a.every((selection, index) => selection.isEqual(b[index]));
}

function offsets(editor: vscode.TextEditor): OffsetRange[] {
  return editor.selections.map(selection => ({
    anchor: editor.document.offsetAt(selection.anchor),
    head: editor.document.offsetAt(selection.active),
  }));
}

/** Helix's `mi`, `ma`, `mr`, `ms`, and `md`: text objects and surround edits, by plain text scanning. */
export class Match implements vscode.Disposable {
  private session: SurroundSession | undefined;
  private readonly prompt = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
  private readonly subscriptions: vscode.Disposable[];

  constructor(
    private readonly modes: ModeController,
    private readonly count: Count,
    private readonly queue: CommandQueue,
    private readonly history: UndoHistory
  ) {
    this.prompt.name = 'Mini Helix surround replacement';
    this.prompt.command = 'miniHelix.cancelSurroundReplace';
    // Changes before the session records its state belong to earlier queued commands.
    this.subscriptions = [
      vscode.window.onDidChangeActiveTextEditor(() => { void this.cancel(); }),
      vscode.window.onDidChangeTextEditorSelection(event => {
        const recorded = this.session?.recorded;
        if (recorded && event.textEditor === recorded.editor &&
            !sameSelections(event.selections, recorded.selections)) {
          void this.cancel();
        }
      }),
      vscode.workspace.onDidChangeTextDocument(event => {
        const recorded = this.session?.recorded;
        if (recorded && event.document === recorded.editor.document &&
            event.document.version > recorded.version) {
          void this.cancel();
        }
      }),
      vscode.workspace.onDidCloseTextDocument(document => {
        if (document === this.session?.recorded?.editor.document) { void this.cancel(); }
      }),
      vscode.window.onDidChangeWindowState(state => {
        if (!state.focused) { void this.cancel(); }
      }),
    ];
  }

  register(): vscode.Disposable[] {
    return [
      vscode.commands.registerCommand('miniHelix.selectTextObject', (args?: { kind?: unknown; target?: unknown }) =>
        this.selectTextObject(args?.kind, args?.target)),
      vscode.commands.registerCommand('miniHelix.surroundReplace', (args?: { target?: unknown }) =>
        this.start(args?.target)),
      vscode.commands.registerCommand('miniHelix.surroundAdd', () => this.startAdd()),
      vscode.commands.registerCommand('miniHelix.surroundDelete', (args?: { target?: unknown }) =>
        this.delete(args?.target)),
      vscode.commands.registerCommand('miniHelix.surroundReplaceInput', (character: unknown) =>
        this.input(character)),
      vscode.commands.registerCommand('miniHelix.cancelSurroundReplace', () => this.cancel()),
    ];
  }

  /** Ends the pending session, if any, and releases the keys it captures. */
  cancel(): Thenable<unknown> {
    return this.end(this.session);
  }

  dispose(): void {
    void this.cancel();
    this.subscriptions.forEach(subscription => subscription.dispose());
    this.prompt.dispose();
  }

  private selectTextObject(kind: unknown, target: unknown): Promise<void> {
    const count = this.count.take();
    return this.queue.run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !this.isNormal() || (kind !== 'inside' && kind !== 'around') || typeof target !== 'string') {
        return;
      }
      const ranges = offsets(editor);
      const selected = selectTextObjects(
        new WordMotionText(editor.document.getText()), ranges, kind as TextObjectKind, target, count);
      // Unmatched selections come back as the same objects: leave the view alone if nothing changed.
      if (selected.every((range, index) => range === ranges[index])) { return; }
      const position = (offset: number) => editor.document.positionAt(offset);
      editor.selections = selected.map(range => new vscode.Selection(position(range.anchor), position(range.head)));
      editor.revealRange(editor.selection);
    });
  }

  /** `md<delimiter>`: deletes the count-th enclosing pair of every selection. */
  private delete(target: unknown): Promise<void> {
    const count = this.count.take();
    return this.queue.run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !this.isNormal() || typeof target !== 'string') { return; }
      await this.apply(editor,
        deleteSurround(new WordMotionText(editor.document.getText()), offsets(editor), target, count));
    });
  }

  /** `mr<old>`: waits for the replacement key with the keys captured by `miniHelix.surroundReplacePending`. */
  private start(old: unknown): Promise<void> {
    const count = this.count.take();
    if (typeof old !== 'string') { return Promise.resolve(this.end(this.session)).then(() => undefined); }
    return this.begin({ kind: 'replace', old, count }, `Replace surround ${old} with: _ (Esc to cancel)`);
  }

  /** `ms`: waits for the surround key the same way. Helix ignores a count here, and the key clears it. */
  private startAdd(): Promise<void> {
    this.count.take();
    return this.begin({ kind: 'add' }, 'Surround with: _ (Esc to cancel)');
  }

  private begin(action: SurroundAction, prompt: string): Promise<void> {
    // A repeated `mr` or `ms` replaces the session synchronously; the context key stays set.
    if (this.session) { this.session.cancelled = true; }
    const session: SurroundSession = { action, cancelled: false };
    this.session = session;
    this.prompt.text = prompt;
    this.prompt.show();
    // Set before queueing: the keys that follow must already be captured.
    const published = vscode.commands.executeCommand('setContext', pendingKey, true);
    const recorded = this.queue.run(async () => {
      if (session.cancelled) { return; }
      const editor = vscode.window.activeTextEditor;
      if (!editor || !this.isNormal()) {
        await this.end(session);
        return;
      }
      session.recorded = { editor, version: editor.document.version, selections: editor.selections };
    });
    return Promise.all([published, recorded]).then(() => undefined);
  }

  /** The key of `mr` or `ms`: consumes the session at once, so the next key is an ordinary one. */
  private input(character: unknown): Promise<void> {
    const session = this.session;
    // Without a session, never leave the keys captured behind it.
    if (!session) { return Promise.resolve(vscode.commands.executeCommand('setContext', pendingKey, false)).then(() => undefined); }
    // Detach synchronously: the queue may still be busy with earlier edits. Cancellation
    // listeners no longer see the session; the checks below guard the apply instead.
    this.session = undefined;
    this.prompt.hide();
    const released = vscode.commands.executeCommand('setContext', pendingKey, false);
    const applied = this.queue.run(async () => {
      const recorded = session.recorded;
      const editor = vscode.window.activeTextEditor;
      if (session.cancelled || !recorded || typeof character !== 'string' || editor !== recorded.editor ||
          !this.isNormal() || editor.document.version !== recorded.version ||
          !sameSelections(editor.selections, recorded.selections)) {
        return;
      }
      const document = editor.document;
      const text = new WordMotionText(document.getText());
      const { action } = session;
      await this.apply(editor, action.kind === 'add'
        ? addSurround(text, offsets(editor), character, document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n')
        // `mr` leaves the selections to VS Code.
        : { edits: replaceSurround(text, offsets(editor), action.old, character, action.count) });
    });
    return Promise.all([released, applied]).then(() => undefined);
  }

  /** Applies a surround edit as one revision for `u` and one undo step for native undo. No edits: nothing happens. */
  private async apply(
    editor: vscode.TextEditor,
    result: { readonly edits?: readonly Edit[]; readonly selections?: readonly OffsetRange[] } | undefined
  ): Promise<void> {
    const edits = result?.edits;
    if (!result || !edits?.length) { return; }
    const document = editor.document;
    const ranges = edits.map(edit =>
      new vscode.Range(document.positionAt(edit.from), document.positionAt(edit.to)));
    this.history.hold(document);
    try {
      const applied = await editor.edit(builder => edits.forEach((edit, index) => builder.replace(ranges[index], edit.text)),
        { undoStopBefore: true, undoStopAfter: true });
      if (applied && result.selections) {
        editor.selections = result.selections.map(range =>
          new vscode.Selection(document.positionAt(range.anchor), document.positionAt(range.head)));
        editor.revealRange(editor.selection);
      }
    } finally {
      this.history.commit(editor);
    }
  }

  private end(session: SurroundSession | undefined): Thenable<unknown> {
    if (!session) { return Promise.resolve(); }
    session.cancelled = true;
    if (this.session !== session) { return Promise.resolve(); }
    this.session = undefined;
    this.prompt.hide();
    return vscode.commands.executeCommand('setContext', pendingKey, false);
  }

  private isNormal(): boolean {
    const { enabled, mode } = this.modes.current;
    return enabled && mode === 'normal';
  }
}

import { createHash } from 'node:crypto';
import * as vscode from 'vscode';
import { Count } from '../core/count';
import { HistoryMove, RevisionHistory } from '../core/history';
import { ModeState } from '../core/mode';
import { OffsetRange } from '../core/wordMotion';
import { CommandQueue } from './queue';

type Selections = readonly OffsetRange[];

interface Tracked {
  readonly history: RevisionHistory<Selections>;
  /** A Mini Helix edit is running: its changes are committed by the edit or its INSERT. */
  held: boolean;
}

function fingerprint(document: vscode.TextDocument): string {
  const text = document.getText();
  return `${text.length}:${createHash('sha1').update(text).digest('base64')}`;
}

function offsets(editor: vscode.TextEditor): Selections {
  return editor.selections.map(selection => ({
    anchor: editor.document.offsetAt(selection.anchor),
    head: editor.document.offsetAt(selection.active),
  }));
}

/** Helix's `u` and `U`: undo and redo whole revisions on VS Code's native stack. */
export class UndoHistory implements vscode.Disposable {
  private readonly documents = new Map<vscode.TextDocument, Tracked>();
  private replaying: vscode.TextDocument | undefined;
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly state: () => ModeState, private readonly queue: CommandQueue) {
    // A revision needs the text before its first change, so documents are
    // tracked from the moment they are shown.
    vscode.window.visibleTextEditors.forEach(editor => this.track(editor.document));
    this.subscriptions = [
      vscode.window.onDidChangeVisibleTextEditors(editors => editors.forEach(editor => this.track(editor.document))),
      vscode.workspace.onDidCloseTextDocument(document => this.documents.delete(document)),
      vscode.workspace.onDidChangeTextDocument(event => this.changed(event)),
    ];
  }

  register(count: Count): vscode.Disposable[] {
    return [
      vscode.commands.registerCommand('miniHelix.undo', () => this.move('undo', count.take())),
      vscode.commands.registerCommand('miniHelix.redo', () => this.move('redo', count.take())),
    ];
  }

  /** Keeps a Mini Helix edit's changes together until it calls `commit` or its INSERT ends. */
  hold(document: vscode.TextDocument): void {
    const tracked = this.track(document);
    if (tracked) { tracked.held = true; }
  }

  /** Ends the revision of a NORMAL-mode edit, recording the selections it left. */
  commit(editor: vscode.TextEditor): void {
    const tracked = this.documents.get(editor.document);
    if (!tracked) { return; }
    tracked.held = false;
    tracked.history.commit(fingerprint(editor.document), offsets(editor));
  }

  /** Called when INSERT ends: each document typed in becomes one revision. */
  commitInsert(): void {
    const active = vscode.window.activeTextEditor;
    for (const [document, tracked] of this.documents) {
      tracked.held = false;
      if (!tracked.history.uncommitted) { continue; }
      const editor = active?.document === document
        ? active
        : vscode.window.visibleTextEditors.find(visible => visible.document === document);
      tracked.history.commit(fingerprint(document), editor && offsets(editor));
      if (editor && editor === active) { void this.pushUndoStop(editor); }
    }
  }

  dispose(): void {
    this.subscriptions.forEach(subscription => subscription.dispose());
    this.documents.clear();
  }

  private track(document: vscode.TextDocument): Tracked | undefined {
    // Output channels are append-only logs: never undone, often large.
    if (document.uri.scheme === 'output') { return undefined; }
    let tracked = this.documents.get(document);
    if (!tracked) {
      tracked = { history: new RevisionHistory(fingerprint(document)), held: false };
      this.documents.set(document, tracked);
    }
    return tracked;
  }

  private changed(event: vscode.TextDocumentChangeEvent): void {
    const tracked = this.documents.get(event.document);
    if (!tracked || !event.contentChanges.length) { return; }
    if (event.reason !== undefined) {
      // A native undo or redo (Ctrl+Z) moves the stack under the revisions.
      if (event.document !== this.replaying) { tracked.history.reset(fingerprint(event.document)); }
      return;
    }
    tracked.history.change();
    const { enabled, mode } = this.state();
    // Helix commits after every key outside INSERT, so other changes there
    // (paste, formatting, other extensions) are revisions of their own.
    if (!tracked.held && (!enabled || mode === 'normal')) {
      tracked.history.commit(fingerprint(event.document));
    }
  }

  /** Helix's `u` and `U` with a count: up to `count` revisions, stopping at either end. */
  private move(direction: 'undo' | 'redo', count: number): Promise<void> {
    return this.queue.run(async () => {
      const editor = vscode.window.activeTextEditor;
      const { enabled, mode } = this.state();
      const tracked = editor && this.track(editor.document);
      if (!editor || !tracked || !enabled || mode !== 'normal') { return; }
      const document = editor.document;
      const step = async (command: 'undo' | 'redo') => {
        const version = document.version;
        this.replaying = document;
        try {
          await vscode.commands.executeCommand(command);
        } finally {
          this.replaying = undefined;
        }
        return document.version === version ? undefined : fingerprint(document);
      };
      let last: HistoryMove<Selections> | undefined;
      for (let moves = 0; moves < count; moves++) {
        const result = await tracked.history[direction](step);
        if (!result.moved) {
          vscode.window.setStatusBarMessage(
            direction === 'undo' ? 'Already at oldest change' : 'Already at newest change', 2000);
          break;
        }
        last = result;
      }
      if (!last) { return; }
      if (last.selections) {
        const position = (offset: number) => document.positionAt(offset);
        editor.selections = last.selections.map(range =>
          new vscode.Selection(position(range.anchor), position(range.head)));
      }
      editor.revealRange(editor.selection);
    });
  }

  /**
   * Closes VS Code's open undo element, which would otherwise merge the next
   * INSERT session's typing into this one. Cursor commands push an undo stop
   * first; these are chosen to leave the cursors where they are.
   */
  private async pushUndoStop(editor: vscode.TextEditor): Promise<void> {
    const before = editor.selections;
    try {
      if (before.length === 1) {
        // Moves the head to where it is, keeping the anchor.
        const { line, character } = before[0].active;
        await vscode.commands.executeCommand('_moveToSelect', {
          position: { lineNumber: line + 1, column: character + 1 },
        });
      } else if (before.every(({ active }) => editor.visibleRanges.some(range =>
        range.start.line <= active.line && active.line <= range.end.line))) {
        // Leaves cursors inside the viewport alone.
        await vscode.commands.executeCommand('cursorMove', { to: 'viewPortIfOutside', noHistory: true });
      }
    } catch {
      // Without a stop, the next session may share this one's undo step.
      return;
    }
    const after = editor.selections;
    if (after.length !== before.length || after.some((selection, index) => !selection.isEqual(before[index]))) {
      editor.selections = before;
    }
  }
}

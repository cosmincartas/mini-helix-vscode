import * as vscode from 'vscode';
import {
  append, changeSelection, deleteSelection, EditResult, IndentOptions, restoreAppendCursor,
} from '../core/editing';
import { Count } from '../core/count';
import { InsertEntry, ModeController } from '../core/mode';
import { OffsetRange, WordMotionText } from '../core/wordMotion';
import { UndoHistory } from './history';
import { CommandQueue } from './queue';

type Edit = (text: WordMotionText, ranges: readonly OffsetRange[], editor: vscode.TextEditor) => EditResult;

/** Command id → Helix edit, and the INSERT it enters, if any. */
const commands: Readonly<Record<string, [Edit, InsertEntry?]>> = {
  'miniHelix.append': [(text, ranges, editor) => append(text, ranges, eol(editor.document)), 'append'],
  'miniHelix.changeSelection': [(text, ranges, editor) =>
    changeSelection(text, ranges, eol(editor.document), indentation(editor.options)), 'change'],
  'miniHelix.deleteSelection': [deleteSelection],
};

export const editCommands = Object.keys(commands);

function eol(document: vscode.TextDocument): string {
  return document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

function indentation(options: vscode.TextEditorOptions): IndentOptions {
  const number = (value: unknown, fallback: number) => typeof value === 'number' ? value : fallback;
  const tabSize = number(options.tabSize, 4);
  return {
    unit: options.insertSpaces === false ? '\t' : ' '.repeat(number(options.indentSize, tabSize)),
    tabSize,
  };
}

function offsets(editor: vscode.TextEditor): OffsetRange[] {
  return editor.selections.map(selection => ({
    anchor: editor.document.offsetAt(selection.anchor),
    head: editor.document.offsetAt(selection.active),
  }));
}

function select(editor: vscode.TextEditor, ranges: readonly OffsetRange[]): void {
  const position = (offset: number) => editor.document.positionAt(offset);
  editor.selections = ranges.map(range => new vscode.Selection(position(range.anchor), position(range.head)));
}

/** Helix's `a`, `c`, and `d` on every selection of the active editor. */
export class SelectionEdits {
  private appended: vscode.TextDocument | undefined;

  constructor(private readonly history: UndoHistory, private readonly queue: CommandQueue) {}

  /** Helix ignores a count on these, but the key still clears it. */
  register(modes: ModeController, count: Count): vscode.Disposable[] {
    return Object.entries(commands).map(([id, [edit, entry]]) =>
      vscode.commands.registerCommand(id, () => {
        count.clear();
        return this.run(modes, edit, entry);
      })
    );
  }

  /** Called by the mode controller when `a`'s INSERT ends. */
  restoreAppendCursor(): void {
    const document = this.appended;
    this.appended = undefined;
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) { return; }
    select(editor, restoreAppendCursor(new WordMotionText(document.getText()), offsets(editor)));
  }

  private run(modes: ModeController, edit: Edit, entry?: InsertEntry): Promise<void> {
    return this.queue.run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !modes.current.enabled || modes.current.mode !== 'normal') { return; }
      const document = editor.document;
      const result = edit(new WordMotionText(document.getText()), offsets(editor), editor);
      // Like Helix, `a` and `c` share one revision with the INSERT they start.
      this.history.hold(document);
      if (result.edits.length) {
        const ranges = result.edits.map(change =>
          new vscode.Range(document.positionAt(change.from), document.positionAt(change.to)));
        const applied = await editor.edit(builder =>
          result.edits.forEach((change, index) => builder.replace(ranges[index], change.text)));
        if (!applied) {
          this.history.commit(editor);
          return;
        }
      }
      select(editor, result.selections);
      editor.revealRange(editor.selection);
      if (entry) {
        this.appended = entry === 'append' ? document : undefined;
        await modes.enter('insert', entry);
      } else {
        this.history.commit(editor);
      }
    });
  }
}

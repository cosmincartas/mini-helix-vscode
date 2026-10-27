import * as vscode from 'vscode';
import { Direction, Lines, moveHorizontally, moveVertically } from '../core/charMotion';
import { Count } from '../core/count';
import { ModeController } from '../core/mode';
import { Motion, Queue, registerMotion } from '../core/registerMotion';
import { uniqueSelections } from '../core/selections';
import { OffsetRange } from '../core/wordMotion';
import { prepared } from './word';

/** Command id → direction, for Helix's `h` and `l`. */
export const horizontalMotions: Readonly<Record<string, Direction>> = {
  'miniHelix.moveCharLeft': 'backward',
  'miniHelix.moveCharRight': 'forward',
};

/** Command id → direction, for Helix's `j` and `k`. */
export const verticalMotions: Readonly<Record<string, Direction>> = {
  'miniHelix.moveVisualLineDown': 'forward',
  'miniHelix.moveVisualLineUp': 'backward',
};

function horizontalMotion(direction: Direction): Motion {
  return (document, selection, count) => {
    const range = moveHorizontally(prepared(document), offsets(document, selection), direction, count);
    return new vscode.Selection(document.positionAt(range.anchor), document.positionAt(range.head));
  };
}

function offsets(document: vscode.TextDocument, selection: vscode.Selection): OffsetRange {
  return { anchor: document.offsetAt(selection.anchor), head: document.offsetAt(selection.active) };
}

export function documentLines(document: vscode.TextDocument): Lines {
  return {
    count: document.lineCount,
    indexAt: offset => document.positionAt(offset).line,
    at: index => {
      const line = document.lineAt(index);
      return {
        start: document.offsetAt(line.range.start),
        end: document.offsetAt(line.range.end),
        text: line.text,
      };
    },
  };
}

/** The columns Helix keeps on ranges between vertical moves (`old_visual_position`). */
interface Memory {
  readonly editor: vscode.TextEditor;
  readonly version: number;
  /** `Count.presses` after the move's key: any other key since then forgets the columns. */
  readonly presses: number;
  /** Column by cursor position; cursors that merged have none, as in Helix. */
  readonly columns: ReadonlyMap<string, number | undefined>;
}

const key = ({ anchor, head }: OffsetRange) => `${anchor}:${head}`;

function same(document: vscode.TextDocument, selections: readonly vscode.Selection[], ranges: readonly OffsetRange[]): boolean {
  return selections.length === ranges.length && selections.every((selection, index) =>
    document.offsetAt(selection.anchor) === ranges[index].anchor &&
    document.offsetAt(selection.active) === ranges[index].head);
}

/** Helix's `h`, `j`, `k`, and `l`. */
export class CharMotions {
  private memory: Memory | undefined;

  register(modes: ModeController, count: Count, queue: Queue): vscode.Disposable[] {
    return [
      ...Object.entries(horizontalMotions).map(([id, direction]) =>
        registerMotion(id, horizontalMotion(direction), modes, count, queue)),
      ...Object.entries(verticalMotions).map(([id, direction]) =>
        vscode.commands.registerCommand(id, () => {
          const previous = count.presses;
          const times = count.take();
          const presses = count.presses;
          return queue.run(() => this.vertical(modes, direction, times, previous, presses));
        })),
    ];
  }

  /** `previous` is `Count.presses` before this key, `presses` after it. */
  private async vertical(
    modes: ModeController, direction: Direction, count: number, previous: number, presses: number
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !modes.current.enabled || modes.current.mode !== 'normal') { return; }
    const document = editor.document;
    const ranges = editor.selections.map(selection => offsets(document, selection));

    const memory = this.memory;
    this.memory = undefined;
    if (vscode.workspace.getConfiguration('editor', document).get<string>('wordWrap', 'off') !== 'off') {
      // Helix's soft-wrap mode moves by screen line, and only VS Code knows
      // where it wrapped: collapse to the block cursors and move natively.
      // Unchanged selections keep VS Code's remembered column.
      const text = prepared(document);
      const cursors = ranges.map(range => moveHorizontally(text, range, direction, 0));
      if (!same(document, editor.selections, cursors)) {
        editor.selections = uniqueSelections(cursors.map(({ head }) =>
          new vscode.Selection(document.positionAt(head), document.positionAt(head))));
      }
      await vscode.commands.executeCommand('cursorMove', {
        to: direction === 'forward' ? 'down' : 'up', by: 'wrappedLine', value: count,
      });
      return;
    }

    // Selections set by anything but this motion (a click, say) have no column.
    const columns = memory?.editor === editor && memory.version === document.version &&
      memory.presses === previous ? memory.columns : undefined;
    const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4;
    const lines = documentLines(document);
    const moves = ranges.map(range =>
      moveVertically(lines, range, direction, count, tabSize, columns?.get(key(range))));
    editor.selections = uniqueSelections(moves.map(({ range }) =>
      new vscode.Selection(document.positionAt(range.anchor), document.positionAt(range.head))));
    const remembered = new Map<string, number | undefined>();
    for (const { range, column } of moves) {
      remembered.set(key(range), remembered.has(key(range)) ? undefined : column);
    }
    this.memory = { editor, version: document.version, presses, columns: remembered };
    editor.revealRange(editor.selection);
  }
}

import * as vscode from 'vscode';
import { Count } from '../core/count';
import { transformLineSelection } from '../core/lineSelection';
import { ModeController } from '../core/mode';
import { CommandQueue } from '../vscode/queue';
import { documentLines } from './hjkl';
import { prepared } from './word';

const commands = {
  'miniHelix.extendLineBelow': 'x',
  'miniHelix.extendToLineBounds': 'X',
} as const;

/** Line commands normalize the complete selection set, including its primary. */
export function registerLineSelections(
  modes: ModeController, count: Count, queue: CommandQueue
): vscode.Disposable[] {
  return Object.entries(commands).map(([id, command]) =>
    vscode.commands.registerCommand(id, () => {
      // Capture before yielding: later digits belong to a later command.
      const times = count.take();
      return queue.run(async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !modes.current.enabled || modes.current.mode !== 'normal') { return; }
        const document = editor.document;
        const text = prepared(document);
        const result = transformLineSelection(text, {
          ranges: editor.selections.map(selection => ({
            anchor: document.offsetAt(selection.anchor),
            head: document.offsetAt(selection.active),
          })),
          primaryIndex: 0,
        }, command, times, /\r(?!\n)/.test(text.text) ? undefined : documentLines(document));
        const primary = result.ranges[result.primaryIndex];
        const primaryFirst = [primary, ...result.ranges.filter((_, index) => index !== result.primaryIndex)];
        editor.selections = primaryFirst.map(range => new vscode.Selection(
          document.positionAt(range.anchor), document.positionAt(range.head)
        ));
        editor.revealRange(editor.selection);
      });
    })
  );
}

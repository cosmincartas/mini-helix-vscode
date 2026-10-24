import * as vscode from 'vscode';
import { Count } from './count';
import { ModeController } from './mode';

/** A motion transforms one selection, `count` times, without changing the document. */
export type Motion = (
  document: vscode.TextDocument,
  selection: vscode.Selection,
  count: number
) => vscode.Selection;

/** Runs commands in key order; see `CommandQueue`. */
export interface Queue {
  run<T>(task: () => Promise<T>): Promise<T>;
}

const immediate: Queue = { run: task => task() };

/**
 * Register a stateless motion; interactive word jumps have their own controller.
 * Pass the edit queue so a motion typed after `d` or `u` sees their result.
 */
export function registerMotion(
  id: string,
  motion: Motion,
  modes: ModeController,
  count: Count,
  queue: Queue = immediate
): vscode.Disposable {
  return vscode.commands.registerCommand(id, () => {
    // The count belongs to this key press, so take it before waiting.
    const times = count.take();
    return queue.run(async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !modes.current.enabled || modes.current.mode !== 'normal') {
        return;
      }

      editor.selections = editor.selections.map(selection =>
        motion(editor.document, selection, times)
      );
      editor.revealRange(editor.selection);
    });
  });
}

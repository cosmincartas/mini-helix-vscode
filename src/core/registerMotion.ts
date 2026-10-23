import * as vscode from 'vscode';
import { Count } from './count';
import { ModeController } from './mode';

/** A motion transforms one selection, `count` times, without changing the document. */
export type Motion = (
  document: vscode.TextDocument,
  selection: vscode.Selection,
  count: number
) => vscode.Selection;

/** Register a stateless motion; interactive word jumps have their own controller. */
export function registerMotion(
  id: string,
  motion: Motion,
  modes: ModeController,
  count: Count
): vscode.Disposable {
  return vscode.commands.registerCommand(id, () => {
    const times = count.take();
    const editor = vscode.window.activeTextEditor;
    if (!editor || !modes.current.enabled || modes.current.mode !== 'normal') {
      return;
    }

    editor.selections = editor.selections.map(selection =>
      motion(editor.document, selection, times)
    );
    editor.revealRange(editor.selection);
  });
}

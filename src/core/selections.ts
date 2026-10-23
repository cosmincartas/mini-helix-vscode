import * as vscode from 'vscode';

/** `i` inserts before selections instead of replacing their contents. */
export function prepareInsert(editor: vscode.TextEditor | undefined): void {
  if (!editor) {
    return;
  }

  editor.selections = editor.selections.map(selection =>
    new vscode.Selection(selection.start, selection.start)
  );
}

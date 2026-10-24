import * as vscode from 'vscode';

/** Keep the primary and selection order when identical cursors converge. */
export function uniqueSelections(selections: readonly vscode.Selection[]): vscode.Selection[] {
  const seen = new Set<string>();
  return selections.filter(selection => {
    const { anchor, active } = selection;
    const key = `${anchor.line}:${anchor.character}:${active.line}:${active.character}`;
    if (seen.has(key)) { return false; }
    seen.add(key);
    return true;
  });
}

/** `i` inserts before selections instead of replacing their contents. */
export function prepareInsert(editor: vscode.TextEditor | undefined): void {
  if (!editor) {
    return;
  }

  editor.selections = editor.selections.map(selection =>
    new vscode.Selection(selection.start, selection.start)
  );
}

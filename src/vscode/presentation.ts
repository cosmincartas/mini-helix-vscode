import * as vscode from 'vscode';
import { ModeState } from '../core/mode';

/** Owns temporary editor UI changes; never writes editor settings. */
export class Presentation implements vscode.Disposable {
  private readonly status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  private readonly styledEditors = new Set<vscode.TextEditor>();
  private state: ModeState | undefined;
  private count: number | undefined;

  constructor() {
    this.status.name = 'Mini Helix mode';
  }

  render(state: ModeState): void {
    this.state = state;
    const visible = new Set(vscode.window.visibleTextEditors);
    for (const editor of this.styledEditors) {
      if (!visible.has(editor) || !state.enabled || state.mode === 'insert') {
        this.restoreCursor(editor);
      }
    }

    if (state.enabled && state.mode === 'normal') {
      for (const editor of visible) {
        this.styledEditors.add(editor);
        editor.options = { cursorStyle: vscode.TextEditorCursorStyle.Block };
      }
    }

    if (!vscode.window.activeTextEditor) {
      this.status.hide();
      return;
    }

    this.status.text = this.label(state);
    this.status.tooltip = state.enabled
      ? 'Mini Helix: click to toggle NORMAL / INSERT. Run “Suspend / Resume Modal Editing” to restore native input.'
      : 'Mini Helix is suspended. Click to resume.';
    this.status.command = state.enabled
      ? 'miniHelix.toggleMode'
      : 'miniHelix.toggleEnabled';
    this.status.show();
  }

  /** Shows a pending count next to the mode, like Helix's pending-keys area. */
  showCount(count: number | undefined): void {
    this.count = count;
    if (this.state && vscode.window.activeTextEditor) { this.status.text = this.label(this.state); }
  }

  dispose(): void {
    for (const editor of this.styledEditors) {
      this.restoreCursor(editor);
    }
    this.status.dispose();
  }

  private label(state: ModeState): string {
    if (!state.enabled) { return '$(circle-slash) HELIX OFF'; }
    const count = this.count === undefined ? '' : ` ${this.count}`;
    return `$(keyboard) ${state.mode.toUpperCase()}${count}`;
  }

  private restoreCursor(editor: vscode.TextEditor): void {
    this.styledEditors.delete(editor);
    // Editor controls are reused across tabs and can retain our block option.
    // Resolve the current resource/language setting instead of saving options
    // from an incoming editor, which might already contain our temporary style.
    const configured = vscode.workspace.getConfiguration('editor', editor.document)
      .get<string>('cursorStyle', 'line');
    const styles: Record<string, vscode.TextEditorCursorStyle> = {
      line: vscode.TextEditorCursorStyle.Line,
      block: vscode.TextEditorCursorStyle.Block,
      underline: vscode.TextEditorCursorStyle.Underline,
      'line-thin': vscode.TextEditorCursorStyle.LineThin,
      'block-outline': vscode.TextEditorCursorStyle.BlockOutline,
      'underline-thin': vscode.TextEditorCursorStyle.UnderlineThin,
    };
    // A just-closed editor can already have been disposed by VS Code.
    try {
      editor.options = {
        cursorStyle: styles[configured] ?? vscode.TextEditorCursorStyle.Line,
      };
    } catch {
      // There is no cursor left to restore on a disposed editor.
    }
  }
}

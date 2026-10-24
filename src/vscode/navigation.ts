import * as vscode from 'vscode';
import { Count } from '../core/count';
import { ModeController } from '../core/mode';
import { CommandQueue } from './queue';

/** Delegate language navigation, smart selection, and jump history to VS Code. */
export const navigationCommands: Record<string, string> = {
  'miniHelix.gotoDefinition': 'editor.action.revealDefinition',
  'miniHelix.gotoReferences': 'editor.action.goToReferences',
  'miniHelix.expandSelection': 'editor.action.smartSelect.expand',
  'miniHelix.shrinkSelection': 'editor.action.smartSelect.shrink',
  'miniHelix.jumpBack': 'workbench.action.navigateBack',
  'miniHelix.jumpForward': 'workbench.action.navigateForward',
};

export function registerNavigation(
  modes: ModeController, count: Count, queue: CommandQueue
): vscode.Disposable[] {
  return Object.entries(navigationCommands).map(([id, command]) =>
    vscode.commands.registerCommand(id, () => {
      // These commands consume a prefix but do not repeat native UI actions.
      count.clear();
      return queue.run(async () => {
        if (!modes.current.enabled || modes.current.mode !== 'normal' || !vscode.window.activeTextEditor) {
          return;
        }
        await vscode.commands.executeCommand(command);
      });
    })
  );
}

import * as vscode from 'vscode';
import { Mode, ModeController, ModeState } from './core/mode';
import { registerMotion } from './core/registerMotion';
import { prepareInsert } from './core/selections';
import { wordMotion, wordMotions } from './motions/word';
import { SelectionEdits } from './vscode/editing';
import { UndoHistory } from './vscode/history';
import { Presentation } from './vscode/presentation';
import { CommandQueue } from './vscode/queue';
import { WordJump } from './vscode/wordJump';

export interface MiniHelixApi {
  getState(): ModeState;
}

let presentation: Presentation | undefined;
let wordJump: WordJump | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<MiniHelixApi> {
  const config = vscode.workspace.getConfiguration('miniHelix');
  const ui = new Presentation();
  presentation = ui;
  const jump = new WordJump();
  wordJump = jump;

  const modes = new ModeController(
    {
      enabled: config.get<boolean>('enabled', true),
      mode: config.get<Mode>('defaultMode', 'normal'),
    },
    {
      prepareInsert: () => prepareInsert(vscode.window.activeTextEditor),
      restoreAppendCursor: () => edits.restoreAppendCursor(),
      commitInsert: () => history.commitInsert(),
      render: state => {
        if (!state.enabled || state.mode !== 'normal') { void jump.cancel(); }
        ui.render(state);
      },
      publish: async state => {
        await Promise.all([
          vscode.commands.executeCommand('setContext', 'miniHelix.enabled', state.enabled),
          vscode.commands.executeCommand('setContext', 'miniHelix.mode', state.mode),
        ]);
      },
    }
  );
  // Edits and undo share a queue, so `du` undoes the `d` it follows.
  const queue = new CommandQueue();
  const history = new UndoHistory(() => modes.current, queue);
  const edits = new SelectionEdits(history, queue);

  context.subscriptions.push(
    ui,
    jump,
    history,
    vscode.commands.registerCommand('miniHelix.gotoWord', () => jump.start(modes.current)),
    vscode.commands.registerCommand('miniHelix.wordJumpInput', character => jump.input(character)),
    vscode.commands.registerCommand('miniHelix.cancelWordJump', () => jump.cancel()),
    vscode.commands.registerCommand('miniHelix.noop', () => undefined),
    ...Object.entries(wordMotions).map(([id, target]) =>
      registerMotion(id, wordMotion(target), modes)
    ),
    ...edits.register(modes),
    ...history.register(),
    // Mode keys wait for queued edits: `ui` must not type into an unfinished undo.
    vscode.commands.registerCommand('miniHelix.enterNormal', () => queue.run(async () => {
      await modes.enter('normal');
      // Escape should not leave completion UI open behind NORMAL mode.
      if (modes.current.enabled) {
        await vscode.commands.executeCommand('hideSuggestWidget');
        await vscode.commands.executeCommand('closeParameterHints');
      }
    })),
    vscode.commands.registerCommand('miniHelix.enterInsert', () => queue.run(() => modes.enter('insert'))),
    vscode.commands.registerCommand('miniHelix.toggleMode', () => queue.run(() =>
      modes.enter(modes.current.mode === 'normal' ? 'insert' : 'normal')
    )),
    vscode.commands.registerCommand('miniHelix.toggleEnabled', () =>
      modes.setEnabled(!modes.current.enabled)
    ),
    vscode.window.onDidChangeActiveTextEditor(() => ui.render(modes.current)),
    vscode.window.onDidChangeVisibleTextEditors(() => ui.render(modes.current)),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('miniHelix.enabled')) {
        void modes.setEnabled(
          vscode.workspace.getConfiguration('miniHelix').get<boolean>('enabled', true)
        );
      }
      if (event.affectsConfiguration('editor.cursorStyle')) {
        ui.render(modes.current);
      }
    })
  );

  await modes.initialize();
  return { getState: () => modes.current };
}

export async function deactivate(): Promise<void> {
  await wordJump?.cancel();
  wordJump = undefined;
  presentation?.dispose();
  presentation = undefined;
  await Promise.all([
    vscode.commands.executeCommand('setContext', 'miniHelix.enabled', false),
    vscode.commands.executeCommand('setContext', 'miniHelix.mode', undefined),
    vscode.commands.executeCommand('setContext', 'miniHelix.wordJumpActive', false),
  ]);
}

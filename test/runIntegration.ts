import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as net.AddressInfo;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '../..');
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'mini-helix-test-'));
  const profile = path.join(temporary, 'profile');
  const workspace = path.join(temporary, 'workspace');
  const port = await availablePort();
  try {
    await mkdir(path.join(profile, 'User'), { recursive: true });
    await mkdir(workspace);
    await writeFile(path.join(profile, 'User/settings.json'), JSON.stringify({
      'editor.cursorStyle': 'underline',
      'editor.multiCursorMergeOverlapping': false,
      'editor.quickSuggestions': false,
      'editor.wordBasedSuggestions': 'off',
      'miniHelix.enabled': true,
      'miniHelix.defaultMode': 'normal',
      'security.workspace.trust.enabled': false,
      'workbench.startupEditor': 'none',
      'update.mode': 'none',
      'telemetry.telemetryLevel': 'off',
    }));
    // Test-only opt-in binding, not part of the shipped extension.
    await writeFile(path.join(profile, 'User/keybindings.json'), JSON.stringify([
      {
        key: 'g h', command: 'cursorLineStart',
        when: 'editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && !miniHelix.wordJumpActive',
      },
      {
        key: 'x', command: 'cursorEnd',
        when: 'editorTextFocus && miniHelix.enabled && miniHelix.mode == normal && resourceScheme == mini-helix-line-override',
      },
    ]));

    await runTests({
      vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH || undefined,
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(root, 'out/test/integration/index.js'),
      extensionTestsEnv: { MINI_HELIX_CDP_PORT: String(port) },
      launchArgs: [
        workspace,
        `--user-data-dir=${profile}`,
        `--extensions-dir=${path.join(temporary, 'extensions')}`,
        `--remote-debugging-port=${port}`,
        '--disable-extensions',
        '--disable-gpu',
        '--disable-extension=github.copilot-chat',
        '--disable-extension=github.copilot',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        '--no-sandbox',
      ],
    });
  } finally {
    await rm(temporary, { recursive: true, force: true, maxRetries: 5 });
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ModeController, ModeHost, ModeState } from '../../src/core/mode';

function fixture(initial: ModeState = { enabled: true, mode: 'normal' }) {
  const rendered: ModeState[] = [];
  const published: ModeState[] = [];
  let insertPreparations = 0;
  let restores = 0;
  // Host calls that end INSERT, in order.
  const endings: string[] = [];
  const host: ModeHost = {
    prepareInsert: () => { insertPreparations++; },
    restoreAppendCursor: () => { restores++; endings.push('restore'); },
    restoreOpenIndent: () => { endings.push('open'); },
    commitInsert: () => { endings.push('commit'); },
    render: state => { rendered.push(state); },
    publish: async state => { published.push(state); },
  };
  return {
    modes: new ModeController(initial, host),
    rendered,
    published,
    preparations: () => insertPreparations,
    restores: () => restores,
    endings,
  };
}

test('initialization publishes and renders the configured state', async () => {
  const f = fixture();
  await f.modes.initialize();
  assert.deepEqual(f.published, [{ enabled: true, mode: 'normal' }]);
  assert.deepEqual(f.rendered, f.published);
  assert.equal(f.preparations(), 0);
});

test('INSERT prepares selections once, NORMAL preserves them', async () => {
  const f = fixture();
  await f.modes.enter('insert');
  await f.modes.enter('insert');
  await f.modes.enter('normal');
  assert.equal(f.preparations(), 1);
  assert.deepEqual(f.published.map(state => state.mode), ['insert', 'normal']);
});

test('a and c place their own carets; only leaving a restores the cursor', async () => {
  const f = fixture();
  await f.modes.enter('insert', 'append');
  await f.modes.enter('normal');
  await f.modes.enter('normal');
  assert.equal(f.restores(), 1);
  await f.modes.enter('insert', 'change');
  await f.modes.enter('normal');
  await f.modes.enter('insert');
  await f.modes.enter('normal');
  assert.equal(f.restores(), 1);
  assert.equal(f.preparations(), 1, 'only i collapses selections');
});

test('leaving INSERT commits its undo revision, after restoring the append cursor', async () => {
  const f = fixture();
  await f.modes.enter('insert');
  assert.deepEqual(f.endings, [], 'entering INSERT does not commit');
  await f.modes.enter('normal');
  await f.modes.enter('normal');
  assert.deepEqual(f.endings, ['commit']);
  await f.modes.enter('insert', 'append');
  await f.modes.enter('normal');
  assert.deepEqual(f.endings, ['commit', 'restore', 'commit']);
});

test('suspending INSERT commits its revision; suspending NORMAL does not', async () => {
  const f = fixture();
  await f.modes.setEnabled(false);
  await f.modes.setEnabled(true);
  assert.deepEqual(f.endings, []);
  await f.modes.enter('insert');
  await f.modes.setEnabled(false);
  assert.deepEqual(f.endings, ['commit']);
});

test('suspending INSERT forgets a pending append restore', async () => {
  const f = fixture();
  await f.modes.enter('insert', 'append');
  await f.modes.setEnabled(false);
  await f.modes.setEnabled(true);
  await f.modes.enter('normal');
  assert.equal(f.restores(), 0);
});

test('disabled mode commands do not consume transitions or prepare selections', async () => {
  const f = fixture({ enabled: false, mode: 'normal' });
  await f.modes.enter('insert');
  assert.deepEqual(f.modes.current, { enabled: false, mode: 'normal' });
  assert.equal(f.preparations(), 0);
  assert.equal(f.published.length, 0);
});

test('suspending and resuming preserves the previous mode', async () => {
  const f = fixture({ enabled: true, mode: 'insert' });
  await f.modes.setEnabled(false);
  await f.modes.setEnabled(false);
  await f.modes.setEnabled(true);
  assert.deepEqual(f.published, [
    { enabled: false, mode: 'insert' },
    { enabled: true, mode: 'insert' },
  ]);
  assert.equal(f.preparations(), 0);
});

test('INSERT can be the initial mode without changing existing selections', async () => {
  const f = fixture({ enabled: true, mode: 'insert' });
  await f.modes.initialize();
  assert.equal(f.modes.current.mode, 'insert');
  assert.equal(f.preparations(), 0);
});

test('state snapshots are immutable and do not change after transitions', async () => {
  const f = fixture();
  const before = f.modes.current;
  assert.ok(Object.isFrozen(before));
  assert.throws(() => {
    (before as { mode: string }).mode = 'insert';
  }, TypeError);
  await f.modes.enter('insert');
  assert.equal(before.mode, 'normal');
  assert.equal(f.modes.current.mode, 'insert');
});

test('rapid transitions render and publish in invocation order', async () => {
  const f = fixture();
  await Promise.all([
    f.modes.enter('insert'),
    f.modes.enter('normal'),
    f.modes.setEnabled(false),
  ]);
  assert.deepEqual(f.rendered, f.published);
  assert.deepEqual(f.published, [
    { enabled: true, mode: 'insert' },
    { enabled: true, mode: 'normal' },
    { enabled: false, mode: 'normal' },
  ]);
});

test('leaving an o or O INSERT removes untouched indentation before committing, once', async () => {
  const f = fixture();
  await f.modes.enter('insert', 'open');
  assert.equal(f.preparations(), 0, 'o and O place their own carets');
  assert.deepEqual(f.endings, [], 'entering INSERT does not restore');
  await f.modes.enter('normal');
  assert.deepEqual(f.endings, ['open', 'commit']);
  await f.modes.enter('insert');
  await f.modes.enter('normal');
  assert.deepEqual(f.endings, ['open', 'commit', 'commit'], 'a later plain INSERT does not restore');
});

test('suspending INSERT forgets a pending open restore', async () => {
  const f = fixture();
  await f.modes.enter('insert', 'open');
  await f.modes.setEnabled(false);
  await f.modes.setEnabled(true);
  await f.modes.enter('normal');
  assert.ok(f.endings.length > 0 && !f.endings.includes('open'), 'neither ending restores');
});

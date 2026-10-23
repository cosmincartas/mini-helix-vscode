import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RevisionHistory } from '../../src/core/history';

/**
 * VS Code's undo stack, with the text as its own fingerprint: each element
 * undoes to the text before it, and an open element absorbs further changes.
 */
class NativeStack {
  steps = 0;
  private undoStack: { before: string; after: string }[] = [];
  private redoStack: { before: string; after: string }[] = [];
  private open = false;

  constructor(public text: string, private readonly history: RevisionHistory<string>) {}

  /** A forward change; `merge` continues the open element, like consecutive typing. */
  change(text: string, merge = false): this {
    const top = this.undoStack.at(-1);
    if (merge && this.open && top) {
      top.after = text;
    } else {
      this.undoStack.push({ before: this.text, after: text });
    }
    this.open = true;
    this.redoStack = [];
    this.text = text;
    this.history.change();
    return this;
  }

  /** Changes that a single native undo step reverts together. */
  type(...texts: string[]): this {
    texts.forEach((text, index) => this.change(text, index > 0));
    return this;
  }

  stop(): this {
    this.open = false;
    return this;
  }

  commit(selections?: string): this {
    this.history.commit(this.text, selections);
    return this.stop();
  }

  readonly step = async (direction: 'undo' | 'redo') => {
    this.steps++;
    this.open = false;
    const element = (direction === 'undo' ? this.undoStack : this.redoStack).pop();
    if (!element) { return undefined; }
    (direction === 'undo' ? this.redoStack : this.undoStack).push(element);
    this.text = direction === 'undo' ? element.before : element.after;
    return this.text;
  };
}

function fixture(text: string) {
  const history = new RevisionHistory<string>(text);
  const native = new NativeStack(text, history);
  return {
    history,
    native,
    undo: () => history.undo(native.step),
    redo: () => history.redo(native.step),
  };
}

// Port of helix-core/src/history.rs `test_undo_redo`, with each revision
// spread over several native steps, like VS Code typing split at a space.
test('Helix history: undo and redo whole revisions; undo at the root is a no-op', async () => {
  const { native, undo, redo } = fixture('hello');
  native.type('hello ').stop().type('hello world', 'hello world!').commit();
  native.type('hello !').stop().type('hello 世!', 'hello 世界!').commit();
  assert.equal(native.text, 'hello 世界!');

  await undo();
  assert.equal(native.text, 'hello world!');
  await redo();
  assert.equal(native.text, 'hello 世界!');
  await undo();
  await undo();
  assert.equal(native.text, 'hello');

  assert.deepEqual(await undo(), { moved: false });
  assert.equal(native.text, 'hello');
});

test('redo restores the selections recorded with the revision', async () => {
  const { native, undo, redo } = fixture('');
  native.type('a').stop().type('a b').commit('cursor after b');
  assert.deepEqual(await undo(), { moved: true, selections: undefined });
  assert.equal(native.steps, 2, 'one u steps over every native element of the revision');
  assert.deepEqual(await redo(), { moved: true, selections: 'cursor after b' });
  assert.equal(native.text, 'a b');
  assert.deepEqual(await redo(), { moved: false });
});

test('a native step spanning revisions stops at the revision it reaches', async () => {
  const { history, native, undo, redo } = fixture('');
  native.type('hello');
  // Without an undo stop, VS Code merges the next INSERT session into the same element.
  history.commit('hello');
  native.change('helloworld', true).commit();
  await undo();
  assert.equal(native.text, '');
  assert.equal(native.steps, 1);
  await redo();
  assert.equal(native.text, 'helloworld', 'redo replays the merged element');
  await undo();
  assert.equal(native.text, '');
});

test('a revision that restores earlier text stops at the nearest revision', async () => {
  const { native, undo, redo } = fixture('abc');
  native.change('bc').commit();
  native.change('abc').commit();
  await undo();
  assert.equal(native.text, 'bc');
  await undo();
  assert.equal(native.text, 'abc');
  await redo();
  await redo();
  assert.equal(native.text, 'abc');
  assert.deepEqual(await redo(), { moved: false });
});

test('new revisions after an undo drop the redo branch, like the native stack', async () => {
  const { native, undo, redo } = fixture('foo bar');
  native.change(' bar').commit();
  await undo();
  native.change('foo ').commit();
  assert.deepEqual(await redo(), { moved: false });
  assert.equal(native.text, 'foo ');
  await undo();
  assert.equal(native.text, 'foo bar');
  await redo();
  assert.equal(native.text, 'foo ');
});

test('history from before tracking falls back to one native step at a time', async () => {
  const history = new RevisionHistory<string>('ab');
  const native = new NativeStack('a', history);
  // Typed before tracking began, so not counted as a change.
  native.change('ab');
  history.reset('ab');
  native.change('abc');
  native.commit();
  await history.undo(native.step);
  assert.equal(native.text, 'ab');
  assert.equal(native.steps, 1);
  await history.undo(native.step);
  assert.equal(native.text, 'a');
  assert.equal(native.steps, 2);
  assert.deepEqual(await history.undo(native.step), { moved: false });
  await history.redo(native.step);
  assert.equal(native.text, 'ab', 'redo also falls back to one native step');
});

test('undo gives up after as many native steps as the revision had changes', async () => {
  const { history, native, undo } = fixture('a');
  native.change('ab').commit();
  native.change('abc').commit();
  // The stack lost track of the revisions, e.g. a native undo was not reported.
  history.reset('abc');
  history.change();
  history.commit('abcd');
  native.steps = 0;
  assert.deepEqual(await undo(), { moved: true });
  assert.equal(native.steps, 1, 'one change, so at most one native step');
  assert.equal(native.text, 'ab');
});

test('an exhausted native stack drops the revisions it can no longer reach', async () => {
  const history = new RevisionHistory<string>('a');
  history.change();
  history.commit('ab');
  const empty = async () => undefined;
  assert.deepEqual(await history.undo(empty), { moved: false });
  assert.deepEqual(await history.undo(empty), { moved: false });
  assert.deepEqual(await history.redo(empty), { moved: false });
});

test('commit needs a pending change; uncommitted reports one', () => {
  const history = new RevisionHistory<string>('');
  assert.equal(history.uncommitted, false);
  assert.equal(history.commit('x'), false);
  history.change();
  history.change();
  assert.equal(history.uncommitted, true);
  assert.equal(history.commit('xy'), true);
  assert.equal(history.uncommitted, false);
  history.change();
  history.reset('z');
  assert.equal(history.uncommitted, false, 'reset forgets pending changes');
});

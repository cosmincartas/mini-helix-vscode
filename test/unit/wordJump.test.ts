import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wordTargets } from '../../src/core/wordJump';

function targets(text: string, cursor = 0) {
  return wordTargets([{ text, offset: 0 }], cursor);
}

function labeled(text: string, cursor: number) {
  return targets(text, cursor).map(target => [target.label, text.slice(target.start, target.end)]);
}

test('labels alternate after/before the primary cursor, skipping its current word', () => {
  assert.deepEqual(labeled('zero one two three four', 10), [
    ['aa', 'three'], ['ab', 'one'], ['ac', 'four'], ['ad', 'zero'],
  ]);
});

test('word under cursor is skipped at its start, middle, and final character', () => {
  for (const cursor of [3, 4, 5]) {
    assert.deepEqual(labeled('aa bbb cc', cursor), [['aa', 'cc'], ['ab', 'aa']]);
  }
});

test('cursor on whitespace or punctuation does not skip a neighboring word', () => {
  for (const cursor of [3, 4]) {
    assert.deepEqual(labeled('one .two', cursor), [['aa', 'two'], ['ab', 'one']]);
  }
});

test('punctuation separates words; underscores, digits, and camelCase stay together', () => {
  assert.deepEqual(labeled(' foo.bar x _ snake_case fooBar 12 =<', 0), [
    ['aa', 'foo'], ['ab', 'bar'], ['ac', 'snake_case'], ['ad', 'fooBar'], ['ae', '12'],
  ]);
});

test('labels require two graphemes, not two UTF-16 units', () => {
  const text = ' 𐐀 𐐀𐐁 日本 café';
  const result = targets(text);
  assert.deepEqual(result.map(target => text.slice(target.start, target.end)), ['𐐀𐐁', '日本', 'café']);
  assert.deepEqual([result[0].start, result[0].firstEnd, result[0].secondEnd], [4, 6, 8]);
  for (const target of result) {
    assert.equal([...text.slice(target.start, target.firstEnd)].length, 1);
    assert.equal([...text.slice(target.firstEnd, target.secondEnd)].length, 1);
  }
});

test('only supplied visible regions get targets; overlaps are deduplicated', () => {
  const regions = [
    { text: 'three four', offset: 20 },
    { text: 'one two', offset: 0 },
    { text: 'two', offset: 4 },
  ];
  assert.deepEqual(wordTargets(regions, 10).map(target => [target.label, target.start, target.end]), [
    ['aa', 20, 25], ['ab', 4, 7], ['ac', 26, 30], ['ad', 0, 3],
  ]);
});

test('label pairs roll over at az and stop at zz', () => {
  const result = targets(' ' + Array.from({ length: 800 }, () => 'word').join(' '));
  assert.equal(result.length, 676);
  assert.equal(result[0].label, 'aa');
  assert.equal(result[25].label, 'az');
  assert.equal(result[26].label, 'ba');
  assert.equal(result[675].label, 'zz');
  assert.equal(new Set(result.map(target => target.label)).size, result.length);
});

test('empty content, single-letter words, and a lone current word have no targets', () => {
  for (const text of ['', ' ', 'x y z !?', 'word']) {
    assert.deepEqual(targets(text), []);
  }
});

test('all words may precede or follow an off-viewport cursor', () => {
  const regions = [{ text: 'one two', offset: 10 }];
  assert.deepEqual(wordTargets(regions, 0).map(target => target.start), [10, 14]);
  assert.deepEqual(wordTargets(regions, 30).map(target => target.start), [14, 10]);
});

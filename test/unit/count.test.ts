import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Count, MAX_COUNT } from '../../src/core/count';

test('counts default to one, accumulate, and are consumed once', () => {
  const count = new Count();
  assert.equal(count.take(), 1);
  count.digit(0);
  assert.equal(count.pending, undefined);
  count.digit(2);
  count.digit(0);
  count.digit(3);
  assert.equal(count.pending, 203);
  assert.equal(count.take(), 203);
  assert.equal(count.take(), 1);
});

test('overflow digits are ignored without discarding the pending count', () => {
  const count = new Count();
  for (const digit of String(MAX_COUNT)) { count.digit(Number(digit)); }
  assert.equal(count.pending, MAX_COUNT);
  count.digit(1);
  count.digit(0);
  assert.equal(count.take(), MAX_COUNT);
  for (const digit of '999999999') { count.digit(Number(digit)); }
  assert.equal(count.take(), 99_999_999);
});

test('callbacks observe changes and clearing an empty count does nothing', () => {
  const changes: (number | undefined)[] = [];
  const count = new Count(value => changes.push(value));
  count.clear();
  count.digit(0);
  count.digit(4);
  count.digit(2);
  assert.equal(count.take(), 42);
  count.clear();
  count.digit(7);
  count.clear();
  assert.deepEqual(changes, [4, 42, undefined, 7, undefined]);
});

test('invalid digits cannot start, corrupt, or clear a count', () => {
  const count = new Count();
  for (const invalid of [-1, 10, 0.5, NaN, Infinity]) { count.digit(invalid); }
  assert.equal(count.pending, undefined);
  count.digit(3);
  for (const invalid of [-1, 10, 0.5, NaN, Infinity]) { count.digit(invalid); }
  assert.equal(count.take(), 3);
});

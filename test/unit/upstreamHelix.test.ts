import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUpstream } from './upstreamHelix';
import { parse } from './helix';

test('upstream importer preserves directed ranges and sorted primary identity', () => {
  assert.deepEqual(parseUpstream('#(a|)#b#[|c]#'), {
    text: 'abc', ranges: [{ anchor: 0, head: 1 }, { anchor: 3, head: 2 }], primaryIndex: 1,
  });
  assert.deepEqual(parseUpstream('#[|]#'), {
    text: '', ranges: [{ anchor: 0, head: 0 }], primaryIndex: 0,
  });
});

test('upstream display line endings skip the identical following LF or CRLF', () => {
  for (const eol of ['\n', '\r\n']) {
    for (const notation of [`#[a${eol}|]#${eol}b`, `#[|a${eol}]#${eol}b`]) {
      const imported = parseUpstream(notation);
      assert.equal(imported.text, `a${eol}b`);
      assert.equal(Math.min(imported.ranges[0].anchor, imported.ranges[0].head), 0);
      assert.equal(Math.max(imported.ranges[0].anchor, imported.ranges[0].head), 1 + eol.length);
      assert.equal(parse(notation).text, `a${eol}${eol}b`, 'existing parser keeps its round-trip contract');
    }
  }
  assert.equal(parseUpstream('#[a\r|]#\rb').text, 'a\r\rb', 'lone CR is not display-newline syntax');
  assert.equal(parseUpstream('#[a\n|]#\r\nb').text, 'a\n\r\nb', 'different endings are not skipped');
});

test('upstream importer converts character positions to UTF-16 without changing Unicode', () => {
  assert.deepEqual(parseUpstream('😀#[|e\u0301👨‍👩‍👧‍👦]#z'), {
    text: '😀e\u0301👨‍👩‍👧‍👦z',
    ranges: [{ anchor: 15, head: 2 }], primaryIndex: 0,
  });
  assert.deepEqual(parseUpstream('hello #[|👨‍👩‍👧‍👦]# goodbye'), {
    text: 'hello 👨‍👩‍👧‍👦 goodbye', ranges: [{ anchor: 17, head: 6 }], primaryIndex: 0,
  });
});

test('upstream importer rejects missing primary, duplicate primary, and missing endpoint markers', () => {
  for (const notation of ['plain', '#(a|)#', '#[a|]##[b|]#', '#[abc]#', '#[|abc', '#[abc|)#']) {
    assert.throws(() => parseUpstream(notation), /primary|Unclosed/i, notation);
  }
});

test('upstream importer preserves ordinary hash and interior pipe characters', () => {
  assert.equal(parseUpstream('a#z #[a|b|]#').text, 'a#z a|b');
});

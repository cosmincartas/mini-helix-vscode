import * as vscode from 'vscode';
import { Motion } from '../core/registerMotion';
import { moveWord, WordMotionTarget, WordMotionText } from '../core/wordMotion';

/** Command id → Helix target, in Helix's `w`, `b`, `e`, `W`, `B`, `E` order. */
export const wordMotions: Readonly<Record<string, WordMotionTarget>> = {
  'miniHelix.moveNextWordStart': 'nextWordStart',
  'miniHelix.movePrevWordStart': 'prevWordStart',
  'miniHelix.moveNextWordEnd': 'nextWordEnd',
  'miniHelix.moveNextLongWordStart': 'nextLongWordStart',
  'miniHelix.movePrevLongWordStart': 'prevLongWordStart',
  'miniHelix.moveNextLongWordEnd': 'nextLongWordEnd',
};

// One command transforms every selection synchronously, so prepare the text
// once per command instead of once per cursor, and drop it afterwards.
let cache: { document: vscode.TextDocument; version: number; text: WordMotionText } | undefined;

export function prepared(document: vscode.TextDocument): WordMotionText {
  if (cache?.document !== document || cache.version !== document.version) {
    if (!cache) { queueMicrotask(() => { cache = undefined; }); }
    cache = { document, version: document.version, text: new WordMotionText(document.getText()) };
  }
  return cache.text;
}

/** Select like Helix: the result replaces the selection rather than extending it. */
export function wordMotion(target: WordMotionTarget): Motion {
  return (document, selection, count) => {
    const range = moveWord(prepared(document), {
      anchor: document.offsetAt(selection.anchor),
      head: document.offsetAt(selection.active),
    }, target, count);
    return new vscode.Selection(document.positionAt(range.anchor), document.positionAt(range.head));
  };
}

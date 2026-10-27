import * as vscode from 'vscode';
import { Count } from '../core/count';
import { gotoFirstNonWhitespace, gotoLastLine, gotoLine, gotoLineEnd } from '../core/gotoMotion';
import { ModeController } from '../core/mode';
import { Motion, Queue, registerMotion } from '../core/registerMotion';
import { OffsetRange } from '../core/wordMotion';
import { documentLines } from './hjkl';
import { prepared } from './word';

/** Select like Helix: the result replaces the selection rather than extending it. */
function gotoMotion(
  move: (document: vscode.TextDocument, range: OffsetRange, count: number) => OffsetRange
): Motion {
  return (document, selection, count) => {
    const range = move(document, {
      anchor: document.offsetAt(selection.anchor),
      head: document.offsetAt(selection.active),
    }, count);
    return new vscode.Selection(document.positionAt(range.anchor), document.positionAt(range.head));
  };
}

/** Command id → motion for Helix's `gs`, `gl`, `gg`, and `ge`; only `gg` reads the count. */
export const gotoMotions: Readonly<Record<string, Motion>> = {
  'miniHelix.gotoFirstNonWhitespace': gotoMotion((document, range) =>
    gotoFirstNonWhitespace(documentLines(document), range)),
  'miniHelix.gotoLineEnd': gotoMotion((document, range) =>
    gotoLineEnd(prepared(document), documentLines(document), range)),
  'miniHelix.gotoFileStart': gotoMotion((document, _range, count) => gotoLine(documentLines(document), count)),
  'miniHelix.gotoLastLine': gotoMotion(document => gotoLastLine(documentLines(document))),
};

export function registerGotoMotions(modes: ModeController, count: Count, queue: Queue): vscode.Disposable[] {
  return Object.entries(gotoMotions).map(([id, motion]) => registerMotion(id, motion, modes, count, queue));
}

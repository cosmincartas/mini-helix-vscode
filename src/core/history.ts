/**
 * Helix's undo history laid over VS Code's native undo stack.
 *
 * Helix records one revision per NORMAL-mode change and one per INSERT session
 * (with the `a` or `c` edit that started it). VS Code's stack is finer: typing
 * splits at word boundaries, and an edit plus the typing after it are separate
 * steps. So `u` and `U` step the native stack until the document matches the
 * neighbouring revision, identified by a fingerprint of its text.
 */

/** One native undo or redo; the new fingerprint, or `undefined` if nothing changed. */
export type NativeStep = (direction: 'undo' | 'redo') => Promise<string | undefined>;

export interface HistoryMove<S> {
  readonly moved: boolean;
  /** Selections recorded when the revision reached by a redo was committed. */
  readonly selections?: S;
}

interface Revision<S> {
  readonly fingerprint: string;
  readonly selections?: S;
  /** Native changes in this revision: at least as many as its undo steps. */
  readonly changes: number;
}

export class RevisionHistory<S> {
  private revisions: Revision<S>[] = [];
  private current = 0;
  private pending = 0;

  constructor(fingerprint: string) {
    this.reset(fingerprint);
  }

  get uncommitted(): boolean {
    return this.pending > 0;
  }

  /** A forward change, not made by undo or redo. */
  change(): void {
    this.pending++;
  }

  /** Helix's `append_changes_to_history`: pending changes become a revision. */
  commit(fingerprint: string, selections?: S): boolean {
    if (!this.pending) { return false; }
    this.revisions.splice(this.current + 1, Infinity, { fingerprint, selections, changes: this.pending });
    this.current++;
    this.pending = 0;
    return true;
  }

  /** The native stack moved in a way revisions cannot follow; start over from here. */
  reset(fingerprint: string): void {
    this.revisions = [{ fingerprint, changes: 0 }];
    this.current = 0;
    this.pending = 0;
  }

  undo(step: NativeStep): Promise<HistoryMove<S>> {
    return this.move(step, 'undo');
  }

  redo(step: NativeStep): Promise<HistoryMove<S>> {
    return this.move(step, 'redo');
  }

  private async move(step: NativeStep, direction: 'undo' | 'redo'): Promise<HistoryMove<S>> {
    const undo = direction === 'undo';
    const target = undo ? this.current - 1 : this.current + 1;
    if (target < 0 || target >= this.revisions.length) {
      // Native history from before tracking began (or after a native undo):
      // fall back to VS Code's own granularity.
      const fingerprint = await step(direction);
      if (fingerprint === undefined) { return { moved: false }; }
      this.reset(fingerprint);
      return { moved: true };
    }

    // Each native step undoes at least one change, so this bounds the search
    // if the native stack no longer holds the expected revisions.
    const budget = this.revisions[undo ? this.current : target].changes;
    let fingerprint: string | undefined;
    for (let steps = 0; steps < budget; steps++) {
      const next = await step(direction);
      if (next === undefined) { break; }
      fingerprint = next;
      // A native step can span revisions; stop at the nearest one reached.
      const reached = this.find(fingerprint, target, undo ? 0 : this.revisions.length - 1);
      if (reached !== undefined) {
        this.current = reached;
        return { moved: true, selections: undo ? undefined : this.revisions[reached].selections };
      }
    }
    if (fingerprint === undefined) {
      // The native stack is exhausted: these revisions are no longer reachable.
      this.revisions.splice(undo ? 0 : this.current + 1, undo ? this.current : Infinity);
      if (undo) { this.current = 0; }
      return { moved: false };
    }
    this.reset(fingerprint);
    return { moved: true };
  }

  private find(fingerprint: string, from: number, to: number): number | undefined {
    const direction = Math.sign(to - from) || 1;
    for (let index = from; index !== to + direction; index += direction) {
      if (this.revisions[index].fingerprint === fingerprint) { return index; }
    }
    return undefined;
  }
}

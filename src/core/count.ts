/** Helix ignores a digit that would make the count larger than this. */
export const MAX_COUNT = 100_000_000;

/**
 * Helix's count prefix (`3w`): `1`–`9` start it, any digit continues it, and
 * the next other key uses and clears it. Kept in the extension, not in a
 * context key, so digits typed quickly never race a context update.
 */
export class Count {
  private value: number | undefined;

  constructor(private readonly changed: (value: number | undefined) => void = () => undefined) {}

  get pending(): number | undefined {
    return this.value;
  }

  /** A digit key. `0` is unbound in Helix, so it does nothing unless a count is pending. */
  digit(digit: number): void {
    if (this.value === undefined) {
      if (digit !== 0) { this.set(digit); }
      return;
    }
    const value = this.value * 10 + digit;
    if (value <= MAX_COUNT) { this.set(value); }
  }

  /** Any other key: returns the count to use (1 when none was typed) and clears it. */
  take(): number {
    const value = this.value ?? 1;
    this.clear();
    return value;
  }

  clear(): void {
    if (this.value !== undefined) { this.set(undefined); }
  }

  private set(value: number | undefined): void {
    this.value = value;
    this.changed(value);
  }
}

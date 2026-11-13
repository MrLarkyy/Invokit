/** A Storage kept in memory: the stand-in when the browser blocks localStorage, and the store in tests. */
export class MemoryStorage implements Storage {
  [name: string]: unknown;
  private readonly values = new Map<string, string>();
  /** Makes every write throw like a full quota (tests). */
  failWrites = false;
  /** Keys whose writes throw like a full quota (tests). */
  readonly failingKeys = new Set<string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failWrites || this.failingKeys.has(key)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.values.set(key, value);
  }
}

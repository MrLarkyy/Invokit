import { MemoryStorage } from '../storage/memoryStorage';

/** A storage with room for `budget` characters of keys and values, refusing a write over it as a browser does. */
export class QuotaStorage extends MemoryStorage {
  constructor(private readonly budget: number) {
    super();
  }

  override setItem(key: string, value: string): void {
    let used = key.length + value.length;
    for (let i = 0; i < this.length; i += 1) {
      const other = this.key(i);
      if (other !== null && other !== key) used += other.length + (this.getItem(other)?.length ?? 0);
    }
    if (used > this.budget) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    super.setItem(key, value);
  }
}

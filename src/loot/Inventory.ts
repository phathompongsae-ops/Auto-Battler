import type { ItemId } from '../data/itemData';

/** In-memory item counts. Placeholder until a real inventory exists. */
export class Inventory {
  private readonly counts = new Map<ItemId, number>();

  add(itemId: ItemId, amount = 1): void {
    this.counts.set(itemId, this.count(itemId) + amount);
  }

  /** Remove `amount`; returns false (and removes nothing) if there aren't enough. */
  remove(itemId: ItemId, amount = 1): boolean {
    const have = this.count(itemId);
    if (amount <= 0 || have < amount) return false;
    if (have === amount) this.counts.delete(itemId);
    else this.counts.set(itemId, have - amount);
    return true;
  }

  count(itemId: ItemId): number {
    return this.counts.get(itemId) ?? 0;
  }

  total(): number {
    let total = 0;
    for (const n of this.counts.values()) total += n;
    return total;
  }

  entries(): [ItemId, number][] {
    return [...this.counts.entries()];
  }

  clear(): void {
    this.counts.clear();
  }
}

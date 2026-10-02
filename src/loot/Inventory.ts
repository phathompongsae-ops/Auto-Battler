import type { ItemId } from '../data/itemData';

/** In-memory item counts. Placeholder until a real inventory exists. */
export class Inventory {
  private readonly counts = new Map<ItemId, number>();

  add(itemId: ItemId, amount = 1): void {
    this.counts.set(itemId, this.count(itemId) + amount);
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

import type { CombatEntity } from '../combat/types';
import type { EventBus } from '../core/EventBus';
import { distance } from '../core/math';
import { defaultRng, type Rng } from '../core/rng';
import { LOOT_DROP, LOOT_TABLES, type ItemId, type LootEntry, type LootTableId } from '../data/itemData';
import type { GameEvents } from '../game/GameEvents';
import type { Inventory } from './Inventory';

export interface LootDrop {
  id: number;
  itemId: ItemId;
  x: number;
  y: number;
  droppedAt: number;
  expiresAt: number;
}

/** Which loot categories may roll (default: all). */
export interface LootGates {
  farmingDrops?: boolean;
  questDrops?: boolean;
}

/** Rolls loot tables, keeps items on the ground for a while, handles pickup. */
export class LootSystem {
  readonly drops: LootDrop[] = [];
  rng: Rng = defaultRng;
  private nextId = 1;

  constructor(
    private readonly events: EventBus<GameEvents>,
    readonly inventory: Inventory,
  ) {}

  /**
   * Roll a loot table. `farmingDrops` gates farming and rare entries (off with
   * no Field Energy); `questDrops` gates quest entries (off in dungeons).
   * Skipped entries are not rolled at all.
   */
  roll(tableId: LootTableId, x: number, y: number, now: number, options: LootGates = {}): LootDrop[] {
    return this.rollEntries(LOOT_TABLES[tableId], x, y, now, options);
  }

  rollEntries(entries: readonly LootEntry[], x: number, y: number, now: number, { farmingDrops = true, questDrops = true }: LootGates = {}): LootDrop[] {
    const dropped: LootDrop[] = [];
    for (const entry of entries) {
      const isQuest = entry.category === 'quest';
      if (isQuest ? !questDrops : !farmingDrops) continue;
      if (this.rng() < entry.chance) {
        const offset = dropped.length * 10;
        dropped.push(this.spawn(entry.itemId, x + offset, y, now));
      }
    }
    return dropped;
  }

  spawn(itemId: ItemId, x: number, y: number, now: number): LootDrop {
    const drop: LootDrop = {
      id: this.nextId++,
      itemId,
      x,
      y,
      droppedAt: now,
      expiresAt: now + LOOT_DROP.lifetime,
    };
    this.drops.push(drop);
    this.events.emit('lootDropped', { dropId: drop.id, itemId, x, y, expiresAt: drop.expiresAt });
    return drop;
  }

  /** Expires old drops and lets a living collector walk over drops to pick them up. */
  update(now: number, collector: CombatEntity): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (now >= drop.expiresAt) {
        this.drops.splice(i, 1);
        this.events.emit('lootExpired', { dropId: drop.id, itemId: drop.itemId });
      } else if (!collector.combat.dead && distance(collector, drop) <= LOOT_DROP.pickupRadius) {
        this.drops.splice(i, 1);
        this.inventory.add(drop.itemId);
        this.events.emit('lootPicked', { dropId: drop.id, itemId: drop.itemId, byId: collector.id });
      }
    }
  }

  clear(): void {
    for (const drop of this.drops.splice(0)) {
      this.events.emit('lootExpired', { dropId: drop.id, itemId: drop.itemId });
    }
  }
}

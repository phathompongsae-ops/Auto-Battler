import type { CombatEntity } from '../combat/types';
import type { EventBus } from '../core/EventBus';
import { distance } from '../core/math';
import { defaultRng, type Rng } from '../core/rng';
import { ITEMS, LOOT_DROP, LOOT_TABLES, type ItemDef, type ItemId, type LootTableId } from '../data/itemData';
import type { GameEvents } from '../game/GameEvents';
import type { Inventory } from './Inventory';

export interface LootDrop {
  id: number;
  item: ItemDef;
  x: number;
  y: number;
  droppedAt: number;
  expiresAt: number;
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

  roll(tableId: LootTableId, x: number, y: number, now: number): LootDrop[] {
    const dropped: LootDrop[] = [];
    for (const entry of LOOT_TABLES[tableId]) {
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
      item: ITEMS[itemId],
      x,
      y,
      droppedAt: now,
      expiresAt: now + LOOT_DROP.lifetime,
    };
    this.drops.push(drop);
    this.events.emit('lootDropped', { drop });
    return drop;
  }

  /** Expires old drops and lets a living collector walk over drops to pick them up. */
  update(now: number, collector: CombatEntity): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (now >= drop.expiresAt) {
        this.drops.splice(i, 1);
        this.events.emit('lootExpired', { drop });
      } else if (!collector.combat.dead && distance(collector, drop) <= LOOT_DROP.pickupRadius) {
        this.drops.splice(i, 1);
        this.inventory.add(drop.item.id as ItemId);
        this.events.emit('lootPicked', { drop, by: collector });
      }
    }
  }

  clear(): void {
    for (const drop of this.drops.splice(0)) this.events.emit('lootExpired', { drop });
  }
}

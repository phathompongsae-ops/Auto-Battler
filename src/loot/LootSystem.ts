import type { CombatEntity } from '../combat/types';
import type { EventBus } from '../core/EventBus';
import { distance } from '../core/math';
import { defaultRng, type Rng } from '../core/rng';
import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import { ITEMS, LOOT_DROP, LOOT_TABLES, type ItemId, type LootEntry, type LootTableId } from '../data/itemData';
import type { DemoTestMode } from '../data/demoTestMode';
import type { GameEvents } from '../game/GameEvents';
import type { Inventory } from './Inventory';

/** Where a rolled drop goes: straight into the bag, or onto the ground to be picked up. */
export type LootDelivery = 'auto' | 'ground';

interface LootDropBase {
  id: number;
  x: number;
  y: number;
  droppedAt: number;
  expiresAt: number;
  delivery: LootDelivery;
  /** The loot category it rolled as ('farming' when unset). */
  category: 'farming' | 'rare' | 'quest';
}

/** What dropped: a stackable item, or an equipment piece (by definition id). */
export type LootDropKind = { kind: 'item'; itemId: ItemId } | { kind: 'equipment'; defId: string };

export type LootDrop = LootDropBase & LootDropKind;

/** Which loot categories may roll (default: all). */
export interface LootGates {
  farmingDrops?: boolean;
  questDrops?: boolean;
}

/**
 * Decides each rolled drop's delivery. Default: normal rewards (farming and
 * quest materials) are auto-looted; rare-category drops, rare+ items and
 * every equipment piece go to the ground as special drops.
 */
export type LootPolicy = (drop: LootDropKind & { category: LootDrop['category'] }) => LootDelivery;

export const defaultLootPolicy: LootPolicy = (drop) => {
  if (drop.kind === 'equipment' || drop.category === 'rare') return 'ground';
  return ITEMS[drop.itemId].rarity === 'rare' || ITEMS[drop.itemId].rarity === 'legendary' ? 'ground' : 'auto';
};

/** Takes loot into a bag. Returns false when there is no room (the drop then stays on the ground). */
export interface LootReceiver {
  readonly id: string;
  store(drop: LootDrop): { ok: true; instanceId?: string } | { ok: false; reason: 'inventory_full' };
}

/**
 * Something that picks up ground drops by being near them: the player today;
 * a pet's Auto-Loot later (a second collector with its own radius), with no
 * change to how rewards are rolled or stored.
 */
export interface LootCollector {
  readonly id: string;
  position(): { x: number; y: number };
  readonly radius: number;
  /** False while it can't pick anything up (dead, disabled...). */
  active(): boolean;
}

/**
 * Rolls loot tables and delivers the results: auto-loot into the receiver
 * (the player's bag) or ground drops that collectors pick up. Without a
 * receiver (engine-free tests), every drop goes to the ground and pickup
 * adds items straight to the inventory, as before.
 */
export class LootSystem {
  readonly drops: LootDrop[] = [];
  rng: Rng = defaultRng;
  policy: LootPolicy = defaultLootPolicy;
  receiver: LootReceiver | null = null;
  private readonly collectors: LootCollector[] = [];
  /** Ground drops already reported as blocked by a full bag (reported once). */
  private readonly blocked = new Set<number>();
  private nextId = 1;

  constructor(
    private readonly events: EventBus<GameEvents>,
    readonly inventory: Inventory,
    private readonly tuning?: DemoTestMode,
  ) {}

  addCollector(collector: LootCollector): void {
    this.collectors.push(collector);
  }

  removeCollector(id: string): void {
    const i = this.collectors.findIndex((c) => c.id === id);
    if (i >= 0) this.collectors.splice(i, 1);
  }

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
      const chance = this.tuning?.dropChance(entry.chance) ?? entry.chance;
      if (chance > 0 && this.rng() < chance) {
        const offset = dropped.length * 10;
        const category = entry.category ?? 'farming';
        dropped.push('itemId' in entry ? this.spawn(entry.itemId, x + offset, y, now, category) : this.spawnEquipment(entry.equipmentId, x + offset, y, now));
      }
    }
    return dropped;
  }

  /** A rolled item: auto-looted when the policy says so and there is room, otherwise left on the ground. */
  spawn(itemId: ItemId, x: number, y: number, now: number, category: LootDrop['category'] = 'farming'): LootDrop {
    const base = { kind: 'item' as const, itemId, id: this.nextId++, x, y, droppedAt: now, expiresAt: now + LOOT_DROP.lifetime, category };
    const drop: LootDrop = { ...base, delivery: this.receiver ? this.policy(base) : 'ground' };
    this.events.emit('lootDropped', { dropId: drop.id, itemId, x, y, expiresAt: drop.expiresAt, delivery: drop.delivery });
    if (drop.delivery === 'auto' && this.collect(drop, this.receiver!.id, true)) return drop;
    drop.delivery = 'ground';
    this.drops.push(drop);
    return drop;
  }

  /** A rolled equipment piece (always a ground drop; the instance is created when picked up). */
  spawnEquipment(defId: string, x: number, y: number, now: number): LootDrop {
    const drop: LootDrop = { kind: 'equipment', defId, id: this.nextId++, x, y, droppedAt: now, expiresAt: now + LOOT_DROP.lifetime, category: 'rare', delivery: 'ground' };
    this.drops.push(drop);
    this.events.emit('equipmentDropped', { dropId: drop.id, defId, rarity: EQUIPMENT_DEFS[defId].rarity, x, y, expiresAt: drop.expiresAt });
    return drop;
  }

  /**
   * Expire old drops; every active collector (the given entity, plus any
   * registered collector) picks up the drops within its radius.
   */
  update(now: number, collector?: CombatEntity): void {
    const collectors: LootCollector[] = [...this.collectors];
    if (collector) {
      collectors.unshift({ id: collector.id, position: () => collector, radius: LOOT_DROP.pickupRadius, active: () => !collector.combat.dead });
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (now >= drop.expiresAt) {
        this.drops.splice(i, 1);
        this.blocked.delete(drop.id);
        this.events.emit('lootExpired', { dropId: drop.id, itemId: drop.kind === 'item' ? drop.itemId : null });
        continue;
      }
      const by = collectors.find((c) => c.active() && distance(c.position(), drop) <= c.radius);
      if (by && this.collect(drop, by.id, false)) {
        const at = this.drops.indexOf(drop);
        if (at >= 0) this.drops.splice(at, 1);
        this.blocked.delete(drop.id);
      }
    }
  }

  /** Put a drop in the bag. False (and a one-time notice) when the bag has no room. */
  private collect(drop: LootDrop, byId: string, auto: boolean): boolean {
    const stored = this.receiver ? this.receiver.store(drop) : this.legacyStore(drop);
    if (!stored.ok) {
      if (!this.blocked.has(drop.id)) {
        this.blocked.add(drop.id);
        const name = drop.kind === 'item' ? ITEMS[drop.itemId].name : EQUIPMENT_DEFS[drop.defId].name;
        this.events.emit('lootBlocked', { dropId: drop.id, name, reason: stored.reason });
      }
      return false;
    }
    if (drop.kind === 'item') {
      this.events.emit('lootPicked', { dropId: drop.id, itemId: drop.itemId, byId, auto });
      this.events.emit('itemAcquired', { itemId: drop.itemId, amount: 1, source: 'loot' });
    } else {
      this.events.emit('equipmentPicked', { dropId: drop.id, defId: drop.defId, instanceId: stored.instanceId ?? '', byId });
    }
    return true;
  }

  /** No receiver (tests without a bag): items go straight to the inventory; equipment can't be stored. */
  private legacyStore(drop: LootDrop): { ok: true; instanceId?: string } | { ok: false; reason: 'inventory_full' } {
    if (drop.kind !== 'item') return { ok: false, reason: 'inventory_full' };
    this.inventory.add(drop.itemId);
    return { ok: true };
  }

  clear(): void {
    for (const drop of this.drops.splice(0)) {
      this.events.emit('lootExpired', { dropId: drop.id, itemId: drop.kind === 'item' ? drop.itemId : null });
    }
    this.blocked.clear();
  }
}

import type { CombatantState } from '../combat/CombatantState';
import { PeriodicResourceSystem, restoreResource, type Resource } from '../combat/PeriodicResourceSystem';
import type { EventBus } from '../core/EventBus';
import { type ItemId, type ItemUse } from '../data/itemData';
import type { GameEvents } from '../game/GameEvents';
import type { Inventory } from '../loot/Inventory';
import type { AutoPotionSettings } from './potionSettings';

export const POTION_COOLDOWNS = { hp: 8000, mp: 12000 } as const;
export const POTION_CHOICES: Record<Resource, readonly ItemId[]> = {
  hp: ['small_hp_potion', 'medium_hp_potion'], mp: ['small_mp_potion', 'medium_mp_potion'],
};
export const potionKey = (resource: Resource) => resource === 'hp' ? 'hp_potion' : 'mp_potion';
export type PotionFailure = 'dead' | 'action_locked' | 'cooldown' | 'resource_full';
/** Real item effect. Inventory owns consumption through useItem, not this service. */
export class PotionSystem {
  readonly periodic = new PeriodicResourceSystem();
  constructor(private readonly events: EventBus<GameEvents>, private readonly now: () => number) {}
  apply(c: CombatantState, itemId: ItemId, effect: Extract<ItemUse, { kind: 'potion' }>): { ok: true } | { ok: false; reason: PotionFailure } {
    const now = this.now(), resource = effect.resource;
    if (c.dead) return { ok: false, reason: 'dead' };
    if (c.actionLocked(now)) return { ok: false, reason: 'action_locked' };
    if ((c.utilityCooldowns.get(potionKey(resource)) ?? 0) > now) return { ok: false, reason: 'cooldown' };
    const max = resource === 'hp' ? c.stats.maxHp : c.stats.maxMp;
    if (c[resource] >= max) return { ok: false, reason: 'resource_full' };
    const restored = restoreResource(c, resource, effect.instant);
    c.utilityCooldowns.set(potionKey(resource), now + POTION_COOLDOWNS[resource]);
    this.periodic.add(c, `potion_${resource}`, { resource, sourceId: itemId, percentage: effect.hotPercent, duration: 3000, interval: 1000 }, now);
    if (resource === 'hp') this.events.emit('heal', { targetId: c.id, amount: restored });
    else this.events.emit('mpRestored', { targetId: c.id, amount: restored });
    return { ok: true };
  }
}
export function preferredPotion(inventory: Inventory, resource: Resource): ItemId | null {
  return POTION_CHOICES[resource].find(id => inventory.count(id) > 0) ?? null;
}
/** Cheap 250ms game-time checks; retry only after cooldown or hysteresis rearming. */
export class AutoPotion {
  private nextCheck = 0;
  private readonly usedUntil = { hp: 0, mp: 0 };
  update(c: CombatantState, inventory: Inventory, settings: AutoPotionSettings, inCombat: boolean, now: number, use: (id: ItemId) => { ok: boolean }): void {
    if (now < this.nextCheck) return;
    this.nextCheck = now + 250;
    if (!inCombat || c.dead || c.actionLocked(now)) return;
    this.check('hp', c, inventory, settings.hpEnabled, settings.hpThreshold, now, use);
    this.check('mp', c, inventory, settings.mpEnabled, settings.mpThreshold, now, use);
  }
  private check(resource: Resource, c: CombatantState, inventory: Inventory, enabled: boolean, threshold: number, now: number, use: (id: ItemId) => { ok: boolean }): void {
    if (!enabled) return;
    const max = resource === 'hp' ? c.stats.maxHp : c.stats.maxMp;
    const percent = max > 0 ? c[resource] / max * 100 : 100;
    if (percent > threshold + 5) this.usedUntil[resource] = 0;
    if (percent > threshold || c[resource] >= max || now < this.usedUntil[resource] || now < (c.utilityCooldowns.get(potionKey(resource)) ?? 0)) return;
    const id = preferredPotion(inventory, resource);
    if (id && use(id).ok) this.usedUntil[resource] = now + POTION_COOLDOWNS[resource];
  }
  reset(): void { this.nextCheck = 0; this.usedUntil.hp = this.usedUntil.mp = 0; }
}

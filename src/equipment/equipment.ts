import { ENCHANT_OPTIONS, type EnchantQuality } from '../data/enchantData';
import {
  CATEGORY_FOR_TYPE,
  CLASS_WEAPONS,
  ENHANCEMENT_CURVE,
  EQUIPMENT_SLOTS,
  MAX_ENHANCEMENT,
  SLOTS_FOR_TYPE,
  WEAPON_HANDS,
  type EquipmentSlot,
} from '../data/equipmentData';
import { EQUIPMENT_DEFS, type BaseStatKey, type EquipmentDef } from '../data/equipmentItems';
import type { JobId } from '../data/jobData';
import type { DerivedStatKey, StatModifier } from '../stats/modifiers';
import type { PrimaryStats } from '../stats/primaryStats';
import { evaluateSets } from './sets';

/*
 * Equipment v1. An instance stores only what is unique to that item
 * (enhancement level, rolled enchant lines); everything else comes from its
 * definition. Final character stats are never stored on items.
 */

export interface EnchantLine {
  optionId: string;
  quality: EnchantQuality;
  value: number;
}

export interface EquipmentInstance {
  instanceId: string;
  defId: string;
  enhancement: number;
  enchants: EnchantLine[];
  /** Hook for trade/bind rules later. */
  bound: boolean;
}

export function defOf(item: EquipmentInstance): EquipmentDef {
  const def = EQUIPMENT_DEFS[item.defId];
  if (!def) throw new Error(`unknown equipment def ${item.defId}`);
  return def;
}

/** Base stats after enhancement: base × (1 + curve[level]), rounded. Nothing else is enhanced. */
export function enhancedBaseStats(item: EquipmentInstance): Partial<Record<BaseStatKey, number>> {
  const def = defOf(item);
  const bonus = ENHANCEMENT_CURVE[CATEGORY_FOR_TYPE[def.slotType]][item.enhancement] ?? 0;
  const out: Partial<Record<BaseStatKey, number>> = {};
  for (const [k, v] of Object.entries(def.base) as [BaseStatKey, number][]) out[k] = Math.round(v * (1 + bonus));
  return out;
}

const add = <K extends string>(into: Partial<Record<K, number>>, key: K, v: number) => {
  into[key] = (into[key] ?? 0) + v;
};

/** What one layer of an item adds to its 'equipment' modifier. */
export interface ItemStatContribution {
  primary?: Partial<PrimaryStats>;
  flat?: Partial<Record<DerivedStatKey, number>>;
  percent?: Partial<Record<DerivedStatKey, number>>;
  effects?: Readonly<Record<string, number>>;
}

/**
 * One independent source of an item's stats. The item's modifier is the sum
 * of every layer, so each system owns its own layer and none edits another:
 * fixed definition bonuses, enhanced base stats (Enhancement), rolled lines
 * (Enchant). Future Socket / Card systems add a layer reading their own
 * instance data (e.g. socketed cards) — no change to the others, to the stat
 * pipeline or to saves of existing items.
 */
export interface ItemStatLayer {
  id: string;
  contribute(item: EquipmentInstance, def: EquipmentDef): ItemStatContribution;
}

export const ITEM_STAT_LAYERS: readonly ItemStatLayer[] = [
  { id: 'definition', contribute: (_item, def) => ({ primary: def.primary, flat: def.flat, percent: def.percent }) },
  { id: 'enhancement', contribute: (item) => ({ flat: enhancedBaseStats(item) as Partial<Record<DerivedStatKey, number>> }) },
  {
    id: 'enchant',
    contribute: (item) => {
      const out: { primary: Partial<PrimaryStats>; flat: Partial<Record<DerivedStatKey, number>>; effects: Record<string, number> } = { primary: {}, flat: {}, effects: {} };
      for (const line of item.enchants) {
        const target = ENCHANT_OPTIONS[line.optionId]?.target;
        if (!target) continue;
        if (target.kind === 'primary') add(out.primary, target.stat, line.value);
        else if (target.kind === 'flat') add(out.flat, target.stat, line.value);
        else add(out.effects, target.effect, line.value);
      }
      return out;
    },
  },
];

/** One item as an 'equipment' modifier: the sum of its stat layers (definition + Enhancement + Enchant). */
export function itemModifier(item: EquipmentInstance): StatModifier {
  return itemModifierFrom(item, ITEM_STAT_LAYERS);
}

/** itemModifier over an explicit layer list (tests, or a future system previewing its own layer). */
export function itemModifierFrom(item: EquipmentInstance, layers: readonly ItemStatLayer[]): StatModifier {
  const def = defOf(item);
  const primary: Partial<PrimaryStats> = {};
  const flat: Partial<Record<DerivedStatKey, number>> = {};
  const percent: Partial<Record<DerivedStatKey, number>> = {};
  const effects: Record<string, number> = {};
  for (const layer of layers) {
    const c = layer.contribute(item, def);
    for (const [k, v] of Object.entries(c.primary ?? {}) as [keyof PrimaryStats, number][]) add(primary, k, v);
    for (const [k, v] of Object.entries(c.flat ?? {}) as [DerivedStatKey, number][]) add(flat, k, v);
    for (const [k, v] of Object.entries(c.percent ?? {}) as [DerivedStatKey, number][]) add(percent, k, v);
    for (const [k, v] of Object.entries(c.effects ?? {})) add(effects, k, v);
  }
  return { source: 'equipment', id: `item:${item.instanceId}`, primary, flat, percent, effects };
}

export type EquipError =
  | 'unknown_item'
  | 'wrong_slot'
  | 'class_restricted'
  | 'weapon_not_allowed'
  | 'off_hand_blocked_by_two_handed'
  | 'already_equipped';

export type EquipResult = { ok: true; unequipped: string[] } | { ok: false; reason: EquipError };

/**
 * The player's equipment bag and equipped slots. Every change calls
 * onChange with the full equipment modifier list (items + active sets), so
 * the owner can replace its 'equipment' modifier source in one step.
 */
export class EquipmentManager {
  readonly items = new Map<string, EquipmentInstance>();
  readonly equipped: Record<EquipmentSlot, string | null> = Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, null])) as Record<EquipmentSlot, string | null>;

  constructor(
    private readonly classId: () => JobId,
    private readonly onChange: (modifiers: StatModifier[]) => void = () => {},
  ) {}

  add(item: EquipmentInstance): void {
    if (this.items.has(item.instanceId)) throw new Error(`duplicate instance ${item.instanceId}`);
    if (!Number.isInteger(item.enhancement) || item.enhancement < 0 || item.enhancement > MAX_ENHANCEMENT) throw new Error('enhancement out of range');
    defOf(item);
    this.items.set(item.instanceId, item);
  }

  slotOf(instanceId: string): EquipmentSlot | null {
    return EQUIPMENT_SLOTS.find((s) => this.equipped[s] === instanceId) ?? null;
  }

  /** Item in a slot (a two-handed weapon also blocks off_hand but is listed only under weapon). */
  inSlot(slot: EquipmentSlot): EquipmentInstance | null {
    const id = this.equipped[slot];
    return id ? (this.items.get(id) ?? null) : null;
  }

  twoHanded(): boolean {
    const weapon = this.inSlot('weapon');
    const type = weapon ? defOf(weapon).weaponType : undefined;
    return !!type && type !== 'shield' && WEAPON_HANDS[type] === 2;
  }

  /** Check whether an item can go into a slot (no change). */
  canEquip(instanceId: string, slot?: EquipmentSlot): { ok: true; slot: EquipmentSlot } | { ok: false; reason: EquipError } {
    const item = this.items.get(instanceId);
    if (!item) return { ok: false, reason: 'unknown_item' };
    const def = defOf(item);
    const allowed = SLOTS_FOR_TYPE[def.slotType];
    const target = slot ?? allowed.find((s) => this.equipped[s] === null) ?? allowed[0];
    if (!allowed.includes(target)) return { ok: false, reason: 'wrong_slot' };
    const current = this.slotOf(instanceId);
    if (current && current !== target) return { ok: false, reason: 'already_equipped' };

    const job = this.classId();
    if (def.classes.length && !def.classes.includes(job)) return { ok: false, reason: 'class_restricted' };
    if (def.slotType === 'weapon' && def.weaponType && !CLASS_WEAPONS[job].weapons.includes(def.weaponType)) {
      return { ok: false, reason: 'weapon_not_allowed' };
    }
    if (def.slotType === 'off_hand') {
      if (def.weaponType && !CLASS_WEAPONS[job].offHands.includes(def.weaponType)) return { ok: false, reason: 'weapon_not_allowed' };
      if (this.twoHanded()) return { ok: false, reason: 'off_hand_blocked_by_two_handed' };
    }
    return { ok: true, slot: target };
  }

  /**
   * Equip into a slot (rings pick a free ring slot if none given). Replaces
   * the slot's item; a two-handed weapon also takes off the off-hand item.
   * Returns the instance ids that were unequipped (they stay in the bag).
   */
  equip(instanceId: string, slot?: EquipmentSlot): EquipResult {
    const check = this.canEquip(instanceId, slot);
    if (!check.ok) return check;
    const unequipped: string[] = [];
    const previous = this.equipped[check.slot];
    if (previous && previous !== instanceId) unequipped.push(previous);
    this.equipped[check.slot] = instanceId;
    if (check.slot === 'weapon' && this.twoHanded() && this.equipped.off_hand) {
      unequipped.push(this.equipped.off_hand);
      this.equipped.off_hand = null;
    }
    this.changed();
    return { ok: true, unequipped };
  }

  unequip(slot: EquipmentSlot): string | null {
    const id = this.equipped[slot];
    if (!id) return null;
    this.equipped[slot] = null;
    this.changed();
    return id;
  }

  /** Empty the bag and every slot (world reset / loading a save). */
  clear(): void {
    for (const slot of EQUIPMENT_SLOTS) this.equipped[slot] = null;
    this.items.clear();
    this.changed();
  }

  /** Remove an unequipped item from the bag (e.g. sold or consumed). */
  remove(instanceId: string): boolean {
    if (this.slotOf(instanceId)) return false;
    return this.items.delete(instanceId);
  }

  equippedItems(): EquipmentInstance[] {
    return EQUIPMENT_SLOTS.map((s) => this.inSlot(s)).filter((i): i is EquipmentInstance => !!i);
  }

  /** Item modifiers + active set bonuses. */
  modifiers(): StatModifier[] {
    const equipped = this.equippedItems();
    return [...equipped.map(itemModifier), ...evaluateSets(this.equipped, this.items).modifiers];
  }

  /** Re-send modifiers after an in-place change (enhancement, enchant reroll). */
  changed(): void {
    this.onChange(this.modifiers());
  }

  /** Re-check equipped items after a job change: drop what the new job can't use. Returns removed ids. */
  revalidate(): string[] {
    const removed: string[] = [];
    for (const slot of EQUIPMENT_SLOTS) {
      const id = this.equipped[slot];
      if (!id) continue;
      this.equipped[slot] = null;
      if (this.canEquip(id, slot).ok) this.equipped[slot] = id;
      else removed.push(id);
    }
    if (removed.length) this.changed();
    return removed;
  }
}

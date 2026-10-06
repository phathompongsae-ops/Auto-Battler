import type { ActiveStatus } from '../combat/CombatantState';
import type { CombatStats } from '../combat/types';
import { RARITY_INFO, type EquipmentSlotType } from '../data/equipmentData';
import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import { JOBS } from '../data/jobData';
import { EquipmentManager, ITEM_STAT_LAYERS, type EquipmentInstance } from '../equipment/equipment';
import type { CharacterProgress } from '../progression/CharacterProgress';
import type { DerivedStatKey, StatModifier } from '../stats/modifiers';
import { playerCombatStats } from '../stats/playerCombatStats';
import { PRIMARY_STATS, type PrimaryStats } from '../stats/primaryStats';

/*
 * Readable equipment information and equip previews for the UI. Engine-free:
 * everything is computed with the real stat pipeline, so what the UI shows
 * is what equipping actually does.
 */

export const SLOT_TYPE_LABEL: Record<EquipmentSlotType, string> = {
  weapon: 'Weapon',
  off_hand: 'Off-hand',
  head: 'Head',
  armor: 'Armor',
  gloves: 'Gloves',
  boots: 'Boots',
  necklace: 'Necklace',
  ring: 'Ring',
};

const DERIVED_LABEL: Record<DerivedStatKey, string> = {
  maxHp: 'Max HP',
  maxMp: 'Max MP',
  physicalAtk: 'ATK',
  magicAtk: 'MATK',
  def: 'DEF',
  mdef: 'MDEF',
  accuracy: 'Accuracy',
  evasion: 'Evasion',
  aspd: 'ASPD',
  critRate: 'Crit Rate',
  critDamage: 'Crit Damage',
  castTime: 'Cast Time',
  healPower: 'Heal Power',
};

/** Derived stats shown as percentages. */
const PERCENT_STATS = new Set<DerivedStatKey>(['accuracy', 'evasion', 'aspd', 'critRate', 'critDamage', 'castTime', 'healPower']);

const signed = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10}%`;

/** One stat line, e.g. "ATK +20" or "Crit Rate +1.5%". */
export function statLine(key: DerivedStatKey | keyof PrimaryStats | string, value: number, kind: 'primary' | 'flat' | 'percent' | 'effect'): string {
  if (kind === 'primary') return `${String(key).toUpperCase()} ${signed(value)}`;
  if (kind === 'effect') return `${key === 'damageReduction' ? 'Damage Reduction' : key} ${pct(value)}`;
  const label = DERIVED_LABEL[key as DerivedStatKey] ?? String(key);
  if (kind === 'percent') return `${label} ${pct(value)}`;
  return `${label} ${PERCENT_STATS.has(key as DerivedStatKey) ? pct(value) : signed(Math.round(value))}`;
}

function modifierLines(m: Pick<StatModifier, 'primary' | 'flat' | 'percent' | 'effects'>): string[] {
  const out: string[] = [];
  for (const k of PRIMARY_STATS) if (m.primary?.[k]) out.push(statLine(k, m.primary[k]!, 'primary'));
  for (const [k, v] of Object.entries(m.flat ?? {})) if (v) out.push(statLine(k, v, 'flat'));
  for (const [k, v] of Object.entries(m.percent ?? {})) if (v) out.push(statLine(k, v, 'percent'));
  for (const [k, v] of Object.entries(m.effects ?? {})) if (v) out.push(statLine(k, v, 'effect'));
  return out;
}

/** Section titles per stat layer. The enhancement layer carries the (enhanced) base stats. */
const layerTitle = (layer: string, item: EquipmentInstance) =>
  layer === 'enhancement' ? (item.enhancement > 0 ? `Base (+${item.enhancement})` : 'Base') : layer === 'definition' ? 'Bonus' : layer === 'enchant' ? 'Enchant' : layer;

/** An equipment piece's stat lines per stat layer (definition, enhancement, enchant, future socket/card...). */
export function itemStatSections(item: EquipmentInstance): { layer: string; title: string; lines: string[] }[] {
  const def = EQUIPMENT_DEFS[item.defId];
  return ITEM_STAT_LAYERS.map((layer) => ({ layer: layer.id, title: layerTitle(layer.id, item), lines: modifierLines(layer.contribute(item, def)) })).filter(
    (s) => s.lines.length > 0,
  );
}

/** "Head · Lv10 · Common · Any class". */
export function itemSummary(item: EquipmentInstance): string {
  const def = EQUIPMENT_DEFS[item.defId];
  const classes = def.classes.length ? def.classes.map((c) => JOBS[c].name).join(' / ') : 'Any class';
  return [SLOT_TYPE_LABEL[def.slotType], `Lv${def.equipmentLevel}`, RARITY_INFO[def.rarity].name, classes].join(' · ');
}

/** Display name with enhancement, e.g. "+3 Iron Sword". */
export function itemName(item: EquipmentInstance): string {
  const name = EQUIPMENT_DEFS[item.defId].name;
  return item.enhancement > 0 ? `+${item.enhancement} ${name}` : name;
}

/** Combat stats compared in the equip preview, with labels. */
export const COMPARED_STATS: readonly { key: keyof CombatStats; label: string; percent?: boolean }[] = [
  { key: 'maxHp', label: 'Max HP' },
  { key: 'maxMp', label: 'Max MP' },
  { key: 'attack', label: 'ATK' },
  { key: 'magicAttack', label: 'MATK' },
  { key: 'defense', label: 'DEF' },
  { key: 'magicDefense', label: 'MDEF' },
  { key: 'critChance', label: 'Crit Rate', percent: true },
  { key: 'attackSpeed', label: 'ASPD', percent: true },
  { key: 'accuracy', label: 'Accuracy', percent: true },
  { key: 'evasion', label: 'Evasion', percent: true },
];

export interface StatComparison {
  key: keyof CombatStats;
  label: string;
  before: number;
  after: number;
  delta: number;
  percent: boolean;
}

/** What the character's stats come from, minus equipment (equipment is re-simulated). */
export interface PreviewSubject {
  progress: CharacterProgress;
  level: number;
  /** Every live modifier (equipment ones are replaced by the simulation). */
  modifiers: readonly StatModifier[];
  statuses: readonly ActiveStatus[];
  equipment: EquipmentManager;
}

/**
 * Final combat stats now vs. after equipping `instanceId` (sets, two-handed
 * off-hand removal and every stat layer included). Only stats that change
 * are returned; null when the item can't be equipped.
 */
export function previewEquip(subject: PreviewSubject, instanceId: string): { slotItem: EquipmentInstance | null; changes: StatComparison[] } | null {
  const real = subject.equipment;
  const check = real.canEquip(instanceId);
  if (!check.ok) return null;
  const sim = new EquipmentManager(() => subject.progress.classId);
  for (const item of real.items.values()) sim.add(structuredClone(item));
  for (const [slot, id] of Object.entries(real.equipped)) if (id) sim.equipped[slot as keyof typeof sim.equipped] = id;
  const slotItem = real.inSlot(check.slot);
  sim.equip(instanceId, check.slot);

  const others = subject.modifiers.filter((m) => m.source !== 'equipment');
  const before = playerCombatStats(subject.progress, subject.level, [...others, ...real.modifiers()], subject.statuses);
  const after = playerCombatStats(subject.progress, subject.level, [...others, ...sim.modifiers()], subject.statuses);
  const changes: StatComparison[] = [];
  for (const s of COMPARED_STATS) {
    const delta = (after[s.key] as number) - (before[s.key] as number);
    if (Math.abs(delta) > 1e-9) changes.push({ key: s.key, label: s.label, before: before[s.key] as number, after: after[s.key] as number, delta, percent: !!s.percent });
  }
  return { slotItem, changes };
}

/** "425 → 455 (+30)" / "5% → 6.5% (+1.5%)". */
export function formatComparison(c: StatComparison): string {
  const f = (v: number) => (c.percent ? `${Math.round(v * 1000) / 10}%` : `${Math.round(v)}`);
  const d = c.percent ? pct(c.delta) : signed(Math.round(c.delta));
  return `${c.label} ${f(c.before)} → ${f(c.after)} (${d})`;
}

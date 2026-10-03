import { addPrimary, PRIMARY_STATS, zeroPrimary, type PrimaryStats } from './primaryStats';

/*
 * Every stat contribution is a modifier from a named source. Base, allocated
 * and job stats are modifiers just like future equipment, pets and buffs, so
 * new systems add modifiers instead of editing the player.
 */

export const MODIFIER_SOURCES = ['base', 'allocated', 'job', 'equipment', 'pet', 'buff', 'debuff'] as const;

export type ModifierSource = (typeof MODIFIER_SOURCES)[number];

/** Derived stats a modifier may adjust directly (see derivedStats.ts). */
export type DerivedStatKey =
  | 'maxHp'
  | 'maxMp'
  | 'physicalAtk'
  | 'magicAtk'
  | 'def'
  | 'mdef'
  | 'accuracy'
  | 'evasion'
  | 'aspd'
  | 'critRate'
  | 'critDamage'
  | 'castTime'
  | 'healPower';

export interface StatModifier {
  source: ModifierSource;
  /** Stable id of what grants it, e.g. 'job:warrior', 'item:iron_sword'. */
  id: string;
  /** Added to the final primary stats. */
  primary?: Partial<PrimaryStats>;
  /** Added to derived stats after primary contributions. */
  flat?: Partial<Record<DerivedStatKey, number>>;
  /** Multiplies derived stats last: 0.1 = +10%. Summed per stat across modifiers. */
  percent?: Partial<Record<DerivedStatKey, number>>;
  /**
   * Combat effects that aren't stats, summed per key across modifiers:
   * 'damageReduction' (fraction of incoming damage), 'skillDamage:<skillId>'
   * (+fraction damage for one skill), 'skillCooldown:<skillId>' (-fraction
   * cooldown for one skill). See effectKey().
   */
  effects?: Readonly<Record<string, number>>;
}

export const effectKey = {
  damageReduction: 'damageReduction',
  skillDamage: (skillId: string) => `skillDamage:${skillId}`,
  skillCooldown: (skillId: string) => `skillCooldown:${skillId}`,
} as const;

/** Effect values summed across modifiers. */
export function sumEffects(modifiers: readonly StatModifier[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of modifiers) for (const [k, v] of Object.entries(m.effects ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Final primary stats: the sum of every modifier's primary part. */
export function finalPrimary(modifiers: readonly StatModifier[]): PrimaryStats {
  const total = zeroPrimary();
  for (const m of modifiers) if (m.primary) addPrimary(total, m.primary);
  return total;
}

/** Primary stats per source, for UI breakdowns ("5 + 3 (job) + 2"). */
export function primaryBySource(modifiers: readonly StatModifier[]): Record<ModifierSource, PrimaryStats> {
  const out = Object.fromEntries(MODIFIER_SOURCES.map((s) => [s, zeroPrimary()])) as Record<ModifierSource, PrimaryStats>;
  for (const m of modifiers) if (m.primary) addPrimary(out[m.source], m.primary);
  return out;
}

/** Helper for a primary-only modifier. Zero entries are dropped. */
export function primaryModifier(source: ModifierSource, id: string, stats: Partial<PrimaryStats>): StatModifier {
  const primary: Partial<PrimaryStats> = {};
  for (const stat of PRIMARY_STATS) if (stats[stat]) primary[stat] = stats[stat];
  return { source, id, primary };
}

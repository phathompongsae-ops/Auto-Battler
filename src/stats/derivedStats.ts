import { PRIMARY_STAT_RULES } from '../data/statData';
import { finalPrimary, type DerivedStatKey, type StatModifier } from './modifiers';
import type { PrimaryStats } from './primaryStats';

/*
 * Derived stats are always calculated, never stored: persist the inputs
 * (base, allocated, job, gear...) and call deriveStats().
 *
 * Percent-type values are fractions: critRate 0.1 = 10%, aspd 0.02 = +2%
 * attack speed, castTime -0.01 = 1% faster casts.
 */
export interface DerivedStats {
  maxHp: number;
  maxMp: number;
  physicalAtk: number;
  magicAtk: number;
  /** Physical defense. */
  def: number;
  /** Magic defense. Separate from DEF; there is no elemental resistance. */
  mdef: number;
  accuracy: number;
  evasion: number;
  /** Attack-speed modifier. */
  aspd: number;
  critRate: number;
  /** Crit damage bonus over a normal hit: 0.5 = crits deal 150%. */
  critDamage: number;
  /** Cast-time modifier; negative is faster. */
  castTime: number;
  healPower: number;
}

export const DERIVED_STAT_KEYS: readonly DerivedStatKey[] = [
  'maxHp',
  'maxMp',
  'physicalAtk',
  'magicAtk',
  'def',
  'mdef',
  'accuracy',
  'evasion',
  'aspd',
  'critRate',
  'critDamage',
  'castTime',
  'healPower',
];

/** Which primary stat drives physical ATK: STR for melee, DEX for archers. */
export type AttackStyle = 'melee' | 'ranged';

export interface DeriveInput {
  /** Every modifier (base, allocated, job, equipment, pet, buff, debuff). */
  modifiers: readonly StatModifier[];
  /** Values before primary stats: class/level base numbers. Missing keys are 0. */
  base?: Partial<DerivedStats>;
  attackStyle: AttackStyle;
}

export function emptyDerived(): DerivedStats {
  return Object.fromEntries(DERIVED_STAT_KEYS.map((k) => [k, 0])) as unknown as DerivedStats;
}

/**
 * base + per-point primary contributions + flat modifiers, then × (1 + Σ percent).
 */
export function deriveStats(input: DeriveInput): DerivedStats {
  const out = emptyDerived();
  Object.assign(out, input.base);

  // Every point of every final primary stat contributes (no free first points).
  const p = finalPrimary(input.modifiers);
  const d = (stat: keyof PrimaryStats) => p[stat];
  const r = PRIMARY_STAT_RULES;

  out.physicalAtk += input.attackStyle === 'ranged' ? d('dex') * r.dex.rangedPhysicalAtk : d('str') * r.str.meleePhysicalAtk;
  out.maxHp += d('vit') * r.vit.maxHp;
  out.def += d('vit') * r.vit.def;
  out.aspd += d('agi') * r.agi.aspd;
  out.evasion += d('agi') * r.agi.evasion;
  out.accuracy += d('dex') * r.dex.accuracy;
  out.castTime += d('dex') * r.dex.castTime;
  out.magicAtk += d('int') * r.int.magicAtk;
  out.maxMp += d('int') * r.int.maxMp;
  out.healPower += d('int') * r.int.healPower;
  out.mdef += d('int') * r.int.mdef;
  out.critRate += d('luk') * r.luk.critRate;
  out.critDamage += d('luk') * r.luk.critDamage;

  const percent: Partial<Record<DerivedStatKey, number>> = {};
  for (const m of input.modifiers) {
    for (const [key, value] of Object.entries(m.flat ?? {}) as [DerivedStatKey, number][]) out[key] += value;
    for (const [key, value] of Object.entries(m.percent ?? {}) as [DerivedStatKey, number][]) percent[key] = (percent[key] ?? 0) + value;
  }
  for (const [key, value] of Object.entries(percent) as [DerivedStatKey, number][]) out[key] *= 1 + value;
  return out;
}

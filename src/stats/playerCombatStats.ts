import type { ActiveStatus } from '../combat/CombatantState';
import { statusModifiers } from '../combat/stats';
import type { CombatStats } from '../combat/types';
import { BASE_CRIT_MULTIPLIER } from '../data/combatRules';
import { JOBS } from '../data/jobData';
import { PLAYER_FIXED_STATS } from '../data/playerData';
import type { CharacterProgress } from '../progression/CharacterProgress';
import { classBaseStats } from './classBaseStats';
import { deriveStats, type DerivedStats } from './derivedStats';
import { effectKey, sumEffects, type StatModifier } from './modifiers';

/** Class Base Growth at `level`, as derived-stat base values (before any primary stat). */
export function playerDerivedBase(progress: CharacterProgress, level: number): Partial<DerivedStats> {
  const b = classBaseStats(progress.classId, level);
  return {
    maxHp: b.hp,
    maxMp: b.mp,
    physicalAtk: b.atk,
    magicAtk: b.matk,
    def: b.def,
    mdef: b.mdef,
    critDamage: BASE_CRIT_MULTIPLIER - 1,
  };
}

/**
 * Full derived stats: class base + every primary-stat point (base, allocated,
 * job, equipment, pet, buff, debuff) + flat / percent modifiers.
 */
export function playerDerivedStats(
  progress: CharacterProgress,
  level: number,
  extra: readonly StatModifier[] = [],
  statuses: readonly ActiveStatus[] = [],
): DerivedStats {
  return deriveStats({
    modifiers: [...progress.modifiers(), ...extra, ...statusModifiers(statuses)],
    base: playerDerivedBase(progress, level),
    attackStyle: JOBS[progress.classId].attackStyle,
  });
}

/** Effect modifiers (sets, enchants...) as combat fields. */
export function combatEffects(modifiers: readonly StatModifier[]): Pick<CombatStats, 'damageReduction' | 'skillDamageBonus' | 'skillCooldownReduction'> {
  const effects = sumEffects(modifiers);
  const skillDamageBonus: Record<string, number> = {};
  const skillCooldownReduction: Record<string, number> = {};
  for (const [key, value] of Object.entries(effects)) {
    const [kind, skillId] = key.split(':');
    if (kind === 'skillDamage' && skillId) skillDamageBonus[skillId] = value;
    if (kind === 'skillCooldown' && skillId) skillCooldownReduction[skillId] = value;
  }
  return { damageReduction: effects[effectKey.damageReduction] ?? 0, skillDamageBonus, skillCooldownReduction };
}

/**
 * Derived stats as combat uses them. Integer stats (HP, MP, ATK, MATK, DEF,
 * MDEF) round to the nearest whole number; percent-type stats stay exact.
 */
export function playerCombatStats(
  progress: CharacterProgress,
  level: number,
  extra: readonly StatModifier[] = [],
  statuses: readonly ActiveStatus[] = [],
): CombatStats {
  const d = playerDerivedStats(progress, level, extra, statuses);
  return {
    maxHp: Math.round(d.maxHp),
    maxMp: Math.round(d.maxMp),
    attack: Math.round(d.physicalAtk),
    magicAttack: Math.round(d.magicAtk),
    defense: Math.round(d.def),
    magicDefense: Math.round(d.mdef),
    accuracy: d.accuracy,
    evasion: d.evasion,
    attackSpeed: d.aspd,
    critChance: d.critRate,
    critMultiplier: 1 + d.critDamage,
    castTime: d.castTime,
    healPower: d.healPower,
    moveSpeed: PLAYER_FIXED_STATS.moveSpeed,
    mpRegen: PLAYER_FIXED_STATS.mpRegen,
    ...combatEffects([...progress.modifiers(), ...extra, ...statusModifiers(statuses)]),
  };
}

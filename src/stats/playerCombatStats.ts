import { statsForLevel } from '../combat/stats';
import type { CombatStats } from '../combat/types';
import { JOBS } from '../data/jobData';
import { PLAYER_BASE_STATS, PLAYER_GROWTH } from '../data/playerData';
import { STAT_CONTRIBUTION_ORIGIN } from '../data/statData';
import type { CharacterProgress } from '../progression/CharacterProgress';
import { deriveStats, type DerivedStats } from './derivedStats';
import type { StatModifier } from './modifiers';

/**
 * The current game's per-level numbers, as the base the stat layer builds
 * on. Unchanged from before the stat system: no rebalance.
 */
export function legacyDerivedBase(level: number): { base: Partial<DerivedStats>; legacy: CombatStats } {
  const legacy = statsForLevel(PLAYER_BASE_STATS, PLAYER_GROWTH, level);
  return {
    legacy,
    base: {
      maxHp: legacy.maxHp,
      maxMp: legacy.maxMp,
      physicalAtk: legacy.attack,
      // Fire Bolt still uses ATK until magic damage is designed; same starting value.
      magicAtk: legacy.attack,
      def: legacy.defense,
      critRate: legacy.critChance,
      critDamage: legacy.critMultiplier - 1,
    },
  };
}

/** Full derived stats for a player at `level`, including future gear/pet/buff modifiers. */
export function playerDerivedStats(
  progress: CharacterProgress,
  level: number,
  extra: readonly StatModifier[] = [],
): DerivedStats {
  return deriveStats({
    modifiers: [...progress.modifiers(), ...extra],
    base: legacyDerivedBase(level).base,
    attackStyle: JOBS[progress.classId].attackStyle,
    origin: STAT_CONTRIBUTION_ORIGIN,
  });
}

/**
 * Derived stats mapped onto the fields combat uses today. Stats combat
 * doesn't read yet (MATK, MDEF, accuracy, evasion, ASPD, cast time, heal
 * power) are calculated by playerDerivedStats() and waiting for their systems.
 */
export function playerCombatStats(
  progress: CharacterProgress,
  level: number,
  extra: readonly StatModifier[] = [],
): CombatStats {
  const { legacy } = legacyDerivedBase(level);
  const d = playerDerivedStats(progress, level, extra);
  return {
    maxHp: Math.round(d.maxHp),
    maxMp: Math.round(d.maxMp),
    attack: Math.round(d.physicalAtk),
    defense: Math.round(d.def),
    moveSpeed: legacy.moveSpeed,
    critChance: d.critRate,
    critMultiplier: 1 + d.critDamage,
    mpRegen: legacy.mpRegen,
  };
}

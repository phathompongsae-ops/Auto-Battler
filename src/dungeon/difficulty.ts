import { DIFFICULTIES, type DifficultyId, type StatMultipliers } from '../data/dungeonDifficulty';

/*
 * Applying a difficulty tier. Inputs are the dungeon's fixed values; the
 * player's level is never an input to scaling, only to the advisory check.
 * No engine code.
 */

export interface DungeonMonsterStats {
  level: number;
  hp: number;
  atk: number;
  def: number;
  mdef: number;
}

export interface DungeonRewards {
  exp: number;
  currency: number;
  material: number;
}

export function recommendedLevel(dungeonBaseLevel: number, difficulty: DifficultyId): number {
  return dungeonBaseLevel + DIFFICULTIES[difficulty].recommendedLevelOffset;
}

/**
 * Entry is always allowed; being under the recommendation is only flagged
 * (for a UI warning).
 */
export function entryCheck(
  playerLevel: number,
  dungeonBaseLevel: number,
  difficulty: DifficultyId,
): { allowed: true; recommendedLevel: number; belowRecommended: boolean } {
  const recommended = recommendedLevel(dungeonBaseLevel, difficulty);
  return { allowed: true, recommendedLevel: recommended, belowRecommended: playerLevel < recommended };
}

/** Scaled monster or boss stats. Level is unchanged: difficulty never alters it. */
export function scaleMonster(stats: DungeonMonsterStats, difficulty: DifficultyId, isBoss = false): DungeonMonsterStats {
  const m: StatMultipliers = isBoss ? DIFFICULTIES[difficulty].boss : DIFFICULTIES[difficulty].monster;
  return {
    level: stats.level,
    hp: Math.round(stats.hp * m.hp),
    atk: Math.round(stats.atk * m.atk),
    def: Math.round(stats.def * m.def),
    mdef: Math.round(stats.mdef * m.mdef),
  };
}

export function scaleRewards(rewards: DungeonRewards, difficulty: DifficultyId): DungeonRewards {
  const r = DIFFICULTIES[difficulty].rewards;
  return {
    exp: Math.round(rewards.exp * r.exp),
    currency: Math.round(rewards.currency * r.currency),
    material: Math.round(rewards.material * r.material),
  };
}

/** Rare-drop chance after the (not yet designed) difficulty hook; unchanged while the hook is unset. */
export function scaleRareDropChance(chance: number, difficulty: DifficultyId): number {
  const mul = DIFFICULTIES[difficulty].rareDropMultiplier;
  return mul === null ? chance : Math.min(1, chance * mul);
}

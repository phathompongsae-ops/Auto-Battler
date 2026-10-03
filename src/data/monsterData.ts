import type { CombatStats } from '../combat/types';
import type { LootTableId } from './itemData';
import type { SkillId } from './skillData';

/**
 * Monster stats in data. Newer combat fields are optional and default to 0
 * (no magic attack, accuracy, evasion, attack speed...) until monsters are
 * redesigned; see monsterCombatStats().
 */
export type MonsterStats = Pick<
  CombatStats,
  'maxHp' | 'maxMp' | 'attack' | 'defense' | 'magicDefense' | 'moveSpeed' | 'critChance' | 'critMultiplier' | 'mpRegen'
> &
  Partial<CombatStats>;

export interface MonsterDef {
  id: string;
  name: string;
  texture: string;
  level: number;
  stats: MonsterStats;
  hitRadius: number;
  aggroRange: number; // px: notices the player inside this
  leashRange: number; // px from spawn: gives up beyond this
  attackSkill: SkillId;
  expReward: number;
  lootTable: LootTableId;
  respawnDelay: number; // ms
}

const MONSTER_DEFS = {
  slime: {
    id: 'slime',
    name: 'Slime',
    texture: 'slime',
    level: 1,
    stats: {
      maxHp: 60,
      maxMp: 0,
      attack: 8,
      defense: 2,
      // Placeholder equal to DEF until the monster redesign sets real MDEF.
      magicDefense: 2,
      moveSpeed: 90,
      critChance: 0.05,
      critMultiplier: 1.5,
      mpRegen: 0,
    },
    hitRadius: 12,
    aggroRange: 150,
    leashRange: 320,
    attackSkill: 'slime_bump',
    expReward: 30,
    lootTable: 'slime',
    respawnDelay: 5000,
  },
} satisfies Record<string, MonsterDef>;

/** Full combat stats from monster data: missing newer fields are 0. */
export function monsterCombatStats(stats: MonsterStats): CombatStats {
  return {
    magicAttack: 0,
    accuracy: 0,
    evasion: 0,
    attackSpeed: 0,
    castTime: 0,
    healPower: 0,
    ...stats,
  };
}

/** Push (px/s) between fully overlapping monsters; fades to 0 at touching distance. */
export const MONSTER_SEPARATION_STRENGTH = 120;

export type MonsterId = keyof typeof MONSTER_DEFS;
export const MONSTERS: Record<MonsterId, MonsterDef> = MONSTER_DEFS;

import type { CombatStats } from '../combat/types';
import type { LootTableId } from './itemData';
import type { SkillId } from './skillData';

export interface MonsterDef {
  id: string;
  name: string;
  texture: string;
  level: number;
  stats: CombatStats;
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

/** Push (px/s) between fully overlapping monsters; fades to 0 at touching distance. */
export const MONSTER_SEPARATION_STRENGTH = 120;

export type MonsterId = keyof typeof MONSTER_DEFS;
export const MONSTERS: Record<MonsterId, MonsterDef> = MONSTER_DEFS;

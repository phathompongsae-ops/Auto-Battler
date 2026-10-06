import type { CombatStats } from '../combat/types';
import type { LootTableId } from './itemData';
import type { MonsterTier } from './monsterBalance';
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
  /** Balance tier; also sets the Field Energy cost of its rewards. */
  tier: MonsterTier;
  stats: MonsterStats;
  hitRadius: number;
  aggroRange: number; // px: notices the player inside this
  leashRange: number; // px from spawn: gives up beyond this
  attackSkill: SkillId;
  expReward: number;
  lootTable: LootTableId;
  respawnDelay: number; // ms
  /** Display scale of the art (presentation only; default 1). Bigger tiers read bigger. */
  scale?: number;
}

const MONSTER_DEFS = {
  slime: {
    id: 'slime',
    name: 'Slime',
    texture: 'slime',
    level: 1,
    tier: 'normal',
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
  // PLACEHOLDER roster for the Town / Field / Dungeon map foundation: simple
  // stand-in stats and tinted blob art so spawn zones, transitions and reward
  // rules can be exercised. Not balanced; the monster content pass replaces them.
  wolf: placeholder('wolf', 'Wolf', 'normal', 2, { maxHp: 90, attack: 10, defense: 3, moveSpeed: 105 }, 40),
  mushroom: placeholder('mushroom', 'Mushroom', 'normal', 3, { maxHp: 80, attack: 9, defense: 4, moveSpeed: 70 }, 35),
  elite_boar: placeholder('elite_boar', 'Elite Boar', 'elite', 8, { maxHp: 450, attack: 16, defense: 8, moveSpeed: 95 }, 160, 18, 1.6),
  grove_guardian: placeholder('grove_guardian', 'Grove Guardian', 'mini_boss', 12, { maxHp: 1600, attack: 22, defense: 12, moveSpeed: 80 }, 550, 22, 2.1),
  crypt_skeleton: placeholder('crypt_skeleton', 'Crypt Skeleton', 'normal', 20, { maxHp: 140, attack: 14, defense: 6, moveSpeed: 90 }, 0),
  crypt_knight: placeholder('crypt_knight', 'Crypt Knight', 'elite', 20, { maxHp: 700, attack: 20, defense: 12, moveSpeed: 85 }, 0, 18, 1.6),
  crypt_lord: placeholder('crypt_lord', 'Crypt Lord', 'dungeon_boss', 20, { maxHp: 3000, attack: 26, defense: 16, moveSpeed: 75 }, 0, 24, 2.5),
} satisfies Record<string, MonsterDef>;

/** A PLACEHOLDER monster: slime-like defaults with a few overrides. Dungeon monsters' expReward is unused (dungeon kills grant nothing). */
function placeholder(
  id: string,
  name: string,
  tier: MonsterTier,
  level: number,
  stats: Pick<MonsterStats, 'maxHp' | 'attack' | 'defense' | 'moveSpeed'>,
  expReward: number,
  hitRadius = 12,
  scale = 1.15,
): MonsterDef {
  return {
    id,
    name,
    texture: id,
    level,
    tier,
    stats: { maxMp: 0, magicDefense: stats.defense, critChance: 0.05, critMultiplier: 1.5, mpRegen: 0, ...stats },
    hitRadius,
    aggroRange: 150,
    leashRange: 320,
    attackSkill: 'slime_bump',
    expReward,
    lootTable: 'placeholder',
    respawnDelay: tier === 'normal' ? 5000 : 15000,
    scale,
  };
}

/** Full combat stats from monster data: missing newer fields are 0. */
export function monsterCombatStats(stats: MonsterStats): CombatStats {
  return {
    magicAttack: 0,
    accuracy: 0,
    evasion: 0,
    attackSpeed: 0,
    castTime: 0,
    healPower: 0,
    damageReduction: 0,
    skillDamageBonus: {},
    skillCooldownReduction: {},
    ...stats,
  };
}

/** Push (px/s) between fully overlapping monsters; fades to 0 at touching distance. */
export const MONSTER_SEPARATION_STRENGTH = 120;

export type MonsterId = keyof typeof MONSTER_DEFS;
export const MONSTERS: Record<MonsterId, MonsterDef> = MONSTER_DEFS;

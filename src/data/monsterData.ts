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
  /**
   * Dedicated production art slot (data/monsterArt.ts, data/monsterAnimArt.ts), used when loaded; until then
   * `texture` supplies the art (with its MONSTER_ART_TINT) and the placeholder. Default: `texture`.
   */
  artId?: string;
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
  /** Gold credited with a rewarded Field kill (same Field Energy rule as EXP). Default 0. */
  goldReward?: number;
  /**
   * Signature attack used whenever it is off cooldown, instead of attackSkill.
   * Elites / bosses use telegraphed ones (a wind-up the player can step out of).
   */
  specialSkill?: SkillId;
  /** Enrage once when HP drops below this fraction (0..1): an attack buff until it dies or resets. */
  enrageBelow?: number;
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
    goldReward: 4,
    lootTable: 'slime',
    respawnDelay: 5000,
  },
  // Combat vertical slice roster: PLACEHOLDER stats and tinted blob art (not
  // the locked Balance v1 numbers). Field: three normal kinds, one Elite
  // encounter (telegraphed Gore), one Mini Boss (telegraphed Stomp, enrages).
  // Dungeon: mobs, an Elite and the Crypt Lord boss encounter (telegraphed
  // Slam, enrages; its defeat resolves the dungeon claim).
  wolf: placeholder({ id: 'wolf', name: 'Wolf', tier: 'normal', level: 2, stats: { maxHp: 90, attack: 10, defense: 3, moveSpeed: 105 }, expReward: 40, goldReward: 6, lootTable: 'wolf' }),
  mushroom: placeholder({ id: 'mushroom', name: 'Mushroom', tier: 'normal', level: 3, stats: { maxHp: 80, attack: 9, defense: 4, moveSpeed: 70 }, expReward: 35, goldReward: 5, lootTable: 'mushroom' }),
  elite_boar: placeholder({
    id: 'elite_boar',
    name: 'Elite Boar',
    tier: 'elite',
    level: 8,
    stats: { maxHp: 450, attack: 16, defense: 8, moveSpeed: 95 },
    expReward: 160,
    goldReward: 40,
    lootTable: 'elite_boar',
    hitRadius: 18,
    scale: 1.6,
    special: 'boar_gore',
  }),
  grove_guardian: placeholder({
    id: 'grove_guardian',
    name: 'Grove Guardian',
    tier: 'mini_boss',
    level: 12,
    stats: { maxHp: 1600, attack: 22, defense: 12, moveSpeed: 80 },
    expReward: 550,
    goldReward: 150,
    lootTable: 'grove_guardian',
    hitRadius: 22,
    scale: 2.1,
    special: 'guardian_stomp',
    enrageBelow: 0.4,
  }),
  crypt_skeleton: placeholder({ id: 'crypt_skeleton', name: 'Crypt Skeleton', tier: 'normal', level: 20, stats: { maxHp: 140, attack: 14, defense: 6, moveSpeed: 90 } }),
  crypt_knight: placeholder({
    id: 'crypt_knight',
    name: 'Crypt Knight',
    tier: 'elite',
    level: 20,
    stats: { maxHp: 700, attack: 20, defense: 12, moveSpeed: 85 },
    hitRadius: 18,
    scale: 1.6,
    special: 'boar_gore',
  }),
  crypt_lord: placeholder({
    id: 'crypt_lord',
    name: 'Crypt Lord',
    tier: 'dungeon_boss',
    level: 20,
    stats: { maxHp: 3000, attack: 26, defense: 16, moveSpeed: 75 },
    hitRadius: 24,
    scale: 2.5,
    special: 'crypt_slam',
    enrageBelow: 0.35,
    // One boss per run: it stays down long enough to claim and leave.
    respawnDelay: 120000,
  }),
  // Story Crypt only (spawns only in Story zones, data/maps/cryptMap.ts): the telegraph
  // lesson before the Elite. A slow, wide, clearly announced Smash that is worth stepping
  // out of; its numbers ARE its Story numbers (no Lv20 version exists). Skeleton art, bigger.
  crypt_brute: placeholder({
    id: 'crypt_brute',
    name: 'Skeleton Brute',
    texture: 'crypt_skeleton',
    // Dedicated Brute art (Visual Pass 4 contract); the tinted Skeleton sheet until it is integrated.
    artId: 'crypt_brute',
    tier: 'normal',
    level: 4,
    stats: { maxHp: 380, attack: 9, defense: 4, moveSpeed: 70 },
    hitRadius: 16,
    scale: 1.45,
    special: 'brute_smash_story',
    // Stays down for the Story visit, like the rest of the Story Crypt (data/storyEncounters.ts).
    respawnDelay: 30 * 60_000,
  }),
} satisfies Record<string, MonsterDef>;

interface PlaceholderSpec {
  id: string;
  name: string;
  /** Art to reuse (default: the id). */
  texture?: string;
  /** Dedicated art slot preferred over `texture` once loaded. */
  artId?: string;
  tier: MonsterTier;
  level: number;
  stats: Pick<MonsterStats, 'maxHp' | 'attack' | 'defense' | 'moveSpeed'>;
  /** Field EXP (dungeon monsters never grant it). */
  expReward?: number;
  goldReward?: number;
  /** Dungeon monsters: 'placeholder' (never rolled; dungeon kills grant nothing). */
  lootTable?: LootTableId;
  hitRadius?: number;
  scale?: number;
  special?: SkillId;
  enrageBelow?: number;
  respawnDelay?: number;
}

/** A PLACEHOLDER monster: slime-like defaults with a few overrides. */
function placeholder(spec: PlaceholderSpec): MonsterDef {
  const { stats, tier } = spec;
  return {
    id: spec.id,
    name: spec.name,
    texture: spec.texture ?? spec.id,
    ...(spec.artId ? { artId: spec.artId } : {}),
    level: spec.level,
    tier,
    stats: { maxMp: 0, magicDefense: stats.defense, critChance: 0.05, critMultiplier: 1.5, mpRegen: 0, ...stats },
    hitRadius: spec.hitRadius ?? 12,
    aggroRange: tier === 'normal' ? 150 : 170,
    leashRange: tier === 'normal' ? 320 : 380,
    attackSkill: 'slime_bump',
    expReward: spec.expReward ?? 0,
    goldReward: spec.goldReward ?? 0,
    lootTable: spec.lootTable ?? 'placeholder',
    respawnDelay: spec.respawnDelay ?? (tier === 'normal' ? 5000 : 15000),
    scale: spec.scale ?? 1.15,
    ...(spec.special ? { specialSkill: spec.special } : {}),
    ...(spec.enrageBelow ? { enrageBelow: spec.enrageBelow } : {}),
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

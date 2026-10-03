import type { SkillId } from './skillData';

/**
 * Player combat values that don't come from stats or class growth. Every
 * other number (HP, MP, ATK, MATK, DEF, MDEF, hit, crit, speed) is derived:
 * see src/stats/playerCombatStats.ts.
 */
export const PLAYER_FIXED_STATS = {
  moveSpeed: 160,
  mpRegen: 1.5,
};

export const PLAYER_RESPAWN_DELAY = 3000; // ms
export const PLAYER_HIT_RADIUS = 10;

export const PLAYER_BASIC_ATTACK: SkillId = 'basic_attack';

export type SkillSlot = 'skill1' | 'skill2' | 'skill3';

/**
 * Which skill each skill action triggers. DEMO: this is the current Warrior
 * demo kit, used by the Lv1 Novice until real job change and skill trees
 * exist. It is presentation/combat behaviour only and never saved as the
 * character's class (see src/data/demoConfig.ts).
 */
export const PLAYER_LOADOUT: Record<SkillSlot, SkillId> = {
  skill1: 'power_strike',
  skill2: 'fire_bolt',
  skill3: 'guard',
};

export const TARGETING = {
  acquireRange: 260, // auto-select / Tab cycling radius
  loseRange: 420, // target is dropped beyond this
};

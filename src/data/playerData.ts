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

export type SkillSlot = 'skill1' | 'skill2' | 'skill3' | 'skill4' | 'skill5';

export const SKILL_SLOTS: readonly SkillSlot[] = ['skill1', 'skill2', 'skill3', 'skill4', 'skill5'];

/**
 * TEMPORARY DEMO KIT for classes without a skill tree yet (the Novice before
 * the Lv11 Job Change, and Archer / Mage / Cleric / Ninja): fixed skills at
 * fixed demo values, presentation/combat behaviour only, never saved. A
 * Warrior's skills come from its skill tree instead (see src/skills/SkillTree.ts).
 */
export const DEMO_KIT_LOADOUT: Record<SkillSlot, SkillId | null> = {
  skill1: 'power_strike',
  skill2: 'fire_bolt',
  skill3: 'guard',
  skill4: null,
  skill5: null,
};

export const TARGETING = {
  acquireRange: 260, // auto-select / Tab cycling radius
  loseRange: 420, // target is dropped beyond this
};

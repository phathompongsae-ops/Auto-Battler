import type { CombatStats } from '../combat/types';
import type { SkillId } from './skillData';

export const PLAYER_BASE_STATS: CombatStats = {
  maxHp: 120,
  maxMp: 50,
  attack: 12,
  defense: 4,
  moveSpeed: 160,
  critChance: 0.1,
  critMultiplier: 1.5,
  mpRegen: 1.5,
};

/** Added to the base stats for every level above 1. */
export const PLAYER_GROWTH: Partial<CombatStats> = {
  maxHp: 12,
  maxMp: 5,
  attack: 2,
  defense: 1,
};

export const PLAYER_RESPAWN_DELAY = 3000; // ms
export const PLAYER_HIT_RADIUS = 10;

export const PLAYER_BASIC_ATTACK: SkillId = 'basic_attack';

export type SkillSlot = 'skill1' | 'skill2' | 'skill3';

/** Which skill each skill action triggers. */
export const PLAYER_LOADOUT: Record<SkillSlot, SkillId> = {
  skill1: 'power_strike',
  skill2: 'fire_bolt',
  skill3: 'guard',
};

export const TARGETING = {
  acquireRange: 260, // auto-select / Tab cycling radius
  loseRange: 420, // target is dropped beyond this
};

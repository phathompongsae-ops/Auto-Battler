import type { StatusId } from './statusData';

export type SkillTargetType =
  | 'enemy' // needs a living enemy target within range
  | 'enemy_or_direction' // aims at the target if any, otherwise the facing direction
  | 'self';

export type SkillEffect =
  | { kind: 'damage'; power: number }
  | { kind: 'projectile'; power: number; speed: number; radius: number; color: number }
  | { kind: 'status'; statusId: StatusId; duration: number }
  | { kind: 'heal'; amount: number };

/**
 * Damage lands `ms` after the cast instead of instantly, so it meets the
 * swing's hit frame in the character art. Cost, cooldown and targeting still
 * happen at cast time and are never refunded.
 */
export interface SkillWindup {
  ms: number;
  /** Any movement by the caster before the hit lands cancels it. */
  cancelOnMove?: boolean;
  /** The target must still be within the skill's range when the hit lands, or it misses. */
  recheckRange?: boolean;
}

export interface SkillDef {
  id: string;
  name: string;
  mpCost: number;
  cooldown: number; // ms
  range: number; // px from caster centre to target edge (projectiles: max travel)
  target: SkillTargetType;
  effect: SkillEffect;
  /** Strong hits get screen shake and a brief hit stop. */
  heavy?: boolean;
  /** Melee only: delayed hit that lands on the swing's hit frame. */
  windup?: SkillWindup;
  /** Colour for the swing / cast effect. */
  color?: number;
}

const SKILL_DEFS = {
  basic_attack: {
    id: 'basic_attack',
    name: 'Attack',
    mpCost: 0,
    cooldown: 500,
    range: 40,
    target: 'enemy',
    effect: { kind: 'damage', power: 1 },
    color: 0xffffff,
  },
  power_strike: {
    id: 'power_strike',
    name: 'Power Strike',
    mpCost: 10,
    cooldown: 4000,
    range: 44,
    target: 'enemy',
    effect: { kind: 'damage', power: 2.2 },
    heavy: true,
    // Lands on the Warrior's Power Slash hit frame (frame 5 at 16 fps).
    // Stepping away before the blade lands, or the target leaving reach, wastes the swing.
    windup: { ms: 312, cancelOnMove: true, recheckRange: true },
    color: 0xffd166,
  },
  fire_bolt: {
    id: 'fire_bolt',
    name: 'Fire Bolt',
    mpCost: 12,
    cooldown: 2500,
    range: 320,
    target: 'enemy_or_direction',
    effect: { kind: 'projectile', power: 1.6, speed: 380, radius: 6, color: 0xff7b2e },
    color: 0xff7b2e,
  },
  guard: {
    id: 'guard',
    name: 'Guard',
    mpCost: 8,
    cooldown: 12000,
    range: 0,
    target: 'self',
    effect: { kind: 'status', statusId: 'guard', duration: 5000 },
    color: 0x7fd4ff,
  },
  slime_bump: {
    id: 'slime_bump',
    name: 'Bump',
    mpCost: 0,
    cooldown: 1200,
    range: 26,
    target: 'enemy',
    effect: { kind: 'damage', power: 1 },
    color: 0x9be36b,
  },
} satisfies Record<string, SkillDef>;

export type SkillId = keyof typeof SKILL_DEFS;
export const SKILLS: Record<SkillId, SkillDef> = SKILL_DEFS;

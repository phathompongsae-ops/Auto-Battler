import type { StatusId } from './statusData';

export type SkillTargetType =
  | 'enemy' // needs a living enemy target within range
  | 'enemy_or_direction' // aims at the target if any, otherwise the facing direction
  | 'self';

/** Physical uses ATK vs DEF; magic uses MATK vs MDEF. */
export type DamageType = 'physical' | 'magic';

/** A status put on the target only when the hit lands (a miss applies nothing). */
export interface OnHitStatus {
  statusId: StatusId;
  duration: number;
}

/**
 * power = skill multiplier. Damage effects always declare their type.
 * Ranked (skill-tree) skills get their numbers from the tree at cast time.
 */
export type SkillEffect =
  | { kind: 'damage'; power: number; damageType: DamageType; onHit?: OnHitStatus; critBonus?: number }
  /** One hit on every enemy whose edge is within `radius` px of the caster. */
  | { kind: 'aoe_damage'; power: number; damageType: DamageType; radius: number }
  /** Taunt every enemy within `radius` px: they turn on the caster. */
  | { kind: 'taunt'; statusId: StatusId; duration: number; radius: number }
  /** Dash up to `distance` px toward the target (never through walls), then strike. */
  | { kind: 'dash_strike'; power: number; damageType: DamageType; distance: number; onHit?: OnHitStatus }
  | { kind: 'projectile'; power: number; damageType: DamageType; speed: number; radius: number; color: number }
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
  /**
   * Normal/basic attack: the cooldown is a base attack interval divided by
   * (1 + ASPD). Skills leave this unset and keep their configured cooldown.
   */
  usesAttackSpeed?: boolean;
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
    effect: { kind: 'damage', power: 1, damageType: 'physical' },
    // Normal attack: its cooldown is the base attack interval, shortened by ASPD.
    usesAttackSpeed: true,
    color: 0xffffff,
  },
  power_strike: {
    id: 'power_strike',
    name: 'Power Slash',
    mpCost: 10,
    cooldown: 4000,
    range: 44,
    target: 'enemy',
    effect: { kind: 'damage', power: 2.2, damageType: 'physical' },
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
    effect: { kind: 'projectile', power: 1.6, damageType: 'magic', speed: 380, radius: 6, color: 0xff7b2e },
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
  // --- Warrior Class 1 tree skills. Numbers below are placeholders: every cast uses the
  // learned rank's values from src/data/skillTrees/warriorTree.ts (rank 0 = can't cast).
  charge: {
    id: 'charge',
    name: 'Charge',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'enemy',
    effect: { kind: 'dash_strike', power: 0, damageType: 'physical', distance: 0 },
    color: 0xff9e64,
  },
  shield_bash: {
    id: 'shield_bash',
    name: 'Shield Bash',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'enemy',
    effect: { kind: 'damage', power: 0, damageType: 'physical' },
    color: 0x9fb7d9,
  },
  provoke: {
    id: 'provoke',
    name: 'Provoke',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'self',
    effect: { kind: 'taunt', statusId: 'taunted', duration: 0, radius: 0 },
    color: 0xff6b6b,
  },
  iron_guard: {
    id: 'iron_guard',
    name: 'Iron Guard',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'self',
    effect: { kind: 'status', statusId: 'iron_guard', duration: 0 },
    color: 0x9fb7d9,
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'self',
    effect: { kind: 'aoe_damage', power: 0, damageType: 'physical', radius: 0 },
    heavy: true,
    color: 0xc9d1e3,
  },
  heavy_strike: {
    id: 'heavy_strike',
    name: 'Heavy Strike',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'enemy',
    effect: { kind: 'damage', power: 0, damageType: 'physical' },
    heavy: true,
    // TEMPORARY: reuses the Power Slash animation, so it lands on the same hit frame.
    windup: { ms: 312, cancelOnMove: true, recheckRange: true },
    color: 0xe0524a,
  },
  berserk: {
    id: 'berserk',
    name: 'Berserk',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'self',
    effect: { kind: 'status', statusId: 'berserk', duration: 0 },
    color: 0xe0524a,
  },
  slime_bump: {
    id: 'slime_bump',
    name: 'Bump',
    mpCost: 0,
    cooldown: 1200,
    range: 26,
    target: 'enemy',
    effect: { kind: 'damage', power: 1, damageType: 'physical' },
    usesAttackSpeed: true,
    color: 0x9be36b,
  },
} satisfies Record<string, SkillDef>;

export type SkillId = keyof typeof SKILL_DEFS;
export const SKILLS: Record<SkillId, SkillDef> = SKILL_DEFS;

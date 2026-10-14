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
  /**
   * Strength for statuses that scale per application: a damage-over-time status's damage multiplier per tick
   * (MATK / ATK x magnitude, like a hit's power). Missing = the status's own fixed effect.
   */
  magnitude?: number;
}

/** Element tags (Elemental Mastery and similar bonuses read them). Untagged skills have no element. */
export type Element = 'fire' | 'frost';

/** A projectile's area hit around its impact: every other enemy within `radius` px of it takes `power` x the primary hit's power. */
export interface ProjectileSplash {
  radius: number;
  /** Fraction of the primary power (0.5 = half). */
  power: number;
}

/**
 * power = skill multiplier. Damage effects always declare their type.
 * Ranked (skill-tree) skills get their numbers from the tree at cast time.
 */
export type SkillEffect =
  | { kind: 'damage'; power: number; damageType: DamageType; onHit?: OnHitStatus; critBonus?: number }
  /** One hit on every enemy whose edge is within `radius` px of the caster; `onHit` lands on each enemy hit. */
  | { kind: 'aoe_damage'; power: number; damageType: DamageType; radius: number; onHit?: OnHitStatus }
  /**
   * One hit on every enemy whose edge is within `radius` px of a point: the target's position when the skill is
   * cast (it stays there through a wind-up, so the target can walk out of it).
   */
  | { kind: 'target_area'; power: number; damageType: DamageType; radius: number; onHit?: OnHitStatus }
  /**
   * A lingering area at the target's position when cast: every `tickMs` it hits each enemy whose edge is inside
   * `radius` (`power` per tick) and re-applies `onHit`, floor(durationMs / tickMs) times in all.
   */
  | { kind: 'ground_zone'; power: number; damageType: DamageType; radius: number; durationMs: number; tickMs: number; onHit?: OnHitStatus }
  /** Taunt every enemy within `radius` px: they turn on the caster. */
  | { kind: 'taunt'; statusId: StatusId; duration: number; radius: number }
  /** Dash up to `distance` px toward the target (never through walls), then strike. */
  | { kind: 'dash_strike'; power: number; damageType: DamageType; distance: number; onHit?: OnHitStatus }
  /**
   * Straight-line projectile that stops on the first enemy or a wall. `homing`: it steers toward the target it
   * was cast at while that target lives (walls still stop it). `splash` / `onHit` resolve where it hits.
   */
  | {
      kind: 'projectile';
      power: number;
      damageType: DamageType;
      speed: number;
      radius: number;
      color: number;
      homing?: boolean;
      splash?: ProjectileSplash;
      onHit?: OnHitStatus;
    }
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
  /** Element tag for element damage bonuses (Elemental Mastery). */
  element?: Element;
  /**
   * Player wind-ups normally show no telegraph. A friendly one marks where a delayed area lands (Meteor Burst) in
   * the ally palette, never the monster danger red.
   */
  friendlyTelegraph?: boolean;
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
  // --- Mage Class 1. Magic Bolt is the Mage's basic attack (no rank: these are its real numbers). The tree
  // skills below are placeholders: every cast uses the learned rank's values from
  // src/data/skillTrees/mageTree.ts (rank 0 = can't cast).
  magic_bolt: {
    id: 'magic_bolt',
    name: 'Magic Bolt',
    mpCost: 0,
    // Base attack interval (ASPD-scaled like every basic attack).
    cooldown: 600,
    // 7 tiles. Ranged only: there is no melee fallback.
    range: 224,
    target: 'enemy',
    effect: { kind: 'projectile', power: 1, damageType: 'magic', speed: 420, radius: 5, color: 0x8f7bff, homing: true },
    usesAttackSpeed: true,
    // Leaves the staff on the attack strip's release frame (frame 4 at 16 fps).
    windup: { ms: 250 },
    color: 0x8f7bff,
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'enemy',
    effect: { kind: 'projectile', power: 0, damageType: 'magic', speed: 380, radius: 6, color: 0xff7b2e, homing: true, splash: { radius: 0, power: 0.5 } },
    // Released on the cast strip's frame 5 (16 fps).
    windup: { ms: 312 },
    element: 'fire',
    color: 0xff7b2e,
  },
  flame_burst: {
    id: 'flame_burst',
    name: 'Flame Burst',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'enemy',
    effect: { kind: 'target_area', power: 0, damageType: 'magic', radius: 0, onHit: { statusId: 'burning', duration: 0 } },
    windup: { ms: 312 },
    element: 'fire',
    color: 0xff9e3d,
  },
  frost_nova: {
    id: 'frost_nova',
    name: 'Frost Nova',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'self',
    effect: { kind: 'aoe_damage', power: 0, damageType: 'magic', radius: 0, onHit: { statusId: 'slowed', duration: 0 } },
    windup: { ms: 312 },
    element: 'frost',
    color: 0x7fd4ff,
  },
  frost_storm: {
    id: 'frost_storm',
    name: 'Frost Storm',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'enemy',
    // Slow while inside: each tick re-applies a short Chill that outlasts the next tick, so it ends soon after leaving.
    effect: { kind: 'ground_zone', power: 0, damageType: 'magic', radius: 0, durationMs: 0, tickMs: 500, onHit: { statusId: 'chilled', duration: 700 } },
    windup: { ms: 312 },
    element: 'frost',
    color: 0x9fd4ff,
  },
  meteor_burst: {
    id: 'meteor_burst',
    name: 'Meteor Burst',
    mpCost: 0,
    cooldown: 0,
    range: 0,
    target: 'enemy',
    effect: { kind: 'target_area', power: 0, damageType: 'magic', radius: 0 },
    // Committed: moving during the warning does not cancel it (first implementation).
    windup: { ms: 800 },
    friendlyTelegraph: true,
    heavy: true,
    element: 'fire',
    color: 0xff5a2e,
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
  // Elite / boss signature attacks: telegraphed wind-ups the player can step out of.
  boar_gore: {
    id: 'boar_gore',
    name: 'Gore',
    mpCost: 0,
    cooldown: 6000,
    range: 30,
    target: 'enemy',
    effect: { kind: 'damage', power: 2.4, damageType: 'physical' },
    // Misses if the target walked out of reach during the wind-up.
    windup: { ms: 800, recheckRange: true },
    heavy: true,
    color: 0xe0b07a,
  },
  guardian_stomp: {
    id: 'guardian_stomp',
    name: 'Stomp',
    mpCost: 0,
    cooldown: 7000,
    range: 50,
    target: 'enemy',
    // Hits whoever is still inside the radius when the wind-up ends.
    effect: { kind: 'aoe_damage', power: 2, damageType: 'physical', radius: 70 },
    windup: { ms: 1000 },
    heavy: true,
    color: 0x7cc46a,
  },
  crypt_slam: {
    id: 'crypt_slam',
    name: 'Grave Slam',
    mpCost: 0,
    cooldown: 6500,
    range: 60,
    target: 'enemy',
    effect: { kind: 'aoe_damage', power: 2.2, damageType: 'physical', radius: 84 },
    windup: { ms: 1100 },
    heavy: true,
    color: 0xe08af7,
  },
  // Story Crypt profile (data/storyEncounters.ts): the same telegraphs as the Lv20
  // signatures, with multipliers sized for Story-level ATK so a hit still costs a
  // real share of a Lv3–5 HP bar. The Lv20 versions above are untouched.
  crypt_cleave_story: {
    id: 'crypt_cleave_story',
    name: 'Cleave',
    mpCost: 0,
    cooldown: 6000,
    range: 30,
    target: 'enemy',
    effect: { kind: 'damage', power: 6.5, damageType: 'physical' },
    windup: { ms: 800, recheckRange: true },
    heavy: true,
    color: 0xc9d1e3,
  },
  // The Story Crypt's telegraph lesson (Skeleton Brute): slower and wider than anything
  // before it, so the wind-up is easy to read and stepping out is the obvious answer.
  brute_smash_story: {
    id: 'brute_smash_story',
    name: 'Bone Smash',
    mpCost: 0,
    // Short enough to come round again inside the fight: the lesson is seen at least twice.
    cooldown: 3500,
    range: 40,
    target: 'enemy',
    effect: { kind: 'aoe_damage', power: 6, damageType: 'physical', radius: 70 },
    windup: { ms: 1400 },
    heavy: true,
    color: 0xd8d4c4,
  },
  crypt_slam_story: {
    id: 'crypt_slam_story',
    name: 'Grave Slam',
    mpCost: 0,
    cooldown: 6500,
    range: 60,
    target: 'enemy',
    effect: { kind: 'aoe_damage', power: 8, damageType: 'physical', radius: 84 },
    windup: { ms: 1100 },
    heavy: true,
    color: 0xe08af7,
  },
} satisfies Record<string, SkillDef>;

export type SkillId = keyof typeof SKILL_DEFS;
export const SKILLS: Record<SkillId, SkillDef> = SKILL_DEFS;

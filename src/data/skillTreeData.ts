import type { FeatureId } from './featureData';
import type { JobId } from './jobData';
import type { SkillId } from './skillData';
import type { StatusId } from './statusData';
import type { StatModifier } from '../stats/modifiers';
import { MAGE_C1_TREE } from './skillTrees/mageTree';
import { WARRIOR_C1_TREE } from './skillTrees/warriorTree';

/*
 * Skill trees: data only. One engine (src/skills) reads any tree; Warrior
 * and Mage Class 1 have content so far. Archer / Cleric / Ninja / Class 2
 * trees are added here as data.
 *
 * Distances are in tiles (1 tile = TILE_SIZE px) and times in ms.
 */

export type SkillNodeType = 'active' | 'passive' | 'buff' | 'proc';

/** Numbers for one rank of an active (or buff) skill. */
export interface ActiveRank {
  mpCost: number;
  cooldownMs: number;
  /** Damage multiplier (1.25 = 125%). */
  power?: number;
  /** Stun applied on a successful hit. */
  stunMs?: number;
  /** AoE radius (tiles). */
  radiusTiles?: number;
  /** Status / taunt duration. */
  durationMs?: number;
  /** Extra crit chance for this skill only (0.1 = +10 percentage points). */
  critBonus?: number;
  /** Duration of the skill's on-hit status (Slow, Burn). */
  statusMs?: number;
  /** Strength of the skill's on-hit status (Burn: damage multiplier per tick). */
  statusPower?: number;
  /** Projectile splash radius (tiles) around the impact. */
  splashRadiusTiles?: number;
  /** Projectile splash damage as a fraction of the primary hit's power. */
  splashPower?: number;
}

/** A proc: a passive that applies a status when its trigger fires. */
export type ProcDef =
  /** HP drops below `threshold` (fraction of max) on a hit taken; at most once per `icdMs`. */
  | { kind: 'low_hp'; threshold: number; statusId: StatusId; durationMs: number; icdMs: number }
  /** `hits` successful damaging hits within `windowMs`. */
  | { kind: 'hit_streak'; hits: number; windowMs: number; statusId: StatusId; durationMs: number };

export interface SkillNodeDef {
  id: string;
  displayName: string;
  branch: string;
  maxRank: number;
  type: SkillNodeType;
  /** SP that must already be spent in this node's branch before learning it. */
  branchSpendRequirement?: number;
  /** Another node at a minimum rank (only where truly needed). */
  prerequisite?: { nodeId: string; rank: number };

  /** active / buff: the combat skill it casts, its range (tiles) and per-rank numbers (index 0 = rank 1). */
  combatSkillId?: SkillId;
  rangeTiles?: number;
  /** Charge-style dash length (tiles). */
  dashTiles?: number;
  ranks?: readonly ActiveRank[];
  /** buff: the status it applies to the caster. */
  statusId?: StatusId;

  /** passive: modifier parts gained per rank (multiplied by the rank); `effects` are combat effect keys (see effectKey). */
  perRank?: Pick<StatModifier, 'flat' | 'percent' | 'effects'>;
  /** proc: trigger and effect. */
  proc?: ProcDef;

  /** Temporary UI text. */
  description: string;
}

export interface SkillBranchDef {
  id: string;
  name: string;
}

export interface SkillTreeDef {
  id: string;
  jobId: JobId;
  /** Feature that must be unlocked before any point can be spent. */
  requiredFeature: FeatureId;
  /** The job's basic attack (always castable, never ranked, never on the hotbar). Missing = the melee `basic_attack`. */
  basicAttack?: SkillId;
  branches: readonly SkillBranchDef[];
  /** In display order. */
  nodes: readonly SkillNodeDef[];
}

/** Every tree, by id (JobDef.skillTreeId points here). */
export const SKILL_TREES: Readonly<Record<string, SkillTreeDef>> = {
  [WARRIOR_C1_TREE.id]: WARRIOR_C1_TREE,
  [MAGE_C1_TREE.id]: MAGE_C1_TREE,
};

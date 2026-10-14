import type { SkillTreeDef } from '../skillTreeData';
import type { StatusDef } from '../statusData';

/*
 * Mage Class 1 skill tree — first playable baseline (docs/design/mage-class-implementation.md).
 * Numbers follow the approved Preparation Pass proposal and are expected to be tuned through play.
 * All Mage skill numbers live in this file; Magic Bolt (the class basic attack) is in skillData.
 *
 * Core 20 SP (passives), Fire 13 SP, Frost 6 SP: 39 ranks against 30 SP at Lv40, so builds choose.
 * Gates count only SP spent in the node's own branch, so the proposal's gates were mapped onto
 * reachable branch totals: Fireball opens Fire, Meteor needs 8 Fire SP, Frost Storm needs Frost Nova maxed (3).
 */

/** Statuses applied by Mage skills (registered in statusData). */
export const MAGE_STATUS_DEFS = {
  /** Flame Burst: fire damage every second, credited to the caster. Strength per application (OnHitStatus.magnitude). */
  burning: {
    id: 'burning',
    name: 'Burn',
    kind: 'debuff',
    modifier: {},
    dot: { intervalMs: 1000 },
    color: 0xff7b2e,
  },
  /** Frost Nova: movement only (attack timing and wind-ups are untouched). */
  slowed: {
    id: 'slowed',
    name: 'Slow',
    kind: 'debuff',
    modifier: {},
    slow: 0.4,
    color: 0x7fd4ff,
  },
  /** Frost Storm: a weaker Slow re-applied by every tick while the monster stands inside. */
  chilled: {
    id: 'chilled',
    name: 'Slow',
    kind: 'debuff',
    modifier: {},
    slow: 0.3,
    color: 0x9fd4ff,
  },
} satisfies Record<string, StatusDef>;

export const MAGE_C1_TREE: SkillTreeDef = {
  id: 'mage_c1',
  jobId: 'mage',
  requiredFeature: 'class_1_skills',
  basicAttack: 'magic_bolt',
  branches: [
    { id: 'core', name: 'Core' },
    { id: 'fire', name: 'Fire' },
    { id: 'frost', name: 'Frost' },
  ],
  nodes: [
    // ------------------------------------------------------------ Core (20)
    {
      id: 'arcane_power',
      displayName: 'Arcane Power',
      branch: 'core',
      maxRank: 10,
      type: 'passive',
      perRank: { percent: { magicAtk: 0.015 } },
      description: 'MATK +1.5% per rank.',
    },
    {
      id: 'mana_flow',
      displayName: 'Mana Flow',
      branch: 'core',
      maxRank: 5,
      type: 'passive',
      // Conservative: at most -10% MP cost, so MP still decides how often big spells come out.
      perRank: { percent: { maxMp: 0.04 }, effects: { mpCost: 0.02 } },
      description: 'Max MP +4% and skill MP cost -2% per rank.',
    },
    {
      id: 'elemental_mastery',
      displayName: 'Elemental Mastery',
      branch: 'core',
      maxRank: 5,
      type: 'passive',
      branchSpendRequirement: 5,
      perRank: { effects: { 'elementDamage:fire': 0.03, 'elementDamage:frost': 0.03 } },
      description: 'Fire and Frost skill damage +3% per rank (including Burn).',
    },

    // ------------------------------------------------------------ Fire (13)
    {
      id: 'fireball',
      displayName: 'Fireball',
      branch: 'fire',
      maxRank: 5,
      type: 'active',
      combatSkillId: 'fireball',
      rangeTiles: 7,
      ranks: [
        { power: 1.6, cooldownMs: 3000, mpCost: 10, splashRadiusTiles: 1.25, splashPower: 0.5 },
        { power: 1.8, cooldownMs: 2900, mpCost: 11, splashRadiusTiles: 1.25, splashPower: 0.5 },
        { power: 2.0, cooldownMs: 2800, mpCost: 12, splashRadiusTiles: 1.25, splashPower: 0.5 },
        { power: 2.2, cooldownMs: 2700, mpCost: 13, splashRadiusTiles: 1.25, splashPower: 0.5 },
        { power: 2.4, cooldownMs: 2600, mpCost: 14, splashRadiusTiles: 1.25, splashPower: 0.5 },
      ],
      description: 'A fast fire projectile: Magic damage to one target and half of it to enemies around the impact.',
    },
    {
      id: 'flame_burst',
      displayName: 'Flame Burst',
      branch: 'fire',
      maxRank: 5,
      type: 'active',
      prerequisite: { nodeId: 'fireball', rank: 1 },
      combatSkillId: 'flame_burst',
      rangeTiles: 6,
      ranks: [
        { power: 1.5, cooldownMs: 8000, mpCost: 22, radiusTiles: 2.0, statusMs: 4000, statusPower: 0.15 },
        { power: 1.7, cooldownMs: 7750, mpCost: 24, radiusTiles: 2.0, statusMs: 4000, statusPower: 0.175 },
        { power: 1.9, cooldownMs: 7500, mpCost: 26, radiusTiles: 2.0, statusMs: 4000, statusPower: 0.2 },
        { power: 2.1, cooldownMs: 7250, mpCost: 28, radiusTiles: 2.0, statusMs: 4000, statusPower: 0.225 },
        { power: 2.3, cooldownMs: 7000, mpCost: 30, radiusTiles: 2.0, statusMs: 4000, statusPower: 0.25 },
      ],
      description: 'Flames erupt around the target: Magic damage to every enemy in the area, then Burn every second for 4 sec.',
    },
    {
      id: 'meteor_burst',
      displayName: 'Meteor Burst',
      branch: 'fire',
      maxRank: 3,
      type: 'active',
      branchSpendRequirement: 8,
      combatSkillId: 'meteor_burst',
      rangeTiles: 7,
      ranks: [
        { power: 4.0, cooldownMs: 45000, mpCost: 60, radiusTiles: 3.0 },
        { power: 4.8, cooldownMs: 40000, mpCost: 70, radiusTiles: 3.0 },
        { power: 5.6, cooldownMs: 35000, mpCost: 80, radiusTiles: 3.0 },
      ],
      description: 'A meteor strikes the marked ground after 0.8 sec: heavy Magic damage to every enemy still inside.',
    },

    // ------------------------------------------------------------ Frost (6)
    {
      id: 'frost_nova',
      displayName: 'Frost Nova',
      branch: 'frost',
      maxRank: 3,
      type: 'active',
      combatSkillId: 'frost_nova',
      ranks: [
        { power: 1.0, cooldownMs: 12000, mpCost: 18, radiusTiles: 2.5, statusMs: 3000 },
        { power: 1.2, cooldownMs: 11000, mpCost: 20, radiusTiles: 2.5, statusMs: 3500 },
        { power: 1.4, cooldownMs: 10000, mpCost: 22, radiusTiles: 2.5, statusMs: 4000 },
      ],
      description: 'An icy ring bursts from the Mage: Magic damage to nearby enemies and Slow (-40% movement).',
    },
    {
      id: 'frost_storm',
      displayName: 'Frost Storm',
      branch: 'frost',
      maxRank: 3,
      type: 'active',
      branchSpendRequirement: 3,
      combatSkillId: 'frost_storm',
      rangeTiles: 6,
      ranks: [
        { power: 0.35, cooldownMs: 18000, mpCost: 45, radiusTiles: 2.5, durationMs: 5000 },
        { power: 0.425, cooldownMs: 16500, mpCost: 50, radiusTiles: 2.5, durationMs: 5000 },
        { power: 0.5, cooldownMs: 15000, mpCost: 55, radiusTiles: 2.5, durationMs: 5000 },
      ],
      description: 'A blizzard over the target area for 5 sec: Magic damage every 0.5 sec and Slow (-30%) while inside.',
    },
  ],
};

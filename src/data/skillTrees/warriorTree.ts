import type { SkillTreeDef } from '../skillTreeData';
import type { StatusDef } from '../statusData';

/*
 * Warrior Class 1 skill tree — Balance v1 (approved for the Demo, expected to
 * be tuned through play). All Warrior skill numbers live in this file.
 *
 * Core 6 SP, Tank 20 SP, Damage 20 SP. At Lv40 (30 SP) a player can finish
 * Core and one branch and still put 4 SP across; branches never lock each
 * other out. Gates count only SP spent in the node's own branch.
 */

/** Statuses applied by Warrior skills (registered in statusData). */
export const WARRIOR_STATUS_DEFS = {
  iron_guard: {
    id: 'iron_guard',
    name: 'Iron Guard',
    kind: 'buff',
    modifier: { effects: { damageReduction: 0.45 } },
    color: 0x9fb7d9,
  },
  berserk: {
    id: 'berserk',
    name: 'Berserk',
    kind: 'buff',
    // ASPD speeds basic attacks only; it never shortens skill cooldowns.
    modifier: { percent: { physicalAtk: 0.2, def: -0.15 }, flat: { aspd: 0.15 } },
    color: 0xe0524a,
  },
  guardian_instinct: {
    id: 'guardian_instinct',
    name: 'Guardian Instinct',
    kind: 'buff',
    modifier: { effects: { damageReduction: 0.2 } },
    color: 0x7fd4ff,
  },
  battle_instinct: {
    id: 'battle_instinct',
    name: 'Battle Instinct',
    kind: 'buff',
    modifier: { flat: { critRate: 0.08 }, effects: { physicalDamage: 0.1 } },
    color: 0xffd166,
  },
} satisfies Record<string, StatusDef>;

export const WARRIOR_C1_TREE: SkillTreeDef = {
  id: 'warrior_c1',
  jobId: 'warrior',
  requiredFeature: 'class_1_skills',
  branches: [
    { id: 'core', name: 'Core' },
    { id: 'tank', name: 'Tank' },
    { id: 'damage', name: 'Damage' },
  ],
  nodes: [
    // ------------------------------------------------------------ Core (6)
    {
      id: 'power_slash',
      displayName: 'Power Slash',
      branch: 'core',
      maxRank: 5,
      type: 'active',
      combatSkillId: 'power_strike',
      rangeTiles: 1.4,
      ranks: [
        { power: 1.25, cooldownMs: 4000, mpCost: 8 },
        { power: 1.4, cooldownMs: 3800, mpCost: 9 },
        { power: 1.55, cooldownMs: 3600, mpCost: 10 },
        { power: 1.7, cooldownMs: 3400, mpCost: 11 },
        { power: 1.9, cooldownMs: 3200, mpCost: 12 },
      ],
      description: 'A heavy cut: Physical damage to one target.',
    },
    {
      id: 'charge',
      displayName: 'Charge',
      branch: 'core',
      maxRank: 1,
      type: 'active',
      combatSkillId: 'charge',
      rangeTiles: 4.5,
      dashTiles: 4.5,
      ranks: [{ power: 1.4, cooldownMs: 12000, mpCost: 16, stunMs: 500 }],
      description: 'Dash to the target and strike, briefly interrupting it.',
    },

    // ------------------------------------------------------------ Tank (20)
    {
      id: 'heavy_armor_mastery',
      displayName: 'Heavy Armor Mastery',
      branch: 'tank',
      maxRank: 10,
      type: 'passive',
      perRank: { percent: { def: 0.02, maxHp: 0.01 } },
      description: 'DEF +2% and Max HP +1% per rank.',
    },
    {
      id: 'shield_bash',
      displayName: 'Shield Bash',
      branch: 'tank',
      maxRank: 5,
      type: 'active',
      combatSkillId: 'shield_bash',
      rangeTiles: 1.4,
      ranks: [
        { power: 0.9, cooldownMs: 8000, mpCost: 10, stunMs: 800 },
        { power: 1.0, cooldownMs: 7750, mpCost: 11, stunMs: 1000 },
        { power: 1.1, cooldownMs: 7500, mpCost: 12, stunMs: 1200 },
        { power: 1.2, cooldownMs: 7250, mpCost: 13, stunMs: 1400 },
        { power: 1.3, cooldownMs: 7000, mpCost: 14, stunMs: 1600 },
      ],
      description: 'Physical damage that stuns on a hit (a miss neither damages nor stuns).',
    },
    {
      id: 'provoke',
      displayName: 'Provoke',
      branch: 'tank',
      maxRank: 3,
      type: 'active',
      branchSpendRequirement: 5,
      combatSkillId: 'provoke',
      ranks: [
        { cooldownMs: 12000, mpCost: 12, radiusTiles: 3.0, durationMs: 3000 },
        { cooldownMs: 11000, mpCost: 14, radiusTiles: 3.5, durationMs: 4000 },
        { cooldownMs: 10000, mpCost: 16, radiusTiles: 4.0, durationMs: 5000 },
      ],
      description: 'Taunt nearby monsters: they attack the Warrior.',
    },
    {
      id: 'iron_guard',
      displayName: 'Iron Guard',
      branch: 'tank',
      maxRank: 1,
      type: 'buff',
      branchSpendRequirement: 10,
      combatSkillId: 'iron_guard',
      statusId: 'iron_guard',
      ranks: [{ cooldownMs: 24000, mpCost: 18, durationMs: 4000 }],
      description: 'Damage received -45% for 4 sec.',
    },
    {
      id: 'guardian_instinct',
      displayName: 'Guardian Instinct',
      branch: 'tank',
      maxRank: 1,
      type: 'proc',
      branchSpendRequirement: 15,
      proc: { kind: 'low_hp', threshold: 0.3, statusId: 'guardian_instinct', durationMs: 5000, icdMs: 30000 },
      description: 'When a hit leaves you below 30% HP: Damage received -20% for 5 sec (30 sec cooldown).',
    },

    // ------------------------------------------------------------ Damage (20)
    {
      id: 'sword_mastery',
      displayName: 'Sword Mastery',
      branch: 'damage',
      maxRank: 10,
      type: 'passive',
      perRank: { percent: { physicalAtk: 0.015 }, flat: { accuracy: 0.01 } },
      description: 'Physical ATK +1.5% and Accuracy +1 point per rank.',
    },
    {
      id: 'whirlwind',
      displayName: 'Whirlwind',
      branch: 'damage',
      maxRank: 5,
      type: 'active',
      combatSkillId: 'whirlwind',
      ranks: [
        { power: 1.4, cooldownMs: 7000, mpCost: 14, radiusTiles: 2.0 },
        { power: 1.6, cooldownMs: 6750, mpCost: 16, radiusTiles: 2.0 },
        { power: 1.8, cooldownMs: 6500, mpCost: 18, radiusTiles: 2.0 },
        { power: 2.0, cooldownMs: 6250, mpCost: 20, radiusTiles: 2.0 },
        { power: 2.2, cooldownMs: 6000, mpCost: 22, radiusTiles: 2.0 },
      ],
      description: 'Spin: Physical damage to every enemy around you (one hit per enemy).',
    },
    {
      id: 'heavy_strike',
      displayName: 'Heavy Strike',
      branch: 'damage',
      maxRank: 3,
      type: 'active',
      branchSpendRequirement: 5,
      combatSkillId: 'heavy_strike',
      rangeTiles: 1.4,
      ranks: [
        { power: 1.8, cooldownMs: 7500, mpCost: 14, critBonus: 0.1 },
        { power: 2.2, cooldownMs: 7000, mpCost: 17, critBonus: 0.15 },
        { power: 2.6, cooldownMs: 6500, mpCost: 20, critBonus: 0.2 },
      ],
      description: 'A crushing blow with extra crit chance for this skill.',
    },
    {
      id: 'berserk',
      displayName: 'Berserk',
      branch: 'damage',
      maxRank: 1,
      type: 'buff',
      branchSpendRequirement: 10,
      combatSkillId: 'berserk',
      statusId: 'berserk',
      ranks: [{ cooldownMs: 30000, mpCost: 20, durationMs: 10000 }],
      description: 'For 10 sec: Physical ATK +20%, ASPD +15%, DEF -15%.',
    },
    {
      id: 'battle_instinct',
      displayName: 'Battle Instinct',
      branch: 'damage',
      maxRank: 1,
      type: 'proc',
      branchSpendRequirement: 15,
      proc: { kind: 'hit_streak', hits: 3, windowMs: 5000, statusId: 'battle_instinct', durationMs: 6000 },
      description: '3 successful hits within 5 sec: Crit +8 points and Physical damage +10% for 6 sec.',
    },
  ],
};

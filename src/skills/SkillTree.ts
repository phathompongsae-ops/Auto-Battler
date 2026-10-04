import type { EventBus } from '../core/EventBus';
import { DEMO_KIT_LOADOUT, PLAYER_BASIC_ATTACK, SKILL_SLOTS, type SkillSlot } from '../data/playerData';
import { SKILLS, type SkillDef, type SkillId } from '../data/skillData';
import type { SkillNodeDef, SkillTreeDef } from '../data/skillTreeData';
import type { StatusId } from '../data/statusData';
import type { FeatureUnlocks } from '../features/FeatureUnlocks';
import type { GameEvents } from '../game/GameEvents';
import type { StatOwner } from '../progression/statActions';
import { checkLearn, learnedActives, nodeForSkill, rankOf, skillAtRank, spentInBranch, treeForJob, type LearnError } from './skillTreeRules';

export interface SkillPoints {
  /** From job and level (Class 1: +1 per level Lv11–40). */
  earned: number;
  /** Sum of learned ranks. */
  spent: number;
  available: number;
}

/** What the temporary Skill Tree UI shows for one node. */
export interface NodeView {
  node: SkillNodeDef;
  rank: number;
  /** null when one more rank can be learned now. */
  blockedBy: LearnError | null;
  /** SP spent so far in the node's branch (for gate display). */
  branchSpent: number;
  current: SkillDef | null;
  next: SkillDef | null;
}

export type Loadout = Record<SkillSlot, SkillId | null>;

/**
 * The character's skill tree for its current job: one validated learn path,
 * a free reset (Alpha/Demo), passives (derived from ranks, see
 * CharacterProgress.modifiers), which skills can be cast and at what rank,
 * and the action-bar loadout. Ranks live in CharacterProgress.skillRanks.
 */
export class SkillTree {
  constructor(
    private readonly owner: StatOwner,
    private readonly features: FeatureUnlocks,
    private readonly events: EventBus<GameEvents>,
    /** Extra clean-up on reset (proc streaks / internal cooldowns). */
    private readonly onReset: () => void = () => {},
  ) {}

  tree(): SkillTreeDef | null {
    return treeForJob(this.owner.progress.classId);
  }

  rank(nodeId: string): number {
    return rankOf(this.owner.progress.skillRanks, nodeId);
  }

  points(): SkillPoints {
    const earned = this.owner.progress.earnedSkillPoints(this.owner.combat.level);
    const spent = this.owner.progress.skillPointsSpent;
    return { earned, spent, available: earned - spent };
  }

  /** Whether the tree may be used at all (job has a tree and its feature is unlocked). */
  usable(): boolean {
    const tree = this.tree();
    return !!tree && this.features.isFeatureUnlocked(tree.requiredFeature);
  }

  canLearn(nodeId: string) {
    const tree = this.tree();
    return checkLearn(tree, this.owner.progress.skillRanks, nodeId, {
      available: this.points().available,
      featureUnlocked: !!tree && this.features.isFeatureUnlocked(tree.requiredFeature),
    });
  }

  /** Learn one more rank. A failure changes nothing. */
  learn(nodeId: string): { ok: true; rank: number } | { ok: false; reason: LearnError } {
    const check = this.canLearn(nodeId);
    if (!check.ok) return check;
    const before = this.loadout();
    const rank = this.rank(nodeId) + 1;
    this.owner.progress.skillRanks[nodeId] = rank;
    this.owner.combat.refreshStats(); // passives
    this.events.emit('skillRankChanged', { nodeId, rank, available: this.points().available });
    this.emitIfLoadoutChanged(before);
    return { ok: true, rank };
  }

  /**
   * Free reset (Alpha/Demo; a future cost/item would be checked here): every
   * rank back to 0, all spent SP returned, passives and tree buffs/procs gone.
   * Job, level and stat allocation are untouched. Returns the SP refunded.
   */
  reset(): number {
    const tree = this.tree();
    const refunded = this.owner.progress.skillPointsSpent;
    const before = this.loadout();
    for (const key of Object.keys(this.owner.progress.skillRanks)) delete this.owner.progress.skillRanks[key];
    const statusIds = new Set<StatusId>();
    for (const n of tree?.nodes ?? []) {
      if (n.statusId) statusIds.add(n.statusId);
      if (n.proc) statusIds.add(n.proc.statusId);
    }
    // Tree buffs (Iron Guard, Berserk, proc buffs) end now.
    const statuses = this.owner.combat.statuses;
    for (let i = statuses.length - 1; i >= 0; i--) {
      const id = statuses[i].def.id as StatusId;
      if (!statusIds.has(id)) continue;
      statuses.splice(i, 1);
      this.events.emit('statusExpired', { targetId: this.owner.combat.id, statusId: id });
    }
    this.onReset();
    this.owner.combat.refreshStats();
    this.events.emit('skillTreeReset', { refunded });
    this.emitIfLoadoutChanged(before);
    return refunded;
  }

  nodeView(nodeId: string): NodeView {
    const tree = this.tree();
    const node = tree?.nodes.find((n) => n.id === nodeId);
    if (!tree || !node) throw new Error(`unknown skill node ${nodeId}`);
    const rank = this.rank(nodeId);
    const check = this.canLearn(nodeId);
    return {
      node,
      rank,
      blockedBy: check.ok ? null : check.reason,
      branchSpent: spentInBranch(tree, this.owner.progress.skillRanks, node.branch),
      current: skillAtRank(node, rank),
      next: rank < node.maxRank ? skillAtRank(node, rank + 1) : null,
    };
  }

  /**
   * What the player can cast. Basic Attack always. A job with a tree: only
   * its learned skills at their rank (rank 0 = unavailable). A job without a
   * tree yet (Novice, Archer, Mage, Cleric, Ninja): the TEMPORARY DEMO KIT.
   */
  resolve(skillId: SkillId): SkillDef | null {
    if (skillId === PLAYER_BASIC_ATTACK) return SKILLS[skillId];
    const tree = this.tree();
    if (!tree) return Object.values(DEMO_KIT_LOADOUT).includes(skillId) ? SKILLS[skillId] : null;
    const node = nodeForSkill(tree, skillId);
    return node ? skillAtRank(node, this.rank(node.id)) : null;
  }

  /**
   * Action-bar skills (temporary mapping): learned castable skills in tree
   * order fill slots 1–5; without a tree, the demo kit.
   */
  loadout(): Loadout {
    const tree = this.tree();
    if (!tree) return { ...DEMO_KIT_LOADOUT };
    const learned = learnedActives(tree, this.owner.progress.skillRanks).map((n) => n.combatSkillId!);
    return Object.fromEntries(SKILL_SLOTS.map((slot, i) => [slot, learned[i] ?? null])) as Loadout;
  }

  private emitIfLoadoutChanged(before: Loadout): void {
    const after = this.loadout();
    if (SKILL_SLOTS.some((s) => before[s] !== after[s])) this.events.emit('skillAvailabilityChanged', { loadout: after });
  }
}

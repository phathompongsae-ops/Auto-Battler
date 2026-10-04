import { TILE_SIZE } from '../config';
import { JOBS, type JobId } from '../data/jobData';
import { SKILLS, type SkillDef, type SkillEffect, type SkillId } from '../data/skillData';
import { SKILL_TREES, type SkillNodeDef, type SkillTreeDef } from '../data/skillTreeData';
import type { DerivedStatKey, StatModifier } from '../stats/modifiers';

/*
 * Pure skill-tree rules (no engine, no state): which tree a job uses, what
 * may be learned, whether saved ranks are possible, what passives grant, and
 * what an active skill does at a rank. The SkillTree service and save
 * validation both use these, so the rules exist once.
 */

/** Node id → learned rank (0 / missing = not learned). */
export type SkillRanks = Readonly<Record<string, number>>;

export type LearnError =
  | 'no_skill_tree'
  | 'feature_locked'
  | 'unknown_skill'
  | 'max_rank'
  | 'not_enough_points'
  | 'branch_requirement'
  | 'prerequisite';

export function treeForJob(jobId: JobId): SkillTreeDef | null {
  const id = JOBS[jobId].skillTreeId;
  return (id && SKILL_TREES[id]) || null;
}

export const rankOf = (ranks: SkillRanks, nodeId: string) => ranks[nodeId] ?? 0;

export function totalSpent(ranks: SkillRanks): number {
  return Object.values(ranks).reduce((n, r) => n + r, 0);
}

export function spentInBranch(tree: SkillTreeDef, ranks: SkillRanks, branch: string): number {
  return tree.nodes.filter((n) => n.branch === branch).reduce((sum, n) => sum + rankOf(ranks, n.id), 0);
}

/** Whether one more rank of `nodeId` may be learned now. `available` = earned - spent SP. */
export function checkLearn(
  tree: SkillTreeDef | null,
  ranks: SkillRanks,
  nodeId: string,
  ctx: { available: number; featureUnlocked: boolean },
): { ok: true; node: SkillNodeDef } | { ok: false; reason: LearnError } {
  if (!tree) return { ok: false, reason: 'no_skill_tree' };
  if (!ctx.featureUnlocked) return { ok: false, reason: 'feature_locked' };
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: 'unknown_skill' };
  if (rankOf(ranks, nodeId) >= node.maxRank) return { ok: false, reason: 'max_rank' };
  if (ctx.available < 1) return { ok: false, reason: 'not_enough_points' };
  if (node.branchSpendRequirement && spentInBranch(tree, ranks, node.branch) < node.branchSpendRequirement) {
    return { ok: false, reason: 'branch_requirement' };
  }
  if (node.prerequisite && rankOf(ranks, node.prerequisite.nodeId) < node.prerequisite.rank) return { ok: false, reason: 'prerequisite' };
  return { ok: true, node };
}

/**
 * Whether saved ranks are reachable by legal learning: replays every rank
 * through checkLearn (ungated nodes first, then by gate). Returns a problem
 * description, or null when the state is possible.
 */
export function rankProblem(tree: SkillTreeDef | null, ranks: SkillRanks, earned: number): string | null {
  const learned = Object.entries(ranks).filter(([, r]) => r !== 0);
  if (!learned.length) return null;
  if (!tree) return 'this job has no skill tree';
  for (const [id, r] of learned) {
    const node = tree.nodes.find((n) => n.id === id);
    if (!node) return `unknown skill ${id}`;
    if (!Number.isInteger(r) || r < 0 || r > node.maxRank) return `${id} rank ${r} is outside 0..${node.maxRank}`;
  }
  if (totalSpent(ranks) > earned) return 'more skill points spent than earned';
  const order = [...tree.nodes].sort((a, b) => (a.branchSpendRequirement ?? 0) - (b.branchSpendRequirement ?? 0));
  const replay: Record<string, number> = {};
  for (const node of order) {
    for (let i = 0; i < rankOf(ranks, node.id); i++) {
      const check = checkLearn(tree, replay, node.id, { available: Infinity, featureUnlocked: true });
      if (!check.ok) return `${node.id} could not have been learned (${check.reason})`;
      replay[node.id] = rankOf(replay, node.id) + 1;
    }
  }
  return null;
}

/** Passive nodes as stat modifiers (source 'skill'): per-rank parts × rank. */
export function passiveModifiers(tree: SkillTreeDef | null, ranks: SkillRanks): StatModifier[] {
  if (!tree) return [];
  const out: StatModifier[] = [];
  const scale = (part: Partial<Record<DerivedStatKey, number>> | undefined, r: number) =>
    part && Object.fromEntries(Object.entries(part).map(([k, v]) => [k, v * r]));
  for (const node of tree.nodes) {
    const r = rankOf(ranks, node.id);
    if (node.type !== 'passive' || !node.perRank || r <= 0) continue;
    out.push({ source: 'skill', id: `skill:${node.id}`, flat: scale(node.perRank.flat, r), percent: scale(node.perRank.percent, r) });
  }
  return out;
}

/** Learned castable nodes (active / buff) in tree order. */
export function learnedActives(tree: SkillTreeDef | null, ranks: SkillRanks): SkillNodeDef[] {
  return tree?.nodes.filter((n) => n.combatSkillId && rankOf(ranks, n.id) > 0) ?? [];
}

/** The tree node that casts `skillId`, if this tree has one. */
export function nodeForSkill(tree: SkillTreeDef | null, skillId: SkillId): SkillNodeDef | undefined {
  return tree?.nodes.find((n) => n.combatSkillId === skillId);
}

/**
 * A combat skill at a learned rank: the combat definition's static parts
 * (targeting, wind-up, colour) with this rank's numbers. Rank 0 → null (the
 * skill can't be cast; there is no hidden default rank).
 */
export function skillAtRank(node: SkillNodeDef, rank: number): SkillDef | null {
  if (!node.combatSkillId || !node.ranks || rank <= 0) return null;
  const r = node.ranks[Math.min(rank, node.ranks.length) - 1];
  const base = SKILLS[node.combatSkillId];
  const tiles = (t: number | undefined, fallback: number) => (t === undefined ? fallback : t * TILE_SIZE);
  const stun = r.stunMs ? { statusId: 'stunned' as const, duration: r.stunMs } : undefined;
  const e = base.effect;
  let effect: SkillEffect;
  switch (e.kind) {
    case 'damage':
      effect = { ...e, power: r.power ?? e.power, onHit: stun, critBonus: r.critBonus };
      break;
    case 'aoe_damage':
      effect = { ...e, power: r.power ?? e.power, radius: tiles(r.radiusTiles, e.radius) };
      break;
    case 'taunt':
      effect = { ...e, duration: r.durationMs ?? e.duration, radius: tiles(r.radiusTiles, e.radius) };
      break;
    case 'dash_strike':
      effect = { ...e, power: r.power ?? e.power, distance: tiles(node.dashTiles, e.distance), onHit: stun };
      break;
    case 'status':
      effect = { ...e, duration: r.durationMs ?? e.duration };
      break;
    default:
      effect = e;
  }
  return { ...base, mpCost: r.mpCost, cooldown: r.cooldownMs, range: tiles(node.rangeTiles, base.range), effect };
}

import type { Clock } from '../core/clock';
import type { Rng } from '../core/rng';
import { RECIPES, type RecipeDef } from '../data/craftingData';
import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import type { Wallet } from '../economy/Wallet';
import type { EquipmentInstance } from '../equipment/equipment';
import { createEquipment, type IdSource } from '../equipment/factory';
import type { Inventory } from '../loot/Inventory';

/** Problems with a recipe's data (empty = valid). */
export function validateRecipe(recipe: RecipeDef): string[] {
  const errors: string[] = [];
  const def = EQUIPMENT_DEFS[recipe.outputDefId];
  if (!def) return [`unknown output ${recipe.outputDefId}`];
  if (def.equipmentLevel !== recipe.equipmentLevel) errors.push('equipment level does not match the output');
  if (def.rarity !== recipe.rarity) errors.push('rarity does not match the output');
  if ((def.setId ?? undefined) !== (recipe.setId ?? undefined)) errors.push('set does not match the output');
  if (!(recipe.durationMs > 0)) errors.push('duration must be positive');
  if (recipe.gold < 0 || recipe.bossFragments < 0 || recipe.materials.some((m) => m.count <= 0)) errors.push('negative or empty requirement');
  return errors;
}

export interface CraftJob {
  jobId: string;
  recipeId: string;
  startedAt: number;
  completesAt: number;
  claimed: boolean;
}

export type StartCraftResult = { ok: true; job: CraftJob } | { ok: false; reason: 'unknown_recipe' | 'missing_blueprint' | 'missing_fragments' | 'missing_materials' | 'not_enough_gold' };
export type ClaimCraftResult = { ok: true; item: EquipmentInstance } | { ok: false; reason: 'unknown_job' | 'not_ready' | 'already_claimed' };

/**
 * Timed crafting. Requirements are consumed when a job starts; the result is
 * claimed once its time is up, exactly once. Time comes from the same Clock
 * interface as the Special Shop (DEMO: local; later: server).
 */
export class CraftingQueue {
  jobs: CraftJob[] = [];

  constructor(private readonly clock: Clock) {}

  start(recipeId: string, inventory: Inventory, wallet: Wallet, newId: IdSource): StartCraftResult {
    const recipe = RECIPES[recipeId];
    if (!recipe) return { ok: false, reason: 'unknown_recipe' };
    if (recipe.blueprint && inventory.count(recipe.blueprint) < 1) return { ok: false, reason: 'missing_blueprint' };
    if (inventory.count('boss_fragment') < recipe.bossFragments) return { ok: false, reason: 'missing_fragments' };
    if (recipe.materials.some((m) => inventory.count(m.itemId) < m.count)) return { ok: false, reason: 'missing_materials' };
    if (wallet.get('gold') < recipe.gold) return { ok: false, reason: 'not_enough_gold' };

    if (recipe.blueprint) inventory.remove(recipe.blueprint);
    if (recipe.bossFragments) inventory.remove('boss_fragment', recipe.bossFragments);
    for (const m of recipe.materials) inventory.remove(m.itemId, m.count);
    wallet.spend('gold', recipe.gold);

    const now = this.clock.now();
    const job: CraftJob = { jobId: newId(), recipeId, startedAt: now, completesAt: now + recipe.durationMs, claimed: false };
    this.jobs.push(job);
    return { ok: true, job };
  }

  /** Collect a finished job's item (enchants rolled now). */
  claim(jobId: string, rng: Rng, newItemId: IdSource): ClaimCraftResult {
    const job = this.jobs.find((j) => j.jobId === jobId);
    if (!job) return { ok: false, reason: 'unknown_job' };
    if (job.claimed) return { ok: false, reason: 'already_claimed' };
    if (this.clock.now() < job.completesAt) return { ok: false, reason: 'not_ready' };
    job.claimed = true;
    return { ok: true, item: createEquipment(RECIPES[job.recipeId].outputDefId, rng, newItemId) };
  }
}

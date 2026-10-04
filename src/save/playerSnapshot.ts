import type { CombatantState } from '../combat/CombatantState';
import type { CraftingQueue } from '../crafting/crafting';
import type { RewardLedger } from '../dungeon/rewards';
import type { Wallet } from '../economy/Wallet';
import type { EquipmentManager } from '../equipment/equipment';
import type { Inventory } from '../loot/Inventory';
import type { PetCollection } from '../pets/pets';
import type { SpecialShop } from '../pets/specialShop';
import type { CharacterProgress } from '../progression/CharacterProgress';
import type { WarpUnlocks } from '../warp/warp';
import { newPlayerSave, type PlayerSave } from './playerSave';

/** Save fields with no live system yet; carried through load → save untouched. */
export type PersistedHooks = Pick<PlayerSave, 'energy' | 'quests' | 'dungeons'>;

export function emptyHooks(): PersistedHooks {
  const { energy, quests, dungeons } = newPlayerSave('_');
  return { energy, quests, dungeons };
}

/** Everything a player save is captured from / applied to. No engine types. */
export interface SaveTarget {
  characterId: string;
  progress: CharacterProgress;
  combat: CombatantState;
  inventory: Inventory;
  wallet: Wallet;
  equipment: EquipmentManager;
  pets: PetCollection;
  shop: SpecialShop;
  crafting: CraftingQueue;
  warp: WarpUnlocks;
  ledger: RewardLedger;
  hooks: PersistedHooks;
}

/** Snapshot the inputs. Derived values (stats, set bonuses, pet totals) are not saved. */
export function capturePlayerSave(t: SaveTarget): PlayerSave {
  const data = t.progress.toData();
  const level = t.combat.level;
  return {
    schemaVersion: 3,
    characterId: t.characterId,
    classId: data.classId,
    level,
    exp: t.combat.exp,
    stats: { base: data.base, allocated: data.allocated, jobBonuses: data.jobBonuses },
    unspentStatPoints: t.progress.remaining(level),
    skillPointsSpent: data.skillPointsSpent,
    inventory: t.inventory.entries().map(([itemId, count]) => ({ itemId, count })),
    currencies: t.wallet.toRecord(),
    equipment: structuredClone({ items: [...t.equipment.items.values()], equipped: { ...t.equipment.equipped } }),
    pets: structuredClone({ owned: [...t.pets.owned.values()], activePetId: t.pets.activeId }),
    specialShop: { ...t.shop.state },
    crafting: { jobs: structuredClone(t.crafting.jobs) },
    warp: { towns: [...t.warp.towns], dungeons: [...t.warp.dungeons], homeTown: t.warp.homeTown },
    claimedClears: [...t.ledger.claimed],
    ...structuredClone(t.hooks),
  };
}

/** Load a (validated) save into live state. Derived stats are recalculated, not loaded. */
export function applyPlayerSave(t: SaveTarget, save: PlayerSave): void {
  const s = structuredClone(save);
  t.characterId = s.characterId;
  // Job first: equipment rules depend on it.
  t.progress.assign({
    classId: s.classId,
    base: s.stats.base,
    allocated: s.stats.allocated,
    jobBonuses: s.stats.jobBonuses,
    skillPointsSpent: s.skillPointsSpent,
  });
  t.combat.level = s.level;
  t.combat.exp = s.exp;
  t.inventory.clear();
  for (const { itemId, count } of s.inventory) t.inventory.add(itemId, count);
  t.wallet.assign(s.currencies);

  t.equipment.clear();
  for (const item of s.equipment.items) t.equipment.add(item);
  for (const [slot, id] of Object.entries(s.equipment.equipped)) if (id) t.equipment.equip(id, slot as keyof typeof s.equipment.equipped);

  t.pets.clear();
  for (const pet of s.pets.owned) t.pets.add(pet);
  t.pets.setActive(s.pets.activePetId);

  t.shop.state = { ...s.specialShop };
  t.crafting.jobs = s.crafting.jobs;
  t.warp.towns = new Set(s.warp.towns);
  t.warp.dungeons = new Set(s.warp.dungeons);
  t.warp.homeTown = s.warp.homeTown;
  t.ledger.claimed.clear();
  for (const id of s.claimedClears) t.ledger.claimed.add(id);
  t.hooks = { energy: s.energy, quests: s.quests, dungeons: s.dungeons };

  t.combat.refreshStats();
  t.combat.restore();
}

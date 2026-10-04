import type { CombatantState } from '../combat/CombatantState';
import type { CraftingQueue } from '../crafting/crafting';
import type { RewardLedger } from '../dungeon/rewards';
import type { Wallet } from '../economy/Wallet';
import type { DailyState } from '../daily/DailyState';
import type { FeatureUnlocks } from '../features/FeatureUnlocks';
import type { QuestSystem } from '../quests/QuestSystem';
import type { RecurringQuests } from '../quests/RecurringQuests';
import type { EquipmentManager } from '../equipment/equipment';
import type { Inventory } from '../loot/Inventory';
import type { PetCollection } from '../pets/pets';
import type { SpecialShop } from '../pets/specialShop';
import type { CharacterProgress } from '../progression/CharacterProgress';
import type { WarpUnlocks } from '../warp/warp';
import { newPlayerSave, type PlayerSave } from './playerSave';

/** Save fields with no live system yet; carried through load → save untouched. */
export type PersistedHooks = Pick<PlayerSave, 'dungeons'>;

export function emptyHooks(): PersistedHooks {
  const { dungeons } = newPlayerSave('_');
  return { dungeons };
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
  /** Field Energy and dungeon entitlements for the current server day. */
  daily: DailyState;
  quests: QuestSystem;
  recurring: RecurringQuests;
  features: FeatureUnlocks;
  hooks: PersistedHooks;
}

/** Snapshot the inputs. Derived values (stats, set bonuses, pet totals) are not saved. */
export function capturePlayerSave(t: SaveTarget): PlayerSave {
  const data = t.progress.toData();
  const level = t.combat.level;
  return {
    schemaVersion: 4,
    characterId: t.characterId,
    classId: data.classId,
    level,
    exp: t.combat.exp,
    stats: { base: data.base, allocated: data.allocated, jobBonuses: data.jobBonuses },
    unspentStatPoints: t.progress.remaining(level),
    skillPointsSpent: t.progress.skillPointsSpent,
    skillRanks: data.skillRanks,
    inventory: t.inventory.entries().map(([itemId, count]) => ({ itemId, count })),
    currencies: t.wallet.toRecord(),
    equipment: structuredClone({ items: [...t.equipment.items.values()], equipped: { ...t.equipment.equipped } }),
    pets: structuredClone({ owned: [...t.pets.owned.values()], activePetId: t.pets.activeId }),
    specialShop: { ...t.shop.state },
    crafting: { jobs: structuredClone(t.crafting.jobs) },
    warp: { towns: [...t.warp.towns], dungeons: [...t.warp.dungeons], homeTown: t.warp.homeTown },
    dungeonRuns: { nextSeq: t.ledger.nextSeq, claimed: [...t.ledger.claimed].sort((a, b) => a - b) },
    daily: { ...t.daily.record },
    questLog: t.quests.toState(),
    recurring: t.recurring.toState(),
    features: [...t.features.unlocked],
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
    // Passives come from these ranks (derived), so loading can never apply them twice.
    skillRanks: s.skillRanks,
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
  t.ledger.nextSeq = s.dungeonRuns.nextSeq;
  t.ledger.claimed.clear();
  for (const seq of s.dungeonRuns.claimed) t.ledger.claimed.add(seq);
  // Stored as-is; a save from an earlier server day resets on first use (DailyState).
  t.daily.record = { ...s.daily };
  t.quests.load(s.questLog);
  // Stored as-is; the owner's sync() then applies a pending Daily / Weekly reset exactly once.
  t.recurring.load(s.recurring);
  t.features.unlocked.clear();
  for (const id of s.features) t.features.unlocked.add(id);
  t.hooks = { dungeons: s.dungeons };

  t.combat.refreshStats();
  t.combat.restore();
}

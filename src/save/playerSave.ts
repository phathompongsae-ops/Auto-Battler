import { RECIPES } from '../data/craftingData';
import { ENCHANT_LINES, ENCHANT_OPTIONS, ENCHANT_QUALITIES, ENCHANT_QUALITY_WEIGHTS, type EnchantQuality } from '../data/enchantData';
import { EQUIPMENT_SLOTS, MAX_ENHANCEMENT, type EquipmentSlot } from '../data/equipmentData';
import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import { ITEMS, type ItemId } from '../data/itemData';
import { isJobId, type JobId } from '../data/jobData';
import { PET_MAX_LEVEL, PET_PASSIVES, PET_RARITIES, PET_SPECIES, SPECIAL_SHOP, type PetPassiveId, type PetRarity, type PetSpeciesId } from '../data/petData';
import { NOVICE_BASE_STATS } from '../data/statData';
import { DUNGEON_WARPS, TOWNS } from '../data/warpData';
import { FIELD_ENERGY } from '../data/energyData';
import { DUNGEON_DAILY, DUNGEON_RUN_CLAIM_WINDOW } from '../data/dungeonEntitlementData';
import { freshDaily, type DailyRecord } from '../daily/DailyState';
import { isFeatureId, type FeatureId } from '../data/featureData';
import { QUESTS } from '../data/questData';
import { required as requiredAmount } from '../quests/objectives';
import { MAX_TRACKED_QUESTS, type QuestLogState } from '../quests/QuestSystem';
import { MAX_LEVEL } from '../data/progressionData';
import { expToNext } from '../progression/expCurve';
import type { CraftJob } from '../crafting/crafting';
import { enchantPool } from '../equipment/enchant';
import { EquipmentManager, type EnchantLine, type EquipmentInstance } from '../equipment/equipment';
import type { PetInstance } from '../pets/pets';
import { earnedSkillPoints } from '../progression/CharacterProgress';
import { classGrowthMaxLevel } from '../stats/classBaseStats';
import { isPrimaryStat, PRIMARY_STATS, zeroPrimary, type PrimaryStats } from '../stats/primaryStats';

/*
 * Versioned player save. Plain data with stable ids only. Stores INPUTS:
 * never derived stats, set bonuses, pet totals or enhanced item stats —
 * those are recalculated on load. Shaped so the record can later live on a
 * server.
 */

export const PLAYER_SAVE_VERSION = 4;

/**
 * v4 (current). Changes from v3: the EXP curve is Lv1–60 and `exp` may hold
 * Overflow EXP at the level cap (up to one level's worth); the unused energy
 * hook became `daily` (Field Energy and dungeon entitlements for one server
 * day); `claimedClears` became the bounded `dungeonRuns` claim window.
 *
 * Added within v4 (optional on load, so earlier v4 saves still load with an
 * empty quest log): `questLog` and `features`. The never-used `quests`
 * placeholder hook is retired and ignored when present.
 */
export interface PlayerSaveV4 {
  schemaVersion: 4;
  characterId: string;
  classId: JobId;
  level: number;
  /** EXP toward the next level; at the level cap, the stored Overflow EXP. */
  exp: number;

  stats: {
    base: PrimaryStats;
    allocated: PrimaryStats;
    /** Job bonus received from each job taken, kept per job. */
    jobBonuses: Partial<Record<JobId, Partial<PrimaryStats>>>;
  };
  /** Redundant with level and allocated; stored for server checks and validated on load. */
  unspentStatPoints: number;
  /** Earned skill points are derived from job and level; only spending is stored. */
  skillPointsSpent: number;

  /** Stackable items (materials, eggs, scrolls...) by stable item id. */
  inventory: { itemId: ItemId; count: number }[];
  /** Currency id → amount. */
  currencies: Record<string, number>;

  equipment: { items: EquipmentInstance[]; equipped: Record<EquipmentSlot, string | null> };
  pets: { owned: PetInstance[]; activePetId: string | null };
  specialShop: { cycleId: number | null; ticketsBought: number };
  crafting: { jobs: CraftJob[] };
  warp: { towns: string[]; dungeons: string[]; homeTown: string | null };
  /**
   * Dungeon run claims: the next run number and the claimed runs among the
   * last DUNGEON_RUN_CLAIM_WINDOW (bounded; older runs can't be claimed).
   */
  dungeonRuns: { nextSeq: number; claimed: number[] };

  /** Daily allowances for server day `day` (null = never used: fresh). Reset together on a new day. */
  daily: DailyRecord;
  /** Quest Engine state: started quests, objective progress, tracked ids, announced ids. */
  questLog: QuestLogState;
  /** Unlocked feature ids. */
  features: FeatureId[];
  /** Hook: dungeon id → cleared difficulty ids. */
  dungeons: Record<string, { cleared: string[] }>;
}

export type PlayerSave = PlayerSaveV4;

/** v3: energy was an unused hook; clears were free-form ids. */
export type PlayerSaveV3 = Omit<PlayerSaveV4, 'schemaVersion' | 'daily' | 'dungeonRuns' | 'questLog' | 'features'> & {
  quests: Record<string, { state: 'active' | 'completed'; progress: Record<string, number> }>;
  schemaVersion: 3;
  energy: { current: number; updatedAt: number } | null;
  claimedClears: string[];
};

/** v2: equipment and active pet were hooks only; no shop / crafting / warp / claims. */
export type PlayerSaveV2 = Omit<PlayerSaveV3, 'schemaVersion' | 'equipment' | 'pets' | 'specialShop' | 'crafting' | 'warp' | 'claimedClears'> & {
  schemaVersion: 2;
  equipment: Record<string, string | null>;
  activePetId: string | null;
};

/** v1: as v2 but with unspent `skillPoints` instead of `skillPointsSpent`. */
export type PlayerSaveV1 = Omit<PlayerSaveV2, 'schemaVersion' | 'skillPointsSpent'> & { schemaVersion: 1; skillPoints: number };

export class SaveError extends Error {}

const emptyEquipped = (): Record<EquipmentSlot, string | null> =>
  Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, null])) as Record<EquipmentSlot, string | null>;

const defaultTowns = () => Object.values(TOWNS).filter((t) => t.isDefault).map((t) => t.id);

/** A brand-new character's save (Lv1 Novice). */
export function newPlayerSave(characterId: string): PlayerSave {
  return {
    schemaVersion: 4,
    characterId,
    classId: 'novice',
    level: 1,
    exp: 0,
    stats: { base: { ...NOVICE_BASE_STATS }, allocated: zeroPrimary(), jobBonuses: {} },
    unspentStatPoints: 0,
    skillPointsSpent: 0,
    inventory: [],
    currencies: {},
    equipment: { items: [], equipped: emptyEquipped() },
    pets: { owned: [], activePetId: null },
    specialShop: { cycleId: null, ticketsBought: 0 },
    crafting: { jobs: [] },
    warp: { towns: defaultTowns(), dungeons: [], homeTown: null },
    dungeonRuns: { nextSeq: 1, claimed: [] },
    daily: { day: null, ...freshDaily() },
    questLog: { records: {}, tracked: [], announced: [] },
    features: [],
    dungeons: {},
  };
}

export function serializePlayerSave(save: PlayerSave): string {
  return JSON.stringify(save);
}

/** Parse, migrate and validate. Throws SaveError on anything unusable. */
export function deserializePlayerSave(text: string): PlayerSave {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('save is not valid JSON');
  }
  return validate(migrate(raw));
}

// ------------------------------------------------------------- migration

/** Upgrade older saves step by step to the current version, then validate. */
function migrate(raw: unknown): unknown {
  let save = raw as Record<string, unknown> | null;
  if (save?.schemaVersion === 1) save = migrateV1toV2(save);
  if (save?.schemaVersion === 2) save = migrateV2toV3(save);
  if (save?.schemaVersion === 3) save = migrateV3toV4(save);
  if (save?.schemaVersion === PLAYER_SAVE_VERSION) return save;
  throw new SaveError(`unsupported save version: ${String(save?.schemaVersion)}`);
}

/** v1 → v2: v1 had no way to earn or spend skill points, so nothing was spent. */
function migrateV1toV2(v1: Record<string, unknown>): Record<string, unknown> {
  const { skillPoints: _unspentInV1, ...rest } = v1;
  void _unspentInV1;
  return { ...rest, schemaVersion: 2, skillPointsSpent: 0 };
}

/**
 * v2 → v3: v2 could not own equipment or pets, so the hooks must be empty;
 * any reference to an item or pet that can't exist is rejected rather than
 * silently dropped. New systems start empty / at defaults.
 */
function migrateV2toV3(v2: Record<string, unknown>): Record<string, unknown> {
  const { equipment, activePetId, ...rest } = v2;
  if (isObject(equipment) && Object.values(equipment).some((v) => v !== null)) {
    throw new SaveError('v2 save references equipped items that cannot exist; cannot migrate');
  }
  if (activePetId !== null && activePetId !== undefined) throw new SaveError('v2 save references a pet that cannot exist; cannot migrate');
  return {
    ...rest,
    schemaVersion: 3,
    equipment: { items: [], equipped: emptyEquipped() },
    pets: { owned: [], activePetId: null },
    specialShop: { cycleId: null, ticketsBought: 0 },
    crafting: { jobs: [] },
    warp: { towns: defaultTowns(), dungeons: [], homeTown: null },
    claimedClears: [],
  };
}

/**
 * v3 → v4: the energy hook was never live, so daily allowances start fresh
 * (full Energy, all dungeon entitlements). v3 clear ids predate numbered runs
 * and can never be claimed again under v4, so they are dropped and runs start
 * at 1. Level/EXP carry over and are validated against the new curve (old
 * per-level costs were all lower, so old progress fits). Everything else
 * (equipment, pets, crafting, warp...) is untouched.
 */
function migrateV3toV4(v3: Record<string, unknown>): Record<string, unknown> {
  const { energy: _unusedHook, claimedClears: _oldClearIds, ...rest } = v3;
  void [_unusedHook, _oldClearIds];
  return { ...rest, schemaVersion: 4, dungeonRuns: { nextSeq: 1, claimed: [] }, daily: { day: null, ...freshDaily() } };
}

// ------------------------------------------------------------ validation

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function primary(v: unknown, what: string): PrimaryStats {
  if (!isObject(v)) throw new SaveError(`${what} missing`);
  const out = zeroPrimary();
  for (const stat of PRIMARY_STATS) {
    if (!isCount(v[stat])) throw new SaveError(`${what}.${stat} invalid`);
    out[stat] = v[stat];
  }
  return out;
}

function partialPrimary(v: unknown, what: string): Partial<PrimaryStats> {
  if (!isObject(v)) throw new SaveError(`${what} invalid`);
  const out: Partial<PrimaryStats> = {};
  for (const [key, value] of Object.entries(v)) {
    if (!isPrimaryStat(key) || typeof value !== 'number' || !Number.isInteger(value)) throw new SaveError(`${what}.${key} invalid`);
    out[key] = value;
  }
  return out;
}

function record<T>(v: unknown, what: string, check: (x: unknown) => x is T): Record<string, T> {
  if (!isObject(v)) throw new SaveError(`${what} invalid`);
  for (const [k, x] of Object.entries(v)) if (!check(x)) throw new SaveError(`${what}.${k} invalid`);
  return { ...(v as Record<string, T>) };
}

function uniqueStrings(v: unknown, what: string, allowed?: (s: string) => boolean): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && x.length > 0)) throw new SaveError(`${what} invalid`);
  if (new Set(v).size !== v.length) throw new SaveError(`${what} has duplicates`);
  if (allowed && !v.every(allowed)) throw new SaveError(`${what} has unknown ids`);
  return [...v];
}

function validateEnchantLine(raw: unknown, defId: string, what: string): EnchantLine {
  if (!isObject(raw) || typeof raw.optionId !== 'string' || typeof raw.quality !== 'string' || !isFiniteNumber(raw.value)) {
    throw new SaveError(`${what} invalid`);
  }
  const def = EQUIPMENT_DEFS[defId];
  const option = ENCHANT_OPTIONS[raw.optionId];
  if (!option || !enchantPool(def).includes(raw.optionId)) throw new SaveError(`${what}: ${raw.optionId} cannot roll on ${defId}`);
  if (!(ENCHANT_QUALITIES as readonly string[]).includes(raw.quality)) throw new SaveError(`${what}: quality invalid`);
  const quality = raw.quality as EnchantQuality;
  if (!(ENCHANT_QUALITY_WEIGHTS[def.rarity][quality] ?? 0)) throw new SaveError(`${what}: ${quality} impossible for ${def.rarity}`);
  const [min, max] = option.ranges[quality];
  if (raw.value < min - 1e-9 || raw.value > max + 1e-9) throw new SaveError(`${what}: value out of range`);
  return { optionId: raw.optionId, quality, value: raw.value };
}

function validateEquipment(raw: unknown, classId: JobId): PlayerSave['equipment'] {
  if (!isObject(raw) || !Array.isArray(raw.items) || !isObject(raw.equipped)) throw new SaveError('equipment invalid');
  const ids = new Set<string>();
  const items = raw.items.map((x, i): EquipmentInstance => {
    const what = `equipment.items[${i}]`;
    if (!isObject(x) || typeof x.instanceId !== 'string' || !x.instanceId || typeof x.defId !== 'string') throw new SaveError(`${what} invalid`);
    const def = EQUIPMENT_DEFS[x.defId];
    if (!def) throw new SaveError(`${what}: unknown item ${x.defId}`);
    if (ids.has(x.instanceId)) throw new SaveError(`${what}: duplicate instance ${x.instanceId}`);
    ids.add(x.instanceId);
    if (!isCount(x.enhancement) || x.enhancement > MAX_ENHANCEMENT) throw new SaveError(`${what}: enhancement invalid`);
    if (typeof x.bound !== 'boolean' || !Array.isArray(x.enchants)) throw new SaveError(`${what} invalid`);
    if (x.enchants.length > ENCHANT_LINES[def.rarity]) throw new SaveError(`${what}: too many enchant lines for ${def.rarity}`);
    const enchants = x.enchants.map((l, j) => validateEnchantLine(l, x.defId as string, `${what}.enchants[${j}]`));
    if (new Set(enchants.map((l) => l.optionId)).size !== enchants.length) throw new SaveError(`${what}: duplicate enchant options`);
    return { instanceId: x.instanceId, defId: x.defId, enhancement: x.enhancement, enchants, bound: x.bound };
  });

  const equipped = emptyEquipped();
  for (const [slot, id] of Object.entries(raw.equipped)) {
    if (!(EQUIPMENT_SLOTS as readonly string[]).includes(slot)) throw new SaveError(`equipment.equipped.${slot} unknown slot`);
    if (id !== null && typeof id !== 'string') throw new SaveError(`equipment.equipped.${slot} invalid`);
    equipped[slot as EquipmentSlot] = id;
  }
  // Replay the loadout through the real rules: catches wrong slots, class
  // restrictions, duplicate instances and two-handed / off-hand conflicts.
  const check = new EquipmentManager(() => classId);
  for (const item of items) check.add(structuredClone(item));
  for (const slot of EQUIPMENT_SLOTS) {
    const id = equipped[slot];
    if (!id) continue;
    const result = check.equip(id, slot);
    if (!result.ok || result.unequipped.length) throw new SaveError(`equipment.equipped.${slot}: ${result.ok ? 'conflicts with another slot' : result.reason}`);
  }
  return { items, equipped };
}

function validatePets(raw: unknown): PlayerSave['pets'] {
  if (!isObject(raw) || !Array.isArray(raw.owned)) throw new SaveError('pets invalid');
  const ids = new Set<string>();
  const owned = raw.owned.map((x, i): PetInstance => {
    const what = `pets.owned[${i}]`;
    if (!isObject(x) || typeof x.petInstanceId !== 'string' || !x.petInstanceId) throw new SaveError(`${what} invalid`);
    if (ids.has(x.petInstanceId)) throw new SaveError(`${what}: duplicate pet`);
    ids.add(x.petInstanceId);
    if (typeof x.speciesId !== 'string' || !(x.speciesId in PET_SPECIES)) throw new SaveError(`${what}: unknown species`);
    if (!(PET_RARITIES as readonly unknown[]).includes(x.rarity)) throw new SaveError(`${what}: rarity invalid`);
    if (!isCount(x.level) || x.level < 1 || x.level > PET_MAX_LEVEL) throw new SaveError(`${what}: level invalid`);
    const m = x.mutation;
    if (!isObject(m) || typeof m.mutated !== 'boolean' || (m.variant !== null && typeof m.variant !== 'string')) throw new SaveError(`${what}: mutation invalid`);
    const passiveIds = uniqueStrings(m.passiveIds, `${what}.mutation.passiveIds`, (p) => p in PET_PASSIVES) as PetPassiveId[];
    return {
      petInstanceId: x.petInstanceId,
      speciesId: x.speciesId as PetSpeciesId,
      rarity: x.rarity as PetRarity,
      level: x.level,
      mutation: { mutated: m.mutated, passiveIds, variant: m.variant as string | null },
    };
  });
  const active = raw.activePetId;
  if (active !== null && (typeof active !== 'string' || !ids.has(active))) throw new SaveError('pets.activePetId is not an owned pet');
  return { owned, activePetId: active };
}

function validateCrafting(raw: unknown): PlayerSave['crafting'] {
  if (!isObject(raw) || !Array.isArray(raw.jobs)) throw new SaveError('crafting invalid');
  const ids = new Set<string>();
  const jobs = raw.jobs.map((x, i): CraftJob => {
    const what = `crafting.jobs[${i}]`;
    if (!isObject(x) || typeof x.jobId !== 'string' || !x.jobId || typeof x.recipeId !== 'string') throw new SaveError(`${what} invalid`);
    if (ids.has(x.jobId)) throw new SaveError(`${what}: duplicate job`);
    ids.add(x.jobId);
    const recipe = RECIPES[x.recipeId];
    if (!recipe) throw new SaveError(`${what}: unknown recipe`);
    if (!isFiniteNumber(x.startedAt) || !isFiniteNumber(x.completesAt) || x.completesAt - x.startedAt !== recipe.durationMs) {
      throw new SaveError(`${what}: timing does not match the recipe`);
    }
    if (typeof x.claimed !== 'boolean') throw new SaveError(`${what} invalid`);
    return { jobId: x.jobId, recipeId: x.recipeId, startedAt: x.startedAt, completesAt: x.completesAt, claimed: x.claimed };
  });
  return { jobs };
}

/** Quest log; missing (an earlier v4 save) = empty. Checked against the quest data. */
function validateQuestLog(raw: unknown): QuestLogState {
  if (raw === undefined) return { records: {}, tracked: [], announced: [] };
  if (!isObject(raw) || !isObject(raw.records)) throw new SaveError('questLog invalid');
  const records: QuestLogState['records'] = {};
  for (const [id, r] of Object.entries(raw.records)) {
    const def = QUESTS[id];
    if (!def) throw new SaveError(`questLog: unknown quest ${id}`);
    if (!isObject(r) || (r.status !== 'active' && r.status !== 'completed' && r.status !== 'claimed') || !Array.isArray(r.progress)) {
      throw new SaveError(`questLog.${id} invalid`);
    }
    const progress = r.progress;
    if (progress.length !== def.objectives.length) throw new SaveError(`questLog.${id}: progress does not match its objectives`);
    const need = def.objectives.map(requiredAmount);
    if (!progress.every((p, i) => isCount(p) && p <= need[i])) throw new SaveError(`questLog.${id}: progress out of range`);
    const done = progress.every((p, i) => p >= need[i]);
    if (r.status === 'active' && done) throw new SaveError(`questLog.${id}: finished but still active`);
    if (r.status !== 'active' && !done) throw new SaveError(`questLog.${id}: ${r.status} without finishing its objectives`);
    records[id] = { status: r.status, progress: [...(progress as number[])] };
  }
  const tracked = uniqueStrings(raw.tracked ?? [], 'questLog.tracked', (id) => records[id]?.status === 'active' || records[id]?.status === 'completed');
  if (tracked.length > MAX_TRACKED_QUESTS) throw new SaveError('questLog.tracked: too many tracked quests');
  const announced = uniqueStrings(raw.announced ?? [], 'questLog.announced', (id) => id in QUESTS);
  return { records, tracked, announced };
}

function validateDaily(raw: unknown): DailyRecord {
  if (!isObject(raw)) throw new SaveError('daily invalid');
  const { day, fieldEnergy, dungeonFullClaims, dungeonExtraAdded, assistRewardsClaimed } = raw;
  if (day !== null && (!Number.isInteger(day) || (day as number) < 1)) throw new SaveError('daily.day invalid');
  if (!isCount(fieldEnergy) || fieldEnergy > FIELD_ENERGY.daily) throw new SaveError('daily.fieldEnergy invalid');
  if (!isCount(dungeonExtraAdded) || dungeonExtraAdded > DUNGEON_DAILY.maxExtraFullRewards) throw new SaveError('daily.dungeonExtraAdded invalid');
  if (!isCount(dungeonFullClaims) || dungeonFullClaims > DUNGEON_DAILY.freeFullRewards + dungeonExtraAdded) {
    throw new SaveError("daily.dungeonFullClaims exceeds today's entitlement");
  }
  if (!isCount(assistRewardsClaimed) || assistRewardsClaimed > DUNGEON_DAILY.rewardedAssists) throw new SaveError('daily.assistRewardsClaimed invalid');
  return { day: day as number | null, fieldEnergy, dungeonFullClaims, dungeonExtraAdded, assistRewardsClaimed };
}

function validateDungeonRuns(raw: unknown): PlayerSave['dungeonRuns'] {
  if (!isObject(raw) || !Number.isInteger(raw.nextSeq) || (raw.nextSeq as number) < 1 || !Array.isArray(raw.claimed)) throw new SaveError('dungeonRuns invalid');
  const nextSeq = raw.nextSeq as number;
  const claimed = raw.claimed;
  if (!claimed.every((n) => Number.isInteger(n) && n >= 1 && n < nextSeq)) throw new SaveError('dungeonRuns.claimed references a run never issued');
  if (new Set(claimed).size !== claimed.length) throw new SaveError('dungeonRuns.claimed has duplicates');
  if (claimed.some((n) => n < nextSeq - DUNGEON_RUN_CLAIM_WINDOW)) throw new SaveError('dungeonRuns.claimed is outside the claim window');
  return { nextSeq, claimed: [...claimed] as number[] };
}

function validate(raw: unknown): PlayerSave {
  if (!isObject(raw)) throw new SaveError('save is not an object');
  const s = raw;
  if (typeof s.characterId !== 'string' || !s.characterId) throw new SaveError('characterId invalid');
  if (!isJobId(s.classId)) throw new SaveError('classId invalid');
  if (!isCount(s.level) || s.level < 1 || s.level > MAX_LEVEL) throw new SaveError('level invalid');
  // Never more than one level's worth: a full Overflow at the cap at most.
  if (!isCount(s.exp) || s.exp > expToNext(s.level)) throw new SaveError('exp invalid');
  if (!isObject(s.stats)) throw new SaveError('stats missing');

  const base = primary(s.stats.base, 'stats.base');
  const allocated = primary(s.stats.allocated, 'stats.allocated');
  const jobBonusesRaw = s.stats.jobBonuses;
  if (!isObject(jobBonusesRaw)) throw new SaveError('stats.jobBonuses invalid');
  const jobBonuses: Partial<Record<JobId, Partial<PrimaryStats>>> = {};
  for (const [job, bonus] of Object.entries(jobBonusesRaw)) {
    if (!isJobId(job)) throw new SaveError(`stats.jobBonuses.${job} unknown job`);
    jobBonuses[job] = partialPrimary(bonus, `stats.jobBonuses.${job}`);
  }

  const earned = Math.max(0, s.level - 1);
  const spent = PRIMARY_STATS.reduce((n, stat) => n + allocated[stat], 0);
  if (spent > earned) throw new SaveError('more stat points allocated than earned');
  if (s.unspentStatPoints !== earned - spent) throw new SaveError('unspentStatPoints does not match level and allocation');
  const levelCap = classGrowthMaxLevel(s.classId);
  if (levelCap !== null && s.level > levelCap) throw new SaveError(`level ${s.level} is above ${s.classId}'s maximum ${levelCap}`);
  if (!isCount(s.skillPointsSpent)) throw new SaveError('skillPointsSpent invalid');
  if (s.skillPointsSpent > earnedSkillPoints(s.classId, s.level)) throw new SaveError('more skill points spent than earned');

  if (!Array.isArray(s.inventory)) throw new SaveError('inventory invalid');
  const inventory = s.inventory.map((entry, i) => {
    if (!isObject(entry) || typeof entry.itemId !== 'string' || !(entry.itemId in ITEMS) || !isCount(entry.count) || entry.count < 1) {
      throw new SaveError(`inventory[${i}] invalid`);
    }
    return { itemId: entry.itemId as ItemId, count: entry.count };
  });

  const shop = s.specialShop;
  if (
    !isObject(shop) ||
    (shop.cycleId !== null && !Number.isInteger(shop.cycleId)) ||
    !isCount(shop.ticketsBought) ||
    shop.ticketsBought > SPECIAL_SHOP.randomEggTicket.limitPerCycle
  ) {
    throw new SaveError('specialShop invalid');
  }

  const warp = s.warp;
  if (!isObject(warp)) throw new SaveError('warp invalid');
  const towns = uniqueStrings(warp.towns, 'warp.towns', (t) => t in TOWNS);
  const dungeons = uniqueStrings(warp.dungeons, 'warp.dungeons', (d) => d in DUNGEON_WARPS);
  if (warp.homeTown !== null && (typeof warp.homeTown !== 'string' || !towns.includes(warp.homeTown))) throw new SaveError('warp.homeTown is not an unlocked town');

  return {
    schemaVersion: 4,
    characterId: s.characterId,
    classId: s.classId,
    level: s.level,
    exp: s.exp,
    stats: { base, allocated, jobBonuses },
    unspentStatPoints: s.unspentStatPoints,
    skillPointsSpent: s.skillPointsSpent,
    inventory,
    currencies: record(s.currencies, 'currencies', (x): x is number => isFiniteNumber(x) && x >= 0),
    equipment: validateEquipment(s.equipment, s.classId),
    pets: validatePets(s.pets),
    specialShop: { cycleId: shop.cycleId as number | null, ticketsBought: shop.ticketsBought },
    crafting: validateCrafting(s.crafting),
    warp: { towns, dungeons, homeTown: warp.homeTown as string | null },
    dungeonRuns: validateDungeonRuns(s.dungeonRuns),
    daily: validateDaily(s.daily),
    questLog: validateQuestLog(s.questLog),
    features: s.features === undefined ? [] : (uniqueStrings(s.features, 'features', isFeatureId) as FeatureId[]),
    dungeons: record(s.dungeons, 'dungeons', (x): x is PlayerSave['dungeons'][string] => isObject(x) && Array.isArray(x.cleared) && x.cleared.every((c) => typeof c === 'string')),
  };
}

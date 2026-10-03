import { isJobId, type JobId } from '../data/jobData';
import { ITEMS, type ItemId } from '../data/itemData';
import { NOVICE_BASE_STATS } from '../data/statData';
import { earnedSkillPoints } from '../progression/CharacterProgress';
import { classGrowthMaxLevel } from '../stats/classBaseStats';
import { isPrimaryStat, PRIMARY_STATS, zeroPrimary, type PrimaryStats } from '../stats/primaryStats';

/*
 * Versioned player save. Plain data with stable ids only (classId
 * "warrior", never a display name). Stores inputs, never derived values
 * like ATK or Max HP: those are recalculated on load. Shaped so the same
 * record can later live on a server.
 */

export const PLAYER_SAVE_VERSION = 2;

/**
 * v2 (current). Change from v1: `skillPoints` (unspent, never earnable in v1)
 * became `skillPointsSpent`, since earned skill points are now derived from
 * job and level. Stat inputs are unchanged; combat stats are re-derived
 * under Class Base Growth v1 on load.
 */
export interface PlayerSaveV2 {
  schemaVersion: 2;
  characterId: string;
  classId: JobId;
  level: number;
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

  /** Stackable items by stable item id. */
  inventory: { itemId: ItemId; count: number }[];
  /** Hook: equipment slot id → equipped item instance id. Slots are not designed yet. */
  equipment: Record<string, string | null>;
  /** Hook: active pet instance id. */
  activePetId: string | null;
  /** Hook: currency id → amount. */
  currencies: Record<string, number>;
  /** Hook: energy; the economy is not designed yet. */
  energy: { current: number; updatedAt: number } | null;
  /** Hook: quest id → state and objective counters. */
  quests: Record<string, { state: 'active' | 'completed'; progress: Record<string, number> }>;
  /** Hook: dungeon id → cleared difficulty ids. */
  dungeons: Record<string, { cleared: string[] }>;
}

export type PlayerSave = PlayerSaveV2;

/** v1 differs from v2 only in `skillPoints` vs `skillPointsSpent`. */
export type PlayerSaveV1 = Omit<PlayerSaveV2, 'schemaVersion' | 'skillPointsSpent'> & { schemaVersion: 1; skillPoints: number };

export class SaveError extends Error {}

/** A brand-new character's save (Lv1 Novice). */
export function newPlayerSave(characterId: string): PlayerSave {
  return {
    schemaVersion: 2,
    characterId,
    classId: 'novice',
    level: 1,
    exp: 0,
    stats: { base: { ...NOVICE_BASE_STATS }, allocated: zeroPrimary(), jobBonuses: {} },
    unspentStatPoints: 0,
    skillPointsSpent: 0,
    inventory: [],
    equipment: {},
    activePetId: null,
    currencies: {},
    energy: null,
    quests: {},
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

/** Upgrade older saves step by step to the current version, then validate. */
function migrate(raw: unknown): unknown {
  let save = raw as Record<string, unknown> | null;
  if (save?.schemaVersion === 1) save = migrateV1toV2(save);
  if (save?.schemaVersion === PLAYER_SAVE_VERSION) return save;
  throw new SaveError(`unsupported save version: ${String(save?.schemaVersion)}`);
}

/**
 * v1 → v2. v1 had no way to earn or spend skill points, so nothing was spent.
 * Everything else carries over unchanged; validation then checks the result
 * under the current rules (e.g. a class above its growth range is rejected).
 */
function migrateV1toV2(v1: Record<string, unknown>): Record<string, unknown> {
  const { skillPoints: _unspentInV1, ...rest } = v1;
  void _unspentInV1;
  return { ...rest, schemaVersion: 2, skillPointsSpent: 0 };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

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

function validate(raw: unknown): PlayerSave {
  if (!isObject(raw)) throw new SaveError('save is not an object');
  const s = raw;
  if (typeof s.characterId !== 'string' || !s.characterId) throw new SaveError('characterId invalid');
  if (!isJobId(s.classId)) throw new SaveError('classId invalid');
  if (!isCount(s.level) || s.level < 1) throw new SaveError('level invalid');
  if (!isCount(s.exp)) throw new SaveError('exp invalid');
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

  const energy = s.energy;
  if (energy !== null && !(isObject(energy) && typeof energy.current === 'number' && typeof energy.updatedAt === 'number')) {
    throw new SaveError('energy invalid');
  }
  if (s.activePetId !== null && typeof s.activePetId !== 'string') throw new SaveError('activePetId invalid');

  return {
    schemaVersion: 2,
    characterId: s.characterId,
    classId: s.classId,
    level: s.level,
    exp: s.exp,
    stats: { base, allocated, jobBonuses },
    unspentStatPoints: s.unspentStatPoints,
    skillPointsSpent: s.skillPointsSpent,
    inventory,
    equipment: record(s.equipment, 'equipment', (x): x is string | null => x === null || typeof x === 'string'),
    activePetId: s.activePetId,
    currencies: record(s.currencies, 'currencies', (x): x is number => typeof x === 'number' && Number.isFinite(x)),
    energy: energy === null ? null : { current: energy.current as number, updatedAt: energy.updatedAt as number },
    quests: record(s.quests, 'quests', (x): x is PlayerSave['quests'][string] => isObject(x) && (x.state === 'active' || x.state === 'completed') && isObject(x.progress)),
    dungeons: record(s.dungeons, 'dungeons', (x): x is PlayerSave['dungeons'][string] => isObject(x) && Array.isArray(x.cleared) && x.cleared.every((c) => typeof c === 'string')),
  };
}

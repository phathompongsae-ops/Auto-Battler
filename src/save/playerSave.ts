import { isJobId, type JobId } from '../data/jobData';
import { ITEMS, type ItemId } from '../data/itemData';
import { NOVICE_BASE_STATS } from '../data/statData';
import { isPrimaryStat, PRIMARY_STATS, zeroPrimary, type PrimaryStats } from '../stats/primaryStats';

/*
 * Versioned player save, v1. Plain data with stable ids only (classId
 * "warrior", never a display name). Stores inputs, never derived values
 * like ATK or Max HP: those are recalculated on load. Shaped so the same
 * record can later live on a server.
 */

export const PLAYER_SAVE_VERSION = 1;

export interface PlayerSaveV1 {
  schemaVersion: 1;
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
  skillPoints: number;

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

export type PlayerSave = PlayerSaveV1;

export class SaveError extends Error {}

/** A brand-new character's save (Lv1 Novice). */
export function newPlayerSave(characterId: string): PlayerSave {
  return {
    schemaVersion: 1,
    characterId,
    classId: 'novice',
    level: 1,
    exp: 0,
    stats: { base: { ...NOVICE_BASE_STATS }, allocated: zeroPrimary(), jobBonuses: {} },
    unspentStatPoints: 0,
    skillPoints: 0,
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

/**
 * Upgrade older saves step by step to the current version. v1 is the first
 * version; future versions add `case n:` steps here.
 */
function migrate(raw: unknown): unknown {
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version === PLAYER_SAVE_VERSION) return raw;
  throw new SaveError(`unsupported save version: ${String(version)}`);
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
  if (!isCount(s.skillPoints)) throw new SaveError('skillPoints invalid');

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
    schemaVersion: 1,
    characterId: s.characterId,
    classId: s.classId,
    level: s.level,
    exp: s.exp,
    stats: { base, allocated, jobBonuses },
    unspentStatPoints: s.unspentStatPoints,
    skillPoints: s.skillPoints,
    inventory,
    equipment: record(s.equipment, 'equipment', (x): x is string | null => x === null || typeof x === 'string'),
    activePetId: s.activePetId,
    currencies: record(s.currencies, 'currencies', (x): x is number => typeof x === 'number' && Number.isFinite(x)),
    energy: energy === null ? null : { current: energy.current as number, updatedAt: energy.updatedAt as number },
    quests: record(s.quests, 'quests', (x): x is PlayerSave['quests'][string] => isObject(x) && (x.state === 'active' || x.state === 'completed') && isObject(x.progress)),
    dungeons: record(s.dungeons, 'dungeons', (x): x is PlayerSave['dungeons'][string] => isObject(x) && Array.isArray(x.cleared) && x.cleared.every((c) => typeof c === 'string')),
  };
}

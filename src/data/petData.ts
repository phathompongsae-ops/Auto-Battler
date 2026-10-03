import type { PrimaryStat } from '../stats/primaryStats';
import type { StatModifier } from '../stats/modifiers';

/*
 * Pet foundation v1. Values marked DEMO are tuning placeholders.
 */

export const PET_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type PetRarity = (typeof PET_RARITIES)[number];

export const PET_MAX_LEVEL = 50;

/** Stat bonus at a level: every primary stat gets `all`; the species' main stat totals `main` (not all + main). */
export interface PetStatPoint {
  all: number;
  main: number;
}

/**
 * Level curves (interpolated between anchors, rounded to nearest).
 * Lv50 targets are LOCKED for every rarity. Legendary Lv1 / Lv25 are LOCKED.
 * Common / Rare / Epic Lv1 and Lv25 are DEMO values.
 */
export const PET_STAT_CURVES: Record<PetRarity, Record<number, PetStatPoint>> = {
  common: { 1: { all: 1, main: 2 }, 25: { all: 1, main: 3 }, 50: { all: 2, main: 5 } },
  rare: { 1: { all: 2, main: 4 }, 25: { all: 3, main: 7 }, 50: { all: 5, main: 10 } },
  epic: { 1: { all: 3, main: 6 }, 25: { all: 5, main: 10 }, 50: { all: 8, main: 15 } },
  legendary: { 1: { all: 5, main: 10 }, 25: { all: 10, main: 18 }, 50: { all: 15, main: 25 } },
};

export interface PetSpeciesDef {
  id: string;
  name: string;
  mainStat: PrimaryStat;
}

/**
 * Demo species. Future main-stat identities (not defined yet):
 * Falcon / Griffin = DEX, Lynx = AGI, Fox = LUK.
 */
const SPECIES_DEFS = {
  wolf: { id: 'wolf', name: 'Wolf', mainStat: 'str' },
  turtle: { id: 'turtle', name: 'Turtle', mainStat: 'vit' },
  dragon: { id: 'dragon', name: 'Dragon', mainStat: 'int' },
} satisfies Record<string, PetSpeciesDef>;

export type PetSpeciesId = keyof typeof SPECIES_DEFS;
export const PET_SPECIES: Record<PetSpeciesId, PetSpeciesDef> = SPECIES_DEFS;

/**
 * Mutation passives: small specialised effects, never large all-stat bonuses.
 * DEMO: one harmless passive proves the hook.
 */
export interface PetPassiveDef {
  id: string;
  name: string;
  modifier: Pick<StatModifier, 'flat' | 'percent' | 'effects'>;
}

const PASSIVE_DEFS = {
  demo_tranquil_mind: { id: 'demo_tranquil_mind', name: 'Tranquil Mind (demo)', modifier: { flat: { healPower: 0.01 } } },
} satisfies Record<string, PetPassiveDef>;

export type PetPassiveId = keyof typeof PASSIVE_DEFS;
export const PET_PASSIVES: Record<PetPassiveId, PetPassiveDef> = PASSIVE_DEFS;

// ----------------------------------------------------------------- eggs

export const EGG_TIERS = ['basic', 'fine', 'mystic', 'ancient'] as const;
export type EggTier = (typeof EGG_TIERS)[number];

/** LOCKED: pet rarity odds per egg (percent). */
export const EGG_RARITY_TABLES: Record<EggTier, Record<PetRarity, number>> = {
  basic: { common: 85, rare: 13.5, epic: 1.3, legendary: 0.2 },
  fine: { common: 55, rare: 38, epic: 6, legendary: 1 },
  mystic: { common: 15, rare: 45, epic: 35, legendary: 5 },
  ancient: { common: 0, rare: 25, epic: 60, legendary: 15 },
};

export const EGG_ITEM: Record<EggTier, 'egg_basic' | 'egg_fine' | 'egg_mystic' | 'egg_ancient'> = {
  basic: 'egg_basic',
  fine: 'egg_fine',
  mystic: 'egg_mystic',
  ancient: 'egg_ancient',
};

/**
 * Species pools (weights), so future fields / dungeons can target-farm.
 * DEMO: one even pool for the three demo species.
 */
export const PET_SPECIES_POOLS: Record<string, Partial<Record<PetSpeciesId, number>>> = {
  demo_default: { wolf: 1, turtle: 1, dragon: 1 },
};

/** Hook: chance a hatched pet is mutated. null = not designed; no mutations from eggs. */
export const EGG_MUTATION_CHANCE: number | null = null;

// --------------------------------------------- random egg ticket / shop

/** LOCKED: egg tier odds when a Random Egg Ticket is used (percent). The ticket gives an egg, never a pet. */
export const RANDOM_EGG_TICKET_TIERS: Record<EggTier, number> = { basic: 70, fine: 25, mystic: 4.5, ancient: 0.5 };

/**
 * Special Shop. LOCKED: refreshes daily at 12:00, one Random Egg Ticket per
 * refresh cycle. DEMO: the timezone (UTC+7) and the free price are
 * placeholders, and the clock is local until a server provides time.
 */
export const SPECIAL_SHOP = {
  refreshHour: 12,
  utcOffsetMinutes: 7 * 60,
  randomEggTicket: { limitPerCycle: 1, price: null as { currency: string; amount: number } | null },
} as const;

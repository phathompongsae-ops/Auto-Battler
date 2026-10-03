import { weightedPick, type Rng } from '../core/rng';
import {
  EGG_MUTATION_CHANCE,
  EGG_RARITY_TABLES,
  PET_MAX_LEVEL,
  PET_PASSIVES,
  PET_SPECIES,
  PET_SPECIES_POOLS,
  PET_STAT_CURVES,
  RANDOM_EGG_TICKET_TIERS,
  type EggTier,
  type PetPassiveId,
  type PetRarity,
  type PetSpeciesId,
  type PetStatPoint,
} from '../data/petData';
import type { IdSource } from '../equipment/factory';
import type { StatModifier } from '../stats/modifiers';
import { PRIMARY_STATS, type PrimaryStats } from '../stats/primaryStats';

/*
 * Pets v1. One active pet contributes through the 'pet' modifier source;
 * owned pets that aren't active contribute nothing. No engine code.
 */

export interface PetInstance {
  petInstanceId: string;
  speciesId: PetSpeciesId;
  rarity: PetRarity;
  level: number;
  mutation: { mutated: boolean; passiveIds: PetPassiveId[]; variant: string | null };
}

/** All / main stat bonus at the pet's level (piecewise linear between curve anchors, rounded). */
export function petStatPoint(rarity: PetRarity, level: number): PetStatPoint {
  if (!Number.isInteger(level) || level < 1 || level > PET_MAX_LEVEL) throw new Error(`pet level ${level} out of range`);
  const curve = PET_STAT_CURVES[rarity];
  const levels = Object.keys(curve).map(Number).sort((a, b) => a - b);
  const hi = levels.find((l) => l >= level) ?? levels[levels.length - 1];
  if (hi === level) return { ...curve[hi] };
  const lo = levels[levels.indexOf(hi) - 1];
  const t = (level - lo) / (hi - lo);
  return {
    all: Math.round(curve[lo].all + (curve[hi].all - curve[lo].all) * t),
    main: Math.round(curve[lo].main + (curve[hi].main - curve[lo].main) * t),
  };
}

/** Primary-stat bonus: every stat at `all`, the main stat at `main` (its final total). */
export function petPrimaryBonus(pet: PetInstance): PrimaryStats {
  const { all, main } = petStatPoint(pet.rarity, pet.level);
  const out = {} as PrimaryStats;
  for (const stat of PRIMARY_STATS) out[stat] = all;
  out[PET_SPECIES[pet.speciesId].mainStat] = main;
  return out;
}

/** The active pet as 'pet' modifiers: its stats plus one modifier per mutation passive. */
export function petModifiers(pet: PetInstance): StatModifier[] {
  const mods: StatModifier[] = [{ source: 'pet', id: `pet:${pet.petInstanceId}`, primary: petPrimaryBonus(pet) }];
  if (pet.mutation.mutated) {
    for (const passiveId of pet.mutation.passiveIds) {
      mods.push({ source: 'pet', id: `pet:${pet.petInstanceId}:${passiveId}`, ...PET_PASSIVES[passiveId].modifier });
    }
  }
  return mods;
}

/** Owned pets and the single active one. Changes replace the 'pet' modifier source. */
export class PetCollection {
  readonly owned = new Map<string, PetInstance>();
  activeId: string | null = null;

  constructor(private readonly onChange: (modifiers: StatModifier[]) => void = () => {}) {}

  add(pet: PetInstance): void {
    if (this.owned.has(pet.petInstanceId)) throw new Error(`duplicate pet ${pet.petInstanceId}`);
    petStatPoint(pet.rarity, pet.level);
    this.owned.set(pet.petInstanceId, pet);
  }

  /** Make one pet active (or none). Only it contributes stats. */
  setActive(petInstanceId: string | null): boolean {
    if (petInstanceId !== null && !this.owned.has(petInstanceId)) return false;
    this.activeId = petInstanceId;
    this.changed();
    return true;
  }

  setLevel(petInstanceId: string, level: number): boolean {
    const pet = this.owned.get(petInstanceId);
    if (!pet || !Number.isInteger(level) || level < 1 || level > PET_MAX_LEVEL) return false;
    pet.level = level;
    if (this.activeId === petInstanceId) this.changed();
    return true;
  }

  active(): PetInstance | null {
    return this.activeId ? (this.owned.get(this.activeId) ?? null) : null;
  }

  clear(): void {
    this.owned.clear();
    this.activeId = null;
    this.changed();
  }

  changed(): void {
    const pet = this.active();
    this.onChange(pet ? petModifiers(pet) : []);
  }
}

/** Pet rarity from an egg's locked table. */
export function rollPetRarity(tier: EggTier, rng: Rng): PetRarity {
  return weightedPick(EGG_RARITY_TABLES[tier], rng);
}

/** Hatch an egg: rarity from the egg table, species from a pool. Lv1, unmutated unless the hook is tuned. */
export function hatchEgg(tier: EggTier, rng: Rng, newId: IdSource, poolId = 'demo_default'): PetInstance {
  const pool = PET_SPECIES_POOLS[poolId];
  if (!pool) throw new Error(`unknown species pool ${poolId}`);
  const rarity = rollPetRarity(tier, rng);
  const speciesId = weightedPick(pool, rng);
  const mutated = EGG_MUTATION_CHANCE !== null && rng() < EGG_MUTATION_CHANCE;
  return { petInstanceId: newId(), speciesId, rarity, level: 1, mutation: { mutated, passiveIds: [], variant: null } };
}

/** A Random Egg Ticket becomes an egg tier (never a pet directly). */
export function rollTicketEggTier(rng: Rng): EggTier {
  return weightedPick(RANDOM_EGG_TICKET_TIERS, rng);
}

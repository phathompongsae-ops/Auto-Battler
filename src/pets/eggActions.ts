import type { Rng } from '../core/rng';
import { EGG_ITEM, type EggTier } from '../data/petData';
import type { IdSource } from '../equipment/factory';
import type { Inventory } from '../loot/Inventory';
import { hatchEgg, rollTicketEggTier, type PetCollection, type PetInstance } from './pets';

/** Use one Random Egg Ticket: it becomes an egg item of a rolled tier. */
export function useRandomEggTicket(inventory: Inventory, rng: Rng): { ok: true; tier: EggTier } | { ok: false; reason: 'no_ticket' } {
  if (!inventory.remove('random_egg_ticket')) return { ok: false, reason: 'no_ticket' };
  const tier = rollTicketEggTier(rng);
  inventory.add(EGG_ITEM[tier]);
  return { ok: true, tier };
}

/** Open one owned egg: consumes it and adds the hatched pet to the collection. */
export function openEgg(
  inventory: Inventory,
  pets: PetCollection,
  tier: EggTier,
  rng: Rng,
  newId: IdSource,
): { ok: true; pet: PetInstance } | { ok: false; reason: 'no_egg' } {
  if (!inventory.remove(EGG_ITEM[tier])) return { ok: false, reason: 'no_egg' };
  const pet = hatchEgg(tier, rng, newId);
  pets.add(pet);
  return { ok: true, pet };
}

import type { EventBus } from '../core/EventBus';
import type { Rng } from '../core/rng';
import type { CraftingQueue } from '../crafting/crafting';
import type { DifficultyId } from '../data/dungeonDifficulty';
import type { EquipmentSlot } from '../data/equipmentData';
import type { FeatureId } from '../data/featureData';
import type { EggTier } from '../data/petData';
import type { Location } from '../data/warpData';
import type { DungeonRun } from '../dungeon/rewards';
import type { Wallet } from '../economy/Wallet';
import { rerollEnchants } from '../equipment/enchant';
import type { EquipmentManager } from '../equipment/equipment';
import { enhanceAndReport, type EnhanceOptions } from '../equipment/enhancement';
import { randomIdSource, type IdSource } from '../equipment/factory';
import type { FeatureCheck, FeatureProgression } from '../features/FeatureProgression';
import type { Inventory } from '../loot/Inventory';
import { openEgg, useRandomEggTicket } from '../pets/eggActions';
import type { PetCollection } from '../pets/pets';
import type { SpecialShop } from '../pets/specialShop';
import { useDungeonWarp, useTownWarp, type WarpUnlocks } from '../warp/warp';
import type { GameEvents } from './GameEvents';

/** What a gated action returns when its feature is still locked. */
export type FeatureLocked = Extract<FeatureCheck, { ok: false }>;

/** World facts and effects the actions need (CombatWorld provides them; tests fake them). */
export interface PlayerActionWorld {
  location(): Location;
  /** A monster is engaging the player (warp scrolls can't be used). */
  inCombat(): boolean;
  /** Put the player on the destination map after a warp (also leaves a dungeon run when needed). */
  arrive(destination: Location, kind: 'town' | 'dungeon', leftDungeon: boolean): void;
  /** Issue a dungeon run and enter it. */
  startDungeonRun(dungeonId: string, difficulty: DifficultyId): DungeonRun;
}

export interface PlayerActionDeps {
  features: FeatureProgression;
  inventory: Inventory;
  wallet: Wallet;
  equipment: EquipmentManager;
  pets: PetCollection;
  crafting: CraftingQueue;
  shop: SpecialShop;
  warpUnlocks: WarpUnlocks;
  events: EventBus<GameEvents>;
  rng: () => Rng;
  world: PlayerActionWorld;
}

/**
 * Every player-facing system action, each validating its feature first so no
 * UI path can bypass the Demo progression gate. Behind the gate the existing
 * systems run unchanged (costs, odds, rules). Backend systems stay reachable
 * directly for tests; only these player paths are gated. Engine-free.
 */
export class PlayerActions {
  constructor(private readonly d: PlayerActionDeps) {}

  private gate(id: FeatureId): FeatureLocked | null {
    const check = this.d.features.check(id);
    return check.ok ? null : check;
  }

  equip(instanceId: string, slot?: EquipmentSlot) {
    return this.gate('equipment') ?? this.d.equipment.equip(instanceId, slot);
  }

  unequip(slot: EquipmentSlot) {
    return this.gate('equipment') ?? this.d.equipment.unequip(slot);
  }

  /** One enhancement attempt (reported for quests); balance unchanged. */
  enhance(instanceId: string, options: EnhanceOptions = {}, rng: Rng = this.d.rng()) {
    const locked = this.gate('enhancement');
    if (locked) return locked;
    const item = this.d.equipment.items.get(instanceId);
    if (!item) return { ok: false as const, reason: 'unknown_item' as const };
    const result = enhanceAndReport(item, { inventory: this.d.inventory, wallet: this.d.wallet, rng, events: this.d.events }, options);
    this.d.equipment.changed();
    return result;
  }

  rerollEnchants(instanceId: string, locked: number[] = [], rng: Rng = this.d.rng()) {
    const gated = this.gate('enchant');
    if (gated) return gated;
    const item = this.d.equipment.items.get(instanceId);
    if (!item) return { ok: false as const, reason: 'unknown_item' as const };
    const result = rerollEnchants(item, locked, { inventory: this.d.inventory, wallet: this.d.wallet, rng });
    this.d.equipment.changed();
    return result;
  }

  startCraft(recipeId: string, newId: IdSource = randomIdSource) {
    return this.gate('crafting') ?? this.d.crafting.start(recipeId, this.d.inventory, this.d.wallet, newId);
  }

  /** Claim a finished craft into the equipment bag. */
  claimCraft(jobId: string, rng: Rng = this.d.rng(), newItemId: IdSource = randomIdSource) {
    const locked = this.gate('crafting');
    if (locked) return locked;
    const result = this.d.crafting.claim(jobId, rng, newItemId);
    if (result.ok) this.d.equipment.add(result.item);
    return result;
  }

  /** Town / Dungeon Warp Scroll (the Warp feature gates scrolls only; normal portals never). */
  useWarpScroll(kind: 'town' | 'dungeon', dungeonId = '') {
    const locked = this.gate('warp');
    if (locked) return locked;
    const ctx = { location: this.d.world.location(), inCombat: this.d.world.inCombat(), inventory: this.d.inventory, unlocks: this.d.warpUnlocks };
    const result = kind === 'town' ? useTownWarp(ctx) : useDungeonWarp(ctx, dungeonId);
    if (result.ok) this.d.world.arrive(result.destination, kind, result.leftDungeon);
    return result;
  }

  enterDungeon(dungeonId: string, difficulty: DifficultyId): { ok: true; run: DungeonRun } | FeatureLocked {
    return this.gate('dungeon') ?? { ok: true, run: this.d.world.startDungeonRun(dungeonId, difficulty) };
  }

  setActivePet(petInstanceId: string | null) {
    return this.gate('pet') ?? this.d.pets.setActive(petInstanceId);
  }

  openEgg(tier: EggTier, rng: Rng = this.d.rng(), newId: IdSource = randomIdSource) {
    return this.gate('pet') ?? openEgg(this.d.inventory, this.d.pets, tier, rng, newId);
  }

  useEggTicket(rng: Rng = this.d.rng()) {
    return this.gate('pet') ?? useRandomEggTicket(this.d.inventory, rng);
  }

  buyEggTicket() {
    return this.gate('pet') ?? this.d.shop.buyRandomEggTicket(this.d.inventory, this.d.wallet);
  }
}

import type { MonsterAiState } from '../ai/MonsterBrain';
import type { GameEvents } from '../game/GameEvents';
import type { CombatWorld } from '../game/CombatWorld';
import type { ItemId } from '../data/itemData';
import { defaultRng, seededRng } from '../core/rng';
import { MAX_ENHANCEMENT, type EquipmentSlot } from '../data/equipmentData';
import { rerollEnchants } from '../equipment/enchant';
import { attemptEnhancement, enhancementVfxTier, type EnhanceOptions } from '../equipment/enhancement';
import { createEquipment } from '../equipment/factory';
import { evaluateSets } from '../equipment/sets';
import { EGG_ITEM, type EggTier, type PetPassiveId, type PetRarity, type PetSpeciesId } from '../data/petData';
import { openEgg, useRandomEggTicket } from '../pets/eggActions';
import type { PetInstance } from '../pets/pets';
import { shopCycleId } from '../pets/specialShop';

let devPetCounter = 0;
import type { WorldOverlays } from '../rendering/WorldOverlays';
import { finalPrimary } from '../stats/modifiers';
import { playerDerivedStats } from '../stats/playerCombatStats';
import type { PrimaryStat } from '../stats/primaryStats';

export interface EventRecord {
  type: keyof GameEvents;
  t: number;
  source?: string;
  target?: string;
  entity?: string;
  skill?: string;
  amount?: number;
  crit?: boolean;
  reason?: string;
  level?: number;
  item?: string;
}

/**
 * Dev-only hooks for browser tests and manual debugging. Never included in
 * production behaviour (only attached when import.meta.env.DEV).
 */
export function createDevApi(world: CombatWorld, overlays: WorldOverlays) {
  const log: EventRecord[] = [];
  const record = (type: keyof GameEvents, extra: Omit<EventRecord, 'type' | 't'>) =>
    log.push({ type, t: world.now, ...extra });

  const ev = world.events;
  ev.on('damage', (e) => record('damage', { source: e.sourceId, target: e.targetId, skill: e.skillId, amount: e.amount, crit: e.crit }));
  ev.on('heal', (e) => record('heal', { target: e.targetId, amount: e.amount }));
  ev.on('miss', (e) => record('miss', { source: e.sourceId, target: e.targetId, skill: e.skillId }));
  ev.on('death', (e) => record('death', { entity: e.entityId, source: e.killerId ?? undefined }));
  ev.on('respawn', (e) => record('respawn', { entity: e.entityId }));
  ev.on('skillUsed', (e) => record('skillUsed', { source: e.casterId, skill: e.skillId, target: e.targetId ?? undefined }));
  ev.on('skillFailed', (e) => record('skillFailed', { source: e.casterId, skill: e.skillId, reason: e.reason }));
  ev.on('hitCancelled', (e) => record('hitCancelled', { source: e.casterId, target: e.targetId, skill: e.skillId, reason: e.reason }));
  ev.on('projectileSpawned', (e) => record('projectileSpawned', { source: e.ownerId, skill: e.skillId }));
  ev.on('projectileRemoved', (e) => record('projectileRemoved', { skill: e.skillId, reason: e.reason }));
  ev.on('statusApplied', (e) => record('statusApplied', { target: e.targetId, skill: e.statusId }));
  ev.on('statusExpired', (e) => record('statusExpired', { target: e.targetId, skill: e.statusId }));
  ev.on('expGained', (e) => record('expGained', { entity: e.entityId, amount: e.amount }));
  ev.on('levelUp', (e) => record('levelUp', { entity: e.entityId, level: e.level }));
  ev.on('lootDropped', (e) => record('lootDropped', { item: e.itemId }));
  ev.on('lootPicked', (e) => record('lootPicked', { item: e.itemId }));
  ev.on('lootExpired', (e) => record('lootExpired', { item: e.itemId }));
  ev.on('targetChanged', (e) => record('targetChanged', { target: e.targetId ?? undefined }));

  const monster = (id: string) => {
    const m = world.monsters.find((x) => x.id === id);
    if (!m) throw new Error(`No monster ${id}`);
    return m;
  };

  const api = {
    world,
    log,
    clearLog: () => (log.length = 0),
    setPeaceful: (on: boolean) => (world.peaceful = on),
    setRng: (value: number | null) => world.setRng(value === null ? Math.random : () => value),
    teleportPlayer: (x: number, y: number) => world.player.body.reset(x, y),
    setPlayerHp: (hp: number) => (world.player.combat.hp = hp),
    setPlayerMp: (mp: number) => (world.player.combat.mp = mp),
    resetCooldowns: () => world.player.combat.cooldowns.clear(),
    selectTarget: (id: string | null) => world.targeting.select(id ? monster(id) : null),
    isHighlighted: (id: string) => overlays.isHighlighted(monster(id)),
    monster: (id: string) => {
      const m = monster(id);
      return {
        id: m.id,
        x: m.x,
        y: m.y,
        spawnX: m.spawnX,
        spawnY: m.spawnY,
        hp: m.combat.hp,
        maxHp: m.combat.stats.maxHp,
        dead: m.combat.dead,
        state: m.brain.state as MonsterAiState,
        visible: m.visible,
      };
    },
    /** Move a monster (and optionally its spawn) and reset it to idle. */
    placeMonster: (id: string, x: number, y: number, setSpawn = false) => {
      const m = monster(id);
      if (setSpawn) {
        m.spawnX = x;
        m.spawnY = y;
      }
      if (m.combat.dead) m.respawn();
      m.body.reset(x, y);
      m.brain.setState('idle', world.now);
    },
    setMonsterHp: (id: string, hp: number) => (monster(id).combat.hp = hp),
    player: () => {
      const p = world.player;
      const c = p.combat;
      return {
        x: p.x,
        y: p.y,
        state: p.state,
        facing: p.facing,
        hp: c.hp,
        mp: c.mp,
        dead: c.dead,
        level: c.level,
        exp: c.exp,
        stats: { ...c.stats },
        statuses: c.statuses.map((s) => s.def.id),
        cooldowns: Object.fromEntries([...c.cooldowns].map(([k, v]) => [k, Math.max(0, v - world.now)])),
        target: world.targeting.current?.id ?? null,
        inventory: Object.fromEntries(world.inventory.entries()),
        respawnAt: world.playerRespawnAt,
      };
    },
    /** Persistent stat inputs, points and derived stats. */
    progress: () => {
      const p = world.player;
      const level = p.combat.level;
      return {
        ...p.progress.toData(),
        level,
        earnedStatPoints: p.progress.earned(level),
        spentStatPoints: p.progress.spent(),
        remainingStatPoints: p.progress.remaining(level),
        earnedSkillPoints: p.progress.earnedSkillPoints(level),
        remainingSkillPoints: p.progress.remainingSkillPoints(level),
        final: finalPrimary([...p.progress.modifiers(), ...p.statModifiers.list()]),
        derived: playerDerivedStats(p.progress, level, p.statModifiers.list(), p.combat.statuses),
      };
    },
    /** Jump to a level (no EXP, no level-up events); stats refresh. */
    setLevel: (level: number) => {
      world.player.combat.level = level;
      world.player.combat.exp = 0;
      world.player.combat.refreshStats();
    },
    allocateStat: (stat: PrimaryStat, amount: number) => world.allocatePlayerStat(stat, amount),
    changeJob: (jobId: string) => world.changePlayerJob(jobId),
    grantItem: (itemId: ItemId, amount = 1) => world.inventory.add(itemId, amount),
    grantGold: (amount: number) => world.wallet.add('gold', amount),

    // --- Pets, eggs, shop (dev only) ---------------------------------------
    grantPet: (speciesId: PetSpeciesId, rarity: PetRarity, level = 1, passiveIds: PetPassiveId[] = []) => {
      const pet: PetInstance = {
        petInstanceId: `dev-pet-${++devPetCounter}`,
        speciesId,
        rarity,
        level,
        mutation: { mutated: passiveIds.length > 0, passiveIds, variant: null },
      };
      world.player.pets.add(pet);
      return pet.petInstanceId;
    },
    setPetLevel: (petInstanceId: string, level: number) => world.player.pets.setLevel(petInstanceId, level),
    activatePet: (petInstanceId: string | null) => world.player.pets.setActive(petInstanceId),
    pets: () => ({ active: world.player.pets.activeId, owned: [...world.player.pets.owned.values()] }),
    grantEgg: (tier: EggTier, amount = 1) => world.inventory.add(EGG_ITEM[tier], amount),
    openEgg: (tier: EggTier, seed = 1) => openEgg(world.inventory, world.player.pets, tier, seededRng(seed), () => `dev-pet-${++devPetCounter}`),
    grantEggTicket: (amount = 1) => world.inventory.add('random_egg_ticket', amount),
    buyEggTicket: () => world.specialShop.buyRandomEggTicket(world.inventory, world.wallet),
    useEggTicket: (seed = 1) => useRandomEggTicket(world.inventory, seededRng(seed)),
    shop: () => ({ ...world.specialShop.state, ticketsLeft: world.specialShop.ticketsLeft(), cycleId: shopCycleId(world.clock.now()) }),
    /** Move the game clock (shop refresh / crafting) forward by `ms`. */
    advanceClock: (ms: number) => world.clock.advance(ms),

    // --- Equipment (dev only) ---------------------------------------------
    /** New item with enchants rolled from `seed`; returns its instance id. */
    grantEquipment: (defId: string, seed = 1) => {
      const item = createEquipment(defId, seededRng(seed));
      world.player.equipment.add(item);
      return item.instanceId;
    },
    equip: (instanceId: string, slot?: EquipmentSlot) => world.player.equipment.equip(instanceId, slot),
    unequip: (slot: EquipmentSlot) => world.player.equipment.unequip(slot),
    /** Test-only: set an item's enhancement directly (0..15). */
    setEnhancement: (instanceId: string, level: number) => {
      const item = world.player.equipment.items.get(instanceId);
      if (!item || !Number.isInteger(level) || level < 0 || level > MAX_ENHANCEMENT) return false;
      item.enhancement = level;
      world.player.equipment.changed();
      return true;
    },
    /** One enhancement attempt; `roll` fixes the success roll (0..1) for deterministic tests. */
    enhance: (instanceId: string, options: EnhanceOptions & { roll?: number } = {}) => {
      const item = world.player.equipment.items.get(instanceId);
      if (!item) return { ok: false, reason: 'unknown_item' };
      const rng = options.roll === undefined ? defaultRng : () => options.roll as number;
      const result = attemptEnhancement(item, { inventory: world.inventory, wallet: world.wallet, rng }, options);
      world.player.equipment.changed();
      return result;
    },
    rerollEnchants: (instanceId: string, locked: number[] = [], seed = 1) => {
      const item = world.player.equipment.items.get(instanceId);
      if (!item) return { ok: false, reason: 'unknown_item' };
      const result = rerollEnchants(item, locked, { inventory: world.inventory, wallet: world.wallet, rng: seededRng(seed) });
      world.player.equipment.changed();
      return result;
    },
    equipment: () => {
      const eq = world.player.equipment;
      const sets = evaluateSets(eq.equipped, eq.items);
      return {
        equipped: { ...eq.equipped },
        items: [...eq.items.values()].map((i) => ({ ...i, vfxTier: enhancementVfxTier(i.enhancement) })),
        setCounts: sets.counts,
        activeSets: sets.active.map((a) => `${a.setId}:${a.threshold}`),
        gold: world.wallet.get('gold'),
      };
    },
    /** Serialized player save (JSON string). */
    save: () => world.savePlayer(),
    /** Load a save string; returns { ok } or { ok: false, error }. */
    load: (text: string) => {
      try {
        world.loadPlayer(text);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e instanceof Error ? e.message : e) };
      }
    },
    useItem: (itemId: string) => world.usePlayerItem(itemId),
    drops: () => world.loot.drops.map((d) => ({ id: d.id, item: d.itemId, x: d.x, y: d.y })),
    projectiles: () => world.projectiles.active.length,
    projectilePositions: () => world.projectiles.active.map((p) => ({ id: p.id, x: p.x, y: p.y })),
    /** Simulation clock, freeze state and whether physics is paused. */
    clock: () => ({
      now: world.now,
      frozen: world.frozen,
      physicsPaused: world.player.scene.physics.world.isPaused,
    }),
    hitStop: (ms: number) => world.requestHitStop(ms),
    monsterIds: () => world.monsters.map((m) => m.id),
    /** Back to a clean slate: player at spawn, monsters home, nothing on the ground. */
    reset: () => {
      world.respawnPlayer();
      world.player.combat.level = 1;
      world.player.combat.exp = 0;
      world.player.progress.assign({});
      world.player.equipment.clear();
      world.player.pets.clear();
      world.specialShop.state = { cycleId: null, ticketsBought: 0 };
      world.clock.offsetMs = 0;
      world.wallet.assign({});
      world.player.statModifiers.clear();
      world.player.combat.reset();
      world.inventory.clear();
      world.loot.clear();
      world.projectiles.clear();
      world.skills.clear();
      world.targeting.select(null);
      for (const m of world.monsters) {
        m.spawnX = m.homeX;
        m.spawnY = m.homeY;
        if (m.combat.dead) m.respawn();
        m.combat.reset();
        m.snapToSpawn();
        m.brain.setState('idle', world.now);
      }
      log.length = 0;
    },
  };
  return api;
}

export type DevApi = ReturnType<typeof createDevApi>;

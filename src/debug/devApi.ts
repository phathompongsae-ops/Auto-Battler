import type { MonsterAiState } from '../ai/MonsterBrain';
import type { GameEvents } from '../game/GameEvents';
import type { CombatWorld } from '../game/CombatWorld';
import type { ItemId } from '../data/itemData';
import { defaultRng, seededRng } from '../core/rng';
import { MAX_ENHANCEMENT, type EquipmentSlot } from '../data/equipmentData';
import { rerollEnchants } from '../equipment/enchant';
import { enhancementVfxTier, type EnhanceOptions } from '../equipment/enhancement';
import type { FeatureId } from '../data/featureData';
import { createEquipment } from '../equipment/factory';
import { evaluateSets } from '../equipment/sets';
import { EGG_ITEM, type EggTier, type PetPassiveId, type PetRarity, type PetSpeciesId } from '../data/petData';
import { openEgg, useRandomEggTicket } from '../pets/eggActions';
import type { PetInstance } from '../pets/pets';
import { shopCycleId } from '../pets/specialShop';
import type { DifficultyId } from '../data/dungeonDifficulty';
import { rollBossReward, type DungeonRun } from '../dungeon/rewards';
import { freshDaily } from '../daily/DailyState';
import { earnedStatPoints } from '../progression/CharacterProgress';
import type { Location } from '../data/warpData';
import type { RewardZone } from '../energy/fieldEnergy';
import { FIELD_ENERGY } from '../data/energyData';
import { expToNext } from '../progression/expCurve';
import { defaultUnlocks, locationKind, useDungeonWarp, useTownWarp } from '../warp/warp';
import { PROTOTYPE_MAP_ID } from '../data/navigation/demoNavigation';
import { CLASS_1_JOB_CHANGE } from '../data/jobChangeData';
import { QUESTS } from '../data/questData';
import { passiveModifiers } from '../skills/skillTreeRules';
import type { SkillId } from '../data/skillData';

let devPetCounter = 0;
let devJobCounter = 0;
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
  discarded?: number;
  rewarded?: boolean;
  energySpent?: number;
  energyLeft?: number;
  quest?: string;
  status?: string;
}

/**
 * Dev-only hooks for browser tests and manual debugging. Never included in
 * production behaviour (only attached when import.meta.env.DEV).
 */
/** The Job Trial quest chain, following nextQuestIds from the configured first quest. */
function jobTrialChain(): string[] {
  const chain: string[] = [];
  for (let id: string | undefined = CLASS_1_JOB_CHANGE.firstQuestId; id && QUESTS[id] && !chain.includes(id); id = QUESTS[id].nextQuestIds?.[0]) chain.push(id);
  return chain;
}

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
  ev.on('expGained', (e) => record('expGained', { entity: e.entityId, amount: e.amount, discarded: e.discarded }));
  ev.on('fieldReward', (e) => record('fieldReward', { entity: e.monsterId, rewarded: e.rewarded, energySpent: e.energySpent, energyLeft: e.energyLeft }));
  ev.on('levelUp', (e) => record('levelUp', { entity: e.entityId, level: e.level }));
  ev.on('lootDropped', (e) => record('lootDropped', { item: e.itemId }));
  ev.on('lootPicked', (e) => record('lootPicked', { item: e.itemId }));
  ev.on('lootExpired', (e) => record('lootExpired', { item: e.itemId }));
  ev.on('targetChanged', (e) => record('targetChanged', { target: e.targetId ?? undefined }));
  ev.on('questAvailable', (e) => record('questAvailable', { quest: e.questId }));
  ev.on('questProgress', (e) => record('questProgress', { quest: e.questId, amount: e.current }));
  ev.on('questCompleted', (e) => record('questCompleted', { quest: e.questId }));
  ev.on('questClaimed', (e) => record('questClaimed', { quest: e.questId }));
  ev.on('featureUnlocked', (e) => record('featureUnlocked', { item: e.featureId }));
  ev.on('jobChanged', (e) => record('jobChanged', { entity: e.entityId, item: e.jobId }));
  ev.on('jobQuestAvailable', (e) => record('jobQuestAvailable', { quest: e.questId }));
  ev.on('jobTrialCompleted', (e) => record('jobTrialCompleted', { quest: e.questId }));
  ev.on('jobSelectionAvailable', () => record('jobSelectionAvailable', {}));
  ev.on('navigationChanged', (e) => record('navigationChanged', { target: e.targetId ?? undefined, status: e.status, reason: e.reason ?? undefined }));
  ev.on('mapChanged', (e) => record('mapChanged', { target: e.toMapId, item: e.portalId }));
  ev.on('locationReached', (e) => record('locationReached', { target: e.locationId }));

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
    /** Grant EXP through the real rules (level cap, Overflow, level-up events). */
    grantExp: (amount: number) => world.progression.grantExp(world.player, amount),
    expToNext: (level: number) => expToNext(level),
    levelInfo: () => ({
      serverDay: world.serverDay.day(),
      serverDayOverride: world.serverDay.override,
      levelCap: world.progression.levelCap(world.player),
      level: world.player.combat.level,
      exp: world.player.combat.exp,
      expToNext: expToNext(world.player.combat.level),
      overflowExp: world.progression.overflowExp(world.player),
    }),
    /**
     * Jump to a level the character could legally be (no EXP, no level-up
     * events): clamped to the effective cap (class limit / server day), and
     * refused if allocated stat or spent skill points exceed what it earns.
     */
    jumpToLevel: (level: number) => {
      const p = world.player;
      const target = Math.max(1, Math.min(Math.floor(level), world.progression.levelCap(p)));
      if (p.progress.spent() > earnedStatPoints(target)) return { ok: false as const, reason: 'allocated_stat_points_exceed_level' };
      if (p.progress.skillPointsSpent > p.progress.earnedSkillPoints(target)) return { ok: false as const, reason: 'spent_skill_points_exceed_level' };
      p.combat.level = target;
      p.combat.exp = 0;
      p.combat.refreshStats();
      p.combat.restore();
      return { ok: true as const, level: target };
    },
    /** DEV: pretend it is server day `day` (null = back to the clock). Caps rise / daily allowances reset accordingly. */
    setServerDay: (day: number | null) => (world.serverDay.override = day),
    clearServerDayOverride: () => (world.serverDay.override = null),
    fieldEnergy: () => world.fieldEnergy.current(),
    setFieldEnergy: (amount: number) => world.fieldEnergy.set(amount),
    refillFieldEnergy: () => world.fieldEnergy.set(FIELD_ENERGY.daily),
    setZone: (zone: RewardZone) => (world.zone = zone),
    /** Raw daily record (server day + every daily allowance). */
    daily: () => {
      world.daily.today(); // applies a pending day reset
      return { ...world.daily.record };
    },
    allocateStat: (stat: PrimaryStat, amount: number) => world.allocatePlayerStat(stat, amount),
    /** FORCE (dev): take a Class 1 job without the Job Trial. Same effects as the real path otherwise. */
    forceChangeJob: (jobId: string) => world.changePlayerJob(jobId, { skipTrial: true }),

    // --- Skill tree (dev only) ---------------------------------------------
    /** The current job's tree: points, every node's rank / lock reason, and the action-bar loadout. */
    skillTree: () => {
      const st = world.skillTree;
      const tree = st.tree();
      return {
        classId: world.player.progress.classId,
        treeId: tree?.id ?? null,
        usable: st.usable(),
        points: st.points(),
        nodes: (tree?.nodes ?? []).map((n) => {
          const v = st.nodeView(n.id);
          return { id: n.id, branch: n.branch, type: n.type, rank: v.rank, maxRank: n.maxRank, blockedBy: v.blockedBy, branchSpent: v.branchSpent };
        }),
        loadout: st.loadout(),
      };
    },
    /** The REAL learn path (all rules apply). */
    learnSkill: (nodeId: string) => world.skillTree.learn(nodeId),
    /** The REAL (free) reset path. */
    resetSkills: () => world.skillTree.reset(),
    /** FORCE (isolated tests only): set a rank directly, bypassing every learn rule. */
    forceSetSkillRank: (nodeId: string, rank: number) => {
      if (rank > 0) world.player.progress.skillRanks[nodeId] = rank;
      else delete world.player.progress.skillRanks[nodeId];
      world.player.combat.refreshStats();
    },
    /** Learned passives as stat modifiers. */
    passiveEffects: () => passiveModifiers(world.skillTree.tree(), world.player.progress.skillRanks),
    /** The player's version of a skill (learned rank numbers), or null if it can't be cast. */
    skillDef: (skillId: SkillId) => world.skills.definition(world.player, skillId),

    // --- Class 1 Job Change (dev only) -------------------------------------
    /** Current job, Job Change stage, trial state, Job Bonus and Class 1 Skill Points. */
    jobState: () => {
      const p = world.player;
      const level = p.combat.level;
      return {
        classId: p.progress.classId,
        stage: world.jobChange.stage(),
        trialComplete: world.jobChange.trialComplete(),
        level,
        jobBonuses: structuredClone(p.progress.jobBonuses),
        earnedSkillPoints: p.progress.earnedSkillPoints(level),
        remainingSkillPoints: p.progress.remainingSkillPoints(level),
        class1SkillsUnlocked: world.features.isFeatureUnlocked(CLASS_1_JOB_CHANGE.unlocksFeature),
        trialQuests: jobTrialChain().map((id) => ({ questId: id, status: world.quests.status(id) })),
      };
    },
    jobChoices: () => world.jobChange.choices().map((j) => ({ jobId: j.jobId, displayName: j.displayName, jobBonus: j.jobBonus, skillTreeId: j.skillTreeId })),
    /** The REAL selection path (validated: Lv11+, Novice, trial complete, once). */
    chooseJob: (jobId: string) => world.changePlayerJob(jobId),
    /**
     * FORCE (dev): run the whole Job Trial chain through real quest events
     * (start, talk, visit, kills reported as kills, claim). Requires Lv11 Novice.
     */
    forceCompleteJobTrial: () => {
      const steps: string[] = [];
      for (const questId of jobTrialChain()) {
        if (world.quests.status(questId) === 'claimed') continue;
        if (world.quests.status(questId) === 'available') world.quests.start(questId);
        for (const o of world.quests.defs[questId].objectives) {
          for (let i = 0; i < (o.count ?? 1); i++) {
            if (o.kind === 'talk') world.interactWithNpc(o.npcId);
            if (o.kind === 'visit') world.reachLocation(o.locationId);
            if (o.kind === 'kill') world.events.emit('monsterKilled', { entityId: 'dev', monsterId: o.monsterId, zone: 'field' });
          }
        }
        const claim = world.quests.claim(questId);
        steps.push(`${questId}:${claim.ok ? 'claimed' : claim.reason}`);
        if (!claim.ok) break;
      }
      return steps;
    },
    /** RESET (tests only): back to Novice with no job quests, Job Bonus or Class 1 feature. */
    resetJobChange: () => {
      const p = world.player;
      p.progress.assign({ ...p.progress.toData(), classId: 'novice', jobBonuses: {}, skillRanks: {} });
      p.equipment.revalidate();
      p.combat.refreshStats();
      const log = world.quests.toState();
      const chain = new Set(jobTrialChain());
      world.quests.load({
        records: Object.fromEntries(Object.entries(log.records).filter(([id]) => !chain.has(id))),
        tracked: log.tracked.filter((id) => !chain.has(id)),
        announced: log.announced.filter((id) => !chain.has(id)),
      });
      world.features.unlocked.delete(CLASS_1_JOB_CHANGE.unlocksFeature);
      world.quests.refresh();
    },
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

    // --- Dungeon rewards (dev only) ---------------------------------------
    /** Preview a boss reward from a fixed seed (nothing granted). */
    rollDungeonReward: (dungeonId: string, difficulty: DifficultyId, seed = 1) => rollBossReward(dungeonId, difficulty, seededRng(seed)),
    /** Enter a dungeon (issues a run; costs nothing). */
    enterDungeon: (dungeonId: string, difficulty: DifficultyId) => world.enterDungeon(dungeonId, difficulty),
    /** Leave / fail the current run without claiming (nothing is used). */
    leaveDungeon: () => world.leaveDungeon(),
    /** Boss down: claim a run (default: the current one) with rewards rolled from `seed`. Retry-safe. */
    claimDungeon: (seed = 1, run: DungeonRun | null = world.dungeonRun) => world.claimDungeonClear(run, seededRng(seed)),
    /** Enter, clear and claim in one go; returns the run (for retry tests) and the result. */
    clearDungeon: (dungeonId: string, difficulty: DifficultyId, seed = 1) => {
      const run = world.enterDungeon(dungeonId, difficulty);
      const result = world.claimDungeonClear(run, seededRng(seed));
      world.leaveDungeon();
      return { run, result };
    },
    /** Today's Full Reward / ticket / Assist state, plus the run counter. */
    dungeonStatus: () => ({ ...world.dungeonEntitlements.status(), serverDay: world.serverDay.day(), nextRun: world.rewardLedger.nextSeq, inRun: world.dungeonRun?.runId ?? null }),
    resetDungeonDaily: () => world.dungeonEntitlements.resetToday(),
    grantDungeonTicket: (amount = 1) => world.inventory.add('additional_dungeon_ticket', amount),

    // --- Quests and features (dev only) -----------------------------------
    /** Every quest with its status (locked / available / active / completed / claimed). */
    quests: () => world.quests.list(),
    questProgress: (questId: string) => ({ status: world.quests.status(questId), objectives: world.quests.progress(questId) }),
    startQuest: (questId: string) => world.quests.start(questId),
    claimQuest: (questId: string) => world.quests.claim(questId),
    trackQuest: (questId: string) => world.quests.track(questId),
    untrackQuest: (questId: string) => world.quests.untrack(questId),
    trackedQuests: () => world.quests.trackedQuestIds(),
    /** Fire the same events real NPCs / map markers will. */
    talkToNpc: (npcId: string) => world.interactWithNpc(npcId),
    reachLocation: (locationId: string) => world.reachLocation(locationId),
    /** Give an item as a gameplay acquisition (counts for collect objectives; grantItem does not). */
    acquireItem: (itemId: ItemId, amount = 1) => world.acquireItem(itemId, amount, 'dev'),
    features: () => [...world.features.unlocked],
    isFeatureUnlocked: (featureId: FeatureId) => world.quests.isFeatureUnlocked(featureId),
    /** Forget all quest progress and unlocked features, then re-announce what's available. */
    resetQuests: () => {
      world.quests.reset();
      world.features.unlocked.clear();
      world.quests.refresh();
      world.skillProcs.reset();
    },

    // --- Navigation / Auto Move (dev only) --------------------------------
    navState: () => ({ ...world.autoMove.state(), mapId: world.location.mapId, x: world.player.x, y: world.player.y }),
    navigateTo: (targetId: string) => world.autoMove.navigateTo(targetId),
    navigateToQuest: (questId: string, objectiveIndex = 0) => world.autoMove.navigateToQuestObjective(questId, objectiveIndex),
    cancelNavigation: () => world.autoMove.cancel(),
    /** Every navigation target, and whether a route reaches it from the current map. */
    navTargets: () =>
      world.navigation.all().map((t) => ({ id: t.id, type: t.type, mapId: t.mapId, x: t.x, y: t.y, reachable: !!world.navigation.route(world.location.mapId, t) })),
    /** Test setup only: put the player somewhere (and optionally on another map id) without walking. */
    teleport: (x: number, y: number, mapId?: string) => {
      if (mapId) world.location = { kind: locationKind(mapId), mapId };
      world.player.body.reset(x, y);
    },

    // --- Crafting and warp (dev only) -------------------------------------
    startCraft: (recipeId: string) => world.crafting.start(recipeId, world.inventory, world.wallet, () => `dev-job-${++devJobCounter}`),
    claimCraft: (jobId: string, seed = 1) => {
      const result = world.crafting.claim(jobId, seededRng(seed), () => `dev-craft-${devJobCounter}-${jobId}`);
      if (result.ok) world.player.equipment.add(result.item);
      return result;
    },
    craftJobs: () => structuredClone(world.crafting.jobs),
    discoverDungeon: (dungeonId: string) => world.warpUnlocks.dungeons.add(dungeonId),
    /** Try a warp scroll from a test location (maps don't exist yet). */
    warp: (kind: 'town' | 'dungeon', location: Location, options: { inCombat?: boolean; dungeonId?: string } = {}) => {
      const ctx = { location, inCombat: !!options.inCombat, inventory: world.inventory, unlocks: world.warpUnlocks };
      return kind === 'town' ? useTownWarp(ctx) : useDungeonWarp(ctx, options.dungeonId ?? '');
    },

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
    enhance: (instanceId: string, options: EnhanceOptions & { roll?: number } = {}) =>
      world.enhanceEquipment(instanceId, options, options.roll === undefined ? defaultRng : () => options.roll as number),
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
      world.rewardLedger.claimed.clear();
      world.rewardLedger.nextSeq = 1;
      world.dungeonRun = null;
      world.crafting.jobs = [];
      world.serverDay.override = null;
      world.daily.record = { day: null, ...freshDaily() };
      world.zone = 'field';
      world.autoMove.clear();
      world.location = { kind: 'field', mapId: PROTOTYPE_MAP_ID };
      world.quests.reset();
      world.features.unlocked.clear();
      world.quests.refresh();
      Object.assign(world.warpUnlocks, defaultUnlocks());
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

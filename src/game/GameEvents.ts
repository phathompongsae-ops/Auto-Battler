import type { HitCancelReason, SkillFailReason } from '../combat/SkillSystem';
import type { EntityId } from '../combat/types';
import type { ItemId } from '../data/itemData';
import type { JobId, JobTier } from '../data/jobData';
import type { DifficultyId } from '../data/dungeonDifficulty';
import type { FeatureId } from '../data/featureData';
import type { QuestType } from '../data/questData';
import type { MonsterTier } from '../data/monsterBalance';
import type { NavigationState } from '../navigation/AutoMove';
import type { SkillId } from '../data/skillData';
import type { SkillSlot } from '../data/playerData';
import type { StatusId } from '../data/statusData';

export type ProjectileEndReason = 'hit' | 'wall' | 'expired';

/**
 * Everything the simulation reports. Payloads are plain serialisable data
 * (ids and numbers, no live objects) so the same events can later be sent
 * over the network. Presentation looks entities up by id when it needs them.
 */
export type GameEvents = {
  damage: {
    sourceId: EntityId;
    targetId: EntityId;
    skillId: SkillId;
    amount: number;
    crit: boolean;
    heavy: boolean;
  };
  heal: { targetId: EntityId; amount: number };
  /** A damaging attack missed (hit roll failed); no damage and no on-hit effects. */
  miss: { sourceId: EntityId; targetId: EntityId; skillId: SkillId };
  death: { entityId: EntityId; killerId: EntityId | null };
  respawn: { entityId: EntityId };
  skillUsed: { casterId: EntityId; skillId: SkillId; targetId: EntityId | null };
  skillFailed: { casterId: EntityId; skillId: SkillId; reason: SkillFailReason };
  /** A delayed (wind-up) hit was dropped before it landed. */
  hitCancelled: { casterId: EntityId; targetId: EntityId; skillId: SkillId; reason: HitCancelReason };
  projectileSpawned: {
    projectileId: number;
    ownerId: EntityId;
    skillId: SkillId;
    x: number;
    y: number;
    radius: number;
    color: number;
  };
  projectileRemoved: {
    projectileId: number;
    skillId: SkillId;
    reason: ProjectileEndReason;
    x: number;
    y: number;
    color: number;
  };
  statusApplied: { targetId: EntityId; statusId: StatusId; expiresAt: number };
  statusExpired: { targetId: EntityId; statusId: StatusId };
  /** `amount` was kept; `discarded` was lost to a full Overflow at the level cap. */
  expGained: { entityId: EntityId; amount: number; discarded: number };
  /** A field kill's farming rewards were granted (paying Energy) or withheld (Energy empty). */
  fieldReward: { monsterId: EntityId; rewarded: boolean; energySpent: number; energyLeft: number };
  levelUp: { entityId: EntityId; level: number };
  lootDropped: { dropId: number; itemId: ItemId; x: number; y: number; expiresAt: number };
  lootPicked: { dropId: number; itemId: ItemId; byId: EntityId };
  lootExpired: { dropId: number; itemId: ItemId };
  targetChanged: { targetId: EntityId | null };
  itemUsed: { entityId: EntityId; itemId: ItemId };
  /** A job was taken (Class 1 Job Change). Quests re-check class prerequisites on it. */
  jobChanged: { entityId: EntityId; jobId: JobId; fromJobId: JobId; tier: JobTier };
  /** The Class 1 Job Quest became available (fires once). */
  jobQuestAvailable: { questId: string };
  /** The Job Trial's final quest was claimed (fires once). */
  jobTrialCompleted: { questId: string };
  /** The player may now choose a Class 1 job (fires once, right after the trial). */
  jobSelectionAvailable: { choices: JobId[] };

  // --- World interactions the Quest Engine (and later Auto Move / maps) listen to.
  /** The player interacted with an NPC. */
  npcInteracted: { npcId: string };
  /** The player reached a location / zone marker. */
  locationReached: { locationId: string };
  /** The player killed a monster (any zone; independent of reward eligibility). */
  monsterKilled: { entityId: EntityId; monsterId: string; tier: MonsterTier; zone: 'field' | 'dungeon' };
  /** Items entered the inventory through gameplay (never emitted by loading a save). */
  itemAcquired: { itemId: ItemId; amount: number; source: 'loot' | 'dungeon' | 'quest' | 'dev' };
  /** A dungeon run was cleared and its claim resolved: once per run (Full, Assist or no reward alike). */
  /** `assist`: the claim resolved as an Assist (rewarded or the unrewarded kind), not a Full Reward. */
  dungeonCleared: { runId: string; dungeonId: string; difficulty: DifficultyId; assist: boolean };
  /** An enhancement attempt was made (success or failure). */
  equipmentEnhanced: { instanceId: string; success: boolean; from: number; to: number };

  /** Auto Move state changed (started, paused/resumed, next step, arrived, cancelled, failed). */
  navigationChanged: NavigationState;
  /** The player changed map through a portal. */
  mapChanged: { fromMapId: string; toMapId: string; portalId: string };

  // --- Skill trees
  /** One rank learned. */
  skillRankChanged: { nodeId: string; rank: number; available: number };
  /** All ranks returned. */
  skillTreeReset: { refunded: number };
  /** Which skills sit on the action bar changed (learned a new active, reset, job change). */
  skillAvailabilityChanged: { loadout: Record<SkillSlot, SkillId | null> };
  /** A proc passive fired (e.g. Guardian Instinct, Battle Instinct). */
  skillProc: { entityId: EntityId; nodeId: string; statusId: StatusId };
  /** A monster was taunted (Provoke): it turns on the caster. */
  taunted: { casterId: EntityId; targetId: EntityId };

  // --- Daily Commissions / Weekly quests
  /** A Daily Commission's reward was claimed (once per quest per day). */
  dailyCommissionClaimed: { questId: string; claimedThisWeek: number };
  /** A new Daily set / Weekly cycle began. */
  recurringReset: { cycle: 'daily' | 'weekly'; cycleId: number };
  weeklyMilestoneClaimed: { milestone: number };

  // --- Quest Engine
  questAvailable: { questId: string; title: string; questType: QuestType };
  questStarted: { questId: string };
  questProgress: { questId: string; objective: number; current: number; required: number };
  /** Every objective done: ready to claim. */
  questCompleted: { questId: string };
  questClaimed: { questId: string };
  /** A feature unlocked (once). `restored`: re-established on load / migration — no player notification. */
  featureUnlocked: { featureId: FeatureId; displayName: string; description: string; restored: boolean };
};

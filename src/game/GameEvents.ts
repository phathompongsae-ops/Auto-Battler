import type { HitCancelReason, SkillFailReason } from '../combat/SkillSystem';
import type { EntityId } from '../combat/types';
import type { ItemId } from '../data/itemData';
import type { JobId } from '../data/jobData';
import type { DifficultyId } from '../data/dungeonDifficulty';
import type { FeatureId } from '../data/featureData';
import type { QuestType } from '../data/questData';
import type { NavigationState } from '../navigation/AutoMove';
import type { SkillId } from '../data/skillData';
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
  jobChanged: { entityId: EntityId; jobId: JobId };

  // --- World interactions the Quest Engine (and later Auto Move / maps) listen to.
  /** The player interacted with an NPC. */
  npcInteracted: { npcId: string };
  /** The player reached a location / zone marker. */
  locationReached: { locationId: string };
  /** The player killed a monster (any zone; independent of reward eligibility). */
  monsterKilled: { entityId: EntityId; monsterId: string; zone: 'field' | 'dungeon' };
  /** Items entered the inventory through gameplay (never emitted by loading a save). */
  itemAcquired: { itemId: ItemId; amount: number; source: 'loot' | 'dungeon' | 'quest' | 'dev' };
  /** A dungeon run was cleared and its claim resolved: once per run (Full, Assist or no reward alike). */
  dungeonCleared: { runId: string; dungeonId: string; difficulty: DifficultyId };
  /** An enhancement attempt was made (success or failure). */
  equipmentEnhanced: { instanceId: string; success: boolean; from: number; to: number };

  /** Auto Move state changed (started, paused/resumed, next step, arrived, cancelled, failed). */
  navigationChanged: NavigationState;
  /** The player changed map through a portal. */
  mapChanged: { fromMapId: string; toMapId: string; portalId: string };

  // --- Quest Engine
  questAvailable: { questId: string; title: string; questType: QuestType };
  questStarted: { questId: string };
  questProgress: { questId: string; objective: number; current: number; required: number };
  /** Every objective done: ready to claim. */
  questCompleted: { questId: string };
  questClaimed: { questId: string };
  featureUnlocked: { featureId: FeatureId };
};

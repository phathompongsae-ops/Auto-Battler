import type { HitCancelReason, SkillFailReason } from '../combat/SkillSystem';
import type { EntityId } from '../combat/types';
import type { ItemId } from '../data/itemData';
import type { JobId } from '../data/jobData';
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
  expGained: { entityId: EntityId; amount: number };
  levelUp: { entityId: EntityId; level: number };
  lootDropped: { dropId: number; itemId: ItemId; x: number; y: number; expiresAt: number };
  lootPicked: { dropId: number; itemId: ItemId; byId: EntityId };
  lootExpired: { dropId: number; itemId: ItemId };
  targetChanged: { targetId: EntityId | null };
  itemUsed: { entityId: EntityId; itemId: ItemId };
  jobChanged: { entityId: EntityId; jobId: JobId };
};

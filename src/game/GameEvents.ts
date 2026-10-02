import type { Projectile } from '../combat/ProjectileSystem';
import type { SkillFailReason } from '../combat/SkillSystem';
import type { CombatEntity } from '../combat/types';
import type { SkillDef } from '../data/skillData';
import type { StatusDef } from '../data/statusData';
import type { LootDrop } from '../loot/LootSystem';

/**
 * Everything the simulation reports. Presentation (effects, HUD, sound) and
 * later the network layer subscribe to these instead of reaching into systems.
 */
export type GameEvents = {
  damage: {
    source: CombatEntity;
    target: CombatEntity;
    skill: SkillDef;
    amount: number;
    crit: boolean;
    heavy: boolean;
  };
  heal: { target: CombatEntity; amount: number };
  death: { entity: CombatEntity; killer: CombatEntity | null };
  respawn: { entity: CombatEntity };
  skillUsed: { caster: CombatEntity; skill: SkillDef; target: CombatEntity | null };
  skillFailed: { caster: CombatEntity; skill: SkillDef; reason: SkillFailReason };
  projectileSpawned: { projectile: Projectile };
  projectileRemoved: { projectile: Projectile; reason: 'hit' | 'wall' | 'expired' };
  statusApplied: { target: CombatEntity; status: StatusDef; expiresAt: number };
  statusExpired: { target: CombatEntity; status: StatusDef };
  expGained: { entity: CombatEntity; amount: number };
  levelUp: { entity: CombatEntity; level: number };
  lootDropped: { drop: LootDrop };
  lootPicked: { drop: LootDrop; by: CombatEntity };
  lootExpired: { drop: LootDrop };
  targetChanged: { target: CombatEntity | null };
};

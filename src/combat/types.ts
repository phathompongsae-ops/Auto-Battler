import type { CombatantState } from './CombatantState';

export interface CombatStats {
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  moveSpeed: number; // pixels per second
  critChance: number; // 0..1
  critMultiplier: number;
  mpRegen: number; // MP per second
}

export type StatKey = keyof CombatStats;

export type Team = 'player' | 'monster';

/** Stable identifier for a combat entity ('player', 'slime-1', ...). */
export type EntityId = string;

/** Anything that can take part in combat. Implemented by game entities. */
export interface CombatEntity {
  readonly id: EntityId;
  readonly combat: CombatantState;
  readonly x: number;
  readonly y: number;
  /** Radius used for range checks and projectile hits. */
  readonly hitRadius: number;
}

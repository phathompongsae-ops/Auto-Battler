import type { CombatantState } from './CombatantState';

/**
 * Live combat numbers for one entity. For the player they are derived from
 * primary stats (src/stats); monsters supply them from data. Percent-type
 * values are fractions (0.05 = 5%).
 */
export interface CombatStats {
  maxHp: number;
  maxMp: number;
  /** Physical ATK. */
  attack: number;
  /** Magic ATK. */
  magicAttack: number;
  /** Physical defense. */
  defense: number;
  /** Magic defense. */
  magicDefense: number;
  /** Added to the 95% base hit chance. */
  accuracy: number;
  /** Subtracted from an attacker's hit chance. */
  evasion: number;
  /** Basic-attack speed bonus: interval = base / (1 + attackSpeed). */
  attackSpeed: number;
  critChance: number; // 0..1
  /** Damage multiplier on a crit (1.5 = 150%). */
  critMultiplier: number;
  /** Cast-time modifier; negative is faster. */
  castTime: number;
  /** Healing bonus: 0.04 = +4%. */
  healPower: number;
  moveSpeed: number; // pixels per second
  mpRegen: number; // MP per second
  /** Fraction of incoming damage removed after mitigation and crit (capped in combatRules). */
  damageReduction: number;
  /** Extra outgoing Physical damage fraction (e.g. Battle Instinct +0.1). Missing = 0. */
  physicalDamageBonus?: number;
  /** Skill id → extra damage fraction for that skill (e.g. a set bonus). */
  skillDamageBonus: Readonly<Record<string, number>>;
  /** Skill id → cooldown reduction fraction for that skill. Never applies to ASPD-based attacks. */
  skillCooldownReduction: Readonly<Record<string, number>>;
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

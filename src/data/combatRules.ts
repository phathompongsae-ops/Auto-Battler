/*
 * Locked combat rules v1. Formulas live in src/combat; numbers live here.
 */

/** Hit chance = BASE + attacker accuracy - defender evasion, clamped. */
export const HIT_CHANCE = { base: 0.95, min: 0.7, max: 1 } as const;

/** Crits deal 150% before the attacker's crit-damage bonus. */
export const BASE_CRIT_MULTIPLIER = 1.5;

/** Mitigation: damage × MITIGATION_SCALE / (MITIGATION_SCALE + DEF or MDEF). */
export const MITIGATION_SCALE = 100;

/**
 * Basic-attack interval safety: interval = base / (1 + attackSpeed), never
 * below this many ms however extreme a build gets. Not a tuned endgame cap.
 */
export const MIN_ATTACK_INTERVAL_MS = 100;

/** Damage reduction from gear/effects never exceeds this fraction (safety cap, not a tuned value). */
export const MAX_DAMAGE_REDUCTION = 0.5;

/** Skill cooldown reduction from gear/effects never exceeds this fraction (safety cap). */
export const MAX_SKILL_COOLDOWN_REDUCTION = 0.5;

/** Casts never get shorter than this, however much cast-time reduction stacks. */
export const MIN_CAST_TIME_MS = 0;

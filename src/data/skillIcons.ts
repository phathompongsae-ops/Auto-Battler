import type { SkillId } from './skillData';

/*
 * Illustrated active-skill icons (Visual Production Pass 2; reviewed
 * candidates, faint outer glow trimmed, 96 px). Symbol only: the medallion
 * rim, key hint, cooldown sweep and lock states stay native HUD elements.
 * Skills not listed (basic attack, passives, monster skills) keep their
 * vector glyph.
 */
const DIR = 'assets/ui/skills';

export const SKILL_ICONS: Partial<Record<SkillId, string>> = {
  power_strike: `${DIR}/power_strike.png`,
  fire_bolt: `${DIR}/fire_bolt.png`,
  guard: `${DIR}/guard.png`,
  charge: `${DIR}/charge.png`,
  shield_bash: `${DIR}/shield_bash.png`,
  provoke: `${DIR}/provoke.png`,
  iron_guard: `${DIR}/iron_guard.png`,
  whirlwind: `${DIR}/whirlwind.png`,
  heavy_strike: `${DIR}/heavy_strike.png`,
  berserk: `${DIR}/berserk.png`,
};

import type { SkillId } from './skillData';

/*
 * Illustrated active-skill icons (Visual Production Pass 2; reviewed
 * candidates, faint outer glow trimmed, 96 px). Symbol only: the medallion
 * rim, key hint, cooldown sweep and lock states stay native HUD elements.
 * Skills not listed (the melee basic attack, monster skills) keep their
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
  // Mage (docs/art/mage-codex-handoff.md): Magic Bolt is the Mage's ATK face.
  magic_bolt: `${DIR}/magic_bolt.png`,
  fireball: `${DIR}/fireball.png`,
  flame_burst: `${DIR}/flame_burst.png`,
  frost_nova: `${DIR}/frost_nova.png`,
  frost_storm: `${DIR}/frost_storm.png`,
  meteor_burst: `${DIR}/meteor_burst.png`,
};

/**
 * Illustrated passive icons by skill-tree node id (muted emblem PNGs, 96 px). Passives not listed keep their
 * code-drawn plate (ui/art/iconArt.ts).
 */
export const PASSIVE_ICONS: Readonly<Record<string, string>> = {
  arcane_power: `${DIR}/passive/arcane_power.png`,
  mana_flow: `${DIR}/passive/mana_flow.png`,
  elemental_mastery: `${DIR}/passive/elemental_mastery.png`,
};

import { WARRIOR_ART } from './characterArt';

/*
 * DEMO / DEV presentation for the current playable build.
 *
 * Progression truth: a new character is a Lv1 Novice until a real job change
 * at Lv11. The demo nevertheless shows the Warrior sprites and plays the
 * Warrior demo kit (PLAYER_LOADOUT: Power Strike, Fire Bolt, Guard) because
 * no Novice art, Novice skills or job-change flow exist yet.
 *
 * None of this is the character's class: it isn't saved, grants no Job
 * Bonus and uses Novice stats. Remove it once Novice art/skills exist.
 */
export const DEMO_PLAYER_PRESENTATION = {
  /** Sprite set drawn for the player regardless of class. */
  art: WARRIOR_ART,
  /** Label for the kit, for debug readouts; the skills themselves are PLAYER_LOADOUT. */
  kit: 'warrior-demo',
} as const;

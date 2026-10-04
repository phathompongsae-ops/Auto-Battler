import { WARRIOR_ART, type CharacterArt } from './characterArt';
import type { JobId } from './jobData';

/*
 * How each class is drawn and which skill kit it plays. Presentation only:
 * the character's real class, Job Bonus and stats always come from its saved
 * job, never from here.
 *
 * Only Warrior has real art and a real kit. Every other class (Novice before
 * the Lv11 Job Change, and Archer / Mage / Cleric / Ninja until their art and
 * skills exist) uses an explicit TEMPORARY DEMO FALLBACK: the Warrior sprites
 * and the Warrior demo kit (PLAYER_LOADOUT: Power Strike, Fire Bolt, Guard).
 * Replace a class's entry when its art/skills land.
 */
export interface ClassPresentation {
  art: CharacterArt;
  /** Label for the skill kit (debug readouts); the skills themselves are PLAYER_LOADOUT for now. */
  kit: string;
  /** True while this class borrows another class's presentation. */
  temporaryFallback: boolean;
}

const WARRIOR: ClassPresentation = { art: WARRIOR_ART, kit: 'warrior', temporaryFallback: false };
/** TEMPORARY DEMO FALLBACK (see above). */
const DEMO_FALLBACK: ClassPresentation = { art: WARRIOR_ART, kit: 'warrior-demo', temporaryFallback: true };

export const CLASS_PRESENTATION: Record<JobId, ClassPresentation> = {
  novice: DEMO_FALLBACK,
  warrior: WARRIOR,
  archer: DEMO_FALLBACK,
  mage: DEMO_FALLBACK,
  cleric: DEMO_FALLBACK,
  ninja: DEMO_FALLBACK,
};

export function presentationFor(classId: JobId): ClassPresentation {
  return CLASS_PRESENTATION[classId];
}

/** Every sprite set some class may use (preloaded at boot). */
export const PRESENTATION_ARTS: readonly CharacterArt[] = [...new Set(Object.values(CLASS_PRESENTATION).map((p) => p.art))];

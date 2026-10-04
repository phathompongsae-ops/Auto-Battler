import { ARCHER_ART, CLERIC_ART, MAGE_ART, NINJA_ART, WARRIOR_ART, type CharacterArt } from './characterArt';
import type { JobId } from './jobData';

/*
 * How each class is drawn and which skill kit it plays. Presentation only:
 * the character's real class, Job Bonus and stats always come from its saved
 * job, never from here.
 *
 * Every Class 1 job has its own production art. Only Warrior has a real kit:
 * Archer / Mage / Cleric / Ninja still play the TEMPORARY Warrior demo kit
 * (PLAYER_LOADOUT: Power Strike, Fire Bolt, Guard) until their skill trees
 * exist. Novice has no art of its own and borrows the Warrior's (explicit
 * TEMPORARY DEMO FALLBACK) until the Lv11 Job Change.
 */
export interface ClassPresentation {
  art: CharacterArt;
  /** Label for the skill kit (debug readouts); the skills themselves are PLAYER_LOADOUT for now. */
  kit: string;
  /** True while this class borrows another class's art. */
  temporaryFallback: boolean;
  /** True while this class plays the Warrior demo kit instead of its own skills. */
  temporaryKit: boolean;
}

const WARRIOR: ClassPresentation = { art: WARRIOR_ART, kit: 'warrior', temporaryFallback: false, temporaryKit: false };
/** TEMPORARY DEMO FALLBACK (see above). */
const NOVICE_FALLBACK: ClassPresentation = { art: WARRIOR_ART, kit: 'warrior-demo', temporaryFallback: true, temporaryKit: true };
/** Real art, TEMPORARY demo kit. */
const ownArtDemoKit = (art: CharacterArt): ClassPresentation => ({ art, kit: 'warrior-demo', temporaryFallback: false, temporaryKit: true });

export const CLASS_PRESENTATION: Record<JobId, ClassPresentation> = {
  novice: NOVICE_FALLBACK,
  warrior: WARRIOR,
  archer: ownArtDemoKit(ARCHER_ART),
  mage: ownArtDemoKit(MAGE_ART),
  cleric: ownArtDemoKit(CLERIC_ART),
  ninja: ownArtDemoKit(NINJA_ART),
};

export function presentationFor(classId: JobId): ClassPresentation {
  return CLASS_PRESENTATION[classId];
}

/** Every sprite set some class may use (preloaded at boot). */
export const PRESENTATION_ARTS: readonly CharacterArt[] = [...new Set(Object.values(CLASS_PRESENTATION).map((p) => p.art))];

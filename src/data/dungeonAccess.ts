import { CRYPT_MAP_ID } from './maps';

/*
 * Dungeon entry requirements, by destination map. Checked whenever the
 * player would ENTER the map from outside it (its gate portal, walked or
 * taken by Auto Move, or a Dungeon Warp Scroll); never on load, so a save
 * already inside a dungeon stays valid. Data only: the check lives in
 * world/dungeonAccess.ts.
 */

export interface DungeonAccessRule {
  /** Destination map this rule guards. */
  mapId: string;
  /** Shown in messages ("the Sunken Crypt"). */
  displayName: string;
  /** Minimum character level (inclusive). */
  minimumLevel: number;
  /** Story progression: this quest must have reached `questState`. */
  requiredQuestId?: string;
  /** 'claimed' = turned in (the default; what unlocks the next story quest). */
  questState?: 'completed' | 'claimed';
}

export const DUNGEON_ACCESS: Readonly<Record<string, DungeonAccessRule>> = {
  [CRYPT_MAP_ID]: {
    mapId: CRYPT_MAP_ID,
    displayName: 'the Sunken Crypt',
    // Demo V1: the required story (Welcome + Trouble in the Meadow) yields ~940 EXP (Lv2);
    // Lv3 (1,339 EXP) asks for a little extra Field hunting (≈10–13 kills or the Grove Guardian)
    // without a grind. Crypt combat itself is unchanged.
    minimumLevel: 3,
    // "Trouble in the Meadow" turned in: the same step that unlocks "Into the Sunken Crypt".
    requiredQuestId: 'mvp_02_meadow',
    questState: 'claimed',
  },
};

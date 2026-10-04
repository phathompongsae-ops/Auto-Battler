import { DEMO_NAV_TARGETS } from './navigation/demoNavigation';

/*
 * Navigation targets: where Auto Move can take the player. Plain data keyed
 * by stable id. Quest objectives resolve to these through
 * navigation/questNavigation.ts; the movement code never names a quest.
 */

export type NavTargetType = 'npc' | 'location' | 'monster_zone' | 'portal' | 'dungeon_entrance';

export interface NavPoint {
  x: number;
  y: number;
}

export interface NavTarget {
  id: string;
  type: NavTargetType;
  /** Map the target is on. */
  mapId: string;
  /** Where Auto Move heads (world pixels on that map). */
  x: number;
  y: number;
  /** Stop once within this distance (px). Default NAV_DEFAULT_RADIUS. */
  radius?: number;
  /** Optional hand-placed waypoints on the way to this target (same map), used before the planner. */
  waypoints?: readonly NavPoint[];

  /** type 'npc': the NPC id quests talk to. */
  npcId?: string;
  /** type 'location': the location id reported on arrival (reachLocation). */
  locationId?: string;
  /** type 'monster_zone': monsters hunted here (kill objectives; collect via their loot). */
  monsterIds?: readonly string[];
  /** type 'portal': the warp portal (warpData PORTALS) and where its far side puts the player. */
  portalId?: string;
  arrival?: NavPoint;
  /** type 'dungeon_entrance': the dungeon it leads into. */
  dungeonId?: string;

  /** Free-form metadata for UI (e.g. a label); never used for routing. */
  meta?: { label?: string };
}

/** Default arrival radius (px). */
export const NAV_DEFAULT_RADIUS = 24;

/**
 * Where objectives without a place-bound id go. `enhance` → an enhancement
 * NPC / station once one exists (null = navigation unavailable for now).
 */
export interface NavStations {
  enhance: string | null;
}

export interface NavigationData {
  targets: Readonly<Record<string, NavTarget>>;
  stations: NavStations;
}

export const NAVIGATION: NavigationData = {
  targets: { ...DEMO_NAV_TARGETS },
  stations: { enhance: null },
};

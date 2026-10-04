import type { NavTarget } from '../navigationData';

/*
 * DEMO / TEST navigation data on the prototype test map (40x30 tiles of 32px).
 * Placeholder positions only; real Town / Field / Dungeon maps replace this.
 *
 * The prototype map stands in for `demo_field`. The dungeon-entrance map
 * reached through its portal is a lightweight id sharing the same physical
 * test map (real map loading comes with real maps).
 */
export const PROTOTYPE_MAP_ID = 'demo_field';

const t = (tileX: number, tileY: number) => ({ x: tileX * 32 + 16, y: tileY * 32 + 16 });

export const DEMO_NAV_TARGETS: Readonly<Record<string, NavTarget>> = {
  nav_demo_npc_guide: {
    id: 'nav_demo_npc_guide',
    type: 'npc',
    mapId: PROTOTYPE_MAP_ID,
    ...t(25, 15),
    radius: 40,
    npcId: 'demo_npc_guide',
    meta: { label: 'Guide' },
  },
  nav_demo_slime_zone: {
    id: 'nav_demo_slime_zone',
    type: 'monster_zone',
    mapId: PROTOTYPE_MAP_ID,
    ...t(10, 22),
    radius: 40,
    monsterIds: ['slime'],
    meta: { label: 'Slime hunting area' },
  },
  nav_demo_marker_gate: {
    id: 'nav_demo_marker_gate',
    type: 'location',
    mapId: PROTOTYPE_MAP_ID,
    ...t(20, 5),
    radius: 24,
    locationId: 'demo_marker_gate',
    meta: { label: 'Old Gate' },
  },
  nav_demo_portal_to_dungeon: {
    id: 'nav_demo_portal_to_dungeon',
    type: 'portal',
    mapId: PROTOTYPE_MAP_ID,
    ...t(3, 15),
    radius: 20,
    portalId: 'demo_field_to_dungeon',
    arrival: t(6, 15),
  },
  nav_demo_dungeon_entrance: {
    id: 'nav_demo_dungeon_entrance',
    type: 'dungeon_entrance',
    mapId: 'demo_dungeon_entrance',
    ...t(10, 15),
    radius: 32,
    dungeonId: 'demo_dungeon',
    meta: { label: 'Demo Dungeon' },
  },
};

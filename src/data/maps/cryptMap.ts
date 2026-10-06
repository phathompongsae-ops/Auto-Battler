import { TileGrid } from '../../world/layout';
import { Tile } from '../../world/tiles';
import { scatterDecor } from './decor';
import type { PropPlacement } from './props';
import { MVP_CRYPT_ENTRANCE_ID } from '../quests/mainQuests';
import { tileCenter, type MapDef } from './types';

/*
 * DUNGEON (placeholder art, 32x64): a linear crypt climbing north.
 * Entrance hall (exit to Town) → Section 1 → Section 2 → Elite section →
 * Boss room (with its own exit back to Town). Torches, braziers, pillars and
 * tombs mark each section. Dungeon reward rules apply to everything here:
 * mobs grant nothing, the boss-clear claim is the reward.
 */
export const CRYPT_MAP_ID = 'demo_crypt';

const W = 32;
const H = 64;

function tiles() {
  const g = new TileGrid(W, H, Tile.DungeonWall);
  const floor = Tile.DungeonFloor;
  g.rect(10, 53, 12, 9, floor); // Entrance hall
  g.rect(14, 50, 4, 3, floor);
  g.rect(5, 42, 22, 8, floor); // Section 1
  g.rect(14, 39, 4, 3, floor);
  g.rect(5, 31, 22, 8, floor); // Section 2
  g.rect(14, 28, 4, 3, floor);
  g.rect(8, 21, 16, 7, floor); // Elite section
  g.rect(14, 18, 4, 3, floor);
  g.rect(6, 3, 20, 15, floor); // Boss room
  g.rect(14, 3, 4, 15, Tile.Carpet); // Carpet runner to the throne
  g.rect(15, 62, 2, 1, Tile.Portal); // Exit → Town
  g.rect(23, 2, 2, 1, Tile.Portal); // Boss room exit → Town
  return g.build();
}

const TILES = tiles();

/** Torches on the wall above each room (decoration on solid wall tiles). */
const torches = (y: number, xs: number[]): PropPlacement[] => xs.map((x) => ({ kind: 'torch' as const, x, y }));

const PROPS: PropPlacement[] = [
  // Entrance hall.
  { kind: 'statue', x: 12, y: 60 },
  { kind: 'statue', x: 19, y: 60 },
  { kind: 'brazier', x: 12, y: 54 },
  { kind: 'brazier', x: 19, y: 54 },
  { kind: 'crypt_banner', x: 13, y: 52 },
  { kind: 'crypt_banner', x: 18, y: 52 },
  ...torches(52, [11, 20]),
  // Section 1.
  ...[[9, 44], [22, 44], [9, 47], [22, 47]].map(([x, y]) => ({ kind: 'pillar' as const, x, y })),
  ...torches(41, [7, 11, 20, 24]),
  { kind: 'brazier', x: 13, y: 49 },
  { kind: 'brazier', x: 18, y: 49 },
  // Section 2: tombs.
  ...[[9, 33], [22, 33], [9, 36], [22, 36]].map(([x, y]) => ({ kind: 'pillar' as const, x, y })),
  { kind: 'sarcophagus', x: 12, y: 35 },
  { kind: 'sarcophagus', x: 19, y: 35 },
  { kind: 'sarcophagus', x: 6, y: 32 },
  { kind: 'sarcophagus', x: 25, y: 36 },
  ...torches(30, [7, 11, 20, 24]),
  // Elite section.
  { kind: 'rune_circle', x: 15, y: 23 },
  { kind: 'brazier', x: 9, y: 22 },
  { kind: 'brazier', x: 22, y: 22 },
  { kind: 'brazier', x: 9, y: 26 },
  { kind: 'brazier', x: 22, y: 26 },
  ...torches(20, [10, 21]),
  // Boss room.
  { kind: 'throne', x: 15, y: 3 },
  ...[[10, 6], [21, 6], [10, 14], [21, 14], [7, 13], [25, 13]].map(([x, y]) => ({ kind: 'pillar' as const, x, y })),
  { kind: 'brazier', x: 13, y: 4 },
  { kind: 'brazier', x: 19, y: 4 },
  { kind: 'crypt_banner', x: 9, y: 2 },
  { kind: 'crypt_banner', x: 20, y: 2 },
  ...torches(2, [7, 12, 18]),
  // Debris everywhere except the central walkway.
  ...scatterDecor(TILES, [Tile.DungeonFloor], ['bones', 'rubble', 'cobweb', 'rubble'], 0.12, (x) => x >= 14 && x <= 17, 5),
];

export const CRYPT_MAP: MapDef = {
  id: CRYPT_MAP_ID,
  type: 'dungeon',
  displayName: 'Sunken Crypt',
  tiles: TILES,
  // The entrance hall: the safe point for loads, Dungeon Warps and respawns.
  spawnPoint: { x: 512, y: 57 * 32 + 16 },
  portals: [
    { id: 'demo_dungeon_to_town', to: 'demo_town', area: { x: 15, y: 62, w: 2, h: 1 }, arrival: { x: 992, y: 112 }, label: 'Exit to Town' },
    {
      id: 'demo_dungeon_boss_exit',
      to: 'demo_town',
      area: { x: 23, y: 2, w: 2, h: 1 },
      arrival: { x: 992, y: 112 },
      label: 'Return to Town',
      // Up the central corridor into the boss room first.
      waypoints: [{ x: 512, y: 12 * 32 }],
    },
  ],
  monsterSpawnZones: [
    { id: 'section_1', monsterId: 'crypt_skeleton', points: [{ tileX: 8, tileY: 45 }, { tileX: 23, tileY: 46 }, { tileX: 16, tileY: 44 }] },
    { id: 'section_2', monsterId: 'crypt_skeleton', points: [{ tileX: 8, tileY: 34 }, { tileX: 23, tileY: 34 }, { tileX: 15, tileY: 33 }] },
    { id: 'elite_section_guard', monsterId: 'crypt_skeleton', points: [{ tileX: 11, tileY: 23 }] },
    { id: 'elite_section', monsterId: 'crypt_knight', points: [{ tileX: 16, tileY: 24 }] },
    { id: 'boss_room', monsterId: 'crypt_lord', points: [{ tileX: 16, tileY: 8 }] },
  ],
  navigationTargets: [
    // The entrance hall: arriving counts as entering the dungeon.
    { id: 'nav_crypt_entrance', type: 'location', mapId: CRYPT_MAP_ID, x: 512, y: 57 * 32 + 16, radius: 64, locationId: MVP_CRYPT_ENTRANCE_ID },
    // The boss itself (kill objectives / Auto Move to the encounter).
    { id: 'nav_crypt_boss', type: 'monster_zone', mapId: CRYPT_MAP_ID, ...tileCenter(16, 11), radius: 56, monsterIds: ['crypt_lord'], meta: { label: 'Crypt Lord' } },
    { id: 'nav_crypt_boss_room', type: 'location', mapId: CRYPT_MAP_ID, ...tileCenter(15, 13), radius: 32, locationId: 'demo_crypt_boss_room', meta: { label: 'Boss Room' } },
  ],
  props: PROPS,
  landmarks: [
    { label: 'Section I', x: 16 * 32, y: 42 * 32 + 8 },
    { label: 'Section II', x: 16 * 32, y: 31 * 32 + 8 },
    { label: 'Elite Chamber', x: 16 * 32, y: 21 * 32 + 8 },
  ],
};

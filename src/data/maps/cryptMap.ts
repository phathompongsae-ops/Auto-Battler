import { TileGrid } from '../../world/layout';
import { Tile } from '../../world/tiles';
import { tileCenter, type MapDef } from './types';

/*
 * DUNGEON (placeholder layout, 32x64): a linear crypt climbing north.
 * Entrance hall (exit to Town) → Section 1 → Section 2 → Elite section →
 * Boss room (with its own exit back to Town). Dungeon reward rules apply to
 * everything here: mobs grant nothing, the boss-clear claim is the reward.
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
  g.rect(6, 3, 20, 15, Tile.Carpet); // Boss room
  // Pillars (collision), clear of the central corridor.
  for (const [x, y] of [[9, 44], [22, 44], [9, 47], [22, 47], [9, 33], [22, 33], [9, 36], [22, 36], [10, 6], [21, 6], [10, 14], [21, 14]]) g.set(x, y, Tile.DungeonWall);
  g.rect(15, 62, 2, 1, Tile.Portal); // Exit → Town
  g.rect(23, 2, 2, 1, Tile.Portal); // Boss room exit → Town
  return g.build();
}

export const CRYPT_MAP: MapDef = {
  id: CRYPT_MAP_ID,
  type: 'dungeon',
  displayName: 'Sunken Crypt',
  tiles: tiles(),
  // The entrance hall: the safe point for loads, Dungeon Warps and respawns.
  spawnPoint: { x: 512, y: 57 * 32 + 16 },
  portals: [
    { id: 'demo_dungeon_to_town', to: 'demo_town', area: { x: 15, y: 62, w: 2, h: 1 }, arrival: { x: 576, y: 112 }, label: 'Exit to Town' },
    {
      id: 'demo_dungeon_boss_exit',
      to: 'demo_town',
      area: { x: 23, y: 2, w: 2, h: 1 },
      arrival: { x: 576, y: 112 },
      label: 'Return to Town',
      // Up the central corridor into the boss room first.
      waypoints: [{ x: 512, y: 10 * 32 }],
    },
  ],
  monsterSpawnZones: [
    { id: 'section_1', monsterId: 'crypt_skeleton', points: [{ tileX: 8, tileY: 45 }, { tileX: 23, tileY: 46 }, { tileX: 16, tileY: 44 }] },
    { id: 'section_2', monsterId: 'crypt_skeleton', points: [{ tileX: 8, tileY: 34 }, { tileX: 23, tileY: 35 }, { tileX: 15, tileY: 33 }] },
    { id: 'elite_section_guard', monsterId: 'crypt_skeleton', points: [{ tileX: 11, tileY: 23 }] },
    { id: 'elite_section', monsterId: 'crypt_knight', points: [{ tileX: 16, tileY: 24 }] },
    { id: 'boss_room', monsterId: 'crypt_lord', points: [{ tileX: 16, tileY: 8 }] },
  ],
  navigationTargets: [
    { id: 'nav_crypt_boss_room', type: 'location', mapId: CRYPT_MAP_ID, ...tileCenter(15, 13), radius: 32, locationId: 'demo_crypt_boss_room', meta: { label: 'Boss Room' } },
  ],
};

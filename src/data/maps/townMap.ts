import { JOB_INSTRUCTOR_NPC_ID } from '../jobChangeData';
import { TileGrid } from '../../world/layout';
import { Tile } from '../../world/tiles';
import { tileCenter, type MapDef } from './types';

/*
 * TOWN (placeholder layout). A walled town: central plaza, five buildings
 * with their NPC / station in front, the east gate to the Field and the
 * north gate into the Dungeon. Safe: no hostile spawns.
 */
export const TOWN_MAP_ID = 'demo_town';

const W = 36;
const H = 26;

function tiles() {
  const g = new TileGrid(W, H, Tile.Cobble).border(Tile.Wall);
  g.each((x, y, t) => (t === Tile.Cobble && (x <= 2 || x >= W - 3 || y <= 1 || y >= H - 2) ? Tile.Grass : undefined));
  // Roads from the gates into the plaza.
  g.rect(22, 11, W - 23, 3, Tile.Path).rect(17, 1, 2, 10, Tile.Path);
  // Buildings: Job Hall, Forge (Enhancement), Enchant Tower, Workshop (Craft), Pet Stable.
  g.rect(3, 3, 6, 4, Tile.Roof).rect(27, 3, 6, 4, Tile.Roof);
  g.rect(3, 19, 6, 4, Tile.Roof).rect(27, 19, 6, 4, Tile.Roof);
  g.rect(15, 20, 6, 3, Tile.Roof);
  // Fountain (west plaza).
  g.rect(10, 11, 2, 2, Tile.Water);
  // Gates.
  g.rect(W - 1, 11, 1, 3, Tile.Portal).rect(17, 0, 2, 1, Tile.Portal);
  return g.build();
}

export const TOWN_MAP: MapDef = {
  id: TOWN_MAP_ID,
  type: 'town',
  displayName: 'Haven Town',
  tiles: tiles(),
  spawnPoint: { x: 576, y: 464 },
  portals: [
    { id: 'demo_town_to_field', to: 'demo_field', area: { x: W - 1, y: 11, w: 1, h: 3 }, arrival: tileCenter(3, 15), label: 'To Green Meadow' },
    { id: 'demo_town_to_dungeon', to: 'demo_crypt', area: { x: 17, y: 0, w: 2, h: 1 }, arrival: { x: 512, y: 57 * 32 + 16 }, label: 'Dungeon Gate' },
  ],
  monsterSpawnZones: [],
  navigationTargets: [
    {
      id: 'nav_demo_job_instructor',
      type: 'npc',
      mapId: TOWN_MAP_ID,
      ...tileCenter(6, 8),
      radius: 40,
      npcId: JOB_INSTRUCTOR_NPC_ID,
      meta: { label: 'Job Instructor' },
    },
    { id: 'nav_town_enhancement', type: 'station', mapId: TOWN_MAP_ID, ...tileCenter(29, 8), radius: 40, stationId: 'enhancement', meta: { label: 'Enhancement' } },
    { id: 'nav_town_enchant', type: 'station', mapId: TOWN_MAP_ID, ...tileCenter(6, 17), radius: 40, stationId: 'enchant', meta: { label: 'Enchant' } },
    { id: 'nav_town_craft', type: 'station', mapId: TOWN_MAP_ID, ...tileCenter(29, 17), radius: 40, stationId: 'craft', meta: { label: 'Craft' } },
    { id: 'nav_town_pet', type: 'station', mapId: TOWN_MAP_ID, ...tileCenter(17, 18), radius: 40, stationId: 'pet', meta: { label: 'Pet Stable' } },
    {
      // In front of the Dungeon Gate: arriving stops here (never enters the dungeon by itself).
      id: 'nav_demo_dungeon_entrance',
      type: 'dungeon_entrance',
      mapId: TOWN_MAP_ID,
      x: 576,
      y: tileCenter(0, 4).y,
      radius: 32,
      dungeonId: 'demo_dungeon',
      meta: { label: 'Dungeon Entrance' },
    },
  ],
};

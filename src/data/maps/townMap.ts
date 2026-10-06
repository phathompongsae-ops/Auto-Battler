import { JOB_INSTRUCTOR_NPC_ID } from '../jobChangeData';
import { CAPTAIN_NPC_ID, CRAFTER_NPC_ID, ENCHANTER_NPC_ID, SMITH_NPC_ID, STABLEKEEPER_NPC_ID } from '../npcData';
import { TileGrid } from '../../world/layout';
import { Tile } from '../../world/tiles';
import { scatterDecor } from './decor';
import type { PropPlacement } from './props';
import { tileCenter, type MapDef } from './types';

/*
 * TOWN (placeholder art, 44x32). A walled town built around landmarks: the
 * Crown Fountain plaza in the centre, the Hall of Legends monument to the
 * north, a market street to the west, the Job Hall / Forge / Enchant Tower /
 * Workshop / Pet Stable around it, the east gate to the Field and the north
 * Dungeon Gate. Safe: no hostile spawns.
 */
export const TOWN_MAP_ID = 'demo_town';

const W = 44;
const H = 32;

function tiles() {
  const g = new TileGrid(W, H, Tile.Cobble).border(Tile.Wall);
  g.each((x, y, t) => (t === Tile.Cobble && (x <= 2 || x >= W - 3 || y >= H - 2) ? Tile.Grass : undefined));
  // Roads: east gate → plaza, Dungeon Gate → east road.
  g.rect(28, 15, W - 29, 3, Tile.Path).rect(30, 1, 2, 14, Tile.Path);
  // Plazas: Crown Fountain (centre) and the Hall of Legends forecourt.
  g.ellipse(22, 17, 9, 7, Tile.PlazaTrim).ellipse(22, 17, 8, 6, Tile.Plaza);
  g.ellipse(22, 8, 6, 3, Tile.PlazaTrim).ellipse(22, 8, 5, 2.2, Tile.Plaza);
  // Garden lawns flanking the monument.
  g.rect(12, 8, 4, 3, Tile.Grass);
  // Buildings: Hall of Legends facade, Job Hall, Forge, Enchant Tower, Workshop, Pet Stable.
  g.rect(16, 1, 13, 3, Tile.Roof);
  g.rect(3, 2, 8, 5, Tile.Roof).rect(34, 2, 8, 5, Tile.Roof);
  g.rect(3, 24, 7, 5, Tile.Roof).rect(34, 24, 8, 5, Tile.Roof);
  g.rect(18, 26, 9, 4, Tile.Roof);
  // Gates.
  g.rect(W - 1, 15, 1, 3, Tile.Portal).rect(30, 0, 2, 1, Tile.Portal);
  return g.build();
}

const TILES = tiles();

const PROPS: PropPlacement[] = [
  // Landmarks.
  { kind: 'fountain', x: 20, y: 16 },
  { kind: 'plaza_mosaic', x: 20, y: 19 },
  { kind: 'monument', x: 20, y: 5 },
  { kind: 'statue', x: 17, y: 7 },
  { kind: 'statue', x: 27, y: 7 },
  { kind: 'flower_bed', x: 17, y: 11 },
  { kind: 'flower_bed', x: 26, y: 11 },
  // Plaza ring: lamps, benches.
  { kind: 'lamp_post', x: 14, y: 12 },
  { kind: 'lamp_post', x: 29, y: 12 },
  { kind: 'lamp_post', x: 14, y: 23 },
  { kind: 'lamp_post', x: 29, y: 23 },
  { kind: 'bench', x: 16, y: 21 },
  { kind: 'bench', x: 27, y: 21 },
  // Market street (west).
  { kind: 'market_stall', x: 4, y: 11 },
  { kind: 'market_stall', x: 4, y: 15 },
  { kind: 'market_stall', x: 9, y: 18 },
  { kind: 'barrel', x: 3, y: 14 },
  { kind: 'crates', x: 3, y: 18 },
  { kind: 'barrel', x: 12, y: 19 },
  { kind: 'notice_board', x: 9, y: 9 },
  // Service landmarks next to their stations.
  { kind: 'anvil', x: 39, y: 7 },
  { kind: 'barrel', x: 41, y: 7 },
  { kind: 'enchant_crystal', x: 9, y: 21 },
  { kind: 'workbench', x: 39, y: 23 },
  { kind: 'crates', x: 41, y: 23 },
  { kind: 'pet_house', x: 24, y: 24 },
  // Gardens and trees.
  { kind: 'cherry_tree', x: 12, y: 3 },
  { kind: 'cherry_tree', x: 14, y: 5 },
  { kind: 'cherry_tree', x: 33, y: 10 },
  { kind: 'cherry_tree', x: 11, y: 23 },
  { kind: 'cherry_tree', x: 32, y: 23 },
  { kind: 'cherry_tree', x: 13, y: 9 },
  { kind: 'cherry_tree', x: 1, y: 9 },
  { kind: 'cherry_tree', x: 42, y: 11 },
  { kind: 'cherry_tree', x: 42, y: 20 },
  { kind: 'cherry_tree', x: 14, y: 29 },
  { kind: 'cherry_tree', x: 30, y: 29 },
  // Banners on building fronts (decoration only).
  { kind: 'banner', x: 5, y: 6 },
  { kind: 'banner', x: 8, y: 6 },
  { kind: 'banner', x: 36, y: 6 },
  { kind: 'banner', x: 39, y: 6 },
  { kind: 'banner', x: 18, y: 3 },
  { kind: 'banner', x: 26, y: 3 },
  { kind: 'gate_arch', x: 42, y: 14 },
  ...scatterDecor(TILES, [Tile.Grass], ['flowers', 'grass_tuft'], 0.18, () => false, 2),
];

export const TOWN_MAP: MapDef = {
  id: TOWN_MAP_ID,
  type: 'town',
  displayName: 'Haven Town',
  tiles: TILES,
  spawnPoint: { x: 704, y: 656 },
  portals: [
    {
      id: 'demo_town_to_field',
      to: 'demo_field',
      area: { x: W - 1, y: 15, w: 1, h: 3 },
      arrival: tileCenter(3, 15),
      label: 'To Green Meadow',
      // Around the fountain: down to the plaza's south side, then along the east road.
      waypoints: [{ x: 1328, y: 656 }],
    },
    { id: 'demo_town_to_dungeon', to: 'demo_crypt', area: { x: 30, y: 0, w: 2, h: 1 }, arrival: { x: 512, y: 57 * 32 + 16 }, label: 'Dungeon Gate' },
  ],
  monsterSpawnZones: [],
  navigationTargets: [
    // Adventurers' Guild captain on the plaza: the main quest giver.
    { id: 'nav_town_captain', type: 'npc', mapId: TOWN_MAP_ID, ...tileCenter(17, 14), radius: 40, npcId: CAPTAIN_NPC_ID, meta: { label: 'Captain Rowan' } },
    {
      id: 'nav_demo_job_instructor',
      type: 'npc',
      mapId: TOWN_MAP_ID,
      ...tileCenter(7, 8),
      radius: 40,
      npcId: JOB_INSTRUCTOR_NPC_ID,
      meta: { label: 'Job Instructor' },
    },
    { id: 'nav_town_enhancement', type: 'station', mapId: TOWN_MAP_ID, ...tileCenter(37, 8), radius: 40, stationId: 'enhancement', npcId: SMITH_NPC_ID, meta: { label: 'Enhancement' } },
    { id: 'nav_town_enchant', type: 'station', mapId: TOWN_MAP_ID, ...tileCenter(6, 22), radius: 40, stationId: 'enchant', npcId: ENCHANTER_NPC_ID, meta: { label: 'Enchant' } },
    { id: 'nav_town_craft', type: 'station', mapId: TOWN_MAP_ID, ...tileCenter(37, 22), radius: 40, stationId: 'craft', npcId: CRAFTER_NPC_ID, meta: { label: 'Craft' } },
    {
      id: 'nav_town_pet',
      type: 'station',
      mapId: TOWN_MAP_ID,
      ...tileCenter(22, 24),
      radius: 40,
      stationId: 'pet',
      npcId: STABLEKEEPER_NPC_ID,
      // Around the fountain from the north and east.
      waypoints: [{ x: 704, y: 656 }],
      meta: { label: 'Pet Stable' },
    },
    {
      // In front of the Dungeon Gate: arriving stops here (never enters the dungeon by itself).
      id: 'nav_demo_dungeon_entrance',
      type: 'dungeon_entrance',
      mapId: TOWN_MAP_ID,
      x: 992,
      y: tileCenter(0, 4).y,
      radius: 32,
      dungeonId: 'demo_dungeon',
      meta: { label: 'Dungeon Entrance' },
    },
  ],
  props: PROPS,
  landmarks: [
    { label: 'Hall of Legends', x: 22 * 32, y: 4 * 32 + 8 },
    { label: 'Crown Fountain', x: 22 * 32, y: 15 * 32 },
    { label: 'Market', x: 7 * 32, y: 10 * 32 + 8 },
  ],
};

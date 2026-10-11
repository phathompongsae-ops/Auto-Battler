import { JOB_TRIAL_MARKER_ID } from '../jobChangeData';
import { DEMO_MARKER_ID, DEMO_NPC_ID } from '../quests/demoTestQuests';
import { MVP_FIELD_ENTRY_ID } from '../quests/mainQuests';
import { tileHash, TileGrid } from '../../world/layout';
import { Tile } from '../../world/tiles';
import { scatterDecor } from './decor';
import type { PropPlacement } from './props';
import { tileCenter, type MapDef } from './types';

/*
 * FIELD (placeholder art, 40x30). The meadow keeps the prototype's
 * crossroads and pond; each hunting zone has its own ground and landmark:
 * Slime meadow (SW), Wolf den cave (NW), Mushroom grove (SE), Elite ruins (E)
 * and the Guardian's standing stones (NE). A traveller camp marks the safe
 * spawn at the crossroads; the west gate leads back to Town. A forest edge
 * frames the map. Rows 17-20 and the outer walkway stay open (combat room).
 *
 * The Guardian's clearing sits inland of the pond (which fills the north-east
 * corner): at camera zoom 1.65 the view (582×327 world px) stays centred on a
 * fight there instead of clamping to the map edge, so the fight and its Stomp
 * ring are not pushed under the top-right quest tracker and combat buttons.
 */
export const FIELD_MAP_ID = 'demo_field';

const W = 40;
const H = 30;

function tiles() {
  const g = new TileGrid(W, H, Tile.Grass);
  g.each((x, y) => (tileHash(x, y) < 0.05 ? Tile.Flowers : undefined));
  // Zone grounds.
  g.ellipse(6, 23, 4.5, 4, Tile.Flowers); // Slime meadow
  g.ellipse(8, 6.5, 5, 3.5, Tile.Dirt); // Wolf den
  g.ellipse(31, 23, 5, 3.5, Tile.Moss); // Mushroom grove
  g.rect(31, 11, 7, 3, Tile.DarkGrass); // Elite ruins
  g.ellipse(28, 7, 4.6, 3.6, Tile.DarkGrass); // Guardian clearing
  // Crossroads.
  g.each((x, y) => (Math.abs(x - W / 2) <= 1 || Math.abs(y - H / 2) <= 1 ? Tile.Path : undefined));
  g.ellipse(35, 6, 2.4, 3.4, Tile.Water); // Pond (north-east corner, one grass tile from the forest edge)
  g.border(Tile.Wall);
  g.rect(0, 14, 1, 3, Tile.Portal); // West gate → Town
  return g.build();
}

const TILES = tiles();

/**
 * Forest edge: trees standing on the border wall (collision unchanged), clear
 * of the west gate, with undergrowth (bushes, the odd rock) filling the gaps
 * between them so the border reads as woodland rather than a stone wall.
 */
function forestEdge(): PropPlacement[] {
  const out: PropPlacement[] = [];
  const undergrowth = (x: number, y: number): PropPlacement => ({ kind: (x * 7 + y * 3) % 5 === 0 ? 'rock' : 'bush', x, y });
  for (let x = 1; x < W - 1; x += 2) {
    out.push({ kind: x % 4 === 1 ? 'pine' : 'tree', x, y: 0 });
    out.push({ kind: x % 4 === 3 ? 'pine' : 'tree', x, y: H - 1 });
  }
  for (let x = 0; x < W; x += 2) out.push(undergrowth(x, 0), undergrowth(x, H - 1));
  for (let y = 2; y < H - 1; y += 2) {
    if (y < 13 || y > 17) out.push({ kind: y % 4 === 0 ? 'pine' : 'tree', x: 0, y });
    out.push({ kind: y % 4 === 2 ? 'pine' : 'tree', x: W - 1, y });
  }
  for (let y = 1; y < H - 1; y += 2) {
    if (y < 14 || y > 16) out.push(undergrowth(0, y));
    out.push(undergrowth(W - 1, y));
  }
  return out;
}

const SOLID_PROPS: PropPlacement[] = [
  // Wolf den.
  { kind: 'cave', x: 3, y: 2 },
  { kind: 'big_rock', x: 11, y: 2 },
  { kind: 'rock', x: 12, y: 9 },
  { kind: 'bush', x: 3, y: 10 },
  { kind: 'tree', x: 5, y: 12 },
  { kind: 'tree', x: 10, y: 12 },
  // Woods between the den and the camp.
  { kind: 'tree', x: 13, y: 11 },
  { kind: 'pine', x: 14, y: 11 },
  { kind: 'tree', x: 13, y: 12 },
  { kind: 'tree', x: 16, y: 8 },
  { kind: 'bush', x: 15, y: 6 },
  // Old Gate ruins.
  { kind: 'ruin_pillar', x: 18, y: 4 },
  { kind: 'ruin_pillar', x: 22, y: 4 },
  { kind: 'tree', x: 23, y: 2 },
  { kind: 'pine', x: 24, y: 2 },
  { kind: 'tree', x: 23, y: 3 },
  { kind: 'bush', x: 23, y: 11 },
  // Woods west of the Old Gate.
  { kind: 'tree', x: 15, y: 3 },
  { kind: 'bush', x: 16, y: 4 },
  { kind: 'rock', x: 14, y: 5 },
  { kind: 'bush', x: 2, y: 8 },
  // Guardian clearing: a ring of standing stones outside the fight's footprint (open on every side).
  { kind: 'standing_stone', x: 24, y: 4 },
  { kind: 'standing_stone', x: 32, y: 4 },
  { kind: 'standing_stone', x: 23, y: 9 },
  { kind: 'standing_stone', x: 33, y: 9 },
  // Pond shore.
  { kind: 'pine', x: 34, y: 2 },
  { kind: 'bush', x: 37, y: 2 },
  { kind: 'rock', x: 37, y: 8 },
  // Elite ruins.
  { kind: 'ruin_pillar', x: 37, y: 11 },
  { kind: 'ruin_pillar', x: 37, y: 13 },
  { kind: 'rock', x: 31, y: 10 },
  // Traveller camp (by the safe spawn).
  { kind: 'tent', x: 23, y: 21 },
  // Slime meadow.
  { kind: 'stump', x: 11, y: 26 },
  { kind: 'bush', x: 2, y: 22 },
  { kind: 'tree', x: 16, y: 25 },
  { kind: 'tree', x: 17, y: 25 },
  { kind: 'pine', x: 17, y: 26 },
  { kind: 'tree', x: 12, y: 27 },
  { kind: 'bush', x: 2, y: 27 },
  { kind: 'rock', x: 14, y: 26 },
  { kind: 'tree', x: 9, y: 27 },
  // Mushroom grove.
  { kind: 'tree', x: 37, y: 25 },
  { kind: 'pine', x: 36, y: 27 },
  { kind: 'giant_mushroom', x: 27, y: 25 },
  { kind: 'giant_mushroom', x: 35, y: 21 },
  { kind: 'giant_mushroom', x: 34, y: 26 },
  { kind: 'tree', x: 26, y: 27 },
  { kind: 'big_rock', x: 25, y: 24 },
];

/** Cells where nothing may be scattered: roads, the camp, open combat rows. */
const keepClear = (x: number, y: number) => (y >= 14 && y <= 20) || (x >= 19 && x <= 21);

const PROPS: PropPlacement[] = [
  ...forestEdge(),
  ...SOLID_PROPS,
  { kind: 'campfire', x: 22, y: 20 },
  { kind: 'signpost', x: 18, y: 17 },
  { kind: 'signpost', x: 2, y: 13 },
  ...scatterDecor(TILES, [Tile.Grass, Tile.Flowers, Tile.DarkGrass, Tile.Dirt], ['flowers', 'grass_tuft', 'pebbles', 'grass_tuft'], 0.16, keepClear, 1),
  ...scatterDecor(TILES, [Tile.Moss], ['small_mushrooms', 'grass_tuft'], 0.3, keepClear, 3),
];

const zone = (tileX: number, tileY: number) => tileCenter(tileX, tileY);

export const FIELD_MAP: MapDef = {
  id: FIELD_MAP_ID,
  type: 'field',
  displayName: 'Green Meadow',
  tiles: TILES,
  spawnPoint: { x: 640, y: 608 },
  portals: [{ id: 'demo_field_to_town', to: 'demo_town', area: { x: 0, y: 14, w: 1, h: 3 }, arrival: tileCenter(41, 16), label: 'To Haven Town' }],
  monsterSpawnZones: [
    { id: 'slime_zone', monsterId: 'slime', points: [{ tileX: 8, tileY: 23 }, { tileX: 4, tileY: 20 }, { tileX: 3, tileY: 25 }, { tileX: 6, tileY: 27 }] },
    { id: 'wolf_zone', monsterId: 'wolf', points: [{ tileX: 6, tileY: 5 }, { tileX: 10, tileY: 6 }, { tileX: 7, tileY: 9 }] },
    { id: 'mushroom_zone', monsterId: 'mushroom', points: [{ tileX: 28, tileY: 22 }, { tileX: 33, tileY: 22 }, { tileX: 31, tileY: 25 }] },
    { id: 'elite_zone', monsterId: 'elite_boar', points: [{ tileX: 34, tileY: 12 }] },
    { id: 'mini_boss_zone', monsterId: 'grove_guardian', points: [{ tileX: 28, tileY: 7 }] },
  ],
  navigationTargets: [
    { id: 'nav_demo_npc_guide', type: 'npc', mapId: FIELD_MAP_ID, ...zone(25, 15), radius: 40, npcId: DEMO_NPC_ID, meta: { label: 'Guide' } },
    { id: 'nav_demo_slime_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(7, 23), radius: 40, monsterIds: ['slime'], meta: { label: 'Slime Meadow' } },
    { id: 'nav_field_wolf_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(8, 7), radius: 40, monsterIds: ['wolf'], meta: { label: 'Wolf Den' } },
    { id: 'nav_field_mushroom_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(31, 23), radius: 40, monsterIds: ['mushroom'], meta: { label: 'Mushroom Grove' } },
    { id: 'nav_field_elite_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(32, 12), radius: 40, monsterIds: ['elite_boar'], meta: { label: 'Elite Ruins' } },
    { id: 'nav_field_mini_boss_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(28, 10), radius: 40, monsterIds: ['grove_guardian'], meta: { label: 'Guardian Stones' } },
    // Just inside the west gate: arriving from Town counts as reaching the Field.
    { id: 'nav_field_entry', type: 'location', mapId: FIELD_MAP_ID, ...zone(4, 15), radius: 56, locationId: MVP_FIELD_ENTRY_ID },
    { id: 'nav_demo_marker_gate', type: 'location', mapId: FIELD_MAP_ID, ...zone(20, 5), radius: 24, locationId: DEMO_MARKER_ID, meta: { label: 'Old Gate' } },
    { id: 'nav_demo_job_trial_marker', type: 'location', mapId: FIELD_MAP_ID, ...zone(14, 22), radius: 24, locationId: JOB_TRIAL_MARKER_ID, meta: { label: 'Trial Grounds' } },
    {
      id: 'nav_demo_job_trial_zone',
      type: 'monster_zone',
      mapId: FIELD_MAP_ID,
      ...zone(9, 24),
      radius: 40,
      monsterIds: ['slime'],
      questIds: ['job_c1_02_trial'],
      meta: { label: 'Trial targets' },
    },
  ],
  props: PROPS,
  landmarks: [{ label: 'Traveller Camp', x: 24 * 32, y: 21 * 32 - 24 }],
};

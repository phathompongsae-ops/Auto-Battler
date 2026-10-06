import { JOB_TRIAL_MARKER_ID } from '../jobChangeData';
import { DEMO_MARKER_ID, DEMO_NPC_ID } from '../quests/demoTestQuests';
import { tileHash, TileGrid } from '../../world/layout';
import { Tile } from '../../world/tiles';
import { tileCenter, type MapDef } from './types';

/*
 * FIELD (placeholder layout, 40x30). The meadow keeps the prototype's
 * crossroads and pond; hunting zones are colour-coded grounds: Slime (SW),
 * Wolf (NW), Mushroom (SE), Elite (E) and Mini Boss (NE corner). The west
 * gate leads back to Town. The camp at the crossroads is the safe spawn.
 */
export const FIELD_MAP_ID = 'demo_field';

const W = 40;
const H = 30;

function tiles() {
  const g = new TileGrid(W, H, Tile.Grass);
  g.each((x, y) => (tileHash(x, y) < 0.08 ? Tile.Flowers : undefined));
  // Zone grounds.
  g.ellipse(6, 23, 4.5, 4, Tile.Flowers); // Slime meadow
  g.ellipse(8, 6.5, 5, 3.5, Tile.Dirt); // Wolf den
  g.ellipse(31, 23, 5, 3.5, Tile.Moss); // Mushroom grove
  g.rect(31, 11, 7, 3, Tile.DarkGrass); // Elite grounds
  g.rect(35, 2, 3, 9, Tile.DarkGrass); // Mini Boss clearing
  // Crossroads.
  g.each((x, y) => (Math.abs(x - W / 2) <= 1 || Math.abs(y - H / 2) <= 1 ? Tile.Path : undefined));
  g.ellipse(30, 7, 4.5, 3, Tile.Water); // Pond
  // Tree clumps (collision), kept off the roads and the outer walkway.
  for (const [x, y] of [[23, 2], [24, 2], [23, 3], [13, 11], [14, 11], [13, 12], [16, 25], [17, 25], [17, 26], [34, 2], [34, 3]]) g.set(x, y, Tile.Tree);
  g.border(Tile.Wall);
  g.rect(0, 14, 1, 3, Tile.Portal); // West gate → Town
  return g.build();
}

const zone = (tileX: number, tileY: number) => tileCenter(tileX, tileY);

export const FIELD_MAP: MapDef = {
  id: FIELD_MAP_ID,
  type: 'field',
  displayName: 'Green Meadow',
  tiles: tiles(),
  spawnPoint: { x: 640, y: 608 },
  portals: [{ id: 'demo_field_to_town', to: 'demo_town', area: { x: 0, y: 14, w: 1, h: 3 }, arrival: tileCenter(33, 12), label: 'To Haven Town' }],
  monsterSpawnZones: [
    { id: 'slime_zone', monsterId: 'slime', points: [{ tileX: 8, tileY: 23 }, { tileX: 4, tileY: 20 }, { tileX: 3, tileY: 25 }, { tileX: 6, tileY: 27 }] },
    { id: 'wolf_zone', monsterId: 'wolf', points: [{ tileX: 6, tileY: 5 }, { tileX: 10, tileY: 6 }, { tileX: 7, tileY: 9 }] },
    { id: 'mushroom_zone', monsterId: 'mushroom', points: [{ tileX: 28, tileY: 22 }, { tileX: 33, tileY: 22 }, { tileX: 31, tileY: 25 }] },
    { id: 'elite_zone', monsterId: 'elite_boar', points: [{ tileX: 34, tileY: 12 }] },
    { id: 'mini_boss_zone', monsterId: 'grove_guardian', points: [{ tileX: 36, tileY: 5 }] },
  ],
  navigationTargets: [
    { id: 'nav_demo_npc_guide', type: 'npc', mapId: FIELD_MAP_ID, ...zone(25, 15), radius: 40, npcId: DEMO_NPC_ID, meta: { label: 'Guide' } },
    { id: 'nav_demo_slime_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(7, 23), radius: 40, monsterIds: ['slime'], meta: { label: 'Slime Meadow' } },
    { id: 'nav_field_wolf_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(8, 7), radius: 40, monsterIds: ['wolf'], meta: { label: 'Wolf Den' } },
    { id: 'nav_field_mushroom_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(31, 23), radius: 40, monsterIds: ['mushroom'], meta: { label: 'Mushroom Grove' } },
    { id: 'nav_field_elite_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(32, 12), radius: 40, monsterIds: ['elite_boar'], meta: { label: 'Elite Grounds' } },
    { id: 'nav_field_mini_boss_zone', type: 'monster_zone', mapId: FIELD_MAP_ID, ...zone(36, 8), radius: 40, monsterIds: ['grove_guardian'], meta: { label: 'Guardian Clearing' } },
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
};

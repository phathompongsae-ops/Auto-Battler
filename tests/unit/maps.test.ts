import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EventBus } from '../../src/core/EventBus';
import { FIELD_ENERGY } from '../../src/data/energyData';
import { CRYPT_MAP_ID, DEFAULT_MAP_ID, FIELD_MAP_ID, MAPS, mapSize, portalCenter, portalNavId, PROP_KINDS, TOWN_MAP_ID, type MapDef } from '../../src/data/maps';
import { MONSTERS } from '../../src/data/monsterData';
import { NAVIGATION } from '../../src/data/navigationData';
import { DUNGEON_WARPS, PORTALS, TOWNS } from '../../src/data/warpData';
import type { GameEvents } from '../../src/game/GameEvents';
import { grantKillRewards } from '../../src/game/killRewards';
import { LootSystem } from '../../src/loot/LootSystem';
import { NavIndex, portalTransition } from '../../src/navigation/NavIndex';
import { LPathPlanner } from '../../src/navigation/pathing';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, newPlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { locationKind } from '../../src/warp/warp';
import { MapSession } from '../../src/world/MapSession';
import { blocksProjectile, isSafePosition, mapCollision, portalAt, resolveMapEntry, spawnPlan, tileAt, type MonsterSpawn } from '../../src/world/mapRules';
import { SOLID_TILES, Tile } from '../../src/world/tiles';
import { makeSaveTarget } from './fixtures';

const ALL = Object.values(MAPS);
const nav = new NavIndex(NAVIGATION);

/** A fake scene: records builds and keeps the live monster set. */
function session() {
  const live = new Set<string>();
  const built: string[] = [];
  const s = new MapSession<MonsterSpawn>({
    build: (map) => built.push(map.id),
    spawn: (spawn) => (live.add(spawn.id), spawn),
    despawn: (m) => live.delete(m.id),
  });
  return { s, live, built };
}

describe('map data', () => {
  test('Town, Field and Dungeon definitions exist with unique ids and the right types', () => {
    assert.deepEqual(
      ALL.map((m) => [m.id, m.type]),
      [
        [TOWN_MAP_ID, 'town'],
        [FIELD_MAP_ID, 'field'],
        [CRYPT_MAP_ID, 'dungeon'],
      ],
    );
    assert.equal(new Set(ALL.map((m) => m.id)).size, ALL.length);
    for (const [id, map] of Object.entries(MAPS)) assert.equal(map.id, id);
    assert.equal(DEFAULT_MAP_ID, TOWN_MAP_ID, 'a new game starts in Town');
    for (const m of ALL) assert.equal(locationKind(m.id), m.type);
  });

  test('layouts are rectangular, walled in, and visibly different maps', () => {
    for (const m of ALL) {
      const { width, height } = mapSize(m);
      assert.ok(width >= 30 && height >= 25, m.id);
      assert.ok(m.tiles.every((r) => r.length === width), `${m.id} rows`);
    }
    const sizes = ALL.map((m) => JSON.stringify(mapSize(m)));
    assert.equal(new Set(sizes).size, 3, 'three different sizes');
    const tilesOf = (m: MapDef) => new Set(m.tiles.flat());
    assert.notDeepEqual(tilesOf(MAPS[TOWN_MAP_ID]), tilesOf(MAPS[FIELD_MAP_ID]));
    assert.notDeepEqual(tilesOf(MAPS[FIELD_MAP_ID]), tilesOf(MAPS[CRYPT_MAP_ID]));
  });

  test('every map has collision, and a safe spawn point', () => {
    for (const m of ALL) {
      assert.ok(m.tiles.flat().some((t) => SOLID_TILES.includes(t)), `${m.id} has solid tiles`);
      assert.ok(isSafePosition(m, m.spawnPoint), `${m.id} spawn ${JSON.stringify(m.spawnPoint)}`);
      // Walls stop movement off the map: the corner is solid.
      assert.ok(mapCollision(m.id)!.isBlocked(1, 1), `${m.id} corner`);
    }
  });

  test('portal links are valid: known destinations, walkable triggers, safe arrivals outside any trigger', () => {
    const portals = ALL.flatMap((m) => m.portals.map((p) => ({ ...p, from: m }))) ;
    assert.equal(new Set(portals.map((p) => p.id)).size, portals.length, 'unique portal ids');
    for (const p of portals) {
      const to = MAPS[p.to];
      assert.ok(to, `${p.id} → ${p.to}`);
      assert.notEqual(p.to, p.from.id);
      const c = portalCenter(p);
      assert.equal(portalAt(p.from, c.x, c.y)?.id, p.id, `${p.id} trigger`);
      assert.ok(!SOLID_TILES.includes(tileAt(p.from, c.x, c.y)!), `${p.id} trigger is walkable`);
      assert.ok(isSafePosition(to, p.arrival), `${p.id} arrival ${JSON.stringify(p.arrival)} on ${p.to}`);
      assert.deepEqual(PORTALS[p.id], { id: p.id, from: p.from.id, to: p.to }, 'the portal graph comes from the map table');
    }
    // The graph: Town <-> Field, Town -> Dungeon, Dungeon -> Town.
    const edges = new Set(portals.map((p) => `${p.from.id}>${p.to}`));
    for (const e of [`${TOWN_MAP_ID}>${FIELD_MAP_ID}`, `${FIELD_MAP_ID}>${TOWN_MAP_ID}`, `${TOWN_MAP_ID}>${CRYPT_MAP_ID}`, `${CRYPT_MAP_ID}>${TOWN_MAP_ID}`]) assert.ok(edges.has(e), e);
  });

  test('warp data points at real maps', () => {
    for (const id of Object.keys(TOWNS)) assert.equal(MAPS[id]?.type, 'town');
    for (const d of Object.values(DUNGEON_WARPS)) {
      assert.equal(MAPS[d.entranceMapId]?.type, 'dungeon');
      assert.equal(MAPS[d.bossRoomMapId]?.type, 'dungeon');
    }
  });

  test('Town has every required point; Field every zone; Dungeon its sections', () => {
    const ids = (mapId: string) => nav.all().filter((t) => t.mapId === mapId).map((t) => t.id);
    const town = ids(TOWN_MAP_ID);
    for (const id of ['nav_demo_job_instructor', 'nav_town_enhancement', 'nav_town_enchant', 'nav_town_craft', 'nav_town_pet', 'nav_demo_dungeon_entrance', portalNavId('demo_town_to_field'), portalNavId('demo_town_to_dungeon')]) {
      assert.ok(town.includes(id), id);
    }
    const field = ids(FIELD_MAP_ID);
    for (const id of ['nav_demo_slime_zone', 'nav_field_wolf_zone', 'nav_field_mushroom_zone', 'nav_field_elite_zone', 'nav_field_mini_boss_zone', 'nav_demo_job_trial_marker', 'nav_demo_job_trial_zone', portalNavId('demo_field_to_town')]) {
      assert.ok(field.includes(id), id);
    }
    const zones = MAPS[FIELD_MAP_ID].monsterSpawnZones.map((z) => z.id);
    assert.deepEqual(zones, ['slime_zone', 'wolf_zone', 'mushroom_zone', 'elite_zone', 'mini_boss_zone']);
    const tiers = new Set(spawnPlan(MAPS[FIELD_MAP_ID]).map((s) => MONSTERS[s.monsterId].tier));
    assert.deepEqual([...tiers].sort(), ['elite', 'mini_boss', 'normal'], 'Daily / Weekly field kill categories all exist');

    const crypt = MAPS[CRYPT_MAP_ID].monsterSpawnZones.map((z) => z.id);
    assert.ok(crypt.filter((z) => z.startsWith('section_')).length >= 2, 'two or more combat sections');
    assert.ok(crypt.includes('elite_section') && crypt.includes('boss_room'));
    assert.equal(spawnPlan(MAPS[CRYPT_MAP_ID]).filter((s) => MONSTERS[s.monsterId].tier === 'dungeon_boss').length, 1, 'one boss');
    assert.equal(MAPS[CRYPT_MAP_ID].portals.length, 2, 'entrance exit and boss-room exit');
  });

  test('every navigation target is reachable (L paths on real collision) from the spawn and every portal arrival of its map', () => {
    const planner = new LPathPlanner(mapCollision);
    for (const m of ALL) {
      const starts = [m.spawnPoint, ...ALL.flatMap((o) => o.portals.filter((p) => p.to === m.id).map((p) => p.arrival))];
      for (const t of nav.all().filter((x) => x.mapId === m.id)) {
        for (const from of starts) assert.ok(planner.plan(m.id, from, t, t.waypoints), `${t.id} from ${JSON.stringify(from)} on ${m.id}`);
      }
    }
  });

  test('props: inside the map, solid ones are collision (and stop projectiles when tall), decoration never blocks', () => {
    for (const m of ALL) {
      const { width, height } = mapSize(m);
      const grid = mapCollision(m.id)!;
      for (const p of m.props) {
        const k = PROP_KINDS[p.kind];
        assert.ok(p.x >= 0 && p.y >= 0 && p.x + k.w <= width && p.y + k.h <= height, `${p.kind} at ${p.x},${p.y} on ${m.id}`);
        const c = { x: (p.x + k.w / 2) * 32, y: (p.y + k.h / 2) * 32 };
        if (k.solid) assert.ok(grid.isBlocked(c.x, c.y), `${p.kind} at ${p.x},${p.y} blocks`);
        if (k.solid && k.tall) assert.ok(blocksProjectile(m, c.x, c.y), `${p.kind} stops projectiles`);
        for (const portal of m.portals) {
          const a = portal.area;
          const overlaps = p.x < a.x + a.w && p.x + k.w > a.x && p.y < a.y + a.h && p.y + k.h > a.y;
          assert.ok(!(overlaps && k.solid), `${p.kind} blocks portal ${portal.id}`);
        }
      }
      // Ground decoration leaves the walkable area untouched.
      const decor = m.props.filter((p) => !PROP_KINDS[p.kind].solid);
      assert.ok(decor.length > 0, `${m.id} has decoration`);
    }
  });

  test('each map is dense: landmarks and dozens of props, not empty ground', () => {
    for (const m of ALL) {
      assert.ok(m.props.length >= 40, `${m.id}: ${m.props.length} props`);
      assert.ok(m.props.filter((p) => PROP_KINDS[p.kind].solid).length >= 15, `${m.id}: solid landmarks`);
      assert.ok((m.landmarks?.length ?? 0) >= 1, `${m.id}: landmark signs`);
    }
    const kinds = (id: string) => new Set(MAPS[id].props.map((p) => p.kind));
    for (const k of ['fountain', 'monument', 'market_stall', 'anvil', 'enchant_crystal', 'workbench', 'pet_house'] as const) assert.ok(kinds(TOWN_MAP_ID).has(k), `Town ${k}`);
    for (const k of ['cave', 'giant_mushroom', 'ruin_pillar', 'standing_stone', 'tent'] as const) assert.ok(kinds(FIELD_MAP_ID).has(k), `Field ${k}`);
    for (const k of ['pillar', 'torch', 'sarcophagus', 'rune_circle', 'throne'] as const) assert.ok(kinds(CRYPT_MAP_ID).has(k), `Dungeon ${k}`);
  });

  test('monster spawns stand on walkable tiles of their own map', () => {
    for (const m of ALL) for (const s of spawnPlan(m)) assert.ok(isSafePosition(m, s), `${s.id} on ${m.id}`);
  });
});

describe('spawns', () => {
  test('Town spawns no hostile monsters', () => {
    assert.deepEqual(spawnPlan(MAPS[TOWN_MAP_ID]), []);
    assert.deepEqual(MAPS[TOWN_MAP_ID].monsterSpawnZones, []);
  });

  test('Field spawns only Field definitions; Dungeon only Dungeon definitions (data-driven ids)', () => {
    const field = spawnPlan(MAPS[FIELD_MAP_ID]);
    const crypt = spawnPlan(MAPS[CRYPT_MAP_ID]);
    const fieldDefs = new Set(MAPS[FIELD_MAP_ID].monsterSpawnZones.map((z) => z.monsterId));
    const cryptDefs = new Set(MAPS[CRYPT_MAP_ID].monsterSpawnZones.map((z) => z.monsterId));
    assert.ok(field.every((s) => fieldDefs.has(s.monsterId)) && crypt.every((s) => cryptDefs.has(s.monsterId)));
    assert.ok(!field.some((s) => cryptDefs.has(s.monsterId)), 'no dungeon monsters in the Field');
    assert.ok(!crypt.some((s) => fieldDefs.has(s.monsterId)), 'no field monsters in the Dungeon');
    assert.deepEqual(field.filter((s) => s.monsterId === 'slime').map((s) => s.id), ['slime-1', 'slime-2', 'slime-3', 'slime-4']);
    assert.equal(new Set(field.map((s) => s.id)).size, field.length, 'unique ids');
  });

  test('a map change removes every old-map monster and spawns exactly the new map', () => {
    const { s, live, built } = session();
    s.enter(FIELD_MAP_ID);
    const fieldIds = spawnPlan(MAPS[FIELD_MAP_ID]).map((x) => x.id);
    assert.deepEqual([...live].sort(), [...fieldIds].sort());
    s.enter(TOWN_MAP_ID);
    assert.equal(live.size, 0, 'Town: no monsters, the Field ones are gone');
    s.enter(CRYPT_MAP_ID);
    assert.deepEqual([...live].sort(), spawnPlan(MAPS[CRYPT_MAP_ID]).map((x) => x.id).sort());
    s.enter(FIELD_MAP_ID);
    assert.deepEqual([...live].sort(), [...fieldIds].sort(), 'no Dungeon monster survives into the Field');
    assert.deepEqual(built, [FIELD_MAP_ID, TOWN_MAP_ID, CRYPT_MAP_ID, FIELD_MAP_ID], 'the map is rebuilt every time');
  });

  test('an unknown map id loads the default map', () => {
    const { s } = session();
    assert.equal(s.enter('nowhere').id, DEFAULT_MAP_ID);
  });
});

describe('transitions (portal graph + map session)', () => {
  /** Take a portal: the real portalTransition rule, then load the destination. */
  function take(s: MapSession<MonsterSpawn>, portalId: string) {
    const from = s.map;
    const t = portalTransition(nav, { kind: from.type, mapId: from.id }, portalId);
    if (!t.ok) return null;
    s.enter(t.location.mapId);
    return t;
  }

  test('Town → Field → Town', () => {
    const { s } = session();
    s.enter(TOWN_MAP_ID);
    const toField = take(s, 'demo_town_to_field');
    assert.equal(toField?.location.mapId, FIELD_MAP_ID);
    assert.equal(toField?.location.kind, 'field');
    assert.equal(s.map.id, FIELD_MAP_ID);
    const back = take(s, 'demo_field_to_town');
    assert.deepEqual(back?.location, { kind: 'town', mapId: TOWN_MAP_ID });
    assert.ok(isSafePosition(MAPS[TOWN_MAP_ID], back!.arrival));
  });

  test('Town → Dungeon lands in the entrance hall; Dungeon exits return to Town safely', () => {
    const { s } = session();
    s.enter(TOWN_MAP_ID);
    const inside = take(s, 'demo_town_to_dungeon');
    assert.deepEqual(inside?.location, { kind: 'dungeon', mapId: CRYPT_MAP_ID });
    assert.deepEqual(inside?.arrival, MAPS[CRYPT_MAP_ID].spawnPoint, 'the entrance, never the boss room');
    for (const exit of ['demo_dungeon_to_town', 'demo_dungeon_boss_exit']) {
      s.enter(CRYPT_MAP_ID);
      const out = take(s, exit);
      assert.deepEqual(out?.location, { kind: 'town', mapId: TOWN_MAP_ID }, exit);
      assert.ok(isSafePosition(MAPS[TOWN_MAP_ID], out!.arrival));
    }
  });

  test('a portal is only usable from its own map', () => {
    const { s } = session();
    s.enter(FIELD_MAP_ID);
    assert.equal(take(s, 'demo_town_to_dungeon'), null);
    assert.equal(s.map.id, FIELD_MAP_ID);
  });
});

describe('save: current map and position', () => {
  test('current map and a valid position persist through save / load', () => {
    const t = makeSaveTarget(5);
    t.location = { mapId: FIELD_MAP_ID, x: 300, y: 500 };
    const text = serializePlayerSave(capturePlayerSave(t));
    const loaded = makeSaveTarget(1);
    applyPlayerSave(loaded, deserializePlayerSave(text));
    assert.deepEqual(loaded.location, { mapId: FIELD_MAP_ID, x: 300, y: 500 });
    assert.deepEqual(resolveMapEntry(loaded.location), { mapId: FIELD_MAP_ID, at: { x: 300, y: 500 }, fallback: null });
  });

  test('a new character / an earlier v4 save without a location starts at the Town spawn', () => {
    assert.equal(newPlayerSave('c').location, null);
    const { location: _none, ...old } = capturePlayerSave(makeSaveTarget(3));
    void _none;
    const save = deserializePlayerSave(JSON.stringify(old));
    assert.equal(save.location, null);
    assert.deepEqual(resolveMapEntry(save.location), { mapId: TOWN_MAP_ID, at: MAPS[TOWN_MAP_ID].spawnPoint, fallback: 'no_location' });
  });

  test('an unknown map id falls back to the Town spawn (the save still loads)', () => {
    const raw = { ...capturePlayerSave(makeSaveTarget(3)), location: { mapId: 'deleted_map', x: 100, y: 100 } };
    const save = deserializePlayerSave(JSON.stringify(raw));
    assert.deepEqual(resolveMapEntry(save.location), { mapId: TOWN_MAP_ID, at: MAPS[TOWN_MAP_ID].spawnPoint, fallback: 'unknown_map' });
  });

  test('an invalid position falls back to that map\'s safe spawn', () => {
    const field = MAPS[FIELD_MAP_ID];
    const bad = [
      { x: 16, y: 16 }, // inside the wall
      { x: -50, y: 300 }, // off the map
      { x: 99999, y: 300 },
      { x: 35 * 32 + 16, y: 6 * 32 + 16 }, // in the pond
      { x: 16, y: 15 * 32 + 16 }, // on a portal trigger
    ];
    for (const p of bad) assert.deepEqual(resolveMapEntry({ mapId: FIELD_MAP_ID, ...p }), { mapId: FIELD_MAP_ID, at: field.spawnPoint, fallback: 'invalid_position' }, JSON.stringify(p));
    // Malformed data never rejects the save: it is dropped (→ default spawn).
    for (const location of [{ mapId: FIELD_MAP_ID, x: 'a', y: 1 }, { mapId: 5 }, 'demo_field', { mapId: FIELD_MAP_ID, x: null, y: 2 }]) {
      const raw = { ...capturePlayerSave(makeSaveTarget(3)), location };
      assert.equal(deserializePlayerSave(JSON.stringify(raw)).location, null, JSON.stringify(location));
    }
  });

  test('a save inside the Dungeon loads at the Dungeon entrance (runs are never restored)', () => {
    const deep = { mapId: CRYPT_MAP_ID, x: 16 * 32, y: 8 * 32 + 16 }; // boss room
    assert.deepEqual(resolveMapEntry(deep), { mapId: CRYPT_MAP_ID, at: MAPS[CRYPT_MAP_ID].spawnPoint, fallback: 'dungeon_entrance' });
  });
});

describe('rules on the new maps', () => {
  const kill = (zone: 'field' | 'dungeon', monsterId: keyof typeof MONSTERS, energy?: number) => {
    const t = makeSaveTarget(25);
    if (energy !== undefined) t.fieldEnergy.set(energy);
    const events = new EventBus<GameEvents>();
    const items: string[] = [];
    events.on('itemAcquired', (e) => items.push(e.itemId));
    const loot = new LootSystem(events, t.inventory);
    loot.rng = () => 0; // every drop would roll
    const exp0 = t.combat.exp + t.combat.level * 1e6;
    const def = MONSTERS[monsterId];
    const decision = grantKillRewards({ id: `${monsterId}-1`, x: 0, y: 0, def }, { zone, fieldEnergy: t.fieldEnergy, progression: t.progression, loot, player: t.player, now: 0, events });
    return { decision, expGained: t.combat.exp + t.combat.level * 1e6 - exp0, drops: loot.drops.length, energy: t.fieldEnergy.current(), gold: t.wallet.get('gold') };
  };

  test('Dungeon mobs (normal, elite, boss) grant 0 EXP, 0 Gold, 0 loot, 0 quest items and use no Field Energy', () => {
    for (const id of ['crypt_skeleton', 'crypt_knight', 'crypt_lord'] as const) {
      const r = kill('dungeon', id);
      assert.deepEqual(r.decision, { exp: false, farmingDrops: false, questDrops: false, energySpent: 0 }, id);
      assert.equal(r.expGained, 0);
      assert.equal(r.drops, 0);
      assert.equal(r.gold, 0);
      assert.equal(r.energy, FIELD_ENERGY.daily);
    }
  });

  test('Field monsters still pay Field Energy by tier, and give nothing at 0 Energy', () => {
    assert.equal(kill('field', 'wolf').energy, FIELD_ENERGY.daily - FIELD_ENERGY.costByTier.normal);
    assert.equal(kill('field', 'elite_boar').energy, FIELD_ENERGY.daily - FIELD_ENERGY.costByTier.elite);
    assert.equal(kill('field', 'grove_guardian').energy, FIELD_ENERGY.daily - FIELD_ENERGY.costByTier.mini_boss);
    assert.ok(kill('field', 'slime').expGained > 0);
    const empty = kill('field', 'mushroom', 0);
    assert.equal(empty.expGained, 0);
    assert.equal(empty.energy, 0);
  });
});

describe('environment / encounter polish (Demo final visual prep)', () => {
  const field = MAPS[FIELD_MAP_ID];
  const crypt = MAPS[CRYPT_MAP_ID];
  const tile = (n: number) => n * 32 + 16;

  test('the Guardian fights inland: with the player beside it, the 960x540 view at zoom 1.65 is never clamped to the map edge', () => {
    const [p] = field.monsterSpawnZones.find((z) => z.monsterId === 'grove_guardian')!.points;
    const halfW = 960 / 1.65 / 2;
    const halfH = 540 / 1.65 / 2;
    const { width, height } = mapSize(field);
    for (const [dx, dy] of [[-60, 0], [60, 0], [0, -50], [0, 50]]) {
      const px = tile(p.tileX) + dx;
      const py = tile(p.tileY) + dy;
      assert.ok(px - halfW >= 0 && px + halfW <= width * 32, `x ${px} clamps the view horizontally`);
      assert.ok(py - halfH >= 0 && py + halfH <= height * 32, `y ${py} clamps the view vertically`);
    }
  });

  test('the Guardian clearing is open: every cell within 3 tiles of its spawn is walkable, and its stones stand outside that', () => {
    const [p] = field.monsterSpawnZones.find((z) => z.monsterId === 'grove_guardian')!.points;
    const grid = mapCollision(FIELD_MAP_ID)!;
    for (let y = p.tileY - 3; y <= p.tileY + 3; y++)
      for (let x = p.tileX - 3; x <= p.tileX + 3; x++)
        if (Math.hypot(x - p.tileX, y - p.tileY) <= 3) assert.ok(!grid.isBlocked(tile(x), tile(y)), `(${x}, ${y}) blocked`);
    const stones = field.props.filter((s) => s.kind === 'standing_stone');
    assert.ok(stones.length >= 4);
    for (const s of stones) assert.ok(Math.hypot(s.x - p.tileX, s.y - p.tileY) > 4, `stone (${s.x}, ${s.y}) inside the fight`);
  });

  test('the Field\'s outer walkway (the ring of cells just inside the border) stays open', () => {
    const grid = mapCollision(FIELD_MAP_ID)!;
    const { width, height } = mapSize(field);
    for (let x = 1; x < width - 1; x++) for (const y of [1, height - 2]) assert.ok(!grid.isBlocked(tile(x), tile(y)), `(${x}, ${y}) blocked`);
    for (let y = 1; y < height - 1; y++) for (const x of [1, width - 2]) assert.ok(!grid.isBlocked(tile(x), tile(y)), `(${x}, ${y}) blocked`);
  });

  test('no solid Field prop stands on water or on the roads', () => {
    for (const s of field.props) {
      const k = PROP_KINDS[s.kind];
      if (!k.solid) continue;
      for (let y = s.y; y < s.y + k.h; y++)
        for (let x = s.x; x < s.x + k.w; x++) assert.ok(![Tile.Water, Tile.Path].includes(field.tiles[y][x]), `${s.kind} at (${x}, ${y})`);
    }
  });

  test('Crypt: webs only in the rooms\' north corners; the runner covers exactly the Carpet tiles', () => {
    const webs = crypt.props.filter((p) => p.kind === 'cobweb' || p.kind === 'cobweb_right');
    assert.ok(webs.length >= 8);
    for (const w of webs) {
      assert.equal(crypt.tiles[w.y][w.x], Tile.DungeonFloor, `web (${w.x}, ${w.y}) on floor`);
      assert.ok(SOLID_TILES.includes(crypt.tiles[w.y - 1][w.x]), `web (${w.x}, ${w.y}) under a wall`);
      const side = w.kind === 'cobweb' ? w.x - 1 : w.x + 1;
      assert.ok(SOLID_TILES.includes(crypt.tiles[w.y][side]), `web (${w.x}, ${w.y}) against its side wall`);
    }
    const [runner] = crypt.props.filter((p) => p.kind === 'carpet_runner');
    const k = PROP_KINDS.carpet_runner;
    const carpet = crypt.tiles.flatMap((row, y) => row.map((t, x) => [t, x, y] as const)).filter(([t]) => t === Tile.Carpet);
    assert.equal(carpet.length, k.w * k.h);
    for (const [, x, y] of carpet) assert.ok(x >= runner.x && x < runner.x + k.w && y >= runner.y && y < runner.y + k.h, `carpet (${x}, ${y}) uncovered`);
  });
});

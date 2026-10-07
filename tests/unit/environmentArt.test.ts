import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { ENV_BUILDINGS, ENV_DRAW_SCALE, ENV_GROUND_MAP_IDS, ENV_GROUND_TILESET, ENV_GROUND_WANG, ENV_PROP_ART, ENV_SOURCE_SCALE, environmentTextureFiles, GROUND_FRAMES } from '../../src/data/environmentArt';
import { MAPS, PROP_KINDS, TOWN_MAP_ID } from '../../src/data/maps';
import { mapCells } from '../../src/world/mapRules';
import { TOWN_GROUND_WANG, TOWN_GROUND_WANG_FRAMES, TOWN_GROUND_WANG_PLAIN } from '../../src/data/environment/townGroundWang';
import { groundFamily, groundVisuals, neighbourMask, wallCells, wangGroundVisuals, wangOverlayCells, wangTerrain } from '../../src/world/groundVisuals';
import { SOLID_TILES, Tile } from '../../src/world/tiles';

const pub = (url: string) => join(process.cwd(), 'public', url);
/** Width / height from a PNG header. */
function pngSize(url: string): { w: number; h: number } {
  const b = readFileSync(pub(url));
  assert.equal(b.toString('ascii', 1, 4), 'PNG', url);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('environment art manifest', () => {
  test('2x source scale, half draw scale', () => {
    assert.equal(ENV_SOURCE_SCALE, 2);
    assert.equal(ENV_DRAW_SCALE, 0.5);
  });

  test('every listed PNG exists; keys are existing prop texture keys (stable) or additive visual keys', () => {
    for (const f of environmentTextureFiles()) assert.ok(existsSync(pub(f.url)), f.url);
    for (const kind of Object.keys(ENV_PROP_ART)) assert.ok(kind in PROP_KINDS, `${kind} is an existing prop kind`);
    const keys = environmentTextureFiles().map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length, 'unique keys');
  });

  test('prop PNGs are 2x art: even sizes, wide enough for the footprint, and not absurdly larger than it', () => {
    for (const [kind, url] of Object.entries(ENV_PROP_ART)) {
      const { w, h } = pngSize(url!);
      const fp = PROP_KINDS[kind as keyof typeof PROP_KINDS];
      assert.ok(w % 2 === 0 && h % 2 === 0, `${kind} ${w}x${h}`);
      const worldW = w * ENV_DRAW_SCALE;
      assert.ok(worldW >= fp.w * 32 * 0.5 && worldW <= fp.w * 32 * 2.5, `${kind}: ${worldW} world px wide for a ${fp.w}-tile footprint`);
    }
  });

  test('the ground tileset holds every frame the visual layer can ask for (64 px frames, margin 2, spacing 4)', () => {
    const { w, h } = pngSize(ENV_GROUND_TILESET.url);
    const t = ENV_GROUND_TILESET;
    const cols = Math.floor((w - 2 * t.margin + t.spacing) / (t.frameSize + t.spacing));
    const rows = Math.floor((h - 2 * t.margin + t.spacing) / (t.frameSize + t.spacing));
    const maxFrame = Math.max(...Object.values(GROUND_FRAMES).map((f) => f.first + f.count - 1));
    assert.ok(cols * rows > maxFrame, `${cols}x${rows} frames for frame ${maxFrame}`);
    assert.equal(w, 2 * t.margin + cols * t.frameSize + (cols - 1) * t.spacing, 'no stray width');
  });

  test('building facades sit exactly on a solid Roof footprint of their map, and are 2x art covering it', () => {
    for (const b of ENV_BUILDINGS) {
      const map = MAPS[b.mapId];
      const f = b.footprint;
      for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) assert.equal(map.tiles[y][x], Tile.Roof, `${b.key} ${x},${y}`);
      const { w, h } = pngSize(b.url);
      assert.equal(w * ENV_DRAW_SCALE, f.w * 32, `${b.key} as wide as its footprint`);
      assert.ok(h * ENV_DRAW_SCALE >= f.h * 32, `${b.key} covers its footprint`);
    }
  });
});

describe('visual ground layer (derived, never collision)', () => {
  const town = MAPS[TOWN_MAP_ID];

  test('only the Town uses it for now', () => {
    assert.deepEqual([...ENV_GROUND_MAP_IDS], [TOWN_MAP_ID]);
  });

  test('every walkable ground family gets a base frame; solid / special tiles get none (the code-drawn tile shows)', () => {
    const v = groundVisuals(town.tiles);
    town.tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        const family = groundFamily(tile);
        if (family) {
          const f = GROUND_FRAMES[family];
          assert.ok(v.base[y][x] >= f.first && v.base[y][x] < f.first + f.count, `${x},${y}`);
        } else assert.equal(v.base[y][x], -1, `${x},${y} tile ${tile}`);
      }),
    );
    for (const family of ['grass', 'cobble', 'dirt', 'plaza', 'trim'] as const) {
      for (const tile of Object.values(Tile)) if (groundFamily(tile) === family) assert.ok(!SOLID_TILES.includes(tile), `${family} tiles are walkable`);
    }
  });

  test('deterministic, same size as the map, and the map tiles / collision are untouched', () => {
    const before = JSON.stringify(town.tiles);
    const cellsBefore = JSON.stringify(mapCells(town));
    const a = groundVisuals(town.tiles);
    const b = groundVisuals(town.tiles);
    assert.deepEqual(a, b);
    assert.equal(a.base.length, town.tiles.length);
    assert.equal(a.base[0].length, town.tiles[0].length);
    assert.equal(JSON.stringify(town.tiles), before);
    assert.equal(JSON.stringify(mapCells(town)), cellsBefore);
  });

  test('transitions: grass spills onto road / stone, dirt onto stone, with the right side mask', () => {
    const G = Tile.Grass;
    const C = Tile.Cobble;
    const P = Tile.Path;
    const tiles = [
      [G, G, G],
      [P, C, G],
      [C, P, C],
    ];
    // Centre cobble: grass N and E (1 | 2 = 3), dirt W and S (8 | 4 = 12).
    assert.equal(neighbourMask(tiles, 1, 1, 'grass'), 3);
    assert.equal(neighbourMask(tiles, 1, 1, 'dirt'), 12);
    const v = groundVisuals(tiles);
    assert.equal(v.grassFringe[1][1], GROUND_FRAMES.grassFringe.first + 3 - 1);
    assert.equal(v.dirtFringe[1][1], GROUND_FRAMES.dirtFringe.first + 12 - 1);
    assert.equal(v.grassFringe[0][0], -1, 'grass never fringes onto grass');
    assert.equal(v.dirtFringe[1][0], -1, 'dirt never fringes onto dirt');
  });
});

describe('corner (Wang) ground on the dual grid (derived, never collision)', () => {
  const town = MAPS[TOWN_MAP_ID];

  test('the atlas holds every frame of the lookup; each tileset maps all 16 corner masks to distinct frames; every terrain has plain variants', () => {
    const { w, h } = pngSize(ENV_GROUND_WANG.url);
    const t = ENV_GROUND_WANG;
    const cols = Math.floor((w - 2 * t.margin + t.spacing) / (t.frameSize + t.spacing));
    const rows = Math.floor((h - 2 * t.margin + t.spacing) / (t.frameSize + t.spacing));
    assert.ok(cols * rows >= TOWN_GROUND_WANG_FRAMES, `${cols}x${rows} for ${TOWN_GROUND_WANG_FRAMES} frames`);
    // Grass, dirt and plaza each pair with cobble (the connector); grass also pairs with dirt (either direction).
    assert.deepEqual(Object.keys(TOWN_GROUND_WANG).map((k) => k.split('|').sort().join('|')).sort(), ['cobble|dirt', 'cobble|grass', 'cobble|plaza', 'dirt|grass']);
    for (const terrain of ['cobble', 'dirt', 'grass', 'plaza']) {
      const frames = TOWN_GROUND_WANG_PLAIN[terrain] ?? [];
      assert.ok(frames.length >= 1, `${terrain} has a plain tile`);
      for (const f of frames) assert.ok(f >= 0 && f < TOWN_GROUND_WANG_FRAMES);
    }
    assert.ok(TOWN_GROUND_WANG_PLAIN.cobble.length >= 2, 'large cobbled areas mix variants');
    const all = Object.values(TOWN_GROUND_WANG).flat();
    for (const masks of Object.values(TOWN_GROUND_WANG)) {
      assert.equal(masks.length, 16);
      assert.equal(new Set(masks).size, 16);
      for (const f of masks) assert.ok(f >= 0 && f < TOWN_GROUND_WANG_FRAMES);
    }
    assert.equal(new Set(all).size, all.length, 'no frame shared between pairs');
  });

  test('every Town vertex touching ground gets a frame; deterministic; map tiles and collision untouched', () => {
    const before = JSON.stringify(town.tiles);
    const cellsBefore = JSON.stringify(mapCells(town));
    const a = wangGroundVisuals(town.tiles, TOWN_GROUND_WANG, TOWN_GROUND_WANG_PLAIN);
    assert.deepEqual(a, wangGroundVisuals(town.tiles, TOWN_GROUND_WANG, TOWN_GROUND_WANG_PLAIN));
    assert.equal(a.length, town.tiles.length + 1);
    assert.equal(a[0].length, town.tiles[0].length + 1);
    for (let vy = 0; vy <= town.tiles.length; vy++)
      for (let vx = 0; vx <= town.tiles[0].length; vx++) {
        const touches = [town.tiles[vy - 1]?.[vx - 1], town.tiles[vy - 1]?.[vx], town.tiles[vy]?.[vx - 1], town.tiles[vy]?.[vx]].some((t) => wangTerrain(t));
        assert.equal(a[vy][vx] >= 0, touches, `vertex ${vx},${vy}`);
      }
    assert.equal(JSON.stringify(town.tiles), before);
    assert.equal(JSON.stringify(mapCells(town)), cellsBefore);
  });

  test('corner masks: a vertex picks the pair tile whose upper corners match the cells around it', () => {
    const G = Tile.Grass;
    const C = Tile.Cobble;
    const P = Tile.Path;
    const W = Tile.Wall;
    const lk = TOWN_GROUND_WANG;
    // Vertex (1,1) between [G C / C C]: grass|cobble, NE + SW + SE upper -> 7.
    assert.equal(wangGroundVisuals([[G, C], [C, C]], lk)[1][1], lk['grass|cobble'][7]);
    // [P P / C C]: dirt|cobble, SW + SE upper -> 3.
    assert.equal(wangGroundVisuals([[P, P], [C, C]], lk)[1][1], lk['dirt|cobble'][3]);
    // [G P / P G]: dirt|grass, NW + SE -> 9.
    assert.equal(wangGroundVisuals([[G, P], [P, G]], lk)[1][1], lk['dirt|grass'][9]);
    // A wall borrows the majority (grass): no transition toward it; a plain tile is one of the terrain's variants.
    const plain = { grass: [101, 102], cobble: [201, 202, 203] };
    assert.ok(plain.grass.includes(wangGroundVisuals([[G, W], [G, G]], lk, plain)[1][1]));
    // Plain variants are picked by position: deterministic, and a large area uses several of them.
    const field = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => C));
    const picked = wangGroundVisuals(field, lk, plain).flat();
    assert.deepEqual(picked, wangGroundVisuals(field, lk, plain).flat());
    assert.equal(new Set(picked).size, 3);
    // Two terrains without a tileset of their own meet through the connector (cobble): never a hole.
    const PZ = Tile.Plaza;
    const viaConnector = wangGroundVisuals([[PZ, PZ], [G, PZ]], lk)[1][1];
    assert.equal(viaConnector, lk['cobble|plaza'][8 | 4 | 1]);
    // Three terrains fold the rarest into the majority: [G G / C P] -> grass majority, cobble kept (tie-break), dirt -> grass.
    assert.equal(wangGroundVisuals([[G, G], [C, P]], lk)[1][1], lk['grass|cobble'][2]);
    // Nothing but walls: no frame.
    assert.equal(wangGroundVisuals([[W, W], [W, W]], lk)[1][1], -1);
  });

  test('the plaza (and its trim ring) is corner ground; the overlay keeps every non-ground cell in its own tile index', () => {
    assert.equal(wangTerrain(Tile.Plaza), 'plaza');
    assert.equal(wangTerrain(Tile.PlazaTrim), 'plaza');
    const o = wangOverlayCells(town.tiles);
    town.tiles.forEach((row, y) => row.forEach((tile, x) => assert.equal(o[y][x], wangTerrain(tile) ? -1 : tile, `${x},${y}`)));
    // With production wall art the Wall cells move to their own layer (a variant per cell); collision is unchanged.
    const withWalls = wangOverlayCells(town.tiles, true);
    const walls = wallCells(town.tiles, [7, 8]);
    town.tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        if (tile === Tile.Wall) {
          assert.equal(withWalls[y][x], -1);
          assert.ok([7, 8].includes(walls[y][x]));
        } else {
          assert.equal(withWalls[y][x], o[y][x]);
          assert.equal(walls[y][x], -1);
        }
      }),
    );
    assert.ok(wallCells(town.tiles, []).flat().every((f) => f === -1), 'no wall art: nothing drawn, the code-drawn walls stay');
    for (const tile of SOLID_TILES) assert.equal(wangTerrain(tile), null, `solid tile ${tile} is never corner ground`);
  });
});

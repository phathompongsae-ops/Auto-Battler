import type { PropKind } from './maps/props';
import { Tile } from '../world/tiles';
import type { WangTerrain } from '../world/groundVisuals';
import { TOWN_GROUND_WALL, TOWN_GROUND_WANG, TOWN_GROUND_WANG_PLAIN } from './environment/townGroundWang';
import { FIELD_GROUND_WANG, FIELD_GROUND_WANG_PLAIN } from './environment/fieldGroundWang';

/*
 * High-resolution environment art (docs/art/town-style-lock.md). PNGs are
 * authored at 2x (64 art px per 32 world px tile) and drawn at half scale with
 * linear filtering, like the character sheets. Every entry REPLACES an
 * existing texture key (or adds a visual-only one); the code-drawn
 * placeholders stay the fallback whenever a file is not listed or fails to load.
 * Nothing here touches collision, map data or navigation.
 *
 * Only list files that exist in public/ (a missing listed file is a load
 * error); tests check every listed file is on disk.
 */

/** Source pixels per world pixel of environment PNGs. */
export const ENV_SOURCE_SCALE = 2;

/** Draw scale for environment PNGs (world px per source px). */
export const ENV_DRAW_SCALE = 1 / ENV_SOURCE_SCALE;

const DIR = 'assets/environment/town';
const FIELD = 'assets/environment/field';
const DUNGEON = 'assets/environment/dungeon';

/**
 * 2x PNGs replacing `prop-<kind>` placeholder textures (same key, same footprint).
 * Field and Crypt entries come from the reviewed Visual Pass 2 candidates
 * (tools/env-art/pass2-jobs.json); stone crypt props are cooled toward the crypt ground.
 */
export const ENV_PROP_ART: Partial<Record<PropKind, string>> = {
  // Field
  tree: `${FIELD}/props/tree.png`,
  pine: `${FIELD}/props/pine.png`,
  cave: `${FIELD}/props/cave.png`,
  // Visual Pass 3 (PixelLab objects, tools/env-art/pass3-jobs.json)
  bush: `${FIELD}/props/bush.png`,
  rock: `${FIELD}/props/rock.png`,
  big_rock: `${FIELD}/props/big_rock.png`,
  signpost: `${FIELD}/props/signpost.png`,
  tent: `${FIELD}/props/tent.png`,
  campfire: `${FIELD}/props/campfire.png`,
  stump: `${FIELD}/props/stump.png`,
  // Crypt
  pillar: `${DUNGEON}/props/pillar.png`,
  torch: `${DUNGEON}/props/torch.png`,
  brazier: `${DUNGEON}/props/brazier.png`,
  throne: `${DUNGEON}/props/throne.png`,
  bones: `${DUNGEON}/props/bones.png`,
  rubble: `${DUNGEON}/props/rubble.png`,
  // Town
  monument: `${DIR}/props/monument.png`,
  anvil: `${DIR}/props/anvil.png`,
  cherry_tree: `${DIR}/props/cherry_tree.png`,
  flower_bed: `${DIR}/props/flower_bed.png`,
  lamp_post: `${DIR}/props/lamp_post.png`,
  barrel: `${DIR}/props/barrel.png`,
  crates: `${DIR}/props/crates.png`,
  market_stall: `${DIR}/props/market_stall.png`,
  enchant_crystal: `${DIR}/props/enchant_crystal.png`,
  fountain: `${DIR}/props/fountain.png`,
  statue: `${DIR}/props/statue.png`,
  bench: `${DIR}/props/bench.png`,
  notice_board: `${DIR}/props/notice_board.png`,
  plaza_mosaic: `${DIR}/props/plaza_mosaic.png`,
  pet_house: `${DIR}/props/pet_house.png`,
  workbench: `${DIR}/props/workbench.png`,
  gate_arch: `${DIR}/props/gate_arch.png`,
  flowers: `${DIR}/props/flowers.png`,
  grass_tuft: `${DIR}/props/grass_tuft.png`,
};

/**
 * The visual ground tileset: 64 px frames with 2 px extruded borders
 * (margin 2, spacing 4) so linear filtering never bleeds between frames.
 * Frame order is fixed (see GROUND_FRAMES); the generator writes it.
 */
export const ENV_GROUND_TILESET = {
  key: 'env-ground-town',
  url: `${DIR}/ground/town_ground.png`,
  frameSize: 64,
  margin: 2,
  spacing: 4,
} as const;

/**
 * Production ground (PixelLab corner tilesets): one atlas of 64 px frames
 * (margin 2, spacing 4) drawn on a dual grid; the frame for each terrain
 * pair and corner mask comes from the generated TOWN_GROUND_WANG lookup.
 * Wins over the stand-in ground when present.
 */
export const ENV_GROUND_WANG = {
  key: 'env-ground-town-wang',
  url: `${DIR}/ground/town_ground_wang.png`,
  frameSize: 64,
  margin: 2,
  spacing: 4,
} as const;

/** First frame and variant count of each visual ground family in the tileset. */
export const GROUND_FRAMES = {
  grass: { first: 0, count: 4 },
  cobble: { first: 4, count: 4 },
  dirt: { first: 8, count: 3 },
  plaza: { first: 11, count: 2 },
  trim: { first: 13, count: 2 },
  /** Transition overlays by neighbour mask 1..15 (bit 1 N, 2 E, 4 S, 8 W): frame = first + mask - 1. */
  grassFringe: { first: 15, count: 15 },
  dirtFringe: { first: 30, count: 15 },
} as const;

/**
 * A simple per-tile ground skin: every cell of a listed tile kind draws one of
 * its frames (picked by a stable hash of the cell, so variants never shimmer)
 * from a 64 px atlas (margin 2, spacing 4) at half scale. Visual only; tile kinds
 * not listed keep their code-drawn art, and map.tiles stays the collision source.
 */
export interface EnvTileSkin {
  kind: 'tiles';
  key: string;
  url: string;
  frameSize: number;
  margin: number;
  spacing: number;
  /** Tile index -> atlas frames (variants). */
  tiles: Readonly<Partial<Record<number, readonly number[]>>>;
  /** Show a (code-drawn) wall face on every wall cell directly above a walkable cell. Visual only. */
  wallFaces?: boolean;
}

/**
 * Corner (Wang) ground on a dual grid: an atlas of 64 px frames (margin 2,
 * spacing 4), the frame per terrain pair and corner mask, plain-tile variants,
 * optional wall-top frames, and the connector terrain that bridges two terrains
 * without a shared corner set. Visual only; map.tiles stays the collision source.
 */
export interface EnvWangGround {
  kind: 'wang';
  key: string;
  url: string;
  frameSize: number;
  margin: number;
  spacing: number;
  lookup: Readonly<Record<string, readonly number[]>>;
  plain: Readonly<Partial<Record<WangTerrain, readonly number[]>>>;
  /** Self-tiling wall-top frames for Wall cells (empty: code-drawn walls). */
  wall: readonly number[];
  connector: WangTerrain;
  /** Town only: fall back to the older stand-in tile layer when this atlas is unavailable. */
  standIn?: boolean;
}

/** How each map's ground is drawn: corner ground, a tile skin, or (unlisted) code-drawn only. */
export type EnvMapGround = EnvWangGround | EnvTileSkin;

/**
 * Per-map ground art. Town: the PixelLab corner tilesets. Field (Visual Pass 3):
 * the same approved grass / dirt art plus derived dark-grass, moss and water
 * sets (tools/env-art/buildFieldGround.mjs). Crypt: a stone tile skin.
 */
export const ENV_MAP_GROUND: Readonly<Record<string, EnvMapGround>> = {
  demo_town: {
    kind: 'wang',
    ...ENV_GROUND_WANG,
    lookup: TOWN_GROUND_WANG,
    plain: TOWN_GROUND_WANG_PLAIN as EnvWangGround['plain'],
    wall: TOWN_GROUND_WALL,
    connector: 'cobble',
    standIn: true,
  },
  demo_field: {
    kind: 'wang',
    key: 'env-ground-field-wang',
    url: 'assets/environment/field/ground/field_ground_wang.png',
    frameSize: 64,
    margin: 2,
    spacing: 4,
    lookup: FIELD_GROUND_WANG,
    plain: FIELD_GROUND_WANG_PLAIN as EnvWangGround['plain'],
    // The border wall is woodland, not masonry: shaded forest floor (the dark-grass frames) under the edge trees.
    wall: FIELD_GROUND_WANG_PLAIN.darkgrass,
    // Every Field terrain has a corner set with grass.
    connector: 'grass',
  },
  demo_crypt: {
    kind: 'tiles',
    key: 'env-ground-crypt',
    url: `${DUNGEON}/ground/crypt_ground.png`,
    frameSize: 64,
    margin: 2,
    spacing: 4,
    // Floor: the graded stone in four mirror variants; wall top: two.
    tiles: { [Tile.DungeonFloor]: [0, 1, 2, 3], [Tile.DungeonWall]: [4, 5] },
    // Rooms read as walled chambers: a stone face along each room's north edge.
    wallFaces: true,
  },
};

/** Maps whose ground uses corner (Wang) ground (others use a tile skin or the code-drawn tiles only). */
export const ENV_GROUND_MAP_IDS: readonly string[] = Object.keys(ENV_MAP_GROUND).filter((id) => ENV_MAP_GROUND[id].kind === 'wang');

const tileSkins = () => Object.values(ENV_MAP_GROUND).filter((g): g is EnvTileSkin => g.kind === 'tiles');
const extraWangAtlases = () => Object.values(ENV_MAP_GROUND).filter((g): g is EnvWangGround => g.kind === 'wang' && g.key !== ENV_GROUND_WANG.key);

/**
 * Building façades drawn over a map's `Roof`-tile footprint (visual only:
 * the Roof tiles stay the collision). Non-solid decoration props inside the
 * footprint (banners...) are hidden while the façade is shown; the façade
 * carries its own. Art is bottom-centred on the footprint.
 */
export interface EnvBuildingArt {
  key: string;
  url: string;
  mapId: string;
  /** Footprint in tiles; must equal a solid `Roof` rectangle of the map. */
  footprint: { x: number; y: number; w: number; h: number };
}

export const ENV_BUILDINGS: readonly EnvBuildingArt[] = [
  { key: 'building-forge', url: `${DIR}/buildings/forge.png`, mapId: 'demo_town', footprint: { x: 34, y: 2, w: 8, h: 5 } },
  { key: 'building-job-hall', url: `${DIR}/buildings/job_hall.png`, mapId: 'demo_town', footprint: { x: 3, y: 2, w: 8, h: 5 } },
  { key: 'building-enchant-hall', url: `${DIR}/buildings/enchant_hall.png`, mapId: 'demo_town', footprint: { x: 3, y: 24, w: 7, h: 5 } },
  { key: 'building-hall-of-legends', url: `${DIR}/buildings/hall_of_legends.png`, mapId: 'demo_town', footprint: { x: 16, y: 1, w: 13, h: 3 } },
  { key: 'building-workshop', url: `${DIR}/buildings/workshop.png`, mapId: 'demo_town', footprint: { x: 34, y: 24, w: 8, h: 5 } },
  { key: 'building-pet-stable', url: `${DIR}/buildings/pet_stable.png`, mapId: 'demo_town', footprint: { x: 18, y: 26, w: 9, h: 4 } },
];

/** Every PNG the environment art loads, by texture key. */
export function environmentTextureFiles(): { key: string; url: string; kind: 'prop' | 'ground' | 'building' }[] {
  return [
    ...Object.entries(ENV_PROP_ART).map(([kind, url]) => ({ key: `prop-${kind}`, url: url!, kind: 'prop' as const })),
    { key: ENV_GROUND_TILESET.key, url: ENV_GROUND_TILESET.url, kind: 'ground' as const },
    { key: ENV_GROUND_WANG.key, url: ENV_GROUND_WANG.url, kind: 'ground' as const },
    ...extraWangAtlases().map((g) => ({ key: g.key, url: g.url, kind: 'ground' as const })),
    ...tileSkins().map((s) => ({ key: s.key, url: s.url, kind: 'ground' as const })),
    ...ENV_BUILDINGS.map((b) => ({ key: b.key, url: b.url, kind: 'building' as const })),
  ];
}

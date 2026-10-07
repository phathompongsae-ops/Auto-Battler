import type { PropKind } from './maps/props';

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

/** 2x PNGs replacing `prop-<kind>` placeholder textures (same key, same footprint). */
export const ENV_PROP_ART: Partial<Record<PropKind, string>> = {
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

/** Maps whose ground uses the visual layer (others keep the code-drawn tiles only). */
export const ENV_GROUND_MAP_IDS: readonly string[] = ['demo_town'];

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
    ...ENV_BUILDINGS.map((b) => ({ key: b.key, url: b.url, kind: 'building' as const })),
  ];
}

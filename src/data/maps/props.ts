/*
 * Map props: landmarks and decoration placed on top of the tiles (fountains,
 * stalls, statues, trees, torches...). Data only; the PLACEHOLDER art is drawn
 * in graphics/propTextures.ts. A solid prop blocks movement on its footprint
 * (collision is tiles + solid prop footprints, see world/mapRules).
 */

export interface PropKindDef {
  /** Footprint in tiles (top-left = the placement tile). The art may rise above it. */
  w: number;
  h: number;
  /** Blocks walking on the footprint. */
  solid: boolean;
  /** Also stops projectiles (tall things; low props let them fly over). */
  tall?: boolean;
  /** Flat ground decoration drawn under every character. */
  ground?: boolean;
}

const PROP_KIND_DEFS = {
  // Town
  fountain: { w: 4, h: 2, solid: true },
  monument: { w: 4, h: 2, solid: true, tall: true },
  statue: { w: 1, h: 1, solid: true, tall: true },
  market_stall: { w: 3, h: 2, solid: true, tall: true },
  lamp_post: { w: 1, h: 1, solid: true, tall: true },
  bench: { w: 2, h: 1, solid: true },
  flower_bed: { w: 2, h: 1, solid: true },
  cherry_tree: { w: 1, h: 1, solid: true, tall: true },
  barrel: { w: 1, h: 1, solid: true },
  crates: { w: 1, h: 1, solid: true },
  banner: { w: 1, h: 1, solid: false, tall: false },
  anvil: { w: 1, h: 1, solid: true },
  enchant_crystal: { w: 1, h: 1, solid: true, tall: true },
  workbench: { w: 2, h: 1, solid: true },
  pet_house: { w: 2, h: 1, solid: true },
  notice_board: { w: 2, h: 1, solid: true, tall: true },
  gate_arch: { w: 2, h: 1, solid: false },
  plaza_mosaic: { w: 5, h: 3, solid: false, ground: true },
  // Field
  tree: { w: 1, h: 1, solid: true, tall: true },
  pine: { w: 1, h: 1, solid: true, tall: true },
  bush: { w: 1, h: 1, solid: true },
  rock: { w: 1, h: 1, solid: true },
  big_rock: { w: 2, h: 2, solid: true, tall: true },
  stump: { w: 1, h: 1, solid: true },
  cave: { w: 3, h: 2, solid: true, tall: true },
  giant_mushroom: { w: 1, h: 1, solid: true, tall: true },
  ruin_pillar: { w: 1, h: 1, solid: true, tall: true },
  standing_stone: { w: 1, h: 1, solid: true, tall: true },
  tent: { w: 2, h: 2, solid: true, tall: true },
  signpost: { w: 1, h: 1, solid: false },
  campfire: { w: 1, h: 1, solid: false, ground: true },
  flowers: { w: 1, h: 1, solid: false, ground: true },
  grass_tuft: { w: 1, h: 1, solid: false, ground: true },
  pebbles: { w: 1, h: 1, solid: false, ground: true },
  small_mushrooms: { w: 1, h: 1, solid: false, ground: true },
  // Dungeon
  pillar: { w: 1, h: 1, solid: true, tall: true },
  torch: { w: 1, h: 1, solid: false },
  brazier: { w: 1, h: 1, solid: true },
  sarcophagus: { w: 1, h: 2, solid: true },
  throne: { w: 3, h: 2, solid: true, tall: true },
  bones: { w: 1, h: 1, solid: false, ground: true },
  rubble: { w: 1, h: 1, solid: false, ground: true },
  /** Corner webs: anchored in a room's north-west / north-east corner tile. */
  cobweb: { w: 1, h: 1, solid: false },
  cobweb_right: { w: 1, h: 1, solid: false },
  crypt_banner: { w: 1, h: 1, solid: false },
  rune_circle: { w: 3, h: 3, solid: false, ground: true },
  /** The throne-room runner laid over the Carpet tiles (visual only; the tiles stay the floor). */
  carpet_runner: { w: 4, h: 15, solid: false, ground: true },
} satisfies Record<string, PropKindDef>;

export type PropKind = keyof typeof PROP_KIND_DEFS;
export const PROP_KINDS: Record<PropKind, PropKindDef> = PROP_KIND_DEFS;

export interface PropPlacement {
  kind: PropKind;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
}

export const PROP_KIND_IDS = Object.keys(PROP_KINDS) as PropKind[];

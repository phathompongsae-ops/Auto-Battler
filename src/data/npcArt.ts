/*
 * Production NPC figures (docs/art/npc-production-brief.md). One static
 * south-facing master per NPC, fitted to the SAME contract as the Class 1
 * character masters (art-source/characters/class1_masters_manifest.json), so
 * an NPC stands on the player's feet line at the player's scale:
 *   - 192×192 transparent canvas, feet (last boot row) on row 153, body axis
 *     between columns 94 and 95, head top to boot bottom ~118–125 px;
 *   - drawn at 40 / 125 = 0.32 (≈ 38–40 world px tall) with linear filtering.
 * The fitter (art-source/npcs/tools/fit-npc.mjs) writes files that already
 * meet it. Only list files that exist in public/ (a missing listed file is a
 * load error; a unit test checks); an NPC without an entry keeps the
 * code-drawn tinted chibi (graphics/placeholderTextures.ts).
 */

export const NPC_ART_CONTRACT = {
  canvas: 192,
  /** Source row the boots stand on (the last opaque row of the feet). */
  feetRow: 153,
  /** Mirror axis in pixel-edge coordinates (between columns 94 and 95). */
  axisX: 95,
  /** Source px of a reference-height body (head top to boot bottom). */
  referenceHeight: 125,
  /** World px of that body on screen (the Warrior's). */
  worldHeight: 40,
} as const;

/** World scale NPC masters are drawn at. */
export const NPC_ART_SCALE = NPC_ART_CONTRACT.worldHeight / NPC_ART_CONTRACT.referenceHeight;

const DIR = 'assets/npcs';

/** Delivered, fitted NPC masters by NPC id (Codex image_gen originals in art-source/npcs/<id>/raw.png, fitted by the brief's fitter). */
export const NPC_ART: Readonly<Partial<Record<string, string>>> = {
  npc_captain_rowan: `${DIR}/captain_rowan.png`,
  npc_smith_brann: `${DIR}/smith_brann.png`,
  npc_enchanter_lyra: `${DIR}/enchanter_lyra.png`,
  npc_crafter_odo: `${DIR}/crafter_odo.png`,
  npc_stablekeeper_mira: `${DIR}/stablekeeper_mira.png`,
  demo_job_instructor: `${DIR}/job_instructor.png`,
};

/** Every NPC art file a delivery is expected to provide (path per NPC id), for the brief and the fitter. */
export const NPC_ART_TARGETS: Readonly<Record<string, string>> = {
  npc_captain_rowan: `${DIR}/captain_rowan.png`,
  npc_smith_brann: `${DIR}/smith_brann.png`,
  npc_enchanter_lyra: `${DIR}/enchanter_lyra.png`,
  npc_crafter_odo: `${DIR}/crafter_odo.png`,
  npc_stablekeeper_mira: `${DIR}/stablekeeper_mira.png`,
  demo_job_instructor: `${DIR}/job_instructor.png`,
};

export const npcArtKey = (npcId: string) => `npc-art-${npcId}`;

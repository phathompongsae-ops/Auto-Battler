# Grove Guardian production provenance

**Approved identity:** the project-generated `art-source/candidates/demo-v1-20261007/sources/D5-grove_guardian_idle.png`
(Pass 2, Codex `image_gen`), archived unchanged as `source/approved-idle.png`. It is the source of the shipped
fallback `public/assets/monsters/grove_guardian.png`. No third-party art was used as a reference.

**Identity lock:**

- Build: a broad, compact chibi wood golem with a thick rounded trunk torso.
- Head: a carved bark mask with three antler-like prongs and ONE amber eye.
- Body detail: a small amber heart gem, and rounded leaf-green moss on the head, shoulders, fists and knees.
- Limbs: oversized wooden fists, short sturdy legs and splayed root feet.
- Colour and line: warm tan/brown wood with dark brown outlines.
- View: elevated oblique, east-facing; west is runtime mirroring.

**Generation:** Codex built-in `image_gen` (model name not exposed) produced four action sheets on 2026-10-11.
The approved idle was the only reference image. Exact prompts are in `prompts/`, and the accepted sheets are in
`source/`.

| Sheet | Attempts | Layout |
|---|---|---|
| walk | 2 | 3×3 |
| attack | 2 | 3×2 |
| special | 3, first kept | 3×4, 11 figures |
| hit | 1 | 2×2 |

Each sheet's top-left figure is an unchanged standing scale anchor. Rejected attempts were not saved. The special
sheet stores a brown-green colour only under fully transparent pixels; the fitter weights colour by alpha, so it
cannot bleed in. No halo was measured on any sheet.

## Reproduce (repository root)

1. `node art-source/monsters/grove_guardian/pass-4b/tools/spec.mjs SHEET STATE 133 heart|backfoot` writes
   `fit/STATE.json`. The specs in this archive were made with: walk `heart`; attack, special and hit `backfoot`.
2. `node art-source/monsters/grove_guardian/pass-4b/tools/fit.mjs art-source/monsters/grove_guardian/pass-4b/fit/STATE.json`
   writes `fit/STATE.png`. Idle uses the hand-written `fit/idle.json` on `source/approved-idle.png`.
3. Copy the result to `public/assets/monsters/grove_guardian/STATE.png`. The fit PNGs are git-ignored duplicates.
4. Validate with `node tools/monster-art/stripMetrics.mjs OUT 208 160 158`, adding `124 140` for idle / walk.
5. Optionally, `tools/review.mjs` writes contact sheets and a field-hierarchy lineup to `test-results/guardian-art-review/`.

How fitting works:

- **One scale per sheet:** the sheet's anchor figure is scaled to the locked 133 px standing height (the idle's
  height, the Guardian's established size). No frame is resized on its own.
- **Root per frame:** walk keeps the chest gem fixed while the legs alternate. Attack, Stomp and hit keep the
  planted back foot fixed, so lunges, the lifted leg and recoils never slide the root.
- **Shared fitter:** premultiplied-alpha area resampling, source alpha < 12 removed, output alpha < 4 removed,
  and connected-alpha isolation of each figure.

## Measurements

| State | Frames / fps | Size | Visible height (px) |
|---|---|---|---|
| idle | 2 / 3 | 416×160 | 133–133 |
| walk | 8 / 8 | 1664×160 | 132–135 |
| attack | 5 / 12 | 1040×160 | 130–135 |
| special | 10 / 12 | 2080×160 | 111–149 (raised 148–149, impact crouch 111–121) |
| hit | 3 / 15 | 624×160 | 124–130 |

All cells are 208×160 with the lowest visible row at 157. Rows 158–159 have zero alpha and nothing touches an
edge. The runtime origin is [104, 103.4] at draw scale 0.5. The world body [-21, +4.2, 42, 25.2], hit radius 22,
speed and shadow are unchanged.

Timing is data-driven: Stomp holds frames 3–4 until the 1000 ms game-time wind-up, then shows first impact frame 5
on the damage tick. Death keeps the existing squash / fade. No gameplay value changed.

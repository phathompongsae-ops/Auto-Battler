# Crypt Lord production provenance

Approved identity: project-generated `art-source/candidates/demo-v1-20261007/sources/D8-crypt_lord_idle.png`, selected by Pass 2's job registry. The unchanged source is archived as `source/approved-idle.png`; no third-party pack was used as a generation reference.

Identity lock: smooth pale chibi face with red eyes (not a bare skull), swept ivory hair, bronze spiked crown with blue diamond, charcoal/navy plate with bronze trims, skull pauldron, purple scarf/ragged cape, broad pointed steel sword with bronze crossguard. Elevated oblique east-facing source; west is runtime mirroring.

Built-in `image_gen` produced six action-sheet candidates on 2026-10-11. Four were accepted: walk, attack, special, hit. Two original special sheets were rejected for shrinking the body to accommodate the raised sword; they remain disposable review output outside this archive. Idle reuses the approved two-frame source. The tool did not expose an underlying model identifier. Exact accepted prompts are in `prompts/`.

## Reproduce from the repository root

Run `node art-source/monsters/crypt_lord/pass-4b/tools/fit.mjs art-source/monsters/crypt_lord/pass-4b/fit/STATE.json` for idle, walk, attack, special and hit. The JSON specs select source poses, source root translations and a fixed scale per sheet. Scale is derived from each sheet's unchanged standing anchor to match the locked 159 px idle; the walk anchor uses 161 px to keep its stepping silhouettes within 150–168. No frame is independently resized. Special uses one source sheet and one scale for all ten poses.

Fitting uses the shared repository PNG codec, connected-alpha pose isolation where neighbouring bounding boxes overlap, premultiplied-alpha area resampling, removal of source alpha below 12 and output alpha below 4. Anti-aliased edges are retained. Hidden RGB in alpha-zero source backgrounds is discarded; it is not painted into the runtime PNGs. Components are selected by stable ids from `tools/components.mjs`. Check all spec boxes/root translations before replacing a source sheet.

Canonical outputs are `public/assets/monsters/crypt_lord/{idle,walk,attack,special,hit}.png`. Local fit PNGs are ignored to avoid archiving duplicate runtime files. Run `node tools/monster-art/stripMetrics.mjs OUTPUT 224 192 190` (append `150 168` for idle/walk). Unit tests also assert every alpha value in rows 190–191 is zero, including faint antialiasing. Run `tools/review.mjs` for disposable per-state contacts, a full-state sheet and a true-world-scale hierarchy lineup under `test-results/lord-art-review/`.

## Measurements and limits

| State | Size | Visible height range (source px) |
|---|---|---|
| idle | 448×192 | 155–159 |
| walk | 1792×192 | 151–158 |
| attack | 1120×192 | 136–159 |
| special | 2240×192 | 118–167 |
| hit | 672×192 | 143–155 |

All cells are 224×192, lowest visible pixel row 189, bottom rows 190–191 fully clear, no edge contact. Raised swords and crouches change the silhouette bounds without changing the fitting scale. Sword tips contaminate simple lowest-alpha-band foot centroids; they are not a reliable body-root measurement. Root was reviewed visually with both facings, against the runtime shadow; the renderer's origin remains [112,125], body remains [-25,+5,50,30], hit radius 24, draw scale 0.5, feet line +32.5 world px. No baked shadow or VFX.

Timing remains data-driven: idle 2@3, walk 8@8, attack 5@12 contact-first, special 10@12 (raise3/hold2/impact2/recovery3), hit3@15. Special holds until 1100 ms game time, then uses first impact frame 5. Death remains the existing squash/fade. No gameplay timing or stats changed.

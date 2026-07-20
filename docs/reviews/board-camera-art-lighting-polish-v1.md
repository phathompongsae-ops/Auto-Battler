# Board / Camera / Art Direction / Lighting Polish v1

**Status: READY_FOR_VISUAL_HUMAN_REVIEW**

Visual-presentation-only polish of the demo Runtime, built on the Runtime-Human-Approved Caster
build (PR #88 head `75e735d9777845b42c85d5884262611a909e7f91`, verified live: open, Draft,
unmerged, clean). No gameplay, Combat ordering, balance, board topology, motion timing, motion
binary, Skill/Cast, projectile, or VFX change.

## User visual direction

The user explicitly rejected the previous demo presentation (board appearance/layout/framing,
camera viewpoint, art direction, lighting, shadows, color grading, UI tone) and asked for a look
much closer to their reference in mood, color, camera feel, framing, composition density, and UI
tone: dark fantasy, warm stone/brown/gold, dark UI with restrained gold, compact tactical board,
slightly top-down tilted camera, board clearly centered, cohesive lighting. The reference was used
for **direction only** — this is an original Auto-Battler interpretation; no external UI frames,
icons, artwork, logos, motifs, or measurements were copied, and no external asset was imported
(every change is a parameter/palette/procedural-canvas change to in-repo content).

## Audit — why the old view failed

- **Too wide/flat**: `BOARD_FILL_RATIO 0.97` stretched the board to ~97% of viewport height and,
  at 45° pitch, nearly the full landscape width; `BOARD_DOWN_BIAS 0.97` crammed it against the
  bottom edge.
- **Too yellow**: yellow ambient (0x8a7a68 @0.9) + orange key (0xffb060) over yellow-brown stone
  tiles (#6e6552/#5d5645).
- **Too dev-like**: pale green/blue zone tints (0xb7c9b4/0xbfc4cf) read as a debug grid.
- **Disconnected**: warm bright board inside a navy world (ground #23283a, rim 0x2c3448, navy
  banners, navy UI) split the scene into two color worlds.
- **Shadows**: `renderer.shadowMap` was never enabled; units are billboarded alpha-tested sprite
  planes, so a true shadow map would cast the rectangular card, not the character silhouette.

## Changes (smallest effective set)

| Area | Before | After |
|---|---|---|
| Camera pitch | 45° | **56°** (top-down tactical, tilt retained) |
| Look target z | 1.3 | 0.9 |
| Board fill ratio | 0.97 (edge-to-edge) | **0.80** (~65–75% of the useful combat viewport) |
| Down bias | 0.97 (bottom-crammed) | **0.62** (centered, slightly low) |
| Tile stone | #6e6552 / #5d5645 | **#5c5344 / #4c453a** (warm dark stone) |
| Zone tints | pale green / pale blue / brown | faint warm / faint neutral / dark warm |
| Ground | navy mosaic, tint 0x9aa0b8 | warm charcoal mosaic, tint 0x8f877a |
| Stage rim / banners | navy / navy+blue | warm dark stone / deep crimson |
| Background+fog | 0x1c1510, 18–34 | **0x131009, 15–30** |
| Ambient | 0x8a7a68 @0.9 | 0x767069 @0.72 |
| Key light | 0xffb060 @0.7 | 0xffcd92 @0.85 |
| Fill light | none | **NEW** cool fill 0x5f6d8c @0.3 |
| Board underglow | none | **NEW** procedural warm radial glow under board |
| Unit grounding | blob opacity 0.35 | **0.46** (named const, all 4 call sites) |
| UI theme | navy panels + gold | **warm charcoal-stone panels + gold** (accents unchanged) |

All lights remain plain `DirectionalLight`/`AmbientLight` — no shadow maps, no added point
lights; render cost is effectively unchanged. The camera changes flow through the existing
contain-fit `layoutBoard()` and the live raycaster, so no gameplay coordinate was touched.
A `projectToScreen` helper was added to the existing test hook (test-only) to verify
pointer-to-grid mapping with real pointer events.

## Shadow/grounding decision (honest limitation)

True dynamic shadows are unsuitable for this sprite architecture — a shadow map would project
each unit's rectangular billboard card, not its silhouette. Per the task's fallback, the smallest
original grounding treatment was applied instead (stronger contact blob under the new, clearer
key-light direction), and **no baked shadow was added to any approved motion frame**.

## Evidence (`docs/reviews/board-camera-art-lighting-polish-v1/evidence/`)

- 20 before/after screenshots: `{before,after}-{desktop,narrow}-{empty,3units,5units,7units,attack}`
  — Mage/Summoner/Acolyte together (incl. duplicates), opposing facing, Basic Attack in progress,
  all HUD areas visible. Desktop 1280×800, narrow 900×440.
- Clips: `videos/after-battle-x1.webm`, `videos/after-battle-x4.webm` — real `spawnWave()` battles.
- Contact sheets: `shots/contact-board-camera.png`, `shots/contact-lighting-color.png`,
  `shots/contact-ui-composition.png`.
- `capture-summary.json` — structured results.

## Regression results

- **Interaction** (both viewports): real shop-card buy → bench unit ✓; bench tap-select →
  tile tap placed at exactly (2,4) ✓; post-resize field-unit **drag** landed at exactly (5,4) ✓
  (field units reposition by drag only — tap toggles Link; pre-existing intended behavior,
  unchanged). 0 console errors.
- **Caster motion regression**: full deterministic suite re-run against this build — state
  transitions, character isolation, facing, repeated Basic Attack at x1 **and x4**, multi-unit
  independence, lifecycle/disposal, non-caster regression — **all assertions passed**, 0 console
  errors, 0 asset-load failures.
- **Gameplay preservation**: `GRID_COLS/GRID_ROWS/TILE/BENCH_ROW/MAX_BENCH/PLAYER_ROWS`
  untouched; no stat, timing, targeting, economy, or Combat-ordering value changed.

## Board Preview status

Previously `DEFERRED_UNTIL_AFTER_DEMO`. This task adds an **in-Runtime visual-polish candidate,
pending Human Review** — it is *not* marked final or canonical, and the full game art direction
is *not* claimed final.

## Human Decision Sheet (all pending — no approval preselected)

- [ ] Board framing acceptable — **pending**
- [ ] Camera angle acceptable — **pending**
- [ ] Board proportion acceptable — **pending**
- [ ] Environment cohesion acceptable — **pending**
- [ ] Lighting acceptable — **pending**
- [ ] Shadow/grounding acceptable — **pending**
- [ ] Color grading acceptable — **pending**
- [ ] UI tone acceptable — **pending**
- [ ] Desktop layout acceptable — **pending**
- [ ] Narrow/mobile-like layout acceptable — **pending**
- [ ] Overall visual direction acceptable — **pending**

## Known limitations

- True dynamic shadows unimplemented (sprite architecture — see above).
- Non-caster heroes/monsters still placeholder art; they inherit the new lighting only.
- Torches/banners/pillars remain simple procedural props; premium set-dressing beyond
  palette/lighting is future art-direction work.
- Headless-browser evidence at 2 viewports; the user's own device review is the deciding pass.
- Repo board is 8 cols × 7 rows (bottom row = merged bench, per repo history); topology untouched.
- Correction rounds used: 0 of 2 allowed per area.

## Scope

Changed paths: `src/game.js` (visual parameters/underglow/test-helper only), `autochess.html`
(CSS theme), the Caster Runtime validator's changed-path allowlist (extended for this branch's
authorized polish paths only), this record, the review JSON, the validator, and the evidence
directory. PR #88 not modified. No merge, no auto-merge.

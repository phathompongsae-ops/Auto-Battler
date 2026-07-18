# Asset & Animation Framework Runtime v1 — Archer / Slime / Golem pilot

Smallest stable shared framework that proves the **asset + animation pipeline** for the three
contract pilots (PR #21 `coco/asset-pilot-integration-contract-v1`,
`data/design/asset-pilot-integration-v1.json`) **without rewriting the Combat loop**. The
framework OBSERVES existing per-unit logical state and drives a separate VISUAL layer —
multi-frame animation, facing, and layered Skill/projectile/impact VFX — on top of the existing
render objects.

- **CC owns** the runtime/framework (this module). **ChatGPT owns** final Archer/Slime/Golem
  image generation. **Coco does not generate images.** This module ships only clearly-labelled
  **technical placeholders** (programmatic colored frame strips) and never marks a placeholder
  canonical — `canonicalApproved` stays `false` until an exact file is explicitly approved.

## Files changed

| File | Change |
|---|---|
| `src/asset-animation-runtime.js` | **New** — the whole framework (DOM/THREE-free core + feature-detected browser adapter). |
| `src/game.js` | Five one-line, null-guarded hooks (below). No combat/economy/balance change. |
| `autochess.html` | Load the module before `game.js`; add the dev-only `#aafDebug` panel. |
| `tools/test-asset-animation-runtime.mjs` | **New** — Node test of the pure core. |
| `docs/ASSET_ANIMATION_FRAMEWORK_RUNTIME_V1.md` | This document. |

## Pilot identity (real runtime keys — no remap, no fabricated bosses)

| Pilot id | Role | Runtime match | Existing visual before |
|---|---|---|---|
| `hero.archer` | player hero | `heroKey === 'archer'` (sprite `'Sniper'`) | 8-frame Sniper sheet (placeholder mapping) |
| `monster.slime` | normal enemy | enemy `name` prefix `Slime` | geometric box (no sprite key) |
| `monster.golem` | large monster / Stage-5 miniboss visual | `sprite === 'Golem'` | 1-frame `mon_golem.png` |

The Stage 5 canonical boss pool is unchanged; Warden is **not** remapped; no boss identity is
invented. Golem is matched by its sprite key so both the normal Golem enemy and the Stage-5
Golem miniboss get the same pilot visual.

## Integration hooks (game.js — all additive, all null-guarded)

1. `makeUnit` → `onUnitCreated(u)` — attaches a controller for pilots only; no-op otherwise.
2. `updateAnim` → owned pilots delegate frame animation to `tickAnim(u, dt)`; every other unit
   keeps the default stepper unchanged.
3. `animate` loop → `tickWorld(dt)` advances transient VFX with the **same speed-scaled dt** as
   combat/VFX (correct at x1/x2/x4).
4. `disposeUnitVisual` → `onUnitRemoved(u)` tears down owned VFX + releases cached textures
   **before** the group tree is disposed.
5. `resetForWave` → `onUnitReset(u)` returns the controller to idle and drops leftover transients.
6. `applyHitFlash` → bridges the existing central hit-flash onto the pilot `hit` state (reuses the
   existing site — no new combat hook).

With the module absent or `AAF_ACTIVE === false`, all six hooks are no-ops and the game renders
exactly as before.

## Animation states & priority

States: **idle, move, attack, skill, hit, death**. Priority **death > hit > skill > attack >
move > idle** — a lower-priority request never interrupts a higher-priority state while it is
locked. `idle`/`move` loop; `attack`/`skill`/`hit`/`death` play once. **death is terminal**
(never returns to idle). `skill` is driven by the existing `action_state === 'casting'` window,
so it syncs to real cast timing. Frame advance consumes `dt` in a loop, so it **never freezes or
skips-all at x4**.

### Deterministic fallback (logged once per unit+state, never per frame, never crashes)

`move → idle` · `skill → attack → idle` · `hit → idle` · `death → hit → idle`. Whole-unit asset
resolution falls back canonical-approved file → explicit candidate → placeholder → **built-in
geometric visual**. The Slime box is rebuilt as a textured plane; Archer/Golem reuse their
existing plane.

## Manifest record fields

`unitId, role, displayName, canonicalPath, canonicalApproved (false), candidatePath (null),
placeholder {type:'programmatic', label, baseColor, accent}, fallbackPath, frame {w,h}, world
{scale, footAnchorX, footAnchorY, verticalOffset, shadowOffset}, facingMode ('flip_x'),
qualityTier, fpsByState, loopingByState, statesAvailable, vfx refs, provenanceStatus
('placeholder'), timing markers, match`. Contract anchors: Archer `(0.5, 0.92)`, Slime
`(0.5, 0.90)`, Golem `(0.5, 0.94)`. Anchor/scale/offset touch **only the local body mesh** — grid
coords, occupancy, range, and pathing are never affected.

## Quality tiers & FPS

Two tiers — **Gameplay Minimum** and **Demo Showcase** — with per-state frame counts (Showcase
richer). Default **12 FPS**, accepted **8–15**, per-state override allowed. `sanitizeFps` rejects
0/negative/NaN/Infinity → 12 and clamps into range, so no invalid manifest value reaches the loop.

## Facing & anchoring

Facing is **observed** from the existing `body.scale.x` flip (the framework records it, never
fights it), so the footprint is preserved (body stays centered at local x = 0, feet at the group
baseline). No duplicate L/R sheets. Anchor/offset never move the unit's grid tile.

## Layered VFX (visual only — never touches combat)

Layers: character, projectile, trail, impact, ground. The ranged pilot (Archer) fires a
procedural arrow → trail → impact on the attack/skill onset; melee pilots get an impact (Golem
adds a ground puff). VFX read the scene from `unit.group.parent` (the game.js scene is a lexical
global). **VFX never alters combat math, damage, status, targeting, occupancy, grid coords, or
timing, and never blocks pointer events. VFX follows combat; combat never waits on VFX.**

### Performance

Conservative documented transient cap **`MAX_TRANSIENT_VFX = 24`**. Degradation order (worst
first to shed): **particles/debris → trails → ground effects → reduce Showcase FPS to Gameplay
FPS → keep character/attack/impact**. **Character animation and impact are never dropped.**
Geometry/materials are reused per transient and disposed on expiry; no per-frame image loading;
textures are cached & reference-counted by resolved key (shared textures freed only when unused).

## Cleanup / leak safety

On death/removal/reset: stop animation, drop owned transients, release cached textures, tear down
the controller — before the group tree is disposed, so no callback fires after dispose and no
shared texture is freed while still in use. The existing **hit-flash leak-fix** and **death-fade
safety** (opacity/rotation owned by the death fade; the framework only advances death *frames*)
are preserved. Verified: 15 spawn/remove cycles add ≤2 geometries and ≤2 textures; 0 controllers
and 0 transients leak.

## Dev debug panel (`#aafDebug`, development-only)

Shown when the URL hash contains `aaf` or the always-present **👁 AAF** button is tapped
(touch/click, no hover-only, never blocks the game). Controls: pick pilot, pick state, toggle
quality tier, toggle VFX layers, force a missing state → show the deterministic fallback, spawn a
demo impact; live readout of state/resolved/frame/FPS/facing/quality/active-layers, controller
count, loaded-texture count, and active/dropped VFX vs cap. In shop phase (battle loop idle) the
panel self-drives the animation via `debugTick`.

## Contract validation (read-only, not merged)

PR #21's `tools/validate-asset-pilot-integration.mjs`, run from a temporary detached worktree of
`55c4986…` (never merged/cherry-picked into this branch): **"Asset pilot integration contract
validation passed."**

## Tests (all executed)

- **Node core** `tools/test-asset-animation-runtime.mjs` — manifest/identity, resolution order,
  state machine (priority/one-shot/terminal death/x4), state fallback, FPS sanitising, texture
  cache refcounting, VFX budget. **PASS.**
- **Browser (Playwright, x4-capable)** `aaf.mjs` — **71/71**: asset resolution (all branches,
  placeholder-never-canonical), attach (box→plane, grid coords unchanged, size hierarchy),
  animation (priority/fallback/x4/fps), facing/anchor (flip preserves footprint, no grid change),
  VFX (projectile layering, drains with no leak, combat untouched), budget (cap + degradation),
  texture cache (share + drain), cleanup/leak (15 cycles), **3 x4 checkpoints** (CP1 Archer
  animation + projectile; CP2 Slime/Golem hit/death/fallback; CP3 full pilot wave resolves),
  regression (Ninja/Augment/defs intact, toggle flag), debug UI, no uncaught page errors.
- **Regression (x4)** — `demo1_ready` 41/41, `augment_flow` 31/31, `ninja_v2` 17/17,
  `economy_tests` 30/30, `secret_limit` 20/20, `equip` 44/44.
- **Node** — `build-game-data-fixture` + `validate-game-data` (the same **10 unrelated monster/
  boss skillId errors**, PR #14 scope, **unchanged**); `node --check`; `git diff --check` clean.

## Explicitly deferred / out of scope

Final Archer/Slime/Golem art (ChatGPT), Shop-card/icon art, final VFX, multi-direction sheets,
PR #14 monster/boss skills, canonical file import + exact-file approval. No balance/economy/board/
camera/bench/Critical-Hit/Survival/3-star/L3-equipment change.

## Verdict

**Asset & Animation Framework Runtime ready.** The three pilots resolve by stable id, animate
through one shared six-state interface with correct priority/fallback at x1–x4, flip for facing
without moving their tiles, layer Skill/projectile/impact VFX that never touch combat, cache and
free textures without leaks, clean up safely on death/removal/reset, and expose a dev-only debug
panel — all on clearly-labelled technical placeholders, with every prior system intact.

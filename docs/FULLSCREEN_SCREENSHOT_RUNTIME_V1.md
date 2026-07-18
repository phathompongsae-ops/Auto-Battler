# Fullscreen + Screenshot Utility v1

Two small, player-facing presentation utilities for Demo 1 — **Fullscreen** and **Screenshot** —
kept in a dedicated module (`src/game-presentation-tools.js`) fully separate from game logic. They
are event-driven (no per-frame fullscreen polling, no continuous capture) and read the game only
through a small read-only bridge. Nothing here changes Combat, board dimensions, camera lock,
animation timing, economy, Equipment, Ninja, Augments, monster balance, or the Asset Framework.

## Files changed

| File | Change |
|---|---|
| `src/game-presentation-tools.js` | **New** — the fullscreen + screenshot module (`globalThis.GamePresentationTools`). |
| `src/game.js` | One small read-only hook `globalThis.GamePresentationHooks` (renderNow / getCanvas / relayout / getWave / getPixelRatio). No logic/timing change. |
| `autochess.html` | ⛶ + 📷 buttons in `#topbarRight`; nonblocking toast; utility-button CSS; load the module after `game.js`; `[data-dev-only]` on the AAF debug panel/toggle. |
| `tools/test-presentation-tools.mjs` | **New** — Node (no-DOM) test: graceful self-disable + filename sanitization. |
| `docs/FULLSCREEN_SCREENSHOT_RUNTIME_V1.md` | This document. |

## Pre-edit ownership map

| Concern | Owner (pre-existing) |
|---|---|
| Renderer | `renderer = new THREE.WebGLRenderer({ antialias:false })`, `setPixelRatio(1)`, **no `preserveDrawingBuffer`** |
| Resize / layout | **`layoutBoard()`** — sole owner; `renderer.setSize` + camera frustum; bound once to `window 'resize'` |
| Root container | HUD is many `position:fixed` **siblings** of `#boardContainer` (the canvas holder). No single wrapping div → fullscreen root is `document.documentElement`. |
| Player HUD | topbar labels: `playerHpLabel`, `waveLabel`/`waveTotal`, `goldLabel`, `levelLabel`, `phaseLabel`, `stageLabel` |
| Dev/debug panels | `#aafDebug`, `#aafToggle` (Asset Animation debug UI) — now tagged `[data-dev-only]` |
| Stage/wave value | global `wave` (1–15) |

## A. Fullscreen

- **Target element:** `document.documentElement` (the root) — the Three.js canvas **and** the fixed
  HUD overlays go fullscreen together, never only the canvas.
- **Enter/exit:** the ⛶ button toggles; pressing while windowed enters, while fullscreen exits.
  Never automatic — always a user press.
- **Esc / Back / system exit:** a single `fullscreenchange` listener (+ `webkitfullscreenchange`
  alias) re-reads `document.fullscreenElement` and re-syncs the button, so any exit path updates
  the icon/title/aria correctly.
- **Icon/title/aria:** windowed → `⛶` / "เต็มจอ" / "เข้าสู่โหมดเต็มจอ"; fullscreen → `🗗` /
  "ออกจากเต็มจอ" / "ออกจากโหมดเต็มจอ" (+ `.fs-on` styling).
- **API:** standard Fullscreen API with `webkitRequestFullscreen` / `webkitExitFullscreen` fallback
  for Safari/iOS. **Unsupported → the button hides itself.** `requestFullscreen` rejection is
  swallowed (`.catch(()=>{})` + sync `try/catch`) — no uncaught promise rejection, no console spam.
- **Aspect / no stretch:** entering fullscreen changes `innerWidth/innerHeight`; the game's own
  `layoutBoard` recomputes `renderer.setSize` + the camera frustum from the new aspect, so the board
  and character proportions are preserved and the canvas is never stretched.
- **Relayout:** `fullscreenchange` calls the read-only `relayout()` hook (which is exactly
  `layoutBoard`) on the next animation frame — reusing the single existing resize owner, so there is
  **no second resize path and no resize loop**. No stale canvas dimensions on exit.
- **Debug panels:** on enter, every `[data-dev-only]` element's `style.display` is snapshotted and
  set to `none`; on exit it is restored to the exact prior value. Enter/exit edges are detected so
  the snapshot is taken once.
- **Idempotent init** (guarded by an `inited` flag) → no duplicate listeners across re-inits.

## B. Screenshot

- **Architecture:** one-shot composite onto a temporary 2D canvas — **no server, no upload, no
  third-party library.** Only the board + player HUD are drawn, so debug panels and the utility
  buttons are excluded **by construction**.
- **WebGL capture:** the renderer has no `preserveDrawingBuffer`, so we **render-before-capture** —
  `GamePresentationHooks.renderNow()` draws one fresh frame, then `ctx.drawImage(webglCanvas)` copies
  it immediately in the same synchronous block (before the compositor clears the buffer). No
  expensive global renderer mode is enabled; the renderer is never rebuilt.
- **DOM HUD capture:** the required player readouts (HP / wave / gold / Lv / phase / stage) are read
  live from the DOM labels and redrawn as a compact translucent top strip with a text shadow so they
  stay readable on bright and dark boards. (Smallest viable faithful HUD without a DOM-rasterising
  library — see *Limitations*.)
- **Resolution / DPR:** captured at the WebGL canvas's native backing size. The renderer runs at
  `pixelRatio 1` by design (gameplay perf), so native visible resolution == CSS pixels; the image
  matches on-screen fidelity, aspect preserved (not stretched), board not cropped. Works portrait
  and landscape, and while fullscreen (capture just uses the current canvas size).
- **PNG + filename:** `out.toBlob('image/png')` → object URL → `<a download>` → click → **revoke**.
  Filename `auto-battler-stage-XX-YYYYMMDD-HHMMSS.png` where `XX` is the current `wave` sanitized to
  digits and zero-padded (missing/invalid → `01`). Nothing is uploaded.
- **Feedback + safety:** nonblocking Thai toast **"บันทึกภาพแล้ว"** (auto-hides; never `alert()`).
  A `capturing` guard means rapid taps start only one capture; the flag + button are re-enabled after
  completion **or** failure (`finally`). On failure a concise **"บันทึกภาพไม่สำเร็จ"** shows without
  crashing. Object URL revoked, temporary `<canvas>`/`<a>` unreferenced (GC'd), the toast timer is
  cleared before re-arming (no timer leak), no persistent hidden state after a failed capture.

## C. Responsive / layout

Existing responsive layout stays the default; fullscreen is optional. Buttons live in the top-right
utility area (`#topbarRight`), are click+touch, **≥44×44 CSS px**, safe-area-aware, readable on
bright/dark, no hover-only behavior, and never cover Gold/Wave, Hero/Equipment shop, Start Battle,
Augment choices, or the Asset debug controls. `pointer-events` are limited to the buttons — drag/drop
placement and board raycasts elsewhere are untouched.

## Tests

- **Node** `tools/test-presentation-tools.mjs` — module loads and self-disables without a DOM
  (fullscreen unsupported, capture/toggle safe no-ops), filename format + sanitization. **PASS.**
- **Browser (Playwright, x4)** `present.mjs` — **3 checkpoints, 42/42**:
  - **CP1 Fullscreen lifecycle:** enter engages, board sized to window (not stale/stretched), dev
    panel hidden, button icon/aria switch; exit via button restores icon + dev panel; Esc/system
    exit (via `document.exitFullscreen`, the same `fullscreenchange` path) re-syncs; 5× enter/exit
    ends windowed with stable canvas size (no resize-loop divergence); idempotent init; no errors.
  - **CP2 Screenshot:** capture in normal mode and in fullscreen; valid PNG at native/fullscreen
    size; filename has the current stage + timestamp; board pixels present (render-before-capture);
    toast shown; rapid triple-tap runs exactly one capture (guard); capture re-enabled after
    completion; failure path shows a safe message and never sticks `capturing`.
  - **CP3 Gameplay regression (x4):** purchase + placement, Equipment Shop buy, Secret Class
    board-limit API, Ninja runtime, Asset Framework active, combat (normal attack/skill) exercised,
    battle resolves, no NaN/Infinity, gold never negative, no page/console errors.
- **Regression suites (x4):** Asset-Animation core + browser 71/71, `demo1_ready` 41/41,
  `augment_flow` 31/31, `ninja_v2` 17/17, `economy_tests` 30/30, `secret_limit` 20/20, `equip` 44/44.
- **Node:** `build-game-data-fixture` + `validate-game-data` (same **10 unrelated skillId errors**,
  PR #14 scope, unchanged); `node --check` on changed JS; `git diff --check` clean.

## Limitations (nonblocking)

- **HUD in the screenshot is a faithful redraw of the required readouts**, not a pixel rasterisation
  of the live DOM (that would need an html2canvas-class library, explicitly avoided). The board is
  the real rendered frame; the HUD strip carries the same live values (HP/wave/gold/Lv/phase/stage).
- **iOS Safari:** element fullscreen is limited; where `requestFullscreen` is unavailable the button
  hides itself, and where the `<a download>` is ignored the PNG opens for manual save. Android Chrome
  (primary target) and desktop Chromium are fully supported.
- Screenshot is at the renderer's `pixelRatio 1` (matches on-screen); it is not super-sampled.

## Verdict

**Fullscreen + Screenshot ready** (with the documented nonblocking limitations: HUD is a faithful
redraw rather than a DOM rasterisation, and iOS graceful-degradation paths). Fullscreen targets the
root container, preserves aspect via the existing single layout owner, hides/restores dev panels, and
stays in sync across button/Esc/system exits; screenshot produces a local, correctly-named,
non-stretched PNG of the board + player HUD, excludes debug/utility UI, guards against overlapping
captures, and cleans up fully — all without touching gameplay.

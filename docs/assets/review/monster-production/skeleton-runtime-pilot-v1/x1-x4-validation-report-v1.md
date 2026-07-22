# Skeleton Runtime Integration Pilot v1 — x1 / x4 Validation Report

## Test harness (temporary, non-committed — per task authorization)

- Scratch copy of the worktree's `autochess.html` + `src/` + `assets/` (excluding `.git`),
  made at `/tmp/.../scratchpad/skeleton-runtime-harness-v1/` — **never** inside the tracked
  worktree, **never** committed, **never** referenced by any committed file.
- The single CDN `<script src="https://cdnjs.cloudflare.com/.../three.min.js">` line in the
  scratch copy only was rewritten (via `sed`) to `<script src="three.min.js">`, because
  outbound requests to `cdnjs.cloudflare.com` are policy-blocked (403) in this sandboxed
  environment (confirmed via `/root/.ccr/README.md` — a policy denial, not a bug, not to be
  retried or routed around). The real committed `autochess.html` in the worktree was
  diffed before and after and is **byte-for-byte unchanged**.
- Three.js: reused an already-existing local cached UMD build
  (`servedir_main/three.min.js`, r128, from an earlier session's scratch cache) rather than
  downloading a new one, per the task's explicit preference. No new tooling was installed.
- Served via `python3 -m http.server 8934 --bind 127.0.0.1` from the scratch directory.
- Browser automation: the globally pre-installed Playwright CLI (1.56.1) driving the
  pre-installed Chromium at `/opt/pw-browsers/chromium` — no new npm packages installed.
- All scenarios exercised the Runtime's own real internal functions (`makeUnit`,
  `updateUnit`, `animate()`, `triggerSkeletonAnim`, etc.) directly via `page.evaluate` in the
  page's real global scope (classic, non-module `<script>` — top-level `const`/`function`
  declarations in `src/game.js` are reachable this way), i.e. the exact same code paths real
  gameplay uses, just scripted rather than manually clicked through the shop UI for speed and
  determinism.

## x1 speed (`speedMul = 1`)

- Scenario A (organic combat, Skeleton vs. player dummy): 40 samples over ~6s. Idle, Move,
  Attack, Hit all observed in the correct order with correctly advancing `frameIdx`, no
  frozen frames, no desync. **0 page errors after the fix** (151 before the fix — see
  Transition QA).
- Screenshot evidence captured for all 5 states at x1 (`x1_1_idle.png` … `x1_5_death.png`),
  including one forced interruption (`x1_4_hit_interrupting_attack.png`: Hit triggered mid-
  Attack-swing). All visually correct — distinct, correctly-anchored poses per state, HP/mana
  bars unaffected, no stray/duplicate sprites, no baseline jump, no incorrect flip.

## x4 speed (`speedMul = 4`)

- Scenario B (organic combat at `speedMul=4`, dt capped at 0.05s pre-multiply → up to 0.2s
  simulated time per real frame): Idle, Move, and Attack all observed correctly; unit died
  partway through (hp reached 0 under the faster-clocked combat) before a Hit sample happened
  to land in this particular run's sampling interval — expected, since Hit is a very short
  (44cs) one-shot and sampling was on a fixed 120ms real-time cadence while combat resolved
  quickly at x4; Hit's correctness at any speed is separately and deterministically confirmed
  in Transition QA scenario C (speed-independent, since it calls `updateSkeletonMotionAnim`
  directly with fixed dt steps).
- `skeletonFrameIndexForTime` is a linear cumulative-duration scan that only compares
  `t < acc`; large `dt` jumps (up to 0.2s at x4) are handled correctly — confirmed no crash,
  no out-of-range index, one-shot completion (`idx === null`) detection unaffected by step
  size.
- Screenshot evidence captured for all 5 states at x4 (`x4_1_idle.png` … `x4_5_death.png`),
  visually consistent with the x1 set (animation *content* does not depend on speed, only
  pacing does — confirmed identical poses, correct anchor/scale).
- 0 page errors, 0 console errors (besides the harness's own benign `favicon.ico` 404 — see
  below) across the x4 scenario.

## Fallback validation (Scenario E)

Simulated a failed/incomplete motion-frame load by toggling `SKELETON_MOTION_READY = false`
immediately before creating a unit (reproducing what a real failed `TextureLoader.load` error
callback leaves in place, since `anyFailed` gates `SKELETON_MOTION_READY` from ever becoming
`true`). Result: the created unit received **no** `u.skelAnim` field at all, and its sprite
material's texture was confirmed to be the original static `SPRITES['Skeleton']` — i.e. it
silently falls back to the pre-existing static-sprite behavior with zero special-casing
needed elsewhere, no crash, no console spam, no broken combat flow.

## Multi-unit / shared-texture validation (Scenario D + dedicated disposal test)

- 3 simultaneous Skeletons in different states (Idle/Move/Attack) rendered correctly
  together (`multi_unit_mixed_states.png`); all three independently confirmed to hold
  `u.skelAnim` and valid textures.
- **Disposal safety** (the property `isSharedUnitTexture` was extended to protect): created
  3 Skeletons, killed and **explicitly removed** (`removeUnit`, the same call
  `clearEnemies()` makes at a real wave boundary) the middle one while the other two were
  still alive and actively animating. Confirmed: `SKELETON_TEXTURES.idle` / `.move` /
  `.basic_attack` / `.hit` / `.death` arrays remained **fully valid** immediately after the
  removal (`.image !== undefined` for every texture); the two surviving units' own texture
  references remained valid; both continued to animate through several more ticks with
  **no error**. Removed all 3, then created a brand-new 4th Skeleton afterward — it still
  received a working `skelAnim` and a valid texture, proving the shared cache is never
  torn down as a side effect of any individual unit's removal.

## Performance / memory

- Startup issues exactly 36 network requests for Skeleton motion frames (matching the 36
  approved production frames) — confirmed via response listener.
- Ran 15 create → attack → die → `advanceSkeletonDeathAnim` → `removeUnit` cycles at
  `speedMul=4`: **0 additional network requests** (no re-fetching, confirming the texture
  cache is loaded exactly once and reused, never reloaded per-unit).
- `performance.memory.usedJSHeapSize` unchanged (7,178,400 bytes) from before to after the
  15-cycle loop — no obvious unbounded growth (this metric is a coarse signal, not a precise
  leak detector, but shows no gross regression).
- All 15 units were fully removed from `units` (`remainingPerfUnits: 0`) — no stale
  references left behind.
- 0 page errors throughout.

## Known non-issue: `favicon.ico` 404

A single recurring console 404 for `/favicon.ico` was observed across multiple test runs.
Confirmed via the local `python3 -m http.server` access log — it is Chromium automatically
requesting a tab icon from the scratch-only static file server, which has no favicon.
Unrelated to `autochess.html`/`src/game.js` (which define no `<link rel="icon">` either) and
unrelated to the Skeleton Runtime change. Not present in any `pageerror` count, does not
affect gameplay, and does not appear in the harness-only file set that will be excluded from
the commit.

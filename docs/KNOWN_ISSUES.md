# Known Issues and Locked Priorities

## Active work owned by CC

### Shop-drawer white rectangle on WebGL canvas
Phase 0 investigation is complete.

Confirmed in the available test environment:
- Headless Chromium 141 at `800×360` and `844×390`.
- WebGL renderer reported through `WEBGL_debug_renderer_info` as ANGLE using SwiftShader software rasterization.
- The trigger is opening the fixed `#shopDrawer` while it contains at least one visible `<img>`.
- Canvas size, camera frustum, resize events, render loop, and `shopOpen` game state were ruled out.
- Emptying the shop cards removes the artifact; one image is enough to reproduce it.
- No repository files were changed during Phase 0.

Current assessment:
- High confidence that the observed artifact is a Chromium software-compositor/SwiftShader interaction rather than a game-scene or camera bug.
- Real Android hardware applicability remains unconfirmed because no real-device or cloud-device test connector was available.

Status:
- Phase 1 CSS-only workaround verification was authorized but did not start because the CC session limit was reached immediately after the command was submitted.
- CC retains ownership of the follow-up.
- Codex must not edit `#shopDrawer`, `#shopCards`, shop portrait visibility/compositing, `setShopOpen()`, or the isolated reproduction path until CC reports completion or the project owner releases the lock.

Phase 1 boundary when CC resumes:
- Start only in the `#shopDrawer` CSS block in `autochess.html`.
- Test one CSS candidate at a time, beginning with the smallest layer-promotion hint.
- Do not edit `src/game.js` unless CSS-only candidates fail and a separate JS phase is approved.
- Verify the original two landscape viewports and nearby portrait/desktop regressions.
- Combat is unrelated; if any combat or stage test becomes necessary, run it at speed x4 and report the exact module and method used.

## Previously assigned loader work

### Asset loader failure handling
The loader-failure task was previously owned by CC. Before assigning additional work in this area, verify the latest merged code and handoff because the active CC lock is now the shop-drawer investigation.

Expected loader behavior remains:
- A failed sprite load must not leave the loading screen stuck.
- Failed sprite keys should route to the existing placeholder unit visual.
- Success behavior and disposal lifecycle must remain unchanged.

## Confirmed gameplay issue

### Melee units cross or oscillate instead of engaging
Observed behavior:
- A player melee unit and an enemy melee unit approach each other.
- Both can pass, swap, or repeatedly chase each other without stopping to attack.

Likely areas to inspect later:
- Attack-range check before movement
- Path destination selection for melee units
- Occupied-tile timing
- Direct tile-swap prevention
- Destination reservation
- Deterministic movement priority

Required principle:
Melee units should path to a valid attack position adjacent to the target, stop when in range, and never swap occupied tiles in the same movement resolution.

Status: recorded; no implementation assigned yet.

## Locked production priority
Before character Asset and Animation production:
1. Lock camera and stage framing.
2. Lock board edges and visible stage depth.
3. Lock bench platform and divider.
4. Lock lower HUD/shop spacing.
5. Verify responsive layout and interaction hit areas.
6. Then prove the pipeline with three real assets: one Class 1 hero, one normal monster, and one stage-5 boss.

Do not expand full character production before these layout foundations are stable.

## Deferred systems
- Survival Mode: postpone until all three maps and 45 main stages are complete.
- Three-star hero system: postpone until the same late phase.

## Agent ownership rule
- CC and Codex must not edit the same code area concurrently.
- Parallel work is allowed only when file/code ownership is clearly separate.
- Documentation-only PRs may proceed while CC owns a runtime task.
- Before starting a new task, every agent must report branch, HEAD, working-tree status, base commit, and the modules/files it will use.
- Use the smallest effective change and risk-appropriate tests to conserve credits.
- Any combat or stage testing during development must run at speed x4.

# Performance Audit — Phase 1 (Read-only)

## Scope and constraints

Read-only performance review of the current Auto-Battler runtime architecture. No production code, CSS, assets, gameplay data, workflows, or runtime behavior were modified.

This audit deliberately avoids the Shop-Drawer Phase 1 area owned by CC: `#shopDrawer`, `#shopCards`, `setShopOpen()`, and related compositor work.

Reviewed modules/files:
- `src/game.js` — renderer setup, board layout, unit/skill/VFX lifecycle, timers, projectiles, cleanup paths, and render loop architecture.
- `autochess.html` — runtime entry and overlay/canvas relationship only; no Shop-Drawer implementation changes.
- `docs/REGRESSION_CHECKLIST.md` — risk-based test requirements.
- Existing resource-leak, asset-path, melee-movement, and handoff documentation in this PR.

Audit type: static/connector review. The available GitHub connector cannot run the browser, sample frame time, inspect Chrome performance traces, or collect live `renderer.info` deltas. Therefore this document separates confirmed structural findings from items that require runtime measurement.

## Executive summary

No confirmed Critical performance defect was found from static review alone.

The highest-value next step is not a broad optimization pass. It is one small internal instrumentation task that records a stable baseline for:
- frame time,
- `renderer.info.render.calls`,
- triangles,
- geometries,
- textures,
- programs,
- active units/projectiles/VFX,
- pending timers/callback handles where tracked.

Without those measurements, changing pooling, material reuse, geometry reuse, or renderer behavior would be speculative and risks spending credits on optimizations that do not affect the real bottleneck.

## Severity-ranked findings

### Critical

None confirmed.

A static source review cannot prove a frame-time regression, GPU-memory leak, or unbounded draw-call growth. Those require repeated-wave runtime evidence.

### High

#### H1 — No committed repeatable renderer-resource baseline

Risk:
- A later asset or animation expansion can increase draw calls, geometry count, texture count, or shader programs without a clear before/after reference.
- A cleanup regression may only become visible after several waves.
- Performance discussions can become subjective because there is no stable numeric gate.

Smallest future correction:
- Add an internal-only diagnostic sampler rather than an optimization.
- Capture metrics at clean load, battle start, battle end, and after cleanup for 3–5 focused waves at x4.
- Do not expose the panel in production and do not leave x4 available through normal player UI.

Status: measurement gap, not a confirmed runtime bug.

#### H2 — The project is about to increase real asset and animation complexity before a measured budget exists

Risk:
- Real hero, monster, boss, animation, and VFX assets can multiply texture memory and material/program variants.
- Fixing budgets after full asset expansion creates expensive rework.

Smallest future correction:
- Define a provisional mobile budget after collecting one representative three-asset test: one Class 1 hero, one normal monster, and one stage-5 boss.
- Record typical and peak calls/triangles/textures/programs during a focused x4 battle.
- Use that evidence before bulk character production.

Status: production-planning risk.

### Medium

#### M1 — Visual objects and effects require lifecycle verification by counters, not code reading alone

The runtime contains multiple categories that can create or retain resources over time:
- unit visuals,
- projectiles,
- status/VFX objects,
- hit flashes and delayed callbacks,
- summon visuals,
- wave cleanup and removal paths.

The repository already contains focused cleanup work and regression rules, but static review cannot prove that all counts return to baseline after repeated battles.

Smallest future correction:
- During a dedicated runtime audit, record collection sizes and `renderer.info.memory` before wave 1 and after cleanup for 3–5 focused waves at x4.
- Investigate only a metric that trends upward after cleanup.
- Do not introduce pooling until churn or garbage collection is actually measured as a problem.

#### M2 — Material/geometry reuse opportunities are likely, but optimization priority is unproven

Procedural board, unit, UI-adjacent 3D visuals, and VFX can create repeated materials/geometries. Reuse may reduce allocations and shader-program variants, but blanket deduplication can also complicate per-unit tinting, opacity, hit flash, death fade, and disposal ownership.

Smallest future correction:
- First count unique geometries, materials, textures, and programs during representative battles.
- Reuse only immutable geometry/material definitions with clear shared ownership.
- Keep temporary per-unit visual state separate from shared resources.
- Never call `dispose()` on a shared resource from an individual unit cleanup path.

Status: candidate optimization only.

#### M3 — Object pooling should remain deferred until measured

Likely pooling candidates include short-lived projectiles and VFX. However, pooling adds reset-state complexity and can preserve stale callbacks, target references, opacity, transforms, or status flags.

Smallest future correction:
- Measure allocation/churn and frame spikes first.
- If pooling is justified, start with one high-frequency, simple object type.
- Require an explicit reset contract and repeated x4 cleanup test.

Status: do not implement yet.

#### M4 — Responsive resizing can cause expensive renderer reallocations if triggered repeatedly

`layoutBoard()` updates renderer size and camera projection. This is correct for real viewport changes, but repeated resize events caused by mobile browser chrome or orientation transitions can be expensive.

Smallest future correction:
- Measure resize-call frequency on real mobile hardware before changing it.
- If excessive, apply a minimal requestAnimationFrame/debounce guard while preserving final dimensions and board picking alignment.

Status: unconfirmed; no change recommended from static evidence.

### Low

#### L1 — Data cloning in skill scaling is acceptable at the current scale

Skill definitions are copied before modifiers are applied. This allocates objects and arrays, but the current roster and cast frequency do not justify premature optimization without profiling.

Recommendation:
- Leave unchanged unless traces show skill scaling as a meaningful CPU/GC hotspot.

#### L2 — Full 15-wave performance testing should not be the default

Use 3–5 focused waves at x4 for performance investigation, as defined by the regression checklist. Reserve 15-wave runs for milestones or release preparation.

#### L3 — Headless SwiftShader results are not a substitute for real mobile GPU performance

Headless Chromium in this environment uses SwiftShader. It is useful for deterministic functional reproduction but not reliable for estimating Android GPU frame rate, tile-based GPU behavior, texture bandwidth, or compositor cost.

Recommendation:
- Use headless testing for leak trends and deterministic counters.
- Use at least one real Android device for final performance conclusions.

## Required runtime measurement plan for a future phase

### Modules/tools to use

- Playwright: deterministic game startup, deployment actions, shop/deployment smoke checks, and repeated x4 focused waves.
- Browser Performance API: frame interval sampling and long-task observation where supported.
- Three.js `renderer.info`: calls, triangles, geometries, textures, and programs.
- Existing runtime collections: units, projectiles, effects, summons, and tracked timer handles.
- Chrome DevTools Performance/Memory on a real Android device when available.

### Test matrix

Use the smallest relevant set:
1. Clean load, no battle.
2. One ordinary wave at x4.
3. One VFX/projectile-heavy wave at x4.
4. One summon/status-heavy wave at x4.
5. Repeat a focused wave 3–5 times and inspect post-cleanup counters.

Capture at:
- after load,
- immediately before battle,
- peak battle,
- after death cleanup,
- after wave transition,
- after retry/reset when relevant.

### Pass criteria

- No steadily increasing geometries/textures/programs after cleanup across repeated equivalent waves.
- No steadily increasing retained units/projectiles/VFX after cleanup.
- No new console, disposal, NaN, or stale-callback errors.
- Draw-call and triangle peaks are explainable by active on-screen content.
- Frame-time spikes are reproducible before any optimization is approved.

## Optimization decision rules

Only approve an optimization when all are true:
1. A metric or trace proves a bottleneck or leak.
2. The affected module/file is named.
3. The correction is the smallest isolated change.
4. The before/after scenario is repeatable.
5. Combat/time-dependent validation is performed at x4 during development.
6. Player-facing release behavior remains x1 and internal x4 is not exposed publicly.

## Work intentionally not performed

- No edits to `src/game.js` or `autochess.html`.
- No Shop-Drawer changes.
- No renderer settings changes.
- No material/geometry deduplication.
- No pooling.
- No Combat, movement, targeting, camera, or game-loop modification.
- No runtime claim that cannot be supported by measurements.

## Recommended next action

After CC completes the Shop-Drawer task, schedule a narrowly scoped Performance Measurement Phase using internal instrumentation only. Collect the baseline first. Then select at most one proven hotspot for correction in a separate task/PR.

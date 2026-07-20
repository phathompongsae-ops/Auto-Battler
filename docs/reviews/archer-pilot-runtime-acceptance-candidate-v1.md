# Archer v3.2 — Runtime Integration, x4 Validation & Pilot Acceptance Candidate

**Result: RUNTIME_INTEGRATION_READY_FOR_PILOT_REVIEW**

This record does **not** self-approve. `pilotAccepted`, `canonicalApproved`, `finalRuntimeApproved`, and `merged` all remain `false` — see `data/design/archer-pilot-runtime-acceptance-candidate-v1.json` for the full machine-readable record.

## 1. Lineage

| | |
|---|---|
| Source ZIP SHA-256 | `bf3653d72c9a5b3eec8b8a24224dcff098527dae194fbbafd3ec69c15072fc3e` |
| PR #78 (v3.1 rejected) | `6332f4aca92b45f8b9e67ddce1d41a454c09f67d` — preserved, untouched |
| PR #79 (v3.2 exact review candidate) | `ddd0b655f867d0b01106a9e1d274234e1e9b71e9` — preserved, untouched |
| PR #80 (exact package approval) | `4566fc192bb38a10f6653be7d9657afcc196231f` — preserved, untouched |
| PR #81 (16-bit compatibility check) | `5a42b921f3371bfdaf1c5f22e5bbf750b296818d` — base of this branch |
| This branch | `cc/archer-v3-2-runtime-integration-v1` |

## 2. Protected asset gate — re-hashed before and after, byte-identical

| Asset | SHA-256 |
|---|---|
| Neutral Master | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| Attack v3.2 frame 004 (16-bit) | `69af0c5088492db38fc81a365e1295264057ffe62f1141f173b86d815da5b277` |
| Attack v3.2 frame 006 | `7a63d3f0b357e7559c84c75650baa75c1865c8ced75a6abe618d1893d42e2787` |
| Attack v3.2 frame 011 (= Neutral Master) | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| All 12 Attack v3.2 frames | re-hashed, all match |
| All 8 Idle frames | re-hashed, all match `archer-idle-package-exact-file-approval-v1.json` |
| All 8 Move frames | re-hashed, all match `archer-move-package-exact-file-approval-v1.json` |

Frame 004 was **not** re-encoded. No asset binary was modified anywhere in this task. Both existing PR #79/#80 validators (`validate-archer-attack-v3-2-review-candidate-v1.mjs`, `validate-archer-attack-v3-2-exact-package-approval-v1.mjs`) were re-run and exit 0.

## 3. Runtime architecture discovered

- THREE.js **r128** via classic `<script>` tag (CDN), `src/game.js` also a classic script (no modules, no build step, no `package.json`).
- Existing animation system: single sprite-sheet per unit type, `tex.offset.x` UV-scrolling, **fixed** per-frame duration (`ATTACK_FRAME_DUR = 0.12`), used by all 19 pre-existing sprite types.
- No projectile/VFX-spawn system exists for any unit — damage applies synchronously on cooldown.
- An existing generic attack-time facing-flip (`body.scale.x = ±1` based on target position) already applies to every unit including the Archer — this was **not** previously documented correctly in this task's working notes and is corrected here (see `runtime-test-report.md`'s Facing section).

## 4. Authorized change made

**Additive, backward-compatible extension only.** New per-file variable-duration animation code path (`ARCHER_FRAME_SEQS`, `updateArcherAnim`, `loadArcherFrames`), gated strictly on `cfg.sprite === 'ArcherReal'`. The existing fixed-duration sheet system is completely untouched and still drives all other sprite types unmodified (confirmed via regression check, see §10). `HERO_DEFS.archer.sprite` changed from the `'Sniper'` placeholder to `'ArcherReal'` — the only `HERO_DEFS` edit.

No Combat balance, damage, stats, targeting, mana, or economy value was changed anywhere.

## 5. Timing/frame-scheduling decision

The approved exact per-frame timing (centiseconds) `[16,12,10,7,6,6,6,9,7,10,14,24]` (total 127cs) is used directly via a cumulative-duration lookup — no fixed-12-frame assumption, no uniform-duration approximation. This was implementable as a small, package-local addition; it did not require any broad Core Animation Runtime change, so no `BLOCKED` condition was triggered here.

## 6. Release marker / projectile sync

No projectile system exists for any unit (honest N/A — see `docs/reviews/archer-runtime-integration-v1/release-marker-diagnostic.md` for the full analysis). Release-frame (index 8) timing was instead verified directly: reached at 733ms in a deterministic real-code trace against a 720ms model prediction.

## 7. State registration / transitions

Idle, Move, and Attack are all registered and were all exercised: Idle→Move→Idle and Idle→Attack→Idle transitions confirmed via deterministic stepping using the real `updateUnit()` function; Move→Attack transitions were also observed during real x4 combat AI (Checkpoint 2). Repeated attacks and recovery-to-neutral were confirmed (attack completes → returns to idle/walk → can attack again). No death/cleanup-specific Archer behavior was added or needed to be (uses the existing generic death/cleanup path shared by all units, unmodified).

## 8. Actual-board evidence

All screenshots and the video are real Playwright captures of the actual running `autochess.html` + `src/game.js`, using the real production unit-placement path (`createUnitFromInstance`). See `docs/reviews/archer-runtime-integration-v1/` for the full file list. Character identity is clearly verifiable in every capture (green hood/hair, green-and-gold costume, elf ears, ornate bow). Anchor/pivot verified visually correct (no feet/ground gap) in every screenshot.

## 9. x1 (normal speed) result: **PASS**

See `docs/reviews/archer-runtime-integration-v1/runtime-test-report.md` for the full breakdown (Idle loop, Move loop, Attack Full Draw at 633ms, Attack Release at 733ms, Recovery). `normal-speed-attack-preview.webm` is a real recorded video of a full x1 Attack cycle.

## 10. Combat x4 validation

- **Checkpoint 1 (Asset Load + State Registration): PASS**
- **Checkpoint 2 (Playback + Transition + Anchor Stability): PASS** — 240 real-rendered rAF samples during genuine x4 combat AI, `groundedAnchorExact=true`, `noMapMissing=true`, zero errors.
- **Checkpoint 3 (Release Marker + Projectile Timing + Regression): PASS** — regression check confirms the Sniper unit's original sheet-based path (`archerSeqs===null`, `frames===8`) is completely unaffected; Release-frame timing logically confirmed via deterministic trace. A disclosed, non-blocking finding: at x4 real-rendered display sampling, the narrow Release-frame window was not visually caught in a ~4s sampling window (0/240 real-rendered display frames), which is an inherent characteristic of fixed-60fps display rendering versus a short animation-frame duration at high sim-speed multipliers, not a combat-correctness defect — see `runtime-test-report.md` for the full honest breakdown.

## 11. Autonomous defect-fix loop — what was found and fixed

**One test-harness defect found and fixed** (iteration 1 of the allowed 3): the first evidence-capture attempt showed Move/Attack animation state never transitioning. Root cause: the test harness set `phase='battle'` directly with no enemy present, so `onWaveCleared()` fired on frame 1 (`eAlive===0`, real, correct production behavior for winning an empty wave) and `phase` flipped to `'result'`, silently starving `updateUnit()` of further calls for every unit — a test-harness gap, not an Archer animation bug. Fixed by adding a `startTestBattle()` test hook that calls the real `spawnWave()` production path so a genuine enemy wave exists. Re-verified: all state transitions now work correctly; protected assets re-hashed byte-identical after the fix.

No Core Runtime, Combat balance, or asset-binary change was needed or made. No `BLOCKED` condition was hit.

## 12. Actual runtime evidence pack

Located at `docs/reviews/archer-runtime-integration-v1/`:
- `runtime-test-report.md`, `runtime-test-raw-results.json`, `release-marker-diagnostic.md`
- `actual-board-idle.png`, `actual-board-idle-midcycle.png`, `actual-board-move.png`, `actual-board-attack-full-draw.png`, `actual-board-attack-release.png`, `actual-board-recovery-neutral.png`, `actual-board-left-facing.png`, `actual-board-right-facing.png`, `actual-board-x4-combat-engage.png`, `actual-board-x4-combat-inprogress.png`
- `normal-speed-attack-preview.webm` (real recorded video, x1 speed, full attack cycle)

## 13. Pilot Acceptance status flags

See `data/design/archer-pilot-runtime-acceptance-candidate-v1.json` → `approvalFlags`:

```
runtimeIntegrationImplemented: true
runtimeValidationPassed: true
combatX4ValidationPassed: true
actualBoardEvidenceReady: true
pilotAcceptanceCandidateReady: true
pilotAccepted: false
canonicalApproved: false
finalRuntimeApproved: false
merged: false
```

## 14. Reusable pilot lessons (for future characters)

1. **Additive per-file animation path is a safe, proven pattern**: gate a new variable-duration animation system on the specific `sprite` key (e.g. `cfg.sprite === 'ArcherReal'`) rather than touching the shared fixed-duration sheet system. Zero regression risk to existing sprites when done this way.
2. **`makeUnit()` and `updateAnim()` are the two integration points**: extend `makeUnit()`'s branching at the top (mesh/material construction) and add an early-branch inside `updateAnim()` (or an equivalent gate) to a new per-type animation-advance function.
3. **The facing-flip mechanism already exists generically** (`updateUnit()`'s Basic Attack block, `body.scale.x`) — a new character does **not** need its own flip code for the Attack state; it inherits this automatically as long as it uses the standard `body` mesh. It does not cover Idle/Move for any unit — this is a pre-existing, systemic gap worth flagging to a human if a future character's approved data explicitly requires Idle/Move facing.
4. **Test-harness pitfall (do not repeat)**: never set `phase='battle'` directly in a test without also ensuring at least one alive enemy exists — `onWaveCleared()` will fire immediately and silently stop the entire per-unit update loop for every unit, with no error. Use a `startTestBattle()`-style hook that calls the real `spawnWave()` production function instead.
5. **Deterministic `stepUnit(heroKey, dt)` + `renderFrame()` test hooks** (calling the real `updateUnit()`/`renderer.render()` directly, decoupled from wall-clock `waitForTimeout`) are far more reliable than real-time polling for capturing exact animation-frame moments (e.g., a specific Full-Draw/Release frame) — use this pattern for future character evidence capture instead of guessing wall-clock delays.
6. **At x4 speed, expect narrow animation-frame windows to be visually skippable** by a fixed-60fps display without it being a bug — this is an inherent property of frame-based sprite animation at high sim-speed multipliers, not specific to any one character's timing data. Report it honestly rather than either hiding it or over-reacting to it as a blocking defect.
7. **No projectile system exists yet** — any future character whose approved kit implies a travelling projectile visual will need that built as its own scoped follow-up task; don't bundle it into a runtime-integration pass.
8. **Fast-path eligibility**: a character whose approved asset package already has (a) exact per-file hashes, (b) exact per-frame timing in centiseconds, (c) an anchor/canvas/rootMotion/runtimeFlipX convention on record, and (d) a passed compatibility check — like this Archer package — can go through this same additive-integration pattern without needing new architecture decisions.

## 15. Validation matrix — only what was actually run

| Check | Run? | Result |
|---|---|---|
| Foundation: repo/lineage gate (PR #78-81 heads) | yes | PASS |
| Foundation: protected asset re-hash (before) | yes | PASS, byte-identical |
| Existing gate: `validate-archer-attack-v3-2-review-candidate-v1.mjs` | yes | PASS (exit 0) |
| Existing gate: `validate-archer-attack-v3-2-exact-package-approval-v1.mjs` | yes | PASS (exit 0) |
| `node --check src/game.js` | yes | PASS |
| `git diff --check` | yes | clean |
| Runtime: Checkpoint 1 (Asset Load + State Registration) | yes | PASS |
| Runtime: Idle loop (deterministic) | yes | PASS |
| Runtime: Move loop (deterministic) | yes | PASS |
| Runtime: Attack Full Draw timing (deterministic) | yes | PASS |
| Runtime: Attack Release timing (deterministic) | yes | PASS |
| Runtime: Recovery-to-Neutral | yes | PASS |
| Browser: actual-board screenshots (x1, 9 states) | yes | captured, character identity verified |
| Browser: normal-speed attack video | yes | captured (`.webm`) |
| Combat x4: Checkpoint 2 (Playback/Transition/Anchor) | yes | PASS |
| Combat x4: Checkpoint 3 (Release/Projectile/Regression) | yes | PASS, with disclosed non-blocking finding |
| Regression: non-Archer unit (Sniper) unaffected | yes | PASS |
| Protected asset re-hash (after fix) | yes | PASS, byte-identical |
| WebKit/Gecko cross-engine | no | not available in this environment (disclosed limitation, same as PR #81) |
| Real GPU/driver diversity | no | only this container's software/virtual GL exercised (disclosed limitation, same as PR #81) |

Nothing above was skipped or lowered to force a pass; nothing above is reported PASS without having actually been run.

## 16. Result

**RUNTIME_INTEGRATION_READY_FOR_PILOT_REVIEW**

## 17. Approval/runtime flags — explicitly not self-approved

`pilotAccepted=false`, `canonicalApproved=false`, `finalRuntimeApproved=false`, `merged=false`. This record stops at "ready for human Pilot Acceptance Review."

## 18. Commit / Draft PR

Branch `cc/archer-v3-2-runtime-integration-v1`, based on `cc/archer-attack-v3-2-16bit-compatibility-check-v1` @ exact SHA `5a42b921f3371bfdaf1c5f22e5bbf750b296818d`. Draft PR only — no merge, no auto-merge.

## 19. Recommendation

**APPROVE ARCHER PILOT** (for human review — this record does not self-approve). Rationale: all in-scope runtime integration work is implemented additively with zero regression to existing sprites or Combat balance; all protected assets are verified byte-identical before and after; x1 and x4 validation both pass on real actual-board evidence with real screenshots and a real recorded video; the one test-harness defect found during this task was fixed and re-verified within scope; the two honestly-disclosed limitations (no projectile system, x4 display-sampling characteristic on the Release frame) do not affect combat correctness and are clearly documented for human judgment rather than hidden or fabricated around.

## 20. Targeted Timing Rework v1 (additive follow-up, same Draft PR)

An independent audit surfaced a repeated-attack timing defect not caught by the checks above:
Archer's base cooldown (71.43cs) is faster than Attack v3.2's full visual cycle (127cs), so
repeated attacks during sustained combat got **no visual acknowledgment** while one long cycle
played through underneath them (damage/cooldown were never affected — this was purely a visual
gap). Fixed with a minimal, Archer-gated, capped (cap=1) natural-boundary replay queue. Full
defect analysis, root cause, rejected alternatives, implementation, and new deterministic x1/x4/
regression evidence are in
`docs/reviews/archer-runtime-integration-v1/repeated-attack-timing-rework-v1.md`.

New known limitation added (see also `limitations` in the JSON record): under sustained
attack-speed buffs pushing the cooldown/cycle ratio well past base, the cap=1 queue means not
every individual attack gets its own unique visual replay — damage/cooldown still apply exactly
on schedule for every event. Base-stat cadence never exceeds the cap.

Result: **TARGETED_RUNTIME_REWORK_READY_FOR_INDEPENDENT_REAUDIT**. `pilotAccepted`,
`canonicalApproved`, `finalRuntimeApproved`, and `merged` remain `false`, unchanged by this
rework.

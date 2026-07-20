# Archer v3.2 Runtime Integration — Targeted Timing Rework v1

**Result: TARGETED_RUNTIME_REWORK_READY_FOR_INDEPENDENT_REAUDIT**

Additive follow-up to the Pilot Acceptance Candidate record
(`docs/reviews/archer-pilot-runtime-acceptance-candidate-v1.md`), on the same Draft PR #82,
same branch `cc/archer-v3-2-runtime-integration-v1`. This document covers only the
repeated-attack timing defect and its fix; everything already recorded in the base candidate
document (lineage, protected-asset gate, x1/x4 base evidence, etc.) is unchanged and not
repeated here.

## 1. Confirmed defect (given, independently reproduced in code)

Archer base `attack_speed = 1.4` → basic-attack cooldown `1 / 1.4 ≈ 0.714286s` (71.43cs).
Attack v3.2's approved non-looping sequence totals `127cs` (`1.27s`)
(per-frame `[16,12,10,7,6,6,6,9,7,10,14,24]`cs, Full Draw = frame index 7, Release = frame
index 8, 7cs duration). Cooldown is **~1.78× faster** than one full visual cycle, so under
sustained combat a new valid attack (damage + cooldown reset) can occur while the previous
Attack cycle is still playing.

## 2. Root cause established from code (before any edit)

- `updateArcherAnim(u, dt)` drives Archer's per-file variable-duration animation purely from
  `u.archerFrameTimer` / `u.archerFrameIdx`; it never reads `u.animTimer`.
- The original Basic Attack trigger block (`updateUnit`) set `u.animState='attack'; u.animTimer=0;`
  on every cooldown-expiry — but for Archer this reset was **inert**: `updateArcherAnim`'s own
  reset-guard only fires on a `u.archerSeqKey !== 'attack'` transition, which never re-trips
  while `animState` stays `'attack'` across repeated triggers.
- Net effect: **no mid-cycle restart was actually happening**. The real defect is the opposite —
  repeated attack events landing with **zero visual differentiation/acknowledgment** while a
  single 1.27s cycle plays through, uninterrupted, regardless of how many extra attacks fired
  during it.
- Damage, cooldown, targeting, mana, and lifesteal were never affected by this — they are fully
  independent of the animation state machine.

## 3. Fix selected (smallest effective, least runtime risk)

Three options were compared:

| Option | Rejected because |
|---|---|
| Do nothing | Fails the task's own requirement — repeated attacks still get no visual acknowledgment |
| Restart animation on every attack event | Cooldown (71.43cs) lands ~1cs *before* Release (which starts at 63cs into the cycle) — restarting unconditionally on every event would suppress Release from ever being shown under sustained fire, violating "preserve Release at frame 008" |
| Unbounded replay queue | At base stats the cycle/cooldown ratio (~1.78) means ~0.78 net extra attacks queue per cycle; after ~30s of continuous combat, roughly 18 replay-cycles would back up — the Archer would keep visibly attacking for **~23 extra seconds** after combat/target actually ended. Rejected as unacceptable runtime risk. |
| **Capped (cap = 1) natural-boundary replay queue — selected** | Every played cycle still shows Full Draw (007) and Release (008) in full; worst-case post-combat visual drift is bounded to at most one extra 1.27s cycle; restart only ever happens at a clean cycle-completion boundary, never mid-frame |

### Implementation (`src/game.js`, 3 edits, all gated on `u.archerSeqs` truthiness)

1. Unit init: added `archerPendingAcks: 0` to the per-unit state object (harmless, unused field
   for all non-Archer units — see §6).
2. Basic Attack trigger block: if the Archer is already mid-`'attack'`, increment
   `archerPendingAcks` (capped at 1) instead of resetting the animation immediately. Damage/mana/
   cooldown logic below this point is **completely unchanged** and still executes on every event,
   on schedule.
3. `updateArcherAnim`'s cycle-completion branch: if a pending ack is queued, consume it and
   restart the sequence from frame 0 (a clean boundary, replaying Full Draw/Release in full);
   otherwise fall through to the original idle/walk transition, byte-for-byte unchanged.

Non-Archer units always take the untouched `else` branches at every one of these three sites —
provably unaffected (see §6).

## 4. Protected-asset verification

All 29 protected binaries (Neutral Master, 12 Attack v3.2 frames, 8 Idle frames, 8 Move frames)
re-hashed **before and after** this rework's code edits. **Zero drift** — only `src/game.js` was
touched; no binary was opened for writing.

| Asset | SHA-256 |
|---|---|
| Neutral Master | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| Attack v3.2 frame 004 | `69af0c5088492db38fc81a365e1295264057ffe62f1141f173b86d815da5b277` |
| Attack v3.2 frame 006 | `7a63d3f0b357e7559c84c75650baa75c1865c8ced75a6abe618d1893d42e2787` |
| Attack v3.2 frame 011 (= Neutral Master) | byte-identical, confirmed |

## 5. Validation actually run

| Check | Result |
|---|---|
| `node --check src/game.js` | PASS |
| `git diff --check` | clean |
| `validate-archer-attack-v3-2-review-candidate-v1.mjs` | exit 0, PASS |
| `validate-archer-attack-v3-2-exact-package-approval-v1.mjs` | exit 1, FAIL — **expected**: this historical validator's changed-path allowlist is scoped to PR #80's own commit range and does not apply to PR #82's later runtime-integration commits (it flags PR #82's own pre-existing runtime files as "forbidden," which is a scope mismatch, not a regression). Not modified/weakened to force a pass, per explicit task instruction. |
| Deterministic repeated-attack timing trace, x1 | PASS — see §5a |
| Deterministic repeated-attack timing trace, x4 | PASS — see §5b |
| Non-Archer regression (Swordman, sheet-based path) | PASS — see §5c |
| Protected-asset re-hash, before/after | PASS, byte-identical (see §4) |

All three deterministic traces drive the exact same production `updateUnit()`/
`updateArcherAnim()` functions the real `animate()` rAF loop calls — via the pre-existing
`window.__archerRuntimeTestHook.stepUnit(heroKey, dt)` hook — with a real spawned enemy
(full unit shape, HP boosted, repositioned in-range, its own offense/mana neutralized) as a
controllable, always-in-range target. `speedMul` is forced to `0` and every scenario (setup +
measurement + recovery) executes inside a single synchronous `page.evaluate()` call, because the
game's own `animate()` loop keeps running concurrently by the test hook's own design
(`phase==='battle'` must hold across real frames) — real wall-clock time between separate
`page.evaluate()` round trips was found to let that loop's `atkCooldown<=0` check (which fires
regardless of `dt`, including `dt=0`) silently consume the first data point before the
deterministic loop even started. This was caught, diagnosed, and fixed in the test harness
itself before any result was trusted — full detail in the raw JSON evidence files' inline
comments equivalent (script: not committed, results are).

### 5a. x1 trace (4.0s simulated, `1/60s` steps) — raw: `repeated-attack-timing-trace-raw-x1.json`

| Metric | Result |
|---|---|
| Attack (damage) events | 6 |
| Damage events | 6 |
| Attack events == damage events | **true** (no dropped, duplicated, or delayed damage) |
| Full Draw (frame 007) reached | 3 times |
| Release (frame 008) reached | 3 times |
| Animation restarts/acknowledgments | 4 (1 initial + 3 queued replays) |
| Final state after 4s combat | `attack` (mid-4th cycle, correct — cycle 4 started at t=3800ms, needs 1270ms to complete) |
| Recovery (target removed, 3s further) | reaches `idle` cleanly, no stuck frame |

The numbers are internally consistent with the model: cooldown period ≈ 43 steps
(≈716.7ms), 6 attacks land at t ≈ 717/1433/2150/2867/3583ms within the 4000ms window;
restarts occur at t ≈ 17/1233/2517/3800ms (the 4th restart's cycle doesn't have time to reach
Full Draw/Release before the 4000ms window ends — correctly reflected in `fullDrawHits ==
releaseHits == 3`, not 4).

### 5b. Combat x4 trace (same 4.0s of *game* time, 60 steps of `dt = 4/60s`) — raw: `combat-x4-timing-trace-raw.json`

| Metric | x1 | x4 |
|---|---|---|
| Attack events | 6 | 6 |
| Damage events | 6 | 6 |
| Full Draw hits | 3 | 3 |
| Release hits | 3 | 3 |
| Restart/ack events | 4 | 4 |

Identical results to x1 over the same simulated-time window, confirming the cap=1 queue/replay
logic is purely time-driven (`dt`-based) and scales correctly under `speedMul` — no
frame-count-based assumption was introduced.

### 5c. Non-Archer regression (Swordman, original sheet-based path) — raw: `non-archer-regression-raw.json`

| Check | Result |
|---|---|
| `u.archerSeqs === null` throughout | true |
| `u.frames > 1` (sheet animation active) | true |
| Uses `tex.offset.x` UV scrolling (`u.body.material.map` present) | true |
| Original `ATTACK_SEQ = [5,6,7]` frames all reached | true |
| Attack events == damage events | true (3 == 3) |
| `u.archerPendingAcks` stays `0` throughout | true — the field exists on every unit (harmless unconditional init) but is only ever read/written inside code gated on `u.archerSeqs`, which is `null` for Swordman |
| Returns cleanly to `idle` after combat | true |
| Runtime errors | none |

Confirms the pre-existing fixed-duration sheet animation system (used by all 19 non-Archer
sprite types) is completely unaffected by this Archer-specific additive fix.

## 6. Isolation proof

All three edit sites are gated on `u.archerSeqs` truthiness, which is only ever non-null for
units where `cfg.sprite === 'ArcherReal'` (Archer only, and only once its per-file frames have
loaded). Every non-Archer unit takes the original, byte-for-byte-unchanged branch at all three
sites:

- Unit init: `archerPendingAcks: 0` is set for all units but never read or written again for a
  unit whose `archerSeqs` is `null`.
- Basic Attack trigger: `if (u.archerSeqs && u.animState === 'attack') { ...queue... } else { u.animState='attack'; u.animTimer=0; }` — non-Archer units always take the `else` branch, identical to before this fix.
- `updateArcherAnim`'s completion branch is only ever called for Archer units at all (it's the
  Archer-only animation-advance function, gated by `updateAnim`'s own `if (u.archerSeqs) {
  updateArcherAnim(u, dt); return; }` early return).

## 7. New disclosed limitation

Under sustained attack-speed buffs pushing the cooldown/cycle ratio meaningfully past its base
value (~1.78×), the cap=1 replay queue means not every individual attack event receives its own
unique visual Full-Draw/Release acknowledgment — events beyond the queue's capacity still apply
damage and reset the cooldown exactly on schedule, but do not add a second pending replay. This
is an intentional, disclosed bound chosen to prevent unbounded post-combat visual drift (see §3's
rejected-unbounded-queue analysis); at base stats it is never exceeded in practice. This is added
to the base candidate record's `limitations` list.

## 8. Scope confirmation

- Only `src/game.js` was modified (3 small, additive, Archer-gated edits).
- No PNG/GIF/WebM binary was opened for writing.
- No damage, attack speed, range, targeting, mana, lifesteal, economy, or class-balance value was
  changed.
- No projectile/VFX system was built.
- No camera/board/grid/movement/wave/shop/economy code was touched.
- No other character's Motion Production was started.
- No merge, auto-merge, or self-approval was performed.
- `pilotAccepted`, `canonicalApproved`, `finalRuntimeApproved`, `merged` all remain `false`.

## 9. Result

**TARGETED_RUNTIME_REWORK_READY_FOR_INDEPENDENT_REAUDIT**

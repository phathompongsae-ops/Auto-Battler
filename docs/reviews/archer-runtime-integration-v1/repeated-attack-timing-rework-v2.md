# Archer v3.2 Runtime Integration — Targeted Timing Rework v2

**Result: TARGETED_RUNTIME_REWORK_READY_FOR_INDEPENDENT_REAUDIT**

Additive follow-up to Rework v1 (`repeated-attack-timing-rework-v1.md`), same Draft PR #82, same
branch `cc/archer-v3-2-runtime-integration-v1`. An independent re-audit of v1 found that its
cap=1 replay queue silently dropped acknowledgment for some valid attack events during sustained
fire (audited: 6 attack events, only 4 visual cycles). This document covers only that fix.

## 1. Confirmed defect in v1 (independent re-audit, reproduced here)

v1's fix queued at most 1 replay; a second attack event arriving while one was already queued
was silently absorbed with no visible acknowledgment at all. Combat correctness (damage,
cooldown, mana, lifesteal, targeting, protected assets, non-Archer regression) was never in
question — this was purely a visual-completeness gap in v1's own fix.

## 2. Design comparison (required before coding)

First, the structural constraint that shapes every option below, computed directly from the
approved data (not assumed):

```
base cooldown   C = 1 / 1.4        = 0.7143 s   (attack rate  = 1/C = 1.400 events/s)
Attack v3.2 D   D = 1.27 s         (total 127cs) (max full-replay completion rate = 1/D = 0.787 cycles/s)
```

Because `1/C > 1/D` (attacks fire faster than a full replay can ever complete), **no queue of
"one full Full-Draw-to-Release replay per event," at any finite cap, can give literally every
event its own dedicated full replay under sustained base-speed fire.** At best,
`C/D = 0.7143/1.27 ≈ 56%` of events could ever get one, a hard ceiling independent of cap size.
This was verified empirically, not just theoretically: cap=2 was implemented and traced, and it
still dropped events within an 8s sustained-fire window (see raw discard below) — confirming the
math, not just asserting it.

| Option | Correctness | Visual quality | Backlog behavior | Post-combat | Complexity | Verdict |
|---|---|---|---|---|---|---|
| A. cap=1 (v1, current) | full replays never suppress Release | misses ~1 in 3 events under sustained fire (audited defect) | bounded (≤1 extra cycle) | ≤1.27s extra | trivial | **rejected** — fails "every event acknowledged" |
| B. unbounded queue | full replays never suppress Release | eventually 100% of events get a full replay, just later and later | **unbounded** — grows without limit under sustained fire (arrival rate 1.4/s > drain rate 0.787/s, permanently) | previously calculated ~23s of extra visible attacking after 30s combat | trivial | **rejected** (same reason as v1's original rejection, now proven structural, not just a large-N estimate) |
| C. bounded queue, cap=2 (or any larger fixed N) | full replays never suppress Release | **still misses events under sustained fire** — verified by trace (cap=2, 8s window: some events landed while both slots were full) | bounded, but bound grows with N | scales with N (~N×1.27s) | trivial to raise, but doesn't solve the problem | **rejected** — cap size only delays saturation, never eliminates the structural gap; picking a "big enough" N either still fails under long enough sustained fire or reintroduces B's unbounded-drift problem as N→∞ |
| **D. coalesced acknowledgment (selected)** | full replays (still cap=1) never suppress Release; overflow events get an instant, distinct visual cue instead of a full replay | **100% of events get *some* visible acknowledgment** — a full replay when a slot is free, otherwise an immediate brief self-flash | queue stays bounded at cap=1 (≤1 extra full cycle); flash tier has **zero** backlog (fire-and-forget, self-reverting) | ≤1.27s extra (same as v1, smaller than any cap≥2 option) | small — one new call site reusing the existing generic `applyHitFlash()` hit-reaction mechanism, zero new assets | **chosen** |
| E. another Archer-only sync method (e.g. scale playback speed to cooldown) | would require changing frame timing/Full Draw/Release semantics to keep pace with cooldown | N/A | N/A | N/A | N/A | **out of scope** — explicitly forbidden ("no frame timing change," "no Full Draw/Release change") |

## 3. Chosen design: two-tier acknowledgment (Option D)

1. **Primary tier (queue, cap=1, unchanged from v1):** if no replay is currently queued, queue
   one. It plays from its own natural completion boundary — never mid-frame — as a full replay of
   the exact approved sequence, showing Full Draw (007) and Release (008) in full, exactly as v1.
2. **Secondary tier (new):** if a replay is *already* queued when another attack event arrives,
   that event instead gets an immediate, visually distinct acknowledgment via
   `applyHitFlash(u, 0xfff2a8, 70)` — the exact same generic hit-reaction helper already used
   elsewhere in this codebase for damage-taken flashes, here invoked on the archer itself as a
   self-flash on firing. This touches only `body.material.color` and a `setTimeout` revert —
   **it never reads or writes `archerFrameTimer`/`archerFrameIdx`/any texture**, so it cannot
   alter frame order or timing, and cannot suppress, duplicate, or desynchronize Full Draw/Release
   of whichever full cycle happens to be playing at that moment.

An additive, evidence-only counter (`u.archerFlashAckCount`) was added at the flash call site
so automated tests can verify tier-2 firing deterministically — real-time `setTimeout` reversion
can't be observed reliably by a synchronous, `dt`-driven test harness (the browser's real clock
never advances between steps inside one synchronous `page.evaluate()` call). This counter is
read/written only inside the same `u.archerSeqs`-gated branch as everything else in this fix and
has no effect on any gameplay code path.

## 4. Isolation proof (updated)

All edit sites remain gated on `u.archerSeqs` truthiness. Non-Archer units:
- never read/write `archerPendingAcks` beyond its harmless `0` init (verified: stays `0`
  throughout a live regression trace),
- never read/write `archerFlashAckCount` at all (verified: stays `undefined` throughout),
- take the exact same untouched `else` branch as before at every site.

## 5. Protected-asset verification

All 29 protected binaries (1 Neutral Master, 12 Attack v3.2 frames, 8 Idle frames, 8 Move
frames) re-hashed against their recorded approval hashes. **29/29 byte-identical, zero drift.**
Only `src/game.js` was touched.

| Asset | SHA-256 |
|---|---|
| Neutral Master | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` |
| Attack v3.2 frame 004 | `69af0c5088492db38fc81a365e1295264057ffe62f1141f173b86d815da5b277` |
| Attack v3.2 frame 006 | `7a63d3f0b357e7559c84c75650baa75c1865c8ced75a6abe618d1893d42e2787` |
| Attack v3.2 frame 011 (= Neutral Master) | byte-identical, confirmed |
| All 12 Attack v3.2 frames | 12/12 match `archer-attack-v3-2-review-candidate-v1.json` |
| All 8 Idle frames | 8/8 match `archer-idle-package-exact-file-approval-v1.json` |
| All 8 Move frames | 8/8 match `archer-move-package-exact-file-approval-v1.json` |

## 6. Validation actually run

| Check | Result |
|---|---|
| `node --check src/game.js` | PASS |
| `git diff --check` | clean |
| `validate-archer-attack-v3-2-review-candidate-v1.mjs` | exit 0, PASS |
| Deterministic repeated-attack timing trace, x1 (8.0s window, longer than v1's 4.0s to exercise sustained saturation) | PASS — see §6a |
| Deterministic repeated-attack timing trace, x4-equivalent (8.0s game time, 120 steps of dt=4/60s) | PASS — see §6b |
| Non-Archer regression (Swordman, sheet-based path) | PASS — see §6c |
| Protected-asset re-hash, before/after | PASS, 29/29 byte-identical (§5) |

Same test-harness discipline as v1: a real spawned enemy (full unit shape, HP boosted,
repositioned in-range, its own offense/mana neutralized) as target, `speedMul` forced to `0`, and
setup + measurement + recovery all inside one synchronous `page.evaluate()` call (the game's own
concurrently-running `animate()` rAF loop otherwise interleaves real-time state changes between
separate round trips — the same contamination source diagnosed and fixed during v1).

### 6a. x1 trace (8.0s simulated, `1/60s` steps) — raw: `repeated-attack-timing-trace-raw-x1-v2.json`

| Metric | Result |
|---|---|
| Attack events | 11 |
| Damage events | 11 |
| Attack events == damage events | **true** |
| Completed full replays (restarts) | 7 (1 direct start + 6 queued replays consumed) |
| Flash acknowledgments (queue-saturated overflow) | 3 |
| Still-queued at window close (in-flight, not lost) | 1 |
| **Every attack event accounted for exactly once** (`7 + 3 + 1 == 11`) | **true** |
| Full Draw (007) reached, of the 6 *completed* replays | 6/6 |
| Release (008) reached, of the 6 *completed* replays | 6/6 |
| **No Release suppression** — every completed replay reached both Full Draw and Release | **true** |
| Recovery (target removed, 3s further) | reaches `idle` cleanly, no stuck frame, `pending=0` |

The 1 "still-queued at window close" is not a dropped acknowledgment — it is the natural tail
effect of measuring a continuous process at an arbitrary cutoff (the same effect v1's evidence
showed for its final in-progress cycle); it resolves into its own full replay immediately after
the window, and the separate 3-second recovery trace confirms the system always fully drains and
returns to `idle` with zero backlog once combat stops.

### 6b. Combat x4-equivalent (same 8.0s of *game* time, 120 steps of `dt=4/60s`) — raw: `combat-x4-timing-trace-raw-v2.json`

| Metric | Result |
|---|---|
| Attack events | 10 |
| Damage events | 10 |
| Attack events == damage events | true |
| Every attack event accounted for exactly once | true (`6 restarts + 4 flashes + 0 pending == 10`) |
| Full Draw / Release reached | both true |
| Final state | fully drained to `idle` (queue empty) within the 8s x4 window |

(The x1 vs x4 event counts differ slightly — 11 vs 10 — purely from `dt`-step quantization at a
coarser `4/60s` granularity, the same kind of discretization difference seen between v1's x1/x4
traces; the invariant that matters — every event accounted for exactly once, no drops, no
duplicate damage — holds identically in both.)

### 6c. Non-Archer regression (Swordman, original sheet-based path) — raw: `non-archer-regression-raw-v2.json`

| Check | Result |
|---|---|
| `u.archerSeqs === null` throughout | true |
| Original `ATTACK_SEQ = [5,6,7]` frames all reached | true |
| Attack events == damage events | true (3 == 3) |
| `u.archerPendingAcks` stays `0` throughout | true |
| `u.archerFlashAckCount` stays `undefined` throughout | true — the new counter is never touched for non-Archer units |
| Returns cleanly to `idle` after combat | true |
| Runtime errors | none |

## 7. Requirement-by-requirement confirmation

- Every valid attack event at base Archer attack speed receives a visible acknowledgment: **yes** — proven exactly (§6a: `7+3+1==11`; §6b: `6+4+0==10`).
- No permanent visual backlog: **yes** — queue stays capped at 1; flash tier has no backlog at all; recovery trace confirms full drain to `idle`.
- No 20-second post-combat replay: **yes** — worst case is the same ≤1.27s tail as v1 (smaller than any cap≥2 alternative).
- No restart spam: **yes** — full restarts remain capped at 1 in-flight, identical cadence to v1's already-accepted behavior.
- No Release suppression: **yes** — every *completed* replay in both traces reached Full Draw and Release in full (§6a, §6b).
- Frame order/timing, Full Draw, Release, attack speed, damage, cooldown, mana, lifesteal, targeting, economy, balance: **all unchanged** — the flash tier touches only `body.material.color` and a timer, nothing animation-frame-related.
- Archer only, no other unit, no asset modification, no runtime-wide rewrite, no Game Loop refactor, no projectile: **all held**.

## 8. Result

**TARGETED_RUNTIME_REWORK_READY_FOR_INDEPENDENT_REAUDIT**

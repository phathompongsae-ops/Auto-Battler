# Archer v3.2 Runtime Integration — Targeted Timing Rework v3 (Final Pilot Fix)

**Result: TARGETED_RUNTIME_REWORK_READY_FOR_INDEPENDENT_REAUDIT**

Additive follow-up to Rework v2 (`repeated-attack-timing-rework-v2.md`), same Draft PR #82, same
branch `cc/archer-v3-2-runtime-integration-v1`. Independent re-audit of v2 identified two
remaining runtime blockers — neither is a combat-correctness defect; both are visual-feedback
and state-lifecycle issues in v2's own implementation. This document covers only those two
blockers, plus the corrected evidence-reporting terminology the audit also required.

## Blocker 1 — visual-feedback ownership conflict

**Defect (v2):** the overflow-acknowledgment tier reused `applyHitFlash()` — the same function,
`u.hitFlashTimer`, and `u.body.material.color` already used for incoming-damage feedback on
every unit. An attack acknowledgment firing while a hit-taken flash was still showing (or vice
versa) would clobber the other's timer and revert to a color belonging to neither event.

**Fix — separate channel, not a priority/queue on the shared one:** a new, fully independent
Archer-only visual object, `archerAckGlow` (a small standalone glow mesh, created only for
`cfg.sprite === 'ArcherReal'`, positioned above the equip/link badge row), with its own material
color/opacity and its own timer field (`archerAckFlashTimer`). Two new functions,
`applyArcherAckFlash()`/`restoreArcherAckGlow()`, mirror `applyHitFlash()`/`restoreBodyColor()`'s
shape exactly but never read or write `u.body.material.color` or `u.hitFlashTimer`. The overflow
call site in `updateUnit`'s Basic Attack block now calls `applyArcherAckFlash(u, 70)` instead of
`applyHitFlash(u, 0xfff2a8, 70)`.

- Incoming-hit flash: **completely untouched** — `applyHitFlash`/`restoreBodyColor`/
  `hitFlashTimer`/`body.material.color` are exactly the same code used for every unit's
  damage-taken feedback, unmodified.
- Disposal: `archerAckGlow` is disposed for free by `disposeObjectTree(u.group)` (a normal child
  mesh, same as every other badge/ring); its own pending timer is explicitly cleared in
  `disposeUnitVisual()` (mirroring the existing `hitFlashTimer` clear) so no stale callback can
  touch a disposed material.
- Gameplay: zero change. The channel touches only a decorative glow mesh's opacity — no
  animation-frame state, no combat value.

**Proof (real setTimeout timers, not `stepUnit`'s synchronous `dt`)** —
raw: `dual-flash-independence-raw-v3.json`:

| Check | Result |
|---|---|
| Both channels visible simultaneously (hit-flash red on body + ack-glow gold, fired together) | **true** |
| Distinct timer objects (`hitFlashTimer !== archerAckFlashTimer`) | **true** |
| Ack channel reverts on its own 70ms schedule, independent of the still-active 80ms hit-flash | **true** |
| Both eventually revert to their own neutral state | **true** |
| Reversed order: hit-flash fired *while* an ack-flash is mid-flight does not alter the ack-glow's opacity at all | **true** |
| Reversed order: both still revert correctly on their own schedules | **true** |

## Blocker 2 — Archer runtime state not reset on wave transition

**Defect (v2):** `resetForWave(u)` — the real function `healPlayerTeam()` calls for every placed
unit when a player continues past the wave-win screen — never touched
`archerPendingAcks`/`archerSeqKey`/`archerFrameTimer`/`archerFrameIdx`/the evidence-only
`archerFlashAckCount` counter, or the new `archerAckGlow` channel. A replay queued or an
in-progress frame index left over from the wave that just ended could carry into the next wave's
very first Attack.

**Fix:** an Archer-gated block added to `resetForWave()` (gated on `u.archerSeqs`, a no-op for
every other unit) that resets all five fields to exactly the values `makeUnit()` gives a freshly
created unit, plus `restoreArcherAckGlow(u)` to clear the new channel's timer and opacity.

**Proof — real production path, not a fake reset.** The test:
1. Places the archer via the real `createUnitFromInstance()` path, then registers it into
   `placedUnits[]` (the array `healPlayerTeam()` actually iterates — `placeTestUnit()` alone
   doesn't do this, since it bypasses the shop's `moveUnitTo()` placement flow; a one-line
   `registerAsPlaced()` test hook closes that gap without touching any reset logic itself).
2. Enters Wave A via the real `spawnWave()` (`startTestBattle()`), deliberately drives several
   deterministic attack steps so the archer is left in a **genuinely dirty** state (a queued
   replay, a non-zero mid-cycle frame timer, `archerSeqKey==='attack'`) — confirmed, not assumed.
3. Kills the real target and calls the real `onWaveCleared()` (the exact function `animate()`
   calls once `eAlive===0` — not a simplified stand-in), reaching `phase==='result'`.
4. Clicks the real `#resultBtn` DOM element, exactly as a player would, which runs the real
   `onContinue` closure → `wave+=1; healPlayerTeam(); ... phase='shop'`.
5. Reads the archer's state after that real click, then starts Wave B for real and takes one
   real deterministic Attack step to confirm the fresh wave's very first Attack begins cleanly.

Raw: `wave-transition-reset-raw-v3.json`:

| Stage | Result |
|---|---|
| Wave A dirty state before transition | `archerPendingAcks=1, archerSeqKey='attack', archerFrameTimer=0.217, archerFrameIdx=1, animState='attack'` — genuinely dirty, confirmed |
| `onWaveCleared()` → phase | `'result'` |
| Real `#resultBtn` click → phase | `'shop'`, wave incremented `1 → 2` |
| Archer state immediately after the real click | `archerPendingAcks=0, archerSeqKey=null, archerFrameTimer=0, archerFrameIdx=0, archerFlashAckCount=0, animState='idle', archerAckGlow.opacity=0` — **completely clean** |
| Wave B's first real Attack step | `archerSeqKey='attack', archerFrameIdx=0, archerPendingAcks=0` — starts cleanly from frame 0, no carryover |

## Report corrections (per re-audit)

v2's evidence reported "7 completed replays" for the x1 trace — imprecise, because a replay
still mid-cycle at the measurement window's edge was implicitly folded into that count. v3
categorizes every attack event into exactly one of four buckets and proves they sum to the total:

- **completed replay** — a full cycle that started and finished within the measured window.
- **in-progress replay** — a cycle that had started but had not yet finished when the window
  closed (at most 1, since only one cycle can ever be actively playing at once).
- **queued replay** — sitting in `archerPendingAcks`, not yet started, at window close (at most
  1, the queue cap).
- **overflow acknowledgment** — the flash-tier response for a queue-saturated event.

### x1 (8.0s window) — raw: `repeated-attack-timing-trace-raw-x1-v3.json`

| Metric | Result |
|---|---|
| Attack events | 11 |
| Damage events | 11 |
| Completed replays | 6 |
| In-progress replay at window close | 1 |
| Queued replay at window close | 1 |
| Overflow acknowledgments | 3 |
| **Sum (`6+1+1+3`) vs. attack events (`11`)** | **exactly equal** |
| Full Draw reached, of the 6 *completed* replays | 6/6 |
| Release reached, of the 6 *completed* replays | 6/6 |
| No Release suppression | **true** |

### Combat x4-equivalent (same 8.0s of game time) — raw: `combat-x4-timing-trace-raw-v3.json`

| Metric | Result |
|---|---|
| Attack events | 10 |
| Damage events | 10 |
| Completed replays | 6 |
| In-progress replay at window close | 0 (window happened to close exactly at a natural boundary) |
| Queued replay at window close | 0 |
| Overflow acknowledgments | 4 |
| **Sum (`6+0+0+4`) vs. attack events (`10`)** | **exactly equal** |
| Full Draw / Release reached, of the 6 completed replays | 6/6 both |

### Measured (not estimated) tail time

v1/v2 stated the worst-case post-combat drift as an *estimate* ("~1.27s", "≤1.27s"). v3
**measures** it directly: after killing the target mid-window (leaving one replay in-progress
and one queued — the worst case the cap=1 design allows), stepping forward and recording the
exact simulated-time offset at which the archer reaches `animState==='idle'` with
`archerPendingAcks===0`.

**Measured tail time: 2267 ms** (from target death to fully idle, draining one in-progress cycle
plus one queued replay). This is measured from the x1 trace's own recovery phase, using the
genuinely-worst-case state that trace's own combat produced (not a synthetic worst case) — see
`repeated-attack-timing-trace-raw-x1-v3.json`'s `recovery.measuredTailMs`.

### Non-Archer regression (Swordman) — raw: `non-archer-regression-raw-v3.json`

| Check | Result |
|---|---|
| `u.archerSeqs === null` throughout | true |
| `u.archerAckGlow` never created (gated on `cfg.sprite === 'ArcherReal'`) | true |
| Original `ATTACK_SEQ = [5,6,7]` frames all reached | true |
| Attack events == damage events | true (3 == 3) |
| `u.archerPendingAcks` stays `0` throughout | true |
| `u.archerFlashAckCount` stays `undefined` throughout | true |
| `u.archerAckFlashTimer` stays `undefined`/`null` throughout | true |
| Returns cleanly to `idle` after combat | true |

## Protected assets

29/29 re-hashed, byte-identical, zero drift (unchanged from v1/v2 — only `src/game.js` was
touched again in this rework).

## Test-harness notes (disclosed, not hidden)

- `placeTestUnit()` doesn't register into `placedUnits[]` on its own (it calls
  `createUnitFromInstance()` directly, bypassing the shop's `moveUnitTo()` placement flow which
  is the only other place that pushes to `placedUnits[]`) — a one-line `registerAsPlaced()` test
  hook was added to close this gap for the wave-transition test specifically. This is a
  test-hook addition, not a change to any reset logic.
- The evidence-only `archerAckFlashTimer`/`archerFlashAckCount` fields are real-wall-clock-bound
  (`setTimeout`) and cannot be observed reliably inside a single synchronous `page.evaluate()`
  call (the browser's clock never advances between steps) — exactly the same lesson already
  documented in v2 for `hitFlashTimer`. The x1/x4 traces' `measuredTailMs` and accounting
  therefore rely only on the `dt`-driven fields (`animState`, `archerSeqKey`,
  `archerPendingAcks`, `archerFrameIdx`); the visual-flash channel's own correctness is proven
  separately, with real timers, in the dual-flash-independence test.

## Requirement-by-requirement confirmation

- Attack acknowledgment ownership separated from hit-feedback ownership: **yes** (§Blocker 1, proven with real timers).
- No permanent tint, no stale callback: **yes** — both channels revert on their own schedule; `disposeUnitVisual` clears both timers; `resetForWave` clears the ack channel between waves.
- Archer runtime-only visual state proven reset via the real production path: **yes** (§Blocker 2).
- New wave starts clean: **yes** — Wave B's first real Attack step starts at `archerFrameIdx=0`, `archerPendingAcks=0`.
- Simultaneous attack-ack + incoming-hit both independently visible: **yes**.
- Corrected replay accounting (completed / in-progress / queued / overflow): **yes**.
- Tail-time measured, not estimated: **yes — 2267ms measured**.
- 29/29 protected assets unchanged: **yes**.
- No change to cooldown, attack speed, damage timing, mana, lifesteal, targeting, balance, frame order/timing, Full Draw, Release, assets, Game Loop, economy, projectile, VFX, or non-Archer runtime: **all held**.

## Result

**TARGETED_RUNTIME_REWORK_READY_FOR_INDEPENDENT_REAUDIT**

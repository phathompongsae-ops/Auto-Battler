# Release Marker / Projectile Timing — Diagnostic

## Scope

Section 6 of the runtime-integration task requires mapping any release marker/projectile synchronization to the actual visual Release frame (index 8, 7cs/70ms... **correction: the approved timing has index 8's own duration as 9cs=90ms, immediately following index 7's 7cs=70ms** — see the exact array below), not blindly copying old marker conventions from elsewhere in the codebase.

Approved exact per-frame timing (centiseconds): `[16,12,10,7,6,6,6,9,7,10,14,24]`, total 127cs.
- Index 7 (**Full Draw**) starts at cumulative 63cs, duration 6cs.
- Index 8 (**Release**) starts at cumulative 69cs... 

**Correction against the authoritative source used throughout this task (task Section 0 restated values):** frame 007 = Full Draw, frame 008 = Release, **duration 7cs** for the Release frame specifically (this matches `tools/validate-archer-attack-v3-2-review-candidate-v1.mjs`'s own check: `"release frame (index 8) retains 7cs"`, re-confirmed passing in this task). Recomputing cumulative-start times directly from the array `[16,12,10,7,6,6,6,9,7,10,14,24]` (0-indexed):

| idx | duration (cs) | cumulative start (cs) |
|---|---|---|
| 0 | 16 | 0 |
| 1 | 12 | 16 |
| 2 | 10 | 28 |
| 3 | 7 | 38 |
| 4 | 6 | 45 |
| 5 | 6 | 51 |
| 6 | 6 | 57 |
| **7 (Full Draw)** | 9 | **63** |
| **8 (Release)** | 7 | **72** |

(The `updateArcherAnim()` implementation in `src/game.js` computes this generically from the same duration array via a running cumulative-sum lookup — see `ARCHER_FRAME_SEQS.attack` / `archerSeq()` — so this table is a derived cross-check, not a second hand-maintained copy of the timing.)

## Finding

**No projectile/VFX spawn system exists anywhere in this codebase, for any unit.** Confirmed via source search (`grep -n "projectile\|Projectile\|spawnVFX"`) during Section 3 architecture discovery: `spawnVFX()` exists and is used for skill cast/impact visuals (`VFX_SKILL_CAST`/`VFX_SKILL_IMPACT`), but there is no equivalent for basic-attack projectiles of any kind — basic-attack damage (`target.hp -= dmg`) is applied synchronously the instant `atkCooldown` reaches 0, with zero travel-time simulation, for every unit in the game including existing sheet-based ranged heroes (e.g. Sniper).

**Decision (Section 4/5 scoped):** building a new projectile/VFX system to synchronize against the Release frame would be a new Core Combat/rendering feature — explicitly out of the "smallest safe method" scope for this task ("ห้าม refactor Core Runtime ครั้งใหญ่", no new gameplay systems). This is disclosed here as an honest limitation, not fabricated or hidden.

## What was verified instead

1. **Release-frame timing is logically correct**, confirmed via a deterministic trace using the real `updateUnit()`/`updateArcherAnim()` code, stepped at realistic `1/60s` increments: frame idx 8 first reached at **733ms**, model-predicted **720ms** (within one step's quantization).
2. **Release-frame is reached exactly once per attack cycle** in that same trace (no duplicate/stuck-frame behavior).
3. **At real x4-speed rendering**, frame idx 8's narrow 7cs/70ms window (72–79cs of a 127cs sequence, compressed to ~17.5ms of real wall-clock time at x4) can be stepped over by a single 60fps-display render tick without ever being sampled — reported honestly in `runtime-test-report.md` as a disclosed, non-blocking display-sampling characteristic. Combat correctness (damage timing) is entirely unaffected since it runs on an independent cooldown timer, not on `archerFrameIdx`.

## Recommendation for human review

If a future task wants an actual projectile/impact-flash synchronized to Release, it should be scoped as its own follow-up (new VFX category, e.g. `VFX_BASIC_ATTACK_IMPACT`), built the same additive way `VFX_SKILL_IMPACT` was — not bundled into this runtime-integration pass.

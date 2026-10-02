# Monster Demo Batch 1 — Remaining Five Runtime Validation Report

**Method**: non-committed, scratch-only test harness (real Three.js r128 scene, real
`makeUnit`/`updateUnit`/`animate()` code paths, served locally; CDN substituted with an
already-cached local Three.js build, real committed `autochess.html` confirmed untouched) —
same approach used and already authorized for Skeleton's own validation. Driven via
Playwright, calling the Runtime's own internal functions directly.

## Source package lock (independent re-verification)

- Filename: `monster-demo-batch-1-remaining-five-motion-v1.1.zip`
- Measured size: 84,798,738 bytes — exact match
- Measured SHA-256: `f15625018d280e9902e1eefabecd5acdd74fc53542ad684932f2a1d81745d871` — exact match
- Reused the already fully-verified extraction from the prior Exact Motion Package Approval
  task (176/176 PNGs, 25/25 metadata, manifest/source-map/SHA256SUMS all previously
  reconciled with zero errors) — re-confirmed present and hash-matching before use.

## Asset loading (all 5 monsters)

All 5 monsters' `MONSTER_MOTION_READY[spriteKey]` reached `true`, with exact expected
texture counts per state (Idle 6, Move 8, Basic Attack 8 or 9, Hit 4, Death 8 or 9,
matching each monster's actual approved frame count). 0 page errors.

## State-cycle validation, x1 and x4 (all 5 monsters, organic combat)

Each monster (vs. a player dummy) was driven through ~4.2s of real combat at both x1 and x4.
All 5 monsters, at both speeds, correctly cycled through `move`, `idle`, `basic_attack`, and
`hit` states in organic combat (Death not reached within this particular sampling window at
either speed — separately and deterministically confirmed below). **0 page errors, 0
console errors (besides the harness's own benign `favicon.ico` 404) across all 10
monster×speed combinations.**

## Deterministic transition matrix + Death lock (all 5 monsters)

For each monster: Idle → Move → Idle → Attack (`basic_attack`) → Hit (interrupts Attack) →
resumes Idle → Death (locks) → Hit-after-Death (no-op, stays Death) → Attack-after-Death
(no-op, stays Death) → `deathDone=true` after the full sequence elapses. **All 5 monsters:
PASS, 0 page errors.**

## Fallback (all 5 monsters)

Simulated `MONSTER_MOTION_READY[spriteKey] = false` immediately before unit creation
(reproducing a real failed/incomplete load): all 5 monsters received no `u.monsterAnim` and
correctly fell back to their pre-existing static sprite (`SPRITES[spriteKey]` for Stone
Wolf/Spirit Archer/Golem; the colored-box placeholder path for Slime/Orc, which had none
before). No crash, no special-casing needed.

## Multi-unit, mixed-monster, and disposal safety

- 10 simultaneous units (2 of each of the 5 monsters) created together; killed and
  `removeUnit()`-ed one instance of every monster (simulating a real wave-boundary
  `clearEnemies()`) while its sibling of the same monster remained alive and animating.
  **Every monster's shared texture cache (`MONSTER_TEXTURES[spriteKey]`) remained fully
  valid after removal; every surviving sibling continued animating with 0 errors.**
- Removed all survivors too, then created one brand-new instance of each monster — all 5
  still received a valid `monsterAnim` and valid texture, proving the shared caches are
  never torn down as a side effect of any individual unit's removal.
- Mixed-monster scene (5 different monster types simultaneously, mixed idle/move/attack
  states) rendered correctly together — see `screenshots/mixed_monster_scene.png`.

## Performance / memory

- Exactly 212 `_motion/` asset requests at startup (176 for these 5 monsters + 36 for the
  pre-existing Skeleton pilot) — matches expected exactly.
- 15 create → attack → death → `removeUnit` cycles across all 5 monsters at `speedMul=4`:
  **0 additional asset requests** (no re-fetching, cache loaded once and reused).
- `performance.memory.usedJSHeapSize` unchanged before/after the 15-cycle loop.
- All 15 units fully removed from `units` (0 remaining) — no stale references.
- 0 page errors throughout.

## Visual evidence

`screenshots/x{1,4}_<Monster>_{1_idle,2_move,3_basic_attack,4_hit,5_death}.png` for all 5
monsters at both speeds (50 images), plus `mixed_monster_scene.png`. All visually confirmed:
distinct, correctly-anchored poses per state; Golem's larger sprite-plane sizing preserved
correctly; Spirit Archer's bow-draw release pose reads clearly with no projectile generated;
no stray/duplicate sprites, no baseline jump, no scale-inversion artifact (no flip is ever
applied, so none is possible).

## Regression checks

- Skeleton Runtime Pilot: `SKELETON_ANIM_DEF`/`SKELETON_TEXTURES`/`skelAnim`/etc. are
  byte-for-byte untouched (confirmed via the diff of this change — only additive lines
  touch Skeleton-adjacent code, and those additions are no-ops for Skeleton units).
  Skeleton's own asset-request count (36) is unchanged from its own pilot validation.
- No Combat/damage/cooldown code path was touched (confirmed via inspection — the new
  functions never read/write `hp`, `atkCooldown`, `dmg`, `specialBehavior`).
- No Board/Camera/UI/VFX/GitHub-workflow file was changed (confirmed via `git diff --stat`:
  only `src/game.js` and new files under `assets/monsters/` and `docs/assets/review/...`).
- No automated test suite exists in this lineage (no `package.json`/test runner found,
  consistent with the earlier Skeleton pilot's own finding) — `node --check src/game.js` is
  the applicable syntax gate, and it passes.

## Known limitations

- Death was not observed within the organic-combat sampling window at either speed (the
  dummy's damage output vs. each monster's 400–500 test HP meant Death hadn't yet occurred
  by the end of the ~4.2s sample) — this is fully covered by the separate, deterministic
  transition-matrix test above, which explicitly exercises Death, its lock-out behavior, and
  `deathDone` for all 5 monsters.
- RuntimeFlipX is not applied (see Runtime Integration Report) — a documented, precedented,
  intentional non-implementation, not a defect.

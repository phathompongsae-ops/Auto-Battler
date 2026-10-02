# Spirit Archer Attack Facing Pilot v1

Branch: `cc/spirit-archer-attack-facing-pilot-v1` (base: main @ `571f3ce294bbaa42ee83807a1960045aaa4ffec4`)

Spirit-Archer-only, presentation-only facing fix. No target-selection rule, attack range,
projectile, damage value, cooldown ownership/duration, attack-speed formula, movement speed,
pathfinding, stat, or asset byte was changed. No PNG, sprite sheet, or approved Motion/Neutral
Master was touched — every frame shown is the same approved package frame; only WHICH horizontal
facing is applied WHEN changed, for this one sprite.

## Reported defect

Spirit Archer, immediately before firing and while turning to fire, could face a direction
different from its current target — most visible during target acquisition, target switching
mid-shot, or when the target moved to the opposite horizontal side while the archer's own
anticipation/release/recovery pose was still on screen. The archer could appear to not be
looking at, or to be shooting away from, the unit it was actually attacking.

## Root cause (diagnosed before changing anything)

`setUnitFacing(u, dx)` at the tail of the Basic Attack block in `updateUnit()` recalculated
facing from the **live** `u.current_target` position on **every single tick** while `d <=
atkRange` — including every tick of an already-committed one-shot `basic_attack` animation
(triggered via `triggerMonsterAnim(u, u.monsterSprite, 'basic_attack')`, a 0.90s, 9-frame,
non-looping pose). If the target died mid-animation and `u.current_target` was reassigned to a
new target on the opposite side, or the same target simply moved to the opposite side while the
shot's visual pose was still playing, the sprite's facing (`u.body.scale.x`) flipped mid-pose —
producing exactly the reported symptom. This is a presentation-timing gap, not a targeting or
combat-math defect: target selection, range, and damage were always correct: only the *sprite's
own committed pose* could visually disagree with where it was actually shooting.

Movement facing (`stepToward`) was never affected, since it always passes whole-tile deltas and
runs while `u.monsterAnim.state === 'move'`, never `'basic_attack'`.

## Fix (presentation-only, Spirit-Archer-gated)

1. **Facing dead-zone** — `SPRITE_FACING_DEADZONE.SpiritArcher = 0.05` (same mechanism the
   Skeleton pilot introduced), guarding the *live* (unlocked, between-shot) tracking window
   against near-zero-dx flip jitter. Non-attack ticks and every other sprite are unaffected.
2. **Committed attack-facing snapshot** — at the exact tick `triggerMonsterAnim(u,
   u.monsterSprite, 'basic_attack')` fires, and only for `u.sprite === 'SpiritArcher'`, the
   target-facing dx at that instant is captured into `u.spiritArcherAtkFacingDx`.
3. **Facing lock** — the facing call at the bottom of the Basic Attack block now checks `u.sprite
   === 'SpiritArcher' && u.monsterAnim && u.monsterAnim.state === 'basic_attack'`; while true, it
   passes the snapshot instead of a live recalculation. The lock releases automatically the
   instant the one-shot animation finishes and `u.monsterAnim.state` returns to `'move'` or
   `'idle'` (handled entirely by the pre-existing, untouched `updateMonsterMotionAnim`), at which
   point live tracking resumes immediately. Every other sprite, and every other Spirit Archer
   state (idle/move/hit), falls through to the exact original live `setUnitFacing(u, dx)` call,
   byte-for-byte unchanged.

Both changes live entirely in `src/game.js`, gated strictly on `u.sprite === 'SpiritArcher'`;
no other monster, hero, or the shared `setUnitFacing`/`MONSTER_MOTION_DEFS`/damage/cooldown code
paths are altered in behavior.

## Before / after

| Property | Before | After |
|---|---|---|
| Facing during committed basic_attack pose | recalculated live every tick from current target | held at the dx snapshotted the instant the attack committed |
| Target reassigned/relocated mid-animation | could flip the pose mid-shot | pose holds through the full 0.90s one-shot; no flip |
| Facing once the one-shot ends | (n/a — was always live) | resumes live tracking immediately, same tick the lock releases |
| Near-zero dx during live (between-shot) tracking | could flip on sub-pixel sign changes | 0.05-unit dead-zone holds last facing (same mechanism as Skeleton) |
| Movement facing | live, whole-tile deltas only | unchanged — lock only ever applies to the `basic_attack` state |
| Damage / cooldown / attack frequency / target selection | — | untouched, test-locked (matches a structurally-identical unfixed sprite under identical stats) |
| Other sprites (Skeleton, OrcBrute, StoneWolf, Slime, Golem, heroes) | — | untouched — lock condition is `u.sprite === 'SpiritArcher'` only |

## Validation actually run

- `node --check src/game.js` — pass.
- **New** `tests/spirit_archer_attack_facing_v1.test.js` — **29/29 pass**: commit-and-lock
  correctness for both facing directions, lock surviving a mid-animation target reassignment
  (both directions), lock release + live resume on the exact tick the one-shot ends, fresh
  re-snapshot on each consecutive attack (no stale carry-over), movement/hit states never
  activating the lock, non-SpiritArcher sprites (OrcBrute) keeping the exact prior live-flip
  behavior even under the identical reassignment trigger, the live-tracking dead-zone, and a
  gameplay-lock proof that total damage/attack frequency/target selection for a SpiritArcher
  exactly match a structurally-identical unfixed sprite under identical stats (the damage-math
  code path has no sprite branch, so identical output is a direct proof of presentation-only
  scope).
- Pre-existing suites unchanged and green: `tests/live_qa_six_fixes.test.js` **70/70**,
  `tests/android_qa_hotfix_v1.test.js` **61/61**. `tests/skeleton_motion_feel_v1.test.js`
  **58/59** — the one failure (`hit: brief (0.31s) and exits cleanly ... bodyOffsetClean`) was
  confirmed, by re-running the identical suite against unmodified `main`, to be a pre-existing
  environment-timing flake in a 90ms real-`setTimeout` check, unrelated to this change; every
  Skeleton-specific assertion this pilot could affect stayed green.
- Real rAF game loop (not manual ticks), wave 4 (2 Spirit Archers + 2 Stone Wolves + 1 Shadow
  Assassin), full battle to a result at **x1 and x4**: victory both speeds, 0 out-of-range
  (`abs(scale.x) !== 1`) facing samples, and — the core regression proof — **0 facing flips**
  across every pair of consecutive samples where a Spirit Archer's `monsterAnim.state` was
  `'basic_attack'` on both sides of the pair (79–109 such locked samples at x1, 19–22 at x4,
  across repeated runs), with 0 page errors.
- All test runs used the repo's documented offline convention (scratch copy with a local
  three.min.js substituted for the CDN tag); emulated Chromium — **no real-device claim is
  made**. Human Feel Gate remains pending real Android review.

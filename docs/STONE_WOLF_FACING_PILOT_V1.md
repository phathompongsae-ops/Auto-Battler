# Stone Wolf Facing Pilot v1

Branch: `cc/stone-wolf-facing-pilot-v1` (base: main @ `8e781198e908ba037cb3a33a77d6cd285b0c7033`)

Stone-Wolf-only, presentation-only facing fix. No target-selection rule, attack range, damage
value, cooldown ownership/duration, attack-speed formula, movement speed, pathfinding, stat, or
asset byte was changed. No PNG, sprite sheet, or approved Motion/Neutral Master was touched.

## Reported defect

Stone Wolf visibly faces the opposite direction from its target or attack direction.

## Phase 1 diagnosis (read-only, before any edit)

- **Runtime sprite/unit key:** `StoneWolf`, using the shared "Remaining Five" monster system
  (`u.monsterAnim`, `u.monsterSprite`, `MONSTER_MOTION_DEFS.StoneWolf`, `setMonsterFrame`,
  `triggerMonsterAnim`, `updateMonsterMotionAnim`) — the same generic path OrcBrute/Slime/Spirit
  Archer/Golem use. Target selection: `selectTarget()` (Stone Wolf uses the `hunter`
  `specialBehavior`, targeting lowest HP% — untouched). Facing: the shared `setUnitFacing()`
  helper, called from both `stepToward()` (movement) and the tail of the Basic Attack block in
  `updateUnit()` (attack).
- **Canonical orientation of the actual approved frames** (visually inspected before any change):
  `stone_wolf_idle_000.png`, `stone_wolf_move_000.png`, and `stone_wolf_basic_attack_004.png`
  (the package's own `impact_frame`) all show the wolf's head, forward paws, and lunge/bite
  consistently on the **left** side of the frame — the approved package canonically faces left,
  the same "authored facing left" situation Skeleton's package had.
- **Reproduced directly, before any change**, exactly as described in the report:
  - Right-side target → `scale.x = +1` (unflipped) → displays the canonical-left art while the
    target is on the right → visually backward.
  - Left-side target → `scale.x = -1` (mirrored) → mirroring left-facing art makes it read as
    facing right, while the target is on the left → visually backward.
  - Moving toward a target on the right → `scale.x = +1` (unflipped) → backward, same as attack.
  - **Every** case was backward — a consistent 180° reversal across idle default, both attack
    directions, and movement, not an intermittent or state-specific symptom.
  - Separately, reproduced the same committed-attack mid-swing flip class already fixed for
    Skeleton/Spirit Archer: with a target reassigned to the opposite adjacent side while Stone
    Wolf's own one-shot `basic_attack` lunge (0.76s) was already playing, the facing flipped
    mid-pose.
- **Root cause:**
  - **Category A** (consistent reversal): `SPRITE_BASE_FACING` had no `StoneWolf` entry, so the
    generic "canonical = right" assumption applied to Stone Wolf's canonically-left source art —
    every scenario rendered backward.
  - **Category E/F** (committed-attack flip): the shared facing call at the tail of the Basic
    Attack block recalculates live every tick, with no notion that Stone Wolf's own committed
    attack pose is already playing — same defect class as Skeleton/Spirit Archer.
  - Both causes are present and were fixed independently, per the task's decision rule for when
    both problems exist.

## Fix (presentation-only, Stone-Wolf-gated)

1. **Base-facing correction** — `SPRITE_BASE_FACING.StoneWolf = -1` (data-only, identical
   mechanism to the approved Skeleton fix). This alone corrects idle/movement/attack facing in
   every non-committed state.
2. **Committed attack-facing snapshot** — at the exact tick `triggerMonsterAnim(u,
   u.monsterSprite, 'basic_attack')` fires, and only for `u.sprite === 'StoneWolf'`, the
   target-facing dx at that instant is captured into `u.stoneWolfAtkFacingDx`.
3. **Facing lock** — the facing call at the bottom of the Basic Attack block checks `u.sprite
   === 'StoneWolf' && u.monsterAnim && u.monsterAnim.state === 'basic_attack'`; while true, it
   uses the snapshot instead of live recalculation. The lock releases automatically the instant
   the one-shot animation ends (handled entirely by the pre-existing, untouched
   `updateMonsterMotionAnim`), at which point live tracking resumes immediately.

No facing dead-zone was added: Stone Wolf is melee (range 1, grid-locked), so attack-facing dx is
always either an exact same-column tie (handled by the pre-existing early-return in
`setUnitFacing`) or a full-tile delta — a near-zero-but-nonzero jitter case was not reproduced,
per the task's explicit rule against adding a dead-zone without proof.

Both changes live entirely in `src/game.js`, gated strictly on `u.sprite === 'StoneWolf'`; no
other monster, hero, or the shared `setUnitFacing`/`MONSTER_MOTION_DEFS`/damage/cooldown code
paths are altered in behavior. The Skeleton and Spirit Archer facing fixes are untouched.

## One pre-existing test updated (not Stone Wolf's behavior)

`tests/android_qa_hotfix_v1.test.js` (from PR #96) hardcoded `Object.keys(SPRITE_BASE_FACING)
.length === 1`, an assumption that no second sprite would ever legitimately need a base-facing
override. Stone Wolf's evidence-based correction is exactly such a case. Updated the assertion to
require exactly 2 entries (`Skeleton`, `StoneWolf`) while still confirming OrcBrute/Slime/Spirit
Archer/Golem/BladeMaster remain absent — preserving the test's actual intent (no *unrelated*
sprite gains an override) without freezing the map at a stale count.

## Validation actually run

- `node --check src/game.js` — pass.
- **New** `tests/stone_wolf_facing_v1.test.js` — **30/30 pass**: movement facing both directions,
  commit-and-lock correctness (both directions), lock surviving a mid-lunge target reassignment,
  lock release + live resume timing, fresh re-snapshot on the next attack, hit-reaction state
  never activating the lock, gameplay-output parity (damage/frequency/cooldown/target-selection/
  movement-distance) against a structurally identical unfixed sprite (OrcBrute), an unaffected
  melee monster and a hero retaining exact previous facing behavior, and the approved
  `MONSTER_MOTION_DEFS.StoneWolf` timing table left byte-intact.
- Pre-existing suites re-run fresh and green: `tests/live_qa_six_fixes.test.js` **70/70**,
  `tests/android_qa_hotfix_v1.test.js` **61/61** (post the one-line update above),
  `tests/spirit_archer_attack_facing_v1.test.js` **29/29**,
  `tests/skeleton_attack_facing_v1.test.js` **20/20**.
- `tests/skeleton_motion_feel_v1.test.js` re-run 5x fresh: 3/5 clean, 2/5 showing the identical,
  previously-classified `PRE_EXISTING_NON_BLOCKING_TIMING_FLAKE` (`bodyOffsetClean`) — same exact
  assertion/detail every time, no new failure signature, rate unchanged within normal variance for
  an intermittent race; this pilot touches no Skeleton code path.
- Real rAF game loop (not manual ticks), wave 4 (2 Stone Wolves + 2 Spirit Archers + 1 Shadow
  Assassin), full battle to a result at **x1 and x4** across 3 repeated runs each: victory every
  time, Stone Wolf observed moving and attacking both directions, 0 out-of-range facing samples,
  and 0 facing flips across every consecutive sample pair where a Stone Wolf or Spirit Archer was
  mid-`basic_attack` (55–65 locked Stone Wolf samples at x1, 8 at x4; 234–247 locked Spirit Archer
  samples at x1, 56 at x4), 0 page errors.
- All test runs used the repo's documented offline convention (scratch copy with a local
  three.min.js substituted for the CDN tag); emulated Chromium — **no real-device claim is
  made**. Human Feel Gate remains pending real Android review.

# Monster Demo Batch 1 — Remaining Five Runtime Integration v1

**Scope: Slime, Orc (`OrcBrute`), Stone Wolf, Spirit Archer, Golem.** No Spawn/Skill/Cast/
Projectile/Elite/Boss/Special state was added. Combat resolution, damage timing, and
cooldown remain 100% Runtime-owned throughout — the new code never reads or writes `hp`,
`atkCooldown`, `dmg`, or any `specialBehavior` field.

## Source package

`monster-demo-batch-1-remaining-five-motion-v1.1.zip`, SHA-256
`f15625018d280e9902e1eefabecd5acdd74fc53542ad684932f2a1d81745d871` (independently
re-verified in this task — see below). 176 production frames across 25 sequences (5
monsters × Idle/Move/Basic Attack/Hit/Death).

## Shared, data-driven architecture (not five bespoke systems)

Following the Skeleton Runtime Pilot's own pattern (`cc/skeleton-runtime-integration-pilot-v1`,
commit `2e721c7`) but generalized into one shared path for all five new monsters:

- `MONSTER_MOTION_DEFS` — one data table (frame counts, durations, loop flags, presentational
  markers) covering all five monsters, built directly from their approved metadata sidecars.
- `MONSTER_TEXTURES` / `MONSTER_MOTION_READY` / `loadMonsterMotionSprites(spriteKey)` — one
  generic loader called once per monster (5 calls total), each independently gating that
  monster's readiness.
- `setMonsterFrame` / `triggerMonsterAnim` / `updateMonsterMotionAnim` /
  `advanceMonsterDeathAnim` — one set of generic functions, keyed by `u.monsterSprite`,
  serving all five monsters identically. `skeletonFrameIndexForTime` (already fully generic —
  takes only a `{durations, loop}` sequence, no Skeleton-specific reference) is reused as-is,
  avoiding a duplicate copy.
- `isSharedUnitTexture` extended by one line (`MONSTER_TEXTURE_SET`) — same shared-cache
  disposal-safety pattern as Skeleton's own `SKELETON_TEXTURE_SET` line.
- `makeUnit` extended by one additive block: `u.monsterAnim`/`u.monsterSprite` assigned only
  when `MONSTER_MOTION_DEFS[cfg.sprite] && MONSTER_MOTION_READY[cfg.sprite]` — every hero,
  Skeleton, and every other unit is completely unaffected.
- Five hook points (`updateAnim`, `applyHitFlash`, `handleUnitDeath`, the basic-attack block
  in `updateUnit`, the dead-unit section of `animate()`) each gained one additive
  `if (u.monsterAnim) ...` line, parallel to Skeleton's existing `if (u.skelAnim) ...` line —
  Skeleton's own lines are untouched.

**Skeleton's own code (`SKELETON_ANIM_DEF`, `SKELETON_TEXTURES`, `skelAnim`, etc.) is
completely untouched** — this satisfies "modify Skeleton Runtime behavior except for the
smallest shared extension strictly required": the only touches near Skeleton's code are the
one-line `isSharedUnitTexture` addition and the five one-line hook-point additions, all of
which are no-ops for Skeleton units (Skeleton never gets `u.monsterAnim`).

## State mapping

`Basic Attack` (package) → `Attack` (Runtime state name used in this report) is implemented
as the `basic_attack` key throughout the code (matching the package's own naming and
avoiding the exact `'attack'` vs `'basic_attack'` string-mismatch bug that was found and
fixed during Skeleton's own validation — this integration used the correct key from the
start).

| Runtime signal | State | Loop | Notes |
|---|---|---|---|
| `u.moving === false` | Idle | yes | default fallback |
| `u.moving === true` | Move | yes | |
| basic-attack fires (`updateUnit`) | Attack (`basic_attack`) | no, resumes Idle/Move | |
| `applyHitFlash` on this unit | Hit | no, resumes Idle/Move | |
| `handleUnitDeath` on this unit | Death | no, terminal | |

## Asset registration

Only approved production PNGs were registered, at
`assets/monsters/<filePrefix>_motion/<state>/<filePrefix>_<state>_NNN.png` (mirroring
Skeleton's `assets/monsters/skeleton_motion/...` convention exactly):

| Monster | spriteKey | packageDir | filePrefix |
|---|---|---|---|
| Slime | `Slime` | `slime` | `slime` |
| Orc | `OrcBrute` | `orc` | `orc` |
| Stone Wolf | `StoneWolf` | `stone-wolf` | `stone_wolf` |
| Spirit Archer | `SpiritArcher` | `spirit-archer` | `spirit_archer` |
| Golem | `Golem` | `golem` | `golem` |

No review GIFs, contact sheets, decision sheets, technical QA documents, or the rejected v1
package were registered or copied — production PNGs only, verified byte-identical to the
approved v1.1 package at copy time (176/176, `diff -rq` against the extracted package showed
zero differences).

## Monster-specific Runtime notes

- **Slime, Orc**: had no static-sprite `ASSET_META` entry before this task (previously
  rendered as colored-box placeholders). This integration adds their motion-based rendering
  directly — their fallback (if motion frames fail to load) is the pre-existing colored-box
  placeholder path in `makeUnit`, unchanged.
- **Stone Wolf, Spirit Archer, Golem**: already had a static `ASSET_META` sprite; fallback is
  that static PNG, unchanged.
- **Golem**: keeps its pre-existing `frameSize: { w:1.3, h:1.5 }` override in `ENEMY_BASE`
  (untouched) — confirmed the larger sprite-plane sizing is preserved correctly with motion
  frames (see `x1_Golem_3_basic_attack.png`).
- **Spirit Archer**: ranged (`range:4`, `specialBehavior:{type:'ranged'}`). Its Basic Attack
  metadata carries a `release` marker but no `impact` marker (impact occurs at the target,
  off-screen) — this is not a projectile and none was created; the `markers.impact` field is
  simply omitted for this monster, exactly matching the approved package.
- **RuntimeFlipX**: every monster's metadata recommends a horizontal-mirror flip. Matching
  the Skeleton Runtime Pilot's own precedent, this is **not applied** — this Runtime has no
  flip logic anywhere (units are camera-facing billboards), so it is documented here as a
  recommendation only, consistent across all six motion-integrated monsters (Skeleton + these
  five). No scale-inversion bug is possible since no flip transform is ever applied.

## Bug class avoided

Skeleton's own validation found and fixed a state-string mismatch (`'attack'` vs.
`'basic_attack'`) that silently broke every attack-frame render. This integration used
`'basic_attack'` consistently from the start (matching `MONSTER_MOTION_DEFS` keys and the
package's own naming) — confirmed via the transition matrix and cycle tests below: 0 page
errors across all scenarios for all 5 monsters.

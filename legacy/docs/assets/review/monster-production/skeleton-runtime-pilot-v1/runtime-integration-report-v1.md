# Skeleton Runtime Integration Pilot v1 — Runtime Integration Report

**Scope: Skeleton only.** No other monster (Slime, Orc, Stone Wolf, Spirit Archer, Golem) is
touched. No Spawn/Skill/Cast/Projectile/Elite/Boss/Special states are added. No Combat,
damage-formula, balance, economy, AI, board-topology, camera, UI, VFX, projectile, or
GitHub-workflow files are changed.

## What changed

- `src/game.js` — additive only. A new, fully separate presentation-only animation
  controller for Skeleton (`SKELETON_ANIM_DEF`, `SKELETON_TEXTURES`,
  `loadSkeletonMotionSprites`, `skeletonFrameIndexForTime`, `setSkeletonFrame`,
  `triggerSkeletonAnim`, `updateSkeletonMotionAnim`, `advanceSkeletonDeathAnim`), gated
  behind `u.skelAnim`, which only a Skeleton unit ever receives (`cfg.sprite === 'Skeleton'
  && SKELETON_MOTION_READY`). Six single-line hooks connect it to existing, untouched
  systems (`updateAnim`, `applyHitFlash`, `handleUnitDeath`, the basic-attack block in
  `updateUnit`, `isSharedUnitTexture`, and the main `animate()` loop's dead-unit section).
  Every hook is a no-op for any unit without `u.skelAnim` — i.e. every hero and every other
  monster runs the exact pre-existing code path, byte-for-byte.
- `assets/monsters/skeleton_motion/<state>/` — new directory, 36 PNG frames, byte-identical
  copies of the Exact-Motion-Package-Approved production frames (see
  `docs/assets/review/monster-production/skeleton-motion-pilot-v1/`).
- `docs/assets/review/monster-production/skeleton-runtime-pilot-v1/` — this review package
  (state mapping, transition QA, x1/x4 validation, resource notes, human review sheet,
  screenshots).

## Runtime contract (as implemented)

```
Idle  <-> Move  (continuously follows the existing u.moving flag, no new logic)
Idle/Move -> Attack -> Idle|Move   (one-shot, fires alongside the existing basic-attack trigger)
any non-death state -> Hit -> Idle|Move   (one-shot, fires alongside the existing applyHitFlash trigger)
any state -> Death -> Dead   (one-shot; locked — no state can ever follow Death)
Dead -> removal handled entirely by the existing Runtime (clearEnemies() at next wave boundary)
```

Animation markers (`release_frame`/`impact_frame`/timings) are carried as inert metadata
only. **Damage timing, cooldown, and all combat resolution remain 100% Runtime-owned** —
verified by inspection (the new code never reads/writes `hp`, `atkCooldown`, `dmg`, or any
combat variable) and by the fact that removing the `if (u.skelAnim) trigger...` lines
entirely would not change combat outcome in any way.

## Fallback behavior

If motion frames fail to load (`SKELETON_MOTION_READY` stays `false`), Skeleton silently
keeps using its original static `ASSET_META.Skeleton` sprite (`assets/mon_skeleton.png`) —
the pre-existing, unmodified behavior. Verified in Scenario E (see x1 validation report).

## Bug found and fixed during validation

An internal naming mismatch was found and fixed before commit: the attack trigger call used
the literal state string `'attack'`, but `SKELETON_ANIM_DEF` (and the asset folder/file
names) use the key `'basic_attack'`. This caused `SKELETON_ANIM_DEF[sa.state]` to resolve to
`undefined` every time a Skeleton attacked, throwing inside the main `animate()` loop and
silently skipping that frame's render call. Fixed by changing both the trigger call site and
the `updateSkeletonMotionAnim` state check to consistently use `'basic_attack'`. Re-validated
after the fix: 0 page errors across all scenarios (see validation reports).

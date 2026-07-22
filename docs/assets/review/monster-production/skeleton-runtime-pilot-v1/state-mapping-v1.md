# Skeleton Runtime Integration Pilot v1 — State Mapping

| Runtime signal | Animation state | Frames | Loop | Source |
|---|---|---|---|---|
| `u.moving === false` (default) | Idle | 6 | true | `assets/monsters/skeleton_motion/idle/` |
| `u.moving === true` | Move | 8 | true | `assets/monsters/skeleton_motion/move/` |
| basic-attack fires (`updateUnit`, `atkCooldown<=0`) | Attack (`basic_attack`) | 9 | false, resumes Idle/Move | `assets/monsters/skeleton_motion/basic_attack/` |
| `applyHitFlash(target,...)` on this unit | Hit | 4 | false, resumes Idle/Move | `assets/monsters/skeleton_motion/hit/` |
| `handleUnitDeath(target,...)` on this unit | Death | 9 | false, terminal | `assets/monsters/skeleton_motion/death/` |

## Import rule verification

- **PNG**: all 36 frames RGBA8, 640×960, verified byte-identical to the Exact-Motion-Package-
  Approved source (see `skeleton-motion-pilot-v1/verification-record-v1.md`) — re-confirmed
  by direct `diff` at copy time.
- **Metadata/anchor/baseline**: bottom-center anchor (x=0.5, baseline Y=855px half-open),
  as recommended in the approved package metadata. The existing sprite-plane pivot
  (`body.position.y = h/2`, i.e. bottom-anchored) already matches this convention with no
  changes needed.
- **Flip**: no horizontal-flip logic exists anywhere in the Runtime (`scale.x = -1` /
  `flipX` / `mirrorX` all return zero matches) — units are camera-facing billboards
  (`u.group.quaternion.copy(camera.quaternion)`). The approved package's `RuntimeFlipX`
  recommendation is therefore **not applied**, consistent with how every other monster in
  this Runtime already behaves. Documented here as a recommendation only, matching the
  motion package's own verification record.
- **Scale**: Skeleton keeps its existing 1.1×1.6 sprite-plane sizing (`ASSET_META.Skeleton`
  still reports `frames: 1`, so `makeUnit`'s frame-count branch is untouched).
- **Timing/loop**: per-frame durations copied unmodified (cs→seconds) from the approved
  package's `timing-overview.json`; loop flags match the approved package exactly (Idle/Move
  loop, Attack/Hit/Death do not).
- **No duplicate registration**: `SKELETON_TEXTURES` is a single module-level cache built
  once by `loadSkeletonMotionSprites()`, called exactly once at startup; confirmed via
  network-request count (36 requests total, unchanged across 15 spawn/kill/remove cycles —
  see `x1-x4-validation-report-v1.md`).

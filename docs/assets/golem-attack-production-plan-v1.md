# Golem Attack Production Plan v1

## Scope

Motion-test artwork plan for the approved Map 1 Golem pilot only. This document defines visual production constraints and frame intent. It does not modify combat logic, damage, hitboxes, targeting, pathfinding, map layout, or the game loop.

## Locked identity

- Unit: `monster.golem`
- State: `attack`
- Visual identity: massive brown-gray stone guardian with cyan crystal seams, cyan spiral rune plates, oversized fists, broad shoulders, short heavy legs, stern stone face.
- Camera: fixed 3/4 front view matching the approved pilot reference.
- Style: stylized 3D fantasy, hand-painted mobile-game asset, strong readable silhouette.
- Background: true transparent alpha. No checkerboard pixels baked into the artwork.
- No baked projectile, dust cloud, shockwave, damage number, impact flash, floor crack, shadow plate, or runtime VFX.

## Runtime contract

- Frame count: 12 target, accepted range 8–12.
- FPS: 12.
- Playback: non-loop.
- Anchor: `[0.5, 0.94]`.
- Root motion: in-place.
- Event: `impactCue` at normalized time `0.58`.
- Suggested production canvas: `512 × 512`, identical for every frame.
- Runtime owns horizontal flipping.
- `canonicalApproved` remains `false` until an in-game visual review passes.

## Attack concept

A heavy two-handed ground slam. The Golem compresses its weight, draws both fists upward and slightly backward, then drives both fists down with a short torso drop. The attack must feel slow, massive, and decisive while the feet remain planted on the same tile.

The artwork must show anticipation and follow-through clearly at game scale. The impact itself is represented by body mechanics only; visual effects are added by runtime later.

## Frame map

| Frame | Phase | Required pose intent |
|---|---|---|
| `000` | Ready | Neutral combat stance; both fists low; feet planted; baseline silhouette. |
| `001` | Compression | Knees and torso lower slightly; shoulders draw inward; weight gathers. |
| `002` | Wind-up start | Both elbows bend; fists begin rising; torso leans back slightly. |
| `003` | Wind-up | Fists rise beside the shoulders; chest rune remains visible; feet fixed. |
| `004` | Peak wind-up | Fists reach the highest readable position; body at maximum extension. |
| `005` | Direction change | Torso starts pitching forward; fists begin accelerating downward. |
| `006` | Downswing | Arms descend strongly; shoulders and head follow; no impact VFX. |
| `007` | Impact pose | Lowest, heaviest contact pose; fists near ground; `impactCue` occurs between `006` and `007` around `0.58`. |
| `008` | Hold/recoil | Brief compressed impact hold; cyan seams may appear brighter only through existing painted highlights, not added VFX. |
| `009` | Follow-through | Fists start lifting; torso rebounds; feet remain locked. |
| `010` | Recovery | Shoulders return; silhouette approaches ready stance. |
| `011` | Ready return | Returns close to frame `000` without needing to form a loop. |

## Consistency locks

Every frame must preserve:

- The same stone color family and cyan glow hue.
- The same head shape, face, eye spacing, and brow angle.
- The same number and placement of major shoulder, chest, forearm, thigh, and back stones.
- The same spiral rune placement on chest, shoulders, forearms, and belt plate.
- The same crystal clusters and major cracks.
- The same body scale relative to the canvas.
- The same perspective and light direction.

Minor deformation between stone joints is allowed to communicate motion. Stones must not grow, disappear, change sides, or change rune design between frames.

## Anchor and composition

- Use the bottom-center contact line as the stable reference.
- The midpoint between both feet must resolve to anchor `[0.5, 0.94]`.
- Feet may compress or rotate subtly but must not translate across the tile.
- Leave safety margin above the peak wind-up fists and around both outer arms.
- No frame may touch or crop against the canvas boundary.

## Visual acceptance checklist

1. All 12 frames read as the same Golem.
2. The attack direction is unambiguous when played `000 → 011`.
3. Anticipation is visible before the downswing.
4. `impactCue @ 0.58` aligns with the transition into the lowest contact pose.
5. Feet and anchor do not drift.
6. No baked world movement or VFX is present.
7. Alpha is real and checkerboard-free, including enclosed gaps.
8. The sequence remains readable at Arena Ruins board scale and at x4 playback.

## Planned in-game review

After production frames exist, test only these three checkpoints at x4:

1. Asset Load — all frames load, alpha and metadata diagnostics pass.
2. Playback — non-loop sequence completes and restarts without crop or tile drift.
3. Marker + Visual Review — `impactCue` fires once near `0.58`; anticipation, impact, identity, anchor, and scale are visually acceptable.

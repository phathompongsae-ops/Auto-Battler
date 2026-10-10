# Skeleton Brute (`crypt_brute`) production art: staging

The contract is `pending` (`src/data/monsterAnimArt.ts`). Nothing here is loaded by the game.

| File | What |
|---|---|
| `source/reference-idle-pair.png` | **Locked identity / style reference**, user-supplied and approved 2026-10-10. Do not redesign: the skull, proportions, stone hammer, wraps and loincloth, palette and silhouette are fixed for every state. Its two poses are the idle. |
| `idle.png` | Staged production idle: 2 × 176×144, feet row 142. |
| `fit-idle.mjs` | Reproduces `idle.png` byte for byte from the reference (the command is in its header). |

## Contract (176×144, feet row 142, standing 88–100)

The cell is room for the hammer and the animation (walk, swing, overhead Bone
Smash). It is not a bigger body. Every state is drawn at the idle's scale
(0.1456 of the reference), facing east, with feet centred on the cell and
standing on row 142. The lowest pixel is on row 141, and rows 142–143 stay clear.
No baked shadow, background or text.

## Idle QA

| | Frame 0 | Frame 1 |
|---|---|---|
| Visible bounds (x, y) | 47–156, 48–141 | 46–155, 47–141 |
| Standing height | 94 | 95 |
| Feet span on row 138 / centre (cell centre 87.5) | 55–121 / 88 | 55–119 / 87 |

- **Alpha cleanup:** the reference's body sat at alpha 252–254, with a faint
  1–15 alpha haze around it. In the source, 16,204 haze pixels were cleared and
  573,868 near-opaque pixels (alpha 224–254) were lifted to 255. The 16–223
  edge ramp was kept and then area-resampled, so edges stay anti-aliased.
  Result: 10,470 pixels sit 2 px or more inside the silhouette, and 10 of them
  are below 255. Those are real see-through gaps in the drawing (between the
  fingers on the handle, between the legs under the loincloth), not global
  translucency.
- **Feet:** the back foot is pinned at the same x in both frames. The front foot
  differs by about 1 px, as in the reference.
- **Hierarchy (shared feet line, world scale):** Skeleton 78 < Brute 94/95 <
  Knight 106 < Lord 151.
- **Validator:** `node tools/monster-art/stripMetrics.mjs art-source/monsters/crypt_brute/idle.png 176 144 142 88 100` passes.
  Its opt-in feet-centre reading of frame 1 (100.5) picks up the hammer head
  in the lowest rows. The unit test measures the feet on row 138 instead.

# Final combat presentation polish (2026-10-12)

Started on `phaser-rebuild` at `56f863ed`. Presentation only: no balance, damage, radius, cooldown, wind-up, aggro,
leash or encounter changes, and no new systems.

## Warrior idle (`src/data/characterArt.ts`, `src/entities/Player.ts`)

- **Before:** the 4-frame idle strip played at an even 5 fps, a 0.8 s loop. Frame 2 settles about 1 source px down
  and across, so the loop read as a stiff flicker.
- **After:** the same four frames, with no redraw, play in an uneven ~1.8 s rhythm (`WARRIOR_IDLE_TIMING`):
  - neutral pose for 700 ms;
  - in-between for 240 ms;
  - weight-shift pose for 620 ms;
  - in-between for 260 ms.

  The figure rests, eases into the weight shift, holds it and returns, like a calm breath.
- **Mechanism:** an optional per-frame `timing` on a strip (in Phaser 4 a frame duration replaces the frame rate).
  It applies to every Warrior idle facing; walk and attack keep their even cadence.
- **Unchanged:** the sprite is never scaled (the Arcade body follows its scale), so the feet, origin and collision
  stay exactly as before. Walk, attack, skill and dodge transitions are unchanged.

## Shared progressive telegraph

Files: `src/rendering/Telegraphs.ts` (rendering) and `src/rendering/telegraphCurve.ts` (the pure curve).

- **Scope:** one system for every monster wind-up: Bone Smash, Grave Slam, Stomp, plus Gore and other single-target
  wind-ups.
- **Clock:**
  - Progress is `(world.now − wind-up start) / real wind-up ms`, read every frame from the game clock. It pauses
    with hit-stop and cannot drift from the damage.
  - The zone ends on the first frame the hit is due, or when the caster stops winding up or dies. A landed hit
    flashes briefly (140 ms, after the damage tick); a cancelled one just disappears.
- **Curve:** intensity runs from 0.12 to 0.55 over the first 70 % of the wind-up (eased), then rises steeply to 1.0
  over the final 30 %.
- **Layers:**
  - soft red ground-shadow fill, alpha 0.04 → 0.24;
  - growing inner fill (scale = progress), as a "how long is left" cue;
  - edge, alpha 0.18 → 1 and width 1.1 → 2.8 px, with a restrained pulse in the last 25 %;
  - dark under-stroke so the edge reads on the Crypt carpet.

  The colours are muted red, never neon, and there is never an opaque disc.
- **Allocation:** shapes are pooled and restyled in place, with no per-frame allocation. The old version created
  three new circles and a tween for every cast.
- **Measured** (CP-2 / CP-3; the same curve for all three):

  | Monster | Wind-up | Early (~20 %) | Mid (~50 %) | Late (~85–90 %) | Zone end vs damage tick |
  |---|---|---|---|---|---|
  | Brute — Bone Smash | 1400 ms | 0.16 | 0.38 | 0.82 | same frame (~7 ms) |
  | Lord — Grave Slam | 1100 ms | 0.16 | 0.38 | 0.82 | same frame |
  | Guardian — Stomp | 1000 ms | 0.16 | 0.38 | 0.82 | same frame |

  Progress tracks the real wind-up within one frame (≤ 8 ms).
- **Gameplay:** impact timings and damage are unchanged (BP-6 1403 ms, LP-6 1104 ms, GP-6 1007 ms / 39 damage).
  Dodge still avoids all three (BP-7, LP-7, GP-7).

## 640×360 [T] Talk prompt (`src/ui/styles/hud.css`)

Below 760 px wide, the prompt sits 64 px left of centre, which clears the HP potion slot and the chat preview even
for the longest NPC name (CP-4). At 844×390 and 960×540 nothing changes. Interaction and talk range are unchanged.

## Tests

- **Unit:** a new suite covers the curve shape (soft early, rising, urgent final 30 %, clamped) and the idle timing.
- **`--presentation-review`**, CP-1…CP-4:
  - CP-1: idle rhythm with feet planted;
  - CP-2: game-clock progress, early < mid < late, and the zone ending on the damage tick;
  - CP-3: one shared curve with the real wind-ups;
  - CP-4: the Talk prompt is clear at 640.
- **Updated:** HS-7 locked the old "full-strength edge from the start" ring. It now checks the progressive contract:
  all four layers on the real radius, light fills, and an edge that is visible mid wind-up but below full strength.

## QA results

- **Typecheck and build:** PASS.
- **Unit tests:** 629/629.
- **`--presentation-review`:** 7/7.
- **Boss and combat reviews:** Brute 24/24, Lord 24/24, Guardian 25/25, Warrior 24/24 (W-3 included).
- **HUD reviews:** HUD 40/40, HUD status 14/14 (HS-7 updated).
- **Story review:** 12/12.
- **Full browser suite:** 499/499 in one run (the previous 495 plus CP-1…CP-4), with no console errors.
  - No file changed during the run (SHA-1 before and after).
  - The lowest recorded free RAM was about 7.0 GB.
- **Performance:** the suite's combat check reads 114.5 FPS, p95 14.0 ms, max 34.7 ms. That is in line with recent
  runs (p95 14.0, max 27.7–34.7), so there is no regression. Telegraph shapes are pooled and restyled in place.

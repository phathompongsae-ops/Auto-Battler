# Visual Quality Pass 1 — Environment & art consistency (2026-10-12)

Started on `phaser-rebuild` at `323eab31`. No paid generation, no purchases, no downloads. Every new visual is
code-drawn in this repo. Combat, AI, collision, movement and the HUD layout are unchanged.

## Audit: the five highest-impact weaknesses (before)

1. **Crypt portals were placeholder squares.** "Exit to Town" and "Return to Town" were flat purple debug tiles
   (two lilac squares and a dot), the most obviously unfinished thing in the dungeon.
2. **Story gate seals were weak.** Each was a faint amber band with three small rune diamonds across a doorway, and
   read as a UI glitch rather than a barred door.
3. **Water was flat.** The pond was one repeated wave tile with no depth, so it read as wallpaper.
4. **Contact shadows were hard-edged.** Characters, monsters and NPCs stood on solid ellipses that read as
   stickers, not as contact with the ground.
5. **A label covered the hero.** The "SECTION I" landmark name sat across the Crypt doorway the player walks
   through, overlapping the hero and their HP bar.

Also noted, but out of scope for code-only art (see Limitations): the pond's wave motif, Field map edges, and the
Town gate thresholds (already continued as road).

## Changes

- **Crypt stairwell portals** (`graphics/envFeatureArt.ts`, `WorldScene.drawPortalArt`):
  - A carved stone frame (posts, lintel with skull keystone and rune grooves, moss at the feet) around a dark
    descending stair, with a cool pale glow of daylight at the far end. It is drawn over each Crypt portal and opens
    toward the room it leaves (flipped for the south exit).
  - Portal cells are now skinned as floor stone, so no purple shows. The trigger area and collision are unchanged
    (VQ-3 walks out through it).
- **Iron portcullis seals** (`rendering/GateBarriers.ts`): closed Story gates show a dark iron portcullis with
  spiked feet, cross beams and an amber rune lock, with a warm floor glow that breathes gently. It is shown and
  hidden exactly as before (SF-1/SF-3, VQ-2); the old rune band remains the fallback.
- **Pond depth:** cells shade deeper blue the farther they are from shore, using soft overlapping discs so no tile
  grid shows. Sparse light glints drift slowly. This is two static Graphics objects per map and one tween.
- **Soft contact shadows:** one feathered shadow texture replaces the hard ellipses for the player, monsters and
  NPCs. Size and position are the same, and the core is slightly stronger so they stay as visible. The images are
  pooled and reused every frame; the hard ellipses remain the fallback.
- **Landmark labels:** a landmark name fades to 18 % while the player stands under it, and returns afterwards.
  This applies to every map (VQ-4).

## Consistency check

The Warrior, the NPCs and the monsters already share one scale contract: production masters at 0.32 and monster
strips on their feet line. The soft shadows now match across all three. No sprite was scaled or re-anchored, and no
physics body changed.

## Verification

- **Typecheck and build:** PASS.
- **Unit tests:** 629/629.
- **New `--vq-review`:** 8/8 (VQ-1…VQ-5).
- **Other reviews:** environment 10/10, story 12/12, NPC 7/7, HUD 40/40, presentation 7/7.
- **Performance:** a `--perf-review` A/B against `323eab31`, 2 × 3 fights each, is equal:

  | Build | Warm p95 | Cold first fight |
  |---|---|---|
  | `323eab31` (before) | 7.2–13.9 ms | ≈ 20.8 ms p95 |
  | This pass | 13.8–13.9 ms | ≈ 20.8 ms p95 |

  The cold first-fight hitch is the same pre-existing one in both builds.
- **Full browser suite (default, run once):** 502/504. No memory pressure (lowest free RAM ≈ 1.7 GB of 16 GB;
  Chrome peaked ≈ 2.3 GB). The two failures were Warrior hit-timing checks:
  - `D-left4. hit frame fires once at its configured time`: `hits=1 dt=undefinedms expected=222ms`
  - `P3. hit frame fires once at its configured time`: `hits=1 dt=undefinedms expected=313ms`

  Both had `hits=1` with the correct action and direction. The test only missed the `skillUsed` start timestamp
  it measures from, so `dt` was undefined; no hit landed at the wrong time. No Visual Quality Pass code touches
  combat timing or events (the changes are portal art, gate seals, water layers, shadows and label alpha).
- **Targeted animation recheck** (`attackAnimationSuite` + `powerSlashSuite` only, run once): 38/38, including
  D-left4 (`dt=222ms`, expected 222), P3 (`dt=313ms`, expected 313) and P4 (damage on the hit frame). The two
  full-suite failures did not reproduce and are treated as test-instrumentation timing flakes, not regressions.

## Limitations (what code-drawn art could not fix)

- **Water:** the pond's base tile keeps its repeating wave motif. The depth shading breaks it up but does not
  replace it; a proper water tileset needs new production art.
- **Field edge:** the west gate to Town is just the road running off the map. A side-facing gate arch would need
  new art, because the existing `gate_arch` faces north–south.
- **Town gate:** the Town's dungeon gate keeps its existing arch. Its purple marker dot is navigation UI and was
  intentionally left alone.
- **Other code art:** the remaining code-drawn props (standing stones, mushrooms, ruin pillars, sarcophagi,
  banners, carpet, cobwebs), item icons, NPC chibi fallback and portals are consistent and illustrated, but are not
  production PNGs. Replacing them needs generated or hand-made art.

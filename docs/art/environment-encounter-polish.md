# Environment / Encounter polish pass — Demo final visual prep (2026-10-11)

Started on `phaser-rebuild` at `bb54bab4`. Polish only: no new maps, mechanics, monsters or HUD architecture.
Camera zoom stays 1.65. Locked monster art, HUD, character window and chat are untouched. No image generation:
every new visual is code-drawn in this repo (`src/graphics/hdPropArt.ts`) or reuses integrated production PNGs.

## Audit (before)

Grades: A production-ready · B acceptable for Demo · C obvious placeholder / mismatch · D blocks readability.

| Area | Element | Grade |
|---|---|---|
| Field | grass / dirt / dark-grass / moss Wang ground, roads, tree, pine, cave, bush, rock, big rock, tent, campfire, stump, signpost | A |
| Field | pond (stepped shore, repeated wave motif), Elite Ruins dark-grass rectangle, flowers / tufts | B |
| Field | border wall: grey masonry showing between the edge trees | C |
| Field | standing stones (grey slab with a green cross, read as graves), giant mushrooms, ruin pillars, pebbles, small mushrooms: 1x code art | C |
| Field | large empty grass in the north-west, north-east and south-west quadrants | C |
| Field | Guardian Stones in the north-east corner: camera clamped to the map edge; at 844×390 / 640×360 the quest tracker and combat buttons covered most of the fight and its Stomp ring | **D** |
| Crypt | floor / wall-top skin, pillars, torches, braziers, throne, bones, rubble | A |
| Crypt | statues (Town knight reused), rune circle, gate seals, checkpoint pulses (functional code feedback) | B |
| Crypt | rooms with no wall face (floating floor rectangles); flat checker carpet; slab sarcophagi; flat banners; cobwebs scattered over room floors (three in a row in the boss room); purple checker portals | C |
| Town | NPCs: one blocky 32×44 box figure (tinted robe) for all six roles | C |

## Changes

**Guardian encounter (D → fixed).** The pond and the Guardian clearing swapped places. The pond now fills the
north-east corner (one grass tile from the forest edge), and the clearing is a dark-grass ellipse at (28, 7),
inland of it. The Guardian spawns at tile (28, 7) (was (36, 5)). The "Guardian Stones" Auto Move target stays
3 tiles south of the spawn, as before. Four standing stones ring the clearing outside a 4-tile radius, so the fight
can be circled on every side. With the player beside the Guardian, the 582×327 world-px view stays unclamped, so
the fight sits at the centre of the screen instead of under the top-right HUD.

Unchanged: Guardian stats, aggro / leash, Stomp radius and 1000 ms wind-up, damage 39, Dodge, camera and HUD.
The new spawn is 208 px from the north road and about 250 px from the Elite Boar, both beyond the 170 px aggro
range.

**Field.**
- **Border:** wall cells draw the dark-grass ground frames (shaded forest floor). Bushes, with the odd rock, fill
  the gaps between the edge trees, so no masonry shows. Wall collision is unchanged.
- **2x code art** for standing stones (weathered monolith, moss, the Guardian's amber rune), giant mushrooms,
  ruin pillars (fluted, broken, ivy), pebbles and small mushrooms.
- **Density:** small clusters (tree / bush / rock) in the empty quadrants, kept off roads, spawns, nav targets
  and the open combat rows 17–20. Ground-decor density 0.14 → 0.16.

**Crypt.**
- **Wall faces:** a brick face is drawn on every wall cell directly above walkable floor. It is visual only;
  torches and banners draw over it.
- **Carpet runner:** a new ground prop covering exactly the Carpet tiles: woven crimson, gold borders and lozenges,
  fringed end. It is darker than the old checker, so the Grave Slam ring still reads.
- **Cobwebs:** only in each room's two north corners, never across a fight's floor. Removed from the floor scatter.
- **2x code art** for sarcophagi (lid with sword relief) and banners (gold trim, crowned skull).

**NPCs.** No approved NPC art exists, and none was generated. The figure is redrawn at 2x as a chibi
(head, hair, face, shaded robe) on the same two layers, so per-NPC robe tints still work, at the same 32×44 world
size.

All 2x code art uses the PNG path: drawn at half scale with linear filtering under the same texture keys and
footprints. `?envArt=off` keeps the old 1x placeholders, and a production PNG listed in `ENV_PROP_ART` still wins.

## QA

- **Viewports** (GP-17 plus captures): Guardian on screen at 960×540 (571, 260), 844×390 (487, 188) and
  640×360 (381, 173). The camera is unclamped, and the tracker, minimap and action buttons never cover the Guardian.
  At 640×360 the ring's east edge only grazes the faint potion slot.
- **Brute / Lord:** framing unchanged. The Grave Slam ring stays bright on the darker runner.
- **Collision:** unit tests check that the clearing within 3 tiles is walkable and the stones stand outside it,
  that no solid Field prop is on water or road, that webs sit only in north corners, and that the runner covers
  exactly the Carpet tiles. The nav-reachability, spawn and portal tests pass unchanged. The Crypt gates and Story
  run pass (story review 12/12).
- **Performance:** a standalone `--perf-review` A/B against `bb54bab4` (2 × 3 runs each) is equal. The cold first
  fight is p95 ≈ 34.6 ms on both builds (an existing cold-start hitch); warm runs are p95 ≈ 14 ms on both. The
  Guardian fight is p95 7.1 ms, max 13.9 ms, no frames over 20 ms. The new art is static canvas textures created
  once at boot (the runner is 256×960; the rest are 64–136 px). Wall faces are 76 static images; the border
  undergrowth is 67 static images.
- **Results:** typecheck PASS · unit 618/618 · environment 10/10 · Guardian 25/25 · Brute 24/24 · Lord 24/24 ·
  Story 12/12 · HUD 40/40 · build PASS · full browser suite: see below.

## Final full-suite QA

1. **First full run** (after a clean typecheck, environment 10/10 and Guardian 25/25): 472 passed, 5 failed.
   - Four failures were real and caused by this pass, all in the movement suite. A tree added at tile (9, 28)
     blocked the Field's outer walkway, which the map keeps open (stops at the right wall, camera clamped right,
     camera follows the player). The water check also still pointed at the old pond position.
   - Fix: the tree moved to (9, 27), and the water check now walks north into the new pond and uses its shore as
     the threshold.
   - A new unit test keeps the outer walkway open. The movement suite then passed on its own.
2. **Verification run:** **476 passed, 1 failed, of 477 checks** (the previous 476-check baseline plus GP-17).
   - The one failure is W-3 (Power Slash rank 1). It is unrelated to this pass and timing-sensitive: the hit
     landed (105 damage), but MP read 43.05 against a 42 ≤ MP < 43 window measured with wall-clock sleeps.
   - W-3 runs at the Field spawn crossroads, which this pass did not touch. It failed the same way in the earlier
     Pass 3 rerun logs, and 1 of 3 times in `--warrior-review` during this pass.
   - Every environment check passed, including GP-17, the walls / camera / water checks, the env-art fallbacks and
     "no console errors".
3. **During both runs:** no source or test file changed (SHA-1 snapshot before and after). Free RAM was recorded
   every 15 s; the lowest reading was about 3.06 GB in the first run and 3.09 GB in the verification run.
   No stale test processes remained afterwards.

**Status:** implementation and QA are complete. The only open full-suite item is the pre-existing, timing-flaky W-3.

## Remaining visual gaps

| Priority | Gap |
|---|---|
| P0 | **NPC production figures** for the six Town roles. Now a readable chibi, but every role shares one body and is told apart only by robe tint. Static figures at about 64×88 source are enough. |
| P1 | Item / equipment icons and the four Warrior passive / proc symbols (see the visual asset audit). |
| P1 | Production PNGs for the props that are now 2x code art: standing stone, giant mushroom, ruin pillar, sarcophagus, crypt banner, cobweb, carpet runner. |
| P1 | Crypt door / gate frame art and the portal tiles (still purple checker code art). |
| P1 | Pond water base without the repeating wave motif (the pond is smaller now, so less visible). |
| P2 | Gold / Diamond currency icons, empty equipment-slot silhouettes, rune circle, pebble / small-mushroom PNGs. |
| P2 | The Elite Ruins dark-grass zone is still a hard rectangle, and the Crypt wall tops are flat. |
| — | Thai text leftovers were not audited in this pass; check them in the Thai / icon polish pass. |

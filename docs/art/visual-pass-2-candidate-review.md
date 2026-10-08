# Art candidate review — input to Visual Production Pass 2

Status: **review only, 2026-10-08 (Visual Production Pass 1).** Nothing in
`art-source/candidates/` is integrated, copied to `public/`, registered in a
loader or committed. Candidate files were read, not changed.

Set reviewed: `art-source/candidates/demo-v1-20261007/` (34 fitted candidates,
their high-resolution `sources/`, contact sheets in `previews/`, and the set's
own `manifest.csv` / `validation-summary.json`). The set's self-validation marks
all 34 PASS. That covers mechanics only (dimensions, alpha, margins, baselines).
This review adds the in-game checks: style next to the approved Town, runtime
scale at the locked camera zoom 1.55, silhouette on real ground, and coverage
of what the Demo actually spawns.

Verdicts: **PASS** (integrate as is) · **PASS WITH ADJUSTMENT** (usable;
the listed change happens during integration, no new generation) ·
**REGENERATE** (generate again) · **DUPLICATE / NOT NEEDED**.

Runtime scale: candidates render at 0.5 (one art px = 0.5 world px, 0.775
screen px at zoom 1.55), LINEAR filtering, as Town does. Monster frames get the
existing per-monster display `scale` from `src/data/monsterData.ts` (presentation
only; hit radius and physics stay as they are).

## Field environment

| Id | Asset | Candidate px | Alpha | Verdict | Notes |
|---|---|---|---|---|---|
| A1 | Broadleaf tree | 120×160 | yes | **PASS** | Matches the Town palette and outline weight. Visible ~58×60 world px inside a 60×80 canvas; bottom-centred for the existing footprint. First integration batch. |
| A2 | Pine | 88×168 | yes | **PASS** | Clean silhouette, same lighting direction as Town (top-left). |
| A3 | Cave mouth | 200×168 | yes | **PASS** | Reads as the dungeon approach; dark opening clear at 1.55. |
| A4 | Water tile | 64×64 | no (tile) | **REGENERATE** | Repeats cleanly at the edges, but every tile carries the same central ripple, which forms an obvious grid across a pond (see `previews/tile-repeat-3x3.png`). Regenerate a motif-free base, and place ripples as separate decals. No shore transitions exist yet. |

Missing for the Field (Pass 2 list): grass, path and dirt ground tiles, plus
transitions. Also rocks/bushes, fence, signpost and the Traveller Camp tent /
campfire (all still code-drawn placeholders).

## Field monsters

All monster candidates are 2-frame **idle** sheets (128×64, two 64×64 frames).
There are no walk, attack, hit or death frames. Integration needs a frame
adapter that keeps today's animation keys, hit radius and physics body.

| Id | Monster | Verdict | Notes |
|---|---|---|---|
| D1 | Slime | **PASS** | Strong chibi read; the green holds on grass thanks to the dark outline. |
| D2 | Wolf | **PASS WITH ADJUSTMENT** | Grey-white body is low contrast on sand and plaza stone at 32 world px; thin legs vanish at 0.775 screen px per art px. Re-fit from the source with a darker outline (or a slightly larger display scale). |
| D3 | Mushroom | **PASS** | Distinct red cap silhouette; matches the Town's cute register. |
| D4 | Elite Boar | **PASS** | Elite read comes from the existing ×1.6 scale; good side profile. |
| D5 | Grove Guardian | **PASS WITH ADJUSTMENT** | Displayed at ×2.1, so a 64 px frame is upscaled. Re-fit to 128 px frames from the existing 1774×887 source (no regeneration) to keep detail. |

## Dungeon environment

| Id | Asset | Candidate px | Alpha | Verdict | Notes |
|---|---|---|---|---|---|
| B1 | Crypt floor | 64×64 | no (tile) | **PASS WITH ADJUSTMENT** | Repeats well, but the warm beige stone reads like the Town plaza rather than a crypt. Shift it to the current cool grey-violet crypt value range before use. |
| B2 | Crypt wall top | 64×64 | no (tile) | **PASS WITH ADJUSTMENT** | Repeat boundary fixed in the set's own retry; still a low-detail, muddy brown blob pattern. Darken / cool it with B1 so walls separate from floor. |
| B3 | Pillar | 64×152 | yes | **PASS** | Matches the existing pillar footprints in the boss room. |
| B4 | Wall torch | 64×64 | yes | **PASS** | Small; the flame needs the existing code flicker, not a baked glow. |
| B5 | Brazier | 64×88 | yes | **PASS** | |
| B6 | Throne | 200×224 | yes | **PASS** | Strong boss-room focal point; keep it behind the Crypt Lord's spawn. |

Missing for the Dungeon: the Story gate / door frame (rune seals stay
code-drawn), cobwebs, bone and rubble decals, and section-transition arches.

## Dungeon monsters

| Id | Monster | Verdict | Notes |
|---|---|---|---|
| D6 | Crypt Skeleton | **PASS** | Big-skull chibi reads at small size; sword silhouette clear. |
| D7 | Crypt Knight | **PASS** | Navy armour holds on the dark floor thanks to the gold trim. |
| D8 | Crypt Lord | **PASS WITH ADJUSTMENT** | Displayed at ×2.5: re-fit to 128 px frames from the source, as for D5. The purple cape is the boss's identity colour; keep the telegraph colours distinct from it. |
| — | Skeleton Brute (`crypt_brute`) | **REGENERATE (missing)** | No candidate exists; the Story Crypt spawns it. Generate it in the D6 / D7 style. |

## VFX

| Id | Effect | Candidate px | Verdict | Notes |
|---|---|---|---|---|
| E1 | Melee slash | 768×128 (6 f) | **PASS** | Cool white arc, reads over every ground. |
| E1b | Power slash | 768×128 (6 f) | **PASS** | Gold arc, clearly heavier than E1. |
| E2 | Hit impact | 576×96 (6 f) | **PASS** | |
| E2b | Heavy impact | 576×96 (6 f) | **PASS** | Retry made it read heavier than E2. |
| E3 | Fire bolt (loop) | 256×64 (4 f) | **PASS** | |
| E3b | Fire bolt impact | 576×96 (6 f) | **PASS** | |

Integration rule (unchanged): VFX follow the existing hit / projectile events
and anchors. Damage timing and collision never come from artwork. These use
pooled sprites, like the combat numbers.

## Skill icons

Ten 128×128 symbol-only icons (`G1-*`), one for each player active skill in
`src/data/skillData.ts`: power_strike, fire_bolt, guard, charge, shield_bash,
provoke, iron_guard, whirlwind, heavy_strike, berserk.

| Verdict | Notes |
|---|---|
| **PASS WITH ADJUSTMENT** (all ten) | Distinct at 32 px and 27 px (`previews/skill-icons-32px-27px.png`). They are richer and more saturated than the HUD's bronze / steel line glyphs. When integrated inside the shared medallion socket, reduce the outer glow / gold rim so the icon does not fight the socket rim, and test the radial cooldown sweep over them. Keep the rims, key hints, locks and hit targets. |

Missing: icons for the Warrior passives (heavy_armor_mastery, sword_mastery,
guardian_instinct, battle_instinct) for the Skill Tree window; Dodge and
potion icons if the code-drawn glyphs are to be replaced.

## Other

| Item | Verdict | Notes |
|---|---|---|
| `previews/`, `*-inspection.jpg` | **DUPLICATE / NOT NEEDED** at runtime | Review material only. |
| `sources/` | keep | High-resolution originals, needed for the D2 / D5 / D8 re-fits. |
| `prepare.py`, `validate.py`, `__pycache__/` | **NOT NEEDED** at runtime | Candidate tooling; `__pycache__` should not be committed when the set is. |

## Recommended Visual Pass 2 order

1. A1, A2, A3 (drop-in props; existing footprints, depth and occlusion).
2. E1–E3b VFX on the existing combat events (pooled).
3. Monster frame adapter, then D1, D3, D4, D6, D7 as is; D2, D5 and D8 re-fitted.
4. B3–B6 crypt props; B1 / B2 after the palette shift.
5. Skill icons inside the medallion sockets.
6. Regenerate: A4 water base, Skeleton Brute; generate the missing Field ground set.

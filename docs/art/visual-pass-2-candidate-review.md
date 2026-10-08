# Art candidate review and Visual Production Pass 2 integration

Status: **reviewed in Visual Production Pass 1; integrated in Visual Production
Pass 2 (2026-10-08)**: see [Integration status](#integration-status-visual-production-pass-2)
first. The candidate folder itself (`art-source/candidates/`) is still not
committed; runtime files are derived from it by `tools/env-art/pass2-jobs.json`.

## Integration status (Visual Production Pass 2)

Pipeline: `node tools/env-art/prepareArt.mjs tools/env-art/pass2-jobs.json`
(crop / refit from the high-resolution sources, colour grade, outline, glow
trim), then the Crypt ground atlas:
`node tools/env-art/buildTileAtlas.mjs public/assets/environment/dungeon/ground/crypt_ground.png 64 tmp/env-art/crypt_floor.png tmp/env-art/crypt_floor.png:flipX tmp/env-art/crypt_floor.png:flipY tmp/env-art/crypt_floor.png:flipX:flipY tmp/env-art/crypt_wall.png tmp/env-art/crypt_wall.png:flipX`.
Every runtime file has a
code-drawn fallback, and `?monsterArt=off` / `?vfxArt=off` / `?envArt=off` force
the fallbacks for comparison.

| Area | Integrated (runtime path) | Treatment | Status |
|---|---|---|---|
| Field props | tree, pine, cave (`public/assets/environment/field/props/`) | As approved; 2x art at 0.5 | **Production** |
| Field ground | — | — | **Placeholder (code-drawn)**: no approved grass / path / dirt art; water candidate rejected (visible repeat) |
| Crypt ground | floor ×4 mirror variants, wall top ×2 (`public/assets/environment/dungeon/ground/crypt_ground.png`) | Floor graded cool blue-grey (≈64% brightness, 38% saturation); wall darker so it separates from the floor | **Production** (tile skin, per-map descriptor `ENV_MAP_GROUND`) |
| Crypt props | pillar, torch, brazier, throne (`.../dungeon/props/`) | Pillar and throne stone cooled toward the floor; flames left warm | **Production** |
| Monsters | all 8 sheets (`public/assets/monsters/`) | Refit from high-res sources at 2 source px per world px; wolf +2 px dark outline and slight contrast | **Production idle only** (see below) |
| Skeleton Brute | uses the Skeleton sheet at its 1.45 tier scale (1.26× the Skeleton), multiply tint `#c8b2a4` | — | **Temporary**: a dedicated sprite is still needed |
| VFX | melee slash, Power Slash, hit, heavy hit, Fire Bolt projectile, Fire Bolt impact (`public/assets/vfx/combat/`) | As approved | **Production** |
| Skill icons | all 10 player active skills (`public/assets/ui/skills/`, 96 px) | Faint outer halo trimmed (`glowCut` 64) | **Production** |

Runtime scales at zoom 1.65 (feet to top; player 40 world px ≈ 66 screen px):

| Monster | Tier scale | Visual height (world px) | Notes |
|---|---|---|---|
| Slime | 1 | ≈ 20 | Smallest |
| Wolf / Mushroom | 1.15 | ≈ 26 / 28 | Small–medium; wolf outlined for sand / stone |
| Elite Boar | 1.6 | ≈ 38 tall, ≈ 50 long | Clearly heavier |
| Grove Guardian | 2.1 | ≈ 66 | Refit from source; clearly larger than every Field mob |
| Crypt Skeleton | 1.15 | ≈ 40 | Basic mob |
| Skeleton Brute | 1.45 | ≈ 50 | Skeleton art, tinted |
| Crypt Knight | 1.6 | ≈ 52 | Elite |
| Crypt Lord | 2.5 | ≈ 80 | Refit from source; clearly the largest and most important |

Gameplay is untouched by the art: monster physics bodies keep their exact
world-space size and offset (`entities/Monster.ts` recomputes them in frame
pixels; all 21 Field and Crypt bodies were compared with the placeholder path
and match to 1/1000 px). Shadows, HP bars and damage-number anchors keep their
tier-scaled positions. Prop footprints, collision, depth and occlusion use the
existing prop pipeline unchanged; the Crypt tile skin is visual only (the
code-drawn layer stays the collision source and still shows carpet and portals).

Animation limits (not complete): monsters have a 2-frame idle (≈3 fps sway)
that movement reuses. Attacks show no dedicated pose (the existing telegraph
and hit flash carry them) and death keeps the code-driven squash / fade. No walk, attack, hit or death
frames exist yet.

VFX follow existing events only (hit frame, damage, projectile spawn / remove).
Timing, speed, radius and damage are unchanged. One pool of 24 sprites is
created up front, plus 6 Fire Bolt views; combat adds no display objects.
Monster attacks keep the code-drawn arc.

Eric VFX Studio: **nothing integrated.** The package readmes do not document
the origin of its textures, and several sit beside other vendors' naming
(`CFXM3_`, `Gameart8.com…`, `bretto_…`). The shortlisted ring / rune / spark /
fire-burst / aura textures are on hold for **license review** before any use.

Rejected after runtime review: none of the integrated candidates. Water (A4)
stays rejected.

Set reviewed: `art-source/candidates/demo-v1-20261007/` (34 fitted candidates,
their high-resolution `sources/`, contact sheets in `previews/`, and the set's
own `manifest.csv` / `validation-summary.json`). The set's self-validation marks
all 34 PASS. That covers mechanics only (dimensions, alpha, margins, baselines).
This review adds the in-game checks: style next to the approved Town, runtime
scale at the locked camera zoom 1.65, silhouette on real ground, and coverage
of what the Demo actually spawns.

Verdicts: **PASS** (integrate as is) · **PASS WITH ADJUSTMENT** (usable;
the listed change happens during integration, no new generation) ·
**REGENERATE** (generate again) · **DUPLICATE / NOT NEEDED**.

Runtime scale: candidates render at 0.5 (one art px = 0.5 world px, 0.825
screen px at zoom 1.65), LINEAR filtering, as Town does. Monster frames get the
existing per-monster display `scale` from `src/data/monsterData.ts` (presentation
only; hit radius and physics stay as they are).

## Field environment

| Id | Asset | Candidate px | Alpha | Verdict | Notes |
|---|---|---|---|---|---|
| A1 | Broadleaf tree | 120×160 | yes | **PASS** | Matches the Town palette and outline weight. Visible ~58×60 world px inside a 60×80 canvas; bottom-centred for the existing footprint. First integration batch. |
| A2 | Pine | 88×168 | yes | **PASS** | Clean silhouette, same lighting direction as Town (top-left). |
| A3 | Cave mouth | 200×168 | yes | **PASS** | Reads as the dungeon approach; dark opening clear at 1.65. |
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
| D2 | Wolf | **PASS WITH ADJUSTMENT** | Grey-white body is low contrast on sand and plaza stone at 32 world px; thin legs vanish at 0.825 screen px per art px. Re-fit from the source with a darker outline (or a slightly larger display scale). |
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

## Still to generate (after runtime integration)

**Must generate next**
- Field ground set: grass, path and dirt bases with transitions (the Field is the biggest remaining placeholder area).
- Water: a motif-free base (A4 rejected) plus shoreline transitions.
- Skeleton Brute: a dedicated sprite (the tinted Skeleton reads as a variant, not a distinct enemy).
- Field supporting props seen in every Field screen: bush, rock / big rock, signpost.

**Should generate next**
- Monster animation: walk (2–4 frames) and attack / hit poses for the 8 monsters; bosses first (Crypt Lord, Grove Guardian).
- Crypt decals: bones, cobwebs, rubble, and the Story gate / door frame (still code-drawn crosses and webs).
- Field camp props: tent, campfire, stump, standing stone, ruin pillar, giant mushroom.
- Item icons (bag and Shop entries still use letter discs).
- Warrior passive skill icons (heavy_armor_mastery, sword_mastery, guardian_instinct, battle_instinct) for the Skill Tree window.
- NPC sprites (Town NPCs still use the shared base + tinted robe).

**Optional polish**
- Monster death frames (the squash / fade reads acceptably).
- Boss-specific VFX (Grave Slam ground crack, enrage aura); the code telegraph is readable.
- Buff / aura and checkpoint VFX, environmental particles (dust, embers): candidates exist in Eric VFX Studio pending license review.
- Illustrated Shop / utility icons (the original vector glyphs are consistent with the HUD).

**No longer needed**
- Field tree, pine, cave; Crypt floor, wall, pillar, torch, brazier, throne.
- Monster idle sheets for all 8 roster monsters.
- Core combat VFX: melee slash, Power Slash, hit, heavy hit, Fire Bolt projectile and impact.
- Active skill icons (all 10).

# Mage art: Codex image_gen handoff (2026-10-14)

This is the ready-to-copy package for the Mage art that is **actually missing**. The shipped Mage character (master,
directions, idle, walk, and the East / North attack) is production art and must **not** be regenerated. The audit and
the reasons are in `docs/design/mage-class-preparation.md`.

## 1. Shared Mage visual and style contract (paste at the top of every prompt)

> Fantasy action-RPG for web and mobile: smooth illustrated chibi characters with clean dark outlines and soft cel
> shading. The rendering is crisp but not blocky pixel art, and it is the same rendering as the reference sprites.
> The Mage is the same character as the reference master:
> - **Hair:** spiky white-silver.
> - **Eyes:** blue.
> - **Outfit:** a deep navy hooded robe and cloak with gold trim and buttons, a brown belt, and brown boots.
> - **Staff:** wooden, with a gold crescent head holding a glowing blue orb.
>
> Lighter cloth silhouette than the armoured red-haired Warrior. Same body proportions: big head, about 125 px tall
> from head top to feet in a 192×192 cell. Low top-down 3/4 camera. Transparent background, no shadow, no ground, no
> text, no frame, no border.

**Palette anchors** (sample them from the master, do not invent new ones):

| Area | Colours |
|---|---|
| Robe navy | #1e2a5a, #2c3f80 |
| Trim gold | #c9a24a, #f0cf75 |
| Hair | #e8ecf4, #b9c2d6 |
| Orb blue | #3a8cff, #9fd4ff |
| Boots and belt | #5a3a28 |

**Fire FX:** #ff7b2e, #ffd166, #c8261f. **Frost FX:** #7fd4ff, #e6f8ff, #3a6fd8. **Arcane:** #8f7bff, #5ad0ff.

## 2. Reference files Codex must inspect first

- `public/assets/characters/mage/mage_south_master.png`: identity and colour master. 192×192; feet row 153; figure
  about 125 px; body axis x ≈ 95.
- `public/assets/characters/mage/directions/mage_{south,north,east,west}.png`: turnaround.
- `public/assets/characters/mage/anims/mage_attack_east.png` and `mage_attack_north.png`: the accepted cast style,
  8 cells.
- `public/assets/characters/mage/anims/mage_attack_south.png`: **the strip being replaced** (it casts sideways).
- `art-source/characters/qa/class1_mage_animations_contact.png`: the whole accepted set at a glance.
- `public/assets/vfx/combat/fire_bolt.png` (64 px, 4 frames) and `fire_bolt_impact.png` (96 px, 6 frames): the VFX
  rendering style to match.
- `public/assets/ui/skills/fire_bolt.png`, `charge.png` and `provoke.png`: the icon style to match (96 px,
  transparent, one symbol).

## 3. Hard technical contract (from the repo; do not change)

**Character strips:**

- Horizontal strips of **192×192 cells**, no gaps or padding, transparent.
- **Feet** (lowest row of the planted boots) on **y = 153** in every frame.
- **Body / boot centre at x ≈ 95** (±2).
- Figure about **125 px** tall, same scale as the master. The engine renders at 0.32 (40 world px tall).
- 8 frames; played at 16 fps (500 ms).
- **Release frame index 4** (0-based) for `attack`, index 5 for `cast`.
- No motion blur that leaves the cell. The staff may extend sideways, but nothing crosses the cell edge.
- **After generation (user-approved update, 2026-10-14):** uniformly and proportionally downscale generated
  figures only, preserving aspect ratio and transparent edges. Use high-quality premultiplied-alpha resampling
  appropriate for the smooth illustrated art (the delivered strips use Lanczos3). Do not upscale, stretch width
  and height independently, or repaint the approved Mage identity to make it fit. Preserve raw originals, then
  register each frame's planted boots to y = 153 and body axis to x ≈ 95. Runtime scale stays 0.32.
- **Acceptance:** run the frame metrics (feet row 153, top ≈ 27–35, axis 95 ± 2) and compare against
  `class1_mage_animations_contact.png`.

**VFX strips:** horizontal strips of square cells (sizes per item), transparent, centred in each cell. Additive-friendly:
bright core and soft falloff, no dark halo, no black background.

**Icons:** 96×96 PNG, transparent. One symbol composed inside a centred circle of radius 42 px. No text, no frame, no
background disc (the UI draws the ring and dark face).

## 4. Mage master character

**Do not generate.** `mage_south_master.png` is production art (class A). Use it only as the identity reference.

If the art direction ever changes the Mage, regenerate the **whole** set from one new master; never mix masters.

## 5. Character animation strips

### 5.1 REQUIRED: South basic cast (replaces the sideways cast)

**Output:** `public/assets/characters/mage/anims/mage_attack_south.png`. That is 1536×192 (8 cells of 192). Keep the
old file in `art-source/characters/raw/mage/attack/south/` as reference before replacing it.

> [Shared contract.] The Mage faces the camera (south) and casts a quick Magic Bolt toward the viewer, at the bottom
> of the screen. 8 frames in one horizontal strip of 192×192 cells:
> 1. idle stance (as the master);
> 2. staff draws back slightly;
> 3. staff swings forward and down toward the camera, orb brightening;
> 4. staff points at the viewer, orb flaring;
> 5. **release**: a small blue arcane flash at the orb, in front of the body (no projectile beyond the orb);
> 6. flash fading, staff held;
> 7. recovery;
> 8. back to the idle stance.
>
> The body stays planted: feet on y = 153, body centre x ≈ 95. Same face, hair, robe, staff and scale as the
> reference master. Not casting to the side.

### 5.2 OPTIONAL (decision 2): shared spell cast `cast`

**Outputs:** `public/assets/characters/mage/anims/mage_cast_{south,north,east}.png`, each 1536×192. West mirrors east,
so the staff must stay in front of the body.

> [Shared contract.] A stronger spell-cast pose for area spells, facing {south | north (back to camera) | east
> (right)}. 8 frames, 192×192 cells:
> 1. idle;
> 2. both hands grip the staff;
> 3–4. staff raised overhead, orb gathering light, cloak lifting slightly;
> 5–6. **release frame 5**: staff thrust down and forward, bright orb flash, cloak flaring;
> 7. hold;
> 8. return to idle.
>
> Restrained, readable at 66 px on screen; not an exaggerated leap. Feet planted on y = 153, body centre x ≈ 95.
> Identity identical to the reference master.

## 6. VFX and projectile strips

All go in `public/assets/vfx/mage/`. Each prompt below starts with the colour line for its element, then the
specific instruction.

### 6.1 `magic_bolt.png`: projectile loop

256×64 (4 cells of 64×64), plays at 14 fps.

> A small arcane magic bolt travelling to the right: a bright white-blue orb core with a short violet-blue comet tail
> and two tiny orbiting sparks. Seamless 4-frame loop with a subtle pulse and the tail flickering. Centred in each
> 64×64 cell, pointing +X. Transparent, additive-friendly glow, no dark outline. Same painterly-crisp style as
> `fire_bolt.png`.

### 6.2 `magic_bolt_impact.png`: impact

576×96 (6 cells of 96×96), 220 ms.

> Arcane bolt impact: a quick violet-blue starburst. Frame 1 is a bright point; 2–3 expand into a ring with spark
> shards; 4–5 shards drift outward and fade; 6 is faint motes. Centred in each 96×96 cell. Transparent, additive.

### 6.3 `flame_burst.png`: target area burst

1536×192 (8 cells of 192×192), 400 ms. The game shows it at a 2-tile radius (≈64 world px).

> A fire burst erupting from the ground, seen from a low top-down 3/4 view.
> 1. a glowing orange ring on the ground;
> 2–3. flames shooting upward around the ring;
> 4. full eruption, bright yellow core;
> 5–6. flames curling outward;
> 7–8. embers and thin smoke fading.
>
> The footprint is an ellipse about 150×75 px, centred low in the cell (ground at y ≈ 130). Transparent, additive.
> Matches `fire_bolt_impact.png`.

### 6.4 `frost_nova.png`: self-centred ring

1536×192 (8 cells of 192), 380 ms. 2.5-tile radius.

> An icy nova bursting outward from the caster's feet: a pale cyan shockwave ring expanding along the ground, with
> sharp ice crystals spiking up along the ring and frost mist. 8 frames, from a small ring to the full ellipse (about
> 170×85 px) and fading crystals. Centre of the ring at the cell centre (96, 120); no character drawn. Transparent,
> additive, cool palette.

### 6.5 `frost_storm.png`: persistent area loop

1152×192 (6 cells of 192), 10 fps, loops for 5 s.

> A small swirling blizzard over a circular area, low top-down view: snow particles and ice shards spiralling
> clockwise, soft cyan mist near the ground. Seamless 6-frame loop. Footprint about 160×80 px, centred low in the
> cell. Transparent, semi-transparent mist (alpha ≤ 0.6), so monsters stay visible beneath. The ground field is
> code-drawn; do not draw a ground disc.

### 6.6 `meteor_fall.png`: falling meteor

768×256 (6 cells of 128×256), 300 ms.

> A blazing meteor falling steeply from the top of the cell toward a point near the bottom (impact point (64, 230)):
> a molten rock with a long fiery tail, getting closer and larger across 6 frames. The last frame is just before
> contact. Transparent, additive tail.

### 6.7 `meteor_impact.png`: impact explosion

2048×256 (8 cells of 256), 450 ms. 3-tile radius.

> A massive meteor impact explosion on the ground, low top-down 3/4 view.
> 1. white flash;
> 2–3. a huge orange-red fireball dome with ground cracks glowing;
> 4–5. a shockwave ring with flying rock debris;
> 6–7. lingering flames;
> 8. smoke and embers.
>
> Footprint ellipse about 230×115 px, ground at y ≈ 175. Transparent, additive core. Readable, not screen-filling.

## 7. Skill icons

Outputs go in `public/assets/ui/skills/<id>.png`, 96×96, transparent.

> [Icon contract.] A fantasy RPG skill icon, painterly-crisp style matching `fire_bolt.png` / `charge.png`: one
> dominant symbol composed inside a centred 84 px circle, a strong silhouette, rich colour, a soft glow. No text, no
> frame, no background plate. It must read clearly at 30 px.

| File | Prompt (after the icon contract) |
|---|---|
| `magic_bolt.png` | A single violet-blue arcane bolt streaking diagonally up-right, with a bright star core and a short sparkling tail. |
| `fireball.png` *(optional; else reuse `fire_bolt.png`)* | A large round fireball with a swirling molten core and flame tongues, slightly larger and rounder than a bolt. |
| `flame_burst.png` | A fire explosion erupting upward from a glowing ground ring: a radial burst of flames, orange with a yellow core. |
| `frost_nova.png` | A pale-cyan ice ring bursting outward, with sharp crystals radiating from the centre like a snowflake shockwave. |
| `frost_storm.png` | A small swirling blizzard vortex of snow and ice shards over a frosty circle, cool blues, spiral motion. |
| `meteor_burst.png` | A blazing meteor diving down-left with a long fiery tail toward a cracked glowing impact. Dramatic, the ultimate spell. |

**Passive icons** (only if decision 3 chooses generated PNGs; otherwise code-drawn plates in `iconArt.ts`). Outputs
go in `public/assets/ui/skills/passive/<id>.png`, 96×96.

> [Icon contract, plus:] a muted passive variant: a desaturated, calmer palette and a flat, emblem-like symbol, so it
> reads clearly different from the bright active icons.

| File | Prompt |
|---|---|
| `arcane_power.png` | An arcane rune sigil: a glowing violet eye-shaped glyph inside a thin rune circle. |
| `mana_flow.png` | A blue mana droplet with a gentle circular flow of light around it. |
| `elemental_mastery.png` | One emblem split in half: a flame on the left and an ice crystal on the right, joined by a thin ring. |

## 8. Output summary

| # | File | Size | Required |
|---|---|---|---|
| 1 | `public/assets/characters/mage/anims/mage_attack_south.png` | 1536×192 | **yes** (replacement) |
| 2–4 | `public/assets/characters/mage/anims/mage_cast_{south,north,east}.png` | 1536×192 each | optional |
| 5 | `public/assets/vfx/mage/magic_bolt.png` | 256×64 | yes |
| 6 | `public/assets/vfx/mage/magic_bolt_impact.png` | 576×96 | yes |
| 7 | `public/assets/vfx/mage/flame_burst.png` | 1536×192 | yes |
| 8 | `public/assets/vfx/mage/frost_nova.png` | 1536×192 | yes |
| 9 | `public/assets/vfx/mage/frost_storm.png` | 1152×192 | yes |
| 10 | `public/assets/vfx/mage/meteor_fall.png` | 768×256 | yes |
| 11 | `public/assets/vfx/mage/meteor_impact.png` | 2048×256 | yes |
| 12–16 | `public/assets/ui/skills/{magic_bolt,flame_burst,frost_nova,frost_storm,meteor_burst}.png` | 96×96 | yes |
| 17 | `public/assets/ui/skills/fireball.png` | 96×96 | optional |
| 18–20 | `public/assets/ui/skills/passive/{arcane_power,mana_flow,elemental_mastery}.png` | 96×96 | if decision 3 = generated |

**Delivery note:** Codex should also save each raw generation under `art-source/characters/raw/mage/` or
`art-source/vfx/mage/` before aligning or cropping, and report its frame metrics.

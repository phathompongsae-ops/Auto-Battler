# Production NPC figures — brief and drop-in pipeline (2026-10-11)

This is the last P0 visual blocker. The art is generated outside this repo with Codex `image_gen`, by the user,
because PixelLab, the pipeline used for the player's class masters, had no generations left this cycle. Everything
around the art is ready: a contract, a fitter, loader / drawing code with a breathing idle, a fallback, and tests.
Delivering a figure takes four commands per NPC (see the drop-in steps below).

## Current state (audit)

| NPC (id) | Role line | Stands at (Town tile) | Services | Current art |
|---|---|---|---|---|
| Captain Rowan (`npc_captain_rowan`) | Adventurers' Guild | (17, 14) plaza | dungeon | code-drawn chibi, blue robe tint |
| Smith Brann (`npc_smith_brann`) | Enhancement | (37, 8) by the Forge | enhancement | same body, red tint |
| Enchanter Lyra (`npc_enchanter_lyra`) | Enchant | (6, 22) by the Enchant Hall | enchant | same body, violet tint |
| Crafter Odo (`npc_crafter_odo`) | Crafting | (37, 22) by the Workshop | craft | same body, orange tint |
| Stablekeeper Mira (`npc_stablekeeper_mira`) | Pet Stable | (22, 24) by the Pet Stable | pet | same body, green tint |
| Job Instructor (`demo_job_instructor`) | Job Change | (7, 8) by the Job Hall | job | same body, gold tint |

- **Location:** all six are in Town. There are no NPCs in the Field or the Crypt.
- **Shared figure:** one code-drawn 2x chibi on two layers (`npc-base` and a tinted `npc-robe`), 32×44 world px,
  with its feet 6 px below the stand point.
- **Interaction:** talk range is 56 px (`NPC_INTERACT_RADIUS`). NPCs have no collision body. They never turn
  (static, south-facing), so no facing or direction work is needed.
- **Animation:** a production idle only. The game adds a slow breathing scale anchored at the feet, so a single
  static frame per NPC is enough.

## Contract (`src/data/npcArt.ts`)

This is the same contract as the Class 1 character masters (`art-source/characters/class1_masters_manifest.json`),
so NPCs stand on the player's feet line at the player's scale.

- **Canvas:** 192×192, transparent, one figure, facing south (straight at the viewer), neutral standing pose.
- **Feet:** the last boot row is row **153**.
- **Axis:** the body's mirror axis is between columns 94 and 95.
- **Height:** head top (hair / hood, not a held prop) to boot bottom is about **121 px** (118–125). Drawn at
  40 / 125 = 0.32, that is about 39 world px, the Warrior's height.
- **Edges:** nothing touches the canvas edge. Held props may rise above the head, but must stay inside the canvas.
- **Runtime:**
  - The game adds a soft contact shadow. Do not paint a shadow or ground under the feet.
  - Name plates sit 4 px above the head.
  - Rendering uses linear filtering, the same as the characters.

## Identities

Each silhouette has to read on its own at 39 px:

| NPC | Silhouette key | Outfit | Palette |
|---|---|---|---|
| **Captain Rowan** — guild captain | broad pauldrons, short cape, hand on a sheathed sword | steel breastplate over a royal-blue tabard with a gold crossed-swords emblem; short dark hair, trimmed beard | steel, royal blue, gold |
| **Smith Brann** — blacksmith | the widest body: heavy apron, forge hammer held low | bald, thick red-brown beard; rolled-sleeve cream shirt; dark leather apron and gloves; faint soot | brown leather, cream, iron, ember accent |
| **Enchanter Lyra** — enchanter | long flowing hair, a small glowing crystal held at chest height (no staff, no hat) | violet robe with silver rune trim and a short capelet | violet, lavender, silver, soft purple glow |
| **Crafter Odo** — craftsman | goggles on the forehead, tool belt, rolled blueprint under one arm | messy orange hair; mustard work vest over a green shirt; brown trousers | mustard, orange, green, brass |
| **Stablekeeper Mira** — stable keeper | wide-brimmed straw hat, small feed bucket in hand | auburn braid; leaf-green tunic dress with a white apron; brown boots | leaf green, straw, white, brown |
| **Job Instructor** — mentor | tall wooden staff with a brass ring top (just above the head), long white beard | cream-and-gold mentor coat, crimson sash, a leather training book under one arm | cream, gold, crimson, wood |

Keep the palettes away from the player's red / steel Warrior and from each other.

## Codex `image_gen` prompts

- **Style reference:** attach `public/assets/characters/warrior/warrior_chibi_front_master_v3.png`, an approved
  project master, as the style reference for every prompt.
- **References:** do not attach any third-party asset.
- **Output:** one figure per image, square (1024×1024 is fine), transparent background, or a flat single-colour
  background, which the fitter keys out.

**Shared frame**, prepended to each prompt:

> Chibi fantasy {ROLE}, full body, facing the viewer straight-on (south), standing neutral idle pose, low top-down
> camera, same chibi body proportions, head size, shoulder width, height and foot placement as the style reference
> warrior. Smooth illustrated fantasy MMORPG style matching the reference, dark outline, soft shading, not heavy
> pixel art. Simple shapes, minimal trim detail, clean readable silhouette, no text, no ground, no shadow,
> transparent background, centered, whole figure visible, feet near the bottom like the reference.

- **Captain Rowan** — ROLE: *adult male guild captain NPC*. Short dark-brown hair, neatly trimmed beard, confident
  calm face. Steel breastplate and round pauldrons over a royal-blue tabard with a small gold crossed-swords
  emblem, short blue cape, brown belt with a sheathed sword at the left hip, his right hand resting on the hilt,
  brown boots. Palette steel, royal blue, gold.
- **Smith Brann** — ROLE: *stocky adult male blacksmith NPC*. Bald head, thick red-brown beard, friendly stern face.
  Cream shirt with rolled sleeves, heavy dark-brown leather apron to the knees, thick leather gloves, a forging
  hammer held low in his right hand (head of the hammer at knee height), faint soot marks, sturdy boots. Palette
  brown leather, cream, iron grey, small ember-orange accent.
- **Enchanter Lyra** — ROLE: *young female enchanter NPC*. Long straight silver-lavender hair, gentle smile. Violet
  robe with thin silver rune trim and a short capelet, sash belt, holding a small glowing purple crystal in front of
  her chest with both hands (soft glow, no beams). No hat, no staff. Palette violet, lavender, silver.
- **Crafter Odo** — ROLE: *cheerful young male craftsman NPC*. Messy orange hair, brass goggles pushed up on his
  forehead. Mustard-yellow work vest over a green shirt, brown trousers, tool belt with a small wrench and hammer,
  a rolled blue blueprint tucked under his left arm, work boots. Palette mustard, orange, green, brass.
- **Stablekeeper Mira** — ROLE: *young female stable keeper NPC*. Auburn hair in a side braid, wide-brimmed straw
  hat. Leaf-green tunic dress with a short white apron, brown boots, holding a small wooden feed bucket in her right
  hand at her side. Palette leaf green, straw yellow, white, brown.
- **Job Instructor** — ROLE: *elderly male mentor NPC*. Long white hair and long white beard, wise kind eyes.
  Cream-and-gold long mentor coat with a crimson sash, a thick brown leather training book under his left arm, a
  tall wooden staff with a simple brass ring top in his right hand (staff top only slightly above his head).
  Palette cream, gold, crimson, wood.

**Review each result** before fitting:

- Identity reads at thumbnail size.
- Head size matches the Warrior's.
- No baked shadow, ground, text or frame.
- Hands and props are attached.
- Nothing is cropped.

## Drop-in steps (per NPC)

1. Save the chosen raw image as `art-source/npcs/<npcId>/raw.png`, plus a note of the prompt and any
   regeneration in `art-source/npcs/<npcId>/prompt.txt`.
2. Fit it:
   - Run `node art-source/npcs/tools/fit-npc.mjs <npcId> art-source/npcs/<npcId>/raw.png`.
   - If a held prop rises above the head (the Job Instructor's staff), pass the head-top row: `--top=<row>`.
   - The fitter writes the master to `public/assets/npcs/<file>.png` (path from `NPC_ART_TARGETS`) and
     `art-source/npcs/<npcId>/fit.json`. Both checks in it must be `true`: feet on row 153, clear of the edges.
3. List it: un-comment the NPC's line in `NPC_ART` in `src/data/npcArt.ts`.
4. Verify: run `npm run test:unit` (the listed file must exist and be its target), then
   `node tests/browser/run.mjs --npc-review` (NPC-1…3), then review the captures in Town at 960×540, 844×390 and
   640×360.

An NPC whose file is not listed, or fails to load, keeps the code-drawn chibi, so a partial delivery is safe.
`?art=placeholder` shows the chibis for every NPC.

## What is already implemented and tested

- **Loader:** `src/graphics/npcArt.ts` (Boot), linear filter, one texture per NPC under `npc-art-<id>`.
- **Drawing:** `WorldScene.drawNpcFigure`.
  - The figure is drawn on the contract (feet row and axis on the stand point, 0.32 scale) over a soft shadow.
  - A breathing idle (scaleY +1.4 %, 1.7 s, anchored at the feet) runs with a phase offset per NPC.
  - Name / role / quest-marker plates are lifted to clear the taller head.
  - Without art, the existing two-layer tinted chibi is drawn.
- **Unchanged:** NPC ids, dialogue, quests, positions, the 56 px talk range, map triggers and markers. NPCs still
  have no collision body.
- **Fixture:** `debug.installNpcArtFixture(id)` (test-only) draws a contract-shaped stand-in, so the production
  path is verified before any art exists.
- **Tests:**
  - `tests/unit/npcArt.test.ts`: the contract equals the class-master manifest, there is one target per NPC, and
    every listed file exists.
  - `tests/browser/npcFigures.test.mjs`, `--npc-review`:
    - NPC-1: all six on their feet line, with plates above.
    - NPC-2: the production anchor, scale, shadow, breathing and plate clearance.
    - NPC-3: talk range unchanged.

## Delivery and integration (2026-10-11)

- **Sources:**
  - Codex `image_gen` originals, 1254×1254 with transparent backgrounds: `art-source/npcs/<npcId>/raw.png`.
  - Codex also delivered pre-fitted 192×192 versions (`art-source/npcs/<name>_raw.png`). They are kept as delivered
    for reference but are not used: every runtime master is fitted from the originals by the repo fitter, so all six
    share one resampling.
- **Visual source QA:**
  - All six pass, and they read as one coherent set with the Warrior master: same chibi proportions, outline weight
    and soft shading.
  - No text, ground or shadow is baked in, there are no stray limbs or detached props, nothing is clipped, and every
    figure faces south.

### Fit (`art-source/npcs/<npcId>/fit.json`)

| NPC | Source box (x0, y0, x1, y1) | Fit inputs | Scale | Output box (x0, y0, x1, y1) |
|---|---|---|---|---|
| Captain Rowan | 302, 198, 949, 1122 | bounding box | 0.1308 | 53, 33, 136, 153 |
| Smith Brann | 261, 232, 943, 1069 | `--axis=637.5` (boot centre; the hammer widened the box) | 0.1444 | 41, 33, 138, 153 |
| Enchanter Lyra | 309, 193, 996, 1113 | `--axis=630` (boot centre; hair and crystal widened the box) | 0.1314 | 53, 33, 142, 153 |
| Crafter Odo | 409, 184, 873, 1125 | bounding box | 0.1285 | 65, 34, 124, 153 |
| Stablekeeper Mira | 357, 224, 927, 1102 | bounding box (the worn hat counts as the head) | 0.1377 | 56, 33, 133, 153 |
| Job Instructor | 324, 172, 899, 1105 | `--top=212` (head top; the staff ring rises to row 172) | 0.1353 | 56, 28, 133, 153 |

- **Every master:** 192×192, feet on row 153, a 121 px body, centred on axis 95, clear of the canvas edges. One
  uniform downscale was used per figure, with no cropping and no per-part resizing.
- **Runtime:** `public/assets/npcs/{captain_rowan,smith_brann,enchanter_lyra,crafter_odo,stablekeeper_mira,job_instructor}.png`,
  all listed in `NPC_ART`.

### In-game QA (Town, beside the player; captures at 960×540, 844×390 and 640×360)

| NPC | Verdict |
|---|---|
| Captain Rowan | **PASS with a minor note.** Clear guild captain (armour, blue tabard, cape, sword). His head is a little smaller relative to his body than the Warrior's (more adult proportions); acceptable. |
| Smith Brann | **PASS.** The widest silhouette, with apron, beard and hammer; reads instantly. |
| Enchanter Lyra | **PASS.** Long lavender hair, violet robe, glowing crystal; distinct from the Mage. |
| Crafter Odo | **PASS with a minor note.** Goggles, vest, tool belt and blueprint read clearly. His orange hair is close to the Warrior's red, but the outfit separates them. |
| Stablekeeper Mira | **PASS.** The straw-hat silhouette and bucket are unmistakable, and the hat clears the plate. |
| Job Instructor | **PASS.** Staff, white beard and mentor coat; the staff tip clears the plate. |

- **Scale:** all six stand on the player's feet line at the player's height. Nothing floats or sinks.
- **Idle:** the breathing (+1.4 % scaleY over 1.7 s, staggered per NPC) is subtle and anchored at the feet, with
  no bounce.
- **Plates:** plate height now comes from each master's real top row (measured once and cached), so hat brims and
  staff tips get the same clearance. Measured clearance is 4.7–4.8 px (NPC-4).
- **HUD:** no overlap with the NPCs. At 640×360 the "[T] Talk" prompt is partly crossed by the existing HP potion
  slot; that is pre-existing HUD layout, unrelated to the NPCs.
- **Unchanged:** interaction, quests, dialogue, positions, talk range and the absence of a collision body.

### Tests and performance

- **Typecheck and build:** PASS.
- **Unit tests:** 626/626.
- **`--npc-review`:** 7/7 (NPC-1…NPC-4 plus the boot checks).
- **Other reviews:** HUD 40/40, character 21/21.
- **Full browser suite:** 495/495 in one run (the previous 491 plus NPC-1…NPC-4), with no console errors.
  - No file changed during the run (SHA-1 before and after).
  - The lowest recorded free RAM was about 7.4 GB.
- **Performance:** the suite's combat check reads 115 FPS, p95 14.0 ms, max 27.7 ms; no regression. The cost is
  six static images, six tweens and six ellipse shadows.
- **Contact sheet:** `test-results/npc-contact-sheet.png` (local review only, not committed).

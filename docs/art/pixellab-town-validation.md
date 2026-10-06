# PixelLab Town validation set: prompts and settings

Contract: `docs/art/town-style-lock.md`. Scale and style anchor: the Warrior sheet. The user's Town reference image was described in words only, never copied or sent as an input.

## Props and buildings: `create_image_pro`

Every prop and building uses the same settings:
- `style_image_url`: the Warrior frame (PixelLab image `318d6717-…/download`)
- `style_copy`: `[outline, shading, detail]` (palette deliberately not copied, so the environment stays calmer than the hero)
- `no_background`: true

Shared prompt prefix:

> Original asset for a bright cartoon fantasy MMORPG town on an axis-aligned square tile grid, seen FRONT-FACING from high above (top-down oblique like classic 2D MMORPG towns; NOT isometric …), matching the art style of the hero reference: soft modern pixel art, smooth form shading in three tone bands plus small highlights, key light from the upper-left, short soft cool-violet cast shadow toward the lower-right at the base, coloured dark outlines …, moderate detail, natural saturation slightly calmer than the hero. SUBJECT: …

| Asset | Canvas (art px) | Seed | Job | Pick | Fit (`tools/env-art/fitAsset.mjs`) |
|---|---|---|---|---|---|
| Forge | 512×416 | 4102 | (2nd try) | 1 candidate | 512×416 `--fill-width` |
| Hall of Legends monument | 256×320 | 4201 | | 1 | 256×320 `--fill-width` |
| Cherry tree | 144×176 | 4301 | | 1 | `--fill-width` |
| Market stall | 200×180 | 4401 | | 1 | `--fill-width` |
| Enchant crystal | 64×128 | 4501 | | best of 4 | 64×128 |
| Anvil | 64×64 | 4601 | 726331dc | #3 | 64×64 |
| Lamp post | 48×144 | 4701 | 5bc43ece | #2 | 48×144 |
| Barrel | 52×64 | 4801 | c3b40e9b | #0 | 52×64 |
| Crates | 64×72 | 4902 | 15703e9d | #1 | 64×72 `--largest` |
| Flower bed | 128×64 | 5001 | 41679287 | #0 | 128×64 `--fill-width` |

Subject lines are kept in the session log. In short: a half-timbered two-storey smithy with a warm-glowing arched door; a two-step limestone plinth with a navy pedestal and a sword-bearing knight statue; a pink-blossom tree with 4–6 crown clusters; a striped-awning produce stall; a floating cyan crystal on a rune pedestal (the only glow in the set besides the lamp glass); an anvil on a stump; a wrought-iron lantern post; a honey-wood barrel; two stacked crates; a limestone planter.

Regenerations:
- **Forge**: the first result was isometric (corner view). The retry added "FRONT-FACING … NOT isometric … roof ridge horizontal … left-right symmetric".
- **Crates** (seed 4901, f2fb3af6): drawn at a corner angle. The retry (seed 4902) asked for "only the front and top faces, NO side faces, every edge horizontal or vertical". All its candidates had a stray speck, which `--largest` removes.

## Ground: `create_topdown_tileset`

Settings: `mode: pro`, 64 px tiles, `view: high top-down`, `transition_size 0.25`, `spread_x 0.5`, `raggedness 0.3–0.4`, lineless, medium shading, medium detail. Base tiles are chained so all three sets share terrains: grass `efcd8989`, dirt `b891b48b`, cobble `3dd140f7`.

| Pair (lower → upper) | Tileset | Status |
|---|---|---|
| dirt → grass | 8cc5c515 | used |
| grass → cobble | 8f6e9384 | used (cobble reads as a slightly raised paved area with a curb) |
| dirt → cobble | 62700ae9 | used |
| cobble → grass | 104151f9 | **rejected**: tiles with three cobble corners were drawn as grass (blocky squares) |
| cobble → dirt | 279eaf86 | **rejected**: the "cobble" terrain came out as grass |
| dirt → grass | e1a08cfb | failed on the server (not charged); retried as 8cc5c515 |

Lesson: PixelLab pro tilesets keep the **upper** terrain reliably. Put the hard-surface terrain (cobble) as upper.

`tools/env-art/buildGroundAtlas.mjs <dir>`:
- grades greens toward the style lock (saturation ×0.58);
- slices tiles by `bounding_box`;
- packs 64 px frames with 2 px extruded borders;
- writes `town_ground_wang.png` and `src/data/environment/townGroundWang.ts`.

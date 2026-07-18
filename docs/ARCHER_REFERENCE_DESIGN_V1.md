# Archer Reference Design Specification v1

Status: **reference_design_pending_user_approval**. `canonicalApproved: false`.

This is a **pre-production visual specification** for the Archer reference design only. It defines
exactly what a future reference image must look like so ChatGPT (or any generator) can produce a
consistent candidate, and so the user has a single, precise target to approve or reject against.

This document does **not** produce, approve, or reference any image file. It does not define
animation, sprite sheets, or Runtime integration. See [Explicitly excluded](#explicitly-excluded).

## Source of truth (locked, not redefined here)

| Value | Source | Value |
|---|---|---|
| Asset id | `data/design/pilot-asset-production-pack-v2.json` | `hero.archer` |
| Gender | Class 1 Character Visual Lock v1 | female |
| Anchor | Asset & Animation Framework PR #23 | `[0.5, 0.92]` |
| Default FPS | Production Pack v2 | `12` |
| Accepted FPS range | Production Pack v2 | `8–15` |
| First motion test | Production Pack v2 | `attack` |

This spec **does not change** any of the above — it only adds visual design detail underneath
them. `data/design/archer-reference-design-v1.json` restates these values so the machine-checkable
contract lives next to the rest of the spec, and `tools/validate-archer-reference-design-v1.mjs`
fails if they ever drift from the values above.

## Mandatory art direction

- Stylized 3D fantasy, hand-painted texture (not photoreal, not flat cel/vector).
- Chibi proportion — large head, small body (matches the existing Class 1 chibi cast).
- Full body, 3/4 front view, combat-ready pose.
- Clean, instantly readable silhouette.
- Polished mobile game asset finish.
- Transparent background.
- No frame/border, text, numbers, icons, or background scenery baked into the canvas.

## Visual identity

Agile female woodland Archer — a practical, combat-ready ranger, not a decorative or ceremonial
figure. She must read instantly as a ranged attacker: bow and quiver legible before any other
detail, even at reduced Board/Shop/Bench scale. Personality: focused, alert, quietly confident.

## Silhouette

- Narrow shoulders, compact torso.
- The bow's curve breaks the outline clearly on one side.
- A short cape/hood breaks the outline behind the shoulders.
- The quiver breaks the outline at the upper back.
- **Readability rule:** the silhouette alone (no color, no face) must still say "Archer" at
  reduced mobile scale.
- Keep negative space between the bow arm and torso so the bow curve stays separable from the body
  at small size.

## Body proportion

- System: **chibi**, roughly 1:2 head-to-body ratio.
- Slim, agile build — not muscular, not heavyset.
- Size class: **medium** (matches `pilot-asset-production-pack-v2.json` → `hero.archer.sizeClass`).
- Narrow stance, feet close together — no wide combat straddle.

## Costume — shapes and layers

| Layer | Piece | Notes |
|---|---|---|
| Base | Fitted leather-and-cloth tunic + trousers | Short hem above the knee — legs stay visible; no long robe/skirt |
| Outer | Short olive-green hood/cape (shoulder-to-mid-back only) | Compact, never floor-length; must not cover the bow arm or quiver |
| Armor accent | Warm brown leather chest wrap, forearm bracers, simple belt | Practical ranger gear — must not read as Knight/Fighter plate weight |
| Accessory | Quiver strap across chest/back, small belt pouch | Strap/quiver silhouette stays visible even under the cape |

Footwear: simple laced leather boots, ankle-to-shin height.

## Primary / secondary / accent colors (HEX)

| Role | Color | HEX | Usage |
|---|---|---|---|
| Primary | Olive-green hood and cape | **`#5F9C3E`** | Hood, cape — largest single color area |
| Secondary | Warm brown leather armor | **`#8A5A34`** | Chest wrap, bracers, belt, boots |
| Accent | Muted warm gold trim | **`#D9A63E`** | Quiver strap buckle, cape clasp, bowstring wrap — used sparingly |
| Skin | Warm light tan | **`#E8B98A`** | Face, hands |
| Hair | Rich auburn-brown | **`#6B3E23`** | Hair |

**Rationale:** the primary olive-green is deliberately brighter/more saturated than the Map Theme
Runtime's muted Arena Ruins moss (`#55663F`), so the Archer separates from the floor instead of
blending into it. Primary and secondary both read clearly against the arena's cool-gray masonry
(`#5D6270`). No neon or oversaturated non-fantasy hues are used.

## Hair

- Style: practical mid-length braid or tied-back ponytail, kept clear of the face and clear of the
  bow-draw sightline.
- Color: `#6B3E23`.
- The hood sits back off the forehead/crown rather than fully enclosing the head, so hair (and the
  face) stay visible.

## Face readability (mobile)

- Feminine face shape, without becoming overly delicate or losing definition at small size.
- Expression: focused, alert gaze toward the front-facing direction.
- Eyes and eyebrow line must remain the clearest facial feature at reduced Board/Shop icon scale —
  avoid fine linework that disappears below roughly 64px render height.
- Hood sits back so it never shadows the eyes.

## Bow design and weapon silhouette

- **Bow:** recurve-style fantasy longbow, compact enough to be held beside the body without
  exceeding the character's own height.
- **Silhouette rule:** the bow's curve must break the body outline clearly and read as a bow — not
  a staff, not a crossbow — even reduced to Shop-card size.
- Visible taut bowstring; no arrow nocked in the reference (rest) pose.

## Quiver placement

Worn diagonally across the back (strap crossing the torso); quiver mouth visible above the
shoulder; arrow fletchings partially visible at rest.

## Reference pose

- Standing at rest, both feet clearly planted shoulder-width apart.
- Bow held loosely in the lowered/off-hand beside the body.
- Free hand relaxed near the quiver strap.
- This pose only establishes the visual foot line that matches the Runtime anchor `(0.5, 0.92)` —
  **no animation or motion is derived from this task.**

## Camera angle and framing

- 3/4 front view.
- Full body, centered, small margin — matches the neutral reference convention already used for
  the Class 1 cast, so the Archer sits naturally beside other pilots on the Board.

## Lighting direction

- Soft key light from front-upper-left, gentle fill from the front-right.
- Even, readable lighting for a small mobile sprite — no harsh rim light, no dramatic shadow that
  could obscure the bow or quiver silhouette. This is a neutral hand-painted reference sheet, not
  an in-scene lit render.

## Hand-painted material guidance

- Soft painterly shading and color blocking — not photorealistic PBR, not flat cel-shaded vector
  art.
- Cloth/leather: soft-edged painted shading, restrained visible brushwork texture.
- Metal accents (buckles, bracer rivets): a slightly brighter, warmer highlight than cloth, kept
  minimal.
- Must match the existing approved hand-painted Class 1 chibi rendering style — the Archer should
  not look like it came from a different pipeline than the other heroes.

## Mobile readability constraints

- Silhouette and bow/quiver readability must survive a reduced-size check equivalent to
  Board/Bench/Shop-card scale.
- Primary/secondary colors must stay distinguishable from each other and from the Arena Ruins
  masonry/moss palette at small size.
- Avoid fine linework, thin straps, or small pattern detail that turns to noise below small render
  sizes.
- Silhouette and pose must communicate "Archer" before color or facial detail is legible.

## Transparent-background export constraints

- Fully transparent background (alpha channel) — no baked color fill, no baked checkerboard.
- Canvas contains the character only: no frame, border, vignette, ground-shadow plane, text,
  numbers, watermark, UI icon, or environment/background scenery.
- Clean alpha edges, no premultiplied-alpha halo.
- Full body stays inside the canvas with a small safety margin — no cropped hands, bow tips, or
  cape edge.

## Forbidden visual traits (class-separation rules)

To avoid duplicating other classes — especially **Acolyte**, per the Class 1 Character Visual Lock
contract — the Archer reference **must not** use:

- A priest/acolyte silhouette or ceremonial holy-figure presentation.
- A staff or any long ceremonial focus item as the primary weapon.
- A shield of any kind.
- An oversized/large sword or heavy blade weapon.
- A long floor-length robe or cloak matching the Mage or Acolyte costume shape.
- A crossbow (the weapon must be a hand-drawn bow).
- Modern-day clothing or equipment.
- Neon or oversaturated non-fantasy colors.
- Generic elf-stereotype styling.
- Visual similarity to the Ninja, Ranger, or Sniper class silhouettes.
- An oversized cape that hides the legs or obscures the bow/quiver.

## Differentiation from Acolyte

Per the Class 1 Character Visual Lock contract, Acolyte is: female, staff or holy focus,
light/sacred visual language, combat-ready but ceremonial-adjacent. The Archer must differ by:

- Carrying **no staff or holy focus** — the bow is the defining silhouette element.
- Using **no sacred/ceremonial light-magic visual language** — she reads as a grounded woodland
  ranger.
- Wearing **no long holy-robe silhouette** — her costume is short-hemmed with visible legs.
- Using a **leather-and-cloth ranger material language**, not cloth-and-holy-trim vestments.

The bow must read out immediately when the image is scaled down, and the overall costume shape
must communicate an agile ranged fighter, distinct from every other Class 1 silhouette.

## Explicitly excluded

This task produces **only** the reference design specification. It explicitly does **not**
include:

- Animation frames of any kind (idle/move/attack/skill/hit/death).
- Sprite sheets.
- Motion test execution or motion test frames (the Archer — Attack motion test remains a future,
  separate step per the Production Pack v2 contract).
- Final artwork or any binary/image asset.
- Runtime integration (`src/game.js`, `autochess.html`, or the Asset & Animation Framework are not
  touched).
- Canonical approval or a canonical asset registry entry — `canonicalApproved` stays `false` and
  `status` stays `reference_design_pending_user_approval` until the user explicitly approves an
  exact generated reference image.

## Files

| File | Purpose |
|---|---|
| `data/design/archer-reference-design-v1.json` | Machine-checkable version of this specification. |
| `tools/validate-archer-reference-design-v1.mjs` | Validates the JSON against the contract above (identity, locked runtime values, required sections, HEX palette, forbidden traits, out-of-scope guard). |
| `docs/ARCHER_REFERENCE_DESIGN_V1.md` | This document. |

## Validation

```
$ node tools/validate-pilot-asset-production-pack-v2.mjs
Pilot asset production pack v2 validation passed.

$ node tools/validate-archer-reference-design-v1.mjs
Archer reference design v1 validation passed.
```

## Verdict

Archer Reference Design Specification v1 is complete and internally consistent with PR #23's
runtime anchor/FPS values and the Production Pack v2 contract. It is **not** an approved canonical
asset. Next step (out of scope for this task): generate a candidate reference image against this
specification and route it to the user for explicit approval before any animation or Runtime work
begins.

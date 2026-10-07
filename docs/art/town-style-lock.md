# Environment Art Style Lock — Town (v1)

Status: **Town static environment V1 implemented; awaiting user visual acceptance**. Production history is in `pixellab-town-production.md`, including the Codex completion pass.
Scope: Town (`demo_town`) first; every rule is written so Field and Dungeon can reuse it.
Baseline: HEAD `e88e36f` — typecheck clean, unit 478/478, browser 274/274, build OK.

This document defines the visual language and the art contracts. It does not
change gameplay, map data, collision, saves or texture keys.

---

## 0. Fixed technical contracts (do not change)

| Contract | Value | Where |
|---|---|---|
| Tile size | 32 world px | `src/config.ts` `TILE_SIZE` |
| Camera zoom | 1.35 | `src/config.ts` `CAMERA_ZOOM` |
| Character height | 40 world px ≈ 54 screen px (Warrior `worldHeight`) | `src/data/characterArt.ts` |
| Global filtering | `pixelArt: true`, `roundPixels: true` | `src/main.ts` |
| Tile indices | 0–16 (`Grass` … `PlazaTrim`) keep meaning and collision | `src/world/tiles.ts` |
| Collision | solid tiles + solid prop footprints (`mapCells`) | `src/world/mapRules.ts` |
| Prop kinds / footprints | unchanged; art bottom-centred on the footprint | `src/data/maps/props.ts`, `WorldScene.drawProps` |
| Texture keys | `tiles`, `prop-<kind>`, `npc-base`, `npc-robe`, monster blob keys, `loot-gem` | `src/graphics/*` |
| Depth model | see §4 | `WorldScene`, `WorldOverlays`, `Player` |

---

## 1. Visual direction

**Bright, clean cartoon fantasy town.** Soft, readable, inviting; moderate
detail; modern rather than retro-chunky. Warm sunlit stone, painted wood,
coloured roofs, tidy greenery, a few glowing magical accents.

Character anchor: the Warrior production sprite
(`public/assets/characters/warrior/warrior_chibi_front_master_v3.png`, 192 px
frame, ~125 px tall body drawn at 40 world px, **linear filtering**). Its
look: crisp dark outline, 2–3 soft shading bands, saturated accents
(red hair, crimson cape, steel armour). The environment must sit *behind* that
look: same cleanliness and outline logic, but calmer saturation and lower
contrast so silhouettes always win.

Readability hierarchy (most → least contrast):
1. Characters, monsters, NPCs, loot, quest markers
2. Interactive landmarks (service buildings, fountain, gates, stations)
3. Large props (trees, stalls, lamps)
4. Small clutter and decals
5. Ground

---

## 2. Working resolution and pixel rules

**Decision: author environment art at 2× world resolution and render it
smoothed, like the characters.**

- 1 art px = 0.5 world px (= 0.675 screen px at zoom 1.35).
- A 32×32 world tile is authored as **64×64 art px**.
- Textures are displayed at scale 0.5 with **LINEAR** filtering (per-texture
  `setFilter(LINEAR)`, exactly how `applyCharacterArtFilter` treats the
  Warrior). Native 1× pixel art under `pixelArt: true` would read far chunkier
  than the smoothed character and is rejected.
- **No mixed resolutions:** every environment asset is 2×. Never upscale 1×
  art, never mix 3× or 4× sources into one scene. (UI icons and VFX are
  separate tracks.)
- Edges: clean anti-aliased silhouettes allowed (it is downsampled smooth
  art, not 1-bit pixel art). No soft airbrush blur at the silhouette.
- Texture/noise: low. Large surfaces get 2–3 broad shapes (stone joints, wood
  planks, grass clumps), never per-pixel noise or photo texture. Ground
  detail density ≈ one notable mark per 32×32 world tile.
- Curves, roofs, foliage: simplify into big readable shapes — rounded leaf
  clusters (3–5 lobes), roofs as 2–3 planes with a clear ridge and eave line,
  stone as rounded rectangles. No individual leaves, no shingle-by-shingle
  rendering beyond a few suggestion strokes.
- Minimum feature size: 4 art px (2 world px). Anything smaller disappears at
  0.675 screen px per art px.

> Rendering contract (implemented; see §11): 2× textures with
> LINEAR filtering for props/buildings (simple: `image.setScale(0.5)`), and
> for ground tiles a visual-only ground layer (2× tileset, scale 0.5)
> separate from the existing 32 px collision tilemap (kept, made invisible).
> Collision, navigation and tests would not change.

---

## 3. Asset classes

| Class | Meaning | Rendering |
|---|---|---|
| **Tile** | One 32×32 cell of ground, repeated by map data | ground layer |
| **Modular tile set** | Variants + transition pieces of one terrain, chosen at render time from neighbours / hash (map data unchanged) | ground layer |
| **Decal / ground overlay** | Flat art painted on the ground, never blocks (mosaic, flowers, cracks, puddles) | depth −0.5 |
| **Standalone prop** | One object on a 1×1 footprint | y-sorted |
| **Multi-cell prop** | One object on a W×H footprint | y-sorted |
| **Building** | Large façade + roof over a `Roof`-tile footprint (collision already from tiles) | y-sorted, bottom-anchored |
| **Effect / animated decoration** | Small loops: water, flames, glow, banners in wind | on its owner's depth |

---

## 4. Layering / depth rules (compatible with the current model)

| Layer | Depth | Notes |
|---|---|---|
| Ground (visual tiles) | −1 | terrain + transitions; current `ground` layer depth |
| Contact shadows | −0.6 | `WorldOverlays.drawShadows` (characters, monsters) |
| Decals / ground props | −0.5 | `ground: true` props (mosaic, flowers, tufts) |
| Props & buildings | footprint bottom − 6 px | `drawProps`; a character whose feet touch the south edge draws in front |
| Characters / NPCs / monsters | `y` (body centre) | player `setDepth(y)`, NPC feet, monsters `y` |
| Wind-up telegraphs | caster `y − 1` | combat VFX |
| Map signs / NPC names / markers | 900 000 | labels; keep **few and small** |
| Combat VFX, bars, floating text | 900 000 – 950 000+ | unchanged |

Rules:
- **Everything that stands is y-sorted at its footprint's south edge.** A tall
  object (tree, lamp, building) occludes characters standing *north* of it
  and is occluded by characters *south* of it. No separate roof layer is
  needed for v1 because buildings sit on solid footprints along the map edge.
- **Foreground occlusion** (a roof or canopy covering a walkable tile south of
  its footprint) is **not allowed** in v1: overhang may extend sideways and
  north, at most 8 world px south of the footprint (eave lip).
- Baked shadows: props carry their own soft ground shadow inside the texture,
  drawn **south-east** of the base (see §7); characters keep the runtime
  contact shadow.
- Signage: one name plate per service/landmark; nav-target dots only where a
  quest/Auto Move needs them. Labels never cover a character's head
  (≥ 6 world px above the tallest nearby prop or offset sideways).

---

## 5. Collision rules (visual size ≠ collision)

- Collision is **only** solid tiles + solid prop footprints. Art never adds
  collision.
- The footprint is the object's *base contact area*: trunk, pedestal, posts,
  basin rim, wall base. Canopies, roofs, awnings, banners, flames, glow and
  overhang are visual only.
- A prop's art is bottom-centred on its footprint; it may extend:
  - **up** freely (trees ≤ 3 tiles, buildings ≤ 2 tiles above the footprint
    for roofs/towers),
  - **sideways** ≤ 0.5 tile beyond the footprint each side (canopies, awnings),
  - **down** ≤ 8 world px (base shadow / eave lip only).
- Buildings: the `Roof` tiles (index 6) stay the collision footprint. The
  building art covers that footprint completely; the visual front wall sits on
  the footprint's last row(s). Doors are decorative; interaction happens at the
  NPC/station point in front.
- Non-solid kinds (banner, gate_arch, decals) never become solid because their
  art is large.
- Any new solid placement must keep `tests/unit/maps.test.ts` green (every
  navigation target reachable from each spawn and portal arrival).

---

## 6. Palette direction

Values are directions, not locks; validate in context with the Warrior.

| Group | Direction |
|---|---|
| **Overall** | Warm daylight. Environment saturation ≈ 15–25 % below character accents; ground in the mid-value band (no near-white, no near-black ground). |
| **Grass / foliage** | Fresh yellow-green mids (H≈95–110°, S≈35–50 %, V≈55–70 %); shadows shift toward blue-green, highlights toward yellow. Deep green only in dense canopy cores. |
| **Dirt / road** | Warm sandy ochre, low saturation; slightly lighter than grass so routes read. |
| **Town stone (cobble)** | Warm grey-beige, low saturation (S≈8–15 %), joints a touch darker and cooler. |
| **Plaza** | Lighter cream/limestone than cobble (+10–15 % value) so the plaza reads as a special zone; trim ring in a darker warm grey; mosaic inlays in muted terracotta + gold. |
| **Walls** | Sandstone/limestone blocks, warm; dark mortar sparingly. |
| **Roofs** | One family per building role: terracotta red (civic, Forge), slate blue (Enchant), mossy teal-green (Workshop/Craft), warm wood shingles (Pet Stable, stalls); Hall of Legends deep navy + gold trim. Roof saturation is the most saturated *environment* colour but stays below the characters. |
| **Wood** | Warm mid browns; planks show 2 tones max. |
| **Metal** | Desaturated steel blue-grey; gold/brass only for civic and magical trims. |
| **Magic** | Cyan (Enchant), violet (portals/Dungeon), soft gold (monument, quest). Only magical objects may glow. |
| **Water** | Clear turquoise-blue, light ripples; not neon. |
| **Accents** | Flower beds and banners carry the small saturated pops (red, yellow, pink, violet) in small areas. |
| **Shadows** | Cool, slightly violet/blue multiply (not black), 25–35 % opacity for cast shadows. |
| **Warm / cool balance** | Lit planes warm, shadows cool; overall slightly warm. |

---

## 7. Lighting and shading

- **Primary light:** top-left (north-west), high sun.
- **Cast shadows:** fall south-east (down-right), short and soft-edged,
  baked into each prop's texture under its base; consistent length ≈ 0.25–0.5
  of object height, flattened to an ellipse/parallelogram on the ground.
- **Shading bands:** 3 tones per material (shadow / mid / light) + at most one
  small highlight. No gradients across large areas except magical glow and
  water.
- **Contrast:** environment moderate (value range ≈ 25–80 %); characters keep
  full range.
- **Outlines:** environment uses a *coloured dark outline* (darkened local
  hue, not pure black), 2 art px (= 1 world px) on outer silhouettes of props
  and buildings, 1 art px or none on interior details and ground. Ground tiles
  and decals have **no outline**. Characters keep their near-black outline —
  this difference is the main readability tool.
- **Ambient occlusion:** a thin soft dark band where objects meet the ground
  and in roof undersides/door recesses; no global AO.
- **Character readability rules:**
  1. no environment surface uses the characters' near-black outline value;
  2. ground never exceeds characters' saturation;
  3. avoid large red/crimson ground areas near walkable space (Warrior cape);
  4. runtime contact shadows under characters stay on;
  5. clutter density near routes stays low.

---

## 8. Town asset manifest

Dimensions are **world px (art px = ×2)**. "Extends" = art may extend beyond
the collision footprint. "Variants" = needed for v1. Reuse: F = Field,
D = Dungeon.

### 8.1 Ground (tiles / modular sets)

| Asset | Class | Maps to | World size | Collision | Variants | Reuse |
|---|---|---|---|---|---|---|
| Grass ground | modular tile set | tile 0 `Grass` (+1 `Flowers`) | 32×32 per cell | none | 4 base + 1 flowered | F (core) |
| Town cobble | modular tile set | tile 5 `Cobble` | 32×32 | none | 4 | F ruins, D (tinted) |
| Dirt road / path | modular tile set | tile 2 `Path` | 32×32 | none | 3 | F (core) |
| Plaza limestone | modular tile set | tile 15 `Plaza` | 32×32 (2×2 flagstone pattern in 64×64) | none | 3 | — |
| Plaza trim ring | modular tile set | tile 16 `PlazaTrim` | 32×32 | none | 2 + corners | — |
| Terrain transitions | modular tile set (render-time, from neighbours) | edges between 0/2/5/15/16 | 16×16 corner pieces (dual-grid) or 32×32 edge set | none | 1 set per pair: grass↔cobble, grass↔path, cobble↔path, cobble↔plaza(trim) | F: grass↔path, grass↔dirt |
| Town wall | modular tile set | tile 3 `Wall` | 32×32 (+ top cap) | **solid (tile)** | straight, corner, end, gate-side | F (field border uses trees over it), D (dungeon wall separate) |
| Water | tile | tile 4 `Water` | 32×32 | **solid (tile)** | 2 + animated ripple | F pond |
| Portal / gate floor | tile + effect | tile 7 `Portal` | 32×32 | none | 1 + glow loop | F, D |
| Building base | tile (hidden under building art) | tile 6 `Roof` | 32×32 | **solid (tile)** | 1 neutral fill | — |

### 8.2 Decals / ground overlays

| Asset | Maps to | World size | Collision | Variants | Reuse |
|---|---|---|---|---|---|
| Compass mosaic | `prop-plaza_mosaic` (ground, 5×3) | 160×96 | none | 1 | — |
| Flower patch | `prop-flowers` (ground) | 32×32 | none | 3 | F |
| Grass tuft | `prop-grass_tuft` (ground) | 32×32 | none | 3 | F |
| Pebbles / cracks / puddle | new ground decals (additive kinds later) | 32×32 | none | 2–3 | F, D |

### 8.3 Landmarks and buildings

| Asset | Class | Maps to | Footprint (collision) | Art size (world) | Extends | Variants | Reuse |
|---|---|---|---|---|---|---|---|
| Crown Fountain | multi-cell prop + water effect | `prop-fountain` | 4×2 (128×64) | 128×112 | up 48 (statue, spray) | 1 | — |
| Hall of Legends monument | multi-cell landmark | `prop-monument` | 4×2 (128×64) | 128×160 | up 96 (statue), sides 0 | 1 | — |
| Hall of Legends façade | building | `Roof` 13×3 at (16,1) | 416×96 | 416×160 | up 64 | 1 | — |
| Job Hall | building | `Roof` 8×5 at (3,2) | 256×160 | 256×208 | up 48 | 1 | building kit |
| Forge (Enhancement) | building | `Roof` 8×5 at (34,2) | 256×160 | 256×208 | up 48 (+ chimney) | 1 | building kit |
| Enchant Tower | building | `Roof` 7×5 at (3,24) | 224×160 | 224×240 | up 80 (tower) | 1 | building kit |
| Workshop (Craft) | building | `Roof` 8×5 at (34,24) | 256×160 | 256×208 | up 48 | 1 | building kit |
| Pet Stable | building | `Roof` 9×4 at (18,26) | 288×128 | 288×176 | up 48 | 1 | building kit |
| East Town Gate | multi-cell prop (non-solid arch over portal) | `prop-gate_arch` (2×1, non-solid) + wall tiles | 0 (portal walkable) | 64×112 | up 80 | 1 | F/D gates (re-skin) |
| North Dungeon Gate | multi-cell prop (non-solid) | *additive kind later* (portal tiles at (30,0)) | 0 | 64×96 | up 64 | 1 | D entrance |
| Statue | standalone tall prop | `prop-statue` | 1×1 | 32×76 | up 44 | 1 (+ mirrored) | D (re-tint) |

**Building kit (modular):** walls (stone base + plaster/timber upper, 32 world
px modules), corner posts, doors (2 sizes), windows (2), roof planes per colour
family (ridge, eave, gable end), chimney, awning, sign bracket. Façades are
composed from the kit and exported as **one baked texture per building**
(stable key per building), so runtime stays one sprite per building.

### 8.4 Service landmarks (in front of their buildings)

| Asset | Maps to | Footprint | Art size | Extends | Variants | Notes |
|---|---|---|---|---|---|---|
| Enhancement anvil + forge glow | `prop-anvil` | 1×1 | 34×30 | glow up 8 | 1 | warm ember glow (effect) |
| Enchant crystal | `prop-enchant_crystal` | 1×1 | 34×64 | up 32 | 1 + idle glow loop | the only cyan glow in Town |
| Craft workbench | `prop-workbench` | 2×1 | 64×40 | up 8 | 1 | tools readable at size |
| Pet house | `prop-pet_house` | 2×1 | 64×56 | up 24 | 1 | pairs with Pet Stable |
| Notice board | `prop-notice_board` | 2×1 | 64×60 | up 28 | 1 | quest flavour |

### 8.5 Market and urban props

| Asset | Maps to | Footprint | Art size | Extends | Variants | Reuse |
|---|---|---|---|---|---|---|
| Market stall | `prop-market_stall` | 3×2 | 100×90 | up 26, sides 2 | 3 awning colours/goods | F camp trader (1) |
| Bench | `prop-bench` | 2×1 | 64×32 | — | 1 (+ mirrored) | F |
| Lamp post | `prop-lamp_post` | 1×1 | 24×72 | up 40 | 1 + lit glow (night later) | F roads, D (iron torch post) |
| Banner (wall) | `prop-banner` (non-solid) | 1×1 | 22×52 | hangs on wall | 2 colours | D `crypt_banner` style |
| Signpost | `prop-signpost` (non-solid) | 1×1 | 30×44 | up 12 | 1 | F (core) |
| Fence | *additive kind later* (non-solid edge or solid 1×1 segment) | 1×1 | 32×32 | up 16 | straight, corner, gate | F (core) |
| Barrel | `prop-barrel` | 1×1 | 26×32 | — | 2 | F, D |
| Crates | `prop-crates` | 1×1 | 32×36 | up 4 | 2 | F, D |
| Flower bed | `prop-flower_bed` | 2×1 | 64×32 | — | 2 colour mixes | — |

### 8.6 Vegetation

| Asset | Maps to | Footprint | Art size | Extends | Variants | Reuse |
|---|---|---|---|---|---|---|
| Cherry tree (Town accent) | `prop-cherry_tree` | 1×1 (trunk) | 72×88 | up 56, sides 20 | 2 | — |
| Town / meadow tree | `prop-tree` | 1×1 | 60×80 | up 48, sides 14 | 3 | F (core) |
| Bush | `prop-bush` | 1×1 | 40×32 | sides 4 | 2 | F |
| Hedge / planter (optional) | *additive later* | 1×1 / 2×1 | 32×32 / 64×32 | — | 1 | — |

### 8.7 Effects / animated decoration

| Effect | Owner | Frames (suggested) | Notes |
|---|---|---|---|
| Fountain water + spray | fountain | 4–6 | loop, subtle |
| Torch / brazier / monument flames | monument, Field camp, Dungeon | 4 | reuse everywhere |
| Enchant crystal glow | enchant_crystal | 6 (pulse) | additive glow sprite |
| Portal shimmer | Portal tiles / gates | 6 | reuse F/D |
| Banner sway | banner | 4 | optional |

---

## 9. Dimensions and modular groups (summary)

Recommended art sizes (art px, 2×) relative to the 32-world-px grid:

| Footprint | Typical object | Art px (W×H) |
|---|---|---|
| tile | ground cell | 64×64 |
| 1×1 small | barrel, crate, anvil, bush | 64×64 (content ~48–64) |
| 1×1 tall | lamp, statue, crystal, banner | 64×128 – 64×160 |
| 1×1 tree | tree, cherry tree | 128×160 – 160×192 |
| 2×1 | bench, workbench, flower bed, pet house, notice board | 128×64 – 128×128 |
| 3×2 | market stall | 192×192 |
| 4×2 | fountain, monument | 256×224 – 256×320 |
| building 7–9 × 4–5 | service buildings | (W×64) × (H×64 + 96…160) |
| façade 13×3 | Hall of Legends | 832×320 |

Canvas rule: the texture's bottom edge = the footprint's south edge (plus up
to 16 art px for the baked shadow/eave); horizontally centred on the
footprint. Transparent padding is fine but keep it tight (≤ 8 art px).

Modular groups (produce as reusable parts):
1. **Terrain kit** — grass, dirt, cobble, plaza, trim, water + transition
   pieces + variants (Town and Field).
2. **Building kit** — walls, roofs (4 colour families), doors, windows,
   chimney, awning, sign brackets (baked per building).
3. **Street furniture kit** — lamp, bench, sign, fence, banner (Town / Field).
4. **Storage kit** — barrel, crate, sack (all maps).
5. **Foliage kit** — tree crowns (3), cherry crown (2), bush, flower bed fills,
   tufts (Town / Field).
6. **FX kit** — flame, glow, water ripple, portal shimmer (all maps).

Unique one-offs (justified): Crown Fountain, Hall of Legends (monument +
façade), Enchant crystal, compass mosaic.

---

## 10. Style validation set (produce first)

| # | Asset | Covers |
|---|---|---|
| 1 | **Cobble + grass + dirt road** tiles with grass↔cobble and cobble↔road transitions (2 variants each) | ground/path combination, terrain kit, repetition |
| 2 | **Hall of Legends** monument (`prop-monument`, 4×2) | major landmark, gold/magic accents |
| 3 | **Forge** service building (8×5 over `Roof` tiles) with the anvil | normal service building, building kit, roof family |
| 4 | **Cherry tree** (`prop-cherry_tree`) | large vegetation, canopy overhang vs 1×1 collision |
| 5 | **Flower bed** (`prop-flower_bed`) | small vegetation, accent colours |
| 6 | **Lamp post** (`prop-lamp_post`) | functional prop, tall thin silhouette |
| 7 | **Barrel + crates** (`prop-barrel`, `prop-crates`) | small clutter, storage kit |
| 8 | **Market stall** (`prop-market_stall`) | market/urban prop, awning overhang |
| 9 | **Enchant crystal** (`prop-enchant_crystal`) | magical object, the only cyan glow |

Acceptance (all must hold in a real in-game screenshot at zoom 1.35, next to
the Warrior and an NPC):
- the Warrior silhouette is the clearest element in every screenshot;
- no visible tile grid in the ground at 1.35 (variants + transitions work);
- props read at a glance; collision footprints feel right (walk around them);
- art at 2× looks smooth, not blurry and not chunky; no mixed resolution;
- palette/shadows consistent across all 9 assets;
- `npm run typecheck`, unit and browser tests unchanged and green.

---

## 11. Implementation contract (implemented)

Needed to put 2× art into the game without breaking contracts:
1. **Props/buildings:** load PNGs under the existing keys (`prop-<kind>`), set
   LINEAR filter, draw with `setScale(0.5)` in `drawProps`. Footprints,
   depth and collision unchanged.
2. **Ground:** keep the current 32 px tilemap layer as the *collision* layer
   (set invisible); add a *visual* ground layer from a 2× tileset scaled 0.5
   whose tile choice (variant/transition) is computed at render time from the
   map's tile indices. Map data and tile indices 0–16 unchanged.
3. **Buildings:** additive texture keys (e.g. `building-forge`) placed over
   the `Roof` footprints by data (a small additive "building visuals" list per
   map), not new collision.
4. **Code-drawn placeholders stay as the fallback** when a PNG is missing
   (same pattern as `?art=placeholder` for characters).

---

## 12. Reusable environment-art generation brief

> **Environment art brief — "Haven" fantasy MMORPG (top-down 3/4 view)**
>
> Bright, clean cartoon-fantasy environment art for a 2D MMORPG seen from a
> high 3/4 top-down camera. Soft, inviting, readable; moderate detail; modern
> and polished, not retro-chunky. Each object is a single isolated asset on a
> transparent background, drawn at **2× game scale: one 32-unit game tile =
> 64×64 px**. Objects stand upright, viewed from slightly above, with their
> base on a flat ground plane; the bottom edge of the image is the object's
> ground contact.
>
> Lighting from the top-left; a short, soft, cool-tinted cast shadow falls to
> the bottom-right under the base. Three-tone cel shading per material plus
> one small highlight; no photo texture, no heavy noise, no airbrush blur.
> Outer silhouettes have a clean 2-pixel outline in a darkened version of the
> local colour (never pure black); interior lines lighter or none. Shapes are
> simplified and chunky: rounded leaf clusters, roofs as 2–3 clear planes with
> a defined ridge and eave, stones as soft rounded blocks.
>
> Palette: warm daylight; fresh yellow-green foliage; warm beige-grey cobble
> and cream limestone; warm wood; desaturated steel; roofs by role
> (terracotta, slate blue, teal-green, wood shingle; civic navy with gold
> trim). Saturation stays moderate so player characters (saturated, with
> near-black outlines) always stand out. Only magical objects glow (cyan for
> enchanting, soft gold for monuments, violet for portals).
>
> Deliver: the asset at the specified pixel size, centred horizontally, base
> at the bottom, transparent background, no text, no logos, no UI, no
> characters unless requested. Keep every asset in a set at exactly the same
> scale, outline weight, light direction and palette.
>
> Per asset add: name, footprint in tiles, target size in px, material/colour
> family, and any glow/animation frames.

(Original art only: describe the look in these terms; never name or imitate a
specific existing game's assets.)

# Map 1 Visual Lock Contract v1

## Purpose

Lock the visual direction for Map 1 — Arena Ruins before mass-producing heroes, monsters, bosses, animation sheets, and VFX. This contract preserves the current board, camera, bench, HUD, combat, and Asset & Animation Framework behavior while making the arena theme replaceable for later maps.

## Runtime source

This contract is aligned to Asset & Animation Framework Runtime PR #23 at `5a3a8eec7991a98aad6f3acf0ce38687764dcb1a`.

The following are fixed and must not be redesigned by this contract:

- board dimensions and logical cells;
- orthographic camera and framing;
- bench layout;
- HUD and shop ownership;
- pointer, drag/drop, movement, occupancy, targeting, combat timing, and game loop;
- pilot anchors: Archer `(0.5, 0.92)`, Slime `(0.5, 0.90)`, Golem `(0.5, 0.94)`;
- shared transient VFX cap of 24.

## Visual identity

Arena Ruins is an ancient tactical amphitheatre built from weathered stone. It should feel polished, readable, and atmospheric rather than dark or noisy. Warm-neutral highlights and cool muted shadows provide silhouette separation. Moss, rubble, banners, and dust may support the theme, but the board and units remain the visual priority.

## Swappable theme layers

The arena must be authored as six replaceable layers:

1. Board surface
2. Arena border
3. Background
4. Props
5. Ambient VFX
6. Lighting profile

Map 2 and Map 3 should reuse the same board geometry, camera, bench, HUD, animation runtime, and VFX runtime. They should change only theme assets, atmosphere, map-specific monsters, and bosses.

## Board surface

- Weathered stone slabs with restrained cracks and material variation.
- Grid cells remain easy to distinguish at mobile size.
- Avoid high-frequency noise, bright emissive markings, and large stains directly beneath units.
- No decorative object may occupy or visually imply a different logical cell.
- Selection, hover, placement, targeting, and range feedback remain more visible than the floor texture.

## Arena border and background

- Broken masonry, low ruins, damaged arches, and distant amphitheatre structures.
- Border height must not hide front or side cells.
- Background detail must become calmer near the board silhouette.
- Distant structures may create depth but cannot compete with units, HUD, projectiles, or impacts.

## Props and exclusion zones

Allowed examples:

- broken columns;
- small torn banners;
- rubble clusters;
- cracked braziers;
- restrained vegetation.

Props must remain outside:

- the playable grid;
- the bench;
- Hero and Equipment shops;
- Gold, Wave, and Start Battle controls;
- Augment choices;
- Fullscreen and Screenshot controls;
- development/debug controls;
- pointer and drag/drop interaction paths.

## Lighting

- Warm-neutral key light.
- Cool muted fill.
- Soft golden rim where helpful.
- Soft readable shadows without crushing detail.

Pilot checks:

- Archer's olive-green silhouette must separate from the arena floor and background.
- Slime must not disappear into moss, dust, or similarly colored ground effects.
- Golem must remain distinct from arena masonry despite sharing a stone material language.

## Ambient effects

Allowed ambient effects are intentionally subtle:

- slow dust motes;
- restrained drifting ash;
- rare soft light shafts.

Ambient effects must not block pointer events, obscure the grid, or cover unit silhouettes. Under load, decorative ambient particles are removed before trails, impacts, character animation, or unit visibility.

## Mobile performance policy

- Android Chrome is the primary target.
- No per-frame image loading or material creation.
- Reuse textures and geometry where practical.
- Keep decorative animation bounded.
- Preserve units, grid readability, and attack impacts before ambient polish.
- Ambient effects must share the existing VFX budget rather than creating an unbounded second pool.

## Orientation and fullscreen acceptance

The visual lock must pass all of the following:

- Portrait responsive layout keeps the tactical board readable.
- Landscape keeps the board and units proportional.
- Fullscreen does not stretch the board or characters.
- HUD and utility controls remain accessible.
- No prop or border obscures a playable cell.
- Archer, Slime, and Golem remain readable at actual reduced size.
- Bright VFX remain visible without washing out the floor.
- Dark units remain visible without forcing excessive global brightness.

## Production sequence

1. Create one Map 1 arena reference image.
2. Review it against current camera framing and HUD safe zones.
3. Integrate a technical candidate without calling it canonical.
4. Test Archer, Slime, and Golem at actual board size.
5. Adjust floor contrast, border height, lighting, anchors, and effect readability.
6. Explicitly approve the exact arena files.
7. Lock the Map 1 theme profile.
8. Produce the remaining Demo 1 assets against the locked arena.

## Future maps

Map 2 — Lava Hell and Map 3 — Heaven Temple are deferred. Their implementation should reuse the arena framework and replace only:

- board material and palette;
- border skin;
- background;
- props;
- ambient VFX;
- lighting profile;
- map-specific monster additions;
- miniboss and boss art.

A new map must not require a board, camera, HUD, combat, or animation-system rewrite.

## Out of scope

- final arena artwork;
- runtime implementation;
- Map 2 or Map 3 production;
- combat or balance changes;
- board/camera/bench redesign;
- final hero, monster, boss, equipment, card, or marketing art;
- sound and music production.

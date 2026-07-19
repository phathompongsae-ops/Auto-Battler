# Canonical Asset Production Order

## Purpose

Prevent the project from skipping ahead into final shop cards or full character production before the core visual pipeline is proven.

## Locked order of work

1. Finalize layout ownership boundaries
   - Coco: DOM/CSS/presentation only
   - CC: Three.js camera, board, bench, pointer alignment, runtime
2. Audit existing assets and classify them
3. Produce exactly three canonical pilot assets
   - one Class 1 hero
   - one normal monster
   - one stage-5 boss
4. Validate those three assets in the intended presentation pipeline
5. Lock the character production standard
6. Produce the remaining seven Class 1 heroes
7. Produce Class 2 heroes by class line
8. Produce Secret Classes
9. Build final shop cards from approved canonical character assets
10. Expand animation and VFX only after the static visual standard is stable

## Pilot asset selection

Locked pilot trio:

- Hero: Archer
  - female
  - readable bow silhouette
  - tests ranged character composition
- Normal monster: Slime
  - simple silhouette
  - tests scale and readability at small size
- Stage-5 boss: Golem
  - current Stage 5 miniboss identity
  - existing candidate path: `assets/mon_golem.png`
  - large silhouette tests boss scale, frame budget, and visual hierarchy

Warden is a legacy/unused asset and is not part of the current locked production boss plan. It must not be generated, mapped, spawned, or substituted for Golem by this asset intake work.

## Gates

A phase cannot advance until the prior phase passes review.

### Gate A — pilot asset review

Each pilot asset must pass:

- approved silhouette
- correct gender and equipment
- 3/4 front presentation reference
- transparent background where required
- consistent lighting and material style
- readable when reduced to target game size
- canonical filename and logical ID

### Gate B — runtime readiness review

Before integration:

- asset path validated
- dimensions validated
- alpha validated
- duplicate ID check passed
- fallback behavior defined
- no direct runtime integration in the intake PR

### Gate C — final card readiness

A shop card may become final only when:

- its character asset is canonical-approved
- the card uses the canonical character without redesigning face, hair, costume, weapon, gender, or silhouette
- tier glow and class accent are applied as presentation layers
- name and price remain separate UI data where practical

## Explicitly deferred

Do not do these yet:

- final card set for all 21 classes
- animation sheets for all heroes
- unique VFX for all heroes
- runtime integration of PR #4, #5, or #6
- bulk generation of all Class 2 and Secret assets

## Conflict safety

This document does not authorize changes to:

- `autochess.html`
- `src/game.js`
- Three.js scene or camera
- board or bench geometry
- drag-and-drop or pointer logic
- combat, targeting, economy, or game loop

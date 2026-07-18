# Generation Batch 1 — Pilot Canonical Assets

## Purpose

Generate the first three canonical visual assets needed to prove the project's art pipeline before expanding production.

## Locked style

All three assets must follow the approved project direction:

- stylized 3D fantasy game character
- hand-painted texture feel
- soft cinematic lighting
- polished mobile game asset quality
- clean, readable silhouette at small size
- 3/4 front view
- centered composition
- transparent background
- no frame, text, icon, number, floor shadow, or UI decoration
- full subject visible with comfortable padding

## Batch order

1. Archer — Class 1 hero
2. Slime — normal monster
3. Golem — Stage 5 miniboss pilot

## Archer requirements

- female
- chibi proportions: larger head, smaller body
- combat-ready stance
- bow clearly readable
- green-and-brown fantasy archer identity
- distinct silhouette suitable for shop, bench, and board presentation
- must not reuse the shop-card mockup face or costume as canonical truth unless separately approved

## Slime requirements

- cute but combat-ready fantasy monster
- simple silhouette readable at very small size
- translucent or glossy magical body treatment
- no overly realistic rendering
- must fit the same stylized 3D hand-painted universe as the heroes

## Golem requirements

- large Stage 5 miniboss silhouette
- visibly heavier and more imposing than a normal monster
- stone-and-rune fantasy construction
- readable arms, torso, head, and stance
- glowing rune accents permitted, but silhouette must remain clear
- must fit the same stylized 3D hand-painted universe

## Approval gate

Each generated asset remains `concept-approved` at most until the user explicitly approves it as canonical.

Before runtime integration, Coco must record:

- exact filename
- dimensions
- alpha status
- logical ID
- visual approval status
- intended runtime role

## Safety boundary

This batch does not authorize edits to:

- `src/game.js`
- `autochess.html`
- Three.js scene or camera
- board or bench geometry
- combat, targeting, movement, economy, or game loop

Coco may only prepare naming, registry, validation, and import documentation until a separate runtime task is approved.
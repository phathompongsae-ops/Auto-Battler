# Canonical Character-to-Card Pipeline

## Goal
Ensure every shop card depicts the same character that appears in the game and in the approved asset library.

## Source of truth
The canonical character asset is the source of truth for:
- gender
- face and hair
- costume and materials
- primary colors
- weapon
- silhouette
- class identity
- chibi proportion and 3/4 presentation

The shop card template is only a presentation layer.

## Pipeline
1. Confirm exact class ID and approved canonical character asset.
2. Validate gender and class-line rules.
3. Place or regenerate the character using the canonical reference, preserving design identity.
4. Apply the correct tier frame:
   - Class 1: blue glow
   - Class 2: violet-blue glow
   - Secret: gold glow
5. Apply the class-line accent only to small supporting elements.
6. Add class icon, display name, and price as separate UI layers where possible.
7. Produce a contact sheet at shop-size preview.
8. Require visual approval before marking the asset `approved` in the manifest.
9. Integrate through a separate runtime PR.

## Rejection conditions
Reject a card if any of the following occurs:
- character face or hair no longer matches the canonical asset
- weapon type changes
- costume or silhouette changes substantially
- wrong gender
- wrong class-line accent
- tier glow is ambiguous
- character becomes unreadable at mobile shop size
- important weapon or face is cropped
- text is baked incorrectly or misspelled

## File strategy
Recommended separation:
- `character-art.png`: canonical transparent character art
- `card-frame-tier1.png`
- `card-frame-tier2.png`
- `card-frame-secret.png`
- class icon assets
- dynamic HTML/CSS text for name and price

Prefer compositing the card from reusable layers instead of generating every card as one permanent flattened image. Flattened mockups are allowed for visual approval only.

## Ownership boundary
Coco may prepare asset paths, manifests, DOM/CSS card presentation, validation, and contact sheets.
CC owns any change that requires gameplay state, shop logic, price calculation, or runtime integration beyond presentation wiring.

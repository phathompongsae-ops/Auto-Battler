# Shop Card Visual System v1

## Purpose
Lock the approved visual language for hero cards shown in the shop without changing runtime behavior.

## Core rule
The card presentation follows the tier; the character image follows the canonical character asset.

- Character appearance must come from the approved hero asset for that exact class.
- Do not redesign the hero only to fit the card.
- Card effects may add glow, rim light, crop, shadow, and framing, but must not change costume, weapon, hair, gender, silhouette, or class identity.

## Tier color system

### Class 1 / Tier 1
- Dominant glow: electric blue
- Base: deep navy
- Frame: restrained gold
- Intended feeling: readable, standard, polished

### Class 2 / Tier 2
- Dominant glow: violet-blue
- Base: deep indigo/navy
- Frame: brighter gold than Tier 1
- Intended feeling: evolved, rarer, more advanced

### Secret Class
- Dominant glow: gold
- Base: black-gold / very dark warm neutral
- Frame: strongest gold treatment
- Intended feeling: exceptional reward and immediate rarity recognition

## Class-line accent colors
Use only as secondary accents on icon, inner rim, class marker, particles, or a small glow behind the character.

- Fighter line: red-orange
- Swordman line: steel blue
- Archer line: emerald green
- Mage line: violet
- Summoner line: teal
- Acolyte line: white-gold
- Merchant line: amber

Tier color must remain visually dominant over class-line accent.

## Card anatomy
1. Top-left class icon
2. Main character portrait area
3. Tier glow around the inner frame
4. Bottom name plaque
5. Small class-line accent marker
6. Price badge
7. Optional rarity particles, limited by tier

## Mobile constraints
- Target aspect ratio: 3:4
- Master export: 1024x1365 or larger, preserving 3:4 crop
- Keep face, weapon silhouette, and name readable when card width is reduced to 120-160 CSS px
- No paragraph text on cards
- Do not bake dynamic shop-state labels into the artwork

## Approved examples
- Tier 1: blue glow + emerald Archer accent
- Tier 2: violet-blue glow + emerald Sniper accent
- Secret: gold glow + restrained class accent

## Non-goals
- No 21 unrelated full-card background colors
- No unique frame system per class
- No runtime integration in this documentation PR
- No replacing canonical character assets with card-only variants

# Free Asset Intake V1

## Objective

Identify external assets that are legally safe for commercial use and visually compatible with the Auto-Battler art direction before any runtime integration.

## Locked rules

- Accept only assets with a clearly stated license permitting commercial use.
- Prefer CC0.
- Do not import character or monster packs that conflict with the approved stylized 3D / hand-painted / 3/4-view direction.
- External assets are support assets only unless the project lead explicitly approves them as canonical.
- Every imported pack must retain source URL, author, license, version/date, and intended use.
- No runtime integration in this branch.

## Approved candidates for visual review

### 1. Kenney Fantasy UI Borders

- Source: https://www.kenney.nl/assets/fantasy-ui-borders
- Author: Kenney
- License: CC0 1.0 Universal
- Contents: 130+ fantasy/RPG panel and button border sprites, including nine-slice-ready elements.
- Proposed use: panel frames, drawer borders, Shop/Bag framing, modal framing.
- Status: APPROVED FOR LOCAL DOWNLOAD AND CONTACT SHEET REVIEW.
- Canonical status: NOT YET APPROVED.

Reason: This is the closest free UI package found to the current dark-fantasy panel direction without forcing a pixel-art look.

### 2. Drummyfish Fantasy RPG Icons

- Source: https://opengameart.org/content/fantasy-rpg-icons-0
- Author: drummyfish
- License: CC0
- Resolution: 128x128
- Style: hand-painted, stylized, non-pixel-art
- Proposed use: temporary weapon, item, Shop, currency, aura, spell, bag, book, shield, and equipment icons.
- Status: APPROVED FOR LOCAL DOWNLOAD AND CONTACT SHEET REVIEW.
- Canonical status: NOT YET APPROVED.

Reason: The pack explicitly targets a hand-painted fantasy RPG look and is visually closer to the project direction than generic flat or pixel icons.

### 3. Drummyfish Fantasy RPG Icons 2 and 3

- Sources:
  - https://opengameart.org/content/fantasy-rpg-icons-2
  - https://opengameart.org/content/fantasy-rpg-icons-3
- Author: drummyfish
- License: CC0
- Resolution: 128x128
- Proposed use: fill missing currency, mana, heal, dagger, bow, armor, poison, lightning, charge, and class-related icon slots.
- Status: APPROVED FOR LOCAL DOWNLOAD AND CONTACT SHEET REVIEW.
- Canonical status: NOT YET APPROVED.

### 4. Seamless Magic / Forcefield Effect

- Source: https://opengameart.org/content/seamless-looping-magicforcefield-effect-0
- Author: zookeeper
- License: CC0
- Contents: 33 PNG frames at 512x512.
- Proposed use: prototype shield, aura, spawn portal, boss barrier, or augment-selection background.
- Status: APPROVED FOR EXPERIMENTAL REVIEW ONLY.
- Canonical status: NOT YET APPROVED.

Reason: The source is tagged as stylized hand-painted and can support the Effect Framework. The red/blue palette must be tested against the project's color direction before use.

## Rejected for canonical use

### Pixel character and monster packs

Examples reviewed:
- Kenney Roguelike Characters
- Mini Fantasy Sprites
- Fantasy RPG Sprite Kit 32x32
- Starsteel spell sprites

Decision: REJECT for canonical hero/monster presentation.

Reason:
- pixel-art scale
- side-view or orthogonal presentation
- silhouette and rendering style conflict with the approved 3/4 hand-painted character direction

These may only be used in isolated tooling prototypes if never shipped and never confused with canonical assets.

## Download gate

A pack can enter `assets/external/` only after:

1. Archive successfully downloads.
2. Archive contents are scanned and inventoried.
3. License is saved beside the files.
4. A contact sheet is generated.
5. The project lead approves the visuals.
6. Files are renamed through the canonical naming rules.
7. No runtime path is changed in the same PR.

## Current transfer limitation

The connected GitHub and browsing tools can verify sources and licenses, but the current session could not transfer the external binary ZIP archives directly into the repository. No archive has been falsely marked as downloaded.

The approved candidates are now locked so the next environment with binary-download access can fetch them without repeating the research.
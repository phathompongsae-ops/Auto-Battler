# UI Panel Placement Decisions — Demo 1

Status: Draft layout decision record
Scope: Documentation only; no runtime changes
Target: Mobile landscape first (800×360 and 844×390)

## Canonical screen ownership

### Left side
- Team Link / Synergy panel only
- Must remain compact and readable
- Must not host the full Team-in-Field roster

### Center
- 3D board is the primary focus
- Keep the central combat area visually unobstructed
- Bottom-center may show short-lived contextual guidance only

### Right side
- Enemy Wave panel at the top
- Boss details remain part of the enemy information hierarchy
- Shop trigger and primary action remain in the lower-right control zone

### Bench
- Bench remains represented by the existing in-world board row
- Do not duplicate the whole bench as a large DOM panel

## Team-in-Field decision

The current large Team-in-Field panel under the Enemy Wave panel is not part of the desired final layout.

Decision:
- Do not move the full roster panel to the left because it would conflict with Team Link / Synergy.
- Do not keep a persistent large roster panel in the lower-right because it competes with Shop and Start Battle controls.
- Replace it in a later implementation pass with one of these compact forms:
  1. a small team-count summary plus expand/collapse button, or
  2. a narrow horizontal portrait strip that never overlaps the primary action area.

Preferred option for Demo 1:
- Compact team-count summary with an optional drawer.
- The board itself remains the source of truth for which heroes are deployed.

## Priority order

1. Preserve board visibility
2. Preserve Start Battle button visibility
3. Preserve Shop access
4. Preserve Enemy Wave readability
5. Preserve Team Link readability
6. Show deployed-team details only on demand

## Forbidden overlaps

At 800×360 and 844×390:
- Enemy Wave panel must not overlap Start Battle
- Team-in-Field summary must not overlap Shop
- Team Link panel must not overlap Bag
- Any expanded drawer must not cover both the board center and primary action controls at the same time

## Ownership split

Coco may later implement:
- DOM hierarchy changes
- CSS positioning and sizing
- compact summary/drawer presentation
- responsive visibility rules

CC ownership remains:
- Three.js board framing
- camera changes
- bench geometry or runtime representation
- gameplay state and deployment logic

## Acceptance checkpoint

Before implementation, confirm the exact canonical reference screenshot and choose the compact Team-in-Field form. Until then, this document locks only screen ownership and overlap rules.
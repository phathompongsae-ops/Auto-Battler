# Demo 1 UI Component Inventory

Status: documentation only. No runtime changes.

## Purpose

This inventory defines the current player-facing UI components, their ownership, priority, and intended layout zone before production layout edits begin.

## Global zoning

- Top center: primary run status
- Top right: speed and pause
- Left side: Team Link / synergy information
- Right upper: current-wave enemy information
- Right lower: Shop access and Start Battle action
- Center: 3D board and units; must remain visually dominant
- Bottom center: transient guidance only; persistent panels must not cover the bench row

## Component inventory

| Component | Current role | Target zone | Priority | Owner |
|---|---|---|---|---|
| Back/Menu button | Return to menu | Top left | Medium | Coco DOM/CSS |
| Player HP | Run survivability | Top center-left | Critical | Coco DOM/CSS |
| Wave counter | Stage progress | Top center | Critical | Coco DOM/CSS |
| Gold | Economy status | Top center | Critical | Coco DOM/CSS |
| Level/EXP | Capacity progression | Top center-right | High | Coco DOM/CSS |
| Buy EXP | Economy action | Attached to level | High | Coco DOM/CSS |
| Speed control | Combat speed | Top right | High | Coco DOM/CSS; runtime behavior unchanged |
| Pause | Combat control | Top right | Critical | Coco DOM/CSS; runtime behavior unchanged |
| Team Link panel | Select and review three linked heroes | Left side | High | Coco DOM/CSS |
| Enemy wave panel | Enemy types, count, HP and boss info | Right upper | High | Coco DOM/CSS |
| Field-team panel | Secondary roster summary | Remove as persistent large panel; replace with compact count or drawer entry | Medium | Coco DOM/CSS |
| Shop toggle | Open shop drawer | Right lower | Critical | Coco DOM/CSS |
| Start Battle | Begin combat | Right lower, primary action | Critical | Coco DOM/CSS |
| Item Bag toggle | Open item inventory | Lower left | High | Coco DOM/CSS |
| Guidance banner | Temporary deployment feedback | Bottom center | Medium | Coco DOM/CSS |
| Bench row | Reserve heroes in the 3D board | Bottom board row | Critical | CC runtime/Three.js ownership |
| Placement highlight | Valid/invalid drag destination | 3D board | Critical | CC runtime/Three.js ownership |
| Shop drawer | Hero purchase interface | Overlay drawer | Critical | Coco presentation; CC runtime behavior protected |
| Bag drawer | Item interface | Overlay drawer | High | Coco presentation; runtime behavior protected |
| Evolution/choice modal | Progression decision | Modal center | High | Shared; runtime logic protected |

## Required removals or reductions

1. The persistent large `ทีมในสนาม` panel must not remain stacked below the enemy panel.
2. Persistent guidance must not cover the bench row.
3. The right-lower action zone must not contain more than two primary controls at once.
4. Side panels must not expand toward the board beyond their assigned width budget.

## Field-team replacement

Recommended hierarchy:

- Default: compact `ทีม 1/1` count near the Team Link header or as a small icon button.
- Optional detail: tap to open a lightweight roster drawer.
- Do not duplicate information that is already visible from units on the board.

## Runtime safety boundary

This inventory does not authorize changes to combat, camera, board geometry, unit placement, drag-and-drop, economy, stage flow, render loop, or Three.js scene behavior.

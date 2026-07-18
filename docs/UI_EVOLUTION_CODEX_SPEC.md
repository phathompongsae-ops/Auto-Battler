# Evolution Modal and Game Codex UI Specification

## Status

Implementation-ready UI specification. Layout and visual styling must follow the UI reference images previously supplied by the project owner. This document adds behavior and content rules only; it does not authorize redesigning the existing HUD, board, shop, or bench layout.

## Reference-first rule

- Existing reference images are the visual source of truth.
- Preserve the established board, bench, shop, HUD, spacing rhythm, panel language, corner treatment, and visual hierarchy.
- New UI must look like an extension of the reference, not a new theme.
- Do not relocate major existing controls to make room for these features.
- Where the reference does not define a detail, use the smallest compatible solution.

## Evolution choice modal

### Trigger

Open after a valid Class 1 fusion has completed its input check but before the evolved unit is created or the fusion inputs are permanently consumed.

### State behavior

- Pause combat, timers, movement, shop refresh timers, and other time-sensitive gameplay.
- Apply one modal lock so other overlays cannot open above it.
- No close button and no outside-click dismissal.
- No decision timer in PvE.
- Confirming a branch records the decision before visual replacement.

### Placement

- Centered over the gameplay viewport.
- Use a dimmed background overlay while keeping the current board composition visible.
- Respect safe areas on mobile and tablet.
- Maximum width should remain readable in landscape without covering the entire screen.

### Structure

1. Header
   - localized title such as `เลือกสายอาชีพ`
   - source Class 1 portrait and name
   - short instruction line

2. Two branch cards
   - equal visual weight
   - arranged side by side in normal landscape width
   - stack vertically only when the available width cannot maintain readable content

3. Each branch card
   - Class 2 portrait or approved silhouette
   - localized class name
   - two primary role icons; optional third secondary icon
   - damage profile
   - attack range category
   - one-sentence playstyle summary
   - concise signature skill summary
   - up to two strengths
   - one weakness
   - explicit select button

4. Confirmation state
   - selected card receives a clear focus state
   - confirmation should require only one deliberate action unless playtesting shows accidental taps
   - do not add a second full confirmation dialog by default

### Information priority

The player must understand the difference between both branches within a few seconds. Prioritize:

1. role icons
2. playstyle summary
3. signature skill
4. strength and weakness
5. damage and range labels

Avoid dense stat tables in this modal. Full statistics belong in the Codex and hero detail view.

## Circular Game Guide entry

- Persistent circular button in the preparation/shop interface.
- Use the existing UI reference to choose a compatible unused edge position.
- Must not overlap the board, bench, shop cards, economy display, stage information, or combat controls.
- Minimum mobile touch target: 44 CSS pixels.
- Use a book, branching-path, or information symbol that remains readable at small size.
- Show a text tooltip or label on hover/focus and on first guided introduction.

## Game Codex shell

### Opening behavior

- Opens as a large overlay panel using the same panel style as the reference UI.
- Pause gameplay while open.
- Preserve the current run state exactly.
- Close button is allowed because opening the Codex is voluntary.
- Remember the last visited tab during the current session.

### Tabs

1. Class Evolution
2. Hero Index
3. Monster Index
4. Synergy Guide
5. Weapon Guide

Tabs may use text plus small icons. Text must remain present; icons alone are not sufficient.

## Class Evolution tab

### Default view

Show seven Class 1 lines in a readable table/tree:

- Fighter -> Knight / Berserker
- Swordman -> Blade Master / Duelist
- Archer -> Sniper / Ranger
- Mage -> Archmage / Frost Weaver
- Summoner -> Beast Lord / Spirit Blade
- Acolyte -> Priest / Inquisitor
- Merchant -> Tycoon / Trickster

### Interaction

- Selecting a Class 1 line expands or focuses its two branches.
- Selecting any hero opens a detail panel without leaving the Codex.
- Secret classes remain hidden or silhouetted according to unlock/discovery rules.
- The tree must be data-driven from `data/design/class-evolution-v1.json`.

## Hero detail panel

Show:

- portrait
- name and class tier
- role icons with labels/tooltips
- playstyle summary
- damage profile and attack range
- skill description
- strengths and weakness
- suitable weapon tags when available
- evolution parent or branches

Do not expose internal IDs to players.

## Role icon presentation

- Use the same semantic icon for the same meaning everywhere.
- Icons require localized labels and tooltips.
- Do not encode meaning by color alone.
- Maintain strong silhouette differences for color-blind readability.
- Final artwork should be generated or drawn only after semantic IDs are locked.

## Responsive behavior

### Landscape tablet/desktop

- Branch cards side by side.
- Codex uses left navigation or top tabs according to the existing reference style.
- Detail panel may appear alongside the list/tree.

### Narrow/mobile width

- Branch cards may stack vertically.
- Keep both class names and primary role icons visible before scrolling.
- Codex detail opens as an internal full panel with a back control.
- Avoid horizontal scrolling for core information.

## Accessibility and input

- Keyboard/controller focus order must follow visual order.
- Every icon has accessible text.
- Buttons have clear normal, focused, pressed, selected, and disabled states.
- Text must remain readable at the project's minimum supported resolution.
- Touch actions should not depend on hover.

## Data dependencies

Required fields:

- class name localization key
- portrait/silhouette asset ID
- role icon IDs
- damage profile
- range category
- playstyle localization key
- signature skill name and description
- strengths and weakness localization keys
- evolution option IDs

## Ownership boundary

Data/UI/DOM implementation may prepare the modal and Codex components without altering combat logic. CC owns runtime integration involving fusion timing, pause state, unit replacement, save/load order, combat timers, and event queues.

## Acceptance criteria

- UI visually follows the previously supplied reference images.
- All seven Class 1 lines display two correct Class 2 options.
- The evolution modal cannot be dismissed without a valid choice.
- Both choices remain directly comparable.
- Role icons are consistent across modal, Codex, shop, and hero details.
- The Codex can open and close without mutating the run.
- No existing major UI element is moved without explicit owner approval.

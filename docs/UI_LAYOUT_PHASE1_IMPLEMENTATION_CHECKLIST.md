# UI Layout Phase 1 Implementation Checklist

## Goal

Prepare a small, reviewable CSS/DOM-only patch that moves the current game toward the approved blue-and-gold fantasy UI target while avoiding runtime conflicts.

## Allowed files

- `autochess.html`
- UI-only stylesheet files, if extracted from `autochess.html`
- UI documentation

## Forbidden files

- `src/game.js`
- Three.js scene files
- Combat/runtime modules
- Asset manager runtime integration

## Phase 1 tasks

### 1. Add shared CSS tokens

- [ ] spacing scale
- [ ] radius scale
- [ ] panel background variables
- [ ] gold border variables
- [ ] blue accent variables
- [ ] mobile safe-area variables
- [ ] z-index tiers

### 2. Compress top HUD

- [ ] single-row layout at 844x390
- [ ] no clipping at 800x360
- [ ] minimum 44px touch targets
- [ ] preserve existing IDs and click handlers

### 3. Lock side columns

- [ ] Team Link anchored left
- [ ] Enemy Wave anchored upper-right
- [ ] Shop below Enemy Wave
- [ ] panel widths use clamp()
- [ ] no board overlap

### 4. Fix lower-right congestion

- [ ] remove permanent large Team-in-Field stack from lower-right
- [ ] replace with compact count/badge or drawer trigger
- [ ] keep Start Battle fully visible
- [ ] keep Shop accessible

### 5. Bottom strip

- [ ] Bag anchored bottom-left
- [ ] status strip centered
- [ ] Start Battle anchored bottom-right
- [ ] status strip does not cover deploy row

### 6. Asset placeholders

Until final PNGs are imported:

- [ ] use CSS-only gold/navy/blue treatment
- [ ] reserve classes for future image-frame skins
- [ ] do not hard-code temporary external URLs
- [ ] do not merge generated images directly into runtime paths without approval

## Regression checks

- [ ] Menu opens
- [ ] Pause works
- [ ] Speed button works
- [ ] Shop opens/closes
- [ ] Bag opens/closes
- [ ] Start Battle works
- [ ] Drag/drop remains functional
- [ ] No pointer-event layer blocks the board
- [ ] No new console errors

## Gameplay verification

After implementation, test the related gameplay flow at Speed x4:

- place a hero
- move a hero back to bench
- open/close shop
- begin combat
- verify HUD updates through one combat wave

## Stop condition

Stop and request review after Phase 1 layout behavior is stable. Do not continue into decorative PNG skinning, camera changes, or runtime refactors in the same patch.

# UI Layout Handoff Checklist for CC

Status: planning only. This document defines the handoff boundary after Coco completes the DOM/CSS layout work.

## Coco completes before handoff

- [ ] Canonical reference screenshot is identified.
- [ ] Top HUD layout is locked at 800×360, 844×390, and 915×412.
- [ ] Team Link remains the only persistent large left-side panel.
- [ ] Enemy Wave remains the only persistent large right-side information panel.
- [ ] Persistent `ทีมในสนาม` panel is removed or collapsed into a compact count/drawer entry.
- [ ] Shop and Start Battle do not overlap each other or the bench.
- [ ] Item Bag is reachable with a 44×44px minimum touch target.
- [ ] Thai text does not clip or overflow.
- [ ] No runtime JavaScript behavior is changed.

## CC-owned follow-up

CC should only be asked to handle items that require Three.js or runtime integration:

1. Verify camera framing after final side-panel widths are applied.
2. Verify the complete 8-column board and bench row remain usable.
3. Adjust board/camera containment only if CSS layout cannot preserve the required clear area.
4. Verify unit drag rays and placement highlights still align after viewport/layout changes.
5. Verify drawers and overlays do not interfere with canvas pointer behavior.

## Required pre-work report from CC

Before editing:

- `git status --short`
- current branch and HEAD
- files expected to change
- confirmation that Coco UI branch/PR is not being edited directly
- smallest proposed runtime change

## Protected areas

CC must not redesign the visual skin, rewrite DOM structure without necessity, rebalance gameplay, or migrate unrelated data while performing the layout integration pass.

## Required validation

Use the smallest targeted test set:

### Layout

- 800×360
- 844×390
- 915×412
- portrait orientation overlay if merged

### Interaction

- Shop open/close
- Bag open/close
- Start Battle
- Pause/resume
- Bench→Board drag
- Board→Board drag
- Board→Bench drag
- release outside board

### Combat

- 3–5 targeted waves at speed ×4
- confirm no NaN, soft lock, duplicate units, or duplicate damage
- confirm current-wave panel updates correctly

## Completion report

CC must state:

- model used
- modules/files changed
- root cause if camera or pointer alignment required correction
- test viewports
- ×4 combat waves tested
- known remaining visual differences from the reference

## Merge boundary

Do not merge a UI runtime pass until:

- Coco documentation/layout decisions are approved,
- active CC work is complete,
- the branch is rebased on current `main`, and
- the protected interaction tests pass.

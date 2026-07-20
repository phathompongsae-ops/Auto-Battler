# Visual Direction v2 — Chibi Fantasy Monster Scale and Presentation (Reference Record)

**Status: VISUAL_DIRECTION_REFERENCE_RECORDED — documentation only**

This document records a project-level visual direction stated by the user. It changes **nothing**
in the Runtime, Combat, gameplay, balance, board, camera, lighting, shadows, UI, motion, or any
asset. It is a design-direction reference only. It does **not** automatically authorize redesign
of any existing approved asset — future production should **gradually converge** toward this
direction through the normal per-package review/approval gates.

## Reference usage policy (copyright requirement)

The user provided a style reference image for this direction. That image is a **STYLE REFERENCE
ONLY**: it is not a production asset, not a source image, is not stored in this repository, must
not be imported into the game, must not be copied, and must not be recreated 1:1.

It informs only:

- mood
- presentation quality
- proportion goals
- board readability
- overall art direction

**Never copy** from it (or any other game): exact design, exact proportions, costume, armor, UI,
layout, composition, textures, artwork, poses, rendering, or icons. **All production assets must
remain original.**

## Future Monster Visual Direction

Future monsters should move toward:

- stylized **chibi fantasy**
- polished **mobile RPG quality**
- strong **silhouette readability**
- clear **anatomy at board scale**
- warm fantasy presentation
- readable facial expression
- readable weapon silhouette
- readable proportions

### Visual language for normal monsters

- warm fantasy palette
- high readability
- premium mobile-game rendering quality
- clean lighting
- clear material separation
- appealing chibi proportions

— all without copying another game's design.

## Skeleton Target

The Skeleton specifically remains:

- an **ordinary normal monster**
- not elite
- not a boss
- not an armored knight
- at the **same visual quality target as the Class 1 heroes**

(This direction feeds the Skeleton Neutral Master production line — see
`data/design/skeleton-neutral-master-exact-package-approval-v1.json`, currently
`PENDING_PACKAGE_DELIVERY`. This document does not change that record's gates or status.)

## Board-scale target

The user prefers monsters to have approximately the **same on-board visual presence as Class 1
heroes**. This is a statement about **visual presence only** — it does NOT mean:

- identical physical size
- identical collision
- identical gameplay scale
- identical hitbox
- identical balance

**Gameplay independence is maintained**: nothing in this direction changes any gameplay,
collision, scale, hitbox, or balance value, now or implicitly in the future.

## Quality target

Match the polished, premium presentation bar already set by the approved Class 1 hero art
(Neutral Masters + motion sets) — monsters should not read as a lower-quality tier next to
heroes on the same board.

## Readability target

At actual board scale under the approved warm dark-stone board direction (PR #89): silhouette,
anatomy, facial expression, and weapon must all remain readable, with clear separation from both
the board surface and neighboring hero units.

## Original-art requirement

Every future monster production asset must be original work. Reference material (this direction,
the user's style reference, or any inspiration) may guide mood/quality/proportions/readability
only — never design, artwork, or any of the prohibited elements listed above.

## Future review notes

- Each future monster package still goes through the full established pipeline: independent
  package verification → user Human Visual Review → Exact Package Approval → separate motion and
  Runtime-Integration authorizations. This document pre-approves none of it.
- Existing approved assets (Class 1 heroes, current procedural monster placeholders) are NOT
  invalidated or scheduled for redesign by this record.
- When a future monster candidate is reviewed, reviewers should check it against this direction
  (chibi fantasy, board-scale presence, readability, warm palette, original art) in addition to
  the standard technical contract.

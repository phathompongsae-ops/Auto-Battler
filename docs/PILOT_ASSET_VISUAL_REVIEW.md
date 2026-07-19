# Pilot Asset Visual Review

## Scope

Visual and technical review of the three pilot asset slots only. No runtime, stage data, combat, camera, board, bench, drag-and-drop, or Shop implementation was changed.

## Review outcome

| Pilot slot | Candidate | Technical result | Visual result | Decision |
|---|---|---|---|---|
| Class 1 hero | `assets/archer.png` | Valid 144×192 RGBA PNG with transparency | Minimal blocky procedural figure; does not match the approved stylized 3D, hand-painted, female Archer direction | Keep only as temporary placeholder; create new canonical Archer |
| Normal monster | older V5 Slime reference | Exact canonical file identity and commercial-use provenance are not locked | Cannot approve without exact source file and provenance | Treat canonical Slime as missing; create an original-project replacement |
| Stage 5 boss | `assets/mon_golem.png` | Valid 144×192 RGBA PNG with transparency | Minimal blocky procedural golem; readable as a placeholder but lacks boss-level silhouette, material detail, and visual hierarchy | Keep only as temporary placeholder; create new canonical Golem |

## Warden handling

- Keep `assets/miniboss_warden.png` in the repository.
- Status: `reserved-future-use`.
- It is not assigned to Map 1.
- It may be reused for another map or mode after an explicit future design decision.
- Do not delete it and do not automatically substitute it for the Stage 5 Golem.

## Production recommendation

The next art-production batch should contain exactly:

1. Canonical Archer — female Class 1 hero.
2. Canonical Slime — normal monster.
3. Canonical Golem — Stage 5 boss-scale asset.

Generate and approve these as individual canonical source assets before creating final Shop cards or expanding to the remaining roster.

## Runtime safety

The existing Archer and Golem PNG files may remain as temporary placeholders so current runtime references are not broken. Replacing or remapping them must happen later in a dedicated integration task owned with CC review.

This review does not authorize edits to:

- `src/game.js`
- `autochess.html`
- Three.js scene or camera
- board or bench placement
- stage composition
- combat, targeting, economy, or game loop

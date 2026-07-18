# Pilot Asset Status Audit

## Scope

This audit checks repository evidence for the three approved pilot roles without changing runtime behavior:

- Class 1 hero: Archer
- Normal monster: Slime
- Stage 5 miniboss: Golem

Warden is retained only as a reserved future-use asset.

## Findings

| Pilot | Repository evidence | Current classification | Blocking issue before canonical approval |
|---|---|---|---|
| Archer | `assets/archer.png` is documented as present | Candidate present | Must be visually checked against the locked female Archer design, target silhouette, export size, and alpha requirements |
| Slime | A candidate is documented only in the older `assets/v5/mon_*.png` pipeline | Candidate present, provenance pending | Exact file must be identified and its commercial-use provenance verified; otherwise produce an original-project replacement |
| Golem | `assets/mon_golem.png` is documented as present | Candidate present | Must be checked for final visual quality, dimensions, alpha, intended boss scale, and consistency with the approved art direction |
| Warden | `assets/miniboss_warden.png` exists | Reserved future use | No current Map 1 or Stage 5 assignment; keep the file but do not spawn, remap, regenerate, or delete it |

## Decision

None of the three pilot candidates is `canonical-approved` yet. File presence alone is not approval.

The next safe production step is a visual and technical review of the three exact candidate files. The review must record:

1. exact filename
2. image dimensions
3. real alpha transparency status
4. visual match to the approved stylized 3D / hand-painted direction
5. readability at intended board scale
6. whether replacement art is required

## Ownership boundary

Coco may maintain the registry, validate filenames and metadata, and prepare review reports.

Coco must not modify:

- `src/game.js`
- `autochess.html`
- Three.js camera or scene
- board or bench geometry
- combat, targeting, movement, economy, or game loop
- runtime stage pools

CC remains the owner of any later runtime integration and x4 combat verification.

## Generation gate

Do not generate replacement art blindly.

Generate a new pilot asset only when the exact existing candidate has been visually inspected and classified as one of:

- unsuitable placeholder
- wrong art style
- invalid or missing alpha
- insufficient resolution
- uncertain commercial-use provenance

This prevents duplicate work and protects the canonical asset pipeline.

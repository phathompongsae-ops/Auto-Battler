# Pilot Asset Status Audit

## Scope

This audit records the current evidence and approval status for the first character and monster assets without changing runtime behavior:

- Class 1 hero: Fighter
- Class 1 hero: Archer
- Normal monster: Slime
- Stage 5 miniboss: Golem

Warden is retained only as a reserved future-use asset.

## Findings

| Asset | Repository evidence | Current classification | Blocking issue before canonical approval |
|---|---|---|---|
| Fighter | User approved the exact unarmed metal-gauntlet direction in chat; no approved replacement PNG is imported in the repository | Concept approved | Import the exact approved image, verify real alpha/dimensions, assign a canonical filename, and check reduced-size readability |
| Archer | `assets/archer.png` exists as a 144×192 RGBA procedural placeholder; the user approved a different female woodland Archer direction | Concept approved | Import the approved replacement image and verify hood/cape, bow/quiver silhouette, dimensions, alpha, and board-scale readability |
| Slime | A new green chibi Slime candidate was generated; older V5 references remain uncertain and no exact replacement file is imported | Candidate present | Select and import one original-project PNG, then verify identity, provenance, alpha, dimensions, and small-scale readability |
| Golem | `assets/mon_golem.png` exists as a 144×192 RGBA procedural placeholder; a stronger rock-and-blue-crystal Golem candidate was generated | Candidate present | Import the intended replacement and verify final boss quality, alpha, dimensions, silhouette, and intended Stage 5 scale |
| Warden | `assets/miniboss_warden.png` exists | Reserved future use | No current Map 1 or Stage 5 assignment; keep the file but do not spawn, remap, regenerate, or delete it |

## Approved character decisions

### Fighter

The Fighter direction is locked:

- male
- broad athletic face and stronger jaw
- warm red-brown palette
- oversized reinforced metal gauntlets
- forward boxing or martial-combat stance
- no sword
- no shield

The former sword-and-shield Fighter concept is not canonical for Fighter.

### Archer

The Archer direction is locked:

- female
- olive-green woodland hood/cape direction
- bow and quiver clearly readable
- serious combat-ready expression
- 3/4 full-body pose

The existing root placeholder is not the approved final Archer artwork.

### Male face diversity

All future male characters must differ deliberately in facial structure, not only hairstyle or color. Each male class must vary at least four of: face width, jaw, chin, eye size/angle, eyebrows, nose, mouth, apparent age, and temperament.

## Decision

Fighter and Archer are `concept-approved`, not yet `canonical-approved`, because the approved exact image files have not been imported and technically verified in the repository.

Slime and Golem remain `candidate-present`. Warden remains `reserved-future-use`.

No asset is `card-ready` or `runtime-linked` from this review. File presence, visual direction approval, and final canonical approval are separate gates.

## Next safe production step

For each approved/candidate replacement, record:

1. exact canonical filename
2. source/import provenance
3. image dimensions
4. real alpha transparency status
5. visual match to the locked stylized 3D / hand-painted direction
6. readability at intended Shop, Bench, and Board scale
7. final user approval of the exact imported file

Do not produce the complete final Shop Card set before these source assets pass the gate.

## Ownership boundary

Coco may maintain the registry, filenames, metadata, review reports, and import checklists.

Coco must not modify:

- `src/game.js`
- `autochess.html`
- Three.js camera or scene
- board or bench geometry
- combat, targeting, movement, economy, or game loop
- runtime stage pools

CC remains the owner of any later runtime integration and x4 gameplay/combat verification.

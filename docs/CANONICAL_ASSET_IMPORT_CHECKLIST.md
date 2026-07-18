# Canonical Asset Import Checklist

## Purpose

Use this checklist when importing an approved character, monster, or boss PNG into the repository. Passing this checklist is required before changing an asset from `concept-approved` or `candidate-present` to `canonical-approved`.

This document does not authorize runtime integration. Runtime loading, board presentation, shop use, combat use, and animation hookup remain separate CC-owned work.

## Planned canonical paths

| Logical asset | Planned canonical path | Current status |
|---|---|---|
| Fighter | `assets/canonical/heroes/fighter.png` | Concept approved; exact PNG import pending |
| Archer | `assets/canonical/heroes/archer.png` | Concept approved; exact PNG import pending |
| Slime | `assets/canonical/monsters/slime.png` | Candidate present; exact file/provenance verification pending |
| Golem | `assets/canonical/bosses/golem.png` | Candidate present; current root asset is only a placeholder |
| Warden | `assets/reserved/bosses/warden.png` | Reserved future use; do not assign to Map 1 |

Do not overwrite current runtime paths during the import-review phase.

## Required checks

### 1. File identity

- [ ] The exact image has been explicitly approved by the user.
- [ ] The source/provenance is recorded.
- [ ] Commercial-use rights are clear when the file is not original project art.
- [ ] The filename and logical ID match the registry entry.
- [ ] No duplicate canonical file already exists for the same role.

### 2. Technical PNG checks

- [ ] File is PNG.
- [ ] Full body or full creature silhouette is inside the canvas.
- [ ] Real alpha transparency is verified from pixel data, not inferred from a checkerboard image.
- [ ] No baked white, black, grey, or checkerboard background remains.
- [ ] Dimensions are recorded in the registry.
- [ ] Image is large enough for the intended pipeline; preferred source export is 1024×1024 unless a later approved specification replaces it.
- [ ] No accidental cropping, compression damage, or edge halo is present.

### 3. Shared visual-direction checks

- [ ] Stylized 3D fantasy / hand-painted material direction is preserved.
- [ ] 3/4 front view is readable.
- [ ] Silhouette remains clear at small Shop, Bench, and Board sizes.
- [ ] Lighting and contrast are consistent with the approved roster direction.
- [ ] No frame, text, price, number, icon, or card background is baked into the source character art.
- [ ] Pose is combat-ready and not visually ambiguous.

### 4. Character-specific checks

#### Fighter

- [ ] Uses reinforced fists or metal gauntlets.
- [ ] Has no sword.
- [ ] Has no shield.
- [ ] Broad athletic face and strong jaw remain distinct from other male classes.
- [ ] Fist/forearm silhouette is readable when reduced.

#### Archer

- [ ] Female character identity is preserved.
- [ ] Bow and quiver are clearly visible.
- [ ] Olive-green woodland hood/cape direction is preserved unless the user approves a replacement direction.
- [ ] Weapon and limbs remain inside the canvas.

#### Other male classes

- [ ] Face width differs meaningfully from already approved male characters.
- [ ] Jaw and chin shape are not reused.
- [ ] Eye angle/size and eyebrow shape differ.
- [ ] Apparent age, expression, or temperament differs.
- [ ] The result is not the same face with only new hair or clothing.

### 5. Monster and boss checks

- [ ] Creature silhouette is readable without relying only on color.
- [ ] Boss scale and visual weight are stronger than normal monsters.
- [ ] Golem reads as a Stage 5 boss candidate, not a small generic monster.
- [ ] Slime remains readable and distinctive at board scale.
- [ ] Warden remains marked `reserved-future-use` and is not mapped to Stage 5 or Map 1.

### 6. Reduced-size review

Review the exact asset at the intended small presentation sizes or representative mockups.

- [ ] Head/face remains readable.
- [ ] Class-defining weapon or equipment remains recognizable.
- [ ] Silhouette does not merge into one dark mass.
- [ ] Asset is distinguishable from adjacent classes/monsters.
- [ ] Important details survive reduction without adding visual noise.

## Status promotion rules

### Promote to `canonical-approved` only when

- the exact PNG is in the repository at its approved canonical path;
- provenance, dimensions, and alpha are verified;
- the user approved the exact image, not only the general concept;
- the reduced-size review passes;
- the registry is updated with the real path and metadata.

### Promote to `card-ready` only when

- the canonical source has already passed all checks above;
- card composition is derived from the canonical source;
- no alternate character art is substituted in the card;
- card-specific crop and readability checks pass.

### Promote to `runtime-linked` only when

- CC completes runtime loading and presentation work;
- existing runtime paths are changed deliberately in a separate runtime-scoped task;
- gameplay-related verification is performed at Speed x4 when applicable.

## Current blockers by asset

| Asset | Blocker before `canonical-approved` |
|---|---|
| Fighter | Import the exact approved gauntlet Fighter PNG; verify alpha, dimensions, face differentiation, and reduced-size silhouette |
| Archer | Import the exact approved female Archer PNG; current `assets/archer.png` remains a procedural placeholder |
| Slime | Identify/import the exact original-project candidate and verify provenance, or create an original replacement |
| Golem | Import a dedicated canonical boss-quality image; current `assets/mon_golem.png` remains a procedural placeholder |
| Warden | No current production action; preserve for a future map/mode decision |

## Ownership boundary

Coco may maintain this checklist, registry metadata, canonical paths, provenance records, and review reports.

Coco must not modify:

- `src/game.js`
- `autochess.html`
- runtime asset loading
- Three.js scene/camera
- board or bench presentation
- combat, targeting, movement, shop, economy, or game loop

CC owns later runtime integration and any required Speed x4 gameplay verification.

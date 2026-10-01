# Class 1 Character Visual Lock V1

## Purpose

Lock the approved visual direction for the seven Class 1 characters before additional asset generation, card production, or runtime integration.

This document is presentation-only. It does not authorize changes to gameplay, combat, Three.js, camera, board, bench, drag-and-drop, economy, or the game loop.

## Shared style

All Class 1 characters must use the same approved visual language:

- stylized 3D fantasy game character
- chibi proportions with a large head and compact body
- 3/4 front view
- full body visible from head to feet
- readable silhouette at small in-game size
- polished hand-painted material treatment
- soft cinematic lighting
- combat-ready pose
- transparent PNG export
- no frame, text, number, icon, or baked card background

The character must remain readable when reduced for Shop, Bench, and Board presentation.

## Face diversity rule

Male characters must not share one repeated face with only hair or costume changes.

Each male Class 1 character requires deliberate differences in at least four of these areas:

- face width
- jaw shape
- chin length or roundness
- eye size and angle
- eyebrow shape
- nose width or length
- mouth shape
- apparent age
- expression and temperament

Hair color alone does not count as face differentiation.

## Locked Class 1 direction

### Fighter

- male
- unarmed melee fighter
- uses metal gauntlets / reinforced fists
- no sword
- no shield
- forward boxing or martial-combat stance
- broad athletic face, stronger jaw, confident expression
- warm red-brown combat palette
- silhouette must read through fists and forearm guards

### Swordman

- male
- single-sword specialist
- calmer and more disciplined than Fighter
- narrower face and sharper chin than Fighter
- controlled stance, clean sword silhouette
- must not resemble Knight-level heavy armor

### Archer

- female
- bow and quiver clearly visible
- agile woodland fantasy styling
- approved direction uses the latest refined chibi Archer reference
- feminine face without becoming overly delicate at small size
- silhouette must remain recognizable through bow, hood or cape shape, and quiver

### Mage

- male
- staff or focused magical implement
- slimmer face than Fighter and Swordman
- more serious or thoughtful eye shape
- robe silhouette must differ clearly from Summoner
- visible magical accent is allowed but must not obscure the body

### Summoner

- male
- mystical caster distinct from Mage
- different face structure and apparent temperament from Mage
- asymmetrical or layered costume silhouette
- summon-related charm, spirit blade, talisman, orb, or creature motif
- must not be only a recolored Mage

### Acolyte

- female
- staff or holy focus
- light / sacred visual language
- must remain combat-ready rather than purely ceremonial
- silhouette and costume must differ clearly from Archer

### Merchant

- male
- clever, adventurous trader personality
- face may be rounder, friendlier, older-looking, or more playful than other male classes
- merchant tools, coin, bag, ledger, or practical weapon motif
- must not use an unrelated heavy-warrior silhouette

## Canonical status rules

Generated images remain candidates until all of the following are true:

1. User explicitly approves the exact image.
2. Transparent background is verified rather than assumed.
3. The export file is assigned a canonical filename.
4. The logical ID is recorded in the canonical asset registry.
5. The image passes reduced-size readability review.

Approval of a visual direction does not automatically approve every generated variation.

## Current approval notes

- Fighter direction is locked to the approved unarmed metal-gauntlet design.
- The previous sword-and-shield Fighter concept is not canonical for Fighter.
- Archer direction is locked to the latest refined female chibi Archer style.
- Male face diversity from the latest review is mandatory for all future generations.
- Slime and Golem remain pilot monster/boss assets and are reviewed separately from this Class 1 character lock.

## Deferred work

Do not yet:

- create final Shop cards for all classes
- bake names or prices into character art
- create full animation sheets for all seven characters
- integrate generated images into runtime
- overwrite existing runtime paths
- generate Class 2 or Secret characters in bulk before Class 1 review is complete

## Ownership boundary

Coco may:

- maintain this specification
- maintain filenames, manifests, and approval status
- validate dimensions and alpha after files are imported
- prepare contact sheets and review checklists

CC owns:

- runtime asset loading
- Three.js presentation
- camera and board scale
- Bench and Board integration
- combat and animation hookup

Any runtime-related verification must be handled separately and gameplay-related testing must use Speed x4.

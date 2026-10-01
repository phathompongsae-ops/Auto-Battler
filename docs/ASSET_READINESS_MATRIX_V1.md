# Asset Readiness Matrix V1

## Purpose

Track exactly what is still missing before each pilot asset can advance from its current repository status to `canonical-approved`, `card-ready`, and later `runtime-linked`.

This matrix is documentation-only. It does not authorize runtime integration or change any existing asset path.

## Status meanings

- `concept-approved`: visual direction approved, exact final PNG not yet verified.
- `candidate-present`: a repository file or candidate exists, but final visual/technical approval is incomplete.
- `canonical-approved`: the exact PNG has passed identity, provenance, visual, alpha, dimensions, and reduced-size checks.
- `card-ready`: canonical source has a reviewed Shop Card derivative.
- `runtime-linked`: runtime mapping was implemented and tested separately by CC.
- `reserved-future-use`: retained but not assigned to current Map 1 content.

## Pilot matrix

| Asset | Current status | Planned canonical path | Exact PNG imported | Provenance cleared | Real alpha verified | Dimensions verified | Visual direction match | Reduced-size readable | User approved exact file | Next valid status |
|---|---|---|---|---|---|---|---|---|---|---|
| Fighter | concept-approved | `assets/canonical/heroes/fighter.png` | No | Pending | Pending | Pending | Direction approved: male unarmed fighter, reinforced metal gauntlets, no sword, no shield | Pending | No | canonical-approved |
| Archer | concept-approved | `assets/canonical/heroes/archer.png` | No | Pending | Pending | Pending | Direction approved: female woodland archer, olive hood/cape, bow, quiver | Pending | No | canonical-approved |
| Ninja | concept-approved | `assets/canonical/heroes/ninja.png` | No | Pending | Pending | Pending | Direction approved: female high-speed physical assassin, paired short weapons, dark indigo/violet lightweight armor | Pending | No | canonical-approved |
| Slime | candidate-present | `assets/canonical/monsters/slime.png` | No exact canonical file | Pending | Pending | Pending | Pending final stylized 3D/hand-painted review | Pending | No | canonical-approved |
| Golem | candidate-present | `assets/canonical/bosses/golem.png` | No exact canonical file | Pending | Pending | Pending | Existing procedural file is not final boss art | Pending | No | canonical-approved |
| Warden | reserved-future-use | `assets/reserved/bosses/warden.png` | Existing reserve candidate only | Pending if reused | Pending | Pending | No Map 1 assignment | N/A for current pilot | No | reserved-future-use |

## Per-asset blocking decisions

### Fighter

Before promotion:

1. Import the exact approved PNG.
2. Confirm true transparency and no embedded checkerboard/background.
3. Confirm full-body crop and readable gauntlet silhouette at Shop/Bench/Board size.
4. Confirm no sword, shield, or misleading blade silhouette.
5. Record explicit approval of that exact repository file.

### Archer

Before promotion:

1. Import the exact approved female Archer PNG.
2. Confirm olive-green hood/cape, bow, and quiver remain readable after reduction.
3. Reject the existing small procedural `assets/archer.png` as a final canonical source.
4. Confirm true transparency, dimensions, and exact-file approval.

### Ninja

Before promotion:

1. Import the exact approved female Ninja PNG at `assets/canonical/heroes/ninja.png`.
2. Confirm a paired-weapon silhouette: twin short blades, short blade plus visible secondary blade, or paired kunai with one dominant readable weapon.
3. Confirm the female face, hair, and head shape remain readable at Shop-card size; a fully sealed hood or helmet fails.
4. Confirm the silhouette and palette do not duplicate Archer, Ranger, Duelist, or the enemy Shadow Assassin.
5. Confirm dark indigo/violet cloth does not disappear against dark Shop UI; a controlled accent must remain visible.
6. Confirm real alpha from pixel data, no baked checkerboard, no solid background, and no white fringe.
7. Review the exact image at Shop, Bench, and Board sizes and record each result separately.
8. Record explicit user approval of the exact repository file before promotion.

Runtime note:

- Until the exact portrait passes this gate, Runtime may use its existing fallback/placeholder behavior only.
- A fallback is not a canonical Ninja asset and must not be relabeled as one.
- Runtime integration remains owned by CC and must occur in a separate PR.

### Slime

Before promotion:

1. Identify the exact candidate file or create an original replacement.
2. Resolve commercial-use provenance.
3. Confirm silhouette and face remain readable at board scale.
4. Confirm alpha and dimensions.

### Golem

Before promotion:

1. Import or generate a dedicated final boss-scale Golem.
2. Confirm it does not read as a normal-sized monster when reduced.
3. Confirm alpha, dimensions, silhouette, and style consistency.
4. Preserve the existing procedural file only as a temporary placeholder until separately replaced.

### Warden

- Keep the file.
- Do not assign it to Map 1, Stage 5, or another encounter automatically.
- Do not promote it until a later map/mode design decision gives it a canonical role.

## Approval rule

A row may move to `canonical-approved` only when every required column for that asset is complete and the user approves the exact repository file, not merely the concept or a chat preview.

`canonical-approved` does not automatically imply `card-ready` or `runtime-linked`.

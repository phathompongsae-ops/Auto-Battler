# Asset Pilot Source Candidate Audit v1

Status: candidate audit only. No external file is canonical, approved, or runtime-linked by this document.

## Decision summary

| Pilot | Repository state | Download audit | Route |
|---|---|---|---|
| Archer | `assets/archer.png` remains a procedural/placeholder path pending exact-file review | CC0 archer candidates exist, but reviewed options are top-view, crossbow, static pixel, or otherwise incompatible with the approved female woodland 3/4 direction | Generate a new exact Archer asset with ChatGPT after prompt/spec lock |
| Slime | Existing candidate/original-project file still needs provenance and exact-file review | A CC0 animated slime pack exists, but its orthogonal pixel style conflicts with the stylized 3D/hand-painted target | Inspect the existing project candidate first; generate with ChatGPT if it fails approval |
| Golem | `assets/mon_golem.png` remains a procedural/placeholder path pending exact-file review | A CC0 plant-golem/vector candidate exists, but it does not match the required stone arena golem or complete animation set | Generate a new exact Golem asset with ChatGPT after prompt/spec lock |

## Download-before-generate audit

### Archer

Candidates reviewed:

- OpenGameArt — **Top View Crossbow man**, by Cliipso, CC0. It includes walk/prepare/shoot material, but it is top-view, crossbow-based, and does not match the locked female woodland Archer silhouette.
- OpenGameArt — **archer [Static] [64x64]**, by LordNeo, CC0. It is static pixel art and cannot establish the required six-state pilot animation or target visual style.

Decision: do not import either as canonical. The first may be useful only as a technical animation-reference asset if the user explicitly approves temporary use.

### Slime

Candidate reviewed:

- OpenGameArt — **Slimes**, by AntumDeluge / nudelchef, CC0. It has orthogonal directional movement frames and clear licensing, but the pixel-art style conflicts with the game's stylized 3D/hand-painted direction.

Decision: inspect the exact existing project Slime candidate first. Do not download a replacement merely because it is license-safe. If the existing file fails alpha, provenance, scale, or readability review, ChatGPT should generate the canonical candidate.

### Golem

Candidate reviewed:

- OpenGameArt — **Some Characters by Ragewortt in Vector**, CC0, which includes a plant golem. It does not match the intended stone arena Golem, target silhouette, or required six-state animation package.

Decision: reject for canonical use and generate a purpose-built Golem with ChatGPT.

## License policy

- CC0 assets can be used commercially, but license compatibility alone is not visual approval.
- Kenney states that assets on its asset pages are CC0 and may be used commercially; an exact pack still needs per-file visual and technical inspection before import.
- Every downloaded candidate needs a source URL, author, license, download date, original filename, and retained license evidence.
- No downloaded asset becomes canonical without the user's exact-file approval.

## Import gate

Before any file is promoted:

1. User approves the exact file, not merely the source page.
2. Source and license evidence are recorded.
3. PNG format and real transparency are checked.
4. Dimensions and frame layout are verified.
5. Shop, Bench, and Board reduced-size readability is reviewed.
6. Runtime scale, anchor, facing, and fallback behavior are tested.
7. The file is marked `canonical-approved` only after all checks pass.

## Next action

- Archer: ChatGPT generation brief and exact candidate generation.
- Slime: exact repository candidate review before deciding whether generation is necessary.
- Golem: ChatGPT generation brief and exact candidate generation.

Coco must stop before image generation or canonical import. Runtime integration remains CC-owned.

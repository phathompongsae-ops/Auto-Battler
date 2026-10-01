# Class 1 Neutral Master Batch v1 — Human Review

Status: **READY_FOR_HUMAN_REVIEW**. This is a local-only offline asset package. No animation, Runtime, source code or GitHub state was changed.

## Exact benchmark

- Logical ID: `hero.archer.production-master.candidate.v1`
- Repository lineage: `docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png`
- SHA-256: `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013`
- The package copy is byte-identical and was not regenerated or edited.

## Candidates

| Class | Identity read | Iterations | Internal result |
|---|---|---:|---|
| Fighter | Crimson/iron brawler; paired gauntlets | 1 | Ready for review |
| Swordman | Cobalt/silver agile swordsman; sword and small buckler | 2 | Ready after targeted proportion correction |
| Mage | Violet pointed-cap caster; crystal staff | 1 | Ready for review |
| Summoner | Teal contract caster; grimoire and ring seal | 1 | Ready for review |
| Acolyte | Ivory/sky-blue female support; veil and sun-ring staff | 1 | Ready for review |
| Merchant | Ochre combat merchant; backpack, ledger, coin pouch and axe | 1 | Ready for review |

## Review order

1. `review/class-1-full-size-roster-contact-sheet.png`
2. `review/class-1-board-scale-roster.png`
3. `review/class-1-bench-scale-roster.png`
4. `review/class-1-shop-card-roster.png`
5. `review/class-1-silhouette-comparison.png`
6. `review/class-1-pairwise-silhouette-matrix.png`
7. `review/individual/`

## Internal visual QA

- All 21 pairwise class combinations were inspected; automated normalized silhouette IoU maximum is `0.6566`, below the `0.88` conflict gate.
- Fighter/Swordman separation: broad gauntlet mass versus narrow sword/buckler profile.
- Mage/Summoner separation: pointed cap/crystal staff versus high collar/grimoire/ring seal.
- Archer/Acolyte separation: green elf ranger with bow versus blonde ivory novice support with sun staff.
- Merchant remains combat-ready while backpack, cap, ledger and trade equipment prevent generic-NPC ambiguity.
- Board and bench previews use `assets/v5/board_ground.jpg` from the repository as the actual background source. Candidate pixels were only uniformly scaled and positioned.
- Shop previews retain head, feet and full weapon silhouettes.

## Human review focus

- Confirm the six candidates feel like distinct classes from the same game rather than Archer costume swaps.
- Compare face diversity, head shape and eye language—especially Archer versus Acolyte.
- Confirm Mage versus Summoner and Fighter versus Swordman remain immediately distinct at board scale.
- Check Swordman's long sword margin and all weapon/hand contacts at full size.
- Confirm the Merchant reads as a playable combat class rather than a background NPC.

No new candidate is approved by this report. Motion production, Runtime integration, Class 2 and Secret Class production remain unauthorized.

# Class 1 Neutral Master Batch v1 — Technical QA

## Result

Technical package checks: **PASS**. Human visual approval: **false**.

| Class | SHA-256 | Alpha bounds | Baseline | PNG contract |
|---|---|---|---:|---|
| Fighter | `4b2ec5558971c3730da352f5ba2a39d928bbf5c722d40e38256dd6b4d48a19c4` | `528x730+56+125` | 854 / half-open 855 | RGBA 640×960, 8-bit |
| Swordman | `2a1fc6f93f384fbc92486a8e42975a10bb84d8f9cd35b13b155a9668638861ed` | `599x730+20+125` | 854 / half-open 855 | RGBA 640×960, 8-bit |
| Archer | `4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013` | `501x730+71+125` | 854 / half-open 855 | RGBA 640×960, 8-bit |
| Mage | `6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315` | `541x730+49+125` | 854 / half-open 855 | RGBA 640×960, 8-bit |
| Summoner | `731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3` | `534x730+53+125` | 854 / half-open 855 | RGBA 640×960, 8-bit |
| Acolyte | `0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8` | `550x730+45+125` | 854 / half-open 855 | RGBA 640×960, 8-bit |
| Merchant | `053785f1283a02c49897445edf038e3f95b30cb2733b81c206f648e986b157d3` | `533x730+53+125` | 854 / half-open 855 | RGBA 640×960, 8-bit |

## Checks

- PNG signature: 7/7 pass.
- Decode and RGBA mode: 7/7 pass.
- Dimensions 640×960: 7/7 pass.
- Bit depth 8: 7/7 pass.
- Transparent outer border: 7/7 pass.
- Half-open baseline y=855: 7/7 pass.
- Canvas containment and crop: 7/7 pass.
- Duplicate SHA-256: none.
- Corruption or accidental background: none detected.
- Serious visible anatomy or weapon defect: none observed during internal review.
- Pairwise silhouette conflicts: 0/21; maximum normalized IoU `0.6566`.

The machine-readable measurements, PNG chunks and all 21 pairwise metrics are in `data/technical-qa-report-v1.json`.

## Approval safety

`neutralMasterApproved=false`, `exactPackageApproved=false`, `canonicalApproved=false`, `runtimeEligible=false`, `motionAuthorized=false`, `runtimeIntegrated=false`.

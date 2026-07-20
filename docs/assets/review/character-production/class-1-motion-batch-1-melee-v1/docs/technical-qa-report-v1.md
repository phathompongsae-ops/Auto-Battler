# Technical QA Report v1

Result: `INTERNAL_QA_PASS_HUMAN_DECISION_PENDING`

## Binary and canvas checks

- Final motion PNGs: 72/72 decode successfully.
- PNG mode: RGBA, 72/72.
- Dimensions: 640×960, 72/72.
- Bit depth: 8-bit/channel, 72/72.
- PNG color type: 6 (RGBA), 72/72.
- Fully transparent outer border: 72/72.
- Alpha content contained inside canvas: 72/72.
- Half-open foot baseline y=855: 72/72.
- Duplicate motion-frame SHA-256 hashes: none.
- Exact Neutral Master reference byte identity: 3/3.
- Review GIF decode: 24/24.
- Individual normal-preview GIF durations match their sidecars: 9/9.
- Individual contact sheets: 9/9.

Per-frame SHA-256, alpha bounds, file sizes, PNG properties, GIF metadata, and exact Neutral comparison results are recorded in `data/technical-qa-report-v1.json`.

## Visual internal QA

- Character identity and face consistency: PASS.
- Body proportion consistency: PASS.
- Hand/anatomy continuity: PASS.
- Weapon/prop continuity: PASS.
- Class/action differentiation: PASS.
- Baseline and dominant-face anchor stability: PASS.
- Transparent edge cleanliness: PASS.
- Normal-speed action readability: PASS.
- Slow-QA inspection: PASS.
- Board/bench/shop proxy readability: PASS.
- Human visual approval: pending.

## Production/process record

- One reference-anchored 4×2 primary pose sheet was produced per character/action; no image-generation correction round was used.
- Magenta chroma backgrounds were removed locally with a soft matte and despill pass.
- Cross-cell alpha debris was removed by retaining the largest connected subject component per cell; 21,321 stray pixels were removed across the batch.
- A targeted technical composition pass aligned the dominant face signal and preserved a safe transparent margin. Idle apparent height was normalized per class. No pose artwork was regenerated during this pass.
- All review artifacts were rebuilt from the final 72 PNGs after the technical pass.

## Scope verification

- GitHub branches/commits/PRs: unchanged; none created.
- Runtime/src/Combat/Core Logic: unchanged.
- Balance/stat/gameplay data: unchanged.
- Archer asset or motion: unchanged and not copied.
- Skills/Cast, Hit, Death, Victory, Fusion, 3-star, Class 2, and Secret Class work: not started.
- Deferred 8×8 Board Preview replacement: not started.

# Pilot Idle Motion Source Handoff v1

## Handoff status

This document records source-asset facts and a recommended path-limited CC integration sequence. It is not an integration prompt, runtime change, browser approval, visual canonical approval, or merge authorization.

- `canonicalApproved=false`
- Runtime integration: not performed
- Browser/x4 review: not performed by Coco
- Pull requests merged: none

## Motion base and PR chain

| Phase | PR | Branch | Exact base SHA | Exact source head |
|---|---:|---|---|---|
| Motion readiness base | #45 | `cc/motion-pipeline-merge-readiness-audit-v1` | `e9d4af45fefa7795c65265c74fde24a8e6f2b648` | `58824feb92452fb3c7ab72bf7984b4f22d558b3e` |
| F — Idle production contract | #50 | `coco/pilot-idle-motion-production-contract-v1` | `58824feb92452fb3c7ab72bf7984b4f22d558b3e` | `023af676666fde06f4ed7425261df1f6d8cfb5a9` |
| G — Slime Idle source | #51 | `coco/slime-idle-motion-test-v1` | `023af676666fde06f4ed7425261df1f6d8cfb5a9` | `811e6858a7e2cbe004270a094e58982b8c1fbcf7` |
| H/I — Golem Idle source + handoff | #52 | `coco/golem-idle-motion-test-v1` | `811e6858a7e2cbe004270a094e58982b8c1fbcf7` | `79971c969a42431b7d0ec96dc6758a480da13e94` before this handoff-only commit |

The Motion source chain is separate from every Arena Ruins Board Art branch. CC should not merge or cherry-pick the whole Coco ancestry to integrate these states.

## Source identities

### Slime

- Identity master: `assets/units/monster.slime/move/monster.slime_move_000.png`
- Master SHA-256: `12ca260a001dbda6177f29565e9df2c369c09216c889974aeee8b12fb5ae04f9`
- Locked state: existing Slime Move, 512×512, anchor `[0.5,0.9]`, `facingMode: flip_x`
- Idle production: source-derived symmetric squash/stretch from the master; no regenerated character pixels, recolor, attack, marker, shadow, or world travel

### Golem

- Identity master: `assets/units/monster.golem/attack/monster.golem_attack_000.png`
- Master SHA-256: `be41f186b37f99fed12e59844638ab0ed2e0020deb73ace5a840c2d4adda70d8`
- Required identity version: Golem Attack visual-fix v2 (`assets/units/monster.golem/visual-fix-report-v2.json`)
- Locked state: 640×640, anchor `[0.5,0.94]`, `facingMode: flip_x`
- Idle production: restrained source-derived control-point deformation with fixed feet/baseline; no pre-fix artwork, attack, impact marker, dust, VFX, shadow, or locomotion

Both generative candidate edits were rejected before repository inclusion because they baked checkerboards and changed identity details. No rejected candidate pixels or files are part of either PR.

## Production paths ready for path-limited integration

CC should pull only these runtime-relevant source paths from the final Phase H/I head:

### Slime Idle

- `assets/units/monster.slime/idle/monster.slime_idle_000.png`
- `assets/units/monster.slime/idle/monster.slime_idle_001.png`
- `assets/units/monster.slime/idle/monster.slime_idle_002.png`
- `assets/units/monster.slime/idle/monster.slime_idle_003.png`
- `assets/units/monster.slime/idle/monster.slime_idle_004.png`
- `assets/units/monster.slime/idle/monster.slime_idle_005.png`
- `assets/units/monster.slime/idle/monster.slime_idle_006.png`
- `assets/units/monster.slime/idle/monster.slime_idle_007.png`
- `assets/units/monster.slime/monster.slime_idle_motiontest.json`
- `assets/units/monster.slime/idle/source-map.json`
- `tools/validate-slime-idle-frames-v1.mjs`

### Golem Idle

- `assets/units/monster.golem/idle/monster.golem_idle_000.png`
- `assets/units/monster.golem/idle/monster.golem_idle_001.png`
- `assets/units/monster.golem/idle/monster.golem_idle_002.png`
- `assets/units/monster.golem/idle/monster.golem_idle_003.png`
- `assets/units/monster.golem/idle/monster.golem_idle_004.png`
- `assets/units/monster.golem/idle/monster.golem_idle_005.png`
- `assets/units/monster.golem/idle/monster.golem_idle_006.png`
- `assets/units/monster.golem/idle/monster.golem_idle_007.png`
- `assets/units/monster.golem/monster.golem_idle_motiontest.json`
- `assets/units/monster.golem/idle/source-map.json`
- `tools/validate-golem-idle-frames-v1.mjs`

The contract files from PR #50 may be pulled for design provenance, but they are not runtime assets:

- `docs/assets/pilot-idle-motion-production-contract-v1.md`
- `data/design/pilot-idle-motion-production-contract-v1.json`
- `data/design/slime-idle-pose-map-v1.json`
- `data/design/golem-idle-pose-map-v1.json`
- `tools/validate-pilot-idle-motion-production-contract-v1.mjs`

## Files not intended for runtime import

- `docs/assets/review/slime-idle-motion-test-v1-contact-sheet.png`
- `docs/assets/review/slime-idle-motion-test-v1-preview.gif`
- `docs/assets/review/golem-idle-motion-test-v1-contact-sheet.png`
- `docs/assets/review/golem-idle-motion-test-v1-preview.gif`
- This handoff review and all Arena Ruins Board Art preview/contract/production branches
- Any scratch candidate, temporary contact sheet, alpha-cleanup checkpoint, or rejected generated image outside the repository

These are review/provenance artifacts only. GIFs and contact sheets never substitute for the sixteen individual PNG frames.

## Sidecar contracts

| Unit/state | FPS | Frames | Loop | Canvas | Anchor | Root motion | Markers | runtimeFlipX | canonicalApproved |
|---|---:|---:|---|---|---|---|---|---|---|
| `monster.slime/idle` | 8 | 8 | true | 512×512 | `[0.5,0.9]` | `in-place` | `[]` | true | false |
| `monster.golem/idle` | 8 | 8 | true | 640×640 | `[0.5,0.94]` | `in-place` | `[]` | true | false |

No footstep, impact, attack, or gameplay marker belongs to either idle state.

## Source validator results

All commands below were run against their exact phase content and returned exit code 0:

- `node tools/validate-pilot-idle-motion-production-contract-v1.mjs`
- `node tools/validate-slime-idle-frames-v1.mjs`
- `node tools/validate-slime-move-frames-v1.mjs`
- `node tools/validate-golem-idle-frames-v1.mjs`
- `node tools/validate-golem-attack-frames-v1.mjs`
- `node tools/validate-pilot-motion-test-contract-v1.mjs`
- `node tools/test-asset-animation-runtime.mjs`
- `git diff --check`

Measured source findings:

- Slime: eight unique hashes; baseline y=460 for 8/8; horizontal centroid spread 0.066 px; normalized 007→000 seam 0.00892; detached residue 0; opaque border 0.
- Golem: eight unique hashes; baseline y=601 for 8/8; horizontal centroid spread 0.817 px; normalized 007→000 seam 0.00951; large checker candidates 0; opaque border 0.
- Slime Move and Golem Attack visual-fix-v2 source hashes remained unchanged.

These Node/source checks do not prove browser loading, runtime playback, x4 loop appearance, display-scale identity, or UI/combat regression.

## Unresolved visual and integration risks

- Slime breathing is intentionally subtle and source-derived; at runtime display scale it may need visual approval for amplitude, especially at x4. An eye-only gaze change was not painted because preserving the exact approved face was judged safer.
- Golem crystal/shoulder lag is a controlled deformation of attached source pixels, not a skeletal rig. Its perceived weight and the 0.817 px centroid range still require in-browser review.
- Neither state is registered or selected by runtime in this source line. Asset-path loading, state transition behavior, runtime fallback, and facing flip remain CC integration responsibilities.
- Contact sheets and GIFs are useful review aids but are not proof of anchor behavior inside the Three.js scene or motion harness.
- `canonicalApproved=false` remains intentional until exact-file visual approval.

## Recommended CC integration sequence

Create one new CC integration task from the existing CC motion baseline, import only the two path lists above from the final Phase H/I source commit, and leave Board Art ancestry out. Then register/test the two idle states without changing Combat timing or gameplay behavior. Review exactly these three checkpoints at x4:

1. **Asset Load** — all sixteen PNGs and both sidecars resolve with no fallback/corruption.
2. **Playback/Loop/Anchor Stability** — each 8-frame loop plays at 8 FPS; 007→000, foot baseline, scale, centroid, facing flip, and state transition remain stable.
3. **No-marker + Visual Regression** — no idle markers fire; Slime/Golem identity, alpha, checkerboard cleanup, other pilot states, Combat, Map, and UI remain unchanged.

No merge has been performed or recommended by this source handoff. Integration approval and final visual approval remain separate decisions.

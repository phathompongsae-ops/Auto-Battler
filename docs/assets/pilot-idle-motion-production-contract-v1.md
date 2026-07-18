# Pilot Idle Motion Production Contract v1

## Approval and scope

- Base: PR #45, `cc/motion-pipeline-merge-readiness-audit-v1`, exact SHA `58824feb92452fb3c7ab72bf7984b4f22d558b3e`.
- Branch: `coco/pilot-idle-motion-production-contract-v1`.
- This phase is documentation and production metadata only. It does not contain idle PNGs or runtime integration.
- `canonicalApproved=false` for the contract and every future motion-test sidecar until exact-file approval.
- Coco does not claim browser or x4 approval. CC must integrate and review the future assets at x4.

## Source facts and identity masters

### Slime

The identity master is the existing eight-frame Slime Move set, with frame 000 as the neutral source pose. The source sidecar fixes the export at 512×512, anchor `[0.5,0.9]`, transparent RGBA, and in-place root motion. `src/asset-animation-runtime.js` declares `ASSET_MANIFEST['monster.slime'].facingMode` as `flip_x`; therefore the idle contract records `runtimeFlipX=true` and forbids mirrored duplicate artwork.

Locked identity details are the glossy cyan/teal jelly body, angry eye/face treatment, horn-like top lobes, chest spiral, bubbles/highlights, outline/material treatment, camera, lighting, scale, and ground contact.

### Golem

The identity master is the existing Golem Attack set after visual fix v2, with attack frame 000 as the neutral grounded source pose. The source sidecar fixes the export at 640×640, anchor `[0.5,0.94]`, transparent RGBA, and in-place root motion. `src/asset-animation-runtime.js` declares `ASSET_MANIFEST['monster.golem'].facingMode` as `flip_x`; the contract therefore also records `runtimeFlipX=true`.

Locked identity details are the head/body silhouette, warm stone palette and texture, cyan crystals and spiral carvings, proportions, camera, lighting, scale, fixed foot baseline, and visual-fix-v2 alpha cleanup.

The contract records SHA-256 for all sixteen master frames and both source sidecars. Future production validators must fail if any source file changes.

## Common idle export contract

Both idles use eight individually readable PNG frames, filenames `000` through `007` only, 8 FPS, seamless looping, in-place root motion, empty `eventMarkers`, 8-bit RGBA, transparent background, and no opaque border pixels. Every frame must preserve identity, palette, material, camera, scale, and the source anchor/foot baseline.

Forbidden content includes checkerboard pixels, crop, detached residue, horizontal travel, baked ground shadow, text, scene/map content, projectile, particles/VFX, locomotion, or attack anticipation. A contact sheet or GIF is review-only and never substitutes for the eight frame files.

## Slime idle motion

The sequence is: neutral settle; gentle inhale/squash; peak expansion; settle; tiny gaze/body adjustment; soft exhale; secondary jelly settle; return to neutral. Squash and stretch must remain subtle and volume-preserving. The body must not hop or travel, and there is no footstep cue.

See `data/design/slime-idle-pose-map-v1.json` for the per-frame production roles.

## Golem idle motion

The sequence is: neutral grounded stance; subtle torso rise; shoulder/crystal secondary lag; peak weight hold; slow weight transfer; exhale/settle; secondary return; neutral seam. Motion must read as heavy and slow without becoming an attack wind-up. Feet never slide, and crystals/spirals may lag only as attached secondary motion—never as glow trails or VFX.

See `data/design/golem-idle-pose-map-v1.json` for the per-frame production roles.

## Cross-state quality gates

For each future idle set:

1. Decode all eight 8-bit RGBA PNGs and reject missing `000–007`, extra `008`, duplicate hashes, opaque corners/borders, crop, and checkerboard residue.
2. Compare canvas, anchor, silhouette, scale, foot/root baseline, and horizontal centroid against the locked source state.
3. Review the `007 → 000` seam, ensure markers are empty, and keep `canonicalApproved=false`.
4. Prove the locked source frames and sidecars retain their recorded hashes.

After source validation, CC still owns exactly three integration checkpoints: Asset Load; Playback/Loop/Anchor Stability; and No-marker + Visual Regression. Those future checkpoints have not passed in this contract phase.

## Production ancestry

The Slime and Golem idle work must descend from this motion branch. It must not descend from any Arena Ruins board-art branch. No Core Logic, motion harness, runtime manifest, or existing validator is modified by this contract.

## Canonical state

`canonicalApproved=false`

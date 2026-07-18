# Pilot Asset Production Pack v2

Scope: `hero.archer`, `monster.slime`, `monster.golem` only.

This is a production contract, not final-art approval. All candidates remain `canonicalApproved: false` until exact files are reviewed in-game.

## Locked runtime

- Asset & Animation Runtime: PR #23 @ `5a3a8eec7991a98aad6f3acf0ce38687764dcb1a`
- Map theme: `map1.arena_ruins`
- PNG with alpha
- 3/4 front camera
- Runtime horizontal flip
- Default 12 FPS; accepted 8–15
- States: idle, move, attack, skill, hit, death

## Anchors

- Archer `(0.5, 0.92)`
- Slime `(0.5, 0.90)`
- Golem `(0.5, 0.94)`

## Frame targets

- Idle 6–8
- Move 8–10
- Attack 8–12
- Skill 12–16
- Hit 4–6
- Death 8–12

## First motion tests

1. Archer — Attack: anticipation, bow release, projectile origin, recovery, flip safety.
2. Slime — Move: squash/stretch, stable base anchor, seamless loop, floor separation.
3. Golem — Attack: heavy anticipation, impact timing, stable large-unit anchor, separate ground VFX.

Do not expand to full six-state production before these three tests are integrated and approved.

## Readability rules

- Archer: female silhouette, bow clearly separated, olive-green and warm leather must not blend into gray stone or moss.
- Slime: rounded elastic silhouette, clear face, body hue distinct from moss and dust.
- Golem: largest pilot, broad shoulders and oversized forearms, dark joints and restrained warm runes separate it from arena masonry.

## Export rules

- Character art must be separable from projectile, trail, impact and ground VFX.
- All frames in one state use identical dimensions, camera, scale and anchor.
- No accidental floor shadow baked into character layers.
- No cropped weapons, limbs or VFX.
- Loops must not pop.
- One-shot states end in an intentional recovery or terminal frame.
- Silhouettes must remain readable at normal mobile gameplay size.

## Naming

Individual frames:

`assets/units/{unitId}/{state}/{unitId}_{state}_{frameIndex}.png`

Horizontal state sheet:

`assets/units/{unitId}/{unitId}_{state}_sheet.png`

## Deferred

- Full six-state production
- Shop cards and icons
- Other heroes and monsters
- Map 2 and Map 3 assets
- Multi-direction sheets
- Final canonical approval

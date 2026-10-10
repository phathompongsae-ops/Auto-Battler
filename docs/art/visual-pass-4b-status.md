# Visual Production Pass 4B — status: generation blocked

Starting HEAD `c5acaf6`. **No monster art was generated or integrated.** All
three Pass 4A contracts (`src/data/monsterAnimArt.ts`) remain `pending`;
runtime behaviour is unchanged.

## Blocker (checked 2026-10-10)

1. **No generator matching the approved style is available to Claude Code.**
   Every approved monster, prop and VFX source was made with Codex's built-in
   `image_gen` tool: smooth illustrated high-resolution sources fitted down
   (`art-source/candidates/demo-v1-20261007/README.txt`). This pass excludes
   Codex for generation. Claude Code has no equivalent image model. The only
   generator it can reach is PixelLab, which produces pixel art; the brief
   rules that style out ("not pixelated", "does not look like a different
   game").
2. **PixelLab has no budget either.** 0 of 2,000 monthly generations remain
   until 2026-11-03, with $0.00 credits and a 10-generation daily bonus.
   Its pricing (`animate_image` = ceil(w × h × frames / 65536); a base design
   3–25) puts one first attempt at the three sets at roughly 75–125
   generations, or 150–250 with regenerations.

## Delivered: alpha / height validator

`tools/monster-art/stripMetrics.mjs`, dependency-free. It decodes 8-bit RGBA
PNGs and measures each frame's visible bounds (alpha ≥ 32). It checks:

- exact strip size and frame count;
- no crop (nothing touches an edge, last 2 rows clear);
- feet standing on the feet row (lowest pixel `feetRow − 1`, within 6 px for
  raised walk feet);
- standing height (`feetRow − top`) inside the contract band.

Feet centring is opt-in: the lowest rows often hold a weapon tip or cape, so
alpha bounds cannot find the feet reliably. It runs as a CLI and from
`tests/unit/stripMetrics.test.ts`, which checks every `integrated` contract
strip automatically.

Baseline on the approved Pass 2 idle sheets:

| Sheet | Cell / feet row | Lowest visible row | Standing height | Pass 4 band |
|---|---|---|---|---|
| Crypt Lord | 146×164 / 162 | 161, 159 | 151, 149 | 150–168 (tallest pose inside) |
| Grove Guardian | 142×136 / 134 | 133 | 134 | 124–140 |
| Crypt Knight | 120×108 / 106 | 105 | 106 | above the Brute's 88–100 |
| Crypt Skeleton | 70×84 / 81 | 80, 81 | 78 | below the Brute when drawn at its own scale |

To integrate later: place the five strips at
`public/assets/monsters/<id>/<state>.png` and set `status: 'integrated'`.
Run `node tools/monster-art/stripMetrics.mjs <strip> <w> <h> <feetRow> <min> <max>`
per strip, then the unit and browser suites.

## Skeleton Brute: canvas change and staged idle (2026-10-10; superseded by the integration below)

- The `crypt_brute` contract is now **176×144, feet row 142** (lowest pixel on
  row 141, rows 142–143 clear). The standing band is still 88–100. The canvas is
  room for the hammer and the animation, not a bigger body (see Pass 4A).
- Locked identity reference: `art-source/monsters/crypt_brute/source/reference-idle-pair.png`,
  user-supplied. Its two poses are the idle source.
- Staged production idle: `art-source/monsters/crypt_brute/idle.png`
  (2 × 176×144, standing 94 / 95, feet centred within 0.5 px). It passes the
  validator, and `tests/unit/stripMetrics.test.ts` checks it. It is **not** in
  `public/assets`. The contract stays `pending` because the resolver uses
  strips only when all five exist.
- Runtime review: `npm run test:browser -- --brute-idle-review` (also in the
  default and `--anim-review` runs). The real idle is loaded through the
  test-only `debug.installMonsterAnimReview`. The four states without art keep
  the code-drawn fixture boxes, and nothing ships.
- Still needed before integration: walk (6), attack (5, contact first), special
  (Bone Smash: raise 3, hold 2, impact 2, recovery 3) and hit (3) strips. Each
  must be drawn from the locked reference at the same scale.

## Skeleton Brute: production integration (2026-10-10)

- **Integrated.** `MONSTER_ANIM_ART.crypt_brute.status = 'integrated'`, and all five strips are in
  `public/assets/monsters/crypt_brute/`: idle 2, walk 6 @ 9, attack 5 @ 12 (contact on frame 0),
  special 10 @ 12 (raise 3, hold 2, impact 2, recovery 3), hit 3 @ 15.
- The generic runtime picks them up with no Brute-specific code. The borrowed, tinted Skeleton sheet
  is used only if a strip fails to load: the resolver never uses a half-loaded set.
- Generated with Codex `image_gen` (approved for this pass) from the locked reference. Provenance and
  byte-identical reproduction are in `art-source/monsters/crypt_brute/pass-4b/`.
- Browser suite `tests/browser/bruteAnim.test.mjs` (BP-1…16; `--brute-review`, also in the default
  and `--anim-review` runs) covers:
  - real fights facing both ways and circling;
  - body, shadow and Bone Smash timing against the fallback;
  - Dodge through real damage, and death;
  - the test-only missing-strip fallback (`debug.dropMonsterAnimStrip`) and restore
    (`debug.restoreMonsterAnimStrips`);
  - no repeated loading;
  - performance against the fallback;
  - viewport captures.
- **Performance.** The first Crypt fight of a session hitches once (about 120 ms) with the fallback
  art too, so it is not caused by the strips. Measured from the same warm state, real strips match
  the fallback (p95 7.2 against 7.1 ms).

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

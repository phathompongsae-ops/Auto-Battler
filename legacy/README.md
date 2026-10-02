# Realmfront — Fantasy Settlement War

Realmfront is a compact web-first pixel-art fantasy settlement war game.

## Current Alpha Loop

Build Dawnkeep -> recruit a 3-5 unit team -> run expeditions -> auto-battle -> collect resources -> upgrade the settlement -> resolve a Season War every three in-game months -> capture three territories per rival -> assault both rival capitals -> Campaign Victory.

## Locked Direction

The source of truth is `docs/REALMFRONT_LOCKED_DIRECTION.md`.

Key constraints:
- 2D isometric pixel-art presentation
- simple Kairosoft-like auto combat
- no skill tree, mana, ultimate, combo, PvP, gacha, deep economy, or giant tech tree
- Human player faction vs Arcane Covenant and Ashen Horde
- Gold, Wood, Stone, Crystal only
- five expedition regions unlocked by Town Hall Lv.1-5
- campaign target: about 8-12 Season Wars

## Run Locally

No build framework is required.

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`.

## Tests

```bash
npm test
node --check app.js
node --check src/fantasy-core.js
```

GitHub Actions also captures visual QA screenshots for settlement, battle, expedition, Season War, and Army screens on desktop/mobile.

## Web Build

GitHub Pages deploys from the workflow in `.github/workflows/pages.yml`.

Live build:
https://phathompongsae-ops.github.io/Auto-Battler/

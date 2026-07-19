# Free Asset Import Runbook

## Purpose

Provide a repeatable, low-risk intake process for external CC0 assets without mixing unreviewed files into the live game.

## Intake directories

Use temporary paths during review:

- `_asset-intake/fantasy-rpg-icons/`
- `_asset-intake/fantasy-ui-borders/`
- `_asset-intake/magic-forcefield/`

Do not reference these paths from runtime code.

## Validation commands

Example commands after the archive becomes locally available:

```bash
ls -lh <archive>.zip
file <archive>.zip
unzip -t <archive>.zip
sha256sum <archive>.zip
unzip -l <archive>.zip
```

Reject the archive if it is empty, corrupt, encrypted, contains executables, or differs materially from the source description.

## Contact sheet requirements

For each pack, generate one contact sheet with:

- readable index number
- original filename
- transparent checkerboard or neutral dark background
- no resampling that obscures the original style
- grouping by category where possible

### Icon pack review labels

- `APPROVE_UI`: suitable for Shop, Bag, currency, status, class, equipment, or skill UI
- `APPROVE_EXPERIMENTAL`: suitable only for prototype testing
- `REJECT_STYLE`: conflicts with the visual direction
- `REJECT_READABILITY`: unreadable at mobile size
- `REJECT_DUPLICATE`: duplicates a stronger existing asset

### UI border review labels

Assess:

- compatibility with 9-slice scaling
- corner readability at 800x360
- visual weight against the game board
- whether gold/stone/wood variants match the approved fantasy direction
- whether a border can be recolored without visible artifacts

### VFX review labels

Assess:

- alpha/background behavior
- loop seam
- readability at 64, 96, and 128 px
- suitability for shield, aura, portal, boss telegraph, or cast effect
- frame count and memory cost

## Canonical destination candidates

Only after approval:

- `assets/ui/external/kenney-fantasy-borders/`
- `assets/ui/icons/external/drummyfish-rpg/`
- `assets/vfx/external/zookeeper-forcefield/`

Each imported folder must contain:

- `LICENSE.txt`
- `SOURCE.md`
- selected assets only
- `manifest.json` with logical ID, original filename, dimensions, source, author, license, and SHA-256

## Runtime gate

No external asset may be wired into `autochess.html` or `src/game.js` in the intake PR.

Runtime integration must be a separate PR with:

- one narrowly defined use case
- fallback behavior
- mobile screenshots
- no regression to layout or loading
- x4 combat testing only when the asset affects combat presentation

# Shop Drawer White-Rectangle / Transparent-Hole — Android Verification

## Summary

The Shop Drawer white-rectangle / transparent-hole artifact investigated in the
Phase 0 and Phase 1 reports (headless Chromium + SwiftShader software rendering)
was tested on a real Android device and **does not reproduce**.

## Verification details

- **Public URL tested:** https://phathompongsae-ops.github.io/Auto-Battler/
- **Commit SHA:** `324f65ffde5737a5d462a4d678a9161724797c7b`
- **Device:** real Android hardware (Chrome for Android)
- **Test performed:** opened and closed the Shop Drawer approximately 40 times
- **Orientations tested:** both portrait and landscape
- **Result:** no white rectangle or transparent/blank region appeared over the
  board, topbar, or Shop Drawer at any point. WebGL rendering, the Shop Drawer
  open/close transition, and hero card images all behaved normally throughout.

## Classification

**SwiftShader / sandbox compositor artifact — not reproducible on real Android
hardware.**

The defect traced in Phase 0/1 is specific to the headless testing
environment's software WebGL rendering path (SwiftShader) used for automated
Playwright verification in this project's sandbox, not a defect in the game's
own code, the Shop Drawer markup, or the render loop. Both CSS-only mitigation
attempts from Phase 1 (`will-change`, `translate3d` layer promotion) were
correctly found ineffective against a sandbox-only rendering artifact — no
code change was warranted, and none was made.

## Status

**Investigation closed** pending any future report of the same symptom
(white rectangle / transparent region appearing over the board or Shop Drawer)
observed directly on real device hardware. If that occurs, reopen with:
device model, Android version, Chrome version, and exact reproduction steps,
and re-run the Phase 0 isolation steps against that specific device/browser
combination before considering any fix.

## Explicitly not done as part of closing this investigation

The following were intentionally **not** added, since the artifact does not
reproduce on real hardware and no fix is warranted:

- forced repaint / render nudge
- WebGL renderer recreation
- changes to `setShopOpen()`
- changes to the render loop
- the previously-tested-and-failed CSS workarounds (`will-change`, `translate3d`)

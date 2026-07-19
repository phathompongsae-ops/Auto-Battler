# Archer Attack v3.2 — Technical and Visual QA

Result: `READY_FOR_HUMAN_REVIEW`

## Root-cause reproduction

- Rejected frame 004 bounds: `517×747+73+108`; parent bounds: `534×776+71+79` and `542×772+70+83`. Scale/silhouette collapse reproduced: FAIL.
- Original parent old004→old005 RMSE: `0.0947987`.
- Rejected v3.1 deltas around frame 006: `0.135438` / `0.127956`. Both exceed the parent transition: FAIL.

## Reworked transition metrics

Normalized ImageMagick RMSE over the binary RGBA canvases:

| Transition | Parent delta | Before inserted | After inserted | Balance | Result |
|---|---:|---:|---:|---:|---|
| 003→004→005 | 0.175901 | 0.137640 | 0.144181 | 0.006541 | PASS |
| 005→006→007 | 0.0947987 | 0.0661639 | 0.0645182 | 0.0016457 | PASS |

Each adjacent delta is below its original unsmoothed parent transition. Both pairs are balanced and visually progressive.

## Technical checks

- Source ZIP SHA/integrity/safe extraction/inventory: PASS
- PNG decode, RGBA and 640×960: 12/12 PASS
- Alpha bounds inside canvas: 12/12 PASS
- Transparent corners/background: 12/12 PASS
- Baseline bottom y=855: 12/12 PASS
- Duplicate final hashes: none
- Immutable mapped originals: 10/10 byte-identical
- Frame 011 vs exact master: byte-identical
- Frame 008 vs old-v3 Release frame 006: byte-identical
- Normal GIF: 12 frames, exact durations, total 127 cs
- Slow GIF: 12 frames, exact QA durations
- Comparison GIF: 12 frames, exact normal durations
- Timing, Release, Recovery and Neutral: unchanged

## Visual QA

- Frame 004: bounds restored to `528×772+68+83`; no silhouette collapse or scale pop; bow tip remains visible and continuous; face, hand, arrow and string remain readable.
- Frame 006: true midpoint spacing passes quantitatively and visually; no false Release; Full Draw remains at 007.
- Face/identity: PASS at normal review scale.
- Anatomy and drawing hand: PASS; no missing/extra limbs or floating hand.
- Bow/arrow/string: PASS; no break, duplicate string, length jump or nock separation detected.
- Normal-speed draw smoothing: PASS; v3.2 removes the v3.1 004 scale dip and subdivides both parent transitions.
- Full Draw→Release: PASS; original binary and 7 cs Release preserved.
- Recovery→Neutral: PASS; all corresponding originals are byte-identical and frame 011 is the exact master.

## Scope

Only final frames 004 and 006 were changed. No GitHub, Runtime, validator, contract, game logic, Release, Recovery, Neutral or original-v3 PNG was modified.


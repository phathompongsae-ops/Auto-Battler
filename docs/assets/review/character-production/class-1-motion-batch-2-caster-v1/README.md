# Class 1 Motion Production Batch 2 — Caster Family — Import Location (Scaffold)

**Status: PENDING_PACKAGE_DELIVERY**

This directory is the additive import root reserved for the future Class 1 Motion Production
Batch 2 (Caster Family) human-review package: **Mage, Summoner, Acolyte**. No package has been
delivered yet. This README is the only file in this directory until the real package arrives —
no artwork, motion, or evidence is fabricated ahead of delivery.

## Expected structure (mirrors Batch 1 Melee's proven layout, `class-1-motion-batch-1-melee-v1/`)

```
class-1-motion-batch-2-caster-v1/
├── mage/
│   ├── neutral/hero.mage_neutral_master.png
│   ├── mage-source-map-v1.json
│   ├── mage-technical-qa-v1.json
│   ├── idle/hero.mage_idle_candidate_v1.json + frames/*.png (8 frames)
│   ├── move/hero.mage_move_candidate_v1.json + frames/*.png (8 frames)
│   ├── attack/hero.mage_attack_candidate_v1.json + frames/*.png (8 frames)
│   └── review/ (contact sheets, normal/slow-QA GIFs, identity-lock sheet)
├── summoner/  (same shape as mage/)
├── acolyte/   (same shape as mage/)
├── review/    (batch-level comparison GIFs, silhouette/confusion review)
├── docs/      (human-decision-sheet, batch review write-up, technical-qa-report)
└── data/      (batch manifest, timing-summary, technical-qa-report)
```

## Expected motion set

| Class | Neutral | Idle | Move | Basic Attack |
|---|---|---|---|---|
| Mage | 1 static frame | 8 frames | 8 frames | 8 frames |
| Summoner | 1 static frame | 8 frames | 8 frames | 8 frames |
| Acolyte | 1 static frame | 8 frames | 8 frames | 8 frames |

Skill/Cast: **NOT INCLUDED** in this batch — out of scope, not to be produced or reviewed here.

72 total animated motion frames expected (24 per character, matching Batch 1 Melee's per-
character count), plus 3 Neutral Master references.

## Neutral Master lineage (already approved, PR #83 — reference only, not re-imported here)

Mage, Summoner, and Acolyte Neutral Masters are **already exact-approved** in PR #83 (Class 1
Neutral Master Batch v1 Exact Package Approval). The future Batch 2 package is expected to
reference these same byte-identical masters (the same pattern Batch 1 Melee used for Fighter/
Swordman/Merchant) — the validator will cross-check the package's own Neutral Master files
against these exact hashes, recorded here for reference only (not re-measured until the package
arrives):

| Class | SHA-256 (from PR #83's own committed record) |
|---|---|
| Mage | `6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315` |
| Summoner | `731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3` |
| Acolyte | `0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8` |

## When the package arrives

1. Reassemble/verify the ZIP (measure SHA-256, CRC, path traversal, inventory).
2. Extract to a scratch location, run the independent PNG/timing audit (same technique as
   Batch 1 Melee: manual IHDR/IDAT decode + zlib inflate + Paeth unfiltering + fresh SHA-256 for
   every frame; cross-check per-frame hashes/durations/loop flags/impact markers against every
   sidecar; cross-check Neutral Master hashes against the table above).
3. Import byte-for-byte into this directory.
4. Fill in `data/design/class1-motion-batch-2-caster-exact-package-approval-v1.json` and
   `docs/reviews/class1-motion-batch-2-caster-exact-package-approval-v1.md` with real measured
   values (no field left as a placeholder).
5. Run `tools/validate-class1-motion-batch-2-caster-exact-package-approval-v1.mjs` against the
   real import — it is written now, against this expected structure, but will only assert
   real pass/fail once real binaries exist to check.
6. Await the explicit human visual-approval decision before flipping any approval flag.

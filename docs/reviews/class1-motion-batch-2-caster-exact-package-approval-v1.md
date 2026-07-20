# Class 1 Motion Production Batch 2 — Caster Family — Exact Package Approval (Scaffold)

**Status: PENDING_PACKAGE_DELIVERY**

This is a **production scaffold only**. No package has been delivered for Batch 2 (Caster
Family: Mage, Summoner, Acolyte). No hash, approval, or evidence anywhere in this record or its
JSON counterpart is fabricated — every measured field is left explicitly `null`/`NOT_YET_*`
until the real package arrives and is independently verified, following the same discipline as
every prior approval record in this pipeline (Archer, PR #83, PR #86).

## Reference pipeline (read-only, not modified by this scaffold)

| | |
|---|---|
| Archer Pilot Acceptance | `data/design/archer-pilot-acceptance-record-v1.json` |
| PR #83 — Class 1 Neutral Master Batch v1 Exact Package Approval | authoritative Neutral Master source for Mage/Summoner/Acolyte |
| PR #86 — Class 1 Motion Production Batch 1 (Melee Family) Exact Package Approval v1 | established import/validation pattern this batch reuses exactly |

## Expected roster and motion set

| Class | Neutral | Idle | Move | Basic Attack |
|---|---|---|---|---|
| Mage | 1 static frame | 8 frames | 8 frames | 8 frames |
| Summoner | 1 static frame | 8 frames | 8 frames | 8 frames |
| Acolyte | 1 static frame | 8 frames | 8 frames | 8 frames |

**Skill/Cast: NOT INCLUDED** in this batch.

72 total animated motion frames expected (24 per character) + 3 Neutral Master references.

## Neutral Master lineage (already approved — reference only, not re-imported by this scaffold)

Mage, Summoner, and Acolyte Neutral Masters are already exact-approved in PR #83. Recorded here
for future cross-check only — read directly from PR #83's own committed record, not re-measured
(there is nothing to re-measure yet):

| Class | SHA-256 (from PR #83) |
|---|---|
| Mage | `6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315` |
| Summoner | `731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3` |
| Acolyte | `0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8` |

## Import location (prepared, empty pending delivery)

`docs/assets/review/character-production/class-1-motion-batch-2-caster-v1/` — contains only a
`README.md` describing the expected structure (mirroring Batch 1 Melee's proven layout). No
artwork, sidecar, or evidence file exists there yet.

## Runtime Integration — not started, plan documented only

`runtimeIntegrationAuthorized` remains `false`. If/when a future, separate, explicit gate
authorizes it, the expected approach mirrors the Archer pilot pattern exactly: an additive
per-file variable-duration animation path gated strictly on each character's own sprite key,
zero change to the existing fixed-duration sheet system, plus a narrowly-scoped non-gameplay
test hook for deterministic evidence capture. **No `src/` file is touched by this scaffold.**

## Board Preview / Runtime synchronization — unchanged

- Board Preview: **`DEFERRED_UNTIL_AFTER_DEMO`** (carried forward from PR #83/#86)
- Runtime attack-speed synchronization: **`PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION`**
  (carried forward from PR #86; no timing data exists yet to evaluate)

## Approval flags — all remain false

```
humanVisualApproval: false
motionProductionApproved: false
exactPackageApproved: false
canonicalApproved: false
runtimeIntegrationAuthorized: false
runtimeIntegrated: false
merged: false
```

## Validator

`tools/validate-class1-motion-batch-2-caster-exact-package-approval-v1.mjs` — written now against
the expected structure above (same PNG-decode/hash-rederivation technique as Batch 1 Melee's
validator), but since no import exists yet, it currently only validates the scaffold record's own
shape and flag values and reports `SCAFFOLD_READY`. It will assert real pass/fail once the real
package is imported.

## Validation (actually run, scaffold-scope only)

- `node --check` on the new validator — pass
- `node tools/validate-class1-motion-batch-2-caster-exact-package-approval-v1.mjs` — exit 0,
  `SCAFFOLD_READY`
- `git diff --check` — clean
- ZIP/PNG/frame/timing verification: **not applicable** — no package delivered, nothing to
  measure; not fabricated

## Scope

New files only: this record, the approval JSON, the import-location README, and the validator.
No existing repository file modified. No artwork generated or regenerated. No motion produced.
No `src/` or runtime file touched. No gameplay changed. No PR merged. PR #82, #83, #84, #86
untouched.

## Next step

Deliver the Class 1 Motion Production Batch 2 (Caster Family) human-review package. This record
and its JSON counterpart will then be filled in with real measured values, following exactly the
process used for Batch 1 Melee.

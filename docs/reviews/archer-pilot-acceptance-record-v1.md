# Archer Pilot Acceptance Record v1

**Status: ARCHER_PILOT_ACCEPTANCE_RECORDED**

Additive record only. This document records the user's Pilot Acceptance decision for PR #82 —
it does not modify runtime code, asset binaries, animation data, or any prior evidence file, and
does not itself re-derive or re-validate the underlying runtime work.

## Human decision (authoritative)

**HUMAN_PILOT_ACCEPTED**

Approved by the user after:
1. Independent Final Delta Re-Audit
2. `READY_FOR_HUMAN_PILOT_ACCEPTANCE` recommendation

## Referenced PR (verified live before this record was created)

| | |
|---|---|
| PR | #82 — "Archer v3.2 — Runtime Integration, x4 Validation & Pilot Acceptance Candidate" |
| Branch | `cc/archer-v3-2-runtime-integration-v1` |
| Head SHA at acceptance | `19f8ffe0d5c7d9970b1e3435697efb84885535ec` — **exact match**, re-verified live via GitHub before this record was written |
| State | open, **Draft**, unmerged, `mergeable_state: clean` |
| Lineage drift | none detected |

## Rework chain this acceptance covers

| Rework | Commit | Fixed |
|---|---|---|
| Base runtime integration | `44d706370fca9b88db944a9003f6fcfb107834f2` | hero.archer motion package wired into the actual runtime (additive, per-file variable-duration animation path) |
| v1 | `f84b0f50407503e7da93ce162b1b28e86da34310` | repeated-attack visual acknowledgment (cap=1 replay queue) |
| v2 | `187108ac4d74b0edcbf8708a3588c6d87f3bdb84` | acknowledgment coverage gap under sustained fire (two-tier queue + overflow flash, proven mathematically and by trace) |
| v3 | `19f8ffe0d5c7d9970b1e3435697efb84885535ec` | visual-feedback ownership conflict (separate ack-glow channel) + Archer runtime state not reset on wave transition (proven via the real production path) |

## Approval flags

```
pilotAccepted: true
canonicalApproved: false
finalRuntimeApproved: false
merged: false
```

Canonical promotion and final runtime approval each remain separate, explicitly
user-authorized gates — not granted by this record.

## Retained limitations

- No projectile/VFX system exists for any unit in this codebase; Release-frame synchronization
  was verified via direct frame-timing rather than a projectile-spawn event.
- Regression testing throughout the runtime-integration and rework chain used a single
  **representative** non-Archer unit (Sniper in the base candidate; Swordman in reworks v1–v3)
  on the original, unmodified sheet-based animation path — not a full-roster regression sweep.
- Browser/device coverage is limited to Chromium/Blink in this environment's headless container;
  WebKit/Gecko and real mobile-device hardware were never exercised.
- Board Preview remains **`DEFERRED_UNTIL_AFTER_DEMO`** — recorded separately in the Class 1
  Neutral Master Batch v1 exact-package approval (PR #83,
  `docs/reviews/class1-neutral-master-batch-exact-package-approval-v1.md`); not regenerated, not
  revisited, not affected by this Pilot Acceptance.
- Canonical approval has not yet been granted.
- Final runtime approval has not yet been granted.

(The base candidate record's remaining limitations — vendored THREE.js r128, the x4 Release-frame
display-sampling characteristic, Idle/Move facing-flip gap, Wave 1 "Slime" placeholder sprite, and
the structural rate-mismatch addressed by rework v2 — also carry forward unaffected; see
`data/design/archer-pilot-runtime-acceptance-candidate-v1.json#limitations` for the full text.)

## Prohibitions held

No runtime modified · no assets modified · no animation regenerated · no evidence regenerated ·
no gameplay changed · no replacement PR created · not merged · no auto-merge enabled ·
`canonicalApproved` not set true · `finalRuntimeApproved` not set true.

## Validation (actually run)

- `node tools/validate-archer-pilot-acceptance-record-v1.mjs` — validates JSON structure/flag
  values and cross-checks the recorded head SHA against the live-verified value
- `node --check` on the new validator — pass
- `git diff --check` on the commit — clean
- Runtime/asset/animation validation: **not applicable** — no such file was touched by this task

## Scope

New files only: this record, the JSON record, and the validator. No existing repository file
modified. PR #82 itself is untouched (no push to its branch, no comment required by this task).
No merge performed anywhere.

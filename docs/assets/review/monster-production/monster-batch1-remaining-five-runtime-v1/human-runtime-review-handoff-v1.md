# Monster Demo Batch 1 — Remaining Five — Human Runtime Review Handoff

**Status: AWAITING_HUMAN_RUNTIME_REVIEW.** This handoff does not itself constitute approval.

## What to review

- `screenshots/x1_<Monster>_*.png` and `screenshots/x4_<Monster>_*.png` — 5 states ×
  5 monsters × 2 speeds (Slime, OrcBrute, StoneWolf, SpiritArcher, Golem).
- `screenshots/mixed_monster_scene.png` — all 5 monster types rendered together.
- `runtime-integration-report-v1.md` — what changed, shared architecture, asset registration.
- `validation-report-v1.md` — full validation results (state cycle, transitions, death lock,
  fallback, multi-unit/disposal, performance).

## State transition summary

Idle ↔ Move (follows existing `u.moving` flag) → Attack (one-shot, resumes Idle/Move) → Hit
(one-shot, interrupts Idle/Move/Attack, resumes Idle/Move) → Death (one-shot, terminal, locks
out all further triggers). Identical contract to the already-approved Skeleton Runtime Pilot,
extended to Slime, Orc, Stone Wolf, Spirit Archer, and Golem via one shared, data-driven
implementation.

## Review criteria

- [ ] State readability (Idle/Move/Attack/Hit/Death each read clearly per monster)
- [ ] Correct looping behavior (Idle/Move loop; Attack/Hit/Death do not)
- [ ] Attack completion (returns cleanly to Idle/Move)
- [ ] Hit interruption (reads as a reaction, not a re-attack)
- [ ] Death lock (no revival, corpse holds before the generic fade)
- [ ] Orientation stability (no popping, no scale-inversion — no flip is applied, matching
      the Skeleton precedent)
- [ ] Board-scale readability (each monster reads clearly at actual board scale, including
      Golem's larger sprite plane)
- [ ] No visual popping
- [ ] No Runtime regression (Skeleton, heroes, other systems look and behave as before)

## Known limitations

- RuntimeFlipX recommended by all five monsters' metadata but not applied (see reports) —
  intentional, matches Skeleton precedent, not a defect to fix in this pass.
- Spirit Archer's Basic Attack has no on-attacker "impact" pose (ranged; impact occurs at
  the target) — this is expected, not a missing frame.

## Approval flags (all default false — set only by explicit human decision)

| Flag | Value |
|---|---|
| `humanRuntimeApproval` | **false** |
| `runtimeIntegrated` | **true** — code is integrated and validated in this pilot; does not itself mean human-approved |
| `canonicalApproved` | **false** |
| `merged` | **false** |

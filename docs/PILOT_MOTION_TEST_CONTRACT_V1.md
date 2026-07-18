# Pilot Motion Test Contract v1

Status: **motion_test_contract_pending_production**. `canonicalApproved: false`.

Production contract for the **first three motion tests** so the next round can produce real
animation frames without guessing timing, frame counts, anchors, or file formats. The user has
approved the reference **designs** for all three pilots; that approval covers the designs only —
no generated frame becomes canonical until explicit exact-file approval.

This round produces **no artwork, no animation, and no runtime integration** — contract, data,
and validator only.

## The three locked motion tests (exactly these, no others)

| Unit | State | Loop | FPS | Frames (min / target / max) | ~Duration | Event marker |
|---|---|---|---|---|---|---|
| `hero.archer` | `attack` | non-loop | 12 | 8 / **10** / 12 | ~0.83 s | `projectileRelease` @ 0.55 |
| `monster.slime` | `move` | seamless loop | 12 | 8 / **8** / 10 | ~0.67 s/cycle | `footstepCue` @ 0.70 |
| `monster.golem` | `attack` | non-loop | 12 | 8 / **12** / 12 | ~1.0 s | `impactCue` @ 0.58 |

Frame budgets sit inside the Production Pack v2 `frameTargets` ranges (attack 8–12, move 8–10).
Event markers are normalized 0..1 times using the PR #23 framework's marker vocabulary
(`projectileRelease`, `impactCue`, `skillFlashCue`, `footstepCue`, `deathDissolveCue`) — visual
cues only; they never delay, advance, or replace Combat timing or damage.

## Common contract (applies to every frame of every test)

- FPS default **12**; accepted range **[8, 15]**.
- **Transparent background** in every frame.
- **Consistent canvas per asset**: identical canvas size, aspect, character scale, and framing
  for every frame of one test.
- **No cropping** of silhouette, weapon, bow, quiver, horn, crystal, limbs, or cape.
- **Camera locked**: no movement, zoom, framing, or perspective change between frames; the 3/4
  front view of the approved reference design is fixed.
- **No motion blur** that breaks silhouette readability (small painted smears allowed only if the
  silhouette stays fully readable at mobile size).
- **Reference design lock**: costume, colors, weapon, face, hair, and body proportions match the
  approved reference designs exactly in every frame.
- **Anchor lock**: the foot anchor stays at the same normalized canvas position in every frame —
  Archer `[0.5, 0.92]`, Slime `[0.5, 0.90]`, Golem `[0.5, 0.94]`.
- **Facing**: single-direction art; runtime flipX handles the mirror (never author mirrored
  duplicates).

## Naming, numbering, metadata

- Frames: `assets/units/{unitId}/{state}/{unitId}_{state}_{frameIndex}.png`
- Sheets: `assets/units/{unitId}/{unitId}_{state}_sheet.png`
- `frameIndex`: zero-padded three digits starting at `000` (e.g. `archer_attack_000.png`).
- Sidecar metadata (one per test): `assets/units/{unitId}/{unitId}_{state}_motiontest.json` with
  `unitId, state, fps, frameCount, loop, anchor, canvas, eventMarkers, rootMotion` — only fields
  the PR #23 manifest already understands; no new schema.

## Canvas / export

The framework does not lock pixel dimensions, so sources are **resolution-independent** with a
recommended working canvas per asset (aspect locked to the PR #23 runtime frame aspect):

| Asset | Aspect | Recommended working canvas | Max source | Battle export |
|---|---|---|---|---|
| Archer | 2:3 | 640 × 960 | ≤1024 px | ≤512 px longest side |
| Slime | 1:1 | 800 × 800 | ≤1024 px | ≤512 px longest side |
| Golem | 6:7 | 864 × 1008 | ≤1024 px | ≤512 px longest side |

Runtime display scale is owned by the PR #23 manifest (`world.scale`), never by file dimensions.
Working canvas and battle export are separate outputs. No binary artwork exists in this PR.

## Per-test direction

### Archer — Attack (one bow shot, non-loop)

Key poses in order: `combat_idle_start → raise_bow_and_nock_arrow → draw_full_tension → release →
recoil_follow_through → return_to_combat_idle`.

- Anticipation: raise + nock + draw; full-tension holds ≥1 full frame so the draw reads at 12 FPS.
- Action: the **release frame** (marker `projectileRelease` @ 0.55) — string returned, arrow gone.
- Recovery: small recoil, settle into the exact starting idle (clean final frame, no pop vs idle).
- Anchor: both feet planted the whole shot — no step, hop, or travel.
- Forbidden: baked projectile/trail/impact in body frames; **no runtime projectile logic this
  round**; no design deviation; no crossbow-style motion.

### Slime — Move (one bounce cycle, seamless loop)

Key poses in order: `rest_shape → squash_prepare → stretch_lift → travel_apex → landing_contact →
squash_absorb → recover_to_rest_shape` (loop seam matches frame 0).

- Anticipation: volume-preserving squash before lift-off.
- Action/travel: stretch-lift → airborne apex → landing contact (marker `footstepCue` @ 0.70).
- Recovery: absorb squash → rest shape; the cycle must repeat with no visible pop.
- **Produced in-place**: no net horizontal displacement baked across the cycle; ground contact
  returns to the exact anchor every cycle. If any root motion is authored it must be declared as
  explicit per-frame offsets in the sidecar `rootMotion` field. **World-space movement is owned by
  the runtime** (PR #23 framework + game movement), never by the frames.
- Forbidden: baked board travel, anchor drift, design deviation, attack/damage visuals in the
  move cycle.

### Golem — Attack (one heavy melee strike, non-loop)

Key poses in order: `combat_ready_stance → weight_shift_windup → arm_raise_peak → impact_contact →
follow_through_weight → recovery_to_ready_stance`.

- Anticipation: slow, heavy loading (wind-up + raised peak held ≥1 full frame) that reads as mass.
- Action: a single unmistakable **impact/contact frame** (marker `impactCue` @ 0.58).
- Recovery: weighted follow-through, controlled return to the exact ready stance.
- Anchor: feet planted; torso/arm carry the weight — no step or lunge.
- Forbidden: baked VFX (dust/debris/shockwave/glow) in body frames; **no hitbox, damage, or
  gameplay logic this round**; no design deviation; no fast ninja-like swing.

## Acceptance checklist

Exactly three tests; transparent background everywhere; identical canvas per test; anchors exact
with zero drift; frame counts within min/max; one event marker per test at the declared time;
loops seamless / non-loops end clean; designs match the approved references; sidecar metadata
present; `canonicalApproved` stays `false` until exact files pass in-game visual review.

## Explicitly deferred

Full six-state production for all pilots · the Arena Ruins in-game runtime test of produced
frames · runtime integration · projectile/hitbox/damage/VFX runtime changes · Slime/Golem
reference-design specification documents · shop cards · Map 2–3 assets · final canonical approval.

## Files

| File | Purpose |
|---|---|
| `data/design/pilot-motion-test-contract-v1.json` | Machine-checkable contract. |
| `tools/validate-pilot-motion-test-contract-v1.mjs` | Enforces the contract (test list, FPS, anchors, frame budgets, loop policy, key poses, unique markers, canvas rules, status, deferred scope). |
| `docs/PILOT_MOTION_TEST_CONTRACT_V1.md` | This document. |

## Validation

```
$ node tools/validate-pilot-asset-production-pack-v2.mjs
Pilot asset production pack v2 validation passed.

$ node tools/validate-archer-reference-design-v1.mjs
Archer reference design v1 validation passed.

$ node tools/validate-pilot-motion-test-contract-v1.mjs
Pilot motion test contract v1 validation passed.
```

## Verdict

Motion Test Contract v1 is complete and consistent with the Production Pack v2 frame ranges, the
PR #23 anchors/FPS/marker vocabulary, and the approved reference designs. Next round (out of
scope here): Coco produces the three motion tests against this contract, then routes the exact
frames to the user for review — nothing becomes canonical before that approval.

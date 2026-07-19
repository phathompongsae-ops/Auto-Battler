# Archer Attack v3 — Pose-Guided Production Handoff

**Status**: BLOCKED in this environment — no pose-generation capability (PIL+numpy only). This package is the complete, ready-to-execute spec for producing Attack v3 outside this environment (or via user-supplied frames), following the escalation decision recorded after Attack v2's FAIL.

**Machine-readable spec**: `data/design/archer-attack-v3-pose-guided-handoff-package-v1.json` — that file is the source of truth; this README is a summary.

## Why v3 exists

- Attack v1 (PR #67): rejected — NEAR_STATIC.
- Attack v2 (PR #72): rejected — torn-bow defect in frames 002–004, and root-cause analysis proved there is **no draw motion beneath the defect** (frames byte-identical to frame 001 outside the torn region). Evidence: `docs/reviews/archer-v2-defect-analysis/`.
- Conclusion: a real draw is a limb **re-pose**, impossible via deterministic pixel displacement. v3 must be produced by pose-guided generation / rigged key-pose reconstruction.

## What to produce

10 RGBA PNGs, 640×960, transparent background, named `hero.archer_attack_000.png` … `_009.png`:

| # | Pose | One-line spec |
|---|---|---|
| 000 | Ready | Bow angled up from rest, right hand reaching to string |
| 001 | Nock | Bow toward horizontal, right hand nocking at string |
| 002 | Raise | Bow arm extending, shoulders rotating into stance |
| 003 | Mid Draw | String pulled ~30–40%, right elbow bending back |
| 004 | Deep Draw | String ~70%, right hand near jaw, bow flexing |
| 005 | **Full Draw** | Most distinct silhouette: arm extended, hand at cheek, max flex |
| 006 | **Release** | String snapped straight, hand past cheek — sharpest change; `projectileRelease` binds here |
| 007 | Follow-through | Arms relaxing, weight settling |
| 008 | Recovery | Bow lowering toward rest |
| 009 | Neutral exit | Match approved Neutral Master (byte-exact if possible) |

**Identity is locked** to the approved Neutral Master (`docs/assets/review/character-production/archer/master-v1/archer-production-master-candidate-v1.png`, SHA `4911e7e3…3013`): same face, green hair, gold-trimmed hood, elf ears, green/gold costume, ornate golden recurve bow. Clean v2 frame 001 (`a15f1927…`) is a secondary raise-pose reference. Full identity + negative constraint lists are in the JSON.

**Timing**: 12 FPS recommended (10–15 allowed if declared); `loop=false`; anchor `[0.5, 0.92]`; feet planted at baseline y≈854 (±6 px — the old byte-identical feet pin is explicitly replaced for generated frames, see JSON `feetPolicy`).

**Hard NOs**: torn/floating bow, missing hands, near-duplicate draw frames, VFX/motion blur baked in, background pixels, any identity/costume/bow redesign, arrow visible after release.

## On delivery

Import via the established user-supplied frame pattern; run the import validation plan in the JSON (integrity, hashes, bounds, foot baseline, honest draw-progression metrics derived from the delivered frames, sidecar/source-map, human identity check). All approval flags stay `false` until human visual PASS + exact-file approval.

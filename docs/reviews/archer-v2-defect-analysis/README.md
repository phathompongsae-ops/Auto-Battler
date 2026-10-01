# Archer Attack v2 — Draw-Phase Defect Root-Cause Analysis

**PR**: #72 · **Branch**: `cc/archer-attack-v2-production-v1` · **HEAD at investigation**: `879d75f`
**Human review verdict**: FAIL (frames 002–004: torn bow / missing grip hand / bow floating)

## TL;DR

The reported defect is real and lives in the source PNGs. But investigation found something more fundamental: **there is no draw motion underneath the defect.** Outside the torn-bow region, frames 002/003/004 are **byte-identical to clean frame 001**. The bow-tearing warp is the *entire* content of the draw phase.

Therefore the defect cannot be "patched" into a good draw:
- **Remove the tear** → frames collapse to exact copies of frame 001 → static draw + five identical frames (NEAR_STATIC, the exact reason Attack v1 was rejected).
- **Keep a warp large enough to read as a draw** → that warp is precisely what tears the bow.

Per user decision, we **escalated** instead of shipping a static/duplicate "fix". Production frames 002–004 are **left untouched**.

## Evidence

| | |
|---|---|
| Defect in source (not contact-sheet) | Confirmed by opening `hero.archer_attack_002/003/004.png` directly |
| Damage bounding box (vs frame 001) | `x[250–560] y[123–599]` (upper-right quadrant: bow, right arm, cape) |
| Changed pixels OUTSIDE that region | **0** for all of 002, 003, 004 → body is fully static |
| Deterministic clean-restore result | 002/003/004 become **byte-identical to frame 001** |

See `archer-v2-drawphase-defect-evidence.png` — top row is the torn draw-phase frames; bottom row is frame 001, which is exactly what they collapse to once cleaned.

## Root cause

The v2 method (`tools/generate-archer-attack-v2-articulated-v1.py`) geometrically displaces Neutral Master pixels in the bow region. Large displacement shears the bow into disconnected blocks and detaches its upper limb without producing any coherent limb re-pose. The standing Neutral Master holds the bow relaxed at the side; a readable archery draw is a genuine **re-pose** (bow arm extends, drawing hand pulls the string to the face) that cannot be produced from the standing asset by pixel displacement — any displacement big enough to read as a draw is what tears the bow.

## Recommended next method

**Pose-guided regeneration / rigged key-pose reconstruction** — preserve approved Archer identity, but do NOT lock the body pose; build distinct readable key poses (ready → raise → nock → draw-mid → full-draw → release → follow-through → recovery → neutral exit), keeping canvas/anchor/FPS/marker/feet-pin/frame-9-exit invariants. This needs an image-generation/inpainting capability (not available deterministically here) **or** user-supplied re-posed frames (the same import pattern already used for other characters' motion-test frames).

## Scope / status (unchanged)

- Production frames 002–004: **not modified** (baseline SHA-256 preserved)
- Validator thresholds: **not modified**
- Approval state: `attackPackageApproved` / `canonicalApproved` / `runtimeEligible` / `runtimeIntegrated` all remain **false**
- No PR merged

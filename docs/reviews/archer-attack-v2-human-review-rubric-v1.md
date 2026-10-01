# Archer Attack v2 Human Review Rubric v1

This rubric is for the **user visual approval gate** after CC produces the exact Archer Attack v2 candidate. It does not approve any file by itself.

## Core question

At normal review speed and at gameplay/board scale, can a person clearly see the Archer:

**raise bow → draw → full draw → release → follow-through**

without relying on projectile, trail, impact VFX, labels, debug markers, or frame names?

## Seven review questions

1. **เห็นยกธนูไหม** — Is the bow visibly raised from the ready pose?
2. **เห็นง้างสายไหม** — Can you clearly see the drawing arm/hand pull backward as a bow draw?
3. **เห็น full draw ชัดไหม** — Is the maximum-tension pose obviously distinct from ready and mid-draw?
4. **เห็นปล่อยลูกศรไหม** — Does the release read as an actual release pose change, not a small shake or warp reset?
5. **เห็น follow-through ไหม** — Is there a visible post-release recoil/follow-through pose?
6. **ยังเป็น Archer ตัวเดิมไหม** — Are face, hood, hair, ears, eyes, bow identity, costume, proportions, and rendering language still the approved Archer identity?
7. **ที่ board scale ยังอ่านออกไหม** — On a phone/gameplay-scale preview, is the attack still immediately readable as an Archer bow attack?

## Hard approval rule

Questions **2, 3, 4, and 5 must all be clearly YES**.

If any of questions 2–5 is unclear, subtle, or requires explanation from metadata, the Attack candidate is **not approvable** and must be revised.

A technical validator PASS cannot override a visual NO.

## Identity vs pose

Identity preservation means preserving:

- face identity
- green hood and green hair
- pointed ears and green eyes
- ornate green/gold bow identity
- green/gold costume design
- approved chibi proportions and rendering language

It does **not** mean preserving the Neutral body pose.

Arms, shoulders, elbows, forearms, hands, torso, bow orientation, and in-place stance must be free to articulate enough to make the attack readable.

## Evidence to review

CC should provide at minimum:

- 10-frame contact sheet
- 12 FPS sequence preview GIF
- board-scale preview GIF or sample sequence
- full-draw diagnostic: ready/neutral vs full draw
- projectileRelease diagnostic: full draw vs actual release frame
- old CLEAR vs rejected v1 NEAR_STATIC vs v2 comparison contact sheet/GIF when feasible

The comparison artifact should make the readability difference obvious on a mobile screen.

## Decision states

- `APPROVE`: only after explicit user approval of the exact v2 candidate files.
- `REVISE`: any required motion phase is unclear, near-static, or pose-locked.
- `REJECT`: identity drift or motion method fundamentally fails the articulated bow-attack requirement.

Until explicit approval:

- `attackV2PackageApproved=false`
- `canonicalApproved=false`
- `runtimeEligible=false`
- `runtimeIntegrated=false`

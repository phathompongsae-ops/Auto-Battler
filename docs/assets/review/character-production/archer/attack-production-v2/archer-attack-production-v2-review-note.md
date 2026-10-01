# Archer Attack v2 — Fast Human Review Note

**For**: PR #72 (`cc/archer-attack-v2-production-v1`)
**Purpose**: Observation aid only. Does **not** state a PASS/FAIL verdict — that decision belongs to the human reviewer.

---

## Open this first

1. **`archer-attack-production-v2-playback-preview.gif`** — full 10-frame sequence, looping, exact source timing. Open this first; it's the fastest way to judge motion.
2. **`archer-attack-production-v2-contact-sheet.png`** — all 10 frames side by side if you want to freeze-frame compare instead of watching the loop.

Both are built from the unmodified production PNGs in `assets/units/hero.archer/attack-chibi-v2/` — same pixels, only composited onto a neutral gray backdrop so the transparent PNGs render visibly.

---

## Frame ranges (semantic labels, for orientation only)

| Frames | Intended phase | Notes |
|---|---|---|
| 000 | Ready / start | — |
| 001–002 | Raise / nock | frame 001 is byte-identical to frame 006 (see below) |
| 003–004 | Draw progression → full draw | frame 004 is the intended full-draw extreme |
| 005 | **Release** | `projectileRelease` event marker fires here (normalizedTime 0.55) |
| 006–007 | Follow-through | frame 006 is byte-identical to frame 001 |
| 008 | Recovery | byte-identical to frame 000 |
| 009 | Exit | byte-identical to the approved Neutral Master (by design — this is the intended clean loop-out) |

These labels come from the production script's intended pose curve, not from independent motion detection — treat them as orientation, not proof the pose reads that way on screen.

---

## Duplicate-hash frames (factual, re-verified just now)

Exact SHA-256 comparison of the current 10 PNGs on disk:

- **Frame 000 and frame 008 are byte-for-byte identical** (same file content, not just visually similar).
- **Frame 001 and frame 006 are byte-for-byte identical.**
- **Frame 009 is byte-for-byte identical to the approved Neutral Master** — this one is intentional (documented exit condition), not a defect.

The 000/008 and 001/006 duplication is stated here as a plain fact from hashing the files. It is **not** being interpreted as good or bad — only that if you notice frames 6 or 8 looking exactly like an earlier frame, that's confirmed, not your eyes playing tricks.

---

## Things worth looking at while you watch the loop

These are neutral observation prompts, not conclusions:

- **Pose readability** — does frame 000 read clearly as an Archer at rest with a bow?
- **Draw progression (000→004)** — does the drawing arm/hand appear to move back and the bow appear to bend, or does the pose look mostly static across these frames?
- **Release clarity (004→005)** — is there a distinct visual "snap" at frame 005, where the marker says the projectile releases?
- **Repetition** — frames 006 and 001 being identical means the follow-through pose exactly re-shows the raise pose; frame 008 being identical to frame 000 means recovery exactly re-shows the start pose. Does that read as a natural mirrored return, or as a hold/repeat?
- **Silhouette** — at a glance (not reading pixels, just outline), can you tell this is a nocking/drawing bow motion versus a generic idle-with-bow-in-hand pose?

---

## What this note is not

- Not a PASS/FAIL verdict.
- Not a claim that "pixels moved therefore the motion is good."
- Not a claim that duplicate/near-duplicate frames are acceptable or unacceptable — that's a judgment call for the reviewer.

---

## Cross-reference

A more detailed, previously-generated assessment (7-question visual gate checklist, per-transition MAE metrics, technical validator results) is available at:
- `docs/reviews/archer-v2-final-visual-review.json`
- `docs/reviews/ARCHER-V2-FINAL-STATUS-REPORT.md`
- `docs/reviews/archer-v2-review-artifacts/` (earlier GIF/contact-sheet/diagnostic set, same source frames, different backdrop/crop treatment)

Those documents already reached a MARGINAL/PARTIAL assessment using automated heuristics. This note exists only to give a faster path to a human eyeball verdict, using the same untouched frames.

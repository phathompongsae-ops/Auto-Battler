# Next monster: Crypt Lord production prep

Read-only technical brief, audited2026-10-11 at `037b89b1`.
Generation is NOT authorized by this document alone. Brute remains locked.

Production follow-up (2026-10-11): the explicitly authorized Lord generation task
is documented in [Crypt Lord production animation](crypt-lord-production-animation.md).
The five-state set now replaces the procedural Lord presentation; this brief remains
the original contract reference.

## Why Lord next

Lord is the tutorial's final boss and the Lv20 Crypt focal encounter. Its idle
identity is already approved, while every movement/attack reaction still uses
procedural presentation. It has the largest screen presence, a dangerous
telegraph that needs readable poses, and a complete pending runtime contract.
This removes a high-impact mismatch without adding enemies or changing systems.
Guardian follows; Knight/common Skeleton occur often but need new contracts first.

## Identity lock and references

- Keep the approved `public/assets/monsters/crypt_lord.png` character: large pale
  chibi face with red eyes (not a bare skull), swept pale hair, dark blue steel and bronze/gold armour, pointed
  crown/helmet, skull ornament, purple cloak, same broad sword and proportions.
- Boss hierarchy: above Crypt Knight/Brute; do not replace it with a generic
  realistic Death Knight. Elevated oblique east-facing view; mirror west at runtime.
- Preferred high-resolution reference: `art-source/candidates/demo-v1-20261007/sources/D8-crypt_lord_idle.png`, selected
  by `tools/env-art/pass2-jobs.json`.
  Resolve that job, not a visually similar third-party pack. The fitted idle is
  an approved identity reference, not an exact action-canvas template.
- Modern illustrated chibi MMORPG: clean coloured outlines, simplified material
  planes, soft2–3 shading bands, upper-left lighting, mobile-readable palette.
  No pixel-art texture, gore, realistic anatomy, redesign, UI/text/background.
- Across all frames: same head size/crown/hair/armour/cloak/sword; no costume or
  weapon mutation, floating feet, cropping, baked shadow or opaque matte/halo.

## Exact runtime contract

Source: `src/data/monsterAnimArt.ts`, `src/data/skillData.ts`,
`src/rendering/monsterAnimState.ts`, `src/rendering/MonsterAnimator.ts`.

| State | Frames / fps | Final strip | Required pose order |
|---|---|---|---|
| idle |2@3 |448×192 | Subtle grounded breathing; stable baseline |
| walk |8@8 |1792×192 | Full readable weight-bearing foot cycle, restrained heavy bob |
| attack |5@12 |1120×192 | **Frame0 contact**, then follow-through/recovery; no pre-contact wind-up |
| special |10@12 |2240×192 | Raise3, hold2, impact2, recovery3 |
| hit |3@15 |672×192 | Brief restrained recoil; no launch/ragdoll |

All cells224×192. Feet row190: nominal lowest visible row189, rows190–191
fully transparent. Standing-height band150–168 source px in idle/walk. Empty
headroom is for weapon/cloak motion, not a larger character. Centre planted feet;
preserve one scale/root across strips, leaving clear side/top margins. Prefer
source contact sheets with a unchanged idle anchor figure for fitting, following
Brute's source-to-fit pipeline; raw sources may be larger than runtime cells.

Runtime draw scale0.5 (home tier2.5); standing height75–84worldpx, approximately
124–139screenpx at1.65. Feet line remains actor y+32.5worldpx (13×2.5). The render origin is
computed from feet row and tier feet offset; do not use simple bottom-centre
without that offset. Body50×30worldpx from(-25,+5), hit radius24 remain unchanged.

Grave Slam (`crypt_slam`, `crypt_slam_story`) has **1100ms game-time wind-up**.
Raise occupies first250ms at12fps. Frames3–4 loop through the rest of wind-up.
First impact is frame5 at exactly1100ms, then frame6; recovery frames7–9.
Thus ten artwork frames do NOT mean a fixed833ms special: runtime extends hold
to the actual telegraph. Basic contact begins on skill-use/damage tick; five
frames total416.67ms. Hit strip lasts200ms; it never cancels a basic/special.
Do not synchronize damage to invented art markers or change cooldown/radius.

Candidate staging proposal: `art-source/candidates/pass-4c-crypt-lord/` (new folder).
Later final runtime paths: `public/assets/monsters/crypt_lord/{idle,walk,attack,special,hit}.png`.
Status stays `pending` until all five are accepted and separately integrated.

## Generation sequence and acceptance

1. Idle/identity candidate using the approved project source. Judge against
   Warrior, Knight and locked Brute; lock one identity before other states.
2. Walk; verify actual stepping, no duplicated idle poses and stable scale.
3. Basic attack contact-first; sword arc remains inside224px width.
4. Special segments, preserving sword/head/root. Held pair must loop seamlessly;
   impact is a grounded slam, not a whole-body leap or a baked telegraph.
5. Hit, then a cross-strip identity/contact-sheet review.

Use the built-in image generator only when explicitly requested; retain prompts,
selected raw sources, fit specs and measurements. CC fits/validates/ integrates.
Use `tools/monster-art/stripMetrics.mjs` for exact width/count, alpha>=32 bounds,
standing height and edge clearance; additionally inspect ALL alpha in bottom rows
and feet/root alignment. Its default6px walk-foot tolerance is weaker than nominal
row189 alignment, so record any accepted raised-foot deviations explicitly.
Visual review must verify actual feet, since cape/sword tips can confuse alpha
centroids. Preserve alpha on premultiplied resampling; no background painted in.

## Integration audit / risks

- Existing generic five-state system is sufficient. No broad refactor first.
  `graphics/monsterArt.ts` accepts complete integrated sets; partial/missing sets
  fall back to the approved idle. Do not remove fallback PNG.
- `MonsterAnimator` uses game clock; wind-up/impact follow skill events. Hit is
  lower priority than actions; death keeps last pose with existing squash/fade.
- Monsters with strips disable `MonsterMotion`; do not add procedural motion on
  top of real animation. Runtime mirrors east without separate left sources.
- Cell sizes are data-driven, not hardcoded64². New headroom is safe only if fitted
  scale/feet origin and compensation keep physics bodies identical.
- Largest special is 2240×192 (~1.64 MiB decoded RGBA). Full five-strip set contains
  6272×192 pixels (~4.59 MiB before GPU overhead). Check hardware texture limits,
  caching/object stability and p95; no per-frame allocations/tweens or new loader.
- No save change: animation is derived presentation. Pending→integrated is art
  data only; preserve gameplay stats, AI, aggro, telegraphs/gates/checkpoints.
- After future integration: unit strip contracts/alpha, generic animation browser
  tests and Lord real fights with both Story/Lv20 skills, mirror directions,
  hit/attack priority, death, missing-strip fallback, body/shadow equivalence,
  960×540/844×390/640×360 screenshots and warm/cold performance. Brute regression
  remains required. Do not treat old screenshot geometry as a new test result.

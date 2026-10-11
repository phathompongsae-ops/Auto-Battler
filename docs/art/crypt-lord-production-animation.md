# Crypt Lord production animation — Pass 4B

2026-10-11. Started on `phaser-rebuild` at `fb00b9a5`. Lord-only production pass;
Skeleton Brute is locked, Guardian remains pending. No gameplay logic, balance,
geometry, camera or HUD changes.

## Accepted identity and artwork

Authoritative source: approved project-generated `D8-crypt_lord_idle.png`, selected
by the Pass 2 jobs registry, copied unchanged into the provenance archive.
The Lord has a smooth pale chibi face/red eyes, ivory swept hair, bronze spiked
crown/blue diamond, navy plate/goldbronze trims, skull pauldron, purple cape and
broad steel sword. It is not a bare-skeleton redesign. Idle reuses the approved
source; four accepted action sheets were generated with built-in `image_gen`.
Two earlier special sheets were rejected for shrinking the body when raising
the sword. The replacement uses a restrained over-shoulder raise and consistent
head/body scale, with a readable crouching downstroke. No baked VFX or shadow.

All five states passed source, contact-sheet, hierarchy, alpha and pending-runtime
review before setting only Lord's contract to `integrated`.

| State | Frames / fps | Final PNG size | Visible height (px) | Verdict |
|---|---|---|---|---|
| idle | 2 / 3 | 448×192 | 155–159 | PASS |
| walk | 8 / 8 | 1792×192 | 151–158 | PASS |
| attack | 5 / 12 | 1120×192 | 136–159 | PASS, contact-first |
| special | 10 / 12 | 2240×192 | 118–167 | PASS, raise3/hold2/impact2/recovery3 |
| hit | 3 / 15 | 672×192 | 143–155 | PASS, restrained recoil |

Canonical paths: `public/assets/monsters/crypt_lord/STATE.png`. Cells 224×192;
every visible alpha-bound bottom is row 189, all alpha in rows 190–191 is zero,
no edge contact/cropping. Idle/walk meet 150–168. One fitting scale per source
sheet, never independent frame resizing. Selected connected-alpha components
isolate neighbouring swords/capes where their bounding rectangles overlap.
Premultiplied area resampling retains antialiasing and discards faint matte haze.

True-world-scale lineup: Skeleton < Brute < Knight < Lord. Lord's standing art
is 75.5–79.5 world px, above Knight, within its established boss band. Sword tips
make lowest-alpha-band centroids misleading; feet/root review used the actual
boots, shadow and both facings. Pose excursion is visual and does not alter bodies.

## Runtime and QA

Generic MonsterAnimator only; no new special case. East source, mirrored west,
fixed origin [112,125], draw scale 0.5, no procedural motion layered onto strips.
Body is unchanged [-25,+5,50,30], hit radius 24, shadow/feet line +32.5 world px.
Camera remains 1.65. Idle, walking, contact, hold, impact and hit were reviewed
in the runtime while the contract was still pending.

The dedicated `--lord-review` suite checks normal loading, missing-strip whole-set
fallback to the approved idle, restoration, body equivalence, warmed performance,
real fights on both sides and while circling, action/contact sync, special phases,
legitimate Shift Dodge, death fade and viewport captures at 960×540, 844×390,
640×360. The corrected targeted run passes 24/24. Circling waits for a real basic
attack on each side instead of sampling a fixed interval that can miss one facing.
No existing test was weakened. Generic animation coverage now keeps integrated
Lord/Brute real art and installs fixtures only for pending Guardian.

Basic contact is frame 0 on the gameplay tick. Grave Slam holds frames 3–4 until
the unchanged 1100 ms game-time wind-up, then first impact frame 5 on the damage
tick. Real/fallback slam damage matched at 64 in the controlled RNG fixture;
Dodge produced an explicit miss. Telegraph, Enrage, leash, arena, death and
checkpoint rules retain their existing code. Story/Enrage/retry results are in
Final QA below.

Three viewport reviews keep the Lord, sword and player readable with the existing
HUD. At 640×360, the existing utility cluster overlaps the right edge of the large
telegraph, but does not obscure the boss body or raised weapon. No HUD changes
were made in this Lord-only task.

Warmed four-second fights measured p95 7.1–7.8 ms for strips vs 7.1–7.2 ms fallback;
one strip run had a 48.4 ms maximum while another peaked at 20.8 ms. Texture swaps
were 14 per fight, only on state changes, not each tick; five deliberate restore
requests were the only network requests across repeated resets. No Lord-specific
optimization was warranted by these samples. Five strips add about 4.59 MiB decoded
RGBA before GPU overhead; no new runtime objects/tweens/filters are introduced.

Build at handoff: PASS (existing bundle-size warning). Typecheck, unit and browser
results are in Final QA below.

## Final QA (2026-10-11, working tree on `fb00b9a5`)

Re-run on the unchanged handoff tree, with no file edits during any browser run.

| Check | Result |
|---|---|
| Strip validator (`stripMetrics.mjs … 224 192 190`, idle/walk with `150 168`) | PASS ×5. Heights: idle 159/155, walk 151–158, attack 136–159, special 118–167, hit 143–155. Bottom rows 190–191 have zero alpha at any level; nothing (even alpha 1) touches a cell edge; no hidden RGB under alpha 0; one fit scale per sheet |
| Typecheck (`tsc --noEmit`) | PASS |
| Unit | 613/613 |
| `--lord-review` | 24/24 |
| `--anim-review` (motion, generic strips with Guardian fixtures, Brute, Lord) | 67/67 |
| `--brute-review` | 24/24; Brute assets, source and test byte-identical to `fb00b9a5` |
| `--story-review` (3 real Story Crypt clears) | 12/12. Each clear: 5 Slams telegraphed and dodged, Enrage reached, boss dead, reward once |
| Full default browser suite | 422/422, including Shop, DS-1…11 checkpoints/wipes/retry/fail/re-attempt, SF story feedback, CS-8 Lv20 Enrage |

- Grave Slam: impact at 1104 ms, frame 5 on the damage tick (three samples); damage 64
  real and fallback; Dodge at 850 ms resolves as a miss.
- Basic attacks show contact frame 0 on the damage tick, both facings and while circling.
- Mirroring: flipX tracks the player on the west and east sides; facing changes keep the
  origin fixed.
- Body [-25,5,50,30], hit radius 24, speed 75 and shadow are identical on the real strips
  and the fallback.
- Fallback: one dropped strip rejects the whole set and falls back to the approved idle
  sheet; restore returns the real set (each strip requested once, HTTP 200). The drop
  only affects memory: every strip is byte-identical before and after.
- Performance, warmed 4 s Crypt fight in the full run: real p95 7.1 ms, max 13.8 ms,
  0 frames over 20 ms; fallback p95 7.1 ms, max 13.9 ms, 0 frames over 20 ms. There are
  14 texture swaps per fight, on state changes only. A single 20.8 ms frame in one
  `--lord-review` sample did not reproduce. The generic first-fight benchmark (not a
  Lord fight) shows the same 20.8 ms maximum, so this frame is not Lord-specific.
- Viewports at zoom 1.65: at 960×540 and 844×390 the Lord, sword, player and telegraph
  are clear. At 640×360 the right skill/potion cluster covers about the right quarter of
  the telegraph ring, and the boss nameplate overlaps the HP potion. The boss body, raised
  sword and the rest of the ring stay readable. **Accepted for Demo**; the HUD is unchanged.
- The previous full-run Shop failure (blank page, 39/40) did not reproduce. It came
  from a mid-run page reload caused by editing source files during the run. It was not
  a Lord or Shop regression.
- Accepted deviation: the fit's area resampling leaves interior alpha at about 252–253
  instead of 255, so the body is about 99% opaque. This is invisible at runtime and is
  not production-breaking, so the strips were not changed.

## Reproduction and remaining work

Archive: `art-source/monsters/crypt_lord/pass-4b/` contains accepted sources, prompts,
fit JSON, tools and provenance README. Fit PNGs and review screenshots are disposable
and excluded from the commit. Runtime fallback `crypt_lord.png` remains unchanged.

No missing Lord production state remains; death intentionally retains existing
code-driven squash/fade. Optional dedicated death art and separate boss VFX are
future work. Guardian, Knight, UI and environment production were not started.

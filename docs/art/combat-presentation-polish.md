# Final combat presentation polish

- **Pass 1** (2026-10-12, at `56f863ed`, committed as `323eab31`): idle rhythm, first progressive telegraph, the
  640×360 Talk prompt.
- **Revision** (2026-10-13, at `3917d52d`): applies a human visual review:
  - the telegraph becomes a soft red danger field with no hard ring;
  - the Warrior idle becomes a battle-ready stance that breathes;
  - skills get circular MMORPG-style presentation, with clearer Charge, Provoke and Iron Guard art.

Presentation only: no balance, damage, radius, cooldown, wind-up, aggro, leash or encounter changes, and no new systems.

## Warrior idle: battle-ready stance + breathing

**Before:** a relaxed pose with the sword hanging point-down by the leg. The original 4 frames were only re-timed
(pass 1), so it still read as rigid.

**After:** a restrained combat-ready stance. The sword is raised up and out (South) or forward and up (East/West),
the knees settle about 2 px, and a calm breath plus weight shift runs on top.

### 1. The pose (art)

`tools/character-art/buildWarriorReadyIdle.mjs` writes `warrior_idle_ready_{south,east,north}.png`. It is built from
the approved idle frames, with no new generation and no full redraw.

- **Moving the blade:** the blade is cut out with a colour mask plus a distance-to-blade-axis mask, rotated about the
  crossguard, and drawn back over the arm. The guard stays in the hand and is redrawn on top.
- **Filling the gap:** what the blade used to cover is restored from the figure's mirrored side (South) or cleared to
  background (East).
- **Back view (North):** the raised blade is drawn under the body, so it shows past the right shoulder.
- **Knee settle:** the thighs compress about 2 px. Rows within 12 px of the feet are untouched.
- **Weapon secondary motion:** frames 1–3 tilt the blade by 1.5–3°.
- **Unchanged:** cell size, feet rows and body heights. Render scale, origin and the collision box are therefore
  unchanged too.

### 2. The motion (runtime)

`src/data/idleMotion.ts` and `bakeIdleMotion` in `src/graphics/characterArt.ts` add the movement at runtime.

- **Baking:** at boot, the 4 drawn frames are resampled into 16 poses, a ~2.6 s loop with uneven holds.
- **Breath:** the upper body rises up to 3 source px (about 1 world px, ~1.6 screen px at 1.65 zoom).
- **Weight shift:** the body leans up to 1.75 px at the head.
- **Secondary motion:** the head, hair and blade tip trail the lean by one step.
- **Feet stay planted:** rows from the knees down are copied byte-for-byte.
- **Sprite untouched:** it is never moved or scaled, so the Arcade body, origin and feet are unchanged.
- **Cost:** baking is one-off at boot, and nothing is allocated per frame.
- **Fallback:** if the bake can't run, the timed 4-frame idle plays.

### Transitions

Idle → walk, idle → attack → idle and Dodge switch exactly as before (CP-1, A-/D- checks, Warrior review). Attack,
skill and Dodge timing are untouched.

## Shared telegraph: a soft red danger shadow

Files: `src/rendering/Telegraphs.ts` and `src/rendering/telegraphCurve.ts`. One system serves every monster wind-up,
including Bone Smash, Grave Slam and Stomp.

**Before:** circles with a stroked edge, which read as a red ring.

**After:** four feathered radial textures on the real radius, with no stroked shape anywhere:

| Layer | Look | Alpha |
|---|---|---|
| Dark under-shade | the zone still reads on red carpet and bright grass | 0.13 → 0.19 → 0.35 |
| Translucent red field | radial falloff to nothing at the radius | 0.14 → 0.22 → 0.40 |
| Growing inner field | scale = wind-up progress | rising |
| Soft rim glow | absent early and mid; firms up from ~60 % progress | 0 → 0 → ~0.45 |

The three alpha values are early → mid → late. Over the final 22 % the field and rim breathe gently.

**Impact:** the zone resolves on the same frame as the real damage tick, with a 140 ms flash afterwards. A cancelled
wind-up just disappears.

**Clock:** intensity uses the unchanged curve. It is soft early, rises, and is most urgent over the final 30 %.
Progress comes from the game clock against the real wind-up, so it can't drift from the damage.

| Monster | Wind-up | Damage | Early / mid / late intensity | Zone end vs damage |
|---|---|---|---|---|
| Brute — Bone Smash | 1400 ms | unchanged | 0.16 / 0.38 / 0.82 | same frame |
| Lord — Grave Slam | 1100 ms | 64 | 0.16 / 0.38 / 0.82 | same frame |
| Guardian — Stomp | 1000 ms | 39 | 0.16 / 0.38 / 0.82 | same frame |

Dodge still avoids all three (BP-7, LP-7, GP-7). Images are pooled and restyled in place, with no per-frame
allocation.

### Verdicts

- **Stone (Brute):** a faint shadow early, a clear field mid, and a strong red field with a soft rim late.
- **Field grass (Guardian):** reads as a darkening red patch, strong late.
- **Lord's red carpet:** the weakest case. Mid wind-up the zone reads mainly as a darkening and on the stone at its
  sides; late it is clearly red with its rim.

## Circular skill presentation

`src/ui/styles/skillIcons.css` is loaded last.

- **Hotbar:**
  - The art face is a circle exactly under the radial cooldown sweep (62 % of the socket), on a dark face inside a
    thin bronze ring.
  - A ready skill gets a slightly warmer ring glow; pressed gets brighter.
  - The cooldown keeps the dark radial sweep, the small timer and the one-shot ready flash. Cooldown logic is
    unchanged.
- **Skills window:** the loadout sockets are round with the same ring, and the list and detail icons share the dark
  round face.
- **Passives:** keep their muted plates.
- **Performance:** no filters on hotbar elements and nothing that changes per frame.

### Icon art

`tools/ui-art/buildSkillIcons.mjs` builds the new icons from approved in-repo art, with no generation. The originals
are kept in `art-source/ui/skills/original/`.

| Icon | Change |
|---|---|
| Charge | the approved sword turned level and pointing right, with long blue speed streaks and two fading afterimages; the old diagonal sword was a twin of Power Slash / Whirlwind |
| Provoke (the Warrior's battle cry; there is no separate "Battle Cry" skill) | the hero's own head shouting (open mouth, angry brows), with a warm burst and orange shockwave arcs; the horn did not read as a war cry |
| Iron Guard | the approved steel shield lifted off the dark face by a cool defensive halo and rim |
| Power Slash, Guard, Shield Bash, Whirlwind, Heavy Strike, Berserk | kept: each already has one dominant, distinct symbol |

## Viewports

- **960×540:** the stance reads, the icons are clear, and the cooldown number is readable. The telegraph is visible
  without overpowering the scene.
- **844×390:** the same.
- **640×360:** the same. The [T] Talk prompt stays clear of the potion and skill slots (CP-4).

## Tests

- **Unit:** 630/630.
  - Idle motion: restrained amplitude, steps under 1 px, feet rows still.
  - Telegraph style: the field darkens, there is no rim early or mid, and it is never opaque.
  - Ready-stance strips: same feet rows and heights.
- **`--presentation-review`:** 8/8.
  - CP-1: idle bake, planted feet, transitions.
  - CP-2: soft field, early < mid < late, no rim before the late phase, ends on the damage tick.
  - CP-3: one shared curve.
  - CP-4: Talk at 640.
  - CP-5: the circular face sits exactly under the cooldown sweep, and the loadout is round.
- **HS-7:** updated to the soft-field contract (no stroked ring, no rim mid wind-up, layers on the real radius).
- **Targeted reviews:**

  | Review | Result |
  |---|---|
  | Warrior | 24/24 |
  | Brute | 24/24 |
  | Lord | 24/24 |
  | Guardian | 25/25 |
  | HUD | 40/40 |
  | HUD status | 14/14 |
  | Story | 12/12 |
  | Attack-animation checks | 38/38 |

- **Typecheck and build:** PASS.
- **Full browser suite:** 505/505 in one run, with no console errors.
  - No file changed during the run (SHA-1 before and after).
  - The lowest recorded free RAM was about 2.5 GB.
  - Two earlier attempts were stopped by the host for low memory before finishing, with no failures; neither was
    retried in a loop.
  - Warrior C-2/C-3: the South body-centre reading is now 2.81 px (limit 3), up from 0.59. The ready stance removed
    the blade tip that sat beside the left boot, and that metric reads boot-row runs. Feet stay at 0.33 px.

## Performance

The suite's combat check:

| Build | FPS | p95 | Max |
|---|---|---|---|
| Previous run | 119.4 | 14.0 ms | 27.7 ms |
| This revision | 128.2 | 13.9 ms | 34.7 ms |

The 34.7 ms max matches the pass-1 measurement. In BP/LP/GP-16, real strips vs fallback both have p95 7.1 ms. There
is no meaningful regression.

## Remaining gaps

- **Shoulders:** the ready stance is a pose edit of the approved frames, not a redraw. It does not add a "shoulders
  engaged" change.
- **Back view:** the blade is softer than the drawn art.
- **Lord's carpet:** the mid wind-up telegraph is subdued there; it reads by darkening, not red.
- **Walk:** keeps the sword-down pose. Idle → walk switches between the two poses.
- **New icons:** composed from existing art. A production pass could repaint Charge and Provoke as dedicated
  illustrations.

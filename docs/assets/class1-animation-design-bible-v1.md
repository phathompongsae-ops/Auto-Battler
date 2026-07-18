# Class 1 Animation Design Bible v1

Status: design-only, production not started
Scope: 7 Class 1 heroes only
Canonical approval: false

## Shared rules

- Visual target: stylized 3D fantasy, hand-painted, chibi, 3/4 front, mobile-readable silhouette.
- Runtime owns projectiles, hit flashes, damage numbers, shockwaves, spell circles, particles, and map interaction.
- Character frames contain body, clothing, weapon, and pose only unless explicitly marked otherwise.
- Root motion remains in-place. Runtime controls tile movement and facing through flipX.
- Every attack requires anticipation, action/release, follow-through, and recovery.
- Marker must fire exactly once per attack cycle.
- Camera, canvas, anchor, costume, weapon shape, hair, colors, and body proportions must remain stable across frames.
- Motion-test frame counts may be reduced, but canonical production timing must be re-approved after in-game x4 review.

## Fighter

**Identity:** direct, physical, fearless, compact power.

**Primary attack:** short step-in heavy straight punch with shoulder rotation; no flying fist or baked impact.

- Target frames: 8–10
- FPS: 12
- Loop: false
- Marker: `impactCue @ 0.58`
- Timing: guard 0–1, compress 2, drive 3–4, contact 5, follow-through 6, recover 7–9
- Silhouette lock: both fists readable; torso stays broad; no weapon appears.
- VFX split: runtime adds hit spark and target reaction.
- Must not resemble: Golem double slam, Merchant throw, Swordman slash.

## Swordman

**Identity:** disciplined, precise, balanced blade technique.

**Primary attack:** diagonal draw-slash from low guard to high opposite side, then controlled blade return.

- Target frames: 10–12
- FPS: 12
- Loop: false
- Marker: `meleeHitCue @ 0.55`
- Timing: low guard 0–1, hip load 2–3, slash 4–6, follow-through 7–8, recover 9–11
- Silhouette lock: sword length and hand count unchanged; blade never swaps side accidentally.
- VFX split: runtime owns slash arc and hit spark.
- Must not resemble: Fighter punch or Archer release.

## Archer

**Identity:** calm ranged precision and clean release.

**Primary attack:** plant feet, raise bow, draw, release, open-hand follow-through, settle.

- Target frames: 10
- FPS: 12
- Loop: false
- Marker: `projectileRelease @ 0.55`
- Timing: ready 0, raise 1–2, draw 3–4, release 5, follow-through 6–7, recover 8–9
- Silhouette lock: bow shape constant; arrow visible only before release.
- VFX split: runtime owns projectile, trail, hit effect.
- Current motion-test reference: passed at x4; canonical remains false.

## Mage

**Identity:** controlled arcane force, intelligent and deliberate.

**Primary attack:** staff-hand gathers energy near chest, off-hand traces a short arc, then thrusts forward to cast.

- Target frames: 10–12
- FPS: 12
- Loop: false
- Marker: `spellRelease @ 0.62`
- Timing: focus 0–2, gather 3–4, aim 5, release 6–7, recoil 8, recover 9–11
- Silhouette lock: staff orientation readable; robe and sleeves do not merge into background.
- VFX split: no orb, beam, rune, or projectile baked into character frames.
- Must not resemble: Summoner ritual or Acolyte blessing.

## Summoner

**Identity:** commanding, ritualistic, eerie control rather than direct blasting.

**Primary attack:** low stance, one hand anchors the focus weapon, the other draws a compact summoning seal gesture and commands forward.

- Target frames: 12
- FPS: 12
- Loop: false
- Marker: `summonRelease @ 0.67`
- Timing: prepare 0–2, trace 3–6, command 7–8, hold 9, recover 10–11
- Silhouette lock: familiar/creature is not baked into frames; weapon and hand gesture remain readable.
- VFX split: runtime owns seal, summoned entity, portal, particles.
- Must not resemble: Mage forward cast; motion should feel broader and more ritualized.

## Acolyte

**Identity:** composed sacred authority; female silhouette and costume line remain locked.

**Primary attack:** lift holy focus, draw inward breath, then send a compact forward palm-and-focus pulse.

- Target frames: 10–12
- FPS: 12
- Loop: false
- Marker: `holyRelease @ 0.60`
- Timing: prayer-ready 0–2, lift 3–4, release 5–7, gentle recoil 8, recover 9–11
- Silhouette lock: feminine Class 1 identity, staff/mace/focus shape unchanged, no oversized robe deformation.
- VFX split: runtime owns light pulse, glyph, healing/damage effect.
- Must not resemble: Mage aggressive thrust or Summoner ritual.

## Merchant

**Identity:** clever, opportunistic, gadget-based combat with readable comedy but not slapstick.

**Primary attack:** pull a compact gadget or weighted coin-bomb from belt, snap-throw underhand, then check balance/pouch on recovery.

- Target frames: 10
- FPS: 12
- Loop: false
- Marker: `projectileRelease @ 0.58`
- Timing: ready 0–1, retrieve 2–3, aim 4, throw 5–6, follow-through 7, recover 8–9
- Silhouette lock: item is visible only before release; pouch, coat, and main weapon remain consistent.
- VFX split: runtime owns projectile after release, explosion, coins, hit effect.
- Must not resemble: Archer draw-release or Fighter punch.

## Production order after pilot completion

1. Lock one approved reference image per class.
2. Produce Attack motion first for Fighter, Swordman, Mage, Summoner, Acolyte, Merchant; reuse the verified Archer contract.
3. Test one representative melee, one magic, one ritual, and one thrown-projectile class before batching.
4. Then batch Idle and Move using shared validators.
5. Keep every class `canonicalApproved: false` until real Arena Ruins browser review passes at x4.

## Explicit exclusions

- No Class 2 or Secret Class animation design in this version.
- No Map 2–3 work.
- No Survival Mode.
- No 3-star hero system.
- No Combat, targeting, pathfinding, economy, stage, or game-loop changes.

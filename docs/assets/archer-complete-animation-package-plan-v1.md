# Archer Complete Animation Package Plan v1

Status: design/production plan only  
Canonical approval: false  
Pilot unit: `hero.archer`

## Purpose

Prepare the first complete hero animation package using the already-tested Archer Attack motion as the reference standard. This plan adds production contracts for Archer Idle and Archer Move without changing the existing Attack artwork or any gameplay logic.

The package is intended to prove that one Class 1 hero can share one stable visual identity, canvas, anchor, scale, and runtime contract across Idle, Move, and Attack.

## Locked visual identity

- Female forest Archer.
- Green hood and layered green leather outfit.
- Dark brown hair.
- Long wooden bow.
- Quiver remains attached to the back.
- Stylized 3D fantasy, hand-painted surface treatment, mobile-readable silhouette.
- 3/4 front combat view.
- No redesign between states.
- Runtime owns horizontal movement, facing flip, projectile, trails, hit sparks, dust, and all gameplay VFX.

## Shared package rules

- Canvas: `320 x 480` for all three states.
- Anchor: `[0.5, 0.92]` for all three states.
- Transparent RGBA PNG.
- No opaque pixel touching the canvas border.
- No checkerboard residue in enclosed bow/string regions.
- No baked world movement.
- No baked arrow after the release point.
- No baked shadows, map floor, text, frame labels, particles, or infographic elements.
- Character scale, head size, bow length, quiver placement, and foot line must remain consistent across states.
- Runtime may flip the entire visual on the X axis; do not draw separate left/right sets.
- `canonicalApproved` remains `false` until each state passes the real Arena Ruins browser test at x4.

## Existing verified state: Attack

- State: `attack`
- Frame count: 10
- FPS: 12
- Loop: false
- Marker: `projectileRelease @ 0.556`
- Anchor: `[0.5, 0.92]`
- Canvas: `320 x 480`
- Runtime projectile only.
- Browser result: passed Asset Load, Playback, and Marker + Visual Review at x4 in PR #31.
- Known non-blocking note: two held-pose pairs are byte-identical; keep this as a reference note, not a pattern to copy automatically.

## Archer Idle contract

### Motion concept

A light, alert ranged-combat stance. The Archer remains ready without looking frozen: subtle breathing, minimal weight shift, small hood/hair response, and restrained bow-string hand motion.

### Timing

- State: `idle`
- Target frame count: 8
- FPS: 8
- Loop: true
- Anchor: `[0.5, 0.92]`
- Canvas: `320 x 480`
- Root motion: `in-place`
- Runtime markers: none

### Eight-frame pose map

1. Neutral alert stance; feet planted and bow held diagonally.
2. Begin inhale; upper torso rises slightly.
3. Inhale peak; shoulders and hood lift minimally.
4. Settle from inhale; bow hand relaxes a fraction.
5. Neutral midpoint with a very small gaze adjustment.
6. Begin exhale; torso lowers slightly.
7. Exhale settle; hair tip and cloth lag behind the body.
8. Return exactly toward frame 000 without a scale or foot-line jump.

### Idle limits

- Both feet remain planted throughout.
- Ground-contact spread target: no more than 1 normalized pixel equivalent after normalization.
- Vertical body motion must remain subtle; do not turn Idle into a hop.
- Bow and quiver secondary motion should be readable only at close scale, not distracting at board scale.
- Do not pull the bowstring or imply an attack release.
- Do not spawn an arrow in the hand.

## Archer Move contract

### Motion concept

A light, controlled combat jog suitable for a ranged unit. The Archer keeps her torso comparatively stable while the legs carry the rhythm. The bow remains ready and the quiver follows with delayed secondary motion.

### Timing

- State: `move`
- Target frame count: 8
- Accepted production range: 8-10
- FPS: 12
- Loop: true
- Anchor: `[0.5, 0.92]`
- Canvas: `320 x 480`
- Root motion: `in-place`
- Markers:
  - `leftFootstepCue @ 0.25`
  - `rightFootstepCue @ 0.75`

### Eight-frame pose map

1. Right-leg passing pose; torso centered, bow controlled.
2. Left foot moves forward; body lowers slightly.
3. Left-foot contact; first footstep marker region.
4. Left-leg support; body rises to passing height.
5. Left-leg passing pose; opposite arm/bow counterbalance remains restrained.
6. Right foot moves forward; body lowers slightly.
7. Right-foot contact; second footstep marker region.
8. Right-leg support returning cleanly to frame 000.

### Move limits

- No horizontal displacement inside the PNG sequence.
- Avoid exaggerated bouncing; Archer must read lighter than Fighter and Swordman.
- Bow silhouette must stay clear of the face and torso.
- Quiver may lag but must not change size, side, or attachment point.
- Feet may alternate contact, but overall canvas anchor must not drift.
- Do not bake dust, speed lines, arrows, target indicators, or map interaction into frames.

## Cross-state visual checks

Before packaging, compare representative frames from all three states:

- Idle 000 vs Move 000 vs Attack 000.
- Head scale and face identity.
- Hood opening and hair placement.
- Bow length, curvature, string position, and grip hand.
- Quiver angle and attachment point.
- Foot baseline and character height.
- Main green palette and leather value range.

Any state that appears to use a different Archer must fail visual review even if metadata and playback pass.

## Production package paths

```text
assets/units/hero.archer/idle/hero.archer_idle_000.png ... 007.png
assets/units/hero.archer/move/hero.archer_move_000.png ... 007.png
assets/units/hero.archer/attack/hero.archer_attack_000.png ... 009.png
assets/units/hero.archer/hero.archer_idle_motiontest.json
assets/units/hero.archer/hero.archer_move_motiontest.json
assets/units/hero.archer/hero.archer_attack_motiontest.json
```

## Validation gate

Each new state must be tested independently at x4 using only three checkpoints:

1. Asset Load.
2. Playback and loop behavior.
3. Marker + Visual Review.

After Idle and Move pass individually, run one package-level review that switches among Idle, Move, and Attack and confirms that scale, anchor, identity, and runtime transitions remain stable.

## Scope exclusions

- No Combat, targeting, pathfinding, economy, stage, map, or game-loop changes.
- No new Archer skill or VFX design.
- No Class 2, Secret Class, Map 2-3, Survival, or three-star work.
- No approval of production canon from this document alone.

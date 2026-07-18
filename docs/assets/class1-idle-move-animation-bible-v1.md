# Class 1 Idle & Move Animation Bible v1

Status: production design only  
Scope: Class 1 heroes only  
Canonical approval: false until real in-game x4 review passes

## Purpose

This document defines distinct idle and movement language for the seven Class 1 heroes. The shared runtime pipeline may be reused, but the poses, rhythm, silhouette behavior, weight, and secondary motion must remain unique per class.

This document does not change gameplay speed, pathfinding, hit timing, combat logic, or unit statistics.

## Shared Production Rules

### Technical baseline

- Playback: 12 FPS unless a later runtime profile explicitly overrides it.
- Idle: looped, 6–10 frames.
- Move: looped, 8–10 frames.
- Runtime owns horizontal world travel.
- Sprite frames must remain in-place.
- Runtime owns left/right flip.
- No baked displacement across the canvas.
- No baked particles, dust, trails, spell circles, projectiles, shadows, damage numbers, or map elements.
- Transparent background with fixed canvas per unit/state.
- Stable anchor and contact line across the whole loop.
- Final frame must return naturally to the first frame without a visible identity or scale jump.
- Cloth, hair, weapon straps, bags, and accessories may use secondary motion, but must not obscure the face or change the class silhouette.
- `canonicalApproved` remains `false` until the exact binary frames pass browser review at x4.

### Required sidecar fields

Each produced state must declare:

- `unitId`
- `state`
- `fps`
- `frameCount`
- `loop`
- `anchor`
- `rootMotion: "in-place"`
- event markers where required
- `canonicalApproved: false`

### Shared marker rule

Move animations use two contact markers:

- `leftFootstepCue`
- `rightFootstepCue`

For characters whose feet are hidden by robes, the markers still represent the weight-transfer contacts. They are not optional merely because the feet are visually obscured.

Idle animations normally have no gameplay marker. Decorative breath, cloth settling, or hand motion must not emit gameplay events.

## Class Profiles

## Fighter

### Idle — Guarded Bounce

- Target frames: 8
- Target anchor: `[0.5, 0.92]`
- Weight: heavy upper body, grounded hips
- Pose language: fists raised, shoulders slightly forward, short controlled breathing
- Secondary motion: gloves and belt move minimally
- Loop rhythm: compressed, energetic, never relaxed
- Prohibited: boxer shuffle with horizontal drift; oversized vertical bob; fists covering the face

### Move — Heavy Combat March

- Target frames: 8
- Rhythm: strong alternating steps with low center of gravity
- Arm behavior: compact guard, opposite shoulder rotates slightly with each step
- Contact markers: approximately `0.20` and `0.70`
- Read at game scale: broad torso and raised fists remain readable in every frame
- Distinction lock: must not resemble Swordman's balanced sword advance

## Swordman

### Idle — Measured Blade Guard

- Target frames: 8
- Target anchor: `[0.5, 0.92]`
- Pose language: blade held diagonally, free hand close to centerline
- Weight: balanced between both feet
- Secondary motion: small blade-tip settling and restrained cloth motion
- Loop rhythm: calm and disciplined
- Prohibited: repeated attack wind-up; blade crossing the face; large breathing bounce

### Move — Controlled Blade Advance

- Target frames: 8
- Rhythm: heel-to-toe steps with a stable torso
- Weapon behavior: blade stays ready and does not swing like an attack
- Contact markers: approximately `0.18` and `0.68`
- Distinction lock: smoother and more technical than Fighter; less springy than Archer

## Archer

### Idle — Light Target Scan

- Target frames: 8
- Target anchor: `[0.5, 0.92]`
- Pose language: bow held ready, upper body subtly scans without rotating away from camera
- Weight: light, mostly on the rear foot
- Secondary motion: hair tips, short cape, bowstring settling
- Loop rhythm: alert and quiet
- Prohibited: nocking or releasing an arrow; baked projectile; full torso turn

### Move — Ready Bow Step

- Target frames: 8
- Rhythm: light, quick, low-impact steps
- Weapon behavior: bow remains controlled and clear of the legs
- Contact markers: approximately `0.22` and `0.72`
- Distinction lock: smallest vertical bounce among physical classes
- Existing attack motion-test frames are not a template for the move cycle.

## Mage

### Idle — Arcane Suspension

- Target frames: 8
- Target anchor: `[0.5, 0.91]`
- Pose language: upright caster posture with restrained magical confidence
- Weight: feet remain grounded even if the robe gives a subtle floating impression
- Secondary motion: robe hem, sleeves, hair, staff ornament
- Loop rhythm: slow inhale, small staff pulse, return
- Prohibited: actual levitation; glowing particle loop baked into frames; spell cast gesture

### Move — Gliding Caster Walk

- Target frames: 10
- Rhythm: short hidden steps under the robe with a smooth torso path
- Contact markers: approximately `0.24` and `0.74`
- Staff behavior: slight counter-sway, never sweeping through the body
- Distinction lock: smoothest movement profile; no world-space glide in the sprite

## Summoner

### Idle — Ritual Hand Control

- Target frames: 8
- Target anchor: `[0.5, 0.92]`
- Pose language: one hand maintains a restrained ritual shape while the other controls the weapon or focus
- Secondary motion: sleeves, charms, talismans, short tassels
- Loop rhythm: asymmetric and mysterious, but returns to the same readable silhouette
- Prohibited: summoned creature, magic circle, portal, or floating rune baked into frames

### Move — Cautious Ritual Step

- Target frames: 10
- Rhythm: careful steps with less arm swing than Mage
- Contact markers: approximately `0.20` and `0.70`
- Accessory rule: charms may lag one frame behind the torso, then settle
- Distinction lock: more guarded and asymmetrical than Mage

## Acolyte

### Idle — Serene Staff Brace

- Target frames: 8
- Target anchor: `[0.5, 0.92]`
- Pose language: staff held close, shoulders open, calm breathing
- Weight: centered and stable
- Secondary motion: robe edge and hair move gently
- Loop rhythm: composed and reassuring
- Prohibited: prayer cast, healing glow, halo, wings, or raised-staff attack pose

### Move — Processional Staff Walk

- Target frames: 10
- Rhythm: steady, deliberate, even spacing
- Contact markers: approximately `0.25` and `0.75`
- Staff behavior: stays close to the body and does not strike the ground unless a later design explicitly adds a non-gameplay contact cue
- Distinction lock: more grounded and formal than Mage or Summoner

## Merchant

### Idle — Inventory Check

- Target frames: 8
- Target anchor: `[0.5, 0.92]`
- Pose language: alert stance with a quick strap, pouch, or tool adjustment
- Secondary motion: bag, coins, belts, small tools
- Loop rhythm: practical and slightly restless
- Prohibited: pulling out a projectile, throwing an item, readable shop UI, coins detached from the body

### Move — Loaded Quick Step

- Target frames: 10
- Rhythm: brisk steps with visible carried weight
- Contact markers: approximately `0.18` and `0.68`
- Secondary motion: bag and tools lag behind body motion, then settle without clipping
- Distinction lock: busiest accessory motion of the seven classes, but torso and face remain readable

## Cross-Class Distinction Matrix

- Fighter: strongest vertical compression and heavy shoulder motion.
- Swordman: most balanced physical gait and stable weapon line.
- Archer: lightest physical gait and quietest foot contacts.
- Mage: smooth torso path and flowing cloth.
- Summoner: asymmetric ritual posture and delayed accessory motion.
- Acolyte: most centered, formal, and stable movement.
- Merchant: quickest practical gait with the most accessory follow-through.

No two Class 1 heroes may share the exact same idle key poses, move contact timing, torso curve, or secondary-motion pattern.

## Production Gate

Before generating a complete class batch:

1. Lock one approved reference image for the class.
2. Produce one idle contact sheet and one move contact sheet.
3. Verify identity, canvas, anchor, and silhouette before exporting all PNGs.
4. Integrate with the established motion-test harness.
5. Test only the agreed three checkpoints at x4:
   - Asset Load
   - Playback / Loop
   - Marker + Visual Review
6. Keep `canonicalApproved: false` until the exact reviewed files pass.

## Out of Scope

- Class 2
- Secret classes
- Map 2–3
- Survival Mode
- Three-star heroes
- Combat logic
- Pathfinding
- Targeting
- Economy
- Stage logic
- Game-loop changes

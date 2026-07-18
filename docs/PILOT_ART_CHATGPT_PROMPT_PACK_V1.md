# Pilot Art ChatGPT Prompt Pack v1

Status: Draft prompt scaffolding. Use only after CC confirms Runtime format and after the user approves each unit's neutral reference image.

These are production prompts for ChatGPT image generation. Replace bracketed Runtime fields before use. Do not generate full animation sets in one uncontrolled batch.

## Shared consistency block

Append this block to every prompt:

> Preserve the exact approved character identity, face, proportions, costume, materials, palette, weapon, camera angle, lighting direction, and foot position from the supplied reference. Stylized 3D fantasy mobile-game sprite with hand-painted textures, polished cinematic lighting, clean readable silhouette, 3/4 front view, full body visible, transparent background with real alpha, no frame, no text, no numbers, no floor plate, no baked shadow, no scenery. Keep the character centered within the safe margin. Do not redesign the character between frames. Output format and frame arrangement must follow: [CC_CONFIRMED_FORMAT]. Canvas/frame dimensions: [CC_CONFIRMED_DIMENSIONS]. Foot anchor: [CC_CONFIRMED_ANCHOR].

## Generation workflow

1. Generate one neutral reference image.
2. Review identity and silhouette.
3. Generate a storyboard/contact sheet for one animation state.
4. Review motion arcs and continuity.
5. Generate final individual frames or final sheet in CC-confirmed format.
6. Generate VFX separately.
7. Never call an output canonical before exact-file approval and technical verification.

## Archer — neutral reference

Create the definitive neutral reference for a female woodland Archer in a fantasy Auto-Battler. Olive-green hood or short cape, warm brown leather-and-cloth armor, visible bow and quiver, focused readable face, agile combat-ready stance, compact cloth shapes suitable for a small Board sprite. The bow silhouette must remain readable when reduced. Avoid an elf stereotype, modern clothing, crossbow, oversized cape, neon colors, or visual similarity to Ninja, Ranger, and Sniper. Pose her at rest with both feet clearly planted and the bow held safely beside the body.

[SHARED CONSISTENCY BLOCK]

## Archer — idle storyboard

Using the approved Archer reference, create a coherent [6–8]-frame idle animation storyboard. Subtle breathing, tiny bow-hand adjustment, restrained cape and hair secondary motion. Feet and body center remain stable. The motion must loop seamlessly and remain readable at small Board scale. No projectile or attack pose.

[SHARED CONSISTENCY BLOCK]

## Archer — move storyboard

Using the approved Archer reference, create a coherent [8–10]-frame light forward-running cycle. Keep the bow controlled near the body, maintain clear leg movement and stable 3/4 perspective, and avoid excessive cape overlap. The cycle must loop seamlessly and preserve the foot-anchor logic required by Runtime.

[SHARED CONSISTENCY BLOCK]

## Archer — attack storyboard

Using the approved Archer reference, create a coherent [8–12]-frame normal bow attack: ready stance, reach for arrow, draw, full tension, release, and short recovery. The arrow-release frame must be unmistakable and suitable for a Runtime projectileRelease marker near [0.55]. Do not include the projectile or trail baked into the body frames.

[SHARED CONSISTENCY BLOCK]

## Archer — skill storyboard

Using the approved Archer reference, create a coherent [12–16]-frame skill animation with stronger anticipation and a luminous charged-arrow release. The body motion should support a multi-arrow or empowered-shot visual, but must not imply a different gameplay target or damage mechanic. Keep projectile, trail, and impact effects separate from the character frames.

[SHARED CONSISTENCY BLOCK]

## Archer — hit storyboard

Using the approved Archer reference, create a compact [4–6]-frame hit reaction. Brief upper-body recoil, controlled bow movement, feet stay close to the anchor, no full spin, no large translation, and a clear recovery-ready final pose.

[SHARED CONSISTENCY BLOCK]

## Archer — death storyboard

Using the approved Archer reference, create a coherent [8–12]-frame death sequence: stagger, bow lowers, knees weaken, controlled collapse to one side. Keep the sequence compact and avoid moving outside the original footprint. No blood or gore.

[SHARED CONSISTENCY BLOCK]

## Archer — separate VFX prompts

### Arrow projectile
Create a clean fantasy arrow projectile sprite matching the approved Archer palette. Transparent background, readable at small size, no trail baked in, horizontal travel orientation, compact silhouette.

### Light trail
Create a short luminous leaf-green or pale-gold arrow trail animation, [6–10] frames, transparent background, tapered shape, no arrow body, suitable for additive or alpha blending and graceful omission on low quality.

### Impact spark
Create a compact arrow impact spark animation, [8–12] frames, transparent background, bright center with restrained leaf-green/gold shards, readable but not large enough to hide adjacent units.

## Slime — neutral reference

Create the definitive neutral reference for a small hostile fantasy Slime. Cute but combat-ready, simple rounded silhouette, expressive readable face, glossy translucent green or teal gel body with hand-painted highlights and a slightly darker internal core. It must look smaller and lighter than heroes and Golem. Avoid pixel art, environmental puddles, complex accessories, or a giant boss silhouette. Stable centered resting pose with the bottom contact area clearly visible.

[SHARED CONSISTENCY BLOCK]

## Slime — idle storyboard

Using the approved Slime reference, create a seamless [6–8]-frame idle loop with soft breathing wobble and subtle surface ripple. Maintain the same base contact point and do not grow or shrink the average silhouette.

[SHARED CONSISTENCY BLOCK]

## Slime — move storyboard

Using the approved Slime reference, create a seamless [8–10]-frame squash-and-stretch bounce cycle: compress, launch, airborne stretch, landing, recovery. Keep the visual footprint controlled and the anchor predictable.

[SHARED CONSISTENCY BLOCK]

## Slime — attack storyboard

Using the approved Slime reference, create a coherent [8–12]-frame body-lunge attack: compress deeply, spring forward, contact pose, elastic recoil. Do not bake splash VFX into the body frames.

[SHARED CONSISTENCY BLOCK]

## Slime — skill storyboard

Using the approved Slime reference, create a coherent [12–16]-frame skill animation with a larger elastic wind-up and a strong pulse or splash-release pose. Do not imply a different gameplay mechanic. Keep skill splash as a separate VFX layer.

[SHARED CONSISTENCY BLOCK]

## Slime — hit storyboard

Using the approved Slime reference, create a compact [4–6]-frame hit reaction with a brief flattened recoil and quick shape recovery. Keep the face readable and avoid extreme displacement.

[SHARED CONSISTENCY BLOCK]

## Slime — death storyboard

Using the approved Slime reference, create a coherent [8–12]-frame defeat: loss of tension, collapse, then a compact burst or dissolve. Separate the final splash/droplets from the core body frames when practical. No gore.

[SHARED CONSISTENCY BLOCK]

## Slime — separate VFX prompts

### Splash impact
Create a compact green/teal slime splash impact animation, [8–12] frames, transparent background, readable at small size, no persistent puddle.

### Skill pulse
Create a stronger circular gel pulse or splash animation, [10–14] frames, transparent background, compact radius, bright center, secondary droplets separable or safely removable.

### Death splash
Create a short slime death-splash animation, [8–12] frames, transparent background, controlled droplets and fast fade, no gore and no large floor stain.

## Golem — neutral reference

Create the definitive neutral reference for a heavy stone Golem from Arena Ruins. Broad torso, thick arms, compact head, ancient carved stone plates, dark joints and cracks, restrained magical seams or runes, massive but readable silhouette. Use weathered gray or warm sandstone with one restrained accent glow [AMBER/CYAN/MOSS]. It must not resemble a plant creature, Warden, Bone Dragon, or Arena Overlord. Full body visible, heavy grounded stance, feet clearly contacting the anchor.

[SHARED CONSISTENCY BLOCK]

## Golem — idle storyboard

Using the approved Golem reference, create a seamless [6–8]-frame idle loop with heavy subtle breathing, tiny stone settling, and restrained rune pulsing. Keep the feet and body center stable.

[SHARED CONSISTENCY BLOCK]

## Golem — move storyboard

Using the approved Golem reference, create a coherent [8–10]-frame heavy walking cycle. Weight shifts deliberately, feet plant clearly, minimal vertical bounce, no running. Do not bake dust into the body frames.

[SHARED CONSISTENCY BLOCK]

## Golem — attack storyboard

Using the approved Golem reference, create a coherent [8–12]-frame heavy strike: long anticipation, shoulder and torso rotation, powerful arm swing or downward smash, contact pose, and weighty recovery. The impact frame must be clear for an impactCue marker. Keep dust, debris, and shockwave separate.

[SHARED CONSISTENCY BLOCK]

## Golem — skill storyboard

Using the approved Golem reference, create a coherent [12–16]-frame skill animation with a dramatic but controlled wind-up and ground-smash release. The pose should support a compact shockwave visual without implying Board-wide damage unless Combat already does so. VFX must remain separate.

[SHARED CONSISTENCY BLOCK]

## Golem — hit storyboard

Using the approved Golem reference, create a compact [4–6]-frame hit reaction. Small torso recoil, restrained rock shift, no large knockback, and no permanent damage to the model. Rock fragments belong in a separate VFX layer.

[SHARED CONSISTENCY BLOCK]

## Golem — death storyboard

Using the approved Golem reference, create a coherent [8–12]-frame death sequence: stagger, cracks intensify, structure loses support, controlled crumble or kneeling collapse. Keep the major silhouette within the approved footprint. Dust and debris are separate VFX layers.

[SHARED CONSISTENCY BLOCK]

## Golem — separate VFX prompts

### Dust impact
Create a compact stone-impact dust burst animation, [8–12] frames, transparent background, warm gray dust, readable center, fast fade, no Board-wide cloud.

### Rock debris
Create a small secondary rock-fragment animation, [6–10] frames, transparent background, several restrained fragments, designed to be omitted first under mobile performance degradation.

### Ground shockwave
Create a compact Board-aligned circular stone shockwave animation, [10–14] frames, transparent background, cracked-energy ring with restrained glow, limited radius, no scenery.

### Death dust
Create a short crumble-dust animation, [8–12] frames, transparent background, heavier than hit dust but still compact and fast-disposing.

## Negative prompt block

Append when supported:

> no background, no landscape, no floor tile, no text, no logo, no border, no UI, no checkerboard baked into image, no photorealism, no pixel art, no anime flat cel shading, no cropped feet, no cropped weapon, no extra limbs, no duplicate weapon, no costume change, no face change, no camera-angle change, no inconsistent scale, no glow covering the whole body, no excessive particles, no gore

## Required review after each generated batch

- Identity match against approved neutral reference.
- Silhouette consistency.
- Foot-anchor stability.
- Camera and scale consistency.
- Frame-to-frame costume and weapon continuity.
- Motion readability at reduced Board size.
- Real alpha and clean edges.
- VFX not baked into body when separation is required.
- No frame clipping.
- No output promoted to canonical before user approval and Runtime test.

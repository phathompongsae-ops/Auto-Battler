# Pilot Art Production Brief v1

Status: Draft production brief for ChatGPT image generation after the Runtime framework shape is confirmed by CC.

Scope: Archer, Slime, and Golem only. This brief does not approve any exact image as canonical and does not lock final sprite-sheet dimensions, packing, or Runtime paths.

## Shared visual target

- Stylized fantasy 3D appearance rendered as transparent 2D game sprites.
- Hand-painted texture treatment, polished mobile-game finish, readable silhouette, and controlled cinematic lighting.
- 3/4 front view with the character's feet clearly visible and a stable foot anchor.
- Strong readability at Board, Bench, and Shop-card scale.
- Transparent PNG with real alpha; no background, frame, text, numbers, floor plate, or baked shadow.
- Character animation and VFX are separate deliverables whenever practical.
- Skills must read as more important than normal attacks through anticipation, release, trail, impact, and recovery.
- Effects may be moderately spectacular but must not obscure multiple Board tiles or hide nearby units.

## Continuity rules across frames

Every frame in one state and every state for one unit must preserve:

- face, hair, costume, weapon, materials, palette, proportions, and camera angle;
- consistent light direction and rendering style;
- consistent foot position and body scale;
- no accidental costume redesign between frames;
- no mirrored weapon hand unless the full sequence is intentionally mirrored at Runtime;
- no cropped weapon tips, feet, ears, or VFX required for silhouette readability.

Use one approved neutral reference image per unit as the visual master before generating animation states.

## Quality target

Demo Showcase target:

| State | Target frames | Intent |
|---|---:|---|
| Idle | 6–8 | subtle breathing, cloth/hair motion, stable silhouette |
| Move | 8–10 | readable locomotion and weight shift |
| Attack | 8–12 | anticipation, contact/release, recovery |
| Skill | 12–16 | stronger anticipation and layered VFX cue |
| Hit | 4–6 | brief readable recoil without extreme displacement |
| Death | 8–12 | clear defeat, no abrupt disappearance |

The final frame counts may be reduced after CC reports actual Runtime and mobile constraints. Do not generate a full final sheet before that review.

## Archer production brief

### Identity

- Female woodland Archer.
- Olive-green hood or short cape, practical leather-and-cloth armor, bow, and visible quiver.
- Agile, focused, and combat-ready rather than decorative.
- Distinct from Ranger, Sniper, Ninja, and generic fantasy elf silhouettes.
- Bow must remain clearly visible when reduced.

### Palette and materials

- Main: olive green.
- Secondary: warm brown leather.
- Accent: muted gold or pale leaf-green.
- Hair and skin must remain readable beneath the hood.
- Avoid neon colors and excessive long fabric that hides the legs.

### State direction

- Idle: breathing, subtle bow-hand adjustment, cape and hair secondary motion.
- Move: light forward run with bow controlled close to the body.
- Attack: clear draw, full tension, arrow release, short recovery.
- Skill: stronger stance, luminous arrow energy or multi-arrow visual language without changing Combat logic.
- Hit: compact upper-body recoil while feet remain near the anchor.
- Death: stagger, lower bow, collapse onto one side without excessive screen travel.

### VFX deliverables

- Arrow projectile.
- Light arrow trail.
- Small impact spark.
- Skill-enhanced trail or multi-arrow visual layer.
- VFX must be generated separately from the body animation where possible.

## Slime production brief

### Identity

- Small readable fantasy Slime, cute but hostile.
- Simple silhouette with expressive face and translucent or glossy body material.
- Must remain visually smaller and lighter than heroes and Golem.
- Avoid pixel-art treatment for the final target.

### Palette and materials

- Main: saturated but controlled green or teal.
- Glossy gel surface with hand-painted highlights.
- Darker internal core or simple face for readability.
- No environmental background or puddle baked into every frame.

### State direction

- Idle: breathing wobble and subtle surface ripple.
- Move: squash-and-stretch bounce with clear takeoff and landing.
- Attack: compress, launch body forward, recoil.
- Skill: larger elastic wind-up with a stronger splash or pulse effect.
- Hit: brief flattened recoil.
- Death: collapse, burst, or dissolve into a short slime splash while keeping the effect compact.

### VFX deliverables

- Small splash impact.
- Skill splash or gel pulse.
- Death splash.
- Optional droplets as secondary particles; must be safe to omit under mobile degradation.

## Golem production brief

### Identity

- Heavy stone Golem suitable for Arena Ruins.
- Broad torso, thick arms, compact head, and immediately readable rock silhouette.
- Ancient carved stone with restrained magical seams or runes.
- Must not resemble Plant Golem, Warden, Bone Dragon, or Arena Overlord.
- Larger than normal units but must remain within the visual footprint approved by Runtime.

### Palette and materials

- Main: weathered gray or warm sandstone.
- Secondary: darker cracks and joints.
- Accent: restrained amber, cyan, or moss-green magical glow selected after in-game readability review.
- Avoid full-body glow and excessive debris baked into every frame.

### State direction

- Idle: heavy breathing or subtle stone settling.
- Move: weighty steps with minimal vertical bounce.
- Attack: long anticipation, powerful arm swing or ground strike, strong recovery.
- Skill: more dramatic wind-up with compact shockwave language.
- Hit: limited recoil with small stone fragments.
- Death: stagger, crack, and controlled crumble or enhanced fade.

### VFX deliverables

- Dust impact.
- Small rock debris.
- Compact ground shockwave.
- Death crumble dust.
- Debris and ground effects must be separate layers and degradable before the core impact.

## Deliverable groups

For each pilot, prepare these groups only after Runtime format confirmation:

1. Neutral approved reference image.
2. Character animation frames for six states.
3. Projectile where applicable.
4. Trail or slash layer where applicable.
5. Hit-impact layer.
6. Ground-effect layer where applicable.
7. Death-effect layer where applicable.
8. Reduced-size review sheet showing Board, Bench, and Shop-card previews.

Shop card art and Battle animation may share the same visual identity but must not be assumed to use the same crop or source file.

## Provisional naming plan

Names below are semantic only. CC must confirm final extension, frame packing, dimensions, and paths.

- archer_reference
- archer_idle
- archer_move
- archer_attack
- archer_skill
- archer_hit
- archer_death
- archer_projectile
- archer_trail
- archer_impact
- slime_reference
- slime_idle
- slime_move
- slime_attack
- slime_skill
- slime_hit
- slime_death
- slime_impact
- slime_skill_splash
- slime_death_splash
- golem_reference
- golem_idle
- golem_move
- golem_attack
- golem_skill
- golem_hit
- golem_death
- golem_impact_dust
- golem_debris
- golem_shockwave
- golem_death_dust

Do not create final paths or mark any of these canonical until Runtime reconciliation and exact-file approval.

## Technical acceptance gate

Each exact output must pass:

- real alpha transparency;
- complete silhouette with no clipping;
- consistent frame dimensions inside one animation state;
- stable foot anchor and scale;
- no accidental background pixels or checkerboard baked into the file;
- consistent identity across all frames;
- readable at reduced Board size;
- VFX separated from character body when required;
- no copyrighted third-party character likeness;
- provenance recorded for downloaded source material;
- explicit user approval of the exact file;
- Runtime technical verification before canonical-approved status.

## Production sequence

1. Wait for CC Asset & Animation Framework report.
2. Reconcile actual Runtime format, frame dimensions, packing, FPS, anchor, and path rules.
3. Generate one neutral reference per pilot with ChatGPT.
4. User approves or rejects exact references.
5. Generate one test state per unit: Archer attack, Slime move, Golem attack.
6. Integrate the three test states into Runtime and review scale, anchor, timing, and performance.
7. Only after the pilot test passes, generate remaining states and VFX.
8. Do not mass-produce the full roster until all three pilots pass.

## Ownership

- Coco: brief, manifest/data standards, review records, and validators.
- ChatGPT: generation of original final images and animation-frame candidates.
- CC: Runtime integration, animation playback, VFX hooks, fallback, cache, and performance testing.
- User: exact-file visual approval and final art direction decisions.

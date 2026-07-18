# Character Art Style Lock & Migration Contract v1

## Decision

Project-wide character art direction is now locked as:

> **Cute stylized fantasy chibi, gameplay-first readability**

`styleDirectionApproved=true` records approval of this visual language. `canonicalApproved=false` remains mandatory because this contract does not approve, generate, retouch, replace, or integrate any production character binary.

This change is documentation, machine-readable design metadata, and user-reference archival only.

- Runtime changes: none
- Core Logic or gameplay changes: none
- Map, camera, or board changes: none
- Motion production or asset replacement: none
- Existing production assets overwritten: none
- PRs merged: none

## Verified GitHub source boundary

GitHub was read directly on 2026-07-19 before work began.

| Role | PR | Branch | Exact HEAD | State |
|---|---:|---|---|---|
| Contract base | #12 | `coco/free-asset-intake-v1` | `36dd6a2b58b47942b66bd9103c3baeeaf674302c` | open, draft, unmerged |
| Board runtime reference | #55 | `cc/arena-ruins-static-board-runtime-integration-v1` | `08744faad0df8ce5fe1e43461ba59687fd0aebe8` | open, draft, unmerged |
| Motion runtime reference | #56 | `cc/pilot-idle-motion-runtime-integration-v1` | `bbe63518c42761f49a0aa068c78e0d07d3e88214` | open, draft, unmerged |

PR #12 is the appropriate base because it is the existing Coco docs/design line for character visual locks, canonical import gates, asset readiness, and Shop/Bench/Board presentation. Its 20 changed files are under `docs/` and `data/`; it contains no `src/` or runtime change.

PR #12 diverges from both runtime references. The merge-base with #55 and #56 is `3300d02488e6a4715c87d20ac30e3ed53fdfca6f`; neither runtime head is an ancestor of the contract base and the contract base is not an ancestor of either runtime head. The two CC branches are therefore read-only technical evidence, not ancestry. No merge, rebase, squash, or cherry-pick crosses this boundary.

## Archived user-approved references

Manifest: `data/design/character-art-reference-manifest-v1.json`

Archive root: `docs/assets/reference/character-art-style-lock-v1/`

| Logical ID | Archived file | Actual format / dimensions | SHA-256 | Role |
|---|---|---|---|---|
| `gameplay_character_style_context_reference` | `gameplay-character-style-context-reference.jpg` | JPEG, 1536×864 | `f65408331cf5fbf2b28fcf8f2522d9698f6108a21e84714592fb012620089aec` | Primary gameplay, card, battle-scale, enemy-list, and rendering-language context |
| `style_anchor_archer` | shared original above; no crop | JPEG, 1536×864 | `f65408331cf5fbf2b28fcf8f2522d9698f6108a21e84714592fb012620089aec` | Green female Archer/Ranger shown in the shop card and on-board lineup |
| `style_anchor_slime` | `style-anchor-slime.jpg` | JPEG, 1229×1536 | `3965fafb200d6b3727bb67b3ec4255f146e8750e42a60805deb8b731a61ed1ed` | Cute/simple monster anchor |
| `style_anchor_golem` | `style-anchor-golem.jpg` | JPEG, 1229×1536 | `ea01ef39c21ae354872adc06af0687cb0f7581d36b4b216ca78cfc30c397fa92` | Heavy monster anchor |

The user-facing upload names ended in `.png`, but all three supplied binaries decode as baseline 8-bit JFIF JPEG. The repository filenames use `.jpg` to state the real format. Each archived file is byte-identical to its attachment; no conversion, crop, retouch, or derivative was created. The gameplay reference serves two logical IDs so the Archer evidence can be locked without manufacturing a new crop.

These files are user-approved visual references, non-runtime, and non-canonical production material. Their production-use licensing was not independently established, so they remain internal reference-only evidence and must never be registered as textures, cards, portraits, sprites, or animation frames.

## Primary style context

The primary reference controls:

- the amount of chibi stylization;
- large-head/compact-body proportion;
- cute but capable fantasy tone;
- clean class and monster silhouettes;
- readable face, weapon, helmet, hair, crystal, and material cues;
- visual consistency between board units, bench units, shop cards, and enemy-list portraits;
- polished mobile auto-battler rendering quality.

Future production should closely match this language. “Closely match” applies to style, proportion, readability, and presentation; it does not authorize copying pixels from the archived reference or using the reference itself at runtime.

## Approved style anchors

### Archer / Ranger — human hero anchor

- female;
- green hood and green hair;
- pointed elf-like ears;
- large expressive green eyes;
- ornate green/gold bow;
- green/gold ranger outfit;
- very chibi large-head/small-body proportion;
- cute but battle-ready posture;
- bow, hood, hair, ears, and color block remain legible at small scale.

This anchor supersedes more realistically proportioned Archer visual direction. It does not change the Archer gameplay class, gender, range, attack behavior, or animation marker contract.

### Slime — cute/simple monster anchor

- bright blue glossy jelly body;
- rounded teardrop/slime silhouette;
- large shiny eyes;
- small horn-like protrusions;
- cute smile;
- minimal internal complexity;
- polished glossy material;
- immediate read at board and enemy-list size.

The face must remain friendly and legible. Extra bubbles, interior symbols, or aggressive brow shapes cannot displace the eyes/smile as the primary read.

### Golem — heavy monster anchor

- compact chunky stone body;
- oversized fists;
- bright glowing blue crystals;
- glowing blue eyes;
- concentrated mass instead of tall realistic humanoid proportions;
- powerful but still cute/chibi;
- rock segmentation, fists, crystals, and eyes remain readable when reduced.

The blue crystal/eye contrast is functional as well as decorative: it prevents the Golem from disappearing into Arena Ruins stone.

## Project-wide style rules

### Proportion

Hero humanoids target approximately **2.5–3 heads tall**.

- Heads are larger relative to torso.
- Torso and limbs are shorter than realistic adult anatomy.
- Hands and class-defining weapons may be modestly oversized.
- A compact body must still look ready for combat.
- Avoid realistic adult or long fashion-illustration proportions.
- Avoid baby-like super-deformation that removes class authority.

Monster proportions follow archetype shape language rather than the humanoid head count, but must remain compatible with the same chibi world.

### Face

- Use large expressive eyes and simplified facial anatomy.
- Expression must survive board, bench, card, and icon reduction.
- Face shape contributes to identity; hair/costume recolor alone is insufficient.
- Avoid photoreal facial planes, tiny anatomy, and low-contrast expression.

Existing male-face diversity requirements remain: male classes require deliberate differences in face width, jaw/chin, eye angle, brows, nose, mouth, age, and temperament.

### Silhouette

The class, role, or monster archetype should be recognizable within approximately one second.

Identity priority:

1. weapon or casting cue;
2. headgear, hair, hood, ears, horns, or crystals;
3. shoulder and torso massing;
4. stance and limb mass;
5. secondary accessories.

Do not hide weapons behind the body, repeat cloak/costume blockouts across classes, or add clutter that disappears at reduced size.

### Color and material separation

- Every class or monster needs a clear dominant color/material family.
- Use warm/cool or material contrast to separate focal cues.
- Avoid costumes made from adjacent low-contrast values.
- Preserve separation against the warm sand/stone Arena Ruins board.
- Bright accent colors support identity but cannot be the only silhouette cue.

### Detail hierarchy

Priority is fixed:

1. silhouette;
2. face/head;
3. weapon/class cue;
4. dominant color;
5. secondary costume detail.

Decorative trim, jewelry, filigree, cracks, particles, and surface noise must be reduced or removed if they weaken a higher-priority read.

### Rendering language

Required:

- stylized 3D fantasy;
- polished mobile-game finish;
- hand-painted or softly rendered material feel;
- controlled soft cinematic lighting;
- crisp readable outer and internal edges;
- transparent production export without card or scene pixels.

Excluded:

- photorealism;
- overly realistic PBR;
- flat 2D anime rendering;
- super-deformed baby styling;
- baked card frames, names, prices, rarity borders, UI, scenes, floors, or board pixels;
- baked environmental/floor shadows containing scene or board-specific pixels.

## Gameplay readability contract

Every production master must be reviewed in four contexts:

| Context | Required read |
|---|---|
| Board unit | silhouette, facing, team/character identity, weapon or archetype cue |
| Bench | head/face, dominant color, and class/monster silhouette |
| Shop card | full character identity, face appeal, weapon/costume cue, material quality |
| Enemy list portrait/icon | face or focal feature and archetype within a compact crop |

Passing only a large standalone render is insufficient. A failed board/bench/icon read cannot be repaired by changing camera or gameplay geometry.

## Hero, class, and monster differentiation

Every hero/class line requires:

- a unique silhouette;
- a unique weapon or casting cue;
- a unique dominant color family;
- a unique head/hair/hood/helmet/ear shape;
- a costume blockout distinct from other class lines.

Existing Class 1 identity remains authoritative: Fighter is male and unarmed with oversized metal gauntlets; Swordman is a male single-sword specialist; Archer is female; Mage and Summoner must be visually distinct casters; Acolyte is female; Merchant is male with a practical trader/adventurer cue.

Gender locks remain:

- Archer = female;
- Acolyte = female;
- Sniper and Ranger = female Archer descendants;
- Priest and Inquisitor = female Acolyte descendants;
- all other class lines retain `hero-codex-v1` gender records unless a separate approved contract changes them.

Monster rules:

- simple monster → simple silhouette;
- heavy monster → chunky massing;
- ranged monster → visible ranged weapon or casting cue;
- assassin → compact directional shape and readable attack tool;
- boss → larger authority through mass, scale, stance, and focal detail without abandoning chibi language.

## Arena Ruins compatibility

PR #55 remains the read-only Board baseline. This contract preserves its warm sand/stone board, camera, contain-fit, 8×7 geometry, bench, surface, perimeter ground, existing highlights, and procedural fallback.

- Slime must retain a strong blue/jelly read without blending into blue floor accents.
- Golem must use crystal/eye glow, edge value, compact mass, and readable fist shapes to avoid stone-on-stone loss.
- Archer and human classes require clear head, weapon, and dominant-color separation.
- Character production files contain no Arena Ruins floor, tile, border, prop, background, or board-specific pixels.
- Board geometry and camera cannot be changed to compensate for weak character art.

## Approval model

`styleDirectionApproved=true` means the user approved the project-wide visual language and the four logical references.

`canonicalApproved=false` means this contract approves no newly migrated production image or frame set.

Each future production binary requires:

1. recorded source and provenance;
2. exact SHA-256 and dimensions;
3. verified transparent background/real alpha;
4. no baked floor, scene, shadow, UI, card, or text pixels;
5. visual match to the approved neutral master and style lock;
6. Board/Bench/Shop/Enemy-list readability evidence;
7. explicit user approval of that exact file.

Direction approval never promotes a candidate, derivative, frame set, portrait, or card to canonical status automatically.

## Migration audit at PR #56

Audit tree: `bbe63518c42761f49a0aa068c78e0d07d3e88214`

### Technically reusable

| System | Existing ownership | Reuse decision |
|---|---|---|
| Asset/animation runtime | `src/asset-animation-runtime.js` | Reuse resolution, state machine, FPS guards, fallback, texture ref-count/dispose, and marker delivery |
| Motion harness | `src/motion-test-harness.js` | Reuse state selection, x1/x4 playback, pause/restart, flipX, transitions, diagnostics, and dispose lifecycle |
| Sidecar/source maps | `assets/units/*/*_motiontest.json`, `source-map.json` | Reuse schema and vocabulary; revalidate values after master replacement |
| Runtime regressions | `test-asset-animation-runtime`, `test-motion-test-harness`, package transitions | Reuse test structure |
| Frame validators | Archer/Slime/Golem validators | Reuse infrastructure; replacement tasks update only asset-specific expectations and hashes |

Technical reuse does not imply visual approval.

### Visually requires replacement/regeneration

| Current line | Finding |
|---|---|
| Archer attack/idle/move frames | Current master is closer to realistic adult proportion and lacks the approved green-haired, large-eyed, very-chibi anchor. Replace all states after a new neutral master is approved. |
| Golem attack/idle frames | Crystals and stone cues are directionally useful, but the body is taller and more heroic-humanoid than the compact chunky anchor. Replace all states. |
| Class 1 root sprites | `fighter/swordman/archer/mage/summoner/acolyte/merchant` are legacy/procedural visuals; replace. |
| Class 2 sheets and portraits | Legacy pixel sheets/portraits do not meet the polished stylized-3D language; replace phase-by-phase. |
| `assets/v5/body_*`, `face_*`, `mon_*` | Legacy composited/procedural line; not final migrated art. |
| Root monster/boss sprites | Existing `mon_*`, Orc Warlord, Lich King, Arena Overlord, champion and warden sprites predate this style lock. Active roster art requires new masters; obsolete IDs are not migrated unless reactivated. |

No current file is deleted or modified by this audit.

### Possibly reusable with exact review

Current Slime move/idle frames are bright blue, glossy, horned, and simple enough to be directionally close. They still differ from the approved anchor in face language: the anchor is rounder and friendlier, with much larger shiny eyes and a cute smile. The current Slime line may be reused only if an exact reduced-size side-by-side review explicitly approves it; otherwise all Slime states regenerate from the new master.

## Motion migration rule

PR #56 passed as a technical integration baseline. The loader, state machine, harness, sidecar structure, marker vocabulary, FPS/loop handling, transitions, and x4 regression strategy are reusable.

Visual finality is separate:

- if a neutral master changes silhouette, proportion, face, costume, weapon, or material substantially, every old-master frame becomes replacement-planned;
- every regenerated state must derive from the same approved neutral master;
- canvas, anchor, baseline, crop, flip, FPS, loop, root motion, and event markers must be revalidated;
- gameplay marker semantics remain unchanged unless a separate gameplay-authorized task changes them;
- no motion is generated or integrated in this contract.

## Migration production phases

| Phase | Scope | Source/neutral master | Motion and card/portrait | Runtime impact / approval gate |
|---:|---|---|---|---|
| 1 | Archer, Slime, Golem anchors | New transparent masters guided by the archived references; never extract reference pixels | Archer/Golem states regenerate; Slime receives exact review first. Produce board/bench source plus separate card/portrait presentation from the same master | Path-limited asset/sidecar work through existing seams. Exact-file approval for each master and derived set |
| 2 | Fighter, Swordman, Archer, Mage, Summoner, Acolyte, Merchant | One unique approved neutral master per Class 1 identity | States follow master approval; card/icon must match board identity | Reuse loader/class IDs; no gameplay change. Per-class gate plus seven-class differentiation contact sheet |
| 3 | Slime, Orc, Stone Wolf, Skeleton, Spirit Archer, Shadow Assassin, Golem | One approved master per active core monster and shape language | Regenerate replaced states; produce enemy-list portrait/icon | Asset-only integration; encounter data unchanged. Per-monster gate plus reduced active-roster silhouette strip |
| 4 | All 14 Class 2 heroes | Derive family language from approved Class 1 parent while differentiating both branches | No legacy sheet is final; states/cards follow master approval | Reuse IDs/fusion contracts; no fusion logic change. Parent-plus-sibling comparison gate |
| 5 | Orc Warlord, Bone Dragon, Lich King, Arena Overlord | Active boss/miniboss masters with chibi authority | New motion and boss-list portrait after master approval | Stats, skills, targeting, and stages protected. Exact-file plus board/effect-clearance gate |
| 6 | Ninja; future reserved Black Dragon Knight and Sword Saint | Separate approved secret-class brief/master | States/card only after explicit scope | Unlock/save/shop/fusion and Map 2–3 protected. Separate exact-file and differentiation gate |

Class 2 exact IDs:

`knight`, `berserker`, `blade_master`, `duelist`, `sniper`, `ranger`, `archmage`, `frost_weaver`, `beast_lord`, `spirit_blade`, `priest`, `inquisitor`, `tycoon`, `trickster`.

`warden` and `champion` are obsolete in the current Map 1 encounter contract and are excluded from production priority. `black_dragon_knight` and `sword_saint` are reserved names only; this contract creates no Map 2–3 art or data.

## Protected scope

This contract does not authorize changes to:

- `src/`;
- Core Logic;
- Combat, targeting, pathfinding, economy, stage logic, or main loop;
- camera, contain-fit, board dimensions, board/gameplay geometry, or map runtime;
- Arena Ruins production assets;
- existing character or motion production assets;
- event-marker gameplay semantics;
- Map 2–3;
- any production `canonicalApproved` value.

Future runtime integration remains a separate CC task after exact-file approval. It must be path-limited and preserve existing fallbacks and regression behavior.

## Contract conclusion

The visual direction and four logical references are approved and locked. The reference binaries are archived successfully as non-runtime evidence. The existing runtime/motion architecture remains reusable, while legacy visual production must migrate in controlled phases. No existing production file is made canonical by this contract.

`styleDirectionApproved=true`

`canonicalApproved=false`

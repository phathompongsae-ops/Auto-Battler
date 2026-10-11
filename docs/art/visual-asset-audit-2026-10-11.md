# Demo visual asset audit and shortest production path

Audit date: 2026-10-11. Baseline: `037b89b173c7bbdbfd11997c801d15c506ba247f`,
`phaser-rebuild`. Skeleton Brute is COMPLETE / LOCKED. Camera remains 1.65.
This audit changes documentation only; no generation, integration, balance or system work.

## Evidence and limits

Inventoried `public/assets`, `art-source` (including candidates), `legacy/assets`,
and existing `tmp/env-art` inputs. Checked PNG headers, actual alpha extrema for all
155 public PNGs, and selected per-frame alpha bounds. Read runtime registries,
animation state selection, map/prop data, UI/localization and source manifests.
Viewed approved Warrior, Lord, Guardian, Brute, production VFX, representative
legacy/third-party images and existing Field/Crypt/compact-HUD captures.
Historical screenshots are fixture captures, not a new legitimate playthrough;
their coordinates/HP/quest state are not gameplay evidence. No fresh browser run.
No Unity model rendering was performed. Numbered models cannot be confidently
assigned species from their UV textures; no species identity is invented here.
External Unity project folders and remote attachments are outside this inventory.

Exact group counts, formats and dimension distributions are in
[`visual-asset-inventory-2026-10-11.json`](visual-asset-inventory-2026-10-11.json).
Counts below are stored files, not loaded textures. Unity counts include `.meta`
and therefore are not unique usable-art counts. RGBA does not alone prove usable
transparency: all public PNGs contain transparent pixels except the deliberately
opaque Crypt ground atlas. Whole-sheet counts include unused masters/duplicates.

Historical Pass 2/early Pass 4B statements that Brute is pending are superseded by
the final production-integration section of `visual-pass-4b-status.md` and current
`src/data/monsterAnimArt.ts`. Do not reopen its accepted proportions/deviations.

## Reuse matrix

Categories: A direct reuse; B technical conversion; C reference only / regenerate;
D possible VFX reuse; E development placeholder; F do not use for this Demo;
G license/provenance check required. G prevents generation input and shipment
recommendations until resolved; it is not a finding that a package is illegal.

| Location / group | Stored files and dimensions | Runtime / style / quality | Verdict and provenance |
|---|---|---|---|
| `public/assets/characters/warrior/` | 24 RGBA PNGs; 192px cells; idle 768×192, walk/attack 1536×192, north attack 1344×192, Power Slash 1920×192; older masters 128/160/192px | Current master/registered strips production; other masters not necessarily loaded. Illustrated chibi; grounded directional animation | A current registry; C older concepts. Character manifests record PixelLab production; keep approved identity |
| `public/assets/characters/{archer,mage,cleric,ninja}/` | 14 RGBA PNGs each; 192×192 directions/master, 768×192 idle, 1536×192 walk/attack | Registered art, progression unavailable; visually production-ready core poses, no class skills | A preserve; no new class production scope |
| `public/assets/monsters/*.png` | 8 RGBA two-frame idle strips; exact cells in coverage table | Production illustrated chibi, procedural action fallback | A idle/reference; new action art needed |
| `public/assets/monsters/crypt_brute/` | 5 RGBA strips; 176×144 cells; 352/1056/880/1760/528×144 | Fully integrated five states, runtime shadow, existing code death | A LOCKED; generated provenance in `art-source/monsters/crypt_brute/pass-4b/` |
| `public/assets/environment/town/` | 27 RGBA PNGs: 6 facades, 19 props, 2 atlases; varied dimensions, 64px ground frames | Approved Town; smooth facades/props plus corner ground | A; preserve. Mixed project generation history, recorded in Town docs and source jobs |
| `public/assets/environment/field/` | 11 RGBA PNGs: atlas 544×680, 10 props. Tree120×160, pine88×168, cave200×168; small props64×64; big rock/tent128×128 | Integrated ground and accepted props; coherent with Town; water motif repeats | A except future water-base improvement. Pass 2 image_gen sources; Pass 3 small props explicitly PixelLab jobs |
| `public/assets/environment/dungeon/` | 7 PNGs: opaque atlas408×68; pillar64×152, torch64×88, throne200×224, brazier/bones/rubble64×64 | Integrated cool stone; warm flames; code furnishings remain | A; image_gen-derived Pass 2 plus Pass 3 prop pipeline |
| `public/assets/ui/haven/medallion.png` | 1 RGBA PNG256×256 | Shared bronze socket; CSS leather/steel panels; original SVG emblems | A; `art-source/ui/haven/generation.json` records original generation |
| `public/assets/ui/skills/` | 10 RGBA PNG96×96 | Registered illustrated active-skill symbols | A; fitted from original demo candidates |
| `public/assets/vfx/combat/` | 6 RGBA strips; 768×128 slash pair, 576×96 impact trio, 256×64 projectile | Integrated illustrated effects; event-driven pooled views | A / D; original generated source set |
| `art-source/characters/` | 360 PNG + 2 JSON, TXT/HTML. Raw280 mostly192×192 (21 are204×204); Warrior38; cleanup11; design9; deprecated9; QA13 | Source-only; manifests, accepted animation frames, rejected/old variants, previews | B accepted raw frames only; C designs; E QA; F deprecated replacement. Do not mix identities |
| `art-source/environment/town/` | 4 PNG + generation JSON; sources1254×1254 /1774×887, wall tile64×64 | Source-only original wall/flowers/tuft | B for reproducibility, not new bulk integration |
| `art-source/ui/haven/` | PNG1269×1240 + JSON | Socket source / exact prompt | B source fitting; A shipped derivative |
| `art-source/monsters/crypt_brute/` | 29 files; 8 PNG, scripts, prompts, fit JSON, README; accepted sheets mostly1536×1024 | Locked source + reproduction pipeline, source-only idle duplicate | A identity; B scripts as reusable fitting approach. Do not rerun outputs into Brute |
| `art-source/candidates/demo-v1-20261007/` | 136 files; 78 PNG, 34 JPG previews,14 GIF; 34 fitted asset deliverables with manifest | Original image_gen candidates; many already integrated, not 34 new assets | A approved corresponding runtime art; B fitting sources; C rejected A4 water; E previews. Own mechanical PASS is not runtime approval |
| `art-source/candidates/crypt_brute-ref-20261010/` | 6 files,5 RGBA PNG; includes224×108 old fits and1804×872 reference | Old candidate fit / locked-reference history | C archive reference; F obsolete112×108 contract outputs; preserve files |
| `art-source/candidates/pass-4b-skeleton-brute/` | 76 files,32 RGBA PNG, logs/prompts/fits | Mixed attempts/previews/accepted derivatives | B only accepted provenance mapped in tracked `pass-4b/`; E diagnostics; F rejected attempts as finals |
| `art-source/candidates/Polyart/` | 1821 files;112 FBX,145 prefab,264 PNG,20 TGA; PNG mainly512–4096 square | Dreamscape Meadows/Campsite 3D meshes/material maps, not flat sprites; unused | G + B conditional render-to-2D, otherwise C. No local entitlement/AI-use grant established; conversion slower than reusing integrated props |
| `art-source/candidates/Stylized3DMonster/` | 5524 files;36 FBX,1068 `.anim`,456 prefab,438 PNG (432 at2048²,6 at1024²) | Monster07–36 + MT01–06; UV textures, shader-dependent 3D animation; unused | G + C. Technically renderable, but illustrated chibi match unproven; cannot ship texture maps as sprites |
| `art-source/candidates/Eric VFX Studio/` | 4204 files;453 PNG,43 TGA,8 TIF,75 FBX,353 prefab; common128/256/512² textures | Six Unity effect collections plus shared Resource; alpha masks/material inputs, not necessarily animation strips | G + D; conditional B after clearance. Vendor-prefixed texture provenance unresolved |
| `art-source/candidates/CasualStrategyUI/` | 859 files;316 PNG (277 alpha-capable),35 prefab,19 C#,1 TTF; icons82² etc.,31 portrait1080×1920 images | Unity mobile strategy UI; cheerful plastic/blue/brown themes, mismatched to Haven metal/leather; unused | G + C for art; B optional isolated generic item/currency icon only after clearance and review. Screenshots/prefabs are not ready HUD assets |
| `art-source/candidates/Customizable Stylized Lava Shader/` | 40 files; PNG3000²,TIF,OBJ,shader graphs,PDF,prefabs | 3D lava material; no Demo lava need | F for current scope; G if ever reconsidered |
| `legacy/assets/` root/icons/heroes/portraits | Root23 PNG+6SVG, heroes8 strips1344×204, icons5×128², portraits9 images mostly480×720 | Old procedural pixel/vector roster, disconnected from Phaser | E / C; F as final art. Manifest records original generators; palette-reference inputs not all archived |
| `legacy/assets/monsters/` | 212 RGBA frames640×960; Skeleton36, Slime34, Orc36, StoneWolf34, SpiritArcher36, Golem36 | Old approved-runtime motion sequence exports; no current loader; sampled Stone Wolf detailed/realistic | C + G for source rights; B extraction only if a later style review overturns mismatch. Historical approval is not permission for AI transformation |
| `legacy/assets/v5/` | 20 PNG +1JPG; variable~512px characters, board texture | External AI/upload pipeline, different visual direction | G + C; no direct reuse or AI input until provenance clarified |
| `tmp/env-art/` | 11 PNG:2 intermediate64²,9 PixelLab prop sources64²/128² | Existing build inputs, not runtime locations | B preserve accepted inputs; E intermediates. Do not delete or commit diagnostics |

## Special old/Unity content findings

| Requested content | Direct shipment? | Render/convert? | Reference / VFX decision |
|---|---|---|---|
| Death Knight, dragon, fire demon, fox, frost wraith, goblins, ice queen, salamander | No matching named 2D production export verified | Numbered FBX pack may contain related silhouettes, but species mapping and camera/style match unresolved | G; do not identify numbered models by guess or send their textures to generation. Unneeded new roster is post-Demo |
| Golem / wolves / slime-jelly | Current Guardian/Wolf/Slime idle art already production; legacy Golem/StoneWolf/Slime motion also exists | Legacy frames can technically be packed; palette/detail/identity differ | Current A; legacy C + G; not a replacement for approved creatures |
| Trees / bushes / stump / sign | Current Field assets already integrated | Polyart has `SM_TreeLarge_*`, `SM_Birch_*`, `SM_Bush_*`, `SM_TreeStump_01`, `SM_WoodSign_01` meshes; conditional G+B render | Keep current A. 3D renders add lighting/outline work without filling a critical gap |
| Pine / sakura / dead-tree / lamp | Current pine, Town cherry tree and lamp ship already; Polyart fallen-tree mesh found | Exact new pine/sakura/dead-tree/lamp source identities in old packs not verified | Do not promise a nonexistent export; no replacement needed for accepted production art |
| Slash / impact / fire / aura / crack / rune | Six current VFX strips ship; Unity prefab does not | Eric materials/meshes could be rendered to transparent sequences after entitlement/provenance check | D+G shortlist below; no external AI input. Blood/beam/lava packs not needed |

Direct game reuse, render-to-2D redistribution, and AI-reference/transformation are
three separate clearance questions. Readmes describe install/runtime requirements,
not an AI grant. Verify package identity, entitlement, included texture attribution,
font license and permitted export/reference use with the actual terms before use.
No third-party files were submitted to any generation tool during this audit.

## Current monster coverage

All eight Pass 2 idles are `public/assets/monsters/<id>.png`, two frames @3fps,
east source mirrored west; not four-direction sheets. P = procedural motion;
death = existing squash/fade, no final death frames for any monster.

| Monster | Current cell / feet row | Idle | Walk | Basic attack | Special | Hit | Death | Contract / gap |
|---|---|---|---|---|---|---|---|---|
| Slime | 56×48 /46 | Real2 | P | P | No distinct required signature in current data | P/flash | Code | No full-strip contract; frequent Field polish |
| Wolf | 86×60 /58, visual1.08 multiplier | Real2 | P | P | No distinct signature | P/flash | Code | No contract; frequent Field polish |
| Mushroom | 68×60 /58 | Real2 | P | P | No distinct signature | P/flash | Code | No contract |
| Elite Boar |110×80 /78 | Real2 | P | P | Gore telegraph + P | P/flash | Code | No contract; elite polish |
| Grove Guardian |142×136 /134 | Real2 | P | P | Stomp telegraph + P | P/flash | Code | **pending**208×160 /158; five states needed |
| Crypt Skeleton |70×84 /81 | Real2 | P | P | No distinct signature | P/flash | Code | No contract; repeated tutorial enemy |
| Skeleton Brute |**176×144 /142** | Real2 | Real6 | Real5 | Real10 | Real3 | Code | **integrated / locked**, all five strips; fallback only on failed loading |
| Crypt Knight |120×108 /106 | Real2 | P | P | Cleave telegraph + P | P/flash | Code | No contract; do not invent one during audit |
| Crypt Lord |146×164 /162 | Real2 | P | P | Grave Slam telegraph + P | P/flash | Code | **pending**224×192 /190; strongest remaining focal gap |

At alpha>=32: Brute idle heights94/95, walk90–95, lowest row141; Lord
old idle heights151/149 with lowest161/159; Guardian old idle132/132 lowest133.
These measurements are source-frame bounds, not authorization to resize runtime
art or proof of future animation consistency. A fallback sheet's alpha bounds
need not meet the newer production animation contract.

## Player and environment coverage

Warrior is usable for final Demo without regeneration of its identity:192px cells,
normalized40world-px height, south/north/east idle4@5, walk8@10; mirrored west.
Basic attack south/east8@18, north7@18, hit frame4. Power Slash **south only**
10@16, hit frame5 (312.5ms). Other Warrior skills use existing generic presentation;
no full directional skill-pose set. P1: north/east Power Slash, mirrored west,
same master/192px contract; don't change gameplay to fit poses. Fire Bolt cast,
Dodge and buff poses can remain simplified for Demo. Other classes already have
4-frame idle/8-frame walk/8-frame basic attack in3 authored directions, with
class-specific attack fps. Their Class1 progression stays unavailable; no new
tree, skill animations or Class2 art needed.

Field: grass/dirt/dark-grass/moss/Wang transitions and accepted tree/pine/cave/
bush/rock/sign/tent/fire/stump art are integrated at0.5 with existing footprints.
Town flowers/tufts are reused. Pond shoreline works; visibly repeated wave motif
should be replaced locally, preserving shoreline masks/collision. Border walls,
standing stones, giant mushrooms, ruin pillars, pebbles/small mushrooms still
expose code art. No new fence pack needed unless actually placed in current map.
Camp art is coherent and player silhouette readable at1.65; obvious blocky
mushrooms/standing stones break the illustration language. Clutter additions and
new navigation layouts are unnecessary.

Crypt: floor and wall-top tile skin, pillars, torches, brazier, throne, bones/rubble
are production. Carpet runner, sarcophagus, banners, rune decoration, portals and
cobweb are code art/fallback. Gate seals and checkpoint pulses are intentional
functional code feedback; production door/frame art is absent. Prioritize visible
carpet/furnishing and doorway mismatches without hiding telegraphs or altering gates.
Boss-room screenshot clearly separates the Lord/player from cool ground, but broad
checker carpet and repeated code webs still look temporary. Brute's approved style
fits this palette. NPCs use the two-layer32×44 tinted code figure, not production.

## HUD / localization / Shop

Current locked composition already exists: compact portrait/resources top-left;
minimap with exactly Shop/Daily/Map in a horizontal row near top-right; tracker
below; ATK largest with5skills+Dodge+HP/MP; Character/Inventory/Skills/Quests/More
on a shared bronze/leather bottom strip. Position is viewport-aware and offset
to avoid combat, not simply screen-centred. Keep functional geometry; finish
spacing through supported-size review, not a new pack/layout.

One original256px medallion plus CSS bronze/steel/leather and SVG emblems is
already a coherent frame family. Ten active icons are illustrated; utilities,
item slots and passive/proc nodes are less finished. Nunito/system sans, serif
display headings; Thai-specific fallback stack and11px label floor. Font names
in CSS do not guarantee identical installed glyph metrics across devices.
Shop in utilities and More is an intentional shortcut, not a second shop system.

Shop **already has Gold/Diamond tabs**, real wallet balance, preview catalogue,
TBD prices and disabled purchases (`shopView.ts`, `shopCatalog.ts`). Polish icons/
cards only; purchase/payment/economy is not authorized by visual production.
Thai **already has a typed en/th string table**, URL/device locale persistence
and HUD/menu/shop chrome coverage. Item/quest/NPC/skill data and combat messages
still contain English; next task is coverage/copy/overflow QA, not a new i18n system.
Minimum640×360;844×390 and960×540 remain the review sizes. Don't pursue568×320.

## VFX reuse shortlist

| Asset / path | Decision | Modification / role |
|---|---|---|
| `vfx/combat/melee_slash.png`6×128² | A | Already compatible:0.34scale/180ms; keep basic strike event anchor |
| `power_slash.png`6×128² | A | Already0.44/220ms; heavy slash and Power Slash; retain hit event timing |
| `hit_impact.png`6×96² | A | Already0.32/200ms; ordinary hit spark; crit code sparkle remains |
| `heavy_impact.png`6×96² | A / D | Already0.4/240ms; possible shared heavy/Bone Smash support through existing damage event; no new effect tonight |
| `fire_bolt.png`4×64², `fire_bolt_impact.png`6×96² | A | Already projectile14fps/.36 and impact260ms/.36; do not change projectile path |
| `CombatEffects.ts`, `damageNumbers.ts`, `CombatWorld.ts` Dodge opacity cue, `GateBarriers.ts` and checkpoint feedback | A code | Keep tint flash, crit spark, green HP/cyan MP numbers, restrained Dodge cue and accurate telegraph circles; no new textures required |
| Eric `Resource/Textures/Common_ImpactRing.png`, `Blue_Ring01.png` | G + D, conditional B | Sampled ring is a generic alpha component; requires cleared texture rights, blend/tint/scale conversion and event-driven playback; not a ready Bone Smash strip |
| Eric `aura_C001.png`, `aura_C002.png`, `aura_C005.png`, rune/arcane ring TGAs | G + D, conditional B | Potential quiet regen/enrage/checkpoint support after clearance; no need to replace readable current code rings |
| Eric slash/hit/explosion-prefab collections | G + D, conditional B | Requires Unity render-to-transparent sequences plus fitting; much more work than retaining six current strips |
| `CFXM3_*`, `bretto_*`, `Gameart8*` texture families | G | Vendor attribution must be resolved individually; package placement is insufficient proof |
| Legacy `vfx.svg` / procedural effects | E / C | Development ideas; incompatible old scene/event/pool architecture, no direct swap |
| Blood effects / long beams / lava shader | F for Demo | Wrong role/detail/noise; add neither blood identity nor a lava biome |

## Generation priorities and owner split

For every P0/P1 below: Codex may generate after explicit instruction; CC fits,
validates and integrates approved outputs. No asset generation begins from this
audit. Use only approved project-generated/user-cleared references; generation
history establishes lineage, not permission to import unrelated store content.
All new characters: smooth chibi, coloured outlines, broad shading, upper-left
light, east-facing monster sources, alpha/no baked shadow, stable proportions.

| Tier | Subject / states / target source | Reference / role / scope |
|---|---|---|
| P0 | **Crypt Lord** five states;224×192 cells; exact contract in next brief | Approved Lord idle/high-res demo source; safe project lineage; Story/Lv20 boss focal point. image_gen suitable; don't use Death Knight pack |
| P0 | Grove Guardian five states;208×160 cells,feet158,standing124–140; idle2@3,walk8@8,attack5@12, special3+2+2+3@12, hit3@15; Stomp1000ms | Approved Guardian/source; image_gen suitable; heavy branch/leaf identity consistency; fit/integrate after Lord proof |
| P0 | Core NPC figures (six existing roles), static first; roughly64×88 source canvas to preserve current32×44 visual envelope, final fit contract needed | Warrior/Town as safe style anchors, `npcData.ts` as roles; no approved NPC identity source. Generate only existing NPCs; walking not needed |
| P1 | Six remaining monsters: Slime/Wolf/Mushroom/Boar/Skeleton/Knight; idle/walk/attack/hit, existing signatures where present | Approved idle art safe references. Existing cells56×48 to120×108 are identity/scale anchors, not proven action canvases; CC define contracts/headroom first. No invented fps/durations |
| P1 | Crypt gate/door frame, sarcophagus and carpet | Current code geometry as placement reference plus approved Crypt props; roughly2× world footprint; gate span from `dungeon/gates.ts`, not guessed. Static/open-state art only; do not affect gate rules |
| P1 | Standing stone, giant mushroom, ruin pillar, cobweb | Safe Town/Field/Crypt references; existing1×1 footprints; roughly64×64–128 source height as fitting allows, not new collision. Cobweb must be restrained overlay; prior candidate rejected |
| P1 | Water base without obvious motif | Approved ground palette/shoreline;64×64 final tile(s), larger source suitable; seamless repeat review; preserve masks and solid cells |
| P1 | Existing item icons +4 Warrior passive/proc symbols | `itemData.ts`;96×96 icon targets matching current skill set; Heavy Armor Mastery, Sword Mastery, Guardian Instinct, Battle Instinct (two passives +two procs, not four passive mechanics). Own symbols; no new skills |
| P1 | Warrior Power Slash north/east (west mirrors) | Approved Warrior directional art/master;192² cells,10@16 hit5 as existing south; identity lock and planted feet. Existing action slots accept direction entries |
| P2 | Illustrated utilities/currency, subtle heal/regen, boss impact crack/aura, remaining small clutter | Current original SVG and reusable VFX sufficient to show Demo; generate only if review identifies a readability gap |
| POST-DEMO | Death strips, full cast/buff set, non-Warrior skills/Class2, pets/extra biomes/rosters | Keep code death/generic action feedback and visible class locks |

## Fastest path to Demo Final

| Phase / effort | Exact tasks / dependencies | Parallel work / roles | Skip for Demo |
|---|---|---|---|
| A Monsters — Large | Lord first, Guardian second; six others after small contract definitions, each verified like Brute | Codex sources sequential identity lock; CC fits/test/integrates approved set. Environment can proceed independently; never shared-file concurrent integration | Brute changes, death frames, new roster; procedural common mobs can be the fallback if schedule slips |
| B Environment — Medium | Existing NPCs; local gate/carpet/furnishing and stone/mushroom/pillar/web/water replacements | Can run beside A once target sizes frozen; Codex source art, CC existing-kind registries/visual QA | More clutter, new maps, rebuilding Town, Unity scene conversion |
| C Player/VFX — Small–Medium | Preserve Warrior core; directional Power Slash if needed; tune existing event-aligned assets visually | Can prepare during A/B; CC validates attack windows/pooled views | New VFX engine, full skill poses, effects that obscure telegraphs |
| D HUD/UI — Medium | Existing item/passive icons, one frame family, spacing/readability at3sizes, keyboard/touch and menu QA | Icons parallel with A/B; final composition after art dimensions settled; Codex symbols, CC UI integration | Full redesign, utility pack import, 568×320 |
| E Thai/Shop — Medium | Fill missing player-facing copy and glyph/overflow coverage; finish existing Gold/Diamond preview presentation | Can start copy audit in parallel; CC string mapping, Codex copy/icon review | Purchases, pricing invention, deep economy/payment integration |
| F Final QA — Medium | Legitimate Story first clear and Field exploration; normal/compact/narrow, save/migration, full tests, perf warm/cold, art-off geometry compare | Serial after integrations stable; CC functional evidence, Codex visual review | Reopening combat balance or adding systems to make animation fit |

Demo release gate: boss/elite identity and action readability, approved NPC/environment
focal art, readable touch HUD and correct language copy. Do not require every
optional particle or common-mob death animation to be complete before showing it.

Explicitly defer Party AI, 40AIplayers, Online/server, Weight Capacity/Reward Cache,
non-Warrior trees, Class2, pet expansion/cards, deep economy, new towns/dungeons,
and unsupported568×320. Design source still has open weight/cache work; that does
not make it a dependency of this visual pass. No full browser/typecheck/build run
is needed for this documentation-only audit.

## Next execution

Generate **Crypt Lord only**, idle/identity first, using
[the technical prep brief](crypt-lord-production-prep.md). Keep candidates separate;
CC then fits/validates/integrates against the existing generic animation system.
No animation-system refactor is required for Lord/Guardian: five-state loading,
event timing, mirroring, fallback and body-preservation already shipped with Brute.

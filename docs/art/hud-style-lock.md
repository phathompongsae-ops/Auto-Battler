# Haven HUD / UI style lock — V1 (Visual Production Pass 1)

Status: production HUD and System Menu pass implemented 2026-10-07. **Visual Production Pass 1 (2026-10-08)** restructured it into one designed interface: camera, information architecture, Shop shell and Thai foundation. Town Environment V1 is user-approved and preserved. Original UI; no reference game's art was used.

Direction: **classic fantasy MMORPG world + modern mobile MMORPG UX.** Ragnarok Origin (ROO) is used **only as a benchmark** for hierarchy, menu density, spacing, button importance, minimap/utility organisation and commercial polish. No ROO assets, artwork, frames, icons or exact layout are copied. Haven keeps its own chibi fantasy identity, bronze / dark steel / leather language, approved character art and combat systems.

## Camera (locked)

Gameplay zoom **1.65** (`src/config.ts` `CAMERA_ZOOM`; 1.35 originally, 1.55 in Pass 1). This is the scale Visual Pass 2 assets are judged at. The Warrior (40 world px) reads at ~66 screen px, and the 960×540 view spans ~582×327 world px.

How it was chosen: the camera re-evaluation (2026-10-08) compared 1.55 / 1.60 / 1.65 in Green Meadow combat, a Story Crypt skeleton fight and the Crypt Lord's Grave Slam wind-up, at 960×540, 844×390 and 640×360. The rule was "the closest zoom that keeps combat and telegraph readability", aiming for a modern chibi MMORPG camera rather than a tactical map view. At 1.65 the 84 px Slam circle still fits entirely on screen at every size: at 640×360 it sits under the boss target frame, clear of the quest tracker and system strip, and its right edge just reaches the MP Potion socket (as it already did at 1.55). It leaves 129 world px above and 199 below the boss inside the view. That is only ~6% tighter than 1.55, while the player and monsters read noticeably larger.

Characters are not rescaled and gameplay geometry is unchanged. Camera bounds clamp at every map edge: the smallest map dimension is 30 tiles = 960 world px, wider than the 582 px view, and the clamp was verified in every capture. World landmark labels stay at 10 world px with 85% opacity (≈ 16 screen px) and nav markers at 9 world px, so signage stays quieter than the player and the HUD.

## Structure

| Region | Locked contents |
|---|---|
| Top-left | Compact portrait, current job/name, level, labelled HP/MP bars, EXP and Gold |
| Top-right | Bronze-framed minimap; **one horizontal row of three world utilities — Shop, Daily & Weekly, Area Map —** to its left, bottom-aligned with the minimap (below the target frame's band); collapsible quest tracker underneath |
| Bottom-right | One combat cluster: ATK; Skill 1–5 on one arc; Dodge; HP / MP Potion |
| Lower-middle | Character, Inventory, Skills, Quests and More crest strip, **centred on screen** when the cluster allows it (960×540 and up), otherwise as central as the cluster's reach allows; never left of 130px, so the left thumb area stays clear for the floating joystick |
| Centre | Open gameplay; existing target and contextual interaction/respawn notices |

### HUD information architecture (Pass 1 audit)

| Class | Controls |
|---|---|
| A. Primary combat | ATK, Skill 1–5 |
| B. Secondary combat | Dodge, HP Potion, MP Potion |
| C. World / utility | Minimap, Shop, Daily & Weekly, Area Map, quest tracker, talk prompt |
| D. System menu | Character, Inventory, Skills, Quests, More |
| E. Moved into More | Settings (was pinned top-right); still in More with Auto Potion preferences and the new Language choice |
| F. Removed / redundant | The second, top-right More button (duplicate of the strip's More); the inert Special and Pet / Summon placeholder sockets (no mechanic behind them) |

Every function stays reachable: More lists all 13 implemented screens, including Shop, Settings and Area Map. Pet, Party and Dungeon placeholders stay out of the grid, as before.

### Combat cluster (locked)

Hierarchy: **1 ATK** (96px at scale 1, warm halo, crossed swords + gold ATK label) > **2 Skill 1–5** (58px, minimum 44px) > **3 Dodge** (48px, cool steel-blue face) > **4 HP / MP Potion** (42px, minimum 40px; calmest contrast). ATK is inset 120 design px from the right edge so the skill arc wraps from its left, over its top, to its upper right. The gaps are an even ~8px at the compact minimum sizes. Dodge sits beside ATK on the right edge. HP and MP ride an outer arc (radius 190 at 200° / 225°) beyond Skill 1–2. The cluster box is 326×216 design px, and **one geometry serves every supported viewport** (no compact repositioning). Positions live in `src/ui/data/actionBar.ts`.

Labels: only ATK carries a word. Skills and Dodge read from icon + key hint. HP / MP carry a short tag on the rim, because they share the potion glyph. Key hints sit on the outer (top-left) side of each socket; ATK's sits under it. Touch devices hide key hints. Keyboard mappings are unchanged (Space, Q E R F G, Shift, 1, 2). Separation is measured between the round sockets (pointer hit-testing follows `border-radius: 50%`), and the centre of every socket hit-tests to itself. Corner insets respect device safe areas. Strip targets are at least 44px on one leather band with a bronze edge; compact strips use 50px slots (44px faces).

## Visual language

Warm leather backing, blue steel faces, sculpted bronze rims, restrained cream highlights. Serifs are limited to display headings/ATK; body and resource text use readable sans serif. An original Codex-generated 256px transparent medallion socket supplies combat/system rims and portrait ornament. Its Town Forge reference is a material anchor, not a copied shape. CSS supplies scalable leather, frame edges, pressed states and readable text; original SVG symbols supply central icons. Source and exact prompt are in `art-source/ui/haven/generation.json`.

- **ATK (locked):** the primary-action medallion: largest bronze/gold rim, a warm gold ready halo (box-shadow, never a filter), and an original code-drawn crossed-swords emblem (steel blades, bronze hilts, dark outline; `crossed_swords` in `src/ui/icons.ts`; no copied icon) above a gold serif ATK label. ATK shows no cooldown sweep or timer: its swing interval is not a player-facing cooldown.
- Typography (readability pass): every HUD label carries a 1px dark outline plus a soft shadow. Hierarchy: quest title (13px, 800, gold) > objectives (11.5px, 600) > key tags (10px, 800) and the HP / MP rim tags (9px). World signage uses the same sans stack with a dark stroke and shadow (landmarks 10 world px, letter-spaced, 85% opacity; nav markers 9 world px).
- The five skill rims share one construction. Ready skills have a subtle static highlight; unavailable sockets are muted with an empty marker. A soft, static radial shade behind the arc (no filter, no input) groups the sockets into one control on bright ground.
- **Cooldowns (locked):** the radial overlay is the primary indicator: a translucent dark-charcoal / dark-silver sweep (thin silver edge) over the icon face that uncovers it clockwise from 12 o'clock in step with the real remaining fraction (`--cd`); the skill art stays visible underneath. A small secondary timer, ~11–12px at normal scale (600 weight, cream, thin dark shadow, centred): whole seconds from 10 s, one decimal from 1.0 to 9.9 s without trailing zeros, hidden below 1 s (`formatCooldown`, `src/ui/components/Slot.ts`). No oversized (22px) cooldown numbers. A cooldown ending gets one brief opacity-only flash (no glow burst, no continuous pulse). No continuously updating CSS filters on combat HUD elements; per-frame writes touch only values that changed.
- **Combat numbers (locked):** world-space, pooled (32 texts + 6 crit sparks, created once; a recycled text renders its canvas once, with cached font metrics; no DOM, no filters, at most two bounded tweens each). Styles in `src/rendering/damageNumbers.ts`: normal hits warm cream 15px with a dark outline, a small pop, ~0.5 s rise-and-fade; heavy skills pale gold 17px; **critical** orange-gold 22px (~1.5×), heavier outline, a stronger springy pop, slightly longer, with a small code-drawn spark and a trailing "!" (a non-colour cue) and a little extra lift; damage **taken by the player** stays red (larger red for a critical); heals calmer green "+n"; Miss pale grey. Overlap: target-local slotting walks a fixed 6-spot fan (±14 px across, ≤12 px up) for rapid hits within 380 ms, then restarts at the centre; numbers always stay with their target.
- **Story feedback (locked):** tutorial lines use the left HUD feed (short, wrapping, bronze-edged, ~7 s, cleared on leaving the map; never over the combat cluster or quest tracker). Closed Story progression gates show a faint amber rune seal on the doorway floor (below every character; gentle shimmer only while closed; gone the moment the gate opens). A checkpoint's first activation shows one cool-blue pulse and "Retry point updated"; nothing persists and nothing suggests healing.
- Dodge and the potions share the round medallion socket at smaller sizes and calmer contrast. Disabled state is also exposed through `aria-disabled`.
- Player HP/MP show explicit labels and numbers. EXP retains its own gold bar.
- The minimap retains terrain, camera bounds, monsters, loot and player markers.
- Quests retain objective progress, offer/turn-in states and real Go/Auto Move actions. Adventure collapses/expands objectives with an accessible 40px control. The panel is 214 design pixels wide, capped at 140px height (90px compact) and scrolls for multiple tracked quests. Its Go target remains at least 40px.
- Gaps and decorative rims let input reach the world. Bottom-left stays clear.

### One frame family (Pass 1 unification, `src/ui/styles/interface.css`)

- Shared tokens: `--hud-bronze` / `--hud-bronze-light` rim, one corner motif (`--hud-corner`, 10/4 px diagonal) and one frame shadow.
- The player frame, minimap and windows use the same 3px double bronze rim. The quest tracker is deliberately quieter: a hairline rim, a bronze left edge and a lighter body.
- Every round control (ATK, skills, Dodge, potions, world utilities, strip crests) uses the same medallion socket. Selected = a thin bronze ring (`aria-expanded`). Disabled = muted icon, plus a small lock badge on locked utilities. Cooldown = the locked radial sweep.
- No backdrop blur on HUD panels: it re-blurred every frame the world moved underneath. No animated or continuously updating filters. Glow is limited to ATK's static ready halo.

## World utilities and Shop

The three top-right utilities are 40px round sockets in one row (6 px gaps). They are visually quieter than the minimap and the combat cluster, with no captions (name in tooltip / `aria-label`, hotkey in the tooltip). Locked ones (Daily & Weekly before Lv16) stay visible with a lock badge and their requirement.

**Shop** (`B`; also in More) opens a real window with separate **Gold** and **Diamond** tabs. Each tab shows the player's real balance and that section's entries. The catalogue is a **temporary development placeholder** (`src/data/shopCatalog.ts`): existing item ids, `price: null` ("Price TBD"), a visible preview notice, and disabled "Not on sale" buttons. Nothing can be bought, there is no payment integration, and the closed Shop has no DOM and no per-frame work. Prices, stock and limits belong in the gameplay source of truth before any purchase logic exists.

## Thai localization foundation

- One string table, `src/ui/i18n/strings.ts`: English ids map to `en` and `th` text, and the `th` table is type-checked against `en` (every key required). `t(key, vars)` fills `{placeholders}`. English is the fallback. Internal ids, screen ids and data titles stay English.
- Covered now: system strip, world utilities, More grid and window titles, tabs, quest-tracker chrome (Adventure, Go, new-quest / turn-in hints), talk prompt, combat utility names, Shop and Settings. Quest text, item names and descriptions are still English game data.
- Language is chosen in **More › Settings › Language** (English / ไทย) and saved on the device only (`localStorage`, not the game save). `?lang=th` forces Thai for review links. Default: English. Switching relabels the HUD in place and rebuilds the open window.
- The UI root carries `lang`. Under `:lang(th)` the Thai face leads the stack (Leelawadee UI, Noto Sans Thai, Thonburi, Tahoma), labels get line-height ≥ 1.35, letter-spacing is removed, and captions / crest labels have an 11px floor. World text falls back to the same Thai faces.

## Supported viewports

Minimum supported: **640×360**. Also reviewed: 844×390, 960×540, 1366×768. 568×320 is not supported. At every supported size: player frame, minimap, the three-utility row, quest tracker, system strip, ATK, Skill 1–5, Dodge, HP / MP, feed, Thai labels and the Shop window stay on screen, separate and tappable (skills ≥ 44px, utilities ≥ 40px).

## System menus and notifications

Five permanent crests use original hero/shield, satchel, rune-book, scroll and crest-grid symbols. They open existing WindowManager routes; feature locks still disable Skills and show requirements. More opens a four-column medallion grid of thirteen implemented screens (Shop and Settings included), with locked requirements where relevant. Pet, Party and the placeholder Dungeon screen are omitted; their existing feature/gameplay definitions and hotkeys are unchanged.

Area Map displays the current minimap terrain/player/monster/loot chart and position, with no navigation changes. Settings provides session-only reduced decoration, stronger panel backing and hidden keyboard hints, plus controls reference. There are no fake audio controls. Gameplay Auto Potion toggles/thresholds use a minimal persistent section in Settings; optional fields extend save v4 without a version bump.

Inventory counts new item acquisitions/equipment pickups since the last Inventory opening. Quests has a dot only for a completed quest awaiting turn-in. More aggregates either notice. Grid badges mirror the strip; opening Inventory clears its unread count. Notifications do not create fake mail/social systems.

## Verification / review

The full browser suite includes real attack/skill/menu/quest/drag/touch checks, plus layout checks at 960×540, 640×360, 844×390 and 1366×768. The review suite verifies: ATK > Skill 1–5 > Dodge > potions; nine live sockets only; round-socket separation and per-socket hit-testing; centre/movement visibility; the three-utility row (Shop first, one row, clear of the tracker and minimap); a centred (or reach-limited) strip; quest/strip separation; unavailable sockets; real badges; live screen routing; collapse/expand; map/settings functions; and cooldowns produced by real casts. `tests/browser/shopLanguage.test.mjs` covers the Shop (separate Gold / Diamond sections, real balances, nothing purchasable, Esc / B close, no state change) and Thai (relabel in place, real glyphs, labels fit at 960×540 and 640×360, the Shop fits at 640×360, English restores). Unit: `tests/unit/interface.test.ts` (string-table completeness and placeholders, locale switching, catalogue placeholders, cluster gaps at scales 0.8 / 1 / 1.5).

Capture prefix: `test-results/hud-production-`. Views 01–13 as before, plus 14–15 (Shop Gold / Diamond), 16 (Thai 960×540), 17 (Thai Shop 640×360) and 18 (Thai 640×360). The prior `hud-review-` captures remain available. Captures use the repository's automated browser runner; in-app Browser remains unavailable due its existing permission connection problem.
Focused commands: `npm run test:browser -- --environment-review` and `npm run test:browser -- --hud-review`; neither replaces the full suite.

Remaining limits: physical phone thumb reach and notch behavior still need device review. Active skills now use illustrated icons (Visual Pass 2, `src/data/skillIcons.ts`; drawn as the medallion face, with rim, key hint, cooldown sweep and locks unchanged); basic attack, Dodge and potions keep their vector glyphs, and bag item abbreviations still need illustrated item icons. The existing Skill Tree, equipment and service window bodies are functional, with shared production chrome, but remain simpler than a finished content-art pass. Field/Dungeon and NPC art still include placeholders and are unchanged.

Next milestone after user visual acceptance: **Visual Production Pass 2**: art candidate integration in the order given in `docs/art/visual-pass-2-candidate-review.md` (props, VFX, monster frames, crypt props, skill icons inside these sockets). Preserve gameplay, balance and saves. No candidate art is integrated yet.

# Haven HUD / UI style lock — V1

Status: production HUD and System Menu pass implemented for visual review, 2026-10-07. Town Environment V1 is user-approved and preserved. Original UI; no reference game's art was used. General mobile MMORPG hierarchy follows the user's brief.

## Structure

| Region | Locked contents |
|---|---|
| Top-left | Compact portrait, current job/name, level, labelled HP/MP bars, EXP and Gold |
| Top-right | Bronze-framed minimap; Area Map, Settings and More beside it; collapsible quest tracker underneath |
| Bottom-right | Largest ATK button, Skill 1–4 on an arc; outer utility sockets |
| Bottom-left / lower-middle | Character, Inventory, Skills, Quests and More crest strip, inset 184 design pixels; true left thumb area stays clear for the existing floating joystick |
| Centre | Open gameplay; existing target and contextual interaction/respawn notices |

At scale 1, ATK is 92px, skills 52px (minimum 44px) and utilities 38px with a 40px minimum hit target. The core arc has a 116px radius and 35° spacing. Utilities ride an outer arc (176px radius, 19° spacing) hugging the ring instead of a column into the play area; the cluster is 262×256 design pixels. The fifth skill/G binding remains usable on that arc. Special, Potion, Dodge, Auto and Pet/Summon positions are disabled reservations shown as glyph-only sockets (names in title/aria-label); this pass implements no mechanics for them. On compact landscape screens (height ≤ 420 or width ≤ 760), where minimum touch sizes no longer shrink, Skill 5 and the Pet/Summon reservation take dedicated compact positions and the four other inert reservations are hidden. Corner insets respect device safe areas. Strip targets are at least 44px and sit on one leather band with a bronze edge; compact strips use 52px slots (44px faces) so labels never touch, and keep their far edge outside combat.

## Visual language

Warm leather backing, blue steel faces, sculpted bronze rims, restrained cream highlights. Serifs are limited to display headings/ATK; body and resource text use readable sans serif. An original Codex-generated 256px transparent medallion socket supplies combat/system rims and portrait ornament. Its Town Forge reference is a material anchor, not a copied shape. CSS supplies scalable leather, frame edges, pressed states and readable text; original SVG symbols supply central icons. Source and exact prompt are in `art-source/ui/haven/generation.json`.

- ATK has the largest rim and a clear sword glyph plus ATK label.
- The four skill rims share one construction. Ready skills have a subtle static highlight; unavailable sockets are muted with an empty marker.
- Cooldown wipes darken the face inside the rim, with readable remaining time.
- Utilities use smaller rounded square sockets and calmer contrast outside the ring. Disabled state is also exposed through `aria-disabled`.
- Player HP/MP show explicit labels and numbers. EXP retains its own gold bar.
- The minimap retains terrain, camera bounds, monsters, loot and player markers.
- Quests retain objective progress, offer/turn-in states and real Go/Auto Move actions. Adventure collapses/expands objectives with an accessible 40px control. The panel is 214 design pixels wide, capped at 140px height (90px compact) and scrolls for multiple tracked quests. Its Go target remains at least 40px.
- Gaps and decorative rims let input reach the world. Bottom-left stays clear.

## System menus and notifications

Five permanent crests use original hero/shield, satchel, rune-book, scroll and crest-grid symbols. They open existing WindowManager routes; feature locks still disable Skills and show requirements. More opens a four-column medallion grid of twelve implemented screens, with locked requirements where relevant. Pet, Party and the placeholder Dungeon screen are omitted; their existing feature/gameplay definitions and hotkeys are unchanged.

Area Map displays the current minimap terrain/player/monster/loot chart and position, with no navigation changes. Settings provides session-only reduced decoration, stronger panel backing and hidden keyboard hints, plus controls reference. There are no fake audio controls and no save schema changes.

Inventory counts new item acquisitions/equipment pickups since the last Inventory opening. Quests has a dot only for a completed quest awaiting turn-in. More aggregates either notice. Grid badges mirror the strip; opening Inventory clears its unread count. Notifications do not create fake mail/social systems.

## Verification / review

The full browser suite includes real attack/skill/menu/quest/drag/touch checks, plus layout checks at 960×540, 640×360, 844×390 and 1366×768. The review suite verifies dominant ATK, four core skills, separate hit targets, centre/movement visibility, quest/strip separation, unavailable sockets, real badges, live screen routing, collapse/expand, map/settings functions and cooldowns produced by real casts.

Capture prefix: `test-results/hud-production-`. Thirteen views include all eleven requested Town/menu/close-up/combat/cooldown/Inventory/Character/compact views, plus desktop and 844×390. The prior `hud-review-` captures remain available. Captures use the repository's automated browser runner; in-app Browser remains unavailable due its existing permission connection problem.
Focused commands: `npm run test:browser -- --environment-review` and `npm run test:browser -- --hud-review`; neither replaces the full suite.

Remaining limits: physical phone thumb reach and notch behavior still need device review. Skill symbols and bag item abbreviations still need bespoke illustrated icon content. The existing Skill Tree, equipment and service window bodies are functional, with shared production chrome, but remain simpler than a finished content-art pass. Field/Dungeon and NPC art still include placeholders and are unchanged.

Next milestone after user visual acceptance: **Skill and Inventory Icon Production V1**. Add original illustrations for the existing skill/item roster inside these accepted frames; preserve gameplay, balance and saves. Field/Dungeon content is deferred.

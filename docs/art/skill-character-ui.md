# Skill + Character UI redesign (2026-10-11)

Started on `phaser-rebuild` at `88461bc7`. UI layout only. No gameplay, balance, camera, environment or theme
changes. The dark navy / steel surfaces, bronze edges and existing icon art are kept. The structure follows a
mobile-MMORPG pattern (loadout → categories → list → details) without copying any specific game's UI.

## Skills window (`src/ui/screens/skillTreeView.ts`)

- **Before:** a configuration list. A long points sentence, Q–G as text buttons, a second row of
  "Skill (Slot n)" buttons, "Clear a slot", and every node's full description in one long scroll.
- **After:**
  - **Header:** class crest, class, Lv, a compact Skill Points pill (earned / spent in its tooltip) and Reset.
  - **Loadout bar:** five medallion slots Q E R F G, the strongest element.
    - Equipped slots show the real skill icon; empty slots show a dashed "+".
    - Tap a learned skill, or Equip in its details, then a slot. Slots glow while armed. Dragging a skill onto a
      slot still works.
    - All of this goes through the real `SkillTree.assign` (swap, no duplicates, queued during an action), so the
      persistent hotbar is unchanged.
  - **Category tabs:** the tree's real branches (Core / Tank / Damage) plus a Passive filter over every passive
    and proc. No new branch was added.
  - **List:** each row shows icon, name, rank, an Active / Passive badge, one line of real numbers and a "+"
    learn button.
  - **Details:**
    - Larger icon, name, rank, badge and slot; the full description; real damage, stun, crit, radius, duration,
      cooldown, MP and range; the trigger for procs.
    - A next-rank preview, branch requirement and lock reason.
    - Learn / Upgrade and Equip / Unequip.
- **Responsive:**
  - **960×540:** list and details side by side.
  - **844×390:** the same layout, tighter.
  - **640×360:** one column. The details open as a drawer over the list only (the loadout stays visible) and
    have a close button.
- **Hooks kept:**
  - `data-learn`, `data-node` (with its rank), `data-assign-skill` / `data-assign-slot` and
    `data-skill-tree-state` keep their meaning.
  - `data-role=points` now carries `data-available`.
  - The detail panel uses `data-detail-node`.

## Character / Inventory (`inventoryView.ts`, `production.css`)

- **Before:** on small windows the seven stats became a full-width 7-column strip along the bottom.
- **After:** a framed 2-column stats sheet sits under the paper doll at every size (ATK / DEF, HP / MP,
  CRIT / ASPD, MATK). These are the real stats only, with the gear share still shown.
- **Small windows:** each side of the doll becomes a 2-column grid. The five armour / weapon slots sit left, and
  the off-hand, necklace and both rings sit right. The doll is three cells tall, so the stats fit without shrinking
  any touch target below the 40 px minimum.
- The bag (currency, bag count, tabs, grid, details and actions) stays on the right and remains the larger area.

## Strings

42 keys were added and 14 obsolete ones removed, all through the existing table: tabs, badges, the stat labels in
the details, proc text, Learn / Upgrade / Equip / Unequip, the loadout hint and the points label.

## QA

- **Typecheck and build:** PASS.
- **Unit tests:** 623/623.
- **`--skill-review`:** 10/10 (new SK-1…SK-6 and CI-12).
- **Other reviews:** character 21/21, HUD 40/40, warrior 24/24 (W-2 now reads `data-available`), icon 10/10
  (IP-6 reads the slot `aria-label`), chat 14/14.
- **Full browser suite:** 491/491 in one run (the previous 484 plus SK-1…SK-6 and CI-12), with no console errors.
  - HB-1/HB-2 (persistent hotbar), W-2 and CI-10 all pass.
  - No file changed during the run (SHA-1 before and after), and the lowest recorded free RAM was about 3.0 GB.
  - An earlier attempt was stopped by Claude Code for memory pressure at 84/84 with no failures; this is the clean rerun.
- **Performance:** the suite's combat check reads 119 FPS, p95 14.0 ms, max 34.7 ms. The redesign adds only static DOM, rebuilt on
  interaction, and no per-frame work.

## Remaining UI polish gaps

- Branch names and skill descriptions are game data (English); the tabs are localized.
- The class crest is a vector emblem; a class-specific illustrated crest would be a P2.
- At 640×360 the details drawer is short (about 170 px), so its body scrolls. It is readable, but a full-height
  sheet could be considered later.

# Character window / Inventory UX (2026-10-11)

One view (`src/ui/screens/inventoryView.ts`, `renderHero`) behind both the **Character** (C) and **Inventory** (I)
windows. There is one bag and one equipment set: the two windows differ only in their title. The layout follows
the structure of the reference screenshot (hero with slots, stats, bag, details). Visuals use the existing Haven
frame family (bronze, dark steel, leather) and no reference art.

## Structure

- **Top bar:** Gold and Diamond (real `Wallet` balances), the last action's result, and `Bag used / 48`.
  `Bag.capacity` is a real slot model; there is no weight UI.
- **Left: paper doll.** It shows the nine real `EQUIPMENT_SLOTS`: Weapon, Head, Armor, Gloves and Boots on the
  left; Off-hand, Necklace, Ring and Ring on the right. They sit around the hero's real south idle strip, played
  by a CSS step animation (no extra renderer; it stops with *Reduce decorative motion*). Worn items show a rarity
  frame and a `+N` enhancement badge; empty slots show their name. Selecting a worn slot shows its stats and
  **Unequip**.
- **Stats:** ATK, DEF, HP, MP, CRIT, ASPD (attacks per second from the real basic-attack interval) and MATK, all
  live combat stats. Each shows the equipment's share in green or red. The share is computed as the same
  `playerCombatStats` with the equipment modifiers left out. On compact screens the stats become one row across the
  window.
- **Right: bag.** Categories are All, Equipment, Consumables and Materials. Materials also holds eggs, boxes and
  quest items: everything that is neither equipment nor consumable. All adds empty cells up to capacity. Cells
  show rarity frame, stack count and `+N`, plus a small ▲ when the existing equip preview says a piece is strictly
  better (some stat up, none down). The chosen category stays while the window is open.
- **Details** are docked under the bag, with the action in its header so it is always visible. They show name in
  rarity colour, type, rarity, quantity / Equipped, stat layers, the existing comparison and sell value (information
  only). Actions call the existing player actions: **Equip** (`equipPlayerItem`), **Unequip**
  (`unequipPlayerSlot`) and **Use** for items with a real `use` effect (`usePlayerItem`; potions, the test stat
  reset, the dungeon ticket). Warp scrolls keep their Warp screen.
- No selling, dismantling, crafting, trading, storage, weight, sets, sockets, costumes or wings.

Selecting an item only moves the highlight and replaces the details. The grid is rebuilt only after an action or
a category change, and never per frame.

## Localization

New labels are in the string table (`tab.consumables`, `hero.*`, `slot.*`, `itemType.*`, `rarity.*`, `stat.*`),
in English and Thai. Item names, stat lines and comparison lines remain English game data, like quest text. Stat
abbreviations stay ATK / DEF / HP / … in Thai, as in the HUD.

## Verification

`tests/browser/characterInventory.test.mjs` (`--character-review`, also in the full suite) covers:

- opening from the strip, the nine slots, `+N` and rarity, the preview
- real Gold / Diamond / bag usage, and stats against the live combat stats with gear share
- an exact category split, and selection without grid churn
- Use, Equip / Unequip through the doll and bag
- the same bag in both windows
- fit at 960×540, 844×390 and 640×360, and Thai at 640×360

`inventory.test.mjs` I-5 now unequips through the paper doll.

## Deferred art (P1, not generated in this pass)

1. **Item icons:** potions (HP / MP, small / medium), the materials (Slime Gel, Wolf Fang, Mushroom Cap, Boar Tusk,
   Guardian Bark, Enhancement / Enchant / Protection Stone, Success Booster, Boss Fragment, Rare Craft Material,
   blueprints), eggs, tickets, scrolls, boxes and the quest item. Every bag cell currently uses the lettered-disc
   fallback.
2. **Equipment icons** for each `EQUIPMENT_DEFS` entry: the Traveler / Guardian / Warborn / Berserker sets, swords,
   greatsword, shield, rings and necklace. Weapons and shields use the vector sword / shield glyph; the rest use
   letters.
3. **Empty-slot silhouettes** for Head, Armor, Gloves, Boots, Necklace, Ring, Off-hand and Weapon. Text labels
   stand in for them now.
4. **Currency icons:** Gold and Diamond use the shared vector coin / gem.
5. A **paper-doll backdrop** (pedestal / soft vignette) behind the preview. A CSS gradient stands in for it now.

## Remaining limits

- Front-facing preview only (no rotate). Its art follows the job's sprite set (Novice uses the Warrior set, as in
  the world).
- Long English item names wrap in the details panel. On a 640×360 screen the details body scrolls for long stat
  lists, while the action stays in view.

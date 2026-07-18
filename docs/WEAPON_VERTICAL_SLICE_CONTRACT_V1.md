# Weapon Vertical Slice Contract v1

Status: Draft data contract for Demo 1. Runtime implementation remains CC-owned.

## Purpose

Prove the complete equipment loop with the smallest useful content set before expanding to the full catalog:

1. Buy equipment into a shared inventory.
2. Equip it to one of a hero's two equipment slots.
3. Rebuild combat stats from immutable hero base stats plus equipped items.
4. Unequip outside combat without losing the item.
5. Fuse one explicit Level 1 pair into one Level 2 item.
6. Reject invalid actions before charging gold or consuming items.

## Canonical vertical-slice catalog

| ID | Level | Price | Effect |
|---|---:|---:|---|
| `weapon.iron_sword` | 1 | 6 | `p_atk +8` |
| `weapon.apprentice_staff` | 1 | 6 | `m_atk +8` |
| `weapon.swift_gloves` | 1 | 6 | `attack_speed +8%` |
| `weapon.iron_armor` | 1 | 6 | `max_hp +120` |
| `weapon.duelist_blade` | 2 | 14 | `p_atk +14`, `attack_speed +10%` |

The four Level 1 items test physical offense, magical offense, attack speed, and survivability. All player heroes may equip them in the vertical slice. Repository paths and IDs retain the `weapon` prefix for compatibility, while the player-facing concept is Equipment.

## Minimal Equipment Shop

- Exactly two offer slots.
- Offers come only from the four Level 1 items, at equal weight.
- A single refresh costs 2 gold.
- There is no free Equipment Shop refresh.
- Equipment refreshes are separate from the Hero Shop and never consume or grant the Hero Shop's free refresh.
- Duplicate items may exist across the player's inventory, but the same refresh cannot show the same item twice.
- Level 2 is fusion-only in the slice; Level 3 is unavailable.
- No automatic free equipment reward is granted per stage.
- Buying one Level 1 item deducts exactly 6 gold once.

This is intentionally smaller than the future stage-based L1/L2/L3 shop. It proves the gold sink without making high-level equipment directly forceable.

## Fusion recipe

`weapon.iron_sword + weapon.swift_gloves -> weapon.duelist_blade`

- Manual confirmation only.
- Both inputs consumed once.
- Zero additional fusion fee in v1.
- One output created once.
- Unavailable during combat.
- Reject before consuming inputs if output storage is not guaranteed.
- Input order does not matter.

## Equipment and inventory

- Shared player inventory capacity is exactly 8 items.
- Every player hero has exactly two equipment slots.
- A hero cannot equip two copies of the same item in v1.
- Enemy and boss units do not use the player's inventory.
- Equip, unequip, purchase, refresh, and fusion occur only outside combat.
- Full inventory rejects purchase without deducting gold.
- Full equipment slots reject without moving or deleting an item.
- Equipped items do not consume shared inventory capacity while equipped; unequip requires a free inventory slot and otherwise rejects without mutation.

Capacity 8 is intentionally finite: large enough to test four L1 types and one fusion path, but small enough to force inventory decisions.

## Stat application

Runtime rebuilds derived combat stats from immutable base values at one central boundary. Equipment must never mutate canonical hero definitions or compound between battles.

- Flat `p_atk` and `m_atk` add after star-scaled base stats are built.
- `attack_speed_pct` multiplies rebuilt base attack speed once and reuses the existing clamp.
- `max_hp` adds once to star-scaled immutable base maximum HP before percentage Synergy or Augment modifiers.
- Removing an item removes its effect on the next rebuild.
- Zero values remain finite.

## Economy intent

Prices remain Level 1 = 6, Level 2 = 14, Level 3 = 30. Only L1 purchase and one L2 fusion are required. Equipment competes with heroes, EXP, rerolls, and interest. L2 cannot be bought directly and L3 must not be fabricated for Demo 1.

## Legacy note

The generic `weapon_lvl1`, `weapon_lvl2`, and `weapon_lvl3` rows in `game_config.json` are historical placeholders and must not be loaded alongside this catalog.

## Runtime acceptance criteria

1. Equipment Shop displays exactly two distinct L1 offers from the four-item pool.
2. Refresh deducts exactly 2 gold and is independent of Hero Shop refresh state.
3. No free Equipment Shop refresh accumulates or appears.
4. Buying an L1 item deducts exactly 6 gold once and creates one inventory item.
5. Insufficient gold and full inventory reject without mutation.
6. Inventory holds at most 8 unequipped items.
7. A hero equips up to two different items.
8. Iron Sword affects only P.ATK; Staff only M.ATK; Gloves only Attack Speed; Armor only maximum HP.
9. Effects apply once and never compound.
10. Iron Armor adds 120 maximum HP before percentage buffs.
11. Unequip returns the item only when inventory has room.
12. Iron Sword plus Swift Gloves manually fuse into one Duelist Blade.
13. Fusion consumes inputs once, creates output once, and cannot duplicate value.
14. L2 and L3 never appear as direct shop offers in the slice.
15. Combat, Economy income, Augments, Ninja, Secret Class limit, bosses, rewards, and run reset remain unchanged.
16. No NaN, Infinity, negative inventory counts, duplicate charges/items, or page errors.

## Deferred work

- Full Level 1 equipment catalog.
- Remaining Level 2 combinations.
- Level 3 fusion and stage-based shop odds.
- Equipment sellback and rarity.
- Class restrictions.
- Polished inventory UI, icons, and VFX.

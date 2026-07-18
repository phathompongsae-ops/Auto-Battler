# Weapon Vertical Slice Contract v1

Status: Draft data contract for Demo 1. Runtime implementation remains CC-owned.

## Purpose

Prove the complete equipment loop with the smallest useful content set before expanding to the full catalog:

1. Buy or receive an equipment item into shared inventory.
2. Equip it to one of a hero's two equipment slots.
3. Rebuild combat stats from immutable hero base stats plus equipped items.
4. Unequip outside combat without losing the item.
5. Fuse one explicit Level 1 pair into one Level 2 item.
6. Reject invalid actions before charging gold or consuming items.

This contract does not implement the shop, inventory UI, combat integration, or the full recipe matrix.

## Canonical vertical-slice catalog

| ID | Level | Price | Effect |
|---|---:|---:|---|
| `weapon.iron_sword` | 1 | 6 | `p_atk +8` |
| `weapon.apprentice_staff` | 1 | 6 | `m_atk +8` |
| `weapon.swift_gloves` | 1 | 6 | `attack_speed +8%` |
| `weapon.iron_armor` | 1 | 6 | `max_hp +120` |
| `weapon.duelist_blade` | 2 | 14 | `p_atk +14`, `attack_speed +10%` |

The four Level 1 items deliberately test four distinct stat paths: physical offense, magical offense, attack speed, and survivability. All player heroes may equip them in the vertical slice. Class restrictions are deferred until evidence shows they improve the game.

The repository path and IDs retain the `weapon` prefix for compatibility, but the player-facing system should be treated as an Equipment system because armor and future non-weapon items are valid members.

## Fusion recipe

`weapon.iron_sword + weapon.swift_gloves -> weapon.duelist_blade`

Rules:

- Fusion is manually confirmed, not automatic.
- Both inputs are consumed exactly once.
- Fusion costs zero additional gold in v1; the player already paid for or earned both inputs.
- The output is created exactly once.
- Fusion is unavailable during combat.
- If output storage cannot be guaranteed, reject before consuming either input.
- Input order does not matter.

## Equipment and inventory

- Every player hero has exactly two equipment slots.
- A hero cannot equip two copies of the same item in v1.
- Enemy and boss units do not use the player's equipment inventory.
- Equipping, unequipping, and fusion occur only outside combat.
- Buying while inventory is full must fail without deducting gold.
- Equipping while both slots are full must fail without moving or deleting an item.
- Inventory capacity is intentionally left for Runtime to choose after checking the existing UI space; it must be a finite shared-player capacity.

## Stat application

Runtime must rebuild derived combat stats from immutable base values at battle start or another single central boundary. Equipment modifiers must never mutate canonical hero definitions or compound between battles.

- Flat `p_atk` and `m_atk` modifiers add after star-scaled base stats are built.
- `attack_speed_pct` multiplies the rebuilt base attack speed once.
- `max_hp` adds once to the star-scaled immutable base maximum HP before percentage-based Synergy or Augment modifiers.
- Reuse the current Runtime attack-speed clamp.
- Zero values remain finite.
- Removing an item removes its effect on the next rebuild.

Exact ordering relative to Augments and Synergies must be documented by Runtime. The acceptance requirement is deterministic, single application with no base mutation.

## Economy intent

Prices remain aligned with the economy audit targets: Level 1 = 6, Level 2 = 14, Level 3 = 30. Only L1 purchase and one L2 fusion are required for this vertical slice. L3 is reserved for the full equipment system and must not be fabricated in Runtime merely to complete Demo 1.

The equipment loop is intended to become a meaningful gold sink competing with hero purchases, EXP, rerolls, and interest. It must not grant free equipment on every stage unless a later reward contract explicitly says so.

## Legacy note

The generic `weapon_lvl1`, `weapon_lvl2`, and `weapon_lvl3` rows in `game_config.json` are historical placeholders. They are not the named vertical-slice catalog and must not be loaded alongside these records as duplicate playable items.

## Runtime acceptance criteria

1. The shop or supported test path offers exactly the four L1 records.
2. Buying an L1 item deducts exactly 6 gold once and creates one inventory item.
3. Insufficient gold and full inventory reject without mutation.
4. A hero can equip up to two different items.
5. Iron Sword changes only P.ATK; Apprentice Staff only M.ATK; Swift Gloves only Attack Speed; Iron Armor only maximum HP.
6. Effects apply once to existing and newly purchased heroes and do not compound across battles.
7. Iron Armor adds exactly 120 maximum HP before percentage buffs and does not mutate immutable base HP.
8. Unequip restores the correct rebuilt stats and returns the item to inventory.
9. Iron Sword plus Swift Gloves can be manually fused into one Duelist Blade.
10. Fusion consumes both inputs once, creates one output, and cannot duplicate value.
11. Duelist Blade applies both declared modifiers once.
12. Fusion failure never consumes inputs.
13. Combat, Economy, Augments, Ninja, Secret Class board limit, boss identities, reward progression, and run reset remain unchanged.
14. No NaN, Infinity, negative inventory counts, duplicate charges, duplicate items, or page errors.

## Deferred work

- Full Level 1 equipment catalog.
- Remaining Level 2 combinations.
- Level 3 fusion and shop behavior.
- Equipment sellback.
- Class-specific restrictions.
- Equipment rarity and stage odds.
- Final inventory capacity and polished UI.
- Equipment art, icons, and VFX.

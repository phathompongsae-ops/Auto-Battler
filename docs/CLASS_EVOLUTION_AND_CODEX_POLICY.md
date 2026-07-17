# Class Evolution and Codex Policy

## Status

Locked design decision for the Auto-Battler project. This document defines UX and data expectations only. It does not change runtime behavior.

## Class evolution flow

- Class 1 heroes evolve into one of two Class 2 branches.
- Evolution is never random.
- When the required fusion inputs are completed, combat and other time-sensitive gameplay pause.
- A centered modal appears and presents both valid Class 2 choices.
- The player must select one branch before the evolved unit is created.
- There is no selection timer in the current PvE scope.
- Closing the modal without choosing is not allowed unless the fusion itself is cancelled before consumption.
- The selected branch is recorded in run state before visual replacement so save/load cannot change the result.

Example:

- `fighter` -> `knight` or `berserker`
- `archer` -> `sniper` or `ranger`
- `mage` -> `archmage` or `frost_weaver`

## Evolution choice modal

Each option must show enough information for a real gameplay decision without opening another screen:

- class name
- portrait or silhouette
- primary role icons
- damage profile
- attack range category
- short playstyle summary
- signature skill summary
- clear confirm button

The two branches should be visually comparable side by side.

## In-map guide entry

- A persistent circular guide button is available from the map/shop preparation interface.
- Selecting it opens the Game Codex.
- The guide button must not obstruct the board, bench, shop, economy display, or combat controls.
- Opening the Codex pauses gameplay where appropriate.

## Game Codex scope

The Codex is planned as a shared data-driven interface with the following sections:

1. Class Evolution
   - full Class 1 to Class 2 branch chart
   - branch role and playstyle summaries
   - secret classes shown according to discovery rules

2. Hero Index
   - hero role, damage type, range, stats, skill, class line, and suitable weapon tags

3. Monster Index
   - encountered monsters, elite variants, minibosses, bosses, skills, and notable counters

4. Synergy Guide
   - synergy thresholds and effects when the synergy system is finalized

5. Weapon Guide
   - Level 1, Level 2, and Level 3 weapons and fusion paths

## Role icon taxonomy v1

These are semantic IDs, not final artwork names. Final icon silhouettes and colors require a separate visual pass.

- `tank` — absorbs damage / protects allies
- `melee_dps` — sustained close-range physical damage
- `ranged_dps` — sustained long-range damage
- `mage` — magic damage or spell-focused unit
- `healer` — restores allied HP
- `support` — buffs, shields, utility, or control
- `aoe` — affects multiple targets or an area
- `single_target` — specializes in one target
- `burst` — high damage in a short window
- `assassin` — reaches or prioritizes vulnerable backline targets
- `summoner` — creates or commands additional units
- `economy` — generates or manipulates gold/shop value
- `control` — stun, slow, displacement, silence, or similar disruption
- `frontline` — intended for front rows
- `backline` — intended for protected rear rows

## Icon assignment rules

- Each hero should have 2 primary role icons.
- A third secondary icon is allowed only when it adds meaningful information.
- Avoid assigning broad icons that do not affect how the player positions or builds the unit.
- The same semantic icon ID must mean the same thing in the evolution modal, Codex, shop card, and unit detail panel.
- Text labels and tooltips remain mandatory; icons must not be the only source of meaning.

Initial examples:

- Knight: `tank`, `support`
- Berserker: `melee_dps`, `burst`
- Archmage: `mage`, `aoe`
- Ranger: `ranged_dps`, `single_target`
- Priest: `healer`, `support`
- Shadow-style assassin classes: `assassin`, `burst`
- Tycoon: `economy`, `support`

## Data requirements

Hero data should eventually support:

```json
{
  "evolutionOptions": ["knight", "berserker"],
  "roleIconIds": ["tank", "support"],
  "playstyleKey": "hero.knight.playstyle",
  "strengthKeys": ["hero.knight.strength.frontline"],
  "weaknessKeys": ["hero.knight.weakness.low_damage"]
}
```

Role icon metadata should remain centralized:

```json
{
  "id": "aoe",
  "nameKey": "role.aoe.name",
  "descriptionKey": "role.aoe.description",
  "assetId": "icon.role.aoe"
}
```

## Ownership boundary

Data, UI specification, localization, and icon metadata may be prepared without touching Core Runtime.

CC owns any implementation that changes:

- fusion consumption timing
- pause state
- unit replacement
- save/load sequencing
- combat state
- event queue behavior

## Planned follow-up work

1. Define all seven Class 1 branch pairs in data.
2. Assign role icon IDs to all Class 1 and Class 2 heroes.
3. Write short Thai and English playstyle summaries.
4. Add role icon definitions to the data schema.
5. Add validation for exactly two evolution options on each current Class 1 hero.
6. Prepare a UI wireframe specification for the centered evolution modal and Codex class tree.
7. Run a separate visual-design pass for the final role icon set.

# Realmfront Locked Direction

This file is the implementation guardrail for the current Web Alpha. Do not expand scope without an explicit user request.

## Core fantasy
Build a compact fantasy settlement, recruit a small army, explore for resources, fight short automatic battles, improve the settlement, resolve a major Season War every three in-game months, capture rival territory, and conquer both rival capitals.

## Visual direction
- Web-first 2D isometric pixel-art presentation with a compact classic management-game feel.
- Pixel art is now the locked production direction; avoid smooth vector/procedural web-demo styling in final visible assets.
- Small readable chibi pixel units with simple Kairosoft-like combat readability.
- The settlement must feel alive: residents walk, work, train, and occupy the town scene.
- Human, Arcane, and Demon factions must remain visually distinct.
- Prefer coherent local pixel sprite sheets, hard-edged tiles, nearest-neighbor rendering and restrained effects over heavy 3D or external runtime dependencies.

## Combat lock
- Automatic combat only.
- No skill tree, mana system, ultimate system, combo system, or tactical-grid micromanagement.
- Class identity comes from simple behavior, stats, range, timing, projectiles, healing, and readable hit feedback.
- Keep the animation vocabulary small: idle, movement, attack, hit, down/defeat plus lightweight VFX.

## Campaign lock
- Human is the playable faction; Arcane and Demon are AI rivals.
- Gold, Wood, Stone, Crystal only.
- Expedition team size: 3-5 units.
- The five expedition regions unlock at Town Hall Lv.1 through Lv.5 respectively, and recommended power is calibrated to the same Army Power scale shown in the UI.
- Season War occurs every 3 in-game months and must be resolved before further exploration.
- Each rival has three territory steps before its capital.
- Capital unlock requires three territory-war wins against that faction, all three territories captured, Town Hall Lv.3, and Army Power 330.
- Conquering both rival capitals wins the campaign.
- Losing battles must remain recoverable; no permanent softlock.
- Campaign target is approximately 8-12 Season Wars, not a long-form strategy campaign.

## Scope exclusions
No deep economy, supply/demand, taxes, long production chains, multiplayer/PvP, accounts/backend, diplomacy, romance, gacha, giant inventory, giant world map, deep crafting, giant tech tree, or complex manual tactical combat.

## Engineering rule
When a change conflicts with this document, fix the implementation rather than silently expanding scope. Prioritize a complete playable loop and visual readability before adding systems.

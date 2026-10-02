# New Project Direction

This branch intentionally replaces the active Realmfront implementation with a new 2D MMORPG-style web game.

## Locked technical direction
- JavaScript
- Phaser 3
- Vite
- GitHub Pages
- Desktop + mobile browser
- No Unity
- No Three.js as the main game engine

## First demo world
1. Starter Town
2. Surrounding Field
3. First Dungeon

## First classes
Warrior, Archer, Mage, Cleric.

## Art pipeline
PixelLab MCP is the preferred production-art source for characters, NPCs, monsters, pets, tiles, buildings, props, and animation frames.

Until PixelLab production assets are reviewed, the branch may use small clean placeholder sprite files. CSS/procedural character placeholders are not the target art direction.

## Vertical slice acceptance
Town Spawn -> NPC -> quest accepted -> Field -> Slime combat -> EXP + loot -> return to Town -> quest complete.

Future AI party and pet systems must remain possible without being implemented in this milestone.

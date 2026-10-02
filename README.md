# Aetheria Online Demo

A new lightweight 2D MMORPG-style web game prototype built with Phaser 3.

## Current vertical slice

Town spawn -> talk to Elder -> accept starter quest -> walk to field -> defeat one Slime -> gain EXP + Slime Core -> return to town -> turn in quest.

## Controls

Desktop:
- Move: WASD or arrow keys
- Interact: E
- Attack: Space

Mobile:
- On-screen D-pad
- INTERACT / ATTACK buttons

## Run locally

```bash
npm install
npm run dev
```

## Test and build

```bash
npm test
npm run build
```

## Project direction

- Web-first, desktop + mobile browser
- JavaScript + Phaser 3
- PixelLab MCP is the intended production-art pipeline
- First demo scope: one town, one field, one dungeon
- Four initial classes: Warrior, Archer, Mage, Cleric
- AI party and pet systems are future-compatible, not part of this first vertical slice

The previous Auto-Battler / Realmfront project remains recoverable from the backup branch created before this rebuild.

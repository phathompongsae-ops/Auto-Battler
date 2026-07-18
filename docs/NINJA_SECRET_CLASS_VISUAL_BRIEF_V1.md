# Ninja Secret Class Visual Brief v1

## Status

Documentation-only visual direction for the Map 1 Secret Class. This file does not define combat stats, runtime behavior, shop logic, save data, fusion logic, or camera/board implementation.

The exact production image is not yet approved or imported. All asset status remains non-canonical until the final PNG passes the canonical asset import checklist.

## Locked identity

- ID: `ninja`
- Display class: Ninja / Secret Class
- Gender: female
- Role fantasy: high-speed physical assassin
- Combat impression: sustained pressure through rapid attacks rather than one oversized hit
- Preferred target impression: slips past the frontline and threatens fragile backline enemies
- Durability impression: agile but visibly less armored than frontline melee classes

## Visual goals

The character must read immediately as a female Ninja at small Shop-card, Bench, and Board sizes.

Primary silhouette goals:

- compact, athletic body shape;
- low-profile layered cloth armor rather than heavy plate;
- clearly readable twin short blades, paired kunai, or one short blade plus visible secondary blade;
- forward-leaning combat stance that communicates speed;
- trailing scarf, sash, or split cloth panels that suggest rapid motion without making the silhouette resemble Mage, Archer, or Ranger;
- uncovered or partially covered face so the female identity remains readable at reduced size;
- no oversized sword, shield, bow, staff, or heavy gauntlets.

## Style target

Use the shared canonical character style:

- stylized 3D fantasy game character;
- hand-painted texture feel;
- soft cinematic lighting;
- polished mobile-game asset;
- chibi-influenced proportions with a large readable head and compact body;
- 3/4 front view;
- full body visible from head to feet;
- clean silhouette;
- combat-ready pose;
- transparent PNG only after actual alpha verification.

## Color and material direction

Recommended primary palette:

- deep indigo, dark violet, or near-black cloth as the main color;
- controlled crimson, magenta, or teal accent for readability;
- muted metal on blades and light armor plates;
- skin and face must remain visible enough to distinguish the character from a faceless Shadow Assassin enemy.

Avoid:

- olive-green hood/cape dominance used by Archer;
- bright woodland ranger materials;
- long mage robes;
- holy white/gold Acolyte styling;
- Fighter-style oversized metal gauntlets;
- full heavy armor that suggests Knight or Black Dragon Knight;
- a pure-black silhouette with no readable internal separation.

## Face and hair

- female face must remain readable when the image is reduced;
- expression: focused, confident, dangerous rather than cheerful;
- hair should not duplicate Archer or Acolyte styling;
- preferred options: short asymmetrical cut, high tied ponytail, or tightly bound hair with one readable accent lock;
- mask may cover the lower face, but eyes, brow, hair, and head shape must still communicate the character clearly;
- avoid a fully sealed helmet or hood that makes gender unreadable.

## Weapon direction

Preferred order:

1. twin short blades;
2. short blade plus visible kunai bundle;
3. paired kunai with one larger silhouette weapon.

Weapons must be large enough to remain readable at Shop-card size, but not so large that the character reads as Swordman, Duelist, or Blade Master.

No ranged-bow presentation. Thrown weapons may exist as secondary details only.

## Pose and motion impression

- low center of gravity;
- one foot forward and one foot ready to push off;
- blades held in two different angles to create an asymmetric silhouette;
- scarf/sash direction should imply fast movement;
- pose must still fit inside the standard card crop without limbs or weapons touching the image border;
- avoid crouching so low that the character becomes visually shorter than other hero cards.

## Small-size readability checks

Review the exact image at all three contexts:

### Shop card

- female face and Ninja identity readable immediately;
- both weapon silhouettes remain visible;
- head and upper torso survive portrait crop;
- dark clothing does not disappear against dark UI panels.

### Bench

- outline remains distinct from Archer, Duelist, and Shadow Assassin;
- weapon shape and accent color remain identifiable;
- feet and lower-body pose do not merge into the board.

### Board

- fast-assassin impression survives at gameplay scale;
- character is not mistaken for an enemy Shadow Assassin;
- team-side readability remains clear through accent color, outline, or approved presentation treatment.

## Distinction requirements

The Ninja must not visually duplicate:

- Archer: female woodland bow user, olive hood/cape;
- Ranger: female ranged woodland attacker;
- Duelist: male single-target sword fighter;
- Shadow Assassin: enemy unit identity;
- future Sword Saint: larger, more masterful sword silhouette;
- future Black Dragon Knight: heavy dark armor and large weapon silhouette.

A reviewer must be able to identify Ninja from silhouette, weapon pairing, accent color, and pose without relying on the class label.

## Asset path plan

Planned canonical path after approval and technical verification:

`assets/canonical/heroes/ninja.png`

Do not create or promote this path until:

- the exact image is explicitly approved;
- provenance is recorded;
- PNG format is verified;
- real alpha is verified;
- dimensions are recorded;
- background artifacts and checkerboard pixels are absent;
- reduced Shop/Bench/Board readability passes;
- registry status is updated through the canonical asset workflow.

## Approval gates

### Concept-approved

Requires approval of:

- female Ninja identity;
- high-speed physical assassin silhouette;
- weapon direction;
- palette direction;
- distinction from Archer, Duelist, and Shadow Assassin.

### Canonical-approved

Requires the exact PNG to pass `docs/CANONICAL_ASSET_IMPORT_CHECKLIST.md` and the asset review record.

### Card-ready

Requires successful reduced-size crop/readability review in the Shop Card system.

### Runtime-linked

Must be handled separately after Runtime ownership confirms the canonical asset ID/path. This brief does not authorize runtime integration.

## Generation brief

Create one female Ninja Secret Class character for a fantasy auto-battler. Full-body 3/4 front view, compact athletic chibi proportions, focused dangerous expression, layered dark-indigo lightweight cloth armor with a controlled crimson or teal accent, twin short blades, asymmetric forward-leaning combat stance, trailing scarf or sash suggesting speed, readable female face and hair, clean distinct silhouette, stylized 3D hand-painted mobile-game asset, soft cinematic lighting, centered composition, transparent background, no frame, no text, no icon, no number, no ground shadow.

The design must communicate rapid sustained physical attacks, agility, and backline-assassin pressure while also looking visibly less durable than frontline melee heroes.

## Scope safety

- no changes to `data/design/secret-heroes-v1.json`;
- no changes to PR #7;
- no changes to PR #13;
- no changes to `src/game.js` or `src/secret-class.js`;
- no combat values or skill mechanics are defined here;
- no image is declared canonical by this document alone;
- no complete Shop-card set should be produced from this brief yet.

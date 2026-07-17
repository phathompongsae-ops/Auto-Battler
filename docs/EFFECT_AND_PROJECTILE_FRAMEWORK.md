# Effect & Projectile Presentation Framework

## Purpose

Provide reusable presentation-only systems for combat visuals without changing combat truth, targeting, timing, damage, movement, camera, or the main game loop.

## Ownership boundary

These modules may display events that Core Logic has already decided. They must never:

- select targets
- calculate damage/healing
- decide hit or miss
- grant mana or gold
- mutate HP, status, cooldown, pathfinding, or turn order
- create additional combat events

## EffectManager

Use for short-lived or looping visuals such as hit flash, critical burst, heal, shield, burn, freeze, spawn, death, and damage-number presentation.

Required integration contract:

1. Core Logic emits a presentation event.
2. Adapter maps the event to a registered effect ID.
3. EffectManager spawns a visual instance.
4. The render loop calls `update(dt)` once.
5. Wave cleanup calls `stopByOwner`, `clear`, or `dispose` as appropriate.

Pooling is bounded per effect definition. `snapshot()` exposes active and pooled counts for leak checks.

## ProjectilePresenter

Use for arrows, fireballs, knives, spears, lightning bolts with travel visuals, and similar projectiles.

The visual arrival callback must not apply damage. Damage remains controlled by Core Logic. A projectile may arrive after the target has died; the adapter decides whether to hide, redirect visually, or finish at the last known position without generating gameplay effects.

## Initial real-asset integration

Integrate only three representatives first:

- one Class 1 hero
- one normal monster
- one stage-5 boss

Recommended first visual set:

- normal hit flash
- critical burst
- heal or shield
- one straight projectile
- one arcing projectile

## Validation

- clean load without console errors
- force one unknown effect/projectile ID and confirm a controlled error
- spawn/release at least 100 pooled instances and confirm bounded pool sizes
- finish/restart waves and confirm active count returns to zero
- targeted combat test across 3–5 waves at x4
- verify animation/projectile events never apply damage twice
- record files/modules used and `snapshot()` before/after wave cleanup

## Integration hold

Do not wire these modules into `src/game.js` or `autochess.html` while another agent owns active runtime changes. Merge or rebase after the Shop Drawer task is complete and then integrate through the smallest adapter possible.

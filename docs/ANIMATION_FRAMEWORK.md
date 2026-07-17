# Animation Framework

## Purpose

This framework standardizes sprite animation states without changing combat, movement, targeting, timing, or the main game loop.

The initial shared states are:

- `idle`
- `walk`
- `attack`
- `cast`
- `hit`
- `death`
- `spawn`

## Current scope

`src/animation-controller.js` is standalone and is not imported by `autochess.html` or `src/game.js` yet.

It provides:

- animation definition registration
- duplicate-definition protection
- frame/FPS validation
- deterministic delta-time updates
- looping and one-shot clips
- state locks for attack/cast/hit/death clips
- frame events such as `hit` and `cast-release`
- automatic transition back to another state
- left/right facing output
- pause, resume, reset, and time-scale controls
- diagnostic library snapshots

## Separation of responsibilities

The controller owns only animation playback state. It must not:

- calculate damage
- select targets
- move a unit between grid cells
- alter attack speed or cast time rules
- spawn projectiles or VFX directly
- remove dead units
- modify the combat queue or main loop

Combat code may request a state and listen for frame events. The combat result remains authoritative.

Example intended flow:

1. Combat decides an attack starts.
2. Combat requests `attack`.
3. Animation emits the `hit` frame event.
4. Integration code may synchronize an already-approved combat impact or projectile release.
5. Animation returns to `idle`.

The animation event must never become a second independent damage calculation.

## Definition shape

```js
{
  columns: 8,
  rows: 1,
  defaultState: 'idle',
  flipXByFacing: true,
  clips: {
    idle: {
      frames: [0],
      fps: 6,
      loop: true
    },
    attack: {
      frames: [3, 4],
      fps: 10,
      loop: false,
      next: 'idle',
      lockUntilComplete: true,
      events: { 1: 'hit' }
    }
  }
}
```

## Integration plan

Do not integrate while CC owns overlapping runtime work.

After the Shop Drawer task is complete:

1. Sync the branch with the latest `main`.
2. Merge or rebase the standalone Asset Manager first if animation textures depend on it.
3. Integrate only three real assets:
   - one Class 1 hero
   - one normal monster
   - one stage-5 boss
4. Adapt the existing sprite UV update in one small bridge function.
5. Map existing unit states to animation states without changing combat timing.
6. Verify attack and cast events do not apply damage twice.
7. Verify death remains locked and cannot return to idle.
8. Verify facing changes do not mirror UI or unrelated meshes.

## Required validation for runtime integration

- clean game load
- missing-animation fallback to `idle`
- one melee attacker
- one ranged attacker
- one caster
- one death during hit flash
- pause/resume or tab visibility recovery
- 3–5 targeted combat waves at speed x4
- compare wave results before and after integration
- inspect console for uncaught exceptions

## Performance notes

The controller allocates no new objects during ordinary frame progression except callback payload objects. Integration should keep one controller per animated unit and dispose the reference when the unit visual is disposed.

Do not add animation pooling until runtime measurements show controller churn is material.

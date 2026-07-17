# Asset Manager Framework

## Status

A standalone framework now exists at `src/asset-manager.js`.

It is intentionally **not integrated** into `src/game.js` or `autochess.html` yet. This prevents overlap with the active Shop Drawer work and keeps the first implementation reviewable.

## Responsibilities

The framework provides:

- Stable logical asset keys
- Exact duplicate-key rejection
- URL resolution against `document.baseURI`
- Texture preload with completion summary
- Shared promise/cache for duplicate load requests
- Reference counting through `acquire()` and `release()`
- Safe `dispose()`, `disposeUnused()`, and `disposeAll()` operations
- Failed-load logging and retry support
- A visible generated fallback texture
- A diagnostic snapshot for future tests

## Non-responsibilities

The framework does not:

- Modify combat behavior
- Create units, effects, projectiles, or animations
- Touch the Shop Drawer
- Replace the current loader automatically
- Rename or delete assets
- Introduce a bundler or third-party dependency

## Intended integration order

1. Finish the current Shop Drawer investigation.
2. Review this standalone API.
3. Add the script before `src/game.js` in a small integration commit.
4. Register only the three real pilot assets first:
   - one Class 1 hero
   - one normal monster
   - one Stage 5 boss
5. Adapt the current loader behind a narrow compatibility layer.
6. Run one clean load and 3–5 targeted combat waves at x4.
7. Verify failed paths use the fallback and loading completes exactly once.
8. Compare `renderer.info.memory` before and after wave cleanup.

## Example API

```js
const assets = new AssetManager({ THREE });

assets.register([
  { key: 'hero.fighter.idle', type: 'texture', path: 'assets/fighter.png' },
  { key: 'monster.slime.idle', type: 'texture', path: 'assets/mon_slime.png' },
]);

const summary = await assets.preload();
const fighterTexture = assets.acquire('hero.fighter.idle');

// When the owning visual is permanently removed:
assets.release('hero.fighter.idle');
assets.disposeUnused();
```

## Integration guardrails

- Do not dispose a texture while any live sprite/material still uses it.
- A unit visual should acquire each shared asset once and release it once.
- Wave cleanup should release temporary wave-only assets.
- Global roster textures may stay cached across waves.
- Loader failures must count as completed so the loading screen cannot hang.
- Integration must remain a separate commit from unrelated UI or combat work.

## Test level

The current commit adds an unintegrated module, so no combat behavior changes.

When integration begins, use the risk-based runtime test level:

- Clean page load
- One forced missing-path case
- Repeated acquire/release check
- 3–5 targeted combat waves at x4
- Confirm no monotonic geometry/texture growth after cleanup

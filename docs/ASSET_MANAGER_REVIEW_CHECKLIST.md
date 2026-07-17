# Asset Manager Review Checklist

Use this checklist before integrating `src/asset-manager.js` into the live game.

## API review

- [ ] Duplicate keys throw immediately.
- [ ] Repeated `load(key)` calls share one promise.
- [ ] `preload()` reports both fulfilled and rejected entries.
- [ ] Failed loads remain retryable.
- [ ] `acquire()` increments references only for a loaded real asset.
- [ ] Fallback acquisition does not corrupt the real asset reference count.
- [ ] `release()` cannot reduce references below zero.
- [ ] `dispose()` refuses to dispose referenced assets unless forced.
- [ ] `snapshot()` exposes enough state for debugging without mutating state.

## Integration review

- [ ] Add only one script include and one manager instance.
- [ ] Do not alter Shop Drawer code.
- [ ] Do not mix integration with combat rebalance or visual redesign.
- [ ] Start with three real pilot assets only.
- [ ] Keep existing placeholder behavior available during migration.
- [ ] Ensure all paths remain relative to the deployed document root.

## Runtime verification

- [ ] Clean load completes.
- [ ] Missing-path load completes with a visible fallback.
- [ ] Duplicate requests do not create duplicate texture instances.
- [ ] Three to five targeted combat waves run at x4.
- [ ] Wave cleanup releases temporary ownership exactly once.
- [ ] `renderer.info.memory.textures` does not grow monotonically after repeated cleanup.
- [ ] No new console errors appear.

## Rollback rule

If integration causes a loading hang, missing unit visuals, or persistent texture growth, revert only the integration commit. Keep the standalone framework commit for review and correction.

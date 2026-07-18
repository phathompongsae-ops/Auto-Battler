import fs from 'node:fs';

const path = new URL('../data/design/map1-visual-lock-v1.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(data.schemaVersion === 1, 'schemaVersion must be 1');
assert(data.id === 'map1.arena_ruins.visual_lock.v1', 'unexpected contract id');
assert(data.theme?.name === 'Arena Ruins', 'Map 1 theme must be Arena Ruins');
assert(data.lockedRuntime?.assetAnimationRuntimeSource?.pr === 23, 'runtime source PR must be #23');
assert(data.lockedRuntime?.assetAnimationRuntimeSource?.head === '5a3a8eec7991a98aad6f3acf0ce38687764dcb1a', 'unexpected PR #23 head');

for (const key of ['boardDimensions', 'camera', 'bench', 'hudLayout', 'combatLogic']) {
  assert(data.lockedRuntime?.[key] === 'unchanged', `${key} must remain unchanged`);
}

const requiredLayers = ['boardSurface', 'arenaBorder', 'background', 'props', 'ambientVfx', 'lightingProfile'];
for (const layer of requiredLayers) {
  assert(data.layers?.includes(layer), `missing layer: ${layer}`);
  assert(data[layer], `missing layer contract: ${layer}`);
}

const expectedAnchors = {
  'hero.archer': [0.5, 0.92],
  'monster.slime': [0.5, 0.9],
  'monster.golem': [0.5, 0.94],
};
for (const [id, expected] of Object.entries(expectedAnchors)) {
  const actual = data.pilotCompatibility?.[id]?.anchor;
  assert(Array.isArray(actual) && actual.length === 2, `missing anchor for ${id}`);
  assert(actual[0] === expected[0] && actual[1] === expected[1], `unexpected anchor for ${id}`);
}

assert(data.ambientVfx?.sharedTransientVfxCap === 24, 'shared VFX cap must be 24');
assert(data.mobileBudget?.target === 'Android Chrome first', 'Android Chrome must remain the primary mobile target');
assert(data.futureThemeProfile?.mapsDeferred?.includes('map2.lava_hell'), 'Map 2 must remain deferred');
assert(data.futureThemeProfile?.mapsDeferred?.includes('map3.heaven_temple'), 'Map 3 must remain deferred');

console.log('Map 1 visual lock contract validation passed.');

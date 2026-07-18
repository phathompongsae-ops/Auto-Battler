#!/usr/bin/env node

// Node-side test of the Map Theme Runtime (src/map-theme-runtime.js): registry, lifecycle
// guards without a browser, disabled-theme rejection, quality normalization, degradation-order
// invariants, and consistency between the embedded map1.arena_ruins definition and the canonical
// JSON (data/design/map1-arena-ruins-theme-v1.json) + schema (map-theme-schema-v1.json).
// The full six-layer scene lifecycle runs under Playwright (browser checkpoints in the docs).

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const code = await readFile(new URL('../src/map-theme-runtime.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('globalThis', code)(sandbox);
const M = sandbox.MapThemeRuntime;
assert(!!M, 'map-theme-runtime.js must set globalThis.MapThemeRuntime');

const themeJson = JSON.parse(await readFile(new URL('../data/design/map1-arena-ruins-theme-v1.json', import.meta.url), 'utf8'));
const schemaJson = JSON.parse(await readFile(new URL('../data/design/map-theme-schema-v1.json', import.meta.url), 'utf8'));

if (M) {
  // --- registry ---
  const themes = M.listThemes();
  assert(themes.includes('map1.arena_ruins'), 'map1.arena_ruins registered');
  assert(themes.includes('map2.lava_hell') && themes.includes('map3.heaven_temple'), 'deferred maps registered as metadata');
  eq(M.getTheme('map2.lava_hell').enabled, false, 'map2 is disabled metadata');
  eq(M.getTheme('map3.heaven_temple').enabled, false, 'map3 is disabled metadata');
  eq(M.registerTheme(null), false, 'invalid registration rejected');
  eq(M.registerTheme({}), false, 'registration without id rejected');

  // --- lifecycle guards without a browser (no THREE/document): everything self-disables ---
  eq(M.activateTheme('map1.arena_ruins'), false, 'activate without a browser -> false (game keeps existing presentation)');
  eq(M.activateTheme('map2.lava_hell'), false, 'disabled theme rejected safely');
  eq(M.activateTheme('nope.missing'), false, 'unknown theme -> false, no throw');
  eq(M.disposeTheme(), false, 'dispose with nothing active -> false, no throw');
  eq(M.refreshTheme(), false, 'refresh with nothing active -> false, no throw');
  M.tick(1 / 60); M.tick(NaN); M.tick(-1); // must never throw
  const dbg = M.getThemeDebugState();
  eq(dbg.activeThemeId, null, 'no active theme under Node');
  eq(dbg.fallbackState, 'inactive', 'fallback state reports inactive');

  // --- quality normalization + degradation invariants ---
  eq(M.setThemeQuality('medium'), 'medium', 'valid quality accepted');
  eq(M.setThemeQuality('bogus'), 'high', 'invalid quality normalizes to high');
  eq(M.QUALITY_LEVELS.join(','), 'high,medium,low', 'three quality levels');
  const q = M._defs.MAP1_ARENA_RUINS.quality;
  assert(q.high.particles >= q.medium.particles && q.medium.particles >= q.low.particles, 'ambient particles degrade first (monotonic)');
  eq(q.low.particles, 0, 'low quality removes ambient particles');
  eq(q.low.motion, false, 'low quality removes decorative motion');
  assert(q.high.bgWalls >= q.medium.bgWalls && q.medium.bgWalls >= q.low.bgWalls, 'distant decoration reduces after ambient');
  assert(q.high.propScale >= q.medium.propScale && q.medium.propScale >= q.low.propScale, 'props reduce monotonically');

  // --- six layers ---
  eq(M.LAYER_NAMES.join(','), 'boardSurface,arenaBorder,background,props,ambientVfx,lightingProfile', 'six contract layers in order');
  assert(!!M._BUILDERS['map1.arena_ruins'], 'map1 builders installed');
  for (const l of M.LAYER_NAMES) assert(typeof M._BUILDERS['map1.arena_ruins'][l] === 'function', `builder present for layer ${l}`);
  eq(M.setLayerVisible('notALayer', true), false, 'unknown layer visibility rejected');

  // --- embedded definition matches the canonical JSON ---
  const def = M._defs.MAP1_ARENA_RUINS;
  eq(def.id, themeJson.id, 'theme id matches JSON');
  eq(def.enabled, themeJson.enabled, 'enabled matches JSON');
  eq(def.contract, themeJson.contract, 'contract id matches JSON');
  eq(def.layers.join(','), themeJson.layers.join(','), 'layer list matches JSON');
  for (const k of Object.keys(themeJson.palette)) {
    eq(def.palette[k], parseInt(themeJson.palette[k], 16), `palette.${k} matches JSON`);
  }
  for (const lvl of ['high', 'medium', 'low']) {
    for (const f of Object.keys(themeJson.quality[lvl])) {
      eq(def.quality[lvl][f], themeJson.quality[lvl][f], `quality.${lvl}.${f} matches JSON`);
    }
  }
  eq(def.lighting.fillIntensity, themeJson.lighting.fillIntensity, 'fill intensity matches JSON');
  eq(def.lighting.rimIntensity, themeJson.lighting.rimIntensity, 'rim intensity matches JSON');

  // --- pilot readability data: anchors unchanged, palette separates from pilot colors ---
  eq(themeJson.pilotReadability['hero.archer'].anchor.join(','), '0.5,0.92', 'Archer anchor preserved');
  eq(themeJson.pilotReadability['monster.slime'].anchor.join(','), '0.5,0.9', 'Slime anchor preserved');
  eq(themeJson.pilotReadability['monster.golem'].anchor.join(','), '0.5,0.94', 'Golem anchor preserved');
  const dist = (a, b) => {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return Math.hypot(ar - br, ag - bg, ab - bb);
  };
  const golem = 0x8a7a63, slime = 0x4ea3b0, archer = 0x5f8f4e;
  assert(dist(golem, def.palette.masonry) > 40, 'Golem tan separates from masonry');
  assert(dist(golem, def.palette.masonryDark) > 40, 'Golem tan separates from dark masonry');
  assert(dist(slime, def.palette.moss) > 80, 'Slime teal separates from moss');
  assert(dist(archer, def.palette.masonry) > 50, 'Archer olive separates from masonry (hue-opposed green vs blue-gray)');

  // --- schema JSON sanity ---
  eq(schemaJson.layers.join(','), M.LAYER_NAMES.join(','), 'schema lists the six layers');
  const schemaThemes = Object.fromEntries(schemaJson.themes.map((t) => [t.id, t]));
  eq(schemaThemes['map1.arena_ruins'].enabled, true, 'schema: map1 enabled');
  eq(schemaThemes['map2.lava_hell'].enabled, false, 'schema: map2 disabled/deferred');
  eq(schemaThemes['map3.heaven_temple'].enabled, false, 'schema: map3 disabled/deferred');
  assert(Array.isArray(schemaJson.shared) && schemaJson.shared.length >= 6, 'schema documents shared systems');
  assert(Array.isArray(schemaJson.replacePerMap) && schemaJson.replacePerMap.length >= 6, 'schema documents replace-per-map surface');
  assert(schemaJson.degradationOrder[0] === 'preserve units', 'degradation order preserves units first');
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} assertion(s) failed`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS: map theme runtime (registry/lifecycle guards/quality/JSON consistency) — all assertions passed');

#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };
const same = (actual, expected, message) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    failures.push(`${relativePath}: JSON parse/read failed: ${error.message}`);
    return null;
  }
}

const manifestPath = 'data/design/arena-ruins-final-board-art-manifest-v1.json';
const safePath = 'data/design/arena-ruins-board-safe-zones-v1.json';
const contrastPath = 'data/design/arena-ruins-pilot-contrast-matrix-v1.json';
const docPath = 'docs/assets/arena-ruins-final-board-art-plan-v1.md';
const manifest = readJson(manifestPath);
const safe = readJson(safePath);
const contrast = readJson(contrastPath);

ok(fs.existsSync(path.join(root, docPath)), `${docPath} must exist`);

const runtimeCode = fs.readFileSync(path.join(root, 'src/map-theme-runtime.js'), 'utf8');
const gameCode = fs.readFileSync(path.join(root, 'src/game.js'), 'utf8');
const layerMatch = runtimeCode.match(/const LAYER_NAMES\s*=\s*\[([^\]]+)\]/);
const runtimeLayers = layerMatch ? [...layerMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
const expectedLayers = ['boardSurface', 'arenaBorder', 'background', 'props', 'ambientVfx', 'lightingProfile'];
same(runtimeLayers, expectedLayers, 'runtime layer set/order must be read from src/map-theme-runtime.js');

function numberConst(name) {
  const match = gameCode.match(new RegExp(`(?:const\\s+|,\\s*)${name}\\s*=\\s*([0-9.]+)`));
  return match ? Number(match[1]) : null;
}
function arrayConst(name) {
  const match = gameCode.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  return match ? match[1].split(',').map((v) => Number(v.trim())).filter(Number.isFinite) : null;
}

if (manifest) {
  ok(manifest.mapId === 'map1.arena_ruins', 'manifest must target Map 1 Arena Ruins only');
  ok(manifest.canonicalApproved === false, 'manifest canonicalApproved must be false');
  ok(manifest.scope?.documentationAndMetadataOnly === true, 'scope must be documentation/metadata only');
  ok(manifest.scope?.artworkProduced === false, 'scope must state no artwork produced');
  ok(manifest.scope?.runtimeChanges === false, 'scope must state no runtime changes');

  same(manifest.runtimeConstraints?.board?.runtimeDimensions, [numberConst('GRID_COLS'), numberConst('GRID_ROWS')], 'manifest board dimensions must match src/game.js');
  ok(manifest.runtimeConstraints?.board?.tileWorldSize === numberConst('TILE'), 'manifest TILE must match src/game.js');
  same(manifest.runtimeConstraints?.board?.deployRows, arrayConst('PLAYER_ROWS'), 'manifest deploy rows must match src/game.js');
  ok(manifest.runtimeConstraints?.board?.benchRow === numberConst('BENCH_ROW'), 'manifest bench row must match src/game.js');
  ok(manifest.runtimeConstraints?.camera?.pitchDegrees === numberConst('CAMERA_ANGLE_DEG'), 'manifest camera pitch must match src/game.js');
  ok(manifest.runtimeConstraints?.camera?.yawDegrees === numberConst('CAMERA_YAW_DEG'), 'manifest camera yaw must match src/game.js');
  same(manifest.runtimeConstraints?.themeRuntime?.layersInInsertionOrder, runtimeLayers, 'manifest layer list must match runtime-supported layers');

  const requiredAssetIds = [
    'map1.arena_ruins.board_surface_master.v1',
    'map1.arena_ruins.border_corners_atlas.v1',
    'map1.arena_ruins.perimeter_ground_tile.v1',
    'map1.arena_ruins.background_modules_atlas.v1',
    'map1.arena_ruins.tile_state_atlas.v1',
    'map1.arena_ruins.props_atlas.v1',
  ];
  const assets = Array.isArray(manifest.assetDeliverables) ? manifest.assetDeliverables : [];
  same(assets.map((asset) => asset.assetId).sort(), [...requiredAssetIds].sort(), 'required asset IDs must be complete and exact');
  ok(manifest.memoryBudget?.assetCount === assets.length, 'memoryBudget.assetCount must match deliverable count');

  const filenames = assets.map((asset) => asset.filename);
  const repositoryPaths = assets.map((asset) => asset.repositoryPath);
  ok(new Set(filenames).size === filenames.length, 'asset filenames must be unique');
  ok(new Set(repositoryPaths).size === repositoryPaths.length, 'asset repository paths must be unique');

  for (const asset of assets) {
    ok(requiredAssetIds.includes(asset.assetId), `unexpected assetId: ${asset.assetId}`);
    ok(typeof asset.filename === 'string' && asset.filename.endsWith('.png'), `${asset.assetId}: filename must be PNG`);
    ok(typeof asset.repositoryPath === 'string' && asset.repositoryPath.endsWith(`/${asset.filename}`), `${asset.assetId}: repositoryPath must end with filename`);
    ok(runtimeLayers.includes(asset.layer), `${asset.assetId}: layer must be supported by runtime`);
    ok(Array.isArray(asset.canvasDimensions) && asset.canvasDimensions.length === 2 && asset.canvasDimensions.every((n) => Number.isInteger(n) && n > 0), `${asset.assetId}: dimensions must be two positive integers`);
    ok(typeof asset.alphaRequirement === 'string' && ['opaque-required', 'transparent-alpha-required'].includes(asset.alphaRequirement), `${asset.assetId}: alpha requirement must be explicit`);
    ok(asset.colorSpace === 'sRGB', `${asset.assetId}: colorSpace must be sRGB`);
    ok(asset.canonicalApproved === false, `${asset.assetId}: canonicalApproved must be false`);
    ok(!/map[._-]?[23]|lava_hell|heaven_temple/i.test(`${asset.assetId} ${asset.filename} ${asset.repositoryPath}`), `${asset.assetId}: Map 2/3 production assets are forbidden`);
    ok(!fs.existsSync(path.join(root, asset.repositoryPath)), `${asset.assetId}: planned final art must not exist in this documentation-only PR`);
  }

  const requiredStates = ['normal', 'hover', 'selected', 'deploy-valid', 'deploy-invalid', 'enemy-zone', 'target', 'AoE', 'disabled'];
  const states = Array.isArray(manifest.tileStatePalette) ? manifest.tileStatePalette : [];
  same(states.map((entry) => entry.state).sort(), [...requiredStates].sort(), 'tile-state palette must include all required states');
  for (const state of states) {
    ok(Array.isArray(state.opacityRange) && state.opacityRange.length === 2 && state.opacityRange.every((n) => typeof n === 'number' && n >= 0 && n <= 1) && state.opacityRange[0] <= state.opacityRange[1], `${state.state}: opacity range must be ordered within 0..1`);
    ok(typeof state.edgeTreatment === 'string' && state.edgeTreatment.length > 0, `${state.state}: edge treatment required`);
    ok(typeof state.pulseAllowed === 'boolean', `${state.state}: pulseAllowed must be boolean`);
    ok(typeof state.mobileReadability === 'string' && state.mobileReadability.length > 0, `${state.state}: mobile readability required`);
  }

  ok(Array.isArray(manifest.reviewCheckpoints) && manifest.reviewCheckpoints.length === 3, 'checkpoint count must equal 3');
  for (const checkpoint of manifest.reviewCheckpoints || []) {
    ok(checkpoint.futureOnly === true, `${checkpoint.id}: checkpoint must be future-only`);
    ok(checkpoint.passed === false, `${checkpoint.id}: checkpoint must not claim pass`);
  }
  same((manifest.productionOrder || []).map((entry) => entry.pass), [1, 2, 3, 4, 5, 6], 'production order must contain Pass 1..6');
}

if (safe) {
  ok(safe.mapId === 'map1.arena_ruins', 'safe zones must target Map 1 only');
  ok(safe.canonicalApproved === false, 'safe zones canonicalApproved must be false');
  same([safe.runtimeBoard?.columns, safe.runtimeBoard?.rows], [numberConst('GRID_COLS'), numberConst('GRID_ROWS')], 'safe-zone board dimensions must match runtime');
  const requiredZoneIds = ['combat-board', 'full-board-and-bench', 'unit-foot-quiet-area-per-tile', 'health-bar-readability-envelope', 'projectile-and-target-path', 'deploy-highlight-rows', 'enemy-highlight-rows-observed', 'edge-unit-clearance-per-tile', 'screen-top-ui-risk', 'screen-left-ui-risk', 'screen-right-ui-risk', 'screen-bottom-ui-risk'];
  const zones = Array.isArray(safe.zones) ? safe.zones : [];
  const ids = zones.map((zone) => zone.zoneId);
  for (const id of requiredZoneIds) ok(ids.includes(id), `missing safe zone: ${id}`);
  ok(new Set(ids).size === ids.length, 'safe-zone IDs must be unique');
  for (const zone of zones) {
    ok(['boardUv', 'tileUv', 'tileBillboardUv', 'screenUv'].includes(zone.coordinateSpace), `${zone.zoneId}: coordinateSpace must be normalized and declared`);
    ok(zone.shape === 'rect', `${zone.zoneId}: only rect zones are supported by validator v1`);
    ok(Array.isArray(zone.min) && Array.isArray(zone.max) && zone.min.length === 2 && zone.max.length === 2, `${zone.zoneId}: min/max must contain two coordinates`);
    if (Array.isArray(zone.min) && Array.isArray(zone.max)) {
      for (const n of [...zone.min, ...zone.max]) ok(typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1, `${zone.zoneId}: normalized coordinate ${n} outside 0..1`);
      ok(zone.min[0] <= zone.max[0] && zone.min[1] <= zone.max[1], `${zone.zoneId}: min must not exceed max`);
    }
    ok(typeof zone.decorationPolicy === 'string' && zone.decorationPolicy.length > 0, `${zone.zoneId}: decorationPolicy required`);
  }
}

if (contrast) {
  ok(contrast.mapId === 'map1.arena_ruins', 'contrast matrix must target Map 1 only');
  ok(contrast.canonicalApproved === false, 'contrast matrix canonicalApproved must be false');
  const expectedPilots = ['hero.archer', 'monster.slime', 'monster.golem'];
  const pilots = Array.isArray(contrast.pilots) ? contrast.pilots : [];
  same(pilots.map((pilot) => pilot.pilotId).sort(), [...expectedPilots].sort(), 'contrast matrix must contain Archer, Slime and Golem exactly once');
  const requiredChecks = ['hueContrast', 'luminanceContrast', 'silhouetteReadability', 'cyanEffectReadability', 'greenCostumeReadability', 'stoneBodyReadability', 'shadowReadability'];
  for (const pilot of pilots) {
    for (const check of requiredChecks) {
      ok(pilot.checks?.[check] && typeof pilot.checks[check].risk === 'string' && typeof pilot.checks[check].artMitigation === 'string', `${pilot.pilotId}: missing ${check} risk/mitigation`);
    }
  }
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} assertion(s) failed`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: Arena Ruins final board art plan v1');
console.log(`  assets: ${manifest.assetDeliverables.length}`);
console.log(`  runtime layers: ${runtimeLayers.join(', ')}`);
console.log(`  runtime board: ${manifest.runtimeConstraints.board.runtimeDimensions.join('x')} (${manifest.runtimeConstraints.board.tileCount} tiles)`);
console.log(`  safe zones: ${safe.zones.length}`);
console.log(`  pilots: ${contrast.pilots.map((pilot) => pilot.displayName).join(', ')}`);
console.log(`  future checkpoints: ${manifest.reviewCheckpoints.length} (none passed)`);
console.log('  canonicalApproved: false');
console.log('  artwork/runtime changes: none');

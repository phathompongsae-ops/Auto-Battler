#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseSha = '4d1403ec108f5846deb9f46af89da2d03ce1a666';
const expectedBranch = 'coco/arena-ruins-board-implementation-contract-v1';
const files = {
  contract: 'data/design/arena-ruins-board-implementation-contract-v1.json',
  placement: 'data/design/arena-ruins-board-layer-placement-v1.json',
  camera: 'data/design/arena-ruins-board-camera-alignment-v1.json',
  safe: 'data/design/arena-ruins-board-ui-safe-areas-v1.json',
  registry: 'data/design/arena-ruins-board-asset-registry-v1.json',
};
const markdownPath = 'docs/assets/arena-ruins-board-implementation-contract-v1.md';
const zonesPath = 'docs/assets/review/arena-ruins/reference-match-v2/arena-ruins-implementation-zones-v1.png';
const failures = [];

function fail(message) { failures.push(message); }
function readJson(relativePath) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8')); }
  catch (error) { fail(`${relativePath}: JSON parse failed: ${error.message}`); return null; }
}
function same(actual, expected) { return JSON.stringify(actual) === JSON.stringify(expected); }
function positiveDimensions(value) { return Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n > 0); }

const parsed = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, readJson(value)]));
for (const [key, value] of Object.entries(parsed)) {
  if (!value) continue;
  if (value.canonicalApproved !== false) fail(`${files[key]}: canonicalApproved must be false`);
  if (value.mapId !== 'map1.arena_ruins') fail(`${files[key]}: mapId must be map1.arena_ruins`);
}

const runtimeLayers = ['boardSurface', 'arenaBorder', 'background', 'props', 'ambientVfx', 'lightingProfile'];
const contract = parsed.contract;
if (contract) {
  const board = contract.runtimeFacts?.board;
  const camera = contract.runtimeFacts?.camera;
  if (board?.columns !== 8 || board?.rows !== 7 || board?.tileCount !== 56) fail('contract: runtime board must be 8x7 / 56 tiles');
  if (!same(board?.combatRows, [0,1,2,3,4,5])) fail('contract: combatRows mismatch');
  if (!same(board?.deployRows, [3,4,5])) fail('contract: deployRows mismatch');
  if (board?.benchRow !== 6 || !same(board?.usableBenchColumns, [0,1,2,3,4])) fail('contract: bench contract mismatch');
  if (camera?.pitchDegrees !== 45 || camera?.yawDegrees !== 90 || camera?.distance !== 20) fail('contract: camera angles/distance mismatch');
  if (!same(camera?.lookTargetWorld, [0,0,1.3]) || camera?.boardFillRatio !== 0.97 || camera?.boardDownBias !== 0.97) fail('contract: camera target/framing mismatch');
  if (!same(contract.runtimeLayerContract?.supportedLayerNames, runtimeLayers)) fail('contract: runtime layer list/order mismatch');
  if (contract.runtimeLayerContract?.explicitRenderOrder !== false) fail('contract: explicitRenderOrder must remain false');
  if (contract.scope?.runtimeIntegration !== false || contract.scope?.runtimeChanges !== false) fail('contract: runtime scope flags must be false');
  if (!Array.isArray(contract.integrationBlockers) || contract.integrationBlockers.length !== 7) fail('contract: expected seven explicit integration blockers');
  if (!Array.isArray(contract.futureReviewCheckpoints) || contract.futureReviewCheckpoints.length !== 3) fail('contract: future checkpoint count must be exactly 3');
  if (contract.futureReviewCheckpoints?.some((checkpoint) => checkpoint.passed !== false)) fail('contract: no future checkpoint may be passed');
  for (const layer of contract.conceptualLayers || []) {
    if (!runtimeLayers.includes(layer.runtimeLayer)) fail(`contract: conceptual layer ${layer.layerId} maps to unsupported runtime layer ${layer.runtimeLayer}`);
  }
}

const placement = parsed.placement;
if (placement) {
  if (!same(placement.runtimeInsertionOrder, runtimeLayers)) fail('placement: runtime layer order mismatch');
  if (placement.explicitRenderOrderExists !== false || placement.renderOrderIntentIsNonRuntimeMetadata !== true) fail('placement: render-order truth mismatch');
  const expectedPlacementIds = ['arenaRuins.perimeterGround.v1','arenaRuins.backgroundModules.v1','arenaRuins.boardSurface.v1','arenaRuins.benchTreatment.v1','arenaRuins.tileStates.v1','arenaRuins.borderCorners.v1','arenaRuins.props.v1'];
  const actual = (placement.placements || []).map((entry) => entry.assetId);
  if (!same(actual, expectedPlacementIds)) fail('placement: production asset placement order/IDs mismatch');
}

const camera = parsed.camera;
if (camera) {
  if (camera.camera?.pitchDegrees !== 45 || camera.camera?.yawDegrees !== 90 || camera.camera?.distance !== 20) fail('camera: locked values mismatch');
  if (!same(camera.camera?.lookTargetWorld, [0,0,1.3])) fail('camera: look target mismatch');
  if (camera.framing?.boardFillRatio !== 0.97 || camera.framing?.boardDownBias !== 0.97) fail('camera: framing mismatch');
  if (!same(camera.previewV2Alignment?.viewportPixels, [1536,1024])) fail('camera: Preview v2 viewport mismatch');
  if (!same(camera.previewV2Alignment?.boardOuterBoundsPixels, {min:[214,74],max:[1322,760]})) fail('camera: Preview v2 board bounds mismatch');
}

const safe = parsed.safe;
if (safe) {
  const zones = [...(safe.screenZones || []), ...(safe.boardAndTileZones || [])];
  if (zones.length !== 16) fail(`safe areas: expected 16 zones, got ${zones.length}`);
  const ids = new Set();
  for (const zone of zones) {
    if (ids.has(zone.zoneId)) fail(`safe areas: duplicate zoneId ${zone.zoneId}`);
    ids.add(zone.zoneId);
    if (!same(zone.shape, 'rect')) fail(`safe areas: ${zone.zoneId} must be rect`);
    for (const point of [zone.min, zone.max]) {
      if (!Array.isArray(point) || point.length !== 2 || point.some((n) => typeof n !== 'number' || n < 0 || n > 1)) fail(`safe areas: ${zone.zoneId} coordinates outside [0,1]`);
    }
    if (zone.min?.[0] > zone.max?.[0] || zone.min?.[1] > zone.max?.[1]) fail(`safe areas: ${zone.zoneId} min/max invalid`);
  }
}

const registry = parsed.registry;
const expectedAssets = new Map([
  ['arenaRuins.boardSurface.v1', ['assets/maps/arena-ruins/board/arena-ruins-board-surface-v1.png', [1024,896], 'opaque-required']],
  ['arenaRuins.borderCorners.v1', ['assets/maps/arena-ruins/board/arena-ruins-border-corners-v1.png', [1024,1024], 'true-transparent-alpha-required']],
  ['arenaRuins.perimeterGround.v1', ['assets/maps/arena-ruins/board/arena-ruins-perimeter-ground-v1.png', [512,512], 'opaque-required']],
  ['arenaRuins.backgroundModules.v1', ['assets/maps/arena-ruins/board/arena-ruins-background-modules-v1.png', [1024,1024], 'true-transparent-alpha-required']],
  ['arenaRuins.benchTreatment.v1', ['assets/maps/arena-ruins/board/arena-ruins-bench-treatment-v1.png', [1024,128], 'true-transparent-alpha-required']],
  ['arenaRuins.tileStates.v1', ['assets/maps/arena-ruins/board/arena-ruins-tile-states-v1.png', [1024,768], 'true-transparent-alpha-required']],
  ['arenaRuins.props.v1', ['assets/maps/arena-ruins/board/arena-ruins-props-v1.png', [1024,1024], 'true-transparent-alpha-required']],
]);
if (registry) {
  if (registry.productionFileCount !== 7 || registry.assets?.length !== 7) fail('registry: production asset count must be 7');
  const ids = new Set(), paths = new Set(), filenames = new Set();
  for (const asset of registry.assets || []) {
    if (!expectedAssets.has(asset.assetId)) { fail(`registry: unexpected assetId ${asset.assetId}`); continue; }
    const [expectedPath, expectedDimensions, expectedAlpha] = expectedAssets.get(asset.assetId);
    if (ids.has(asset.assetId)) fail(`registry: duplicate assetId ${asset.assetId}`); ids.add(asset.assetId);
    if (paths.has(asset.repositoryPath)) fail(`registry: duplicate repositoryPath ${asset.repositoryPath}`); paths.add(asset.repositoryPath);
    if (filenames.has(asset.filename)) fail(`registry: duplicate filename ${asset.filename}`); filenames.add(asset.filename);
    if (asset.repositoryPath !== expectedPath || asset.filename !== path.basename(expectedPath)) fail(`registry: path mismatch for ${asset.assetId}`);
    if (!positiveDimensions(asset.dimensions) || !same(asset.dimensions, expectedDimensions)) fail(`registry: dimensions mismatch for ${asset.assetId}`);
    if (Math.max(...asset.dimensions) > 1024) fail(`registry: ${asset.assetId} exceeds 1024 max dimension`);
    if (asset.alphaRequirement !== expectedAlpha) fail(`registry: alpha requirement mismatch for ${asset.assetId}`);
    if (asset.canonicalApproved !== false) fail(`registry: ${asset.assetId} canonicalApproved must be false`);
    if (!String(asset.integrationStatus).startsWith('asset-source-only')) fail(`registry: ${asset.assetId} must remain non-runtime`);
  }
  if (registry.memory?.decodedRgba8Bytes !== 20971520 || registry.memory?.decodedRgba8MiB !== 20) fail('registry: decoded memory estimate mismatch');
}

const markdown = fs.existsSync(path.join(root, markdownPath)) ? fs.readFileSync(path.join(root, markdownPath), 'utf8') : '';
const markdownFragments = ['# Arena Ruins Board Implementation Contract v1','Draft PR #47',baseSha,'Locked runtime facts','Existing runtime layer truth','Production asset registry','UI and gameplay safe areas','Integration blockers','canonicalApproved=false'];
if (!markdown) fail(`missing markdown: ${markdownPath}`);
for (const fragment of markdownFragments) if (!markdown.includes(fragment)) fail(`${markdownPath}: missing ${fragment}`);
if (markdown.includes('canonicalApproved=true')) fail(`${markdownPath}: canonicalApproved=true is forbidden`);

function inspectPng(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!buffer.subarray(0,8).equals(signature)) throw new Error('invalid signature');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20), bitDepth = buffer[24], colorType = buffer[25], interlace = buffer[28];
  if (bitDepth !== 8 || ![2,3,6].includes(colorType) || interlace !== 0) throw new Error('unsupported mode');
  let offset=8, sawIend=false; const idat=[];
  while (offset+12<=buffer.length) {
    const length=buffer.readUInt32BE(offset), type=buffer.toString('ascii',offset+4,offset+8), dataStart=offset+8, end=dataStart+length;
    if (end+4>buffer.length) throw new Error('truncated chunk');
    if (type==='IDAT') idat.push(buffer.subarray(dataStart,end));
    offset=end+4;
    if (type==='IEND') { sawIend=true; break; }
  }
  if (!sawIend || offset!==buffer.length) throw new Error('missing IEND or trailing bytes');
  const channels=colorType===6?4:colorType===2?3:1;
  const decoded=zlib.inflateSync(Buffer.concat(idat));
  if (decoded.length !== (width*channels+1)*height) throw new Error('decoded byte count mismatch');
  return {width,height,bitDepth,colorType,bytes:buffer.length};
}
if (!fs.existsSync(path.join(root, zonesPath))) fail(`missing zones PNG: ${zonesPath}`);
else {
  try {
    const info=inspectPng(zonesPath);
    if (info.width!==1536 || info.height!==1024) fail(`${zonesPath}: expected 1536x1024`);
    console.log(`PNG OK ${zonesPath} ${info.width}x${info.height} colorType=${info.colorType} ${info.bytes} bytes`);
  } catch (error) { fail(`${zonesPath}: ${error.message}`); }
}

try {
  const branch=execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim();
  if (branch!==expectedBranch) fail(`unexpected branch ${branch}`);
  execFileSync('git',['cat-file','-e',`${baseSha}^{commit}`],{cwd:root});
  console.log(`BRANCH OK ${branch}`);
  console.log(`BASE OK ${baseSha}`);
} catch (error) { fail(`branch/base validation failed: ${error.message}`); }

let status='';
try { status=execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'}); }
catch (error) { fail(`git status failed: ${error.message}`); }
const allowed = new Set([...Object.values(files), markdownPath, zonesPath, 'tools/validate-arena-ruins-board-implementation-contract-v1.mjs']);
for (const line of status.trim().split('\n').filter(Boolean)) {
  const relative=line.slice(3).replace(/^"|"$/g,'');
  if (!allowed.has(relative)) fail(`scope violation in working tree: ${relative}`);
  if (line.startsWith(' D') || line.startsWith('D ')) fail(`deletion forbidden: ${relative}`);
}

if (failures.length) {
  console.error('\nArena Ruins Board Implementation Contract v1 validation FAILED');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('JSON OK implementation/layer-placement/camera/safe-areas/asset-registry');
console.log('ASSETS 7; decoded RGBA8 budget 20 MiB; runtime integration false');
console.log('Arena Ruins Board Implementation Contract v1 validation PASSED');
console.log('canonicalApproved=false');

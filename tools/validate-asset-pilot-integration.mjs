#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'data/design/asset-pilot-integration-v1.json'), 'utf8'));
const sourcePlan = JSON.parse(fs.readFileSync(path.join(root, 'data/asset-pilot-source-plan-v1.json'), 'utf8'));

const errors = [];
const fail = (message) => errors.push(message);
const pilots = Array.isArray(contract.pilotAssets) ? contract.pilotAssets : [];
const requiredIds = ['hero.archer', 'monster.slime', 'monster.golem'];
const requiredStates = ['idle', 'move', 'attack', 'skill', 'hit', 'death'];

if (pilots.length !== 3) fail('exactly three pilot assets are required');
const ids = new Set();
for (const pilot of pilots) {
  if (!pilot.id || ids.has(pilot.id)) fail(`duplicate or missing pilot id: ${pilot.id}`);
  ids.add(pilot.id);
  if (!pilot.canonicalPath?.endsWith('.png')) fail(`${pilot.id}: canonicalPath must be PNG`);
  if (pilot.view !== 'three_quarter_front') fail(`${pilot.id}: view must be three_quarter_front`);
  if (pilot.facing !== 'runtime_flip_x') fail(`${pilot.id}: facing must be runtime_flip_x`);
  if (!Number.isFinite(pilot.anchor?.x) || !Number.isFinite(pilot.anchor?.y)) fail(`${pilot.id}: finite anchor required`);
  const states = new Set(pilot.states ?? []);
  for (const state of requiredStates) if (!states.has(state)) fail(`${pilot.id}: missing state ${state}`);
  if (!Array.isArray(pilot.sourcePriority) || pilot.sourcePriority.at(-1) !== 'chatgpt_generation') {
    fail(`${pilot.id}: ChatGPT generation must be the fallback source`);
  }
}
for (const id of requiredIds) if (!ids.has(id)) fail(`missing required pilot ${id}`);

if (contract.animationProfile?.targetFps !== 12) fail('target FPS must equal 12');
if (contract.animationProfile?.minimumFps !== 8 || contract.animationProfile?.maxFps !== 15) fail('accepted FPS range must be 8–15');
if (contract.technicalRules?.transparentBackground !== true) fail('transparent background is required');
if (contract.technicalRules?.shopCardAssetSeparateFromBattleAsset !== true) fail('Shop card and battle asset must be separate');
if (contract.mobileBudget?.preferredBattleFrameDimension > 512) fail('preferred battle frame dimension must not exceed 512');
if (contract.mobileBudget?.maxPilotSetBytes > 12000000) fail('pilot set budget must not exceed 12 MB');
if (contract.mobileBudget?.noPerFrameTextureAllocation !== true) fail('per-frame texture allocation must be forbidden');

if (sourcePlan.policy?.downloadBeforeGenerate !== true) fail('download-before-generate policy must be enabled');
if (sourcePlan.policy?.generationOwner !== 'chatgpt') fail('ChatGPT must own generated images');
if (sourcePlan.policy?.cocoMayGenerateImages !== false) fail('Coco must not generate images');
for (const forbidden of ['unknown-license', 'ripped-game-assets']) {
  if (!sourcePlan.policy?.forbiddenSources?.includes(forbidden)) fail(`forbidden source missing: ${forbidden}`);
}
const sourceIds = new Set((sourcePlan.assets ?? []).map((asset) => asset.id));
for (const id of requiredIds) if (!sourceIds.has(id)) fail(`source plan missing ${id}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Asset pilot integration contract validation passed.');
}
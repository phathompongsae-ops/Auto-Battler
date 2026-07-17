#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '../data/design/map2-lava-hell-skeleton-v1.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

if (data.status !== 'design_skeleton') fail('status must remain design_skeleton until numeric balance is based on runtime telemetry.');
if (data.runtimeReady !== false) fail('runtimeReady must be false for the skeleton.');
if (data.map?.id !== 'map2_lava_hell') fail('map.id must be map2_lava_hell.');
if (data.map?.index !== 2) fail('map.index must be 2.');
if (data.map?.stageCount !== 15) fail('Map 2 must contain 15 stages.');
if (data.map?.secretClassUnlock !== 'black_dragon_knight') fail('Map 2 must unlock black_dragon_knight.');

const monsters = Array.isArray(data.monsterArchetypes) ? data.monsterArchetypes : [];
const stages = Array.isArray(data.stageSkeleton) ? data.stageSkeleton : [];
const monsterIds = new Set();

for (const monster of monsters) {
  if (!monster.id) fail('Every monster archetype requires an id.');
  if (monsterIds.has(monster.id)) fail(`Duplicate monster id: ${monster.id}`);
  monsterIds.add(monster.id);
  if (!monster.kind) fail(`${monster.id ?? 'unknown monster'} is missing kind.`);
  if (!monster.targetingBehavior) fail(`${monster.id ?? 'unknown monster'} is missing targetingBehavior.`);
  if (!Array.isArray(monster.skillConcepts)) fail(`${monster.id ?? 'unknown monster'} must declare skillConcepts.`);
  if ('stats' in monster) fail(`${monster.id ?? 'unknown monster'} must not define numeric stats in the skeleton.`);
}

if (monsters.filter((m) => m.kind === 'normal').length !== 7) fail('Map 2 skeleton must define exactly 7 normal monster archetypes.');
if (monsters.filter((m) => m.kind === 'miniboss').length !== 2) fail('Map 2 skeleton must define exactly 2 minibosses.');
if (monsters.filter((m) => m.kind === 'boss').length !== 1) fail('Map 2 skeleton must define exactly 1 stage-15 boss.');

if (stages.length !== 15) fail(`Expected 15 stages, found ${stages.length}.`);
for (let i = 0; i < stages.length; i += 1) {
  const expected = i + 1;
  const stage = stages[i];
  if (stage.stage !== expected) fail(`Stage order mismatch: expected ${expected}, found ${stage.stage}.`);
  for (const id of stage.allowedArchetypes ?? []) {
    if (!monsterIds.has(id)) fail(`Stage ${stage.stage} references unknown monster ${id}.`);
  }
  if (stage.bossId && !monsterIds.has(stage.bossId)) fail(`Stage ${stage.stage} references unknown boss ${stage.bossId}.`);
}

const stage5 = stages.find((s) => s.stage === 5);
const stage10 = stages.find((s) => s.stage === 10);
const stage15 = stages.find((s) => s.stage === 15);
if (stage5?.type !== 'miniboss' || stage5?.bossId !== 'forge_tyrant') fail('Stage 5 must be forge_tyrant miniboss.');
if (stage10?.type !== 'miniboss' || stage10?.bossId !== 'pyre_serpent') fail('Stage 10 must be pyre_serpent miniboss.');
if (stage15?.type !== 'boss' || stage15?.bossId !== 'black_dragon_lord') fail('Stage 15 must be black_dragon_lord boss.');
if (stage5?.bossId === stage10?.bossId) fail('Stage 5 and 10 minibosses must be unique.');
if (stage15?.unlock !== 'black_dragon_knight') fail('Stage 15 must unlock black_dragon_knight.');

for (const stage of stages) {
  const excluded = [5, 10, 15].includes(stage.stage);
  if (excluded && stage.eliteAllowed) fail(`Elite cannot be allowed on stage ${stage.stage}.`);
  if (stage.stage < 4 && stage.eliteAllowed) fail(`Elite cannot start before stage 4; found on stage ${stage.stage}.`);
}

for (const field of ['all numeric monster stats', 'stage stat multipliers', 'exact enemy counts']) {
  if (!data.deferredUntilTelemetry?.includes(field)) warn(`Recommended deferred field is missing: ${field}`);
}

if (errors.length) {
  console.error('Map 2 skeleton validation failed:');
  for (const error of errors) console.error(`- ERROR: ${error}`);
  for (const warning of warnings) console.error(`- WARNING: ${warning}`);
  process.exit(1);
}

console.log('Map 2 skeleton validation passed.');
console.log(`- ${monsters.length} monster archetypes`);
console.log(`- ${stages.length} stages`);
console.log('- Numeric balance intentionally deferred until Map 1 runtime telemetry exists.');
for (const warning of warnings) console.log(`- WARNING: ${warning}`);

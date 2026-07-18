#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${relativePath}: ${error.message}`);
  }
}

const evolution = readJson('data/design/class-evolution-v1.json');
const codex = readJson('data/design/hero-codex-v1.json');
const balance = readJson('data/design/hero-balance-v1.json');
const fusion = readJson('data/design/hero-fusion-v1.json');
const economy = readJson('data/design/economy-balance-v1.json');
const encounters = readJson('data/design/map1-encounters-v1.json');

const errors = [];
const warnings = [];
const fail = message => errors.push(message);
const warn = message => warnings.push(message);
const unique = values => new Set(values).size === values.length;

const heroIds = balance.heroes.map(hero => hero.id);
const skillIds = balance.skills.map(skill => skill.id);
const codexIds = codex.heroes.map(hero => hero.id);

if (balance.heroes.length !== 21) fail(`Expected 21 balance heroes, got ${balance.heroes.length}`);
if (balance.skills.length !== 21) fail(`Expected 21 skills, got ${balance.skills.length}`);
if (!unique(heroIds)) fail('Duplicate hero ID in hero-balance-v1.json');
if (!unique(skillIds)) fail('Duplicate skill ID in hero-balance-v1.json');
if (!unique(codexIds)) fail('Duplicate hero ID in hero-codex-v1.json');

for (const hero of balance.heroes) {
  if (!codexIds.includes(hero.id)) fail(`Balance hero missing from Codex: ${hero.id}`);
  if (!skillIds.includes(hero.skillId)) fail(`Hero ${hero.id} references missing skill ${hero.skillId}`);
  for (const [key, value] of Object.entries(hero.stats ?? {})) {
    if (!Number.isFinite(value) || value < 0) fail(`Hero ${hero.id} has invalid stat ${key}`);
  }
}

for (const skill of balance.skills) {
  if (!heroIds.includes(skill.ownerId)) fail(`Skill ${skill.id} has missing owner ${skill.ownerId}`);
  const owner = balance.heroes.find(hero => hero.id === skill.ownerId);
  if (owner && owner.skillId !== skill.id) fail(`Skill-owner mismatch: ${skill.id} / ${skill.ownerId}`);
  if (skill.effect?.hits !== undefined) warn(`${skill.id} uses draft field effect.hits; root schema currently has no multi-hit field`);
  if (skill.effect?.statusId) warn(`${skill.id} requires runtime status definition ${skill.effect.statusId}`);
  if (skill.effect?.summonId) warn(`${skill.id} requires runtime summon definition ${skill.effect.summonId}`);
}

const evolutionLines = evolution.classLines ?? [];
if (evolutionLines.length !== 7) fail(`Expected 7 evolution lines, got ${evolutionLines.length}`);
for (const line of evolutionLines) {
  if ((line.evolutionOptions ?? []).length !== 2) fail(`${line.class1Id} must have exactly 2 evolution options`);
  for (const option of line.evolutionOptions ?? []) {
    if (!heroIds.includes(option)) fail(`${line.class1Id} evolution references missing hero ${option}`);
  }
}

const fusionRules = fusion.rules ?? fusion.fusionRules ?? [];
if (fusionRules.length !== 7) fail(`Expected 7 hero fusion rules, got ${fusionRules.length}`);

if (economy.startingGold !== economy.shop?.class1HeroCost) {
  fail('Starting gold must equal exactly one Class 1 hero cost');
}
if (economy.capacity?.benchSlots !== 5) fail('Bench capacity must be exactly 5');
if (economy.capacity?.weaponSlotsPerHero !== 2) fail('Weapon slots per hero must be exactly 2');
if (economy.capacity?.weaponInventorySlots === 8) warn('Weapon inventory capacity 8 remains a balance draft, not a locked value');

const stages = encounters.stages ?? [];
if (stages.length !== 15) fail(`Expected 15 Map 1 stages, got ${stages.length}`);
for (let index = 0; index < stages.length; index += 1) {
  if (stages[index].stage !== index + 1) fail(`Stage sequence mismatch at index ${index}`);
}
for (const stageNumber of [5, 10, 15]) {
  const stage = stages.find(item => item.stage === stageNumber);
  if (!stage) fail(`Missing stage ${stageNumber}`);
  if (stage?.eliteAllowed) fail(`Elite must not be allowed on stage ${stageNumber}`);
}
const stage5Pool = new Set(stages.find(item => item.stage === 5)?.minibossPool ?? []);
const stage10Pool = new Set(stages.find(item => item.stage === 10)?.minibossPool ?? []);
if (stage5Pool.size !== 2 || !stage5Pool.has('golem') || !stage5Pool.has('orc_warlord')) fail('Stage 5 minibossPool must be exactly [golem, orc_warlord]');
if (stage10Pool.size !== 2 || !stage10Pool.has('bone_dragon') || !stage10Pool.has('lich_king')) fail('Stage 10 minibossPool must be exactly [bone_dragon, lich_king]');
if (stages.find(item => item.stage === 15)?.finalBossId !== 'arena_overlord') fail('Stage 15 boss must be arena_overlord');
if (stages.find(item => item.stage === 15)?.unlock !== 'ninja') fail('Map 1 stage 15 must unlock ninja');

console.log(`Design audit: ${errors.length} error(s), ${warnings.length} warning(s)`);
for (const message of errors) console.error(`ERROR: ${message}`);
for (const message of warnings) console.warn(`WARN: ${message}`);

process.exitCode = errors.length > 0 ? 1 : 0;

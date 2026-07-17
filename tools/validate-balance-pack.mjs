#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = [];
const fail = (message) => errors.push(message);

const hero = read('data/design/hero-balance-v1.json');
const fusion = read('data/design/hero-fusion-v1.json');
const economy = read('data/design/economy-balance-v1.json');
const map1 = read('data/design/map1-encounters-v1.json');

if (hero.heroes.length !== 21) fail(`hero count must be 21, got ${hero.heroes.length}`);
const heroIds = new Set(hero.heroes.map((h) => h.id));
if (heroIds.size !== hero.heroes.length) fail('hero IDs must be unique');
const skillIds = new Set(hero.skills.map((s) => s.id));
if (skillIds.size !== hero.skills.length) fail('skill IDs must be unique');
for (const h of hero.heroes) {
  if (!skillIds.has(h.skillId)) fail(`${h.id} references missing skill ${h.skillId}`);
  if (h.stats.hp <= 0 || h.stats.maxMana <= 0) fail(`${h.id} has invalid positive stats`);
  if (h.stats.startingMana > h.stats.maxMana) fail(`${h.id} startingMana exceeds maxMana`);
}

if (fusion.rules.length !== 7) fail(`fusion rule count must be 7, got ${fusion.rules.length}`);
for (const rule of fusion.rules) {
  if (rule.inputs.length !== 3 || new Set(rule.inputs).size !== 1) fail(`${rule.id} requires three identical inputs`);
  if (rule.outputs.length !== 2 || new Set(rule.outputs).size !== 2) fail(`${rule.id} requires exactly two distinct outputs`);
  for (const id of [...rule.inputs, ...rule.outputs]) if (!heroIds.has(id)) fail(`${rule.id} references missing hero ${id}`);
}

if (economy.startingGold !== economy.shop.class1HeroCost) fail('starting gold must equal exactly one Class 1 purchase');
for (const row of economy.sellback.values) {
  const expected = Math.floor(row.buyValue * economy.sellback.rate);
  if (row.sellValue !== expected) fail(`sell value for ${row.buyValue} must be ${expected}`);
}
if (economy.capacity.benchSlots !== 5) fail('benchSlots must be exactly 5');
if (economy.capacity.weaponSlotsPerHero !== 2) fail('weaponSlotsPerHero must be exactly 2');

if (map1.stages.length !== 15) fail(`Map 1 must contain 15 stages, got ${map1.stages.length}`);
const stages = new Map(map1.stages.map((s) => [s.stage, s]));
for (let n = 1; n <= 15; n += 1) if (!stages.has(n)) fail(`missing Map 1 stage ${n}`);
for (const [n, expectedType] of [[5, 'miniboss'], [10, 'miniboss'], [15, 'boss']]) {
  if (stages.get(n)?.type !== expectedType) fail(`stage ${n} must be ${expectedType}`);
  if (stages.get(n)?.eliteAllowed) fail(`elite is forbidden on stage ${n}`);
}
const pool5 = new Set(stages.get(5)?.minibossPool ?? []);
const pool10 = new Set(stages.get(10)?.minibossPool ?? []);
for (const id of pool5) if (pool10.has(id)) fail('stage 5 and 10 miniboss pools must not repeat');
const monsterIds = new Set(map1.monsters.map((m) => m.id));
for (const stage of map1.stages) {
  for (const id of stage.pool ?? []) if (!monsterIds.has(id)) fail(`stage ${stage.stage} references missing monster ${id}`);
  for (const id of stage.minibossPool ?? []) if (!monsterIds.has(id)) fail(`stage ${stage.stage} references missing miniboss ${id}`);
  if (stage.finalBossId && !monsterIds.has(stage.finalBossId)) fail(`stage ${stage.stage} references missing boss ${stage.finalBossId}`);
  if (stage.stage < 4 && stage.eliteAllowed) fail(`elite cannot appear before stage 4`);
}

if (errors.length) {
  console.error(`Balance pack validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Balance pack validation passed: 21 heroes, 7 fusion rules, economy constraints, and Map 1 stages 1-15.');

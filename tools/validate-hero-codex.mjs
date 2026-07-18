#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const HERO_PATH = process.argv[2] ?? 'data/design/hero-codex-v1.json';
const EVOLUTION_PATH = process.argv[3] ?? 'data/design/class-evolution-v1.json';

const EXPECTED_CLASS_LINES = [
  'fighter',
  'swordman',
  'archer',
  'mage',
  'summoner',
  'acolyte',
  'merchant'
];

const VALID_DAMAGE_PROFILES = new Set(['physical', 'magical', 'hybrid']);
const VALID_RANGE_CATEGORIES = new Set(['melee', 'mid', 'long']);

function fail(errors, message) {
  errors.push(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

async function main() {
  const [codex, evolution] = await Promise.all([
    readJson(HERO_PATH),
    readJson(EVOLUTION_PATH)
  ]);

  const errors = [];
  const heroes = Array.isArray(codex.heroes) ? codex.heroes : [];
  const roleIds = new Set((evolution.roleIcons ?? []).map((entry) => entry.id));
  const classLines = evolution.classLines ?? [];
  const heroById = new Map();

  for (const hero of heroes) {
    if (!hero?.id) {
      fail(errors, 'Hero entry is missing id.');
      continue;
    }
    if (heroById.has(hero.id)) fail(errors, `Duplicate hero id: ${hero.id}`);
    heroById.set(hero.id, hero);

    if (![1, 2].includes(hero.classTier)) fail(errors, `${hero.id}: classTier must be 1 or 2.`);
    if (!EXPECTED_CLASS_LINES.includes(hero.classLine)) fail(errors, `${hero.id}: unknown classLine ${hero.classLine}.`);
    if (!['male', 'female'].includes(hero.gender)) fail(errors, `${hero.id}: invalid gender.`);
    if (!VALID_DAMAGE_PROFILES.has(hero.damageProfile)) fail(errors, `${hero.id}: invalid damageProfile.`);
    if (!VALID_RANGE_CATEGORIES.has(hero.rangeCategory)) fail(errors, `${hero.id}: invalid rangeCategory.`);

    if (!Array.isArray(hero.roleIconIds) || hero.roleIconIds.length < 2 || hero.roleIconIds.length > 3) {
      fail(errors, `${hero.id}: roleIconIds must contain 2-3 entries.`);
    } else {
      if (hasDuplicates(hero.roleIconIds)) fail(errors, `${hero.id}: roleIconIds contains duplicates.`);
      for (const roleId of hero.roleIconIds) {
        if (!roleIds.has(roleId)) fail(errors, `${hero.id}: unknown role icon ${roleId}.`);
      }
    }

    for (const keyField of ['playstyleKey']) {
      if (typeof hero[keyField] !== 'string' || hero[keyField].length === 0) {
        fail(errors, `${hero.id}: missing ${keyField}.`);
      }
    }

    for (const keyArray of ['strengthKeys', 'weaknessKeys']) {
      if (!Array.isArray(hero[keyArray]) || hero[keyArray].length === 0 || hasDuplicates(hero[keyArray])) {
        fail(errors, `${hero.id}: ${keyArray} must be a non-empty unique array.`);
      }
    }

    const options = hero.evolutionOptions;
    if (!Array.isArray(options)) {
      fail(errors, `${hero.id}: evolutionOptions must be an array.`);
    } else if (hero.classTier === 1 && options.length !== 2) {
      fail(errors, `${hero.id}: Class 1 must have exactly two evolutionOptions.`);
    } else if (hero.classTier === 2 && options.length !== 0) {
      fail(errors, `${hero.id}: Class 2 must not have evolutionOptions.`);
    }
  }

  for (const lineId of EXPECTED_CLASS_LINES) {
    const members = heroes.filter((hero) => hero.classLine === lineId);
    const tier1 = members.filter((hero) => hero.classTier === 1);
    const tier2 = members.filter((hero) => hero.classTier === 2);
    if (tier1.length !== 1) fail(errors, `${lineId}: expected exactly one Class 1 hero.`);
    if (tier2.length !== 2) fail(errors, `${lineId}: expected exactly two Class 2 heroes.`);

    if (tier1.length === 1) {
      const optionSet = new Set(tier1[0].evolutionOptions);
      const tier2Set = new Set(tier2.map((hero) => hero.id));
      if (optionSet.size !== 2 || [...optionSet].some((id) => !tier2Set.has(id))) {
        fail(errors, `${lineId}: Class 1 evolutionOptions do not match its Class 2 heroes.`);
      }
    }
  }

  for (const line of classLines) {
    const class1 = heroById.get(line.class1Id);
    if (!class1) {
      fail(errors, `Evolution file references missing Class 1 hero: ${line.class1Id}`);
      continue;
    }
    if (JSON.stringify(class1.evolutionOptions) !== JSON.stringify(line.evolutionOptions)) {
      fail(errors, `${line.class1Id}: evolutionOptions differ between codex and evolution data.`);
    }
    for (const branch of line.branches ?? []) {
      const hero = heroById.get(branch.heroId);
      if (!hero) {
        fail(errors, `Evolution branch references missing hero: ${branch.heroId}`);
        continue;
      }
      for (const field of ['roleIconIds', 'damageProfile', 'rangeCategory', 'playstyleKey', 'strengthKeys', 'weaknessKeys']) {
        if (JSON.stringify(hero[field]) !== JSON.stringify(branch[field])) {
          fail(errors, `${branch.heroId}: ${field} differs between codex and evolution data.`);
        }
      }
    }
  }

  const femaleIds = new Set(['archer', 'sniper', 'ranger', 'acolyte', 'priest', 'inquisitor']);
  for (const hero of heroes) {
    const expectedGender = femaleIds.has(hero.id) ? 'female' : 'male';
    if (hero.gender !== expectedGender) fail(errors, `${hero.id}: gender must be ${expectedGender}.`);
  }

  if (heroes.length !== 21) fail(errors, `Expected 21 Class 1/Class 2 heroes, found ${heroes.length}.`);

  if (errors.length > 0) {
    console.error(`Hero Codex validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Hero Codex validation passed: ${heroes.length} heroes across ${EXPECTED_CLASS_LINES.length} class lines.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

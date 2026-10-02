#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';

// ninja is a Demo 1 Class Tier 3 secret class locked in docs/DEMO1_DATA_POLICY.md (unlocked after
// Stage 15) — kept required here because data/demo1-localization.json already carries real th/en
// text for it, even though it is not yet in the hero-codex-v1.json roster or runtime HERO_DEFS.
const REQUIRED_HERO_IDS = [
  'fighter', 'swordman', 'archer', 'mage', 'summoner', 'acolyte', 'merchant', 'ninja',
];
// warden and champion are removed here: both are obsolete Demo 1 boss identities (superseded by
// the Stage 5/10 miniboss pools and the arena_overlord Stage 15 fixed boss — see
// docs/DEMO1_DATA_POLICY.md). Their keys may still exist in the data file for historical
// compatibility, but this validator must not require them.
const REQUIRED_MONSTER_IDS = [
  'slime', 'orc', 'stonewolf', 'skeleton', 'spiritarcher', 'shadowassassin',
  'golem', 'orcwarlord', 'bonedragon', 'lichking', 'arenaoverlord',
];
const REQUIRED_WEAPON_IDS = ['weapon_lvl1', 'weapon_lvl2', 'weapon_lvl3'];
const REQUIRED_EXTRA_KEYS = ['map.arena_ruins.name'];

function requiredKeys() {
  return [
    ...REQUIRED_HERO_IDS.flatMap((id) => [
      `hero.${id}.name`,
      `hero.${id}.description`,
    ]),
    ...REQUIRED_MONSTER_IDS.map((id) => `monster.${id}.name`),
    ...REQUIRED_WEAPON_IDS.map((id) => `weapon.${id}.name`),
    ...REQUIRED_EXTRA_KEYS,
  ];
}

function validate(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['root must be an object'];
  }
  if (data.schemaVersion !== 1) errors.push('schemaVersion must equal 1');

  const languages = Array.isArray(data.requiredLanguages)
    ? data.requiredLanguages
    : [];
  for (const language of ['th', 'en']) {
    if (!languages.includes(language)) {
      errors.push(`requiredLanguages is missing ${language}`);
    }
    if (!data[language] || typeof data[language] !== 'object' || Array.isArray(data[language])) {
      errors.push(`${language} must be an object`);
    }
  }

  if (errors.length > 0) return errors;

  const keys = requiredKeys();
  for (const key of keys) {
    for (const language of ['th', 'en']) {
      const value = data[language][key];
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${language} is missing a non-empty value for ${key}`);
      }
    }
  }

  const thKeys = new Set(Object.keys(data.th));
  const enKeys = new Set(Object.keys(data.en));
  for (const key of thKeys) {
    if (!enKeys.has(key)) errors.push(`en is missing key present in th: ${key}`);
  }
  for (const key of enKeys) {
    if (!thKeys.has(key)) errors.push(`th is missing key present in en: ${key}`);
  }

  for (const language of ['th', 'en']) {
    for (const key of Object.keys(data[language])) {
      if (key.includes('novice')) {
        errors.push(`${language} contains prohibited Novice key: ${key}`);
      }
    }
  }

  return errors;
}

async function main() {
  const path = process.argv[2] || 'data/demo1-localization.json';
  try {
    const source = await readFile(path, 'utf8');
    const data = JSON.parse(source);
    const errors = validate(data);
    for (const error of errors) console.error(`ERROR: ${error}`);
    if (errors.length > 0) {
      console.error(`Localization validation failed with ${errors.length} error(s).`);
      process.exitCode = 1;
      return;
    }
    console.log('Demo 1 localization validation passed.');
  } catch (error) {
    console.error(`Localization validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();

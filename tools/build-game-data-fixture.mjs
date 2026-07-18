#!/usr/bin/env node

// Deterministic adapter that assembles the root object consumed by
// tools/validate-game-data.mjs from the canonical split authoring files.
// It reshapes authored data but does not invent identities, references, or values.
// Usage: node tools/build-game-data-fixture.mjs <output.json> [repoRoot]

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const outPath = process.argv[2];
const repoRoot = process.argv[3] ? path.resolve(process.argv[3]) : process.cwd();

if (!outPath) {
  console.error('Usage: node tools/build-game-data-fixture.mjs <output.json> [repoRoot]');
  process.exit(2);
}

const readJson = async (relPath) => JSON.parse(await readFile(path.join(repoRoot, relPath), 'utf8'));

const PLACEHOLDERS = {
  heroTargetingBehavior: 'nearest',
  skillCastTime: 0,
};

async function build() {
  const codex = await readJson('data/design/hero-codex-v1.json');
  const balance = await readJson('data/design/hero-balance-v1.json');
  const fusion = await readJson('data/design/hero-fusion-v1.json');
  const map1 = await readJson('data/design/map1-encounters-v1.json');
  const monsterSkillPack = await readJson('data/design/map1-monster-skills-v1.json');
  const secret = await readJson('data/design/secret-heroes-v1.json');
  const baseLocalization = await readJson('data/demo1-localization.json');
  const monsterSkillLocalization = await readJson('data/map1-monster-skills-localization-v1.json');

  const statsById = new Map(balance.heroes.map((hero) => [hero.id, hero]));
  const activeMonsterById = new Map(
    map1.monsters
      .filter((monster) => monster.status !== 'obsolete')
      .map((monster) => [monster.id, monster]),
  );
  const gapNotes = [];

  const heroes = codex.heroes.map((hero) => {
    const stat = statsById.get(hero.id);
    if (!stat) throw new Error(`build-game-data-fixture: missing hero balance for "${hero.id}"`);
    return {
      id: hero.id,
      gender: hero.gender,
      classTier: hero.classTier,
      targetingBehavior: PLACEHOLDERS.heroTargetingBehavior,
      stats: stat.stats,
      skillId: stat.skillId,
      nameKey: `hero.${hero.id}.name`,
      descriptionKey: `hero.${hero.id}.description`,
    };
  });
  gapNotes.push('hero.*.targetingBehavior still uses the documented placeholder "nearest".');

  const activeMonsters = [...activeMonsterById.values()];
  const excludedObsolete = map1.monsters
    .filter((monster) => monster.status === 'obsolete')
    .map((monster) => monster.id);
  const monsters = activeMonsters.map((monster) => ({
    id: monster.id,
    kind: monster.kind,
    targetingBehavior: monster.targetingBehavior,
    stats: monster.stats,
    skillIds: monster.skillIds,
    nameKey: `monster.${monster.id.replace(/_/g, '')}.name`,
  }));
  if (excludedObsolete.length) gapNotes.push(`excluded obsolete monster ids: ${excludedObsolete.join(', ')}.`);

  const heroSkills = balance.skills.map((skill) => ({
    id: skill.id,
    nameKey: `${skill.id}.name`,
    descriptionKey: `${skill.id}.description`,
    ownerIds: [skill.ownerId],
    cast: {
      manaCost: skill.mana,
      targetingBehavior: skill.target,
      range: statsById.get(skill.ownerId)?.stats?.range ?? 0,
      castTime: PLACEHOLDERS.skillCastTime,
    },
    effects: [skill.effect],
  }));
  gapNotes.push('hero skill castTime remains placeholder 0; monster/boss cast times are now canonical draft values.');

  const monsterSkills = monsterSkillPack.skills.map((skill) => {
    const owner = activeMonsterById.get(skill.ownerId);
    if (!owner) throw new Error(`build-game-data-fixture: monster skill owner is not active: ${skill.ownerId}`);
    const range = skill.rangeMode === 'fixed' ? skill.range : owner.stats.range;
    return {
      id: skill.id,
      nameKey: `${skill.id}.name`,
      descriptionKey: `${skill.id}.description`,
      ownerIds: [skill.ownerId],
      cast: {
        manaCost: skill.mana,
        targetingBehavior: skill.target,
        range,
        castTime: skill.castTime,
      },
      effects: [skill.effect],
      presentation: skill.presentation,
      tags: skill.tags,
    };
  });

  const skills = [...heroSkills, ...monsterSkills];
  const weapons = [];
  gapNotes.push('weapons remain empty because no canonical weapon-item records exist yet.');

  const fusionRules = fusion.rules.flatMap((rule) =>
    rule.outputs.map((output) => ({
      id: `${rule.id}.${output}`,
      kind: 'hero_class_upgrade',
      inputs: rule.inputs,
      output,
      inputTier: 1,
      outputTier: 2,
    })),
  );

  const mapId = map1.map.id;
  const stages = map1.stages.map((stage) => ({
    id: `arena_ruins_${String(stage.stage).padStart(2, '0')}`,
    mapId,
    stageNumber: stage.stage,
    encounterType: stage.type,
    statMultiplier: stage.multiplier,
    allowedMonsterIds: stage.pool ?? [],
    bossPool: stage.type === 'miniboss' ? stage.minibossPool : stage.type === 'boss' ? [stage.finalBossId] : [],
    weaponDropLevels: stage.weaponLevels ?? [],
  }));

  const maps = [{
    id: mapId,
    stageIds: stages.map((stage) => stage.id),
    secretClassUnlock: map1.map.secretClassUnlock,
  }];

  const secretHeroes = (secret.secretHeroes ?? []).map((hero) => ({
    id: hero.id,
    nameKey: hero.nameKey,
    descriptionKey: hero.descriptionKey,
    classTier: hero.classTier,
  }));
  if (!secretHeroes.some((hero) => hero.id === map1.map.secretClassUnlock)) {
    gapNotes.push(`map.${mapId}.secretClassUnlock does not resolve: ${map1.map.secretClassUnlock}.`);
  }

  const requiredLanguages = new Set([
    ...(baseLocalization.requiredLanguages ?? []),
    ...(monsterSkillLocalization.requiredLanguages ?? []),
  ]);
  const localization = {};
  for (const language of requiredLanguages) {
    localization[language] = {
      ...(baseLocalization[language] ?? {}),
      ...(monsterSkillLocalization[language] ?? {}),
    };
  }

  const data = {
    schemaVersion: 1,
    heroes,
    monsters,
    skills,
    weapons,
    fusionRules,
    maps,
    stages,
    secretHeroes,
    localization,
  };

  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Built fixture: ${outPath}`);
  console.log(
    `heroes=${heroes.length} monsters=${monsters.length} heroSkills=${heroSkills.length} `
    + `monsterSkills=${monsterSkills.length} skills=${skills.length} weapons=${weapons.length} `
    + `fusionRules=${fusionRules.length} stages=${stages.length} maps=${maps.length} secretHeroes=${secretHeroes.length}`,
  );
  console.log('Known canonical-data gaps carried into this fixture:');
  for (const note of gapNotes) console.log(`  - ${note}`);
}

await build();

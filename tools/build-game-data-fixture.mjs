#!/usr/bin/env node

// Deterministic adapter that assembles the root object shape consumed by
// tools/validate-game-data.mjs (see docs/GAME_DATA_CONTRACT_V1.md) from the
// current split canonical authoring files under data/design/, data/demo1-*.json,
// and data/design/map1-encounters-v1.json.
//
// This script is the "small adapter" called for in docs/DATA_AUDIT_REPORT.md
// Blocker #1. It does not invent canonical facts (hero roster, boss identities,
// fusion inputs, localization text): every field is either copied directly from
// a named source file, or derived by a documented rename/reshape of that source.
// A small number of fields have NO canonical source yet; those are set from a
// single explicitly-named placeholder constant below and reported in a WARN
// summary so the gap is visible, not hidden.
//
// This script intentionally does not write a checked-in fixture file: the split
// authoring files remain the only source of truth. Run it to produce a scratch
// file for validate-game-data.mjs, e.g.:
//   node tools/build-game-data-fixture.mjs /tmp/game-data.fixture.json
//   node tools/validate-game-data.mjs /tmp/game-data.fixture.json
//
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

// Fields with no current canonical source anywhere in the repository (confirmed
// absent from every data/design/*.json, data/demo1-localization.json, and docs/
// file as of this adapter's authoring). See docs/DATA_AUDIT_REPORT.md Blocker #1.
const PLACEHOLDERS = {
  heroTargetingBehavior: 'nearest',
  skillCastTime: 0,
};

async function build() {
  const codex = await readJson('data/design/hero-codex-v1.json');
  const balance = await readJson('data/design/hero-balance-v1.json');
  const fusion = await readJson('data/design/hero-fusion-v1.json');
  const map1 = await readJson('data/design/map1-encounters-v1.json');
  const localization = await readJson('data/demo1-localization.json');

  const statsById = new Map(balance.heroes.map((h) => [h.id, h]));
  const gapNotes = [];

  // heroes: roster identity (id/gender/classTier) from hero-codex-v1.json;
  // stats/skillId from hero-balance-v1.json, matched by id. classTier: 0
  // (Novice) never appears here because hero-codex-v1.json's roster is already
  // Novice-free (locked by docs/DEMO1_DATA_POLICY.md).
  const heroes = codex.heroes.map((hero) => {
    const stat = statsById.get(hero.id);
    if (!stat) {
      throw new Error(`build-game-data-fixture: hero-balance-v1.json has no stats/skillId entry for hero-codex-v1.json hero "${hero.id}"`);
    }
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
  gapNotes.push('hero.*.targetingBehavior: no per-hero source exists yet; every hero uses the placeholder "nearest" (docs/DATA_AUDIT_REPORT.md Blocker #1).');

  // monsters: data/design/map1-encounters-v1.json, excluding entries marked
  // status:"obsolete" (warden, champion) — obsolete ids must never appear as
  // active Map 1 roster members (docs/DEMO1_DATA_POLICY.md, docs/BOSS_ENCOUNTER_POLICY.md).
  const activeMonsters = map1.monsters.filter((monster) => monster.status !== 'obsolete');
  const excludedObsolete = map1.monsters.filter((monster) => monster.status === 'obsolete').map((m) => m.id);
  const monsters = activeMonsters.map((monster) => ({
    id: monster.id,
    kind: monster.kind,
    targetingBehavior: monster.targetingBehavior,
    stats: monster.stats,
    skillIds: monster.skillIds,
    // data/demo1-localization.json keys strip underscores from monster ids
    // (e.g. orc_warlord -> monster.orcwarlord.name); reproduced verbatim here.
    nameKey: `monster.${monster.id.replace(/_/g, '')}.name`,
  }));
  if (excludedObsolete.length > 0) {
    gapNotes.push(`monsters: excluded obsolete ids from the active fixture roster: ${excludedObsolete.join(', ')}.`);
  }

  // skills: data/design/hero-balance-v1.json skills[]. ownerId/effect are
  // singular in source and wrapped into the root's ownerIds[]/effects[] arrays;
  // mana/target are renamed to cast.manaCost/cast.targetingBehavior. No skill
  // effect values are altered.
  const skills = balance.skills.map((skill) => ({
    id: skill.id,
    nameKey: `${skill.id}.name`,
    descriptionKey: `${skill.id}.description`,
    ownerIds: [skill.ownerId],
    cast: {
      manaCost: skill.mana,
      targetingBehavior: skill.target,
      // No skill-level cast range exists in the draft; the owning hero's own
      // stats.range (hero-balance-v1.json) is reused as the best-available
      // sourced value rather than an invented number.
      range: statsById.get(skill.ownerId)?.stats?.range ?? 0,
      castTime: PLACEHOLDERS.skillCastTime,
    },
    effects: [skill.effect],
  }));
  gapNotes.push('skill.*.cast.castTime: no cast-time data exists in any canonical source yet; every skill uses the placeholder 0 (docs/DATA_AUDIT_REPORT.md Blocker #1).');
  gapNotes.push('skill.*.cast.range: derived from the owning hero\'s stats.range (hero-balance-v1.json); no independent skill-range source exists.');

  // weapons: no canonical weapon-item data source exists anywhere in the repo
  // (only 3 generic name-only localization keys — weapon_lvl1/2/3 — with no id/
  // level/stats/fusionInputs records). Left empty rather than invented.
  const weapons = [];
  gapNotes.push('weapons: left empty — no canonical weapon-item records (id/level/stats/fusionInputs) exist yet, only localization display names.');

  // fusionRules: data/design/hero-fusion-v1.json rules[] use one canonical row
  // per Class 1 line with two possible outputs (player choice at evolution time).
  // The root schema models one input set -> one output, so each canonical row is
  // expanded into two root rows (one per real output). Inputs, outputs, and the
  // locked 3-identical-input rule are copied verbatim and never altered.
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

  // stages/maps: data/design/map1-encounters-v1.json. bossPool is derived from
  // the real minibossPool (Stage 5/10) or [finalBossId] (Stage 15) — the root
  // schema has one bossPool field where the split file uses two more precise
  // fields; only the field shape is mapped, values are untouched canonical IDs.
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

  const maps = [
    {
      id: mapId,
      stageIds: stages.map((stage) => stage.id),
      secretClassUnlock: map1.map.secretClassUnlock,
    },
  ];
  gapNotes.push(`map.${mapId}.secretClassUnlock: "${map1.map.secretClassUnlock}" is documented (docs/CLASS_EVOLUTION_AND_CODEX_POLICY.md) but hero-codex-v1.json has no matching hero record yet, so this reference will not resolve.`);

  const data = {
    schemaVersion: 1,
    heroes,
    monsters,
    skills,
    weapons,
    fusionRules,
    maps,
    stages,
    localization,
  };

  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`Built fixture: ${outPath}`);
  console.log(
    `heroes=${heroes.length} monsters=${monsters.length} skills=${skills.length} weapons=${weapons.length} `
    + `fusionRules=${fusionRules.length} stages=${stages.length} maps=${maps.length}`,
  );
  console.log('Known canonical-data gaps carried into this fixture (not adapter defects):');
  for (const note of gapNotes) console.log(`  - ${note}`);
}

await build();

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const tempDir = mkdtempSync(path.join(tmpdir(), 'autobattler-map1-skill-validation-'));
const fixturePath = path.join(tempDir, 'game-data.fixture.json');

const commands = [
  ['node', ['tools/validate-map1-monster-skills.mjs']],
  ['node', ['tools/build-game-data-fixture.mjs', fixturePath]],
  ['node', ['tools/validate-game-data.mjs', fixturePath]],
  ['node', ['tools/validate-demo1-localization.mjs']],
  ['git', ['diff', '--check']],
];

let failed = false;

try {
  for (const [command, args] of commands) {
    console.log(`\n$ ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    });

    if (result.error) {
      console.error(`Failed to start command: ${result.error.message}`);
      failed = true;
      break;
    }

    if (result.status !== 0) {
      console.error(`Command exited with status ${result.status}`);
      failed = true;
      break;
    }
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (failed) {
  console.error('\nMap 1 monster skill validation package failed.');
  process.exitCode = 1;
} else {
  console.log('\nMap 1 monster skill validation package passed.');
}

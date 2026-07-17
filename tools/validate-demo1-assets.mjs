#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'data', 'demo1-assets.json');

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function exists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  console.error(`FAIL: cannot read ${path.relative(repoRoot, manifestPath)}: ${error.message}`);
  process.exit(1);
}

const entries = [...(manifest.heroes ?? []), ...(manifest.enemies ?? [])];
const seenIds = new Set();
const seenPaths = new Map();

for (const entry of entries) {
  if (!entry.id || typeof entry.id !== 'string') {
    fail('entry missing string id');
    continue;
  }

  if (seenIds.has(entry.id)) fail(`duplicate logical id: ${entry.id}`);
  seenIds.add(entry.id);

  if (entry.canonical === true) {
    if (!entry.path || typeof entry.path !== 'string') {
      fail(`canonical entry has no path: ${entry.id}`);
      continue;
    }

    if (seenPaths.has(entry.path)) {
      fail(`canonical path reused by ${seenPaths.get(entry.path)} and ${entry.id}: ${entry.path}`);
    } else {
      seenPaths.set(entry.path, entry.id);
    }

    if (!(await exists(entry.path))) fail(`missing required canonical asset: ${entry.id} -> ${entry.path}`);
  } else if (entry.required === true && !entry.path) {
    warn(`required asset remains unresolved: ${entry.id}`);
  }
}

for (const prohibitedId of manifest.rules?.prohibitedLogicalIds ?? []) {
  if (seenIds.has(prohibitedId)) fail(`prohibited logical id appears in canonical entries: ${prohibitedId}`);
}

for (const deprecatedPath of manifest.deprecatedAssets ?? []) {
  if (seenPaths.has(deprecatedPath)) fail(`deprecated asset is mapped as canonical: ${deprecatedPath}`);
  if (!(await exists(deprecatedPath))) warn(`deprecated asset no longer exists (safe to update manifest later): ${deprecatedPath}`);
}

const expectedHeroIds = ['fighter', 'swordman', 'archer', 'mage', 'summoner', 'acolyte', 'merchant'];
const actualHeroIds = new Set((manifest.heroes ?? []).map((entry) => entry.id));
for (const id of expectedHeroIds) {
  if (!actualHeroIds.has(id)) fail(`missing Class 1 hero mapping: ${id}`);
}
if (actualHeroIds.size !== expectedHeroIds.length) {
  fail(`Class 1 hero mapping must contain exactly ${expectedHeroIds.length} entries; found ${actualHeroIds.size}`);
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`FAIL: ${error}`);

if (errors.length > 0) {
  console.error(`\nDemo 1 asset validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`PASS: Demo 1 asset manifest is structurally valid.`);
console.log(`Canonical entries: ${seenPaths.size}`);
console.log(`Warnings: ${warnings.length}`);

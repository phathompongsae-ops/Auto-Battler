#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TASK_DIR = path.join(ROOT, 'data', 'agent-tasks');
const ALLOWED_STATUSES = new Set([
  'READY_FOR_COCO',
  'COCO_WORKING',
  'READY_FOR_CC',
  'CC_WORKING',
  'READY_FOR_HUMAN_REVIEW',
  'APPROVED',
  'REWORK_REQUIRED',
  'BLOCKED',
  'DONE',
]);
const OWNER_BY_STATUS = {
  READY_FOR_COCO: new Set(['coco']),
  COCO_WORKING: new Set(['coco']),
  READY_FOR_CC: new Set(['cc']),
  CC_WORKING: new Set(['cc']),
  READY_FOR_HUMAN_REVIEW: new Set(['user']),
  APPROVED: new Set(['user']),
  REWORK_REQUIRED: new Set(['coco', 'cc']),
  BLOCKED: new Set(['coco', 'cc', 'user']),
  DONE: new Set(['coco', 'cc', 'user']),
};
const FORBIDDEN_TRUE_KEYS = new Set([
  'canonicalApproved',
  'runtimeEligible',
  'runtimeIntegrated',
  'attackPackageApproved',
  'completeArcherMotionApproved',
]);
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

const errors = [];
const warnings = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function warn(file, message) {
  warnings.push(`${file}: ${message}`);
}

function walk(value, file, keyPath = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, file, [...keyPath, String(index)]));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...keyPath, key];
    if (FORBIDDEN_TRUE_KEYS.has(key) && child === true) {
      fail(file, `${nextPath.join('.')} must not become true through the task queue; explicit approval/runtime workflows own this transition`);
    }
    if ((key === 'sha' || key.endsWith('CommitSha')) && typeof child === 'string' && child.length > 0 && !SHA40.test(child)) {
      fail(file, `${nextPath.join('.')} must be a lowercase 40-char git SHA when present`);
    }
    if ((key === 'sha256' || key.endsWith('Sha256')) && typeof child === 'string' && child.length > 0 && !SHA256.test(child)) {
      fail(file, `${nextPath.join('.')} must be a lowercase 64-char SHA-256 when present`);
    }
    walk(child, file, nextPath);
  }
}

function validateTask(task, file) {
  if (task?.schemaVersion !== 1) fail(file, 'schemaVersion must equal 1');
  if (typeof task?.taskId !== 'string' || !task.taskId.trim()) fail(file, 'taskId is required');
  if (typeof task?.title !== 'string' || !task.title.trim()) fail(file, 'title is required');
  if (task?.repository !== 'phathompongsae-ops/Auto-Battler') fail(file, 'repository must be phathompongsae-ops/Auto-Battler');
  if (!['coco', 'cc', 'user'].includes(task?.owner)) fail(file, 'owner must be coco, cc, or user');
  if (!ALLOWED_STATUSES.has(task?.status)) fail(file, `unsupported status ${JSON.stringify(task?.status)}`);

  const validOwners = OWNER_BY_STATUS[task?.status];
  if (validOwners && !validOwners.has(task.owner)) {
    fail(file, `owner ${task.owner} is invalid for status ${task.status}`);
  }

  if (task?.base?.sha != null && task.base.sha !== '' && !SHA40.test(task.base.sha)) {
    fail(file, 'base.sha must be a lowercase 40-char git SHA');
  }

  if (!task?.scope || !Array.isArray(task.scope.allow) || !Array.isArray(task.scope.deny)) {
    fail(file, 'scope.allow and scope.deny must both be arrays');
  }
  if (!Array.isArray(task?.requiredOutputs)) fail(file, 'requiredOutputs must be an array');
  if (!Array.isArray(task?.validation)) fail(file, 'validation must be an array');

  if (task?.status === 'BLOCKED') {
    if (!task.blocker || typeof task.blocker !== 'object') {
      fail(file, 'BLOCKED tasks require blocker details');
    } else {
      for (const field of ['code', 'resolver', 'resolution']) {
        if (typeof task.blocker[field] !== 'string' || !task.blocker[field].trim()) {
          fail(file, `BLOCKED task blocker.${field} is required`);
        }
      }
    }
  } else if (task?.blocker) {
    warn(file, `status ${task.status} carries blocker metadata; clear it when the blocker is resolved`);
  }

  if (task?.status === 'READY_FOR_CC' && task?.handoff?.nextOwner && task.handoff.nextOwner !== 'cc') {
    fail(file, 'READY_FOR_CC must hand off to cc');
  }
  if (task?.status === 'READY_FOR_COCO' && task?.handoff?.nextOwner && task.handoff.nextOwner !== 'coco') {
    fail(file, 'READY_FOR_COCO must hand off to coco');
  }
  if (task?.status === 'READY_FOR_HUMAN_REVIEW' && task?.handoff?.nextOwner && task.handoff.nextOwner !== 'user') {
    fail(file, 'READY_FOR_HUMAN_REVIEW must hand off to user');
  }

  if (task?.reporting?.requireActualTestsRun !== true) {
    fail(file, 'reporting.requireActualTestsRun must remain true');
  }

  walk(task, file);
}

if (!fs.existsSync(TASK_DIR)) {
  console.error(`ERROR: task directory not found: ${TASK_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(TASK_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error('ERROR: no task JSON files found');
  process.exit(1);
}

for (const name of files) {
  const fullPath = path.join(TASK_DIR, name);
  let task;
  try {
    task = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    fail(name, `invalid JSON: ${error.message}`);
    continue;
  }
  validateTask(task, name);
}

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);

if (errors.length > 0) {
  console.error(`Agent task queue validation FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`Agent task queue validation PASS: ${files.length} task(s), ${warnings.length} warning(s)`);

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taskDir = path.join(root, 'data', 'agent-tasks');

if (!fs.existsSync(taskDir)) {
  console.error('agent task directory not found:', taskDir);
  process.exit(1);
}

const files = fs.readdirSync(taskDir).filter((f) => f.endsWith('.json')).sort();
const plans = [];
for (const file of files) {
  const full = path.join(taskDir, file);
  const task = JSON.parse(fs.readFileSync(full, 'utf8'));
  let action = 'NO_AUTOMATIC_ACTION';
  let target = null;

  if (task.status === 'READY_FOR_COCO') {
    action = 'DISPATCH_COCO';
    target = 'coco';
  } else if (task.status === 'READY_FOR_CC') {
    action = 'DISPATCH_CC';
    target = 'cc';
  } else if (task.status === 'READY_FOR_HUMAN_REVIEW') {
    action = 'REQUEST_HUMAN_REVIEW';
    target = 'user';
  } else if (task.status === 'BLOCKED') {
    action = 'REPORT_BLOCKER';
    target = task.blocker?.resolver ?? task.owner ?? null;
  }

  plans.push({
    taskId: task.taskId,
    status: task.status,
    owner: task.owner,
    action,
    target,
    nextOwner: task.handoff?.nextOwner ?? null,
    transitionCondition: task.handoff?.transitionCondition ?? null,
    blocker: task.blocker ?? null
  });
}

console.log(JSON.stringify({schemaVersion: 1, generatedAt: new Date().toISOString(), plans}, null, 2));

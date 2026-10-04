import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INTERNAL_DEMO_QUESTS, QUESTS } from '../../src/data/questData';
import { cumulativeExp } from '../../src/progression/expCurve';
import { makeSaveTarget } from './fixtures';

test('Internal Demo has no required Main Quest and reaches real Job Change from field EXP', () => {
  assert.equal(Object.values(INTERNAL_DEMO_QUESTS).some((q) => q.type === 'main' || q.type === 'feature'), false);
  assert.ok(QUESTS.q_demo_01, 'old fixture remains known for tests and saves');
  const t = makeSaveTarget(1, undefined, undefined, INTERNAL_DEMO_QUESTS);
  assert.equal(t.quests.status('job_c1_01_instructor'), 'locked');
  t.progression.grantExp(t.player, cumulativeExp(11));
  assert.equal(t.combat.level, 11);
  assert.equal(t.quests.status('job_c1_01_instructor'), 'available');
  assert.equal(t.features.isFeatureUnlocked('job_change'), true);
  assert.equal(t.features.isFeatureUnlocked('class_1_skills'), false);
  t.quests.start('job_c1_01_instructor');
  t.events.emit('npcInteracted', { npcId: 'demo_job_instructor' });
  assert.equal(t.quests.claim('job_c1_01_instructor').ok, true);
  t.quests.start('job_c1_02_trial');
  t.events.emit('locationReached', { locationId: 'demo_job_trial_marker' });
  for (let i = 0; i < 3; i++) t.events.emit('monsterKilled', { entityId: `m-${i}`, monsterId: 'slime', tier: 'normal', zone: 'field' });
  assert.equal(t.quests.claim('job_c1_02_trial').ok, true);
  t.quests.start('job_c1_03_report');
  t.events.emit('npcInteracted', { npcId: 'demo_job_instructor' });
  assert.equal(t.quests.claim('job_c1_03_report').ok, true);
  assert.equal(t.jobChange.select('warrior').ok, true);
  assert.equal(t.features.isFeatureUnlocked('class_1_skills'), true);
});

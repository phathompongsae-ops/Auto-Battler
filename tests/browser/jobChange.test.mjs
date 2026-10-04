// Class 1 Job Change through the real game: level-up, Job Trial quests, the temporary selection window.
import { sleep } from './cdp.mjs';

export async function jobChangeSuite(b, t) {
  t.section('Class 1 Job Change in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.setRng(0.5); debug.clearLog()');
  await sleep(150);
  const state = () => b.eval('debug.jobState()');
  const status = (id) => b.eval(`debug.questProgress('${id}').status`);
  const events = (type) => b.eval(`debug.log.filter((e) => e.type === '${type}').length`);
  const windowOpen = () => b.eval(`!!document.querySelector('[data-window="job-select"]')`);

  let s = await state();
  t.check('J-1. a Lv1 Novice cannot take the Job Quest yet', s.classId === 'novice' && s.stage === 'novice' && (await status('job_c1_01_instructor')) === 'locked', JSON.stringify(s));

  await b.eval(`debug.grantExp(25000)`); // exactly the cumulative EXP of Lv11 (real level-ups)
  s = await state();
  t.check(
    'J-2. reaching Lv11 makes the Job Quest available (announced once)',
    s.level === 11 && (await status('job_c1_01_instructor')) === 'available' && (await events('jobQuestAvailable')) === 1,
    JSON.stringify({ level: s.level }),
  );

  // Trial: talk → (Auto Move to the trial marker, 3 real slime kills) → report.
  await b.eval(`debug.startQuest('job_c1_01_instructor'); debug.talkToNpc('demo_job_instructor')`);
  const claim1 = await b.eval(`debug.claimQuest('job_c1_01_instructor')`);
  await b.eval(`debug.startQuest('job_c1_02_trial')`);
  const nav = await b.eval(`debug.navigateToQuest('job_c1_02_trial', 0)`);
  await b.waitFor(`debug.navState().status !== 'moving' && debug.navState()`, { timeout: 8000, label: 'reach trial marker' });
  for (const id of ['slime-1', 'slime-2', 'slime-3']) {
    const p = await b.eval('debug.navState()');
    await b.eval(`debug.placeMonster('${id}', ${p.x}, ${p.y - 48})`);
    await b.eval(`debug.resetCooldowns(); debug.selectTarget('${id}'); debug.setMonsterHp('${id}', 5)`);
    await b.press('Space');
    await b.waitFor(`debug.monster('${id}').dead`, { timeout: 2000, label: `${id} dies` });
  }
  const trial = await b.eval(`debug.questProgress('job_c1_02_trial')`);
  const claim2 = await b.eval(`debug.claimQuest('job_c1_02_trial')`);
  const before = await state();
  await b.eval(`debug.startQuest('job_c1_03_report'); debug.talkToNpc('demo_job_instructor')`);
  t.check('J-3. the trial progresses through the Quest Engine (talk, Auto Move to marker, real kills)', claim1.ok && nav.ok && trial.status === 'completed' && claim2.ok && before.stage === 'novice', JSON.stringify({ trial, before: before.stage }));

  const claim3 = await b.eval(`debug.claimQuest('job_c1_03_report')`);
  s = await state();
  t.check(
    'J-4. finishing the trial opens job selection once, with the temporary selection window',
    claim3.ok && s.stage === 'selection_available' && (await events('jobSelectionAvailable')) === 1 && (await windowOpen()),
    JSON.stringify({ stage: s.stage }),
  );

  // Choose Warrior in the window (the real selection path).
  const hpBefore = (await b.eval('debug.player().stats')).maxHp;
  await b.eval(`document.querySelector('[data-window="job-select"] [data-job="warrior"]').click()`);
  await b.eval(`document.querySelector('[data-window="job-select"] [data-action="confirm"]').click()`);
  await sleep(100);
  s = await state();
  const hpAfter = (await b.eval('debug.player().stats')).maxHp;
  t.check(
    'J-5. selecting Warrior: class, Job Bonus, class_1_skills, 1 Skill Point, stats recalculated, window closed',
    s.classId === 'warrior' && JSON.stringify(s.jobBonuses) === '{"warrior":{"str":3,"vit":2}}' && s.class1SkillsUnlocked &&
      s.earnedSkillPoints === 1 && hpAfter > hpBefore && !(await windowOpen()),
    JSON.stringify({ classId: s.classId, jobBonuses: s.jobBonuses, sp: s.earnedSkillPoints, hp: [hpBefore, hpAfter] }),
  );

  const saved = await b.eval('debug.save()');
  await b.eval('debug.reset()');
  const wiped = await state();
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  const restored = await state();
  t.check(
    'J-6. save -> reset -> load keeps the Warrior with one Job Bonus and the same Skill Points',
    wiped.classId === 'novice' && loaded.ok && restored.classId === 'warrior' && JSON.stringify(restored.jobBonuses) === JSON.stringify(s.jobBonuses) &&
      restored.earnedSkillPoints === 1 && restored.class1SkillsUnlocked,
    JSON.stringify({ loaded, restored: { classId: restored.classId, jobBonuses: restored.jobBonuses, sp: restored.earnedSkillPoints } }),
  );

  const again = await b.eval(`debug.chooseJob('archer')`);
  await b.eval(`debug.talkToNpc('demo_job_instructor')`);
  t.check('J-7. a second job selection fails and the window never reopens', !again.ok && again.reason === 'already_changed' && !(await windowOpen()), JSON.stringify(again));

  await b.eval('debug.reset(); debug.setRng(null)');
}

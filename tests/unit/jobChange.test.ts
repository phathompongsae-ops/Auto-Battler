import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FixedServerDay } from '../../src/core/serverDay';
import { CLASS_GROWTH } from '../../src/data/classGrowth';
import { CLASS_1_JOB_CHANGE, JOB_INSTRUCTOR_NPC_ID, JOB_TRIAL_MARKER_ID } from '../../src/data/jobChangeData';
import type { JobId } from '../../src/data/jobData';
import { NAVIGATION } from '../../src/data/navigationData';
import { QUESTS, type QuestDef } from '../../src/data/questData';
import { JOB_QUESTS } from '../../src/data/quests/jobQuests';
import { NavIndex } from '../../src/navigation/NavIndex';
import { resolveQuestObjective } from '../../src/navigation/questNavigation';
import { cumulativeExp, expToNext } from '../../src/progression/expCurve';
import { CLASS_1_CHOICES, jobDefinition } from '../../src/progression/JobChange';
import { allocateStat } from '../../src/progression/statActions';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { classBaseStats, classGrowthMaxLevel, ClassGrowthRangeError } from '../../src/stats/classBaseStats';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { makeSaveTarget } from './fixtures';

const BONUSES: Record<Exclude<JobId, 'novice'>, Record<string, number>> = {
  warrior: { str: 3, vit: 2 },
  archer: { dex: 3, agi: 2 },
  mage: { int: 3, dex: 2 },
  cleric: { int: 3, vit: 2 },
  ninja: { agi: 3, luk: 2 },
};

/** The approved Class 1 anchors (HP / MP / ATK / MATK / DEF / MDEF). */
const ANCHORS: Record<Exclude<JobId, 'novice'>, Record<11 | 20 | 30 | 40, number[]>> = {
  warrior: { 11: [700, 120, 70, 25, 25, 12], 20: [1050, 160, 110, 30, 40, 18], 30: [1550, 220, 165, 40, 60, 26], 40: [2150, 300, 230, 50, 85, 35] },
  archer: { 11: [560, 170, 75, 25, 18, 15], 20: [850, 220, 120, 30, 28, 22], 30: [1230, 300, 180, 40, 42, 32], 40: [1700, 400, 250, 50, 60, 45] },
  mage: { 11: [420, 300, 35, 85, 12, 25], 20: [620, 470, 45, 140, 18, 42], 30: [900, 680, 60, 210, 26, 62], 40: [1200, 920, 80, 290, 35, 90] },
  cleric: { 11: [560, 260, 40, 65, 18, 28], 20: [850, 410, 55, 105, 28, 45], 30: [1230, 590, 75, 160, 42, 66], 40: [1700, 800, 100, 220, 60, 95] },
  ninja: { 11: [500, 170, 78, 25, 16, 15], 20: [750, 230, 125, 30, 24, 22], 30: [1080, 310, 190, 40, 36, 32], 40: [1500, 420, 265, 50, 50, 45] },
};
const asArray = (v: { hp: number; mp: number; atk: number; matk: number; def: number; mdef: number }) => [v.hp, v.mp, v.atk, v.matk, v.def, v.mdef];

function rig(level = 11, defs: Record<string, QuestDef> = QUESTS) {
  const t = makeSaveTarget(level, undefined, new FixedServerDay(21), defs);
  const log: string[] = [];
  for (const type of ['questAvailable', 'jobQuestAvailable', 'jobTrialCompleted', 'jobSelectionAvailable', 'jobChanged', 'featureUnlocked'] as const) {
    t.events.on(type, (e) => log.push(`${type}:${(e as { questId?: string; jobId?: string; featureId?: string }).questId ?? (e as { jobId?: string }).jobId ?? (e as { featureId?: string }).featureId ?? ''}`));
  }
  t.quests.refresh();
  const q = t.quests;
  const talk = (npcId = JOB_INSTRUCTOR_NPC_ID) => t.events.emit('npcInteracted', { npcId });
  const visit = (locationId = JOB_TRIAL_MARKER_ID) => t.events.emit('locationReached', { locationId });
  const kill = (monsterId = 'slime') => t.events.emit('monsterKilled', { entityId: `${monsterId}-1`, monsterId, zone: 'field' });
  /** The whole trial through real quest events. */
  const completeTrial = () => {
    q.start('job_c1_01_instructor');
    talk();
    q.claim('job_c1_01_instructor');
    q.start('job_c1_02_trial');
    visit();
    for (let i = 0; i < 3; i++) kill();
    q.claim('job_c1_02_trial');
    q.start('job_c1_03_report');
    talk();
    return q.claim('job_c1_03_report');
  };
  const count = (entry: string) => log.filter((x) => x === entry).length;
  return { t, q, log, talk, visit, kill, completeTrial, count, jc: t.jobChange };
}

describe('job definitions (one class system)', () => {
  test('five Class 1 choices with tier, Lv11 minimum, Lv40 limit, weapons and a skill tree hook', () => {
    assert.deepEqual([...CLASS_1_CHOICES], ['warrior', 'archer', 'mage', 'cleric', 'ninja']);
    for (const id of CLASS_1_CHOICES) {
      const def = jobDefinition(id);
      assert.equal(def.tier, 1);
      assert.equal(def.minimumLevel, 11);
      assert.equal(def.levelLimit, 40);
      assert.deepEqual(def.jobBonus, BONUSES[id as keyof typeof BONUSES]);
      assert.ok(def.weapons.length > 0, `${id} weapons`);
      assert.equal(def.skillTreeId, `${id}_c1`);
    }
    assert.equal(jobDefinition('novice').levelLimit, null);
  });

  test('presentation: Warrior is real; the others are an explicit temporary fallback', () => {
    assert.equal(jobDefinition('warrior').presentation.temporaryFallback, false);
    for (const id of ['novice', 'archer', 'mage', 'cleric', 'ninja'] as const) assert.equal(jobDefinition(id).presentation.temporaryFallback, true, id);
  });
});

describe('Job Quest availability', () => {
  test('Lv10 Novice: locked; Lv11 Novice: available', () => {
    assert.equal(rig(10).q.status(CLASS_1_JOB_CHANGE.firstQuestId), 'locked');
    assert.equal(rig(11).q.status(CLASS_1_JOB_CHANGE.firstQuestId), 'available');
  });

  test('re-evaluates on level-up and announces the Job Quest exactly once', () => {
    const r = rig(10);
    r.t.progression.grantExp(r.t.player, expToNext(10) + expToNext(11)); // → Lv12
    assert.equal(r.q.status(CLASS_1_JOB_CHANGE.firstQuestId), 'available');
    assert.equal(r.count('jobQuestAvailable:job_c1_01_instructor'), 1);
    r.q.refresh();
    assert.equal(r.count('jobQuestAvailable:job_c1_01_instructor'), 1);
  });

  test('a non-Novice never gets the Job Quest', () => {
    const r = rig(11);
    r.jc.select('warrior', { skipTrial: true });
    assert.equal(r.q.status(CLASS_1_JOB_CHANGE.firstQuestId), 'locked');
  });

  test('job quests grant no Skill Points (and no other rewards)', () => {
    for (const def of Object.values(JOB_QUESTS)) {
      assert.equal(def.type, 'job');
      assert.deepEqual(def.rewards, {}, def.id);
    }
  });
});

describe('Job Trial', () => {
  test('selection is refused before the trial is complete', () => {
    const r = rig();
    assert.deepEqual(r.jc.select('warrior'), { ok: false, reason: 'trial_incomplete' });
    assert.equal(r.jc.stage(), 'novice');
  });

  test('steps progress through the Quest Engine in order; wrong targets do nothing', () => {
    const r = rig();
    r.q.start('job_c1_01_instructor');
    r.talk('someone_else');
    assert.equal(r.q.status('job_c1_01_instructor'), 'active');
    r.talk();
    r.q.claim('job_c1_01_instructor');
    assert.equal(r.q.status('job_c1_03_report'), 'locked', 'the report step only opens after the trial');

    r.q.start('job_c1_02_trial');
    r.visit('somewhere_else');
    r.kill('wolf');
    assert.deepEqual(r.q.progress('job_c1_02_trial').map((p) => p.current), [0, 0]);
    r.visit();
    r.kill();
    r.kill();
    assert.equal(r.q.status('job_c1_02_trial'), 'active');
    r.kill();
    assert.equal(r.q.status('job_c1_02_trial'), 'completed');
    r.q.claim('job_c1_02_trial');

    r.q.start('job_c1_03_report');
    r.talk();
    assert.equal(r.q.status('job_c1_03_report'), 'completed');
    assert.equal(r.jc.stage(), 'novice', 'not until the report is claimed');
    r.q.claim('job_c1_03_report');
    assert.equal(r.jc.stage(), 'selection_available');
  });

  test('trial completion exposes job selection exactly once', () => {
    const r = rig();
    assert.equal(r.completeTrial().ok, true);
    assert.equal(r.count('jobTrialCompleted:job_c1_03_report'), 1);
    assert.equal(r.count('jobSelectionAvailable:'), 1);
    assert.deepEqual(r.q.claim('job_c1_03_report'), { ok: false, reason: 'already_claimed' });
    r.q.refresh();
    assert.equal(r.count('jobSelectionAvailable:'), 1);
  });
});

describe('job selection', () => {
  for (const job of CLASS_1_CHOICES) {
    test(`${job}: selected through the real path, Job Bonus as job stats, allocated untouched`, () => {
      const r = rig(15);
      allocateStat(r.t, 'str', 2);
      allocateStat(r.t, 'luk', 1);
      const allocated = { ...r.t.progress.allocated };
      r.completeTrial();
      const result = r.jc.select(job);
      assert.deepEqual(result, { ok: true, jobId: job });
      assert.equal(r.t.progress.classId, job);
      assert.deepEqual(r.t.progress.jobBonuses, { [job]: BONUSES[job as keyof typeof BONUSES] });
      assert.deepEqual(r.t.progress.allocated, allocated);
      assert.equal(r.jc.stage(), 'class_1');
      assert.equal(r.count(`jobChanged:${job}`), 1);
    });
  }

  test('invalid jobs are rejected', () => {
    const r = rig();
    r.completeTrial();
    assert.deepEqual(r.jc.select('paladin'), { ok: false, reason: 'unknown_job' });
    assert.deepEqual(r.jc.select('novice'), { ok: false, reason: 'not_a_class_1_job' });
  });

  test('a second selection (same or other job) is refused and changes nothing', () => {
    const r = rig();
    r.completeTrial();
    r.jc.select('mage');
    const after = JSON.stringify([r.t.progress.toData(), r.t.combat.stats, [...r.t.features.unlocked]]);
    assert.deepEqual(r.jc.select('mage'), { ok: false, reason: 'already_changed' });
    assert.deepEqual(r.jc.select('warrior'), { ok: false, reason: 'already_changed' });
    assert.equal(JSON.stringify([r.t.progress.toData(), r.t.combat.stats, [...r.t.features.unlocked]]), after);
    assert.equal(r.count('jobChanged:mage'), 1);
    assert.equal(r.count('jobChanged:warrior'), 0);
  });

  test('a Novice past Lv40 cannot take a Class 1 job (no extrapolated growth)', () => {
    const r = rig(41);
    r.completeTrial();
    assert.deepEqual(r.jc.select('warrior'), { ok: false, reason: 'level_too_high' });
  });

  test('stats recalculate immediately and HP/MP resolve to the new maximum', () => {
    const r = rig(11);
    r.completeTrial();
    r.t.combat.hp = 10;
    const before = r.t.combat.stats.maxHp;
    r.jc.select('warrior');
    const expected = playerCombatStats(r.t.progress, 11, r.t.stack.list(), []);
    assert.equal(r.t.combat.stats.maxHp, expected.maxHp);
    assert.ok(r.t.combat.stats.maxHp > before);
    assert.equal(r.t.combat.hp, r.t.combat.stats.maxHp);
    assert.equal(r.t.combat.mp, r.t.combat.stats.maxMp);
  });
});

describe('Class 1 base growth', () => {
  test('exact Lv11 / Lv20 / Lv30 / Lv40 anchors for every job; an interpolated level in between', () => {
    for (const job of CLASS_1_CHOICES) {
      const a = ANCHORS[job as keyof typeof ANCHORS];
      for (const lv of [11, 20, 30, 40] as const) assert.deepEqual(asArray(classBaseStats(job, lv)), a[lv], `${job} Lv${lv}`);
      // Lv15: 4/9 of the way from Lv11 to Lv20, rounded.
      assert.deepEqual(asArray(classBaseStats(job, 15)), a[11].map((v, i) => Math.round(v + ((a[20][i] - v) * 4) / 9)), `${job} Lv15`);
    }
  });

  test('Class 1 stops at Lv40 (never extrapolated)', () => {
    for (const job of CLASS_1_CHOICES) {
      assert.equal(classGrowthMaxLevel(job), 40);
      assert.throws(() => classBaseStats(job, 41), ClassGrowthRangeError);
      assert.equal(CLASS_GROWTH[job].afterLastAnchor, 'error');
    }
  });

  test('after selection the character uses its job growth', () => {
    const r = rig(20);
    r.completeTrial();
    r.jc.select('cleric');
    const expected = playerCombatStats(r.t.progress, 20, r.t.stack.list(), []);
    assert.equal(r.t.combat.stats.maxHp, expected.maxHp);
    assert.equal(r.t.combat.stats.maxMp, expected.maxMp);
  });
});

describe('Class 1 Skill Points (derived from job + level)', () => {
  test('Lv10 Novice 0; Lv11 Class 1 = 1; Lv20 = 10; Lv40 = 30', () => {
    const r = rig(10);
    assert.equal(r.t.progress.earnedSkillPoints(10), 0);
    const s = rig(11);
    s.completeTrial();
    s.jc.select('warrior');
    assert.equal(s.t.progress.earnedSkillPoints(11), 1);
    s.t.progression.grantExp(s.t.player, cumulativeExp(20) - cumulativeExp(11));
    assert.equal(s.t.combat.level, 20);
    assert.equal(s.t.progress.remainingSkillPoints(20), 10);
    s.t.progression.grantExp(s.t.player, cumulativeExp(40) - cumulativeExp(20) + 99_999_999);
    assert.equal(s.t.combat.level, 40, 'Class 1 limit');
    assert.equal(s.t.progress.remainingSkillPoints(40), 30);
  });

  test('a delayed change at Lv15 keeps all 5 eligible points; repeating selection adds none', () => {
    const r = rig(15);
    assert.equal(r.t.progress.earnedSkillPoints(15), 0, 'Novice earns none');
    r.completeTrial();
    r.jc.select('ninja');
    assert.equal(r.t.progress.remainingSkillPoints(15), 5);
    r.jc.select('ninja');
    r.jc.select('archer');
    assert.equal(r.t.progress.remainingSkillPoints(15), 5);
  });

  test('Skill Points after reload are the same (nothing granted on load)', () => {
    const r = rig(18);
    r.completeTrial();
    r.jc.select('warrior');
    r.t.progress.skillPointsSpent = 3;
    const loaded = rig(1);
    applyPlayerSave(loaded.t, deserializePlayerSave(serializePlayerSave(capturePlayerSave(r.t))));
    assert.equal(loaded.t.progress.remainingSkillPoints(18), 5);
  });
});

describe('quests, features and replay', () => {
  test('job change re-evaluates class prerequisites and unlocks class_1_skills', () => {
    const warriorOnly: QuestDef = { id: 'warrior_only', title: 'W', description: '', type: 'job', objectives: [{ kind: 'talk', npcId: 'x' }], rewards: {}, prerequisites: { requiredClass: ['warrior'] } };
    const r = rig(11, { ...QUESTS, warrior_only: warriorOnly });
    assert.equal(r.q.status('warrior_only'), 'locked');
    r.completeTrial();
    r.jc.select('warrior');
    assert.equal(r.q.status('warrior_only'), 'available');
    assert.equal(r.count('questAvailable:warrior_only'), 1);
    assert.equal(r.t.features.isFeatureUnlocked('class_1_skills'), true);
    assert.equal(r.count('featureUnlocked:class_1_skills'), 1);
  });

  test('the Job Quest cannot be replayed to change job again', () => {
    const r = rig();
    r.completeTrial();
    r.jc.select('archer');
    for (const id of Object.keys(JOB_QUESTS)) {
      assert.deepEqual(r.q.start(id), { ok: false, reason: 'already_started' });
      assert.deepEqual(r.q.claim(id), { ok: false, reason: 'already_claimed' });
    }
    assert.deepEqual(r.jc.select('mage'), { ok: false, reason: 'already_changed' });
  });

  test('every trial step is navigable with the quest resolver', () => {
    const r = rig();
    const nav = new NavIndex(NAVIGATION);
    const to = (questId: string, i: number) => {
      const res = resolveQuestObjective(r.q, questId, i, nav);
      return res.ok ? res.target.id : res.reason;
    };
    r.q.start('job_c1_01_instructor');
    assert.equal(to('job_c1_01_instructor', 0), 'nav_demo_job_instructor');
    r.talk();
    r.q.claim('job_c1_01_instructor');
    r.q.start('job_c1_02_trial');
    assert.equal(to('job_c1_02_trial', 0), 'nav_demo_job_trial_marker');
    assert.equal(to('job_c1_02_trial', 1), 'nav_demo_job_trial_zone', 'the trial zone, not the general slime area');
    r.visit();
    for (let i = 0; i < 3; i++) r.kill();
    r.q.claim('job_c1_02_trial');
    r.q.start('job_c1_03_report');
    assert.equal(to('job_c1_03_report', 0), 'nav_demo_job_instructor', 'return to the instructor');
  });

  test('other quests still use the general slime area (trial zone is dedicated)', () => {
    const r = rig(1);
    r.q.start('q_demo_01');
    r.talk('demo_npc_guide');
    r.q.claim('q_demo_01');
    r.q.start('q_demo_02');
    const res = resolveQuestObjective(r.q, 'q_demo_02', 0, new NavIndex(NAVIGATION));
    assert.equal(res.ok && res.target.id, 'nav_demo_slime_zone');
  });
});

describe('save / load', () => {
  const reload = (r: ReturnType<typeof rig>) => {
    const loaded = rig(1);
    applyPlayerSave(loaded.t, deserializePlayerSave(serializePlayerSave(capturePlayerSave(r.t))));
    return loaded;
  };

  test('a Novice mid-trial stays a Novice with its trial progress', () => {
    const r = rig();
    r.q.start('job_c1_01_instructor');
    r.talk();
    r.q.claim('job_c1_01_instructor');
    r.q.start('job_c1_02_trial');
    r.visit();
    const l = reload(r);
    assert.equal(l.t.progress.classId, 'novice');
    assert.equal(l.jc.stage(), 'novice');
    assert.deepEqual(l.q.progress('job_c1_02_trial').map((p) => p.current), [1, 0]);
  });

  test('trial complete, selection pending: persists, and selection still works after load', () => {
    const r = rig();
    r.completeTrial();
    const l = reload(r);
    assert.equal(l.jc.stage(), 'selection_available');
    assert.equal(l.count('jobSelectionAvailable:'), 0, 'loading does not re-announce');
    assert.deepEqual(l.jc.select('warrior'), { ok: true, jobId: 'warrior' });
  });

  for (const job of ['warrior', 'mage'] as const) {
    test(`a selected ${job} persists with one Job Bonus, its feature and Skill Points`, () => {
      const r = rig(14);
      r.completeTrial();
      r.jc.select(job);
      const l = reload(r);
      assert.equal(l.t.progress.classId, job);
      assert.equal(l.jc.stage(), 'class_1');
      assert.deepEqual(l.t.progress.jobBonuses, { [job]: BONUSES[job] });
      assert.equal(l.t.features.isFeatureUnlocked('class_1_skills'), true);
      assert.equal(l.t.progress.remainingSkillPoints(14), 4);
      assert.deepEqual(l.t.combat.stats, r.t.combat.stats);
      assert.deepEqual(l.jc.select('archer'), { ok: false, reason: 'already_changed' });
    });
  }

  test('an older v4 save loads safely: a Novice stays Novice; a job taken before the trial existed is kept', () => {
    const novice = capturePlayerSave(makeSaveTarget(12));
    const { questLog: _q, features: _f, ...olderNovice } = novice;
    void [_q, _f];
    const n = rig(1);
    applyPlayerSave(n.t, deserializePlayerSave(JSON.stringify(olderNovice)));
    assert.equal(n.t.progress.classId, 'novice');
    assert.equal(n.jc.stage(), 'novice');

    // Earlier builds could take a job directly (no trial). That class is kept as-is; no Class 1 feature is invented.
    const legacy = rig(15);
    legacy.jc.select('warrior', { skipTrial: true });
    legacy.t.features.unlocked.clear();
    const save = capturePlayerSave(legacy.t);
    const { questLog: _q2, features: _f2, ...olderWarrior } = save;
    void [_q2, _f2];
    const w = rig(1);
    applyPlayerSave(w.t, deserializePlayerSave(JSON.stringify(olderWarrior)));
    assert.equal(w.t.progress.classId, 'warrior');
    assert.equal(w.jc.stage(), 'class_1');
    assert.deepEqual(w.t.progress.jobBonuses, { warrior: BONUSES.warrior });
    assert.deepEqual(w.jc.select('archer'), { ok: false, reason: 'already_changed' });
  });
});

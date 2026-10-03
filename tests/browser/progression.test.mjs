// Player stat / job / reset-item integration in the running game.
import { sleep } from './cdp.mjs';

export async function progressionSuite(b, t) {
  t.section('Player stats and progression');
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  await sleep(150);

  let p = await b.eval('debug.progress()');
  let combat = await b.eval('debug.player().stats');
  t.check('S1. Lv1 Novice: 5 in every stat, no free points', p.classId === 'novice' && Object.values(p.final).every((v) => v === 5) && p.remainingStatPoints === 0, JSON.stringify(p.final));
  t.check('S2. fresh character keeps the current combat numbers', combat.maxHp === 120 && combat.attack === 12 && combat.defense === 4, JSON.stringify(combat));
  const lv1 = await b.eval(`debug.allocateStat('str', 1)`);
  t.check('S3. allocating with no points is rejected', lv1.ok === false && lv1.reason === 'not_enough_points', JSON.stringify(lv1));

  await b.eval('debug.setLevel(11)');
  p = await b.eval('debug.progress()');
  const before = await b.eval('debug.player().stats');
  t.check('S4. Lv11 has earned 10 free points', p.earnedStatPoints === 10 && p.remainingStatPoints === 10, JSON.stringify(p));
  await b.eval(`debug.allocateStat('vit', 2)`);
  let after = await b.eval('debug.player().stats');
  t.check('S5. allocated VIT raises live Max HP / DEF by the locked rates', after.maxHp === before.maxHp + 50 && after.defense === before.defense + 2, `hp ${before.maxHp}->${after.maxHp} def ${before.defense}->${after.defense}`);

  const job = await b.eval(`debug.changeJob('warrior')`);
  p = await b.eval('debug.progress()');
  after = await b.eval('debug.player().stats');
  t.check(
    'S6. Warrior job bonus applies automatically, separate from allocated, no points used',
    job.ok && p.classId === 'warrior' && p.jobBonuses.warrior.str === 3 && p.allocated.str === 0 && p.final.str === 8 && p.remainingStatPoints === 8 && after.attack === before.attack + 6,
    JSON.stringify({ job, jobBonuses: p.jobBonuses, allocated: p.allocated, remaining: p.remainingStatPoints, attack: after.attack }),
  );

  await b.eval(`debug.grantItem('stat_reset_test')`);
  const used = await b.eval(`debug.useItem('stat_reset_test')`);
  p = await b.eval('debug.progress()');
  const inv = await b.eval(`debug.player().inventory`);
  t.check(
    'S7. Stat Reset item returns exactly the allocated points and keeps job/level',
    used.ok && used.refundedStatPoints === 2 && p.remainingStatPoints === 10 && p.classId === 'warrior' && p.jobBonuses.warrior.vit === 2 && p.level === 11 && !inv.stat_reset_test,
    JSON.stringify({ used, remaining: p.remainingStatPoints, classId: p.classId, inv }),
  );

  // Save round trip in the live game: build a mid-game state, save, wipe, load.
  await b.eval(`(() => { debug.setLevel(15); debug.allocateStat('str', 4); debug.allocateStat('luk', 3); debug.grantItem('slime_gel', 5); })()`);
  const saved = await b.eval(`({ text: debug.save(), progress: debug.progress(), stats: debug.player().stats, inv: debug.player().inventory })`);
  await b.eval('debug.reset()');
  const wiped = await b.eval('debug.progress()');
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved.text)})`);
  const restored = await b.eval(`({ progress: debug.progress(), stats: debug.player().stats, inv: debug.player().inventory })`);
  t.check(
    'S9. save -> reset -> load restores job, level, allocated, job bonus, inventory and stats',
    wiped.classId === 'novice' &&
      loaded.ok &&
      JSON.stringify(restored.progress) === JSON.stringify(saved.progress) &&
      JSON.stringify(restored.stats) === JSON.stringify(saved.stats) &&
      JSON.stringify(restored.inv) === JSON.stringify(saved.inv),
    JSON.stringify({ loaded, classId: restored.progress.classId, level: restored.progress.level, allocated: restored.progress.allocated, inv: restored.inv }),
  );
  const tampered = JSON.parse(saved.text);
  tampered.stats.allocated.str = 99;
  const rejected = await b.eval(`debug.load(${JSON.stringify(JSON.stringify(tampered))})`);
  const unchanged = await b.eval('debug.progress()');
  t.check('S10. an invalid save is rejected and live state is untouched', !rejected.ok && JSON.stringify(unchanged) === JSON.stringify(restored.progress), JSON.stringify(rejected));

  await b.eval('debug.reset()');
  p = await b.eval('debug.progress()');
  combat = await b.eval('debug.player().stats');
  t.check('S8. world reset returns to a clean Lv1 Novice', p.classId === 'novice' && p.level === 1 && p.spentStatPoints === 0 && Object.keys(p.jobBonuses).length === 0 && combat.maxHp === 120, JSON.stringify({ classId: p.classId, level: p.level }));
  await sleep(100);
}

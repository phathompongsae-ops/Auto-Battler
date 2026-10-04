// Player stat / job / reset-item integration in the running game.
import { sleep } from './cdp.mjs';

export async function progressionSuite(b, t) {
  t.section('Player stats and progression');
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  await sleep(150);

  let p = await b.eval('debug.progress()');
  let combat = await b.eval('debug.player().stats');
  t.check('S1. Lv1 Novice: 5 in every stat, no free points', p.classId === 'novice' && Object.values(p.final).every((v) => v === 5) && p.remainingStatPoints === 0, JSON.stringify(p.final));
  t.check('S2. fresh Novice: class base + its six starting 5s', combat.maxHp === 425 && combat.maxMp === 175 && combat.attack === 35 && combat.magicAttack === 30 && combat.defense === 13 && combat.magicDefense === 13, JSON.stringify(combat));
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
    job.ok && p.classId === 'warrior' && p.jobBonuses.warrior.str === 3 && p.allocated.str === 0 && p.final.str === 8 && p.remainingStatPoints === 8 && after.attack === 70 + (5 + 3) * 2 && after.maxHp === 700 + (5 + 2 + 2) * 25,
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

  // Server level cap: day 1 caps at Lv40; EXP past it waits as Overflow until the cap rises.
  await b.eval('debug.reset(); debug.setServerDay(1); debug.setLevel(39)');
  const capped = await b.eval('(debug.grantExp(10000000), debug.levelInfo())');
  t.check('S11. day 1: levels stop at the Lv40 cap with one level of Overflow', capped.level === 40 && capped.levelCap === 40 && capped.overflowExp === capped.expToNext, JSON.stringify(capped));
  await b.eval('debug.setServerDay(2)');
  const raised = await b.waitFor('debug.levelInfo().level === 41 && debug.levelInfo()', { label: 'Overflow applied after cap rise' });
  t.check('S12. when the cap rises the stored Overflow is applied (one level)', raised.level === 41 && raised.levelCap === 45 && raised.exp === 0, JSON.stringify(raised));

  // Safe level jumps (dev): clamped to the effective cap, stats refreshed.
  await b.eval('debug.reset(); debug.setServerDay(21)');
  const to20 = await b.eval('debug.jumpToLevel(20)');
  const at20 = await b.eval('debug.progress()');
  await b.eval('debug.setServerDay(1)');
  const to45 = await b.eval('debug.jumpToLevel(45)');
  const to40 = await b.eval('debug.jumpToLevel(40)');
  t.check(
    'S13. jumpToLevel reaches Lv20 and Lv40 and never passes the server cap',
    to20.ok && to20.level === 20 && at20.remainingStatPoints === 19 && to45.ok && to45.level === 40 && to40.level === 40,
    JSON.stringify({ to20, to45, to40 }),
  );
  await b.eval('debug.clearServerDayOverride()');

  await b.eval('debug.reset()');
  p = await b.eval('debug.progress()');
  combat = await b.eval('debug.player().stats');
  t.check('S8. world reset returns to a clean Lv1 Novice', p.classId === 'novice' && p.level === 1 && p.spentStatPoints === 0 && Object.keys(p.jobBonuses).length === 0 && combat.maxHp === 425, JSON.stringify({ classId: p.classId, level: p.level }));
  await sleep(100);
}

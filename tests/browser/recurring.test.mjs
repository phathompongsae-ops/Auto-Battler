// Daily Commissions / Weekly quests through the real game: real enhancement, the temporary window, day change, milestones, save/load.
import { sleep } from './cdp.mjs';

export async function recurringSuite(b, t) {
  t.section('Daily / Weekly quests in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.forceUnlockAllFeatures()');
  await sleep(100);
  const state = () => b.eval('debug.recurringState()');
  const win = (sel) => `document.querySelector('[data-window="commissions"] ${sel}')`;
  const goToDay = async (day) => {
    await b.eval(`debug.setServerDay(${day})`);
    await b.waitFor(`debug.recurringState().state.daily.cycleId === ${day}`, { label: `day ${day} assigned` });
  };

  // A day (not the last of its week) whose Daily set includes Enhancement Practice.
  const day = await b.eval(`(() => {
    for (let d = 2; d < 400; d++) if ((d - 1) % 7 < 6 && debug.previewDailySet(d).includes('daily_enhancement_practice')) return d;
  })()`);
  await b.eval('debug.forceUnlockRecurring()');
  await goToDay(day);
  let s = await state();
  t.check(
    'R-1. once unlocked, the day has exactly 3 active Daily Commissions and 7 active Weekly quests',
    s.daily.length === 3 && new Set(s.daily.map((q) => q.questId)).size === 3 && s.daily.every((q) => q.status === 'active') &&
      s.weekly.length === 7 && s.weekly.every((q) => q.status === 'active'),
    JSON.stringify({ day, daily: s.daily.map((q) => q.questId) }),
  );

  // Complete it with a real enhancement, then claim it in the window.
  await b.eval(`(() => {
    const id = debug.grantEquipment('knight_sword');
    debug.grantItem('enhancement_stone', 5);
    debug.grantGold(10000);
    debug.enhance(id, { roll: 0 });
  })()`);
  const before = await b.eval(`({ gold: debug.equipment().gold, stones: debug.player().inventory.enhancement_stone ?? 0 })`);
  await b.press('KeyY');
  await sleep(80);
  const ready = await b.eval(`${win('[data-claim="daily_enhancement_practice"]')}?.disabled === false`);
  await b.eval(`${win('[data-claim="daily_enhancement_practice"]')}.click()`);
  const after = await b.eval(`({ gold: debug.equipment().gold, stones: debug.player().inventory.enhancement_stone ?? 0 })`);
  s = await state();
  const adventurer = s.weekly.find((q) => q.questId === 'weekly_adventurer');
  t.check(
    'R-2. a real enhancement completes the Daily; claiming it in the window pays out and Weekly Adventurer reads 1/15',
    ready && s.daily.find((q) => q.questId === 'daily_enhancement_practice').status === 'claimed' &&
      after.gold === before.gold + 100 && after.stones === before.stones + 2 && s.dailyClaimsThisWeek === 1 && adventurer.progress[0] === 1,
    JSON.stringify({ ready, before, after, claims: s.dailyClaimsThisWeek, adventurer }),
  );
  await b.press('Escape');

  // Next server day: a fresh Daily set; Weekly progress stays.
  await goToDay(day + 1);
  s = await state();
  t.check(
    'R-3. a new server day resets the Daily set but keeps Weekly progress',
    s.state.daily.cycleId === day + 1 && s.daily.every((q) => q.status === 'active' && q.progress.every((p) => p === 0)) &&
      s.dailyClaimsThisWeek === 1 && s.weekly.find((q) => q.questId === 'weekly_adventurer').progress[0] === 1,
    JSON.stringify({ daily: s.daily, claims: s.dailyClaimsThisWeek }),
  );

  // 3 Weekly quests (test setup through their real events), then the 3/7 milestone in the window.
  for (const id of ['weekly_dungeon_hunter', 'weekly_helping_hand', 'weekly_gear_master']) {
    await b.eval(`debug.forceCompleteQuest('${id}'); debug.claimQuest('${id}')`);
  }
  await b.press('KeyY');
  await sleep(80);
  await b.eval(`[...document.querySelectorAll('[data-window="commissions"] [role="tab"]')].find((e) => e.textContent === 'Weekly').click()`);
  await sleep(50);
  const progressText = await b.eval(`${win('[data-role="weekly-progress"]')}.textContent`);
  const boxes = async () => (await b.eval('debug.player().inventory')).material_box ?? 0;
  const box0 = await boxes();
  await b.eval(`${win('[data-milestone="3"]')}.click()`);
  const box1 = await boxes();
  const dup = await b.eval('debug.claimWeeklyMilestone(3)');
  const fiveLocked = await b.eval(`${win('[data-milestone="5"]')}.disabled`);
  await b.press('Escape');
  t.check(
    'R-4. 3/7 Weekly quests: the milestone is claimed once in the window; a repeat is refused; 5/7 stays locked',
    progressText.includes('3/7') && box1 === box0 + 1 && !dup.ok && dup.reason === 'already_claimed' && fiveLocked,
    JSON.stringify({ progressText, box0, box1, dup, fiveLocked }),
  );

  // Save -> reset -> load on the same server day: nothing rerolled or reset.
  const snapshot = await state();
  const saved = await b.eval('debug.save()');
  await b.eval('debug.reset()');
  await b.eval(`debug.setServerDay(${day + 1})`);
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  await sleep(50);
  const restored = await state();
  t.check(
    'R-5. save/load keeps the Daily set, Weekly progress, the Daily count and milestones',
    loaded.ok && JSON.stringify(restored.daily) === JSON.stringify(snapshot.daily) && JSON.stringify(restored.weekly) === JSON.stringify(snapshot.weekly) &&
      restored.dailyClaimsThisWeek === 1 && JSON.stringify(restored.milestones) === JSON.stringify(snapshot.milestones),
    JSON.stringify({ loaded, milestones: restored.milestones }),
  );

  await b.eval('debug.reset()');
}

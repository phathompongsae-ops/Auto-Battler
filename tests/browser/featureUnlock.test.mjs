// Feature Unlock + menu gating through the real game: level-ups, Job Change, menus, gated actions, save/load.
import { sleep } from './cdp.mjs';

export async function featureUnlockSuite(b, t) {
  t.section('Feature unlocks and menu gating in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.clearLog()');
  await sleep(100);
  const unlocked = async () => (await b.eval('debug.features()')).filter((f) => f.unlocked).map((f) => f.id);
  /** Reach a level through real EXP (real level-ups re-evaluate features). */
  const levelTo = (n) =>
    b.eval(`(() => { const i = debug.levelInfo(); let need = -i.exp; for (let l = i.level; l < ${n}; l++) need += debug.expToNext(l); debug.grantExp(need); })()`);
  const newUnlocks = () => b.eval(`debug.log.filter((e) => e.type === 'featureUnlocked' && e.status === 'new').map((e) => e.item)`);

  // 1. New game: only Equipment; locked systems are visible but disabled.
  await b.eval(`document.querySelector('[data-menu="menu"]').click()`);
  await sleep(80);
  const menu = await b.eval(`({
    inventory: !!document.querySelector('[data-window="menu"] [data-screen="inventory"]:not([disabled])'),
    enhancement: document.querySelector('[data-locked-screen="enhancement"]')?.textContent,
    daily: document.querySelector('[data-locked-screen="commissions"]')?.textContent,
    pet: document.querySelector('[data-locked-screen="pet"]')?.textContent,
    lockedCount: document.querySelectorAll('[data-window="menu"] [data-locked-screen]').length,
  })`);
  await b.press('Escape');
  await b.press('KeyK'); // Skills hotkey while locked
  await sleep(80);
  const skillsOpened = await b.eval(`!!document.querySelector('[data-window="skills"]')`);
  const skillsButton = await b.eval(`({ disabled: document.querySelector('[data-menu="skills"]').disabled, title: document.querySelector('[data-menu="skills"]').title })`);
  t.check(
    'F-1. a new character has only Equipment; locked menus show their requirement and cannot be opened',
    JSON.stringify(await unlocked()) === '["equipment"]' && menu.inventory && menu.enhancement.includes('Unlocks at Lv15') &&
      menu.daily.includes('Unlocks at Lv16') && menu.pet.includes('Unlocks at Lv20') && menu.lockedCount === 9 &&
      !skillsOpened && skillsButton.disabled && skillsButton.title.includes('Change Job to unlock'),
    JSON.stringify({ menu, skillsOpened, skillsButton }),
  );

  // 2. Lv5: Warp, and a Town Warp Scroll works through the real path.
  await b.eval(`debug.grantItem('town_warp_scroll', 2)`);
  const beforeWarp = await b.eval(`debug.useWarpScroll('town')`);
  await levelTo(5);
  const warp = await b.eval(`debug.useWarpScroll('town')`);
  const map = (await b.eval('debug.navState()')).mapId;
  t.check(
    'F-2. Lv5 unlocks Warp; a Town Warp Scroll is refused before and works after',
    beforeWarp.reason === 'feature_locked' && warp.ok && map === 'demo_town' && JSON.stringify(await newUnlocks()) === '["warp"]',
    JSON.stringify({ beforeWarp: beforeWarp.reason, warp: warp.ok, map }),
  );

  // 3. Lv11: Job Change, not Class Skills.
  await levelTo(11);
  let ids = await unlocked();
  t.check('F-3. Lv11 unlocks Job Change but not Class 1 Skills', ids.includes('job_change') && !ids.includes('class_1_skills'), JSON.stringify(ids));

  // 4. The real Job Change unlocks Class 1 Skills (and the Skills menu).
  await b.eval(`debug.forceCompleteJobTrial(); debug.chooseJob('warrior')`);
  await sleep(50);
  ids = await unlocked();
  const skillsEnabled = await b.eval(`!document.querySelector('[data-menu="skills"]').disabled`);
  t.check('F-4. completing the Job Change unlocks Class 1 Skills and the Skills menu', ids.includes('class_1_skills') && skillsEnabled, JSON.stringify({ ids, skillsEnabled }));

  // 5. Lv15: Enhancement, used through its screen.
  const itemId = await b.eval(`(() => { const id = debug.grantEquipment('knight_sword'); debug.grantItem('enhancement_stone', 5); debug.grantGold(10000); return id; })()`);
  const early = await b.eval(`debug.enhance('${itemId}', { roll: 0 })`);
  await levelTo(15);
  await b.eval(`document.querySelector('[data-menu="menu"]').click()`);
  await sleep(50);
  await b.eval(`document.querySelector('[data-window="menu"] [data-screen="enhancement"]').click()`);
  await sleep(50);
  await b.eval(`debug.setRng(0)`);
  await b.eval(`document.querySelector('[data-window="enhancement"] [data-enhance="${itemId}"]').click()`);
  await b.eval(`debug.setRng(null)`);
  const enhanced = (await b.eval('debug.equipment()')).items.find((i) => i.instanceId === itemId).enhancement;
  await b.press('Escape');
  t.check('F-5. Lv15 unlocks Enhancement: refused before, works from its screen after', early.reason === 'feature_locked' && enhanced === 1, JSON.stringify({ early: early.reason, enhanced }));

  // 6. Lv16: Daily Commissions appear.
  await levelTo(16);
  const daily = (await b.eval('debug.recurringState()')).daily;
  t.check('F-6. Lv16 unlocks Daily Commission and today\'s 3 Dailies become active', daily.length === 3 && daily.every((q) => q.status === 'active'), JSON.stringify(daily));

  // 7-8. Lv18 Enchant; Lv20 Pet / Dungeon / Crafting / Weekly.
  await levelTo(18);
  const at18 = await unlocked();
  const dungeonEarly = await b.eval(`debug.enterDungeon('demo_dungeon', 'normal')`);
  await levelTo(20);
  const at20 = await unlocked();
  const dungeon = await b.eval(`debug.enterDungeon('demo_dungeon', 'normal')`);
  await b.eval('debug.leaveDungeon()');
  t.check(
    'F-7. Lv18 unlocks Enchant; Lv20 unlocks Pet, Dungeon, Crafting and Weekly (Dungeon refused before)',
    at18.includes('enchant') && !at18.includes('pet') && dungeonEarly.reason === 'feature_locked' &&
      ['pet', 'dungeon', 'crafting', 'weekly_quests'].every((id) => at20.includes(id)) && dungeon.ok,
    JSON.stringify({ at18, at20, dungeonEarly: dungeonEarly.reason, dungeon: dungeon.ok }),
  );
  const announced = await newUnlocks();
  t.check(
    'F-8. each feature was announced exactly once along the way',
    JSON.stringify(announced) === JSON.stringify(['warp', 'job_change', 'class_1_skills', 'enhancement', 'daily_commission', 'enchant', 'pet', 'dungeon', 'crafting', 'weekly_quests']),
    JSON.stringify(announced),
  );

  // 9. Save -> reset -> load: unlocks persist, nothing is announced again.
  const saved = await b.eval('debug.save()');
  const before = await unlocked();
  await b.eval('debug.reset(); debug.clearLog()');
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  const after = await unlocked();
  t.check(
    'F-9. save/load keeps every unlock without new announcements',
    loaded.ok && JSON.stringify(after) === JSON.stringify(before) && (await newUnlocks()).length === 0,
    JSON.stringify({ loaded, after }),
  );

  await b.eval('debug.reset()');
}

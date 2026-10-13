// Demo release P1 polish (docs/qa/demo-candidate-qa.md): quest Go reaches its target from the positions where it used
// to fail (Town Captain → Smith, Field → Elite Ruins, Crypt Section II → Crypt Lord), walked by the real player body;
// a navigation failure always tells the player; free stat points can be spent in the Character window (one point per
// tap, locked at zero, derived stats follow, survives a save → load); the Story victory reads as a victory.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;

export async function releasePolishSuite(b, t, shot) {
  t.section('Demo release P1 polish');

  // 1. Quest Go from the QA positions, walked for real (collision, gates, the player's own body box).
  const goFrom = async (map, x, y, questId, setup = '') => {
    await b.eval(`debug.reset('${map}'); debug.setPeaceful(true); ${setup} debug.teleport(${x}, ${y}); debug.clearLog(); true`);
    await sleep(250);
    const clicked = await b.eval(`(() => { const e = document.querySelector('[data-hud=quest-tracker] [data-quest=${questId}] [data-action=quest-go]'); if (!e) return false; e.click(); return true; })()`);
    await b.waitFor(`debug.navState().status !== 'moving' && debug.navState().status !== 'waiting_for_transition'`, { timeout: 40000, label: `Go ${questId}` }).catch(() => {});
    const n = await b.eval('debug.navState()');
    return { clicked, status: n.status, reason: n.reason, target: n.targetId, at: [Math.round(n.x), Math.round(n.y)], failed: await b.eval(`debug.log.filter((e) => e.type === 'navigationChanged' && e.status === 'failed').length`) };
  };
  // Town: Q1 accepted at the Captain, Go to Smith Brann from where the Captain step leaves the player.
  const town = await goFrom('demo_town', 562, 503, 'mvp_01_welcome', `debug.startQuest('mvp_01_welcome'); debug.trackQuest('mvp_01_welcome');`);
  // Field: Q2 at the Elite objective (wolves / fangs done), from the meadow road.
  const field = await goFrom('demo_field', 314, 265, 'mvp_02_meadow',
    `debug.startQuest('mvp_01_welcome'); debug.forceCompleteQuest('mvp_01_welcome'); debug.claimQuest('mvp_01_welcome'); debug.startQuest('mvp_02_meadow'); debug.trackQuest('mvp_02_meadow'); debug.reachLocation('demo_field_entry'); for (let i = 1; i <= 3; i++) debug.defeatMonster('wolf-' + i); debug.grantItem('wolf_fang', 3);`);
  // Crypt: a Story player in Section II (the QA position, body clear of the wall row) with the gates on the way open
  // (their encounters down), Go to the Crypt Lord.
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); debug.meetDungeonAccess(); debug.startQuest('mvp_03_crypt'); debug.trackQuest('mvp_03_crypt'); debug.takePortal('demo_town_to_dungeon'); true`);
  await sleep(250);
  await b.eval(`for (let i = 1; i <= 6; i++) debug.defeatMonster('crypt_skeleton-' + i); debug.defeatMonster('crypt_brute-1'); debug.defeatMonster('crypt_knight-1'); debug.reachLocation('demo_crypt_entrance'); true`);
  await sleep(200);
  await b.eval(`debug.setPeaceful(true); debug.teleport(598, 996); debug.clearLog(); true`);
  await sleep(250);
  const cryptGo = await b.eval(`(() => { const e = document.querySelector('[data-hud=quest-tracker] [data-quest=mvp_03_crypt] [data-action=quest-go]'); if (!e) return false; e.click(); return true; })()`);
  await b.waitFor(`debug.navState().status !== 'moving'`, { timeout: 40000, label: 'Go Crypt Lord' }).catch(() => {});
  const lord = await b.eval(`(() => { const n = debug.navState(), m = debug.monster('crypt_lord-1'); return { status: n.status, reason: n.reason, target: n.targetId, map: n.mapId, dist: Math.round(Math.hypot(n.x - m.x, n.y - m.y)),
    failed: debug.log.filter((e) => e.type === 'navigationChanged' && e.status === 'failed').length }; })()`);
  t.check('RP-1. quest Go from the QA positions reaches Smith Brann (Town), the Elite Ruins (Field) and the Crypt Lord (Crypt Section II) by walking: no no_path, no failure',
    town.clicked && town.status === 'arrived' && town.failed === 0 && field.clicked && field.status === 'arrived' && field.failed === 0 &&
      cryptGo && lord.status === 'arrived' && lord.map === 'demo_crypt' && lord.failed === 0 && lord.dist < 160,
    JSON.stringify({ town, field, lord }));

  // 2. Never silent: a failed Auto Move and a Go that cannot start both put the localized notice in the feed.
  const feedLines = () => b.eval(`[...document.querySelectorAll('[data-hud=loot-feed] [data-loot-kind=locked]')].map((e) => e.textContent)`);
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); true`);
  await sleep(200);
  await b.eval(`(() => { const w = ${S}.world; w.events.emit('navigationChanged', { status: 'failed', targetId: 'nav_town_enhancement', route: [], step: 0, paused: false, reason: 'no_path' }); })(); true`);
  await sleep(150);
  const afterFail = await feedLines();
  // A Go that cannot start (goToQuest emits this when Auto Move refuses the route).
  await b.eval(`(() => { const w = ${S}.world; w.events.emit('navigationUnavailable', { reason: 'unreachable' }); })(); true`);
  await sleep(150);
  const afterUnavailable = await feedLines();
  const th = await b.eval(`(async () => { const { STRINGS } = await import('/src/ui/i18n/strings.ts'); return STRINGS.th['feed.autoMoveFailed']; })()`);
  t.check('RP-2. navigation failure is never silent: a failed route and a Go that cannot start each show "walk there yourself" in the feed (Thai string from the table)',
    afterFail.some((s) => /walk there yourself/i.test(s)) && afterUnavailable.filter((s) => /walk there yourself/i.test(s)).length >= 2 && th === 'ไม่สามารถไปยังจุดหมายอัตโนมัติได้ กรุณาเดินไปด้วยตนเอง',
    JSON.stringify({ afterFail, afterUnavailable, th }));

  // 3. Stat points in the Character window.
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); true`);
  await sleep(200);
  const attrs = () => b.eval(`(() => { const r = document.querySelector('[data-role=hero-attributes]'); if (!r) return null;
    return { points: Number(r.dataset.points), shown: r.querySelector('[data-role=stat-points] strong')?.textContent, plus: r.querySelectorAll('[data-add-stat]').length,
      str: Number(r.querySelector('[data-attr=str] .hero-attr__value').textContent), vit: Number(r.querySelector('[data-attr=vit] .hero-attr__value').textContent),
      atk: document.querySelector('[data-role=hero-stats] [data-stat=attack] .hero-stat__value')?.textContent, hp: document.querySelector('[data-role=hero-stats] [data-stat=maxHp] .hero-stat__value')?.textContent }; })()`);
  await b.eval(`document.querySelector('[data-menu=character]').click(); true`);
  await sleep(350);
  const lv1 = await attrs();
  await b.eval(`debug.grantExp(debug.expToNext(1)); true`); // a real level-up
  await sleep(200);
  await b.press('Escape'); await sleep(150);
  await b.eval(`document.querySelector('[data-menu=character]').click(); true`);
  await sleep(350);
  const lv2 = await attrs();
  const before = await b.eval(`({ alloc: debug.progress().allocated?.str ?? null, atk: debug.player().stats.attack })`);
  await b.eval(`document.querySelector('[data-role=hero-attributes] [data-add-stat=str]').click(); true`);
  await sleep(200);
  const spent = await attrs();
  const after = await b.eval(`({ alloc: debug.progress().allocated?.str ?? null, atk: debug.player().stats.attack })`);
  await shot('release-stat-points');
  // Persistence through the existing save pipeline: save, reset, load.
  const save = await b.eval('debug.save()');
  await b.eval(`debug.reset('demo_town'); true`);
  const wiped = await b.eval(`debug.progress().allocated?.str ?? null`);
  const loaded = await b.eval(`debug.load(${JSON.stringify(save)})`);
  await sleep(200);
  const restored = await b.eval(`({ alloc: debug.progress().allocated?.str ?? null, atk: debug.player().stats.attack, level: debug.player().level })`);
  await b.press('Escape'); await sleep(150);
  await b.eval(`document.querySelector('[data-menu=character]').click(); true`);
  await sleep(350);
  const reopened = await attrs();
  // 640x360: the + controls stay tappable (>= 24 px) and inside the window.
  await b.eval(`(() => { debug.grantExp(debug.expToNext(2)); })(); true`);
  await b.press('Escape'); await sleep(150);
  await b.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 1, mobile: true });
  await sleep(250);
  await b.eval(`document.querySelector('[data-menu=character]').click(); true`);
  await sleep(400);
  const small = await b.eval(`(() => { const w = document.querySelector('.ui-window').getBoundingClientRect(); return [...document.querySelectorAll('[data-add-stat]')].map((e) => { e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= w.left && r.right <= w.right && r.top >= w.top && r.bottom <= w.bottom }; }); })()`);
  await shot('release-stat-points-640x360');
  await b.press('Escape');
  await b.setViewport({ mobile: false });
  await sleep(200);
  t.check('RP-3. stat points: a level-up grants one, the Character window shows it with a + per attribute; one tap spends exactly one (STR +1, ATK up); at zero the + controls are gone',
    lv1 && lv1.points === 0 && lv1.plus === 0 && lv2.points === 1 && lv2.shown === '1' && lv2.plus === 6 &&
      spent.points === 0 && spent.plus === 0 && spent.str === lv2.str + 1 && after.alloc === (before.alloc ?? 0) + 1 && after.atk > before.atk && spent.atk !== lv2.atk,
    JSON.stringify({ lv1, lv2, spent, before, after }));
  t.check('RP-4. the spent point survives the existing save → load (allocation, derived ATK, the window), and the + controls stay tappable inside the window at 640x360',
    wiped === 0 && loaded.ok && restored.alloc === after.alloc && restored.atk === after.atk && reopened.points === 0 && reopened.str === spent.str &&
      small.length === 6 && small.every((s) => s.w >= 24 && s.h >= 24 && s.inside),
    JSON.stringify({ wiped, loaded, restored, reopened, small }));

  // 4. Story victory: the banner celebrates the clear (no "no run / no reward"); the Story reward still comes at turn-in.
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); debug.meetDungeonAccess(); debug.startQuest('mvp_03_crypt'); debug.takePortal('demo_town_to_dungeon'); true`);
  await sleep(300);
  await b.eval(`(() => { const m = debug.monster('crypt_lord-1'); debug.teleport(m.x - 60, m.y + 30); debug.defeatMonster('crypt_lord-1'); })(); true`);
  await sleep(250);
  const banner = await b.eval(`${S}.children.list.filter((o) => o.type === 'Text' && o.visible && /DEFEATED/.test(o.text)).map((o) => o.text)`);
  const profile = await b.eval('debug.encounterProfile()');
  await b.eval(`debug.takePortal('demo_dungeon_boss_exit'); true`);
  await sleep(200);
  const gold0 = (await b.eval('debug.equipment()')).gold;
  const claim = await b.eval(`debug.turnInQuest('mvp_03_crypt', 'npc_captain_rowan')`);
  const gold1 = (await b.eval('debug.equipment()')).gold;
  t.check('RP-5. Story victory banner reads "CRYPT LORD DEFEATED!" (no "no run" / "no reward"); the Story reward (600 Gold) is still granted at turn-in',
    profile === 'story' && banner.includes('CRYPT LORD DEFEATED!') && !banner.some((s) => /no run|no reward/i.test(s)) && claim.ok && gold1 === gold0 + 600,
    JSON.stringify({ profile, banner, claim, gold0, gold1 }));
  await b.eval(`debug.reset(); true`);
}

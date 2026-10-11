// Combat readability pass: player / boss status rows, Enrage, the telegraph, the boss zone sign and the
// compact 640x360 danger fade. Real potions, real Enrage through damage, real Grave Slam wind-ups.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;
const LORD = 'crypt_lord-1';

/** Visible cells of one status row (player-status / target-status). */
const row = (b, hud) => b.eval(`(() => {
  const r = document.querySelector('[data-hud=${hud}]'); if (!r) return null;
  const box = r.getBoundingClientRect(), more = r.querySelector('.hud-status__more');
  const cells = [...r.querySelectorAll('.hud-status__cell')].filter((c) => !c.hidden).map((c) => {
    const label = c.querySelector('.hud-status__label'), b = c.getBoundingClientRect();
    return { id: c.dataset.status, kind: c.dataset.kind, time: c.querySelector('.hud-status__time').textContent, cd: Number(c.style.getPropertyValue('--cd') || 0),
      label: label?.textContent ?? null, labelFits: !label || label.scrollWidth <= label.clientWidth + 1, isNew: c.classList.contains('is-new'), box: [b.left, b.top, b.right, b.bottom] };
  });
  return { shown: !r.hidden && box.height > 0, box: [box.left, box.top, box.right, box.bottom], cells, more: more.hidden ? '' : more.textContent, aria: r.getAttribute('aria-label') };
})()`);
const rect = (b, sel) => b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
const zoneSign = (b) => b.eval(`${S}.children.list.filter((o) => o.type === 'Text' && o.text === 'Crypt Lord').map((o) => o.visible)`);
const apply = (b, list) => b.eval(`(() => { const w = ${S}.world; for (const [id, ms] of ${JSON.stringify(list)}) w.statuses.apply(w.player, id, ms, w.now); return true; })()`);

/** Engaged with the Lord: on it, targeted, real hits until the real Enrage fires (HP set just above the 35% threshold). */
async function enrageLord(b) {
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); debug.setRng(0.5); true`);
  await sleep(250);
  const m = await b.eval(`debug.monster('${LORD}')`);
  await b.eval(`debug.teleport(${m.spawnX - 36}, ${m.spawnY}); debug.setPlayerHp(999999); debug.selectTarget('${LORD}');
    debug.setMonsterHp('${LORD}', Math.ceil(${m.maxHp} * 0.36)); debug.clearLog(); true`);
  await b.keyDown('Space');
  await b.waitFor(`debug.log.some((e) => e.type === 'monsterEnraged' && e.entity === '${LORD}')`, { timeout: 6000, label: 'Lord enrages from real hits' }).catch(() => {});
  await b.keyUp('Space');
}
// The Lord's own Slam cooldown is cleared first, so each wind-up starts exactly now.
const slam = (b) => b.eval(`(() => { const w = ${S}.world, m = w.monsterById('${LORD}'); m.combat.cooldowns.clear(); debug.setPeaceful(false); w.skills.use(m, 'crypt_slam_story', w.now); return true; })()`);
const slamDone = (b) => b.waitFor(`debug.log.some((e) => e.skill === 'crypt_slam_story' && ['damage', 'miss', 'hitCancelled'].includes(e.type))`, { timeout: 4000, label: 'Grave Slam resolves' }).catch(() => {});

export async function hudStatusSuite(b, t, shot) {
  t.section('HUD status rows / Enrage / telegraph readability');

  // 1. Real potions: both recoveries appear under the player frame as buffs with a ticking timer, then leave.
  await b.eval(`debug.reset(); debug.setPeaceful(true); debug.grantItem('small_hp_potion', 2); debug.grantItem('small_mp_potion', 2); debug.setPlayerHp(100); debug.setPlayerMp(10); true`);
  await sleep(150);
  const before = await row(b, 'player-status');
  const used = await b.eval(`[debug.useItem('small_hp_potion').ok, debug.useItem('small_mp_potion').ok]`);
  await sleep(150);
  const hot = await row(b, 'player-status');
  await sleep(1100);
  const later = await row(b, 'player-status');
  const frame = await rect(b, '[data-hud=player]');
  t.check('HS-1. potion recoveries show as buff icons directly under the player frame, with seconds left and a sweep that advances',
    !before.shown && used.every(Boolean) && hot.shown && JSON.stringify(hot.cells.map((c) => c.id)) === '["potion_hp","potion_mp"]' &&
      hot.cells.every((c) => c.kind === 'buff' && c.time === '3' && c.box[2] - c.box[0] >= 20) && later.cells.every((c, i) => Number(c.time) <= 3 && c.cd > hot.cells[i].cd) &&
      hot.box[1] >= frame[3] && hot.box[1] - frame[3] <= 10 && hot.box[0] >= frame[0] && hot.aria === 'Your status effects',
    JSON.stringify({ before: before.shown, used, hot: hot.cells, later: later.cells, row: hot.box, frame }));

  // 2. Steady state is cheap: while timers run, no cell is created or removed (only text and --cd change).
  const churn = await b.eval(`new Promise((done) => {
    const r = document.querySelector('[data-hud=player-status]'), nodes = r.querySelectorAll('*').length; let added = 0;
    const o = new MutationObserver((list) => { for (const m of list) if (m.type === 'childList' && m.target.classList?.contains('hud-status')) added += m.addedNodes.length + m.removedNodes.length; });
    o.observe(r, { childList: true, subtree: true });
    setTimeout(() => { o.disconnect(); done({ added, nodes, after: r.querySelectorAll('*').length }); }, 900);
  })`);
  t.check('HS-2. timer updates never add or remove status cells (pooled DOM)', churn.added === 0 && churn.nodes === churn.after, JSON.stringify(churn));
  await sleep(2400);
  t.check('HS-3. the row hides itself once the recoveries end', !(await row(b, 'player-status')).shown);

  // 3. Buffs vs debuffs, overflow: nine states show six cells and "+3".
  // A fresh reset clears the potion cooldowns from step 1.
  await b.eval(`debug.reset(); debug.setPeaceful(true); debug.grantItem('small_hp_potion', 1); debug.grantItem('small_mp_potion', 1); debug.setPlayerHp(100); debug.setPlayerMp(10); true`);
  await sleep(150);
  // Potions first: a stun would block drinking.
  await b.eval(`debug.useItem('small_hp_potion'); debug.useItem('small_mp_potion'); true`);
  await apply(b, [['guard', 3000], ['iron_guard', 3000], ['berserk', 3000], ['guardian_instinct', 3000], ['battle_instinct', 3000], ['stunned', 1500], ['taunted', 1500]]);
  await sleep(120);
  const many = await row(b, 'player-status');
  await shot('hud-status-01-player-row');
  t.check('HS-4. buffs use the steel rim, Stun / Taunt the red debuff rim; more than six states collapse into +N',
    many.cells.length === 6 && many.more === '+3' && many.cells.filter((c) => c.kind === 'debuff').map((c) => c.id).join() === 'stunned' &&
      many.cells.filter((c) => c.kind === 'buff').length === 5 && many.box[2] - many.box[0] < 240, JSON.stringify(many));
  await sleep(3400);

  // 4. Real Enrage: a labelled chip under the boss bar that pulses once, stays, and survives a wind-up warning.
  await enrageLord(b);
  const enraged = await row(b, 'target-status');
  await sleep(1200);
  const steady = await row(b, 'target-status');
  const signEngaged = await zoneSign(b);
  await slam(b);
  await sleep(500);
  const during = await b.eval(`(() => { const f = document.querySelector('[data-hud=target]'); return { state: f.dataset.state, text: f.querySelector('.hud-target__state').textContent, danger: document.querySelector('[data-hud=actions]').dataset.danger }; })()`);
  const duringRow = await row(b, 'target-status');
  const windup = await b.eval(`debug.log.find((e) => e.type === 'skillWindup' && e.skill === 'crypt_slam_story')?.amount ?? null`);
  const arcs = await b.eval(`${S}.children.list.filter((o) => o.type === 'Arc' && o.visible && Math.abs(o.radius - ${windup ?? -1}) < 0.01)
    .map((o) => ({ fill: o.fillAlpha, stroke: o.isStroked ? o.strokeAlpha : 0, line: o.lineWidth, scale: Math.round(o.scale * 100) / 100 }))`);
  await shot('hud-status-02-enrage-windup');
  await slamDone(b);
  await sleep(250);
  const afterSlam = await b.eval(`({ danger: document.querySelector('[data-hud=actions]').dataset.danger, state: document.querySelector('[data-hud=target]').dataset.state })`);
  t.check('HS-5. real Enrage adds a labelled "Enraged" chip under the boss bar that pulses once, then stays',
    enraged.cells[0]?.id === 'enraged' && enraged.cells[0].label === 'Enraged' && enraged.cells[0].isNew && enraged.cells[0].time === '' &&
      steady.cells[0]?.id === 'enraged' && !steady.cells[0].isNew, JSON.stringify({ enraged, steady }));
  t.check('HS-6. during a Grave Slam wind-up the warning and the Enrage chip show together; the cluster is flagged for danger until it lands',
    during.state === 'windup' && during.text === 'Winding up!' && duringRow.cells[0]?.id === 'enraged' && during.danger === 'true' && afterSlam.danger === 'false',
    JSON.stringify({ during, duringRow: duringRow.cells, afterSlam }));
  // Telegraph: the edge is drawn on the real skill radius (84) at full strength; the fills stay light.
  const edge = arcs.filter((a) => a.scale === 1 && a.stroke === 1);
  t.check('HS-7. telegraph keeps the real radius: a full-strength edge exactly on it, light fills (no heavy disc)',
    windup === 84 && edge.length === 1 && edge[0].line >= 2.5 && arcs.every((a) => a.fill <= 0.2) && arcs.length === 3, JSON.stringify({ windup, arcs }));
  await b.eval(`debug.selectTarget(null); true`);
  await sleep(100);
  t.check('HS-8. the "Crypt Lord" zone sign steps aside while the Lord is engaged and returns afterwards',
    signEngaged.length === 1 && signEngaged[0] === false && (await zoneSign(b))[0] === true, JSON.stringify({ signEngaged }));

  // 5. Compact 640x360: potion sockets fade during the wind-up yet stay tappable; status rows stay clear of the feed.
  await b.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 1, mobile: true });
  await sleep(250);
  await b.eval(`debug.selectTarget('${LORD}'); debug.setPlayerHp(999999); debug.clearLog(); debug.grantItem('small_hp_potion', 1); debug.setPlayerHp(100); debug.useItem('small_hp_potion'); debug.setPlayerHp(999999); true`);
  await sleep(150);
  const baseline = await b.eval(`Number(getComputedStyle(document.querySelector('[data-slot=potion]')).opacity)`);
  await slam(b);
  await sleep(450);
  const potions = await b.eval(`['potion', 'mp_potion'].map((id) => { const e = document.querySelector('[data-slot=' + id + ']'), r = e.getBoundingClientRect();
    return { id, opacity: Number(getComputedStyle(e).opacity), hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.ui-slot')?.dataset.slot }; })`);
  const compact = { status: await row(b, 'player-status'), target: await rect(b, '[data-hud=target]'), chip: (await row(b, 'target-status')).cells[0],
    feed: await b.eval(`[...document.querySelectorAll('.hud-loot__line')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })`) };
  await shot('hud-status-03-640x360-windup');
  await slamDone(b);
  await sleep(250);
  const rested = await b.eval(`Number(getComputedStyle(document.querySelector('[data-slot=potion]')).opacity)`);
  const overlap = (a, z) => a[0] < z[2] && a[2] > z[0] && a[1] < z[3] && a[3] > z[1];
  t.check('HS-9. 640x360: during the wind-up the potion sockets fade (ring shows through) but still take the tap; they return after the hit',
    potions.every((p) => p.opacity <= 0.55 && p.hit === p.id) && Math.abs(rested - baseline) < 0.01, JSON.stringify({ potions, baseline, rested }));
  t.check('HS-10. 640x360: the status row clears the feed; the Enrage chip fits inside the boss frame and does not replay its pulse on re-target',
    compact.status.shown && compact.feed.every((l) => !overlap(l, compact.status.box)) && !!compact.chip && compact.chip.box[2] <= compact.target[2] && compact.chip.box[3] <= compact.target[3] && compact.chip.labelFits && !compact.chip.isNew,
    JSON.stringify(compact));

  // 6. Thai through the real Settings control: the chip, warning and row labels come from the string table and fit.
  const click = async (sel) => { const r = await rect(b, sel); await b.mouse('mousePressed', (r[0] + r[2]) / 2, (r[1] + r[3]) / 2); await b.mouse('mouseReleased', (r[0] + r[2]) / 2, (r[1] + r[3]) / 2); await sleep(120); };
  await click('[data-menu=menu]');
  await b.eval(`document.querySelector('[data-window=menu] [data-screen=settings]').scrollIntoView({ block: 'nearest' })`);
  await click('[data-window=menu] [data-screen=settings]');
  await click('[data-window=settings] [data-locale=th]');
  await b.press('Escape');
  await b.eval(`debug.clearLog(); true`);
  await slam(b);
  await sleep(450);
  const thai = { chip: (await row(b, 'target-status')).cells[0], aria: (await row(b, 'player-status')).aria, target: await rect(b, '[data-hud=target]'),
    warning: await b.eval(`(() => { const e = document.querySelector('.hud-target__state'), f = document.querySelector('[data-hud=target]'); return { text: e.textContent, right: e.getBoundingClientRect().right, frame: f.getBoundingClientRect().right }; })()`) };
  await shot('hud-status-04-thai-640x360');
  await slamDone(b);
  await click('[data-menu=menu]');
  await b.eval(`document.querySelector('[data-window=menu] [data-screen=settings]').scrollIntoView({ block: 'nearest' })`);
  await click('[data-window=menu] [data-screen=settings]');
  await click('[data-window=settings] [data-locale=en]');
  await b.press('Escape');
  t.check('HS-11. Thai: "บ้าคลั่ง" chip and "เตรียมโจมตี!" warning from the string table, fitting inside the 640x360 boss frame',
    thai.chip?.label === 'บ้าคลั่ง' && thai.chip.labelFits && thai.chip.box[2] <= thai.target[2] && thai.warning.text === 'เตรียมโจมตี!' && thai.warning.right <= thai.warning.frame + 0.5 &&
      thai.aria === 'สถานะของคุณ' && (await b.eval(`document.querySelector('[data-ui-root]').lang`)) === 'en', JSON.stringify(thai));
  await b.setViewport({ mobile: false });
  await b.eval(`debug.setPeaceful(true); debug.selectTarget(null); true`);
  await sleep(150);
}

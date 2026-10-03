// HUD foundation: regions render, bars track state, the centre stays open for
// the game, buttons drive the same actions as keys, windows open and close.
import { sleep } from './cdp.mjs';

const rect = (sel) => `(() => {
  const e = document.querySelector(${JSON.stringify(sel)});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
})()`;

const prepTarget = `(() => {
  const p = game.scene.getScene('World').player;
  debug.placeMonster('slime-1', p.x, p.y + 28);
  debug.setMonsterHp('slime-1', 100000);
  debug.selectTarget('slime-1');
  debug.resetCooldowns();
  debug.setPlayerMp(50);
  debug.clearLog();
})()`;

const usedCount = (skill) => `debug.log.filter((e) => e.type === 'skillUsed' && e.skill === '${skill}').length`;

export async function hudSuite(b, t, shot) {
  t.section('HUD foundation');
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  await sleep(300);

  const regions = await b.eval(`['player', 'minimap', 'menu', 'quests', 'actions', 'joystick'].filter((r) => !document.querySelector('[data-hud=' + r + ']'))`);
  t.check('H1. every HUD region renders', regions.length === 0, regions.length ? `missing: ${regions}` : '');

  await b.eval('(() => { const s = debug.player().stats; debug.setPlayerHp(s.maxHp / 2); debug.setPlayerMp(s.maxMp / 2); })()');
  await sleep(150);
  const bars = await b.eval(`({ hp: document.querySelector('[data-bar=hp]').dataset.ratio, mp: document.querySelector('[data-bar=mp]').dataset.ratio,
    level: document.querySelector('.hud-portrait__level').textContent })`);
  // MP regenerates while we wait, so allow a little drift above half.
  t.check('H2. HP / MP bars track player state', bars.hp === '0.500' && Math.abs(Number(bars.mp) - 0.5) < 0.03, `hp=${bars.hp} mp=${bars.mp}`);
  t.check('H3. level shows on the portrait', bars.level === 'Lv 1', bars.level);
  await b.eval('debug.reset(); debug.setPeaceful(true)');

  // The drag suite presses at these points; the centre must stay the game's.
  const points = [[480, 270], [480, 300], [420, 305], [425, 380], [490, 302]];
  const blocked = await b.eval(`${JSON.stringify(points)}.filter(([x, y]) => document.elementFromPoint(x, y)?.tagName !== 'CANVAS')`);
  t.check('H4. screen centre and drag points reach the game canvas', blocked.length === 0, blocked.length ? JSON.stringify(blocked) : '');

  // Clicking the attack button fires the basic attack like Space does.
  await b.eval(prepTarget);
  await sleep(80);
  const atk = await b.eval(rect('[data-slot=attack]'));
  await b.mouse('mousePressed', atk.x, atk.y);
  await sleep(60);
  await b.mouse('mouseReleased', atk.x, atk.y);
  await sleep(120);
  t.check('H5. attack button fires the basic attack', (await b.eval(usedCount('basic_attack'))) === 1, `skillUsed=${await b.eval(usedCount('basic_attack'))}`);

  // A skill slot fires its skill and shows the cooldown wipe.
  await b.eval(prepTarget);
  await sleep(80);
  const q = await b.eval(rect('[data-slot=skill1]'));
  await b.mouse('mousePressed', q.x, q.y);
  await sleep(60);
  await b.mouse('mouseReleased', q.x, q.y);
  await sleep(150);
  const cd = await b.eval(`document.querySelector('[data-slot=skill1]').dataset.cooldown`);
  t.check('H6. skill slot fires its skill and shows cooldown', (await b.eval(usedCount('power_strike'))) === 1 && cd === 'true', `cooldown=${cd}`);
  await shot('hud-01-combat');

  // Reserved slots are inert.
  const potion = await b.eval(rect('[data-slot=potion]'));
  await b.eval('debug.clearLog()');
  await b.mouse('mousePressed', potion.x, potion.y);
  await b.mouse('mouseReleased', potion.x, potion.y);
  await sleep(100);
  const reserved = await b.eval(`({ disabled: document.querySelector('[data-slot=potion]').classList.contains('is-disabled'), used: debug.log.filter((e) => e.type === 'skillUsed').length })`);
  t.check('H7. reserved slots are disabled and fire nothing', reserved.disabled && reserved.used === 0, JSON.stringify(reserved));

  // Windows: menu button, hotkey, Esc.
  await b.eval(`document.querySelector('[data-menu=inventory]').click()`);
  await sleep(150);
  const opened = await b.eval(`!!document.querySelector('[data-window=inventory]')`);
  await shot('hud-02-window');
  await b.press('Escape');
  await sleep(150);
  const closed = await b.eval(`!document.querySelector('[data-window]')`);
  t.check('H8. menu button opens a window, Esc closes it', opened && closed, `opened=${opened} closed=${closed}`);
  await b.press('KeyC');
  await sleep(150);
  const hot = await b.eval(`!!document.querySelector('[data-window=character]')`);
  await b.press('KeyC');
  await sleep(150);
  const hotClosed = await b.eval(`!document.querySelector('[data-window]')`);
  t.check('H9. hotkey toggles its window', hot && hotClosed, `open=${hot} closed=${hotClosed}`);

  await b.eval('debug.reset()');
  await sleep(200);
}

/** Touch-only checks; run with touch emulation on. */
export async function hudTouchSuite(b, t, shot) {
  t.section('HUD on touch');
  await b.eval(prepTarget);
  await sleep(80);
  const atk = await b.eval(rect('[data-slot=attack]'));
  await b.touch('touchStart', atk.x, atk.y);
  await sleep(60);
  await b.touch('touchEnd', atk.x, atk.y);
  await sleep(150);
  const state = await b.eval(`({ used: ${usedCount('basic_attack')}, moving: game.scene.getScene('World').player.state })`);
  t.check('touch: tapping attack fires it without moving the player', state.used === 1 && state.moving === 'idle', JSON.stringify(state));

  await b.touch('touchStart', 300, 380);
  await b.touch('touchMove', 330, 360);
  await sleep(120);
  const active = await b.eval(`document.querySelector('[data-hud=joystick]').dataset.active`);
  await shot('hud-03-touch-drag');
  await b.touch('touchEnd', 330, 360);
  await sleep(100);
  const after = await b.eval(`document.querySelector('[data-hud=joystick]').dataset.active`);
  t.check('touch: joystick shows during a drag and hides after', active === 'true' && after === 'false', `${active} -> ${after}`);
}

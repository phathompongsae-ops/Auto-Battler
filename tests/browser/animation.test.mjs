// Character art animation: basic attack plays over idle, keeps the collision
// body fixed, fires its hit frame, returns to idle and never blocks movement.
import { sleep } from './cdp.mjs';

const STATE = `(() => {
  const p = game.scene.getScene('World').player;
  return { state: p.state, facing: p.facing, action: p.action, x: p.x, y: p.y,
    anim: p.anims.currentAnim && p.anims.currentAnim.key, tex: p.texture.key };
})()`;

// Records the player's animation, body box and hit-frame events every frame
// until `ms` has passed. Times are relative to the first skillUsed in the window.
const record = (ms) => `new Promise((resolve) => {
  const w = game.scene.getScene('World'), p = w.player;
  const rows = [], hits = [];
  let start = null;
  const onUsed = (e) => { if (e.casterId === p.id && start === null) start = performance.now(); };
  const onHit = (e) => hits.push({ ...e, t: performance.now() });
  const offUsed = w.world.events.on('skillUsed', onUsed);
  p.on('action-hit', onHit);
  const t0 = performance.now();
  const tick = () => {
    rows.push({ anim: p.anims.currentAnim && p.anims.currentAnim.key, action: p.action,
      body: [p.body.left - p.x, p.body.top - p.y, p.body.width, p.body.height].map((v) => +v.toFixed(2)) });
    if (performance.now() - t0 < ${ms}) return requestAnimationFrame(tick);
    offUsed();
    p.off('action-hit', onHit);
    resolve({ rows, hits: hits.map((h) => ({ action: h.action, direction: h.direction, dt: start === null ? null : h.t - start })) });
  };
  tick();
})`;

const sameBody = (rows) => {
  const first = JSON.stringify(rows[0].body);
  return rows.every((r) => JSON.stringify(r.body) === first) ? first : null;
};

export async function attackAnimationSuite(b, t, shot) {
  t.section('Warrior basic attack animation');
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  await sleep(300);

  let s = await b.eval(STATE);
  t.check('A1. Warrior art is in use', s.tex.startsWith('warrior-'), s.tex);

  // idle -> walk -> stop
  await b.keyDown('ArrowDown');
  await sleep(300);
  s = await b.eval(STATE);
  await b.keyUp('ArrowDown');
  t.check('A2. walks down before attacking', s.anim === 'player-walk-down', s.anim);
  await sleep(120);
  s = await b.eval(STATE);
  t.check('A3. stops in idle', s.anim === 'player-idle-down' && s.state === 'idle', s.anim);

  // A target just south, so the attack faces down. High HP keeps it alive for every swing.
  await b.eval(`(() => {
    const p = game.scene.getScene('World').player;
    debug.placeMonster('slime-1', p.x, p.y + 28);
    debug.setMonsterHp('slime-1', 100000);
    debug.selectTarget('slime-1');
    debug.resetCooldowns();
  })()`);
  await sleep(100);

  // stop -> attack -> idle
  const rec = b.eval(record(800));
  await b.press('Space');
  const { rows, hits } = await rec;
  const attackRows = rows.filter((r) => r.anim === 'player-attack-down');
  t.check('A4. attack plays the south attack animation', attackRows.length > 0, `${attackRows.length} frames`);
  const body = sameBody(rows);
  t.check('A5. collision body never moves during the attack', body === '[-8,4,16,10]', body ?? JSON.stringify(rows.map((r) => r.body)));
  const hitDt = hits[0]?.dt;
  // Hit frame 4 at 18 fps = 222 ms after the swing starts.
  t.check('A6. hit frame fires once, at the configured frame', hits.length === 1 && hits[0].direction === 'down' && hitDt > 160 && hitDt < 320, `hits=${hits.length} dt=${hitDt?.toFixed(0)}ms`);
  const last = rows[rows.length - 1];
  t.check('A7. returns to idle after the attack', last.anim === 'player-idle-down' && last.action === null, `${last.anim}/${last.action}`);
  await shot('animation-01-attack-idle');

  // idle -> walk again: input is not stuck after the attack.
  const before = await b.eval(STATE);
  await b.keyDown('ArrowRight');
  await sleep(300);
  s = await b.eval(STATE);
  await b.keyUp('ArrowRight');
  t.check('A8. walks again right after attacking', s.anim === 'player-walk-right' && s.x - before.x > 30, `${s.anim} dx=${(s.x - before.x).toFixed(1)}`);
  await sleep(120);

  // Walking cancels an attack in progress.
  await b.eval(`(() => {
    const p = game.scene.getScene('World').player;
    debug.placeMonster('slime-1', p.x, p.y + 28);
    debug.resetCooldowns();
  })()`);
  await sleep(80);
  await b.press('Space');
  await sleep(60);
  s = await b.eval(STATE);
  const midAttack = s.anim === 'player-attack-down';
  await b.keyDown('ArrowLeft');
  await sleep(120);
  s = await b.eval(STATE);
  await b.keyUp('ArrowLeft');
  t.check('A9. moving cancels the attack immediately', midAttack && s.anim === 'player-walk-left' && s.action === null, `${s.anim}/${s.action}`);
  await sleep(120);

  // Held attack: repeated swings end in a clean idle.
  await b.eval(`(() => {
    const p = game.scene.getScene('World').player;
    debug.placeMonster('slime-1', p.x, p.y + 28);
    debug.resetCooldowns();
  })()`);
  await sleep(80);
  const held = b.eval(record(2300));
  await b.keyDown('Space');
  await sleep(1600);
  await b.keyUp('Space');
  const rep = await held;
  const end = rep.rows[rep.rows.length - 1];
  t.check('A10. repeated attacks fire a hit frame per swing', rep.hits.length >= 3, `hits=${rep.hits.length}`);
  t.check('A11. repeated attacks end in idle', end.anim === 'player-idle-down' && end.action === null, `${end.anim}/${end.action}`);
  t.check('A12. collision body unchanged across repeated attacks', sameBody(rep.rows) === '[-8,4,16,10]');

  await b.eval('debug.reset()');
  await sleep(300);

  for (const [dir, key, dx, dy] of [
    ['up', 'ArrowUp', 0, -28],
    ['right', 'ArrowRight', 28, 0],
    ['left', 'ArrowLeft', -28, 0],
  ]) {
    await attackDirection(b, t, shot, dir, key, dx, dy);
  }
}

// Like record(), plus the time of each player damage event, for hit/impact alignment.
const recordSkill = (ms, skill) => `new Promise((resolve) => {
  const w = game.scene.getScene('World'), p = w.player;
  const rows = [], hits = [], damage = [];
  let start = null;
  const offUsed = w.world.events.on('skillUsed', (e) => { if (e.casterId === p.id && e.skillId === '${skill}' && start === null) start = performance.now(); });
  const offDmg = w.world.events.on('damage', (e) => { if (e.sourceId === p.id && e.skillId === '${skill}') damage.push(performance.now()); });
  const onHit = (e) => hits.push({ ...e, t: performance.now() });
  p.on('action-hit', onHit);
  const t0 = performance.now();
  const tick = () => {
    rows.push({ anim: p.anims.currentAnim && p.anims.currentAnim.key, action: p.action,
      body: [p.body.left - p.x, p.body.top - p.y, p.body.width, p.body.height].map((v) => +v.toFixed(2)) });
    if (performance.now() - t0 < ${ms}) return requestAnimationFrame(tick);
    offUsed(); offDmg(); p.off('action-hit', onHit);
    const rel = (t) => (start === null ? null : t - start);
    resolve({ rows, hits: hits.map((h) => ({ action: h.action, direction: h.direction, dt: rel(h.t) })), damage: damage.map(rel) });
  };
  tick();
})`;

const prepPowerTarget = `(() => {
  const p = game.scene.getScene('World').player;
  debug.setRng(0.5); // always hit, no crit: P4 needs the swing to connect
  debug.placeMonster('slime-1', p.x, p.y + 28);
  debug.setMonsterHp('slime-1', 100000);
  debug.selectTarget('slime-1');
  debug.resetCooldowns();
  debug.setPlayerMp(50);
})()`;

/** Warrior Power Slash (south): plays, keeps the body, lands damage on its hit frame, returns to idle. */
export async function powerSlashSuite(b, t, shot) {
  t.section('Warrior Power Slash (south)');
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  await sleep(250);

  // idle -> Power Slash -> idle
  await b.eval(prepPowerTarget);
  await sleep(100);
  const expected = await b.eval(`game.scene.getScene('World').player.actionHitDelay('powerSlash', 'down')`);
  const rec = b.eval(recordSkill(1100, 'power_strike'));
  await b.press('KeyQ');
  const { rows, hits, damage } = await rec;
  const slashRows = rows.filter((r) => r.anim === 'player-powerSlash-down');
  t.check('P1. Power Slash plays its south animation', slashRows.length > 0, `${slashRows.length} frames`);
  t.check('P2. collision body never moves', sameBody(rows) === '[-8,4,16,10]');
  const hitDt = hits[0]?.dt;
  t.check(
    'P3. hit frame fires once at its configured time',
    hits.length === 1 && hits[0].action === 'powerSlash' && Math.abs(hitDt - expected) < 70,
    `hits=${hits.length} dt=${hitDt?.toFixed(0)}ms expected=${expected?.toFixed(0)}ms`,
  );
  t.check(
    'P4. damage lands on the hit frame (within one frame)',
    damage.length === 1 && hits.length === 1 && Math.abs(damage[0] - hitDt) < 40,
    `damage=${damage[0]?.toFixed(0)}ms hit=${hitDt?.toFixed(0)}ms`,
  );
  const last = rows[rows.length - 1];
  t.check('P5. returns to idle after the slash', last.anim === 'player-idle-down' && last.action === null, `${last.anim}/${last.action}`);
  await shot('animation-power-slash');

  // walk -> stop -> Power Slash -> walk
  await b.keyDown('ArrowDown');
  await sleep(200);
  await b.keyUp('ArrowDown');
  await sleep(120);
  await b.eval(prepPowerTarget);
  await sleep(80);
  await b.press('KeyQ');
  await sleep(200);
  let s = await b.eval(STATE);
  const mid = s.anim === 'player-powerSlash-down';
  const before = s;
  await b.keyDown('ArrowRight');
  await sleep(250);
  s = await b.eval(STATE);
  await b.keyUp('ArrowRight');
  t.check('P6. walking right after Power Slash is immediate', mid && s.anim === 'player-walk-right' && s.x - before.x > 25 && s.action === null, `${s.anim} dx=${(s.x - before.x).toFixed(1)}`);
  await sleep(150);
  await b.eval('debug.setRng(null); debug.reset()');
  await sleep(200);
}

/** idle -> walk -> stop -> attack -> idle -> walk again, in one facing. */
async function attackDirection(b, t, shot, dir, key, dx, dy) {
  const tag = `D-${dir}`;
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  await sleep(250);

  await b.keyDown(key);
  await sleep(250);
  await b.keyUp(key);
  await sleep(120);
  let s = await b.eval(STATE);
  t.check(`${tag}1. walks then stops in idle facing ${dir}`, s.anim === `player-idle-${dir}` && s.facing === dir, s.anim);

  await b.eval(`(() => {
    const p = game.scene.getScene('World').player;
    debug.placeMonster('slime-1', p.x + ${dx}, p.y + ${dy});
    debug.setMonsterHp('slime-1', 100000);
    debug.selectTarget('slime-1');
    debug.resetCooldowns();
  })()`);
  await sleep(100);

  const expected = await b.eval(`game.scene.getScene('World').player.actionHitDelay('attack', '${dir}')`);
  const rec = b.eval(record(800));
  await b.press('Space');
  const { rows, hits } = await rec;
  const flipped = await b.eval(`game.scene.getScene('World').player.flipX`);
  const attackRows = rows.filter((r) => r.anim === `player-attack-${dir}`);
  t.check(`${tag}2. attack plays the ${dir} attack animation`, attackRows.length > 0, `${attackRows.length} frames`);
  const body = sameBody(rows);
  t.check(`${tag}3. collision body never moves`, body === '[-8,4,16,10]', body ?? 'changed');
  const dt = hits[0]?.dt;
  t.check(
    `${tag}4. hit frame fires once at its configured time`,
    expected !== null && hits.length === 1 && hits[0].direction === dir && Math.abs(dt - expected) < 70,
    `hits=${hits.length} dt=${dt?.toFixed(0)}ms expected=${expected?.toFixed(0)}ms`,
  );
  const last = rows[rows.length - 1];
  t.check(`${tag}5. returns to idle facing ${dir}`, last.anim === `player-idle-${dir}` && last.action === null, `${last.anim}/${last.action}`);
  if (dir === 'left') t.check(`${tag}6. west mirrors the east strip`, flipped === true, `flipX=${flipped}`);
  await shot(`animation-attack-${dir}`);

  const before = await b.eval(STATE);
  await b.keyDown(key);
  await sleep(250);
  s = await b.eval(STATE);
  await b.keyUp(key);
  const moved = Math.hypot(s.x - before.x, s.y - before.y);
  t.check(`${tag}7. walks again immediately after attacking`, s.anim === `player-walk-${dir}` && moved > 25, `${s.anim} moved=${moved.toFixed(1)}`);
  await sleep(120);
  await b.eval('debug.reset()');
  await sleep(200);
}

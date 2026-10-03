// Delayed (wind-up) melee hits, stepped deterministically: the scene's own
// loop is paused and the simulation is advanced by hand in fixed ticks, so
// every check runs at an exact simulation time instead of wall-clock sleeps.
import { sleep } from './cdp.mjs';

const TICK = 16;

// Runs one scenario inside the page. `script` is a list of steps:
//   ['cast'] press skill1 for one tick · ['wait', ms, dir?] step the sim, optionally moving ·
//   ['far'] move the target out of melee range.
const scenario = (script) => `(() => {
  const w = game.scene.getScene('World'), world = w.world, p = world.player;
  w.scene.pause();
  try {
    debug.reset(); debug.setPeaceful(true); debug.clearLog();
    // Fixed rolls: always hit, never crit, so only the wind-up rules decide the outcome.
    debug.setRng(0.5);
    debug.placeMonster('slime-1', p.x, p.y + 28);
    debug.setMonsterHp('slime-1', 100000);
    debug.selectTarget('slime-1');
    debug.setPlayerMp(50);
    const step = (ms, dir = null) => { for (let t = 0; t < ms; t += ${TICK}) world.update(${TICK}, dir); };
    for (const [op, ms, dir] of ${JSON.stringify(script)}) {
      if (op === 'cast') { w.virtualActions.press('skill1'); step(${TICK}); w.virtualActions.release('skill1'); }
      else if (op === 'wait') step(ms, dir ?? null);
      else if (op === 'far') debug.placeMonster('slime-1', p.x, p.y + 200);
    }
    const log = debug.log.filter((e) => e.skill === 'power_strike');
    const used = log.find((e) => e.type === 'skillUsed');
    const rel = (e) => e && used ? Math.round(e.t - used.t) : null;
    const dmg = log.filter((e) => e.type === 'damage');
    const cancelled = log.filter((e) => e.type === 'hitCancelled');
    return { used: !!used, damage: dmg.length, damageAt: rel(dmg[0]), cancelled: cancelled.map((e) => e.reason),
      mp: p.combat.mp, cooldown: Math.round((p.combat.cooldowns.get('power_strike') ?? 0) - world.now) };
  } finally {
    w.virtualActions.release('skill1');
    debug.setRng(null);
    w.scene.resume();
  }
})()`;

export async function delayedHitSuite(b, t) {
  t.section('Delayed melee hits (Power Strike wind-up)');
  // The art's hit time; the simulation's wind-up must land on it (W2).
  const windup = Math.floor(await b.eval(`game.scene.getScene('World').player.actionHitDelay('powerSlash', 'down')`));

  // Stationary: the hit lands at the hit frame and not before.
  let r = await b.eval(scenario([['cast'], ['wait', 288]]));
  t.check('W1. stationary: no damage before the hit frame', r.used && r.damage === 0, JSON.stringify(r));
  r = await b.eval(scenario([['cast'], ['wait', 400]]));
  t.check('W2. stationary: damage lands at the hit frame', r.damage === 1 && r.damageAt >= windup && r.damageAt < windup + 2 * TICK && r.cancelled.length === 0, `damageAt=${r.damageAt}ms`);

  // Moving before the hit frame cancels it, without refunding cost or cooldown.
  r = await b.eval(scenario([['cast'], ['wait', 100], ['wait', TICK, 'left'], ['wait', 400]]));
  t.check('W3. moving before the hit frame cancels the hit', r.damage === 0 && r.cancelled.join() === 'moved', JSON.stringify(r));
  t.check('W4. a cancelled hit refunds neither MP nor cooldown', r.mp < 41 && r.cooldown > 3000, `mp=${r.mp.toFixed(1)} cd=${r.cooldown}`);

  // Moving after the hit frame keeps the damage.
  r = await b.eval(scenario([['cast'], ['wait', 340], ['wait', 200, 'left']]));
  t.check('W5. moving after the hit frame keeps the damage', r.damage === 1 && r.cancelled.length === 0, JSON.stringify(r));

  // Target leaves melee range before impact: the hit misses.
  r = await b.eval(scenario([['cast'], ['wait', 100], ['far'], ['wait', 400]]));
  t.check('W6. target out of range at impact: no damage', r.damage === 0 && r.cancelled.join() === 'out_of_range', JSON.stringify(r));

  // Basic attack has no wind-up and is unaffected by movement right after it.
  const basic = await b.eval(`(() => {
    const w = game.scene.getScene('World'), world = w.world, p = world.player;
    w.scene.pause();
    try {
      debug.reset(); debug.setPeaceful(true); debug.clearLog();
    // Fixed rolls: always hit, never crit, so only the wind-up rules decide the outcome.
    debug.setRng(0.5);
      debug.placeMonster('slime-1', p.x, p.y + 28);
      debug.setMonsterHp('slime-1', 100000);
      debug.selectTarget('slime-1');
      w.virtualActions.press('attack'); world.update(${TICK}, null); w.virtualActions.release('attack');
      world.update(${TICK}, 'left');
      return debug.log.filter((e) => e.type === 'damage' && e.skill === 'basic_attack').length;
    } finally { w.virtualActions.release('attack'); debug.setRng(null); w.scene.resume(); }
  })()`);
  t.check('W7. basic attack still hits instantly and ignores movement', basic === 1, `damage=${basic}`);

  await b.eval('debug.reset()');
  await sleep(150);
}

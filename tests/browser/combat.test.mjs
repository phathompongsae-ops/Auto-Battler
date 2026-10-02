// Phase 3-5: targeting, attacks, skills, monster AI, death/respawn, EXP, loot.
import { sleep } from './cdp.mjs';

const PLAYER_SPAWN = { x: 640, y: 608 };

export async function combatSuite(b, t, shot) {
  const api = (expr) => b.eval(`debug.${expr}`);
  const player = () => api('player()');
  const monster = (id) => api(`monster(${JSON.stringify(id)})`);
  const events = (filter) => b.eval(`debug.log.filter(${filter})`);
  const waitMonsterState = (id, states, timeout = 4000) =>
    b.waitFor(`[${states.map((s) => `'${s}'`).join(',')}].includes(debug.monster('${id}').state) && debug.monster('${id}')`, {
      timeout,
      label: `${id} state in ${states}`,
    });

  // Common setup: peaceful, deterministic rolls (no crit, no variance), slime-1 right above the player.
  const arena = async () => {
    await api('reset()');
    await api('setPeaceful(true)');
    await api('setRng(0.5)');
    await api(`placeMonster('slime-1', ${PLAYER_SPAWN.x}, ${PLAYER_SPAWN.y - 48}, true)`);
    await sleep(150);
    await api('clearLog()');
  };

  // ------------------------------------------------------------------ targeting
  t.section('Targeting');
  await arena();
  await b.press('Tab');
  await sleep(100);
  let p = await player();
  t.check('1. Tab targets the nearby monster', p.target === 'slime-1', `target=${p.target}`);
  t.check('1b. target is highlighted', await api(`isHighlighted('slime-1')`));
  await shot('combat-01-target');

  // ------------------------------------------------------------------ basic attack
  t.section('Basic attack');
  await b.press('Space');
  await sleep(100);
  let dmg = await events(`e => e.type === 'damage' && e.source === 'player' && e.skill === 'basic_attack'`);
  let m = await monster('slime-1');
  t.check('2. basic attack damages monster', dmg.length === 1 && m.hp === 60 - dmg[0].amount, `hits=${dmg.length} hp=${m.hp} dmg=${dmg[0]?.amount}`);
  const basicDamage = dmg[0]?.amount ?? 0;

  await b.press('Space'); // still on 500 ms cooldown
  await sleep(80);
  dmg = await events(`e => e.type === 'damage' && e.source === 'player'`);
  let fails = await events(`e => e.type === 'skillFailed' && e.skill === 'basic_attack'`);
  t.check('4. attack respects cooldown (second press refused)', dmg.length === 1 && fails.some((f) => f.reason === 'cooldown'), `hits=${dmg.length} fails=${fails.map((f) => f.reason)}`);
  await sleep(450);
  await b.press('Space');
  await sleep(100);
  dmg = await events(`e => e.type === 'damage' && e.source === 'player'`);
  t.check('4b. attack works again after cooldown', dmg.length === 2, `hits=${dmg.length}`);

  await api(`placeMonster('slime-2', ${PLAYER_SPAWN.x}, ${PLAYER_SPAWN.y - 150})`);
  await api(`selectTarget('slime-2')`);
  await api('resetCooldowns()');
  await api('clearLog()');
  await b.press('Space');
  await sleep(100);
  dmg = await events(`e => e.type === 'damage' && e.source === 'player'`);
  fails = await events(`e => e.type === 'skillFailed'`);
  m = await monster('slime-2');
  t.check('3. attack respects range (out of range target untouched)', dmg.length === 0 && m.hp === 60 && fails.some((f) => f.reason === 'out_of_range'), `hits=${dmg.length} hp=${m.hp} fails=${fails.map((f) => f.reason)}`);

  // ------------------------------------------------------------------ Power Strike
  t.section('Skill 1 — Power Strike');
  await arena();
  await api(`selectTarget('slime-1')`);
  await b.press('KeyQ');
  await sleep(120);
  dmg = await events(`e => e.type === 'damage' && e.skill === 'power_strike'`);
  p = await player();
  m = await monster('slime-1');
  t.check('12. Power Strike damages target (stronger than basic)', dmg.length === 1 && m.hp < 60 && dmg[0].amount > basicDamage, `dmg=${dmg[0]?.amount} vs basic ${basicDamage}`);
  t.check('13. Power Strike spends 10 MP', p.mp >= 40 && p.mp < 41, `mp=${p.mp.toFixed(2)}`);
  await b.press('KeyQ');
  await sleep(100);
  dmg = await events(`e => e.type === 'damage' && e.skill === 'power_strike'`);
  fails = await events(`e => e.type === 'skillFailed' && e.skill === 'power_strike'`);
  t.check('14. Power Strike respects cooldown', dmg.length === 1 && fails.some((f) => f.reason === 'cooldown') && p.cooldowns.power_strike > 3500, `hits=${dmg.length} cd=${p.cooldowns.power_strike}`);

  // ------------------------------------------------------------------ insufficient MP
  t.section('Insufficient MP');
  await arena();
  await api(`selectTarget('slime-1')`);
  await api('setPlayerMp(5)');
  await b.press('KeyQ');
  await b.press('KeyE');
  await b.press('KeyR');
  await sleep(100);
  fails = await events(`e => e.type === 'skillFailed' && e.reason === 'no_mp'`);
  dmg = await events(`e => e.type === 'damage'`);
  p = await player();
  t.check(
    '18. skills fail with no_mp and cost nothing',
    fails.map((f) => f.skill).join() === 'power_strike,fire_bolt,guard' &&
      dmg.length === 0 &&
      p.mp < 5.5 &&
      Object.keys(p.cooldowns).length === 0 &&
      (await api('projectiles()')) === 0 &&
      p.statuses.length === 0,
    `fails=${fails.map((f) => f.skill)} mp=${p.mp.toFixed(2)} cds=${Object.keys(p.cooldowns)}`,
  );

  // ------------------------------------------------------------------ Fire Bolt
  t.section('Skill 2 — Fire Bolt');
  await arena();
  await api(`placeMonster('slime-1', ${PLAYER_SPAWN.x + 200}, ${PLAYER_SPAWN.y}, true)`);
  await api(`selectTarget('slime-1')`);
  await api('clearLog()');
  await b.press('KeyE');
  await sleep(60);
  const spawned = await events(`e => e.type === 'projectileSpawned' && e.skill === 'fire_bolt'`);
  const inFlight = await api('projectiles()');
  await shot('combat-02-firebolt');
  p = await player();
  t.check('16. Fire Bolt spends 12 MP', p.mp >= 38 && p.mp < 39, `mp=${p.mp.toFixed(2)}`);
  await b.waitFor(`debug.log.some(e => e.type === 'damage' && e.skill === 'fire_bolt')`, { timeout: 1500, label: 'fire bolt hit' });
  dmg = await events(`e => e.type === 'damage' && e.skill === 'fire_bolt'`);
  t.check('15. Fire Bolt projectile travels and hits target', spawned.length === 1 && inFlight === 1 && dmg.length === 1 && dmg[0].target === 'slime-1' && (await api('projectiles()')) === 0, `spawned=${spawned.length} inFlight=${inFlight} hit=${dmg[0]?.target}`);

  await api('resetCooldowns()');
  await api(`placeMonster('slime-2', ${PLAYER_SPAWN.x + 100}, ${PLAYER_SPAWN.y})`);
  await api('clearLog()');
  await b.press('KeyE');
  await b.waitFor(`debug.log.some(e => e.type === 'projectileRemoved')`, { timeout: 1500, label: 'projectile removed' });
  dmg = await events(`e => e.type === 'damage' && e.skill === 'fire_bolt'`);
  t.check('15b. Fire Bolt hits the first enemy in its path', dmg.length === 1 && dmg[0].target === 'slime-2', `hit=${dmg.map((d) => d.target)}`);

  // ------------------------------------------------------------------ Guard
  t.section('Skill 3 — Guard');
  await arena();
  const defBefore = (await player()).stats.defense;
  await b.press('KeyR');
  await sleep(100);
  p = await player();
  t.check('17. Guard applies a timed defense buff', p.statuses.includes('guard') && p.stats.defense === defBefore * 2 + 6 && p.mp >= 42 && p.mp < 43, `def ${defBefore}→${p.stats.defense} mp=${p.mp.toFixed(1)}`);
  await shot('combat-03-guard');
  await b.waitFor(`debug.log.some(e => e.type === 'statusExpired' && e.skill === 'guard')`, { timeout: 6000, label: 'guard expiry' });
  p = await player();
  t.check('17b. Guard expires and defense returns to normal', !p.statuses.includes('guard') && p.stats.defense === defBefore, `def=${p.stats.defense}`);

  // ------------------------------------------------------------------ monster death, EXP, respawn
  t.section('Monster death, EXP, respawn');
  await arena();
  await api(`selectTarget('slime-1')`);
  await api(`setMonsterHp('slime-1', 5)`);
  await b.press('Space');
  await sleep(150);
  m = await monster('slime-1');
  const deaths = await events(`e => e.type === 'death' && e.entity === 'slime-1'`);
  t.check('9. monster dies at 0 HP', m.dead && m.hp === 0 && m.state === 'dead' && deaths.length === 1, `dead=${m.dead} hp=${m.hp} state=${m.state}`);
  const exp = await events(`e => e.type === 'expGained'`);
  p = await player();
  t.check('21. monster death grants EXP', exp.length === 1 && exp[0].amount === 30 && p.exp === 30, `exp=${p.exp}`);
  p = await player();
  t.check('1c. dead target is auto-cleared', p.target === null, `target=${p.target}`);

  await api('setPeaceful(false)');
  await api('clearLog()');
  await sleep(1500);
  const deadHits = await events(`e => e.type === 'damage' && e.source === 'slime-1'`);
  m = await monster('slime-1');
  t.check('10. dead monster cannot attack', deadHits.length === 0 && m.state === 'dead', `hits=${deadHits.length} state=${m.state}`);
  await api('setPeaceful(true)');
  m = await waitMonsterState('slime-1', ['idle'], 6000);
  t.check('11. monster respawns at spawn with full HP', !m.dead && m.hp === m.maxHp && m.visible && Math.hypot(m.x - m.spawnX, m.y - m.spawnY) < 1, `hp=${m.hp} pos=(${m.x.toFixed(0)},${m.y.toFixed(0)})`);

  // Level up on the second kill (30 + 30 >= 50).
  await api('setPlayerHp(50)');
  await api('resetCooldowns()');
  await api(`selectTarget('slime-1')`);
  await api(`setMonsterHp('slime-1', 5)`);
  const statsBefore = (await player()).stats;
  await b.press('Space');
  await sleep(150);
  p = await player();
  const levelUps = await events(`e => e.type === 'levelUp'`);
  t.check('22. level-up occurs and refills HP/MP', p.level === 2 && levelUps.length === 1 && p.exp === 10 && p.hp === p.stats.maxHp && p.mp === p.stats.maxMp, `lv=${p.level} exp=${p.exp} hp=${p.hp}/${p.stats.maxHp}`);
  t.check('22b. level-up increases stats', p.stats.maxHp > statsBefore.maxHp && p.stats.attack > statsBefore.attack && p.stats.defense > statsBefore.defense, `hp ${statsBefore.maxHp}→${p.stats.maxHp} atk ${statsBefore.attack}→${p.stats.attack}`);
  await shot('combat-04-levelup');

  // ------------------------------------------------------------------ loot
  t.section('Loot');
  await arena();
  await api('setRng(0)'); // forces the 50% drop (and a crit)
  await api(`selectTarget('slime-1')`);
  await api(`setMonsterHp('slime-1', 5)`);
  await b.press('Space');
  await sleep(150);
  const drops = await api('drops()');
  t.check('23. loot drops into the world', drops.length === 1 && drops[0].item === 'slime_gel', JSON.stringify(drops));
  p = await player();
  t.check('23b. item stays on the ground until picked up', (p.inventory.slime_gel ?? 0) === 0);
  await shot('combat-05-loot');
  await b.keyDown('ArrowUp');
  await b.waitFor(`debug.drops().length === 0`, { timeout: 1500, label: 'pickup' });
  await b.keyUp('ArrowUp');
  const picked = await events(`e => e.type === 'lootPicked'`);
  p = await player();
  t.check('24. player picks up loot by walking over it', picked.length === 1);
  t.check('25. inventory count increases', p.inventory.slime_gel === 1, JSON.stringify(p.inventory));

  // ------------------------------------------------------------------ monster AI
  t.section('Monster AI');
  await api('reset()');
  await api('setRng(null)');
  await api('setPeaceful(false)');
  const home = await monster('slime-1');
  await api(`teleportPlayer(${home.spawnX + 200}, ${home.spawnY})`);
  await sleep(500);
  m = await monster('slime-1');
  t.check('5a. monster ignores player outside aggro range', m.state === 'idle', m.state);

  await api(`teleportPlayer(${home.spawnX + 130}, ${home.spawnY})`);
  m = await waitMonsterState('slime-1', ['chase', 'attack'], 1000);
  t.check('5. monster aggros when player is in range', ['chase', 'attack'].includes(m.state), m.state);
  const chaseStart = m.x;
  await sleep(300);
  m = await monster('slime-1');
  t.check('6. monster chases toward the player', m.x > chaseStart + 15, `x ${chaseStart.toFixed(0)}→${m.x.toFixed(0)}`);

  await waitMonsterState('slime-1', ['attack'], 3000);
  await b.waitFor(`debug.log.some(e => e.type === 'damage' && e.source === 'slime-1' && e.target === 'player')`, { timeout: 2500, label: 'monster hit' });
  p = await player();
  t.check('7. monster attacks the player', p.hp < p.stats.maxHp, `hp=${p.hp}/${p.stats.maxHp}`);
  await shot('combat-06-monster-attack');

  await api(`teleportPlayer(${home.spawnX + 380}, ${home.spawnY})`);
  m = await waitMonsterState('slime-1', ['return'], 1000);
  t.check('8. monster gives up beyond leash range', m.state === 'return', m.state);
  m = await waitMonsterState('slime-1', ['idle'], 6000);
  t.check('8b. monster walks home and resets HP', Math.hypot(m.x - m.spawnX, m.y - m.spawnY) < 6 && m.hp === m.maxHp, `dist=${Math.hypot(m.x - m.spawnX, m.y - m.spawnY).toFixed(1)}`);

  // ------------------------------------------------------------------ player death
  t.section('Player death and respawn');
  await api(`teleportPlayer(${home.spawnX + 100}, ${home.spawnY})`);
  await api('setPlayerHp(5)');
  await b.waitFor(`debug.player().dead`, { timeout: 8000, label: 'player death' });
  p = await player();
  t.check('19. player can die', p.dead && p.hp === 0 && p.state === 'dead' && p.respawnAt !== null);
  await shot('combat-07-dead');

  await api('clearLog()');
  const deadPos = { x: p.x, y: p.y };
  await b.press('Space');
  await b.press('KeyQ');
  await b.keyDown('ArrowRight');
  await sleep(300);
  await b.keyUp('ArrowRight');
  const usedWhileDead = await events(`e => (e.type === 'skillUsed' || e.type === 'damage') && e.source === 'player'`);
  p = await player();
  t.check('19b. dead player cannot attack or move', usedWhileDead.length === 0 && p.x === deadPos.x && p.y === deadPos.y, `actions=${usedWhileDead.length}`);
  m = await waitMonsterState('slime-1', ['return', 'idle'], 2000);
  t.check('19c. monster stops attacking a dead player', ['return', 'idle'].includes(m.state), m.state);

  await b.waitFor(`!debug.player().dead`, { timeout: 4000, label: 'player respawn' });
  p = await player();
  t.check('20. player respawns at spawn with full HP/MP', p.hp === p.stats.maxHp && p.mp === p.stats.maxMp && p.x === PLAYER_SPAWN.x && p.y === PLAYER_SPAWN.y && p.state === 'idle', `pos=(${p.x},${p.y}) hp=${p.hp}`);

  // ------------------------------------------------------------------ click/tap targeting
  t.section('Pointer targeting');
  await arena();
  await sleep(500); // camera settle
  const screen = await b.eval(`(() => { const w = game.scene.getScene('World'); const m = w.world.monsters.find(m => m.id === 'slime-1'); const c = w.cameras.main; return { x: m.x - c.worldView.x, y: m.y - c.worldView.y }; })()`);
  await b.mouse('mousePressed', screen.x, screen.y);
  await b.mouse('mouseReleased', screen.x, screen.y);
  await sleep(100);
  p = await player();
  t.check('1d. clicking a monster targets it', p.target === 'slime-1', `target=${p.target}`);
}

/** Frame timing during a busy fight: all monsters chasing, skills firing. */
export async function combatPerformance(b, t) {
  t.section('Performance during combat');
  await b.eval('debug.reset(); debug.setRng(null); debug.setPeaceful(false)');
  await b.eval(`(() => { const ids = ['slime-1','slime-2','slime-3','slime-4']; ids.forEach((id, i) => debug.placeMonster(id, 560 + i * 50, 520, true)); })()`);
  await b.keyDown('Space');
  const fight = (async () => {
    for (let i = 0; i < 6; i++) {
      await b.eval('debug.resetCooldowns(); debug.setPlayerMp(50); debug.setPlayerHp(9999)');
      await b.press('KeyQ');
      await b.press('KeyE');
      await b.press('KeyR');
      await sleep(400);
    }
  })();
  const stats = await b.eval(`new Promise((resolve) => {
    const deltas = []; let last = performance.now(); const t0 = last;
    const tick = (now) => { deltas.push(now - last); last = now;
      if (now - t0 < 3000) requestAnimationFrame(tick);
      else { const sorted = [...deltas].sort((a, b) => a - b);
        resolve({ frames: deltas.length, fps: deltas.length / ((now - t0) / 1000), phaserFps: game.loop.actualFps,
          p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1],
          over20: deltas.filter(d => d > 20).length }); } };
    requestAnimationFrame(tick);
  })`);
  await fight;
  await b.keyUp('Space');
  console.log(`  FPS ${stats.fps.toFixed(1)} (Phaser ${stats.phaserFps.toFixed(1)}), frame p95 ${stats.p95.toFixed(1)} ms, max ${stats.max.toFixed(1)} ms, frames >20ms: ${stats.over20}/${stats.frames}`);
  t.check('perf. steady frame rate during first fight (≥55 FPS, p95 < 20 ms)', stats.fps >= 55 && stats.p95 < 20, `fps=${stats.fps.toFixed(1)} p95=${stats.p95.toFixed(1)}`);
  t.check('perf. no hitches during first fight (worst frame < 50 ms)', stats.max < 50, `max=${stats.max.toFixed(1)} ms, >20ms: ${stats.over20}`);
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  return stats;
}

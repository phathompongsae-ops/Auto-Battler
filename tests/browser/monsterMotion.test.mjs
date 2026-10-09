// Monster motion (Visual Production Pass 3): production monster art walks, winds up, lunges and recoils,
// but every pose is presentation only. The physics body must stay exactly where the placeholder put it:
// 20x12 x tier scale, from (-10, +2) x scale relative to the monster's position, every frame.
import { sleep } from './cdp.mjs';

const WORLD = `game.scene.getScene('World').world`;

export async function monsterMotionSuite(b, t, shot) {
  t.section('Monster motion (presentation only)');
  await b.eval(`debug.reset(); debug.setPeaceful(true); debug.setRng(0.5);
    const wolf = debug.monster('wolf-1'); debug.teleport(wolf.spawnX, wolf.spawnY + 90);
    debug.setPlayerHp(99999); true`);
  await sleep(300);
  // Stay inside the actual Wolf Den: moving the fixture outside its encounter suppresses aggro.
  await b.eval(`debug.setPeaceful(false); true`);
  await b.eval(`window.__motion = []; window.__motionTick = () => {
    for (const id of ['wolf-1', 'elite_boar-1']) {
      const m = ${WORLD}.monsterById(id); if (!m || m.combat.dead) continue;
      const k = m.def.scale ?? 1;
      window.__motion.push({ id, body: [m.body.x - m.x + 10 * k, m.body.y - m.y - 2 * k, m.body.width - 20 * k, m.body.height - 12 * k],
        posed: m.rotation !== 0 || Math.abs(m.displayOriginY - m.height * m.originY) > 0.01, speed: Math.hypot(m.body.velocity.x, m.body.velocity.y) });
    }
  }; game.scene.getScene('World').events.on('postupdate', window.__motionTick); true`);
  await sleep(2500);
  await shot('motion-01-fight');
  await sleep(1500);
  const samples = await b.eval(`(() => { game.scene.getScene('World').events.off('postupdate', window.__motionTick); return window.__motion; })()`);
  await b.eval(`debug.setPeaceful(true); true`);
  const drift = Math.max(0, ...samples.flatMap((s) => s.body.map(Math.abs)));
  const posedWolf = samples.filter((s) => s.id === 'wolf-1' && s.posed).length;
  const movingWolf = samples.filter((s) => s.id === 'wolf-1' && s.speed > 6).length;
  t.check('MM-1. every frame of a real chase and fight keeps each monster body at its exact world rectangle (pose never moves physics)',
    samples.length > 100 && drift < 0.001, JSON.stringify({ samples: samples.length, drift }));
  t.check('MM-2. production monsters are posed while they move and fight (walk bob / lean, wind-up, lunge, recoil), not sliding stickers',
    movingWolf > 5 && posedWolf > 10, JSON.stringify({ movingWolf, posedWolf }));

  // A dead monster drops its pose (the death squash starts from rest) and respawns at rest.
  await b.eval(`debug.defeatMonster('wolf-1'); true`);
  await sleep(100);
  const dead = await b.eval(`(() => { const m = ${WORLD}.monsterById('wolf-1'); return { rotation: m.rotation, originDelta: Math.abs(m.displayOriginY - m.height * m.originY) }; })()`);
  t.check('MM-3. death clears the pose before the squash / fade', dead.rotation === 0 && dead.originDelta < 0.01, JSON.stringify(dead));
  await b.eval(`debug.reset(); debug.setPeaceful(true); true`);
}

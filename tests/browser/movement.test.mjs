// Phase 2 regression: movement, 4-direction input, collision, camera, drag input.
import { sleep } from './cdp.mjs';

const PLAYER_STATE = `(() => {
  const g = window.game, w = g.scene.getScene('World'), p = w.player, c = w.cameras.main;
  return { x: p.x, y: p.y, vx: p.body.velocity.x, vy: p.body.velocity.y, state: p.state, facing: p.facing,
    anim: p.anims.currentAnim && p.anims.currentAnim.key, animPlaying: p.anims.isPlaying,
    camX: c.scrollX, camY: c.scrollY,
    bodyLeft: p.body.left, bodyRight: p.body.right, bodyTop: p.body.top, bodyBottom: p.body.bottom };
})()`;

export async function movementSuite(b, t, shot) {
  const state = () => b.eval(PLAYER_STATE);
  const hold = async (code, ms) => {
    await b.keyDown(code);
    await sleep(ms);
    const s = await state();
    await b.keyUp(code);
    return s;
  };

  t.section('Movement / collision / camera (Phase 2 regression)');
  await b.eval('debug.reset(); debug.setPeaceful(true)');
  await sleep(800); // camera settle

  let s = await state();
  t.check('starts idle facing down', s.state === 'idle' && s.facing === 'down' && s.anim === 'player-idle-down', `${s.state}/${s.facing}/${s.anim}`);
  t.check('starts with zero velocity', s.vx === 0 && s.vy === 0);
  await shot('movement-01-idle');

  const start = await state();
  s = await hold('ArrowRight', 1000);
  const dx = s.x - start.x;
  t.check('ArrowRight walks right with walk animation', s.state === 'walk' && s.facing === 'right' && s.anim === 'player-walk-right' && s.animPlaying, `${s.state}/${s.facing}/${s.anim}`);
  t.check('moves ~160 px/s horizontally only', dx > 130 && dx < 190 && Math.abs(s.y - start.y) < 0.01 && s.vy === 0, `dx=${dx.toFixed(1)}`);
  await sleep(100);
  s = await state();
  t.check('releasing key returns to idle', s.state === 'idle' && s.vx === 0 && s.vy === 0 && s.anim === 'player-idle-right', `${s.state}/${s.anim}`);

  for (const [code, dir] of [['KeyW', 'up'], ['KeyA', 'left'], ['KeyS', 'down'], ['KeyD', 'right']]) {
    const before = await state();
    s = await hold(code, 300);
    const moved = { up: before.y - s.y, down: s.y - before.y, left: before.x - s.x, right: s.x - before.x }[dir];
    t.check(`${code} walks ${dir}`, s.facing === dir && s.state === 'walk' && moved > 30, `moved=${moved.toFixed(1)}`);
    await sleep(60);
  }

  await b.keyDown('KeyD');
  await sleep(200);
  await b.keyDown('KeyW');
  await sleep(200);
  s = await state();
  t.check('D then W held: moves up only (no diagonal)', s.facing === 'up' && s.vx === 0 && s.vy < 0, `vx=${s.vx} vy=${s.vy}`);
  await b.keyUp('KeyW');
  await sleep(150);
  s = await state();
  t.check('release W while D held: back to right', s.facing === 'right' && s.vx > 0 && s.vy === 0, `vx=${s.vx} vy=${s.vy}`);
  await b.keyUp('KeyD');
  await sleep(100);

  s = await hold('ArrowLeft', 6000);
  t.check('stops at left wall', s.bodyLeft >= 31.5 && s.bodyLeft < 40, `bodyLeft=${s.bodyLeft.toFixed(1)}`);
  t.check('camera clamped at left edge', s.camX === 0, `camX=${s.camX}`);
  s = await hold('ArrowUp', 6000);
  t.check('stops at top wall', s.bodyTop >= 31.5 && s.bodyTop < 40, `bodyTop=${s.bodyTop.toFixed(1)}`);
  t.check('camera clamped at top edge', s.camY === 0, `camY=${s.camY}`);
  s = await hold('ArrowDown', 7000);
  t.check('stops at bottom wall', s.bodyBottom <= 928.5 && s.bodyBottom > 920, `bodyBottom=${s.bodyBottom.toFixed(1)}`);
  t.check('camera clamped at bottom edge', Math.abs(s.camY - 420) < 1, `camY=${s.camY.toFixed(1)}`);
  s = await hold('ArrowRight', 9000);
  t.check('stops at right wall', s.bodyRight <= 1248.5 && s.bodyRight > 1240, `bodyRight=${s.bodyRight.toFixed(1)}`);
  t.check('camera clamped at right edge', Math.abs(s.camX - 320) < 1, `camX=${s.camX.toFixed(1)}`);
  await shot('movement-02-corner');

  await hold('ArrowUp', 2200);
  await hold('ArrowLeft', 3000);
  await sleep(800);
  s = await state();
  const sx = s.x - s.camX;
  const sy = s.y - s.camY;
  t.check('camera follows player (player near screen centre)', Math.abs(sx - 480) < 40 && Math.abs(sy - 270) < 40, `screen=(${sx.toFixed(0)}, ${sy.toFixed(0)})`);

  await b.eval('debug.teleportPlayer(30 * 32 + 16, 12 * 32 + 16)');
  await sleep(100);
  s = await hold('ArrowUp', 2000);
  t.check('water tiles block movement', s.y > 320, `y=${s.y.toFixed(1)}`);

  await b.eval('debug.reset()');
  await sleep(300);
}

/** Drag-to-move via a pointer (mouse or touch). Leaves the player idle. */
export async function dragSuite(b, t, label, input) {
  const state = () => b.eval(PLAYER_STATE);
  const start = await state();
  await input('start', 480, 300);
  await sleep(50);
  await input('move', 490, 302);
  await sleep(150);
  let s = await state();
  t.check(`${label}: drag inside dead zone does not move`, s.state === 'idle', s.state);
  await input('move', 420, 305);
  await sleep(500);
  s = await state();
  t.check(`${label}: drag left walks left`, s.state === 'walk' && s.facing === 'left' && s.x < start.x - 40, `${s.state}/${s.facing} dx=${(s.x - start.x).toFixed(1)}`);
  await input('move', 425, 380);
  await sleep(300);
  s = await state();
  t.check(`${label}: dominant drag axis wins (down)`, s.facing === 'down' && s.vx === 0 && s.vy > 0, `${s.facing} vx=${s.vx} vy=${s.vy}`);
  await input('end', 425, 380);
  await sleep(100);
  s = await state();
  t.check(`${label}: release stops`, s.state === 'idle' && s.vx === 0 && s.vy === 0, s.state);
}

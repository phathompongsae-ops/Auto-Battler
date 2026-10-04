// Class 1 presentation in the running game: each job is drawn with its own art, and the
// feet / body centre stay put across idle, walk and attack in all four facings.
// Plus the mobile dynamic floating joystick (touch emulation).
import { sleep } from './cdp.mjs';

const CLASSES = ['warrior', 'archer', 'mage', 'cleric', 'ninja'];
const DIRS = ['down', 'up', 'right', 'left'];

/**
 * In-page helper: for every frame of every player animation in every facing,
 * where the feet (lowest row with >= 12 opaque px) and the body centre (mean x
 * of the last 4 rows, counting only runs >= 6 px wide, i.e. the boots: thin staffs, bow tips and blades are left out) land in world space, using the sprite's own
 * scale / origin / flip exactly as the renderer applies them.
 */
const MEASURE = `(() => {
  const w = game.scene.getScene('World'), p = w.player;
  const cache = (window.__frameCache ??= new Map());
  const pixels = (frame) => {
    const k = frame.texture.key + ':' + frame.name;
    if (cache.has(k)) return cache.get(k);
    const c = document.createElement('canvas'); c.width = frame.cutWidth; c.height = frame.cutHeight;
    const g = c.getContext('2d');
    g.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
    const d = g.getImageData(0, 0, c.width, c.height); cache.set(k, d); return d;
  };
  const anchor = (frame) => {
    const d = pixels(frame), W = d.width, H = d.height, a = (x, y) => d.data[(y * W + x) * 4 + 3] > 0;
    let feet = -1;
    for (let y = H - 1; y >= 0 && feet < 0; y--) { let n = 0; for (let x = 0; x < W; x++) if (a(x, y)) n++; if (n >= 12) feet = y; }
    let sx = 0, n = 0;
    for (let y = feet - 3; y <= feet; y++) for (let x = 0; x < W;) { if (!a(x, y)) { x++; continue; } let e = x; while (e < W && a(e, y)) e++; if (e - x >= 6) for (let k = x; k < e; k++) { sx += k + 0.5; n++; } x = e; }
    return { feet, cx: sx / n };
  };
  const out = [];
  w.scene.pause();
  for (const dir of ${JSON.stringify(DIRS)}) {
    for (const name of ['idle', 'walk', 'attack']) {
      const key = 'player-' + name + '-' + dir;
      if (!w.anims.exists(key)) continue;
      p.playAnim(name, dir, false);
      const frames = w.anims.get(key).frames;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i].frame;
        p.setFrame(f.name);
        const { feet, cx } = anchor(f);
        const flip = p.flipX ? -1 : 1;
        out.push({ dir, name, i,
          feetY: p.y + ((feet + 1) - p.originY * f.height) * p.scaleY,
          cx: p.x + flip * (cx - p.originX * f.width) * p.scaleX });
      }
    }
  }
  w.scene.resume();
  p.playAnim('idle', 'down', false);
  return { tex: p.texture.key, out };
})()`;

async function becomeClass(b, job) {
  await b.eval(`debug.reset(); debug.setPeaceful(true)`);
  await sleep(120);
  if (job !== 'novice') {
    const r = await b.eval(`(debug.setLevel(11), debug.forceChangeJob('${job}'))`);
    if (!r.ok) throw new Error(`job change to ${job} failed: ${JSON.stringify(r)}`);
  }
  await sleep(150); // the scene swaps art on its next frame
}

export async function classArtSuite(b, t, shot) {
  t.section('Class 1 art in the running game');

  await becomeClass(b, 'novice');
  const novice = await b.eval(`game.scene.getScene('World').player.texture.key`);
  t.check('C-0. a Novice still uses the (temporary) Warrior sprites', novice.startsWith('warrior-'), novice);

  const summary = {};
  for (const job of CLASSES) {
    await becomeClass(b, job);
    const info = await b.eval(`(() => { const p = game.scene.getScene('World').player;
      return { tex: p.texture.key, art: p.currentArt.displayName, portrait: document.querySelector('[data-hud=portrait]').dataset.art,
        bg: document.querySelector('[data-hud=portrait]').style.backgroundImage, job: document.querySelector('[data-hud=job]').textContent }; })()`);
    t.check(`C-1 ${job}. drawn with its own sprites, portrait and name`,
      info.tex.startsWith(`${job}-`) && info.portrait === job && info.bg.includes(`/${job}/`) && info.job.toLowerCase() === job,
      JSON.stringify(info));

    if (shot) await shot('class-' + job);
    const m = await b.eval(MEASURE);
    const byDir = {};
    for (const r of m.out) (byDir[r.dir] ??= []).push(r);
    let worstFeet = 0, worstCx = 0, worstDir = '';
    const rows = [];
    for (const [dir, list] of Object.entries(byDir)) {
      // Rest pose = idle frame 0; compare every idle / attack frame and the walk's planted-foot frames to it.
      const rest = list.find((r) => r.name === 'idle' && r.i === 0);
      const span = (k, f) => Math.max(...list.filter(f).map((r) => Math.abs(r[k] - rest[k])));
      const feet = Math.max(span('feetY', (r) => r.name !== 'walk'), span('feetY', (r) => r.name === 'walk'));
      // Walk: the cycle's average position (single frames are mid-stride by design); attack: its first frame (starts from rest).
      const walk = list.filter((r) => r.name === 'walk');
      const walkMean = walk.reduce((a, r) => a + r.cx, 0) / walk.length;
      const attack0 = list.find((r) => r.name === 'attack' && r.i === 0);
      const cx = Math.max(Math.abs(walkMean - rest.cx), attack0 ? Math.abs(attack0.cx - rest.cx) : 0);
      rows.push(`${dir}: feet±${feet.toFixed(2)} cx±${cx.toFixed(2)}`);
      if (feet > worstFeet) { worstFeet = feet; worstDir = dir; }
      worstCx = Math.max(worstCx, cx);
    }
    summary[job] = { feet: +worstFeet.toFixed(2), cx: +worstCx.toFixed(2) };
    // World pixels (the character is ~40 px tall). Walk frames include the stepping foot, hence the 2 px allowance.
    t.check(`C-2 ${job}. feet stay planted across idle / walk / attack in all 4 facings (≤ 2 px)`, worstFeet <= 2, `${rows.join(' | ')} worst=${worstDir}`);
    t.check(`C-3 ${job}. body centre does not jump idle -> walk / attack, incl. mirrored West (≤ 3 px)`, worstCx <= 3, rows.join(' | '));
  }

  // The basic-attack animation plays (the same call the scene makes on skillUsed) and returns to idle.
  await becomeClass(b, 'ninja');
  const before = await b.eval(`game.scene.getScene('World').player.texture.key`);
  t.check('C-4. job change swaps the sprite set without a reload', before.startsWith('ninja-'), before);
  const mid = await b.eval(`(() => { const p = game.scene.getScene('World').player; p.playSkillAction('basic_attack');
    return { anim: p.anims.currentAnim.key, tex: p.texture.key, fps: p.anims.currentAnim.frameRate, frames: p.anims.currentAnim.frames.length }; })()`);
  await sleep(700);
  const after = await b.eval(`(() => { const p = game.scene.getScene('World').player; return { anim: p.anims.currentAnim.key, action: p.action }; })()`);
  t.check('C-6. Ninja basic attack plays its own 8-frame strip at 20 fps, then returns to idle',
    mid.anim === 'player-attack-down' && mid.tex.startsWith('ninja-attack') && mid.fps === 20 && mid.frames === 8 && after.anim === 'player-idle-down' && after.action === null,
    JSON.stringify({ mid, after }));
  await b.eval(`debug.reset()`);
  await sleep(150);
  const back = await b.eval(`game.scene.getScene('World').player.texture.key`);
  t.check('C-5. a reset back to Novice swaps back to the fallback art', back.startsWith('warrior-'), back);
  return summary;
}

/** Touch-only: the dynamic floating joystick. Run with touch emulation on (960x540 viewport). */
export async function floatingJoystickSuite(b, t, shot) {
  t.section('Mobile dynamic floating joystick');
  await b.eval(`debug.reset(); debug.setPeaceful(true)`);
  await sleep(150);
  const PS = `(() => { const p = game.scene.getScene('World').player; return { x: p.x, y: p.y, vx: p.body.velocity.x, vy: p.body.velocity.y, state: p.state, facing: p.facing }; })()`;
  const joy = `(() => { const el = document.querySelector('[data-hud=joystick]'), base = el.querySelector('.hud-joystick__base');
    const r = base.getBoundingClientRect(); return { active: el.dataset.active, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`;
  const touch = (type, points) => b.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const pt = (id, x, y) => ({ id, x, y });

  // 1. A touch on the right half does not spawn the stick (or move).
  await touch('touchStart', [pt(1, 700, 300)]);
  await touch('touchMove', [pt(1, 650, 300)]);
  await sleep(150);
  let j = await b.eval(joy), s = await b.eval(PS);
  await touch('touchEnd', []);
  t.check('J-1. touches outside the left zone do not create the joystick', j.active === 'false' && s.state === 'idle', JSON.stringify({ j, state: s.state }));

  // 2. A touch in the left zone spawns the base exactly there.
  await touch('touchStart', [pt(1, 220, 330)]);
  await sleep(80);
  j = await b.eval(joy);
  t.check('J-2. the joystick base appears where the finger touched', j.active === 'true' && Math.abs(j.cx - 220) <= 2 && Math.abs(j.cy - 330) <= 2, JSON.stringify(j));

  // 3. Diagonal drag moves diagonally; the sprite faces the dominant axis.
  await touch('touchMove', [pt(1, 270, 360)]);
  await sleep(250);
  s = await b.eval(PS);
  t.check('J-3. dragging diagonally moves diagonally (4-direction facing)', s.state === 'walk' && s.vx > 0 && s.vy > 0 && s.facing === 'right', JSON.stringify(s));
  await shot('joystick-01-diagonal');

  // 4. A second finger elsewhere in the zone does not steal the stick.
  await touch('touchStart', [pt(1, 270, 360), pt(2, 120, 200)]);
  await sleep(100);
  j = await b.eval(joy); s = await b.eval(PS);
  t.check('J-4. a second touch does not move or steal the joystick', j.active === 'true' && Math.abs(j.cx - 220) <= 2 && s.vx > 0 && s.vy > 0, JSON.stringify({ j, s }));
  // CDP: touchEnd releases every finger, so lift only finger 2 with a move that omits it.
  await touch('touchMove', [pt(1, 270, 360)]);
  await sleep(80);
  j = await b.eval(joy);
  t.check('J-5. lifting the other finger keeps the joystick', j.active === 'true', j.active);

  // 5. Releasing the owning finger hides it and stops.
  await touch('touchEnd', []);
  await sleep(120);
  j = await b.eval(joy); s = await b.eval(PS);
  t.check('J-6. releasing the owning finger hides the joystick and stops', j.active === 'false' && s.state === 'idle' && s.vx === 0 && s.vy === 0, JSON.stringify({ j, s }));

  // 6. The next touch can create it somewhere else.
  await touch('touchStart', [pt(3, 120, 440)]);
  await sleep(80);
  j = await b.eval(joy);
  await touch('touchMove', [pt(3, 120, 400)]);
  await sleep(200);
  s = await b.eval(PS);
  await touch('touchEnd', []);
  t.check('J-7. the next touch places the joystick at the new point', j.active === 'true' && Math.abs(j.cx - 120) <= 2 && Math.abs(j.cy - 440) <= 2 && s.facing === 'up' && s.vy < 0, JSON.stringify({ j, s }));

  // 7. Tiny drags stay inside the dead zone.
  await touch('touchStart', [pt(4, 200, 300)]);
  await touch('touchMove', [pt(4, 208, 305)]);
  await sleep(150);
  s = await b.eval(PS);
  await touch('touchEnd', []);
  t.check('J-8. drags inside the dead zone do not move', s.state === 'idle', s.state);

  // 8. Near-diagonal movement does not flicker between facings (hysteresis).
  await touch('touchStart', [pt(5, 200, 300)]);
  await touch('touchMove', [pt(5, 260, 300)]); // right
  await sleep(150);
  const facings = [];
  for (let k = 0; k < 8; k++) {
    // wobble around 45° (±3°)
    const ang = ((k % 2 ? 47 : 43) * Math.PI) / 180;
    await touch('touchMove', [pt(5, 200 + 60 * Math.cos(ang), 300 + 60 * Math.sin(ang))]);
    await sleep(60);
    facings.push((await b.eval(PS)).facing);
  }
  await touch('touchEnd', []);
  await sleep(100);
  t.check('J-9. wobbling around a diagonal keeps one facing (no flicker)', new Set(facings).size === 1, facings.join(','));
}

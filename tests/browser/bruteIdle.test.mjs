// Skeleton Brute production idle review (176x144 contract, still `pending`). The staged idle strip
// (art-source/monsters/crypt_brute/idle.png) is loaded through the test-only review fixture: the real idle
// replaces the idle stand-in, the four states without approved art keep the code-drawn fixture boxes.
// Checks the real runtime path at rest: texture, facing / mirroring, anchored feet, no procedural motion,
// shadow and body unchanged from the fallback, and Bone Smash timing unchanged.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;
const ID = 'crypt_brute-1';
const STAGED = join(process.cwd(), 'art-source', 'monsters', 'crypt_brute', 'idle.png');

/** Sprite, body and shadow geometry of the Brute, relative to its position (world px). */
const geometry = (b) => b.eval(`(() => { const m = ${S}.world.monsterById('${ID}'), k = m.def.scale ?? 1;
  // World y of the art's feet row (frame row 0 sits at y - displayOriginY * scale).
  const feetRow = m.strips ? 142 : null;
  return { tex: m.texture.key, frame: m.frame.name, strips: !!m.strips, tint: m.tintTopLeft, flip: m.flipX, scale: [m.scaleX, m.scaleY], rot: m.rotation,
    origin: [m.originX, m.originY], displayOrigin: [m.displayOriginX, m.displayOriginY], cell: [m.frame.width, m.frame.height],
    feetY: feetRow === null ? null : (feetRow - m.displayOriginY) * m.scaleY,
    body: [m.body.x - m.x, m.body.y - m.y, m.body.width, m.body.height], hitRadius: m.hitRadius, speed: m.def.stats.moveSpeed,
    shadow: [0, 13 * k, 22 * k, 7 * k], zoom: ${S}.cameras.main.zoom }; })()`);
const near = (a, z, eps = 1e-6) => a.length === z.length && a.every((v, i) => Math.abs(v - z[i]) < eps);

/** Bone Smash cast directly on the player (as the dodge suite does): wind-up -> impact delay and damage from the log. */
async function boneSmash(b) {
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(200);
  const m = await b.eval(`debug.monster('${ID}')`);
  await b.eval(`debug.teleport(${m.spawnX}, ${m.spawnY}); debug.setPlayerHp(999999); debug.setRng(0.5); debug.clearLog(); debug.setPeaceful(false);
    (() => { const w = ${S}.world, mon = w.monsterById('${ID}'); mon.body.reset(w.player.x, w.player.y); w.skills.use(mon, 'brute_smash_story', w.now); })(); true`);
  await b.waitFor(`debug.log.some(e => e.type === 'damage' && e.skill === 'brute_smash_story')`, { timeout: 4000, label: 'Bone Smash impact' }).catch(() => {});
  await b.eval(`debug.setPeaceful(true); true`);
  return b.eval(`(() => { const l = debug.log, w = l.find(e => e.type === 'skillWindup' && e.skill === 'brute_smash_story'), d = l.find(e => e.type === 'damage' && e.skill === 'brute_smash_story');
    return { impactDelay: w && d ? d.t - w.t : null, damage: d?.amount ?? null, log: d ? undefined : l.slice(-8) }; })()`);
}

export async function bruteIdleSuite(b, t, shot) {
  t.section('Skeleton Brute production idle (staged, contract pending)');

  // Fallback first: the tinted Skeleton sheet with procedural motion.
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(250);
  const fallback = await geometry(b);
  const smashBefore = await boneSmash(b);

  const url = `data:image/png;base64,${readFileSync(STAGED).toString('base64')}`;
  const installed = await b.eval(`debug.installMonsterAnimReview('crypt_brute', { idle: '${url}' })`);
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(250);
  const m = await b.eval(`debug.monster('${ID}')`);
  // Stand the player off to the side so the camera frames the Brute without provoking it.
  await b.eval(`debug.teleport(${m.spawnX - 70}, ${m.spawnY + 10}); true`);
  await sleep(300);
  const rest = await geometry(b);
  t.check('BI-1. staged idle loads at the exact contract size (2 x 176 by 144) through the real resolver, untinted, at camera zoom 1.65',
    installed === true && rest.strips && rest.tex === 'monster-anim-crypt_brute-idle' && near(rest.cell, [176, 144]) && rest.tint === 0xffffff && rest.zoom === 1.65,
    JSON.stringify({ installed, tex: rest.tex, cell: rest.cell, tint: rest.tint, zoom: rest.zoom }));
  t.check('BI-2. world body, hit radius, move speed and shadow are identical to the fallback (the bigger cell changes no gameplay geometry)',
    near(rest.body, fallback.body) && rest.hitRadius === fallback.hitRadius && rest.speed === fallback.speed && near(rest.shadow, fallback.shadow),
    JSON.stringify({ fallback: fallback.body, real: rest.body, hitRadius: [fallback.hitRadius, rest.hitRadius] }));
  // Feet row lands on the shadow line: MONSTER_FEET_OFFSET * k below the position, as for every production sheet.
  t.check('BI-3. drawn at exactly 0.5, origin on the cell centre and the feet row (feet on the shadow)',
    near(rest.scale, [0.5, 0.5]) && rest.origin[0] === 0.5 && near(rest.displayOrigin, [88, rest.displayOrigin[1]]) && rest.feetY !== null && Math.abs(rest.feetY - rest.shadow[1]) < 1e-6,
    JSON.stringify({ scale: rest.scale, origin: rest.origin, displayOrigin: rest.displayOrigin, feetY: rest.feetY, shadowY: rest.shadow[1] }));

  // Idle over ~2 s: both frames shown, nothing moves (no procedural bob / lean / scale on real strips).
  const samples = [];
  for (let i = 0; i < 20; i++) { samples.push(await geometry(b)); await sleep(100); }
  const frames = new Set(samples.map((s) => String(s.frame)));
  t.check('BI-4. idle cycles both frames with no procedural motion: rotation 0, scale 0.5, origin and body fixed',
    frames.size === 2 && samples.every((s) => s.tex === rest.tex && s.rot === 0 && near(s.scale, [0.5, 0.5]) && near(s.displayOrigin, rest.displayOrigin) && near(s.body, rest.body)),
    JSON.stringify({ frames: [...frames], samples: samples.length }));

  // Mirroring: flipX about the cell-centre origin. Both facings keep position, origin and body.
  const cam = await b.eval(`(() => { const c = ${S}.cameras.main, mm = ${S}.world.monsterById('${ID}');
    return { x: (mm.x - c.worldView.x) * c.zoom, y: (mm.y - c.worldView.y) * c.zoom }; })()`);
  const clip = (c) => ({ x: Math.max(0, Math.round(c.x - 110)), y: Math.max(0, Math.round(c.y - 150)), width: 220, height: 190 });
  const facing = {};
  for (const flip of [false, true]) {
    await b.eval(`${S}.world.monsterById('${ID}').setFlipX(${flip}); true`);
    await sleep(120);
    facing[flip ? 'west' : 'east'] = await geometry(b);
    for (const [w, h] of [[960, 540], [844, 390], [640, 360]]) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await sleep(200);
      // Game px -> CSS px through the canvas rect (the scale manager fits the canvas to the viewport).
      const c = await b.eval(`(() => { const c = ${S}.cameras.main, mm = ${S}.world.monsterById('${ID}'), r = game.canvas.getBoundingClientRect(), k = r.width / game.scale.width;
        return { x: r.x + (mm.x - c.worldView.x) * c.zoom * k, y: r.y + (mm.y - c.worldView.y) * c.zoom * k, zoom: c.zoom }; })()`);
      await shot(`brute-idle-${flip ? 'west' : 'east'}-${w}x${h}`, clip(c));
    }
    await b.setViewport({ mobile: false });
    await sleep(150);
  }
  t.check('BI-5. source faces east; mirroring to west keeps the position, origin, feet row and body (no horizontal jump of the anchor)',
    facing.east.flip === false && facing.west.flip === true && near(facing.east.displayOrigin, facing.west.displayOrigin) &&
      near(facing.east.body, facing.west.body) && facing.east.feetY === facing.west.feetY,
    JSON.stringify({ east: facing.east.displayOrigin, west: facing.west.displayOrigin, camera: cam }));

  // Bone Smash: same wind-up and impact delay with the staged art as with the fallback.
  const smashAfter = await boneSmash(b);
  t.check('BI-6. Bone Smash gameplay unchanged: 1400 ms wind-up -> impact delay and damage as the fallback',
    // The impact lands on the first simulation tick at or after the 1400 ms wind-up (within one 60 Hz frame).
    [smashBefore, smashAfter].every((r) => r.impactDelay !== null && r.impactDelay >= 1400 && r.impactDelay < 1400 + 1000 / 60) && smashBefore.damage === smashAfter.damage,
    JSON.stringify({ before: smashBefore, after: smashAfter }));

  await b.eval(`debug.removeMonsterAnimFixture('crypt_brute'); debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(250);
  const after = await geometry(b);
  t.check('BI-7. removing the review restores the tinted Skeleton fallback with its original body',
    !after.strips && after.tex === fallback.tex && after.tint === fallback.tint && near(after.body, fallback.body), JSON.stringify(after));
}

// Grove Guardian production animation strips (Visual Pass 4B, contract `integrated`): the real five-strip
// set on the normal runtime path, real Field fights on both facings, root / body / shadow stability,
// Stomp timing and Dodge through real damage, death, the missing-strip fallback and viewports.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;
const ID = 'grove_guardian-1';
const STATES = { idle: 2, walk: 8, attack: 5, special: 10, hit: 3 };
/** Reset the Field, then wait for the simulation to step: bodies follow their sprites only from the next physics step. */
async function freshField(b) {
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); window.__t0 = ${S}.world.now; true`);
  await b.waitFor(`${S}.world.now > window.__t0 + 200`, { timeout: 8000, label: 'simulation steps after reset' });
}
const near = (a, z, eps = 1e-6) => a.length === z.length && a.every((v, i) => Math.abs(v - z[i]) < eps);

/** Texture, tint, body (relative to the position), hit radius, move speed and shadow (from the tier scale) of the Guardian. */
const look = (b) => b.eval(`(() => { const m = ${S}.world.monsterById('${ID}'), k = m.def.scale ?? 1;
  return { tex: m.texture.key, strips: !!m.strips, tint: m.tintTopLeft, scale: [m.scaleX, m.scaleY], origin: [m.originX, m.originY],
    displayOrigin: [m.displayOriginX, m.displayOriginY], feetY: m.strips ? (158 - m.displayOriginY) * m.scaleY : null,
    body: [m.body.x - m.x, m.body.y - m.y, m.body.width, m.body.height], hitRadius: m.hitRadius, speed: m.def.stats.moveSpeed,
    shadow: [0, 13 * k, 22 * k, 7 * k] }; })()`);

/** Stomp cast on the player: wind-up -> impact delay and damage (dodge: Shift at 850 ms, as the dodge suite does). */
async function graveSlam(b, { dodge = false } = {}) {
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); true`);
  await sleep(200);
  const m = await b.eval(`debug.monster('${ID}')`);
  await b.eval(`debug.teleport(${m.spawnX}, ${m.spawnY}); debug.setPlayerHp(999999); debug.setRng(0.5); debug.clearLog(); debug.setPeaceful(false);
    ${S}.player.facing = 'left';
    (() => { const w = ${S}.world, mon = w.monsterById('${ID}'); mon.body.reset(w.player.x, w.player.y); w.skills.use(mon, 'guardian_stomp', w.now); })(); true`);
  if (dodge) { await sleep(850); await b.press('ShiftLeft'); }
  await b.waitFor(`debug.log.some(e => e.skill === 'guardian_stomp' && (e.type === 'damage' || e.type === 'miss' || e.type === 'hitCancelled'))`, { timeout: 4000, label: 'Stomp resolves' }).catch(() => {});
  await sleep(250);
  await b.eval(`debug.setPeaceful(true); true`);
  return b.eval(`(() => { const l = debug.log, w = l.find(e => e.type === 'skillWindup' && e.skill === 'guardian_stomp'),
    d = l.find(e => e.type === 'damage' && e.skill === 'guardian_stomp' && e.target === 'player');
    return { windup: !!w, impactDelay: w && d ? d.t - w.t : null, damage: d?.amount ?? 0, resolved: l.filter(e => e.skill === 'guardian_stomp').map(e => e.type) }; })()`);
}

/** A real fight with the player on one side (dx < 0: west of the Guardian, so it faces west); per-tick samples and the log. */
async function fight(b, dx, ms, { circle = false } = {}) {
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); debug.setRng(0.5); true`);
  await sleep(250);
  const m = await b.eval(`debug.monster('${ID}')`);
  await b.eval(`debug.teleport(${m.spawnX + dx}, ${m.spawnY}); debug.setPlayerHp(999999); debug.selectTarget('${ID}'); debug.clearLog();
    window.__bs = []; window.__bsTick = () => { const s = ${S}, mm = s.world.monsterById('${ID}'); if (!mm || mm.combat.dead) return;
      const c = s.monsterAnimator.current('${ID}'), k = mm.def.scale ?? 1;
      window.__bs.push({ now: s.world.now, state: c?.state, frame: c?.frame, phase: c?.phase, tex: mm.texture.key, fr: Number(mm.frame.name),
        flip: mm.flipX, left: s.player.x < mm.x, rot: mm.rotation, scale: [mm.scaleX, mm.scaleY], origin: [mm.displayOriginX, mm.displayOriginY],
        body: [mm.body.x - mm.x + 10 * k, mm.body.y - mm.y - 2 * k, mm.body.width - 20 * k, mm.body.height - 12 * k],
        drawn: mm.visible && mm.alpha > 0, moving: Math.hypot(mm.body.velocity.x, mm.body.velocity.y) > 1 }); };
    ${S}.events.on('postupdate', window.__bsTick); debug.setPeaceful(false); true`);
  await b.keyDown('Space');
  if (circle) {
    // Circle the Guardian: east, south, west, north of it; it turns to face the player each time it attacks.
    for (const [ox, oy] of [[60, 0], [0, 50], [-60, 0], [0, -50], [60, 0], [-60, 0]]) {
      await b.eval(`(() => { const mm = ${S}.world.monsterById('${ID}'); debug.teleport(mm.x + ${ox}, mm.y + ${oy}); })(); true`);
      const movedAt = await b.eval(`${S}.world.now`);
      await b.waitFor(`debug.log.some(e => e.type === 'skillUsed' && e.source === '${ID}' && e.skill !== 'guardian_stomp' && e.t > ${movedAt})`,
        { timeout: 6000, label: 'basic attack after circling to the next side' });
      await sleep(100);
    }
  } else await sleep(ms);
  await b.keyUp('Space');
  return b.eval(`(() => { ${S}.events.off('postupdate', window.__bsTick); debug.setPeaceful(true);
    return { samples: window.__bs, log: debug.log.filter(e => e.source === '${ID}' || e.target === '${ID}') }; })()`);
}

/** Frame timing, heap growth, texture swaps and animator state changes over a 4 s real fight (player west of the Guardian). */
async function perfFight(b) {
  await freshField(b);
  const m = await b.eval(`debug.monster('${ID}')`);
  await b.eval(`debug.teleport(${m.spawnX - 60}, ${m.spawnY}); debug.setPlayerHp(999999); debug.selectTarget('${ID}'); debug.setPeaceful(false);
    (() => { const mm = ${S}.world.monsterById('${ID}'), orig = mm.setTexture; window.__swaps = 0; window.__changes = 0; let last = '';
      mm.setTexture = function (...a) { window.__swaps++; return orig.apply(this, a); };
      window.__perfTick = () => { const c = ${S}.monsterAnimator.current('${ID}'), k = c ? c.state + c.frame : 'none'; if (k !== last) { window.__changes++; last = k; } };
      ${S}.events.on('postupdate', window.__perfTick); })(); true`);
  await b.keyDown('Space');
  const stats = await b.eval(`new Promise((resolve) => { const d = [], heap0 = performance.memory?.usedJSHeapSize ?? 0; let prev = performance.now(); const t0 = prev;
    const step = (now) => { d.push(now - prev); prev = now; if (now - t0 < 4000) requestAnimationFrame(step); else {
      const sorted = [...d].sort((x, y) => x - y);
      resolve({ frames: d.length, p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), max: +sorted.at(-1).toFixed(1), over20: d.filter((x) => x > 20).length,
        heapKB: Math.round(((performance.memory?.usedJSHeapSize ?? 0) - heap0) / 1024), swaps: window.__swaps, frameChanges: window.__changes }); } };
    requestAnimationFrame(step); })`);
  await b.keyUp('Space');
  await b.eval(`${S}.events.off('postupdate', window.__perfTick); debug.setPeaceful(true); true`);
  return stats;
}

export async function guardianAnimSuite(b, t, shot) {
  t.section('Grove Guardian production animation (Pass 4B, integrated)');
  // Every Guardian strip request during the suite (CDP Network): resets must reuse the loaded textures.
  const net = [], onMessage = b.onMessage;
  b.onMessage = (msg) => { if (msg.method === 'Network.responseReceived' && msg.params.response.url.includes('/monsters/grove_guardian/')) net.push([msg.params.response.url.split('/').pop(), msg.params.response.status]); onMessage.call(b, msg); };
  await b.send('Network.enable');

  // 1. Normal load: all five strips present at the contract size, smooth filtered, served without errors.
  await freshField(b);
  const load = await b.eval(`(() => { const tx = ${S}.textures;
    const strips = ${JSON.stringify(Object.keys(STATES))}.map((s) => { const key = 'monster-anim-grove_guardian-' + s, tex = tx.exists(key) ? tx.get(key) : null, f = tex?.get(0);
      return { s, ok: !!tex, frames: tex ? tex.frameTotal - 1 : 0, cell: f ? [f.width, f.height] : null }; });
    return { strips }; })()`);
  t.check('GP-1. all five Guardian strips are loaded at boot at 208x160 with the contract frame counts (a failed load would also fail the console check)',
    load.strips.every((x) => x.ok && x.frames === STATES[x.s] && near(x.cell, [208, 160])), JSON.stringify(load));
  const real = await look(b);
  t.check('GP-2. the normal runtime path selects the real strips: untinted, drawn at 0.5, origin on the cell centre, feet row on the shadow line',
    real.strips && real.tex === 'monster-anim-grove_guardian-idle' && real.tint === 0xffffff && near(real.scale, [0.5, 0.5]) && real.origin[0] === 0.5 &&
      near(real.displayOrigin, [104, real.displayOrigin[1]]) && Math.abs(real.feetY - real.shadow[1]) < 1e-6, JSON.stringify(real));

  // An unmeasured fight first: pays the session's first-use costs (telegraph, damage text, VFX) so both measured runs start warm.
  await perfFight(b);
  const perfReal = await perfFight(b);

  // 2. Fallback: one strip missing (test-only drop) -> the whole set is refused, the approved Guardian idle sheet returns, never a placeholder.
  const dropped = await b.eval(`debug.dropMonsterAnimStrip('grove_guardian', 'hit')`);
  await freshField(b);
  const fallback = await look(b);
  t.check('GP-3. one strip missing: the half-loaded set is never used; the Guardian falls back to the approved Guardian idle sheet (no placeholder)',
    dropped === true && !fallback.strips && fallback.tex === 'monster-art-grove_guardian' && fallback.tint === 0xffffff, JSON.stringify(fallback));
  t.check('GP-4. world body, hit radius, move speed and shadow are identical with the real strips and with the fallback',
    near(real.body, fallback.body) && real.hitRadius === fallback.hitRadius && real.speed === fallback.speed && near(real.shadow, fallback.shadow),
    JSON.stringify({ real: real.body, fallback: fallback.body, hitRadius: [real.hitRadius, fallback.hitRadius] }));
  const smashFallback = await graveSlam(b);
  const perfFallback = await perfFight(b);
  // Strips swap texture only when the state changes (frames within a strip are frame changes), never per tick.
  t.check('GP-16. performance: real strips vs the fallback in the same 4 s Field fight: no frame-time regression, texture swaps only on state changes',
    perfReal.p95 <= perfFallback.p95 + 4 && perfReal.over20 <= perfFallback.over20 + 8 && perfReal.swaps <= perfReal.frameChanges && perfReal.swaps < perfReal.frames / 4,
    JSON.stringify({ real: perfReal, fallback: perfFallback }));
  const restored = await b.eval(`debug.restoreMonsterAnimStrips('grove_guardian')`);
  await freshField(b);
  const back = await look(b);
  t.check('GP-5. restoring the strips brings the real set back on the normal path', restored === true && back.strips && back.tex === real.tex && near(back.body, real.body), JSON.stringify(back));

  // 3. Stomp with the real strips: same wind-up -> impact delay and damage as the fallback; Dodge through real damage.
  const smashReal = await graveSlam(b);
  const smashDodged = await graveSlam(b, { dodge: true });
  t.check('GP-6. Stomp timing and damage unchanged: impact on the first tick at or after 1000 ms, same damage as the fallback',
    [smashFallback, smashReal].every((r) => r.impactDelay !== null && r.impactDelay >= 1000 && r.impactDelay < 1000 + 1000 / 60) && smashReal.damage === smashFallback.damage && smashReal.damage > 0,
    JSON.stringify({ fallback: smashFallback, real: smashReal }));
  t.check('GP-7. Dodge at 850 ms avoids Stomp through real damage resolution (wind-up shown, no damage to the player)',
    smashDodged.windup && smashDodged.damage === 0 && smashDodged.resolved.length > 0, JSON.stringify(smashDodged));

  // 4. Real fights facing west (player west) and east (player east), then circling the Guardian.
  // West from 60 px: from 75 px a collider at the Guardian Stones stops its approach at -27 px, out of reach (map, not art).
  const runs = { west: await fight(b, -60, 4200), east: await fight(b, 75, 4200), circle: await fight(b, -60, 4800, { circle: true }) };
  for (const [side, { samples, log }] of Object.entries(runs)) {
    const states = new Set(samples.map((s) => s.state));
    const texOk = samples.every((s) => s.tex === `monster-anim-grove_guardian-${s.state}` && s.fr === s.frame && s.frame < STATES[s.state]);
    const still = samples.every((s) => s.rot === 0 && Math.abs(Math.abs(s.scale[0]) - 0.5) < 1e-9 && s.scale[1] === 0.5 && near(s.origin, samples[0].origin) && near(s.body, [0, 0, 0, 0]));
    t.check(`GP-8-${side}. every tick draws the strip of the animator's state at its frame (bounded by the contract); no rotation, scale, origin or body drift`,
      samples.length > 100 && texOk && still, JSON.stringify({ samples: samples.length, states: [...states], texOk, still }));
    const windup = log.find((e) => e.type === 'skillWindup' && e.skill === 'guardian_stomp');
    const starts = log.filter((e) => e.type === 'skillUsed' && e.source === ID && e.skill !== 'guardian_stomp').map((e) => samples.find((s) => s.now === e.t)).filter(Boolean);
    const atWindup = windup && samples.find((s) => s.now === windup.t);
    if (side !== 'circle') {
      const want = side === 'west';
      t.check(`GP-9-${side}. faces the player on every basic attack and at the Stomp wind-up (mirrored only)`,
        starts.length > 0 && starts.every((s) => s.flip === want && s.flip === s.left) && (!atWindup || atWindup.flip === want),
        JSON.stringify({ attacks: starts.map((s) => s.flip), windup: atWindup?.flip }));
    }
    const contact = starts.filter((s) => !(s.state === 'special' && s.phase === 'impact'));
    t.check(`GP-10-${side}. basic attack shows contact frame 0 on its damage tick; walk, attack, special and hit all play`,
      contact.length > 0 && contact.every((s) => s.state === 'attack' && s.frame === 0) && ['attack', 'special', 'hit'].every((x) => states.has(x)) && (side === 'circle' || states.has('walk')),
      JSON.stringify({ states: [...states], bad: contact.filter((s) => !(s.state === 'attack' && s.frame === 0)).map((s) => [s.now, s.state, s.frame, s.phase]) }));
  }
  const circleFlips = new Set(runs.circle.samples.filter((s) => s.state === 'attack' && s.frame === 0).map((s) => s.flip));
  t.check('GP-11. circling the Guardian: it turns both ways during the fight, and every facing change keeps the same origin (no horizontal jump of the anchor)',
    circleFlips.size === 2 && runs.circle.samples.every((s) => near(s.origin, runs.circle.samples[0].origin)), JSON.stringify([...circleFlips]));
  // Stomp phases follow the gameplay clock with the real strips: raise / hold for exactly the wind-up, impact on the hit tick.
  // Judged per fight, on every wind-up the fight fully contains (the next fight's reset would otherwise end it early).
  const phaseInfo = Object.values(runs).flatMap(({ samples, log }) => log
    .filter((e) => e.type === 'skillWindup' && e.skill === 'guardian_stomp' && e.source === ID && samples.at(-1).now > e.t + 1000 + 200)
    .map((w) => {
      const during = samples.filter((s) => s.now >= w.t && s.now < w.t + 1000), impact = samples.find((s) => s.now >= w.t + 1000 && s.phase === 'impact');
      const hit = log.find((e) => e.type === 'damage' && e.skill === 'guardian_stomp' && e.t >= w.t);
      const bad = during.filter((s) => !(s.state === 'special' && s.phase === 'windup' && s.frame <= 4)).map((s) => [Math.round(s.now - w.t), s.state, s.frame, s.phase]);
      return { ok: during.length > 0 && bad.length === 0 && !!impact && impact.frame === 5 && (!hit || hit.t === impact.now), bad: bad.slice(0, 4), impactAt: impact && Math.round(impact.now - w.t), damageAt: hit ? Math.round(hit.t - w.t) : 'whiff' };
    }));
  t.check('GP-12. Stomp frames: raise / hold (frames 0-4) for exactly the 1000 ms wind-up, first impact frame (5) on the gameplay impact tick',
    phaseInfo.length >= 2 && phaseInfo.every((p) => p.ok), JSON.stringify(phaseInfo));

  // 5. Death: the existing squash / fade on the strip art, no errors, gone afterwards.
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); true`);
  await sleep(200);
  const m = await b.eval(`debug.monster('${ID}')`);
  await b.eval(`debug.teleport(${m.spawnX - 70}, ${m.spawnY}); true`);
  await sleep(250);
  await b.eval(`debug.defeatMonster('${ID}'); true`);
  await sleep(80);
  const dying = await b.eval(`(() => { const mm = ${S}.world.monsterById('${ID}'); return { tex: mm.texture.key, alpha: mm.alpha, dead: mm.combat.dead }; })()`);
  await sleep(1200);
  const dead = await b.eval(`(() => { const mm = ${S}.world.monsterById('${ID}'); return { visible: mm.visible, alpha: mm.alpha, dead: mm.combat.dead }; })()`);
  t.check('GP-13. death plays the existing squash / fade on the Guardian strip art, then the Guardian is hidden',
    dying.dead && dying.tex.startsWith('monster-anim-grove_guardian-') && (!dead.visible || dead.alpha === 0), JSON.stringify({ dying, dead }));

  // 6. Viewports at zoom 1.65: idle, the Stomp hold and the impact, framed around the Guardian.
  const clip = (c) => ({ x: Math.max(0, Math.round(c.x - 120)), y: Math.max(0, Math.round(c.y - 170)), width: 240, height: 210 });
  const where = () => b.eval(`(() => { const c = ${S}.cameras.main, mm = ${S}.world.monsterById('${ID}'), r = game.canvas.getBoundingClientRect(), k = r.width / game.scale.width;
    return { x: r.x + (mm.x - c.worldView.x) * c.zoom * k, y: r.y + (mm.y - c.worldView.y) * c.zoom * k, zoom: c.zoom }; })()`);
  const zooms = [];
  for (const [w, h] of [[960, 540], [844, 390], [640, 360]]) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(200);
    await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); true`);
    await sleep(200);
    const mm = await b.eval(`debug.monster('${ID}')`);
    await b.eval(`debug.teleport(${mm.spawnX - 55}, ${mm.spawnY + 6}); debug.setPlayerHp(999999); debug.clearLog(); true`);
    await sleep(400);
    let c = await where(); zooms.push(c.zoom);
    await shot(`guardian-prod-${w}x${h}-1-idle`, clip(c));
    await shot(`guardian-prod-${w}x${h}-full-idle`);
    await b.eval(`debug.setPeaceful(false); (() => { const w = ${S}.world, m2 = w.monsterById('${ID}'); w.skills.use(m2, 'guardian_stomp', w.now); })(); true`);
    await sleep(650);
    c = await where();
    await shot(`guardian-prod-${w}x${h}-2-hold`, clip(c));
    await shot(`guardian-prod-${w}x${h}-full-hold`);
    await b.waitFor(`debug.log.some(e => e.type === 'damage' && e.skill === 'guardian_stomp')`, { timeout: 3000, label: 'impact' }).catch(() => {});
    await sleep(30);
    await shot(`guardian-prod-${w}x${h}-3-impact`, clip(await where()));
    await b.eval(`debug.setPeaceful(true); true`);
  }
  await b.setViewport({ mobile: false });
  await sleep(150);
  t.check('GP-14. viewport captures at 960x540, 844x390, 640x360 taken at camera zoom 1.65 (review in test-results/guardian-prod-*)', zooms.every((z) => z === 1.65), JSON.stringify(zooms));
  await b.send('Network.disable');
  b.onMessage = onMessage;
  // The deliberate restore (GP-5) reloads the whole set once; the dozen-plus map resets request nothing.
  t.check('GP-15. no repeated asset loading: across every reset in this suite the only Guardian requests are the one deliberate restore (each strip once, HTTP 200)',
    net.length === 5 && Object.keys(STATES).every((st) => net.filter(([file, code]) => file === `${st}.png` && code === 200).length === 1), JSON.stringify(net));
  await b.eval(`debug.reset(); debug.setPeaceful(true); true`);
}

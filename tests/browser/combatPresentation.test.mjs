// Final combat presentation polish: the Warrior's calm idle rhythm (feet planted, transitions unchanged), the shared
// progressive telegraph on Bone Smash / Grave Slam / Stomp (game-clock progress, rising intensity, ends on the damage
// tick), and the 640x360 [T] Talk prompt clear of the potion slots and chat.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;

export async function combatPresentationSuite(b, t, shot) {
  t.section('Combat presentation polish');

  // 1. Warrior idle: the baked breath + weight shift on the real animation; the sprite never moves, scales or
  //    re-fits its body, the baked feet rows match the drawn strip, and idle -> walk / attack -> idle switch cleanly.
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); true`);
  await sleep(300);
  await b.eval(`window.__idle = []; window.__idleTick = () => { const p = ${S}.player; window.__idle.push({ anim: p.anims.currentAnim?.key, frame: p.anims.currentFrame?.index, y: p.y, oy: p.displayOriginY, sc: p.scaleY, tex: p.texture.key,
      body: [p.body.left - p.x, p.body.top - p.y, p.body.width, p.body.height].map((v) => +v.toFixed(2)).join() }); };
    ${S}.events.on('postupdate', window.__idleTick); true`);
  await sleep(2900);
  const idle = await b.eval(`(async () => { ${S}.events.off('postupdate', window.__idleTick); const a = ${S}.anims.get('player-idle-down');
    const { WARRIOR_IDLE_MOTION } = await import('/src/data/idleMotion.ts');
    const s = window.__idle.filter((x) => x.anim === 'player-idle-down');
    // Feet row (lowest row with >= 12 opaque px) of every baked pose vs the drawn frame it came from.
    const rowOf = (img, x0) => { const g = img.getContext ? img.getContext('2d') : (() => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const cg = c.getContext('2d'); cg.drawImage(img, 0, 0); return cg; })();
      const d = g.getImageData(x0, 0, 192, 192).data; let feet = -1; for (let y = 191; y >= 0 && feet < 0; y--) { let n = 0; for (let x = 0; x < 192; x++) if (d[(y * 192 + x) * 4 + 3] > 0) n++; if (n >= 12) feet = y; } return feet; };
    const baked = game.textures.get('warrior-idle_ready_south~motion').getSourceImage(), drawn = game.textures.get('warrior-idle_ready_south').getSourceImage();
    const feetDiff = Math.max(...WARRIOR_IDLE_MOTION.map((p, i) => Math.abs(rowOf(baked, i * 192) - rowOf(drawn, p.frame * 192))));
    return { frames: a.frames.length, durations: a.frames.map((f) => f.duration).join() === WARRIOR_IDLE_MOTION.map((p) => p.ms).join(), seen: new Set(s.map((x) => x.frame)).size,
      ys: new Set(s.map((x) => x.y)).size, origins: new Set(s.map((x) => x.oy)).size, scales: new Set(s.map((x) => x.sc)).size, bodies: [...new Set(s.map((x) => x.body))], tex: [...new Set(s.map((x) => x.tex))], feetDiff }; })()`);
  await b.press('ArrowRight', 400);
  await sleep(80);
  const after = await b.eval(`${S}.player.anims.currentAnim?.key`);
  const walked = await b.eval(`(() => { const p = ${S}.player; return [p.body.left - p.x, p.body.top - p.y, p.body.width, p.body.height].map((v) => +v.toFixed(2)).join(); })()`);
  await b.eval(`${S}.player.playSkillAction('basic_attack'); true`);
  await sleep(60);
  const attacking = await b.eval(`${S}.player.anims.currentAnim?.key`);
  await sleep(700);
  const back = await b.eval(`${S}.player.anims.currentAnim?.key`);
  t.check('CP-1. Warrior idle breathes (16 baked poses, ~2.6 s, uneven holds) on its own baked sheet; feet planted (same position, origin, scale and body on every frame; baked feet rows = drawn); idle -> walk -> idle and idle -> attack -> idle switch cleanly',
    idle.frames === 16 && idle.durations && idle.seen >= 12 && idle.ys === 1 && idle.origins === 1 && idle.scales === 1 && idle.bodies.length === 1 && idle.bodies[0] === walked &&
      idle.tex.length === 1 && idle.tex[0] === 'warrior-idle_ready_south~motion' && idle.feetDiff === 0 && after === 'player-idle-right' && attacking === 'player-attack-right' && back === 'player-idle-right',
    JSON.stringify({ idle, after, walked, attacking, back }));

  // 2. Telegraphs: progress from the game clock, rising intensity, the zone ends on the damage tick, one shared curve.
  const cases = [
    ['brute', 'demo_crypt', 'crypt_brute-1', 'brute_smash_story'],
    ['lord', 'demo_crypt', 'crypt_lord-1', 'crypt_slam_story'],
    ['guardian', 'demo_field', 'grove_guardian-1', 'guardian_stomp'],
  ];
  const results = {};
  for (const [name, map, id, skill] of cases) {
    await b.eval(`debug.reset('${map}'); debug.setPeaceful(true); true`);
    await sleep(300);
    const m = await b.eval(`debug.monster('${id}')`);
    await b.eval(`debug.teleport(${m.spawnX - 40}, ${m.spawnY + 20}); debug.setPlayerHp(999999); debug.clearLog(); true`);
    await sleep(400);
    await b.eval(`window.__tz = []; window.__tzTick = () => { const z = debug.telegraphs().find((x) => x.casterId === '${id}'); window.__tz.push({ now: ${S}.world.now, z: z ? { p: z.progress, e: z.intensity, f: z.fillAlpha, r: z.rimAlpha, ms: z.ms } : null }); };
      ${S}.events.on('postupdate', window.__tzTick); debug.setPeaceful(false); (() => { const w = ${S}.world; w.skills.use(w.monsterById('${id}'), '${skill}', w.now); })(); true`);
    await b.waitFor(`debug.log.some((e) => e.type === 'damage' && e.skill === '${skill}')`, { timeout: 12000, label: `${name} impact` }).catch(() => {});
    await sleep(120);
    results[name] = await b.eval(`(async () => { ${S}.events.off('postupdate', window.__tzTick); debug.setPeaceful(true);
      const { telegraphIntensity } = await import('/src/rendering/telegraphCurve.ts');
      const d = debug.log.find((e) => e.type === 'damage' && e.skill === '${skill}'), w = debug.log.filter((e) => e.type === 'skillWindup' && e.skill === '${skill}' && (!d || e.t <= d.t)).at(-1);
      const live = window.__tz.filter((x) => x.z && w && x.now >= w.t && x.now <= (d?.t ?? Infinity) + 40);
      // Progress (applied in the scene update) may trail world.now (advanced later in the same frame) by one frame.
      const drift = Math.max(0, ...live.filter((x) => x.now <= (d?.t ?? Infinity)).map((x) => Math.abs(x.z.p * x.z.ms - Math.min(x.z.ms, x.now - w.t))));
      const curve = Math.max(0, ...live.map((x) => Math.abs(x.z.e - telegraphIntensity(x.z.p))));
      const pick = (p) => live.find((x) => x.z.p >= p)?.z;
      const lastLive = live.at(-1)?.now ?? null, firstGone = window.__tz.find((x) => !x.z && lastLive !== null && x.now > lastLive)?.now ?? null;
      return { ms: live[0]?.z.ms ?? null, windup: w?.t ?? null, damage: d?.t ?? null, drift, curve, early: pick(0.15)?.e, mid: pick(0.5)?.e, late: pick(0.85)?.e,
        fill: [pick(0.15)?.f, pick(0.5)?.f, pick(0.85)?.f], rim: [pick(0.15)?.r, pick(0.5)?.r, pick(0.85)?.r],
        // No border during most of the wind-up: the rim stays at 0 until the late phase.
        rimBefore: Math.max(0, ...live.filter((x) => x.z.p < 0.55).map((x) => x.z.r)),
        endedAt: firstGone, frames: live.length }; })()`);
  }
  const ok = (r) => r.ms && r.windup !== null && r.damage !== null && r.drift <= 34 && r.curve < 1e-9 && r.early < r.mid && r.mid < r.late && r.frames > 10 &&
    r.endedAt !== null && Math.abs(r.endedAt - r.damage) <= 34 && r.damage - r.windup >= r.ms &&
    r.fill[0] < r.fill[1] && r.fill[1] < r.fill[2] && r.fill[2] <= 0.5 && r.rimBefore === 0 && r.rim[0] === 0 && r.rim[1] === 0 && r.rim[2] > 0.2;
  t.check('CP-2. Bone Smash / Grave Slam / Stomp telegraphs follow the real wind-up (game-clock progress), darken early < mid < late as a soft field (no rim before the late phase, translucent), and end on the damage tick',
    Object.values(results).every(ok), JSON.stringify(results));
  t.check('CP-3. all three use the one shared telegraph curve (same intensity at the same progress) with their real wind-up lengths (1400 / 1100 / 1000 ms)',
    results.brute.ms === 1400 && results.lord.ms === 1100 && results.guardian.ms === 1000 && Object.values(results).every((r) => r.curve < 1e-9),
    JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, r]) => [k, { ms: r.ms, early: r.early, mid: r.mid, late: r.late }]))));

  // 3. 640x360: the [T] Talk prompt (longest NPC name) is clear of the potion / skill slots and the chat preview.
  await b.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); true`);
  await sleep(300);
  const mira = (await b.eval('debug.npcs()')).find((n) => n.id === 'npc_stablekeeper_mira');
  await b.eval(`debug.teleport(${mira.x + 30}, ${mira.y + 16}); true`);
  await sleep(500);
  await shot('presentation-talk-640x360');
  const talk = await b.eval(`(() => { const r = (e) => e.getBoundingClientRect(), p = r(document.querySelector('.hud__interact'));
    const hit = (q) => q.width > 0 && !(q.right <= p.left || q.left >= p.right || q.bottom <= p.top || q.top >= p.bottom);
    return { visible: !document.querySelector('.hud-interact').hidden, text: document.querySelector('.hud-interact').textContent,
      blockers: [...document.querySelectorAll('.hud-actions .ui-slot, .hud-chat__preview, [data-hud=systems]')].filter((e) => hit(r(e))).map((e) => e.dataset.slot || e.className) }; })()`);
  await b.setViewport({ mobile: false });
  await sleep(150);
  t.check('CP-4. 640x360: the [T] Talk prompt shows for the nearest NPC and no potion / skill slot or chat preview covers it',
    talk.visible && talk.text.includes('Stablekeeper Mira') && talk.blockers.length === 0, JSON.stringify(talk));

  // 4. Circular skill presentation: the hotbar art face is a circle exactly under the cooldown sweep; a real cooldown
  //    sweeps it with a timer; the key hint stays outside the face; the Skills window loadout sockets are round.
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); debug.setPlayerMp(500); true`);
  await sleep(300);
  const faceOf = (slot) => `(() => { const s = document.querySelector('.hud-actions [data-slot=${slot}]'), i = s.querySelector('.ui-slot__icon'), c = s.querySelector('.ui-slot__cooldown'), k = s.querySelector('.ui-slot__key');
    const ri = i.getBoundingClientRect(), rc = c.getBoundingClientRect(), rk = k.getBoundingClientRect(), cs = getComputedStyle(i);
    const cx = ri.x + ri.width / 2, cy = ri.y + ri.height / 2, kx = Math.max(rk.left, Math.min(cx, rk.right)), ky = Math.max(rk.top, Math.min(cy, rk.bottom));
    return { art: i.classList.contains('has-art'), round: cs.borderRadius === '50%', w: Math.round(ri.width), h: Math.round(ri.height), ring: cs.boxShadow.includes('1.5px'),
      sweep: c.hidden ? null : { w: Math.round(rc.width), dx: Math.round(rc.x - ri.x), dy: Math.round(rc.y - ri.y), round: getComputedStyle(c).borderRadius === '50%', cd: c.style.getPropertyValue('--cd') },
      text: s.querySelector('.ui-slot__cooldown-text').textContent, keyClear: Math.hypot(kx - cx, ky - cy) >= ri.width / 2 - 1 }; })()`;
  const ready = await b.eval(faceOf('skill3'));
  await b.eval(`(() => { const w = ${S}.world; w.skills.use(${S}.player, 'guard', w.now); })(); true`);
  await sleep(1200);
  const cooling = await b.eval(faceOf('skill3'));
  // The loadout belongs to a job's skill tree: a Lv30 Warrior with two actives learned (auto-slotted).
  await b.eval(`debug.setLevel(30); debug.forceChangeJob('warrior'); debug.forceSetSkillRank('power_slash', 1); debug.forceSetSkillRank('charge', 1);
    ${S}.world.skillTree.assign('skill1', 'power_strike'); ${S}.world.skillTree.assign('skill2', 'charge'); true`);
  await sleep(400); // the HUD rebuilds for the new job on its next update
  await b.eval(`document.querySelector('[data-menu=skills]').click(); true`);
  await sleep(500);
  const loadout = await b.eval(`[...document.querySelectorAll('.skills-slot')].map((e) => ({ round: getComputedStyle(e).borderRadius === '50%', img: !!e.querySelector('img'), imgRound: e.querySelector('img') ? getComputedStyle(e.querySelector('img')).borderRadius === '50%' : null }))`);
  await shot('presentation-skills-loadout');
  await b.press('Escape');
  t.check('CP-5. circular skill icons: the hotbar art face is a ringed circle exactly under the radial cooldown sweep (timer shown, key hint outside the face); the Skills window loadout sockets and icons are round',
    ready.art && ready.round && ready.ring && ready.w === ready.h && ready.sweep === null && ready.keyClear &&
      cooling.sweep && cooling.sweep.round && Math.abs(cooling.sweep.w - cooling.w) <= 1 && Math.abs(cooling.sweep.dx) <= 1 && Math.abs(cooling.sweep.dy) <= 1 && Number(cooling.sweep.cd) > 0 && /^\d/.test(cooling.text) &&
      loadout.length === 5 && loadout.every((l) => l.round) && loadout.filter((l) => l.img).every((l) => l.imgRound),
    JSON.stringify({ ready, cooling, loadout }));
  await b.eval(`debug.reset(); true`);
}

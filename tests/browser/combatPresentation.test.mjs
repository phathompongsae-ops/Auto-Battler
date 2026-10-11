// Final combat presentation polish: the Warrior's calm idle rhythm (feet planted, transitions unchanged), the shared
// progressive telegraph on Bone Smash / Grave Slam / Stomp (game-clock progress, rising intensity, ends on the damage
// tick), and the 640x360 [T] Talk prompt clear of the potion slots and chat.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;

export async function combatPresentationSuite(b, t, shot) {
  t.section('Combat presentation polish');

  // 1. Warrior idle: the timed rhythm on the real animation, feet planted across every frame.
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); true`);
  await sleep(300);
  await b.eval(`window.__idle = []; window.__idleTick = () => { const p = ${S}.player; window.__idle.push({ anim: p.anims.currentAnim?.key, frame: p.anims.currentFrame?.index, y: p.y, oy: p.displayOriginY, tex: p.texture.key }); };
    ${S}.events.on('postupdate', window.__idleTick); true`);
  await sleep(2200);
  const idle = await b.eval(`(() => { ${S}.events.off('postupdate', window.__idleTick); const a = ${S}.anims.get('player-idle-down');
    const s = window.__idle.filter((x) => x.anim === 'player-idle-down');
    return { frames: a.frames.map((f) => [f.textureFrame, f.duration]), seen: [...new Set(s.map((x) => x.frame))].sort(), ys: [...new Set(s.map((x) => x.y))].length, origins: [...new Set(s.map((x) => x.oy))].length, tex: [...new Set(s.map((x) => x.tex))] }; })()`);
  await b.press('ArrowRight', 400);
  await sleep(80);
  const after = await b.eval(`${S}.player.anims.currentAnim?.key`);
  t.check('CP-1. Warrior idle plays its four frames with uneven holds (~1.8 s breath); feet planted (same position, origin and strip on every frame); walking and stopping still switch cleanly',
    idle.frames.map((f) => f[1]).join(',') === '700,240,620,260' && idle.seen.length === 4 && idle.ys === 1 && idle.origins === 1 && idle.tex.length === 1 && after === 'player-idle-right',
    JSON.stringify({ idle, after }));

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
    await b.eval(`window.__tz = []; window.__tzTick = () => { const z = debug.telegraphs().find((x) => x.casterId === '${id}'); window.__tz.push({ now: ${S}.world.now, z: z ? { p: z.progress, e: z.intensity, f: z.fillAlpha, ms: z.ms } : null }); };
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
        endedAt: firstGone, frames: live.length }; })()`);
  }
  const ok = (r) => r.ms && r.windup !== null && r.damage !== null && r.drift <= 34 && r.curve < 1e-9 && r.early < r.mid && r.mid < r.late && r.frames > 10 &&
    r.endedAt !== null && Math.abs(r.endedAt - r.damage) <= 34 && r.damage - r.windup >= r.ms;
  t.check('CP-2. Bone Smash / Grave Slam / Stomp telegraphs follow the real wind-up (game-clock progress), grow early < mid < late, and end on the damage tick',
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
  await b.eval(`debug.reset(); true`);
}

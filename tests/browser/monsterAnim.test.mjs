// Visual Pass 4A/4B: real monster animation strips. The three priority monsters are driven through real
// fights: Grove Guardian with code-drawn fixture strips at its pending contract size,
// Crypt Lord and Skeleton Brute with their integrated production strips:
// state priority, contact-first attacks, specials aligned to the gameplay impact tick, combat facing,
// no procedural pose on top, unchanged bodies, and the fallback path before and after.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;
const IDS = { crypt_lord: 'crypt_lord-1', crypt_brute: 'crypt_brute-1', grove_guardian: 'grove_guardian-1' };

/** Texture, tint, strips and body (relative to the position) of a monster. */
const look = (b, id) => b.eval(`(() => { const m = ${S}.world.monsterById('${id}');
  return { tex: m.texture.key, strips: !!m.strips, tint: m.tintTopLeft, playing: m.anims.isPlaying,
    body: [m.body.x - m.x, m.body.y - m.y, m.body.width, m.body.height], hitRadius: m.hitRadius }; })()`);
const near = (a, z) => a.length === z.length && a.every((v, i) => Math.abs(v - z[i]) < 1e-6);

/** Fight one monster with the player standing in its reach; returns per-frame samples and the event log. */
async function fight(b, map, id, ms, [dx, dy] = [-75, 0]) {
  await b.eval(`debug.reset('${map}'); debug.setPeaceful(true); debug.setRng(0.5); true`);
  await sleep(250);
  const m = await b.eval(`debug.monster('${id}')`);
  // Start just out of reach, inside its encounter, so it walks over, then stand still and attack it (the player is unkillable here).
  await b.eval(`debug.teleport(${m.spawnX + dx}, ${m.spawnY + dy}); debug.setPlayerHp(999999); debug.selectTarget('${id}'); debug.clearLog();
    window.__anim = []; window.__animTick = () => { const s = ${S}, m = s.world.monsterById('${id}'); if (!m || m.combat.dead) return;
      const c = s.monsterAnimator.current('${id}'), k = m.def.scale ?? 1;
      window.__anim.push({ now: s.world.now, state: c?.state, frame: c?.frame, phase: c?.phase, tex: m.texture.key, flip: m.flipX,
        left: s.player.x < m.x, rot: m.rotation, originDrift: Math.abs(m.displayOriginY - m.height * m.originY) + Math.abs(m.displayOriginX - m.width * m.originX),
        body: [m.body.x - m.x + 10 * k, m.body.y - m.y - 2 * k, m.body.width - 20 * k, m.body.height - 12 * k] }); };
    ${S}.events.on('postupdate', window.__animTick); debug.setPeaceful(false); true`);
  await b.keyDown('Space');
  await b.waitFor(`debug.log.some(e => e.type === 'skillWindup' && e.source === '${id}')`, { timeout: 15000, label: `${id} special wind-up` });
  await sleep(ms);
  await b.keyUp('Space');
  const out = await b.eval(`(() => { ${S}.events.off('postupdate', window.__animTick); debug.setPeaceful(true);
    return { samples: window.__anim, log: debug.log.filter(e => e.source === '${id}' || e.target === '${id}') }; })()`);
  return out;
}

/** Checks shared by the three fights. */
function judge(t, name, { samples, log }, specials, windupMs) {
  // The Story profile swaps in its Story special (same wind-up): match whichever one this fight used.
  const windup = log.find((e) => e.type === 'skillWindup' && specials.includes(e.skill));
  const special = windup?.skill ?? specials.join('/');
  const at = (now) => samples.find((s) => s.now === now);
  const t0 = windup?.t;
  const after = samples.filter((s) => s.now >= t0 && s.now < t0 + windupMs + 600);
  const misplaced = after.filter((s) => (s.now < t0 + windupMs ? s.state !== 'special' || s.phase !== 'windup' : s.state === 'special' && s.phase === 'windup'));
  const firstImpact = after.find((s) => s.phase === 'impact');
  const slamHit = log.find((e) => e.type === 'damage' && e.skill === special && e.t >= t0);
  t.check(`MA-${name}-1. ${special}: wind-up frames for exactly the gameplay ${windupMs} ms, impact frame on the gameplay impact tick, then recovery (or a basic attack cutting it)`,
    !!windup && misplaced.length === 0 && !!firstImpact && firstImpact.now >= t0 + windupMs && (!slamHit || slamHit.t === firstImpact.now) && after.some((s) => s.now > firstImpact.now && (s.phase === 'recovery' || s.state === 'attack')),
    JSON.stringify({ special, t0, windupMs, firstImpact: firstImpact?.now, damageAt: slamHit?.t ?? 'whiff', misplaced: misplaced.length }));
  const startFrame = at(t0);
  t.check(`MA-${name}-2. faces the player when the wind-up begins (mirrored, never rotated)`,
    !!startFrame && startFrame.flip === startFrame.left && samples.every((s) => s.rot === 0), JSON.stringify(startFrame));
  // A basic attack used on the special's impact tick (the brain is free again, the special on cooldown) shows the
  // impact: special wind-up / impact outranks the basic attack. Every other basic attack shows its contact frame.
  const basics = log.filter((e) => e.type === 'skillUsed' && e.skill === 'slime_bump');
  const sampled = basics.map((e) => at(e.t)).filter(Boolean);
  const contact = sampled.filter((s) => !(s.state === 'special' && s.phase === 'impact'));
  const dmgTicks = basics.map((e) => log.some((d) => (d.type === 'damage' || d.type === 'miss') && d.skill === 'slime_bump' && d.t === e.t));
  t.check(`MA-${name}-3. basic attacks: contact frame 0 shown on the tick their damage lands (timing unchanged), facing the player`,
    contact.length > 0 && contact.every((s) => s.state === 'attack' && s.frame === 0 && s.flip === s.left) && dmgTicks.every(Boolean),
    JSON.stringify({ basics: basics.length, sampled: sampled.length, states: sampled.map((s) => s.state + s.frame + (s.phase ? ':' + s.phase : '')) }));
  const drift = Math.max(0, ...samples.flatMap((s) => s.body.map(Math.abs)));
  t.check(`MA-${name}-4. drawn from real strips with no procedural pose on top; body stays at its exact world rectangle`,
    samples.length > 60 && samples.every((s) => s.tex.startsWith('monster-anim-') && s.originDrift < 1e-6) && drift < 1e-6,
    JSON.stringify({ samples: samples.length, drift, textures: [...new Set(samples.map((s) => s.tex))] }));
  return new Set(samples.map((s) => s.state));
}

export async function monsterAnimSuite(b, t, shot) {
  t.section('Monster animation strips (Guardian fixtures, Lord / Brute production strips)');

  // 1. Integrated Lord and Brute load their real strips.
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(200);
  const before = { lord: await look(b, IDS.crypt_lord), brute: await look(b, IDS.crypt_brute) };
  t.check('MA-1. Lord and Brute use their integrated strips, untinted, with frames set by the animator',
    before.lord.strips && before.lord.tex === 'monster-anim-crypt_lord-idle' && before.lord.tint === 0xffffff && !before.lord.playing &&
    before.brute.strips && before.brute.tex === 'monster-anim-crypt_brute-idle' && before.brute.tint === 0xffffff && !before.brute.playing, JSON.stringify(before));

  // 2. Install only the pending Guardian fixture; Lord and Brute keep their production strips.
  const installed = await b.eval(`['grove_guardian'].map((id) => debug.installMonsterAnimFixture(id))`);
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(200);
  const withStrips = { lord: await look(b, IDS.crypt_lord), brute: await look(b, IDS.crypt_brute) };
  t.check('MA-2. with strips: dedicated keys are used (Brute: its production strips, untinted), bodies and hit radii identical to before',
    installed.every(Boolean) && withStrips.lord.strips && withStrips.lord.tex === 'monster-anim-crypt_lord-idle' &&
    withStrips.brute.strips && withStrips.brute.tex === 'monster-anim-crypt_brute-idle' && withStrips.brute.tint === 0xffffff &&
    near(withStrips.lord.body, before.lord.body) && near(withStrips.brute.body, before.brute.body) &&
    withStrips.lord.hitRadius === before.lord.hitRadius && withStrips.brute.hitRadius === before.brute.hitRadius, JSON.stringify(withStrips));

  // 3. Crypt Lord: Grave Slam (1100 ms) plus basic attacks.
  const lord = await fight(b, 'demo_crypt', IDS.crypt_lord, 2600);
  await shot('monster-anim-01-lord');
  const lordStates = judge(t, 'LORD', lord, ['crypt_slam', 'crypt_slam_story'], 1100);
  t.check('MA-LORD-5. walks over while out of reach (walk state while moving)', lordStates.has('walk'), JSON.stringify([...lordStates]));

  // 4. Grove Guardian: Stomp (1000 ms).
  const guardian = await fight(b, 'demo_field', IDS.grove_guardian, 2600, [0, 75]);
  const guardianStates = judge(t, 'GUARDIAN', guardian, ['guardian_stomp'], 1000);
  t.check('MA-GUARDIAN-5. walk, attack and special all play in one real fight', ['walk', 'attack', 'special'].every((s) => guardianStates.has(s)), JSON.stringify([...guardianStates]));

  // 5. Skeleton Brute: Story Bone Smash (1400 ms).
  // Bone Smash comes round every 3.5 s: stay long enough for a basic attack after the one on its impact tick.
  const brute = await fight(b, 'demo_crypt', IDS.crypt_brute, 3200);
  const bruteStates = judge(t, 'BRUTE', brute, ['brute_smash_story'], 1400);
  const all = [lord, guardian, brute].flatMap((f) => f.samples);
  t.check('MA-6. hit flinches play between attacks, never during a wind-up or impact',
    all.some((s) => s.state === 'hit') && !all.some((s) => s.state === 'hit' && s.phase), JSON.stringify([...bruteStates]));

  // 6. Remove the Guardian fixture; integrated Lord / Brute strips are left intact.
  await b.eval(`['grove_guardian'].forEach((id) => debug.removeMonsterAnimFixture(id)); debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(200);
  const after = { lord: await look(b, IDS.crypt_lord), brute: await look(b, IDS.crypt_brute) };
  t.check('MA-7. Guardian fixtures removed: Lord and Brute production art remain unchanged',
    JSON.stringify(after) === JSON.stringify(before), JSON.stringify(after));
  const zoom = await b.eval(`${S}.cameras.main.zoom`);
  t.check('MA-8. camera zoom stays 1.65', zoom === 1.65, String(zoom));
  await b.eval(`debug.reset(); debug.setPeaceful(true); true`);
}

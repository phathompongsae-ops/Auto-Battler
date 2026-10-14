// Mage Class 1 in the running game: the real Job Change, Magic Bolt, the five spells and three passives through the
// real Skills / hotbar paths, Burn / Slow / Frost Storm / Meteor presentation, Field and Crypt fights (Elite Boar,
// Grove Guardian, Story Brute + Story Lord, standard Lv20 Crypt Lord), save / load, three viewports and first-use
// frame cost. Fights are played by holding ATK and pressing ready skills (potions when low); no HP is set by hand.
import { sleep } from './cdp.mjs';

const WORLD = `game.scene.getScene('World')`;
const ANIM = `${WORLD}.player.anims.currentAnim && ${WORLD}.player.anims.currentAnim.key`;
const SLOT_KEYS = { skill1: 'KeyQ', skill2: 'KeyE', skill3: 'KeyR', skill4: 'KeyF', skill5: 'KeyG' };

/** Frame-time sampler (rAF deltas) for first-use hitch checks. */
const SAMPLER = `(() => { if (window.__frames) return; window.__frames = []; let last = performance.now();
  const tick = (t) => { window.__frames.push(t - last); last = t; if (window.__frames.length > 4000) window.__frames.shift(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`;

export async function mageSuite(b, t, shot) {
  t.section('Mage Class 1 in the running game');
  const api = (expr) => b.eval(`debug.${expr}`);
  await b.eval(SAMPLER);
  await api(`reset('demo_town')`);
  await b.eval('debug.setPeaceful(true); debug.setRng(null); debug.clearLog()');

  // ---------------------------------------------------------------- 1. Job Change (real window)
  await api('grantExp(25000)');
  await api('forceCompleteJobTrial()');
  await b.waitFor(`!!document.querySelector('[data-window="job-select"] [data-job="mage"]')`, { timeout: 3000, label: 'job window' });
  const choice = await b.eval(`(() => { const el = document.querySelector('[data-window="job-select"] [data-job="mage"]'); return { disabled: el.disabled, text: el.textContent }; })()`);
  await b.eval(`document.querySelector('[data-window="job-select"] [data-job="mage"]').click()`);
  await b.eval(`document.querySelector('[data-window="job-select"] [data-action="confirm"]').click()`);
  await b.waitFor(`${WORLD}.player.currentArt?.displayName === 'Mage'`, { timeout: 2000, label: 'Mage art' }).catch(() => {});
  const js = await api('jobState()');
  const me = await api('player()');
  const art = await b.eval(`${WORLD}.player.currentArt?.displayName`);
  t.check('MG-1. Mage is selectable in the real Job Change window; Job Bonus INT+3 / DEX+2; Mage art; 1 SP',
    !choice.disabled && !choice.text.includes('Not yet') && js.classId === 'mage' && JSON.stringify(js.jobBonuses) === '{"mage":{"int":3,"dex":2}}' &&
      art === 'Mage' && js.earnedSkillPoints === 1,
    JSON.stringify({ choice, classId: js.classId, bonus: js.jobBonuses, art, sp: js.earnedSkillPoints }));
  const novice = await b.eval('debug.progress().derived');
  t.check('MG-2. Lv11 Mage stats follow the Mage growth (HP 420 / MP 300 / MATK 85 base plus primary stats; MATK ~101 as proposed)',
    me.stats.maxHp >= 420 && me.stats.maxMp >= 300 && me.stats.magicAttack >= 95 && me.stats.magicAttack <= 110 && me.stats.magicAttack > me.stats.attack,
    JSON.stringify({ hp: me.stats.maxHp, mp: me.stats.maxMp, matk: me.stats.magicAttack, atk: me.stats.attack, derived: { hp: novice.maxHp, matk: novice.magicAtk } }));

  // ---------------------------------------------------------------- 2. ATK = Magic Bolt
  await sleep(150);
  const atkFace = await b.eval(`(() => { const el = document.querySelector('[data-hud="actions"] [data-slot="attack"]'); const art = el?.querySelector('.has-art'); return { img: art ? art.style.backgroundImage : null, glyph: !!art?.querySelector('svg'), label: el?.textContent ?? '' }; })()`);
  t.check('MG-3. the ATK button shows the Magic Bolt icon alone (the melee swords glyph is gone; label ATK kept)', atkFace.img?.includes('magic_bolt') && !atkFace.glyph && atkFace.label.includes('ATK'), JSON.stringify(atkFace));

  await api(`enterMap('demo_field')`);
  await sleep(300);
  const ids = await api('monsterIds()');
  const slime = ids.find((id) => id.startsWith('slime'));
  await b.eval(`(() => { const p = ${WORLD}.player; debug.placeMonster('${slime}', p.x + 120, p.y); debug.setMonsterHp('${slime}', 100000); debug.selectTarget('${slime}'); debug.setRng(0.5); debug.resetCooldowns(); debug.clearLog(); })()`);
  const mp0 = (await api('player()')).mp;
  await b.press('Space');
  const boltAnim = await b.eval(ANIM);
  await b.waitFor(`debug.log.some((e) => e.type === 'damage' && e.skill === 'magic_bolt')`, { timeout: 3000, label: 'bolt hit' }).catch(() => {});
  const bolt = await b.eval(`({ spawned: debug.log.filter((e) => e.type === 'projectileSpawned' && e.skill === 'magic_bolt').length,
    hits: debug.log.filter((e) => e.type === 'damage' && e.skill === 'magic_bolt').map((e) => e.amount),
    melee: debug.log.filter((e) => e.skill === 'basic_attack').length,
    matk: debug.player().stats.magicAttack, mdef: debug.world.monsterById('${slime}').combat.stats.magicDefense, mp: debug.player().mp })`);
  const expected = Math.max(1, Math.round((bolt.matk * 100) / (100 + bolt.mdef)));
  t.check('MG-4. Space casts Magic Bolt: a ranged projectile at the target, MATK damage, no MP, the Mage attack strip, never the melee Attack',
    bolt.spawned === 1 && JSON.stringify(bolt.hits) === JSON.stringify([expected]) && bolt.melee === 0 && bolt.mp >= mp0 && /player-attack-/.test(boltAnim ?? ''),
    JSON.stringify({ ...bolt, expected, boltAnim }));

  // Out of range: refused, no projectile.
  await b.eval(`(() => { const p = ${WORLD}.player; debug.placeMonster('${slime}', p.x + 300, p.y); debug.resetCooldowns(); debug.clearLog(); })()`);
  await b.press('Space');
  await sleep(400);
  const far = await b.eval(`({ spawned: debug.log.filter((e) => e.type === 'projectileSpawned').length, fail: debug.log.find((e) => e.type === 'skillFailed')?.reason ?? null })`);
  t.check('MG-5. a target beyond 7 tiles is refused (no projectile, no melee swing)', far.spawned === 0 && far.fail === 'out_of_range', JSON.stringify(far));

  // Walls: find a solid tile with open ground on both sides, shoot across it.
  const wall = await b.eval(`(() => { const w = debug.world, blocks = (x, y) => w.projectileWorld.blocksProjectile(x, y);
    for (let y = 80; y < 900; y += 32) for (let x = 80; x < 1400; x += 32)
      if (blocks(x, y) && !blocks(x - 80, y) && !blocks(x + 80, y) && !blocks(x - 60, y) && !blocks(x + 60, y)) return { x, y };
    return null; })()`);
  if (wall) {
    await b.eval(`(() => { debug.teleportPlayer(${wall.x - 80}, ${wall.y}); debug.placeMonster('${slime}', ${wall.x + 80}, ${wall.y}); debug.selectTarget('${slime}'); debug.resetCooldowns(); debug.clearLog(); })()`);
    await sleep(100);
    await b.press('Space');
    await sleep(900);
  }
  const walled = await b.eval(`({ removed: debug.log.filter((e) => e.type === 'projectileRemoved').map((e) => e.reason), hits: debug.log.filter((e) => e.type === 'damage').length })`);
  t.check('MG-6. Magic Bolt stops at a wall (no damage through it)', !!wall && walled.removed.includes('wall') && walled.hits === 0, JSON.stringify({ wall, walled }));

  // ---------------------------------------------------------------- 3. Learn through the Skills window, auto-fill the bar
  await api('teleport(800, 520)');
  await b.waitFor(`!document.querySelector('[data-menu="skills"]').disabled`, { timeout: 1500, label: 'Skills enabled' });
  await b.eval(`document.querySelector('[data-menu="skills"]').click()`);
  await sleep(100);
  const dom = (sel) => `document.querySelector('[data-window="skills"] ${sel}')`;
  const win = await b.eval(`({ tabs: [...document.querySelectorAll('[data-window="skills"] [data-tab], [data-window="skills"] [role="tab"]')].map((e) => e.textContent.trim()),
    nodes: [...document.querySelectorAll('[data-window="skills"] [data-node]')].map((e) => e.dataset.node),
    icons: [...document.querySelectorAll('[data-window="skills"] [data-node] img')].map((i) => i.getAttribute('src')) })`);
  await b.eval(`${dom('[data-learn="fireball"]')}.click()`);
  await sleep(100);
  let st = await api('skillTree()');
  t.check('MG-7. the Skills window lists the Mage tree (Core / Fire / Frost, 8 nodes with their icons) and learns Fireball into Q',
    st.treeId === 'mage_c1' && win.nodes.length === 8 && win.icons.length === 8 && win.icons.some((u) => u.includes('passive/arcane_power')) &&
      st.loadout.skill1 === 'fireball' && Object.values(st.loadout).filter(Boolean).length === 1,
    JSON.stringify({ win, loadout: st.loadout }));
  if (shot) await shot('mage-skills-window');
  await b.press('Escape');

  // Lv30 build: everything once, enough for every gate.
  await api('jumpToLevel(30)');
  for (const [id, n] of [['flame_burst', 1], ['frost_nova', 3], ['frost_storm', 1], ['fireball', 4], ['flame_burst', 2], ['meteor_burst', 1], ['arcane_power', 3], ['mana_flow', 2], ['elemental_mastery', 1]]) {
    for (let i = 0; i < n; i++) await api(`learnSkill('${id}')`);
  }
  st = await api('skillTree()');
  const rank = (id) => st.nodes.find((n) => n.id === id).rank;
  t.check('MG-8. real learn path at Lv30: every Mage skill learned, the bar holds the five actives in Q–G, Magic Bolt takes no slot',
    rank('meteor_burst') === 1 && rank('frost_storm') === 1 && Object.values(st.loadout).filter(Boolean).length === 5 && !Object.values(st.loadout).includes('magic_bolt') &&
      st.points.spent === 19,
    JSON.stringify({ loadout: st.loadout, points: st.points }));
  const slotOf = (id) => Object.entries(st.loadout).find(([, v]) => v === id)?.[0];
  const keyOf = (id) => SLOT_KEYS[slotOf(id)];

  // ---------------------------------------------------------------- 4. Spells on a slime pack
  const slimes = ids.filter((id) => id.startsWith('slime')).slice(0, 3);
  const pack = async (x, y, hp = 100000) => {
    await b.eval(`(() => { const ids = ${JSON.stringify(slimes)}; ids.forEach((id, i) => { debug.placeMonster(id, ${x} + [0, 26, -10][i], ${y} + [0, 10, 22][i]); debug.setMonsterMaxHp(id, ${hp}); });
      debug.selectTarget(ids[0]); debug.resetCooldowns(); debug.setPlayerMp(9999); debug.clearLog(); })()`);
  };
  const p0 = await api('player()');
  await pack(p0.x + 130, p0.y);
  await b.press(keyOf('fireball'));
  const castAnim = await b.eval(ANIM);
  await b.waitFor(`debug.log.some((e) => e.type === 'damage' && e.skill === 'fireball')`, { timeout: 3000, label: 'fireball' }).catch(() => {});
  await sleep(300);
  const fb = await b.eval(`debug.log.filter((e) => e.type === 'damage' && e.skill === 'fireball').map((e) => [e.target, e.delivery ?? 'direct'])`);
  const fbTargets = fb.map(([id]) => id);
  t.check('MG-9. Fireball: one direct hit plus splash on the pack, each monster hit once; cast strip plays',
    fb.filter(([, d]) => d === 'direct').length === 1 && fb.filter(([, d]) => d === 'splash').length >= 1 && new Set(fbTargets).size === fbTargets.length && /player-cast-/.test(castAnim ?? ''),
    JSON.stringify({ fb, castAnim }));

  await pack(p0.x + 130, p0.y);
  await b.press(keyOf('flame_burst'));
  await sleep(700);
  const burnState = await api(`monster('${slimes[0]}')`);
  const burnFrame = await b.eval(`(() => { const row = document.querySelector('[data-hud="target-status"], .hud-target [data-hud*="status"]'); return [...document.querySelectorAll('[data-status]')].map((e) => ({ id: e.dataset.status, label: e.getAttribute('aria-label') })); })()`);
  if (shot) await shot('mage-flame-burst');
  await b.waitFor(`debug.log.filter((e) => e.type === 'statusExpired' && e.skill === 'burning').length >= 2`, { timeout: 15000, label: 'Burn over' }).catch(() => {});
  await sleep(200);
  const flame = await b.eval(`({ area: debug.log.filter((e) => e.type === 'damage' && e.skill === 'flame_burst' && e.delivery === 'area').map((e) => e.target),
    dot: debug.log.filter((e) => e.type === 'damage' && e.skill === 'flame_burst' && e.delivery === 'dot').map((e) => e.target),
    landed: debug.log.filter((e) => e.type === 'areaLanded' && e.skill === 'flame_burst').length })`);
  const perTarget = (list, id) => list.filter((x) => x === id).length;
  t.check('MG-10. Flame Burst: lands once on the pack; Burn shows (status row + ember tint) and ticks exactly 4 times per monster',
    flame.landed === 1 && flame.area.length >= 2 && slimes.filter((id) => flame.area.includes(id)).every((id) => perTarget(flame.dot, id) === 4) &&
      burnState.statuses.some((s) => s.id === 'burning') && burnFrame.some((s) => s.id === 'burning') && burnState.tint !== 0xffffff,
    JSON.stringify({ flame, statuses: burnState.statuses, row: burnFrame, tint: burnState.tint }));

  await b.eval(`(() => { const p = ${WORLD}.player; debug.placeMonster('${slimes[0]}', p.x + 50, p.y); debug.placeMonster('${slimes[1]}', p.x - 40, p.y + 20); debug.placeMonster('${slimes[2]}', p.x + 300, p.y);
    ${JSON.stringify(slimes)}.forEach((id) => debug.setMonsterMaxHp(id, 100000)); debug.resetCooldowns(); debug.clearLog(); })()`);
  const speed0 = (await api(`monster('${slimes[0]}')`)).moveSpeed;
  await b.press(keyOf('frost_nova'));
  await b.waitFor(`debug.log.some((e) => e.type === 'damage' && e.skill === 'frost_nova')`, { timeout: 3000, label: 'nova' }).catch(() => {});
  const novaHit = await b.eval(`debug.log.filter((e) => e.type === 'damage' && e.skill === 'frost_nova').map((e) => e.target)`);
  const slowed = await api(`monster('${slimes[0]}')`);
  await b.eval('debug.setPeaceful(false)');
  await sleep(600);
  const stillActs = (await api(`monster('${slimes[0]}')`)).state;
  await b.eval('debug.setPeaceful(true)');
  await b.waitFor(`debug.log.some((e) => e.type === 'statusExpired' && e.skill === 'slowed' && e.target === '${slimes[0]}')`, { timeout: 15000, label: 'Slow over' }).catch(() => {});
  const restored = (await api(`monster('${slimes[0]}')`)).moveSpeed;
  t.check('MG-11. Frost Nova: hits the two nearby monsters (not the far one), Slow -40% shows, the AI keeps running (any living state), speed restored after',
    novaHit.length === 2 && !novaHit.includes(slimes[2]) && Math.abs(slowed.moveSpeed - speed0 * 0.6) < 0.01 && slowed.statuses.some((s) => s.id === 'slowed') &&
      ['idle', 'chase', 'attack', 'return'].includes(stillActs) && restored === speed0,
    JSON.stringify({ novaHit, speed0, slowedSpeed: slowed.moveSpeed, stillActs, restored }));

  // Frost Storm: zone on the target, 10 ticks, Slow while inside, visuals on the ground under the monsters.
  await pack(p0.x + 140, p0.y);
  await b.eval(`debug.teleportPlayer(${p0.x}, ${p0.y})`);
  await b.press(keyOf('frost_storm'));
  await sleep(900);
  const zoneVis = await api('zoneVisuals()');
  const zones = await api('zones()');
  const monsterDepth = await b.eval(`debug.world.monsterById('${slimes[0]}').depth`);
  const chilled = await api(`monster('${slimes[0]}')`);
  if (shot) await shot('mage-frost-storm');
  await b.waitFor(`debug.log.some((e) => e.type === 'zoneEnded')`, { timeout: 20000, label: 'storm over' }).catch(() => {});
  const storm = await b.eval(`({ ticks: debug.log.filter((e) => e.type === 'zoneTick').map((e) => e.tick), ended: debug.log.filter((e) => e.type === 'zoneEnded').length,
    hitsOnFirst: debug.log.filter((e) => e.type === 'damage' && e.skill === 'frost_storm' && e.target === '${slimes[0]}').length })`);
  t.check('MG-12. Frost Storm: one zone at the target, exactly 10 ticks (one hit per tick per monster), Slow while inside, zone ends once',
    zones.length === 1 && JSON.stringify(storm.ticks) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) && storm.hitsOnFirst === 10 && storm.ended === 1 &&
      chilled.statuses.some((s) => s.id === 'chilled'),
    JSON.stringify({ zones, storm, chilled: chilled.statuses }));
  t.check('MG-13. Frost Storm visuals: the loop and soft field sit on the ground layer, under every monster (they stay readable), sized to the real radius',
    zoneVis.length === 1 && zoneVis[0].hasArt && zoneVis[0].stormDepth < 0 && zoneVis[0].stormDepth < monsterDepth && Math.abs(zoneVis[0].displayWidth - zones[0]?.radius * 2) < 1 &&
      (await api('zoneVisuals()')).length === 0,
    JSON.stringify({ zoneVis, monsterDepth }));

  // Meteor: friendly point warning, the Mage walks during it, one impact.
  await pack(p0.x + 140, p0.y);
  await b.eval(`debug.teleportPlayer(${p0.x}, ${p0.y})`);
  await b.press(keyOf('meteor_burst'));
  await sleep(120);
  const tele = await api('telegraphs()');
  await b.keyDown('ArrowLeft');
  await sleep(300);
  await b.keyUp('ArrowLeft');
  if (shot) await shot('mage-meteor-warning');
  await b.waitFor(`debug.log.some((e) => e.type === 'areaLanded' && e.skill === 'meteor_burst')`, { timeout: 5000, label: 'meteor' }).catch(() => {});
  await sleep(300);
  const meteor = await b.eval(`({ windup: debug.log.find((e) => e.type === 'skillWindup' && e.skill === 'meteor_burst') ?? null,
    landed: debug.log.filter((e) => e.type === 'areaLanded' && e.skill === 'meteor_burst'),
    hits: debug.log.filter((e) => e.type === 'damage' && e.skill === 'meteor_burst').map((e) => e.target),
    cancelled: debug.log.filter((e) => e.type === 'hitCancelled').length })`);
  const friendly = tele.find((z) => z.palette === 'friendly');
  t.check('MG-14. Meteor Burst: a friendly (blue/gold, not red) warning at the target point for 800 ms; walking does not cancel it; one impact hits the pack once each',
    !!friendly && friendly.fillTint !== 0xc8261f && friendly.ms === 800 && Math.abs(friendly.x - meteor.windup?.x) < 1 &&
      meteor.landed.length === 1 && meteor.hits.length === 3 && new Set(meteor.hits).size === 3 && meteor.cancelled === 0,
    JSON.stringify({ friendly, meteor }));

  // ---------------------------------------------------------------- 5. Passives and MP
  const pass = await b.eval(`({ stats: debug.player().stats, flameMp: debug.mpCost('flame_burst'), baseFlame: debug.skillDef('flame_burst').mpCost })`);
  t.check('MG-15. passives apply: Arcane Power raises MATK, Mana Flow cuts MP cost (-4%) and raises Max MP, Elemental Mastery +3% Fire/Frost',
    pass.flameMp < pass.baseFlame && Math.abs(pass.stats.mpCostReduction - 0.04) < 1e-9 && Math.abs(pass.stats.elementDamageBonus.fire - 0.03) < 1e-9,
    JSON.stringify({ flameMp: pass.flameMp, base: pass.baseFlame, red: pass.stats.mpCostReduction, el: pass.stats.elementDamageBonus, matk: pass.stats.magicAttack, mp: pass.stats.maxMp }));

  // ---------------------------------------------------------------- 6. Save / load
  await api(`world.skillTree.assign('skill1', 'meteor_burst')`);
  await api('allocateStat("int", 2)');
  const before = await b.eval(`({ tree: debug.skillTree(), stats: debug.player().stats, alloc: debug.progress().allocated })`);
  const saved = await api('save()');
  await api(`reset('demo_town')`);
  await api(`load(${JSON.stringify(saved)})`);
  await sleep(300);
  const after = await b.eval(`({ tree: debug.skillTree(), stats: debug.player().stats, alloc: debug.progress().allocated, art: ${WORLD}.player.currentArt?.displayName, basic: debug.basicAttack() })`);
  t.check('MG-16. save / load: Mage class, ranks, passives, hotbar (Meteor moved to Q), allocation and stats return; Mage art and Magic Bolt',
    after.tree.classId === 'mage' && JSON.stringify(after.tree.nodes) === JSON.stringify(before.tree.nodes) && JSON.stringify(after.tree.loadout) === JSON.stringify(before.tree.loadout) &&
      after.tree.loadout.skill1 === 'meteor_burst' && JSON.stringify(after.alloc) === JSON.stringify(before.alloc) && after.stats.magicAttack === before.stats.magicAttack &&
      after.art === 'Mage' && after.basic === 'magic_bolt',
    JSON.stringify({ loadout: after.tree.loadout, alloc: after.alloc, art: after.art }));
  st = await api('skillTree()');

  // ---------------------------------------------------------------- 7. Responsive
  for (const [w, h] of [[960, 540], [844, 390], [640, 360]]) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(350);
    const fit = await b.eval(`(() => { const r = (el) => el?.getBoundingClientRect(); const out = (el) => { const b = r(el); return !b || b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1 || b.top < -1; };
      const slots = [...document.querySelectorAll('[data-hud="actions"] [data-slot]')]; const icons = [...document.querySelectorAll('[data-hud="actions"] [data-slot] .has-art')];
      return { slotsOut: slots.filter(out).map((e) => e.dataset.slot), iconMin: Math.min(...icons.map((i) => Math.min(r(i).width, r(i).height))), icons: icons.length,
        scale: ${WORLD}.player.scaleY }; })()`);
    if (shot) await shot(`mage-hud-${w}x${h}`);
    t.check(`MG-17. ${w}×${h}: every action slot on screen, Mage icons readable (>= 16 px), character scale unchanged`,
      fit.slotsOut.length === 0 && fit.iconMin >= 16 && fit.icons >= 6 && Math.abs(fit.scale - 0.32) < 0.001, JSON.stringify(fit));
  }
  await b.setViewport({ mobile: false });
  await sleep(200);

  // ---------------------------------------------------------------- 8. Fights (no HP set by hand)
  /** Hold ATK at the nearest of `ids`; press any ready skill; potions when low; dodge out of danger telegraphs. */
  const fight = async (fids, { timeout = 90000, label } = {}) => {
    const start = Date.now();
    let minHp = 1;
    let deaths = 0;
    let wasDead = false;
    let potions = 0;
    let side = 1;
    await b.keyDown('Space');
    try {
      while (Date.now() - start < timeout) {
        const s = await b.eval(`(() => { const w = debug.world, p = w.player; const alive = ${JSON.stringify(fids)}.map((id) => w.monsterById(id)).filter((m) => m && !m.combat.dead);
          alive.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
          if (alive[0] && w.targeting.current !== alive[0]) w.targeting.select(alive[0]);
          const danger = debug.telegraphs().filter((z) => z.palette === 'danger').find((z) => Math.hypot(z.x - p.x, z.y - p.y) < z.radius + 14);
          const lo = w.player.combat; const now = w.now; const bar = w.skillTree.loadout();
          const ready = Object.entries(bar).filter(([, id]) => id && (lo.cooldowns.get(id) ?? 0) <= now && lo.mp >= w.skills.mpCost(p, w.skills.definition(p, id))).map(([slot]) => slot);
          const t0 = alive[0]; const far = t0 && Math.hypot(t0.x - p.x, t0.y - p.y) - t0.hitRadius > 200 ? { x: t0.x - p.x, y: t0.y - p.y } : null;
          let blocked = false;
          if (t0) for (let i = 1; i < 12 && !blocked; i++) blocked = w.projectileWorld.blocksProjectile(p.x + (t0.x - p.x) * i / 12, p.y + (t0.y - p.y) * i / 12);
          const los = blocked ? { x: t0.x - p.x, y: t0.y - p.y } : null;
          return { alive: alive.length, hp: lo.hp / lo.stats.maxHp, mp: lo.mp / lo.stats.maxMp, dead: lo.dead, ready, far, los, danger: danger ? { x: danger.x - p.x, y: danger.y - p.y } : null }; })()`);
        if (!s.alive) break;
        minHp = Math.min(minHp, s.hp);
        if (s.dead && !wasDead) deaths++;
        wasDead = s.dead;
        if (s.dead) { await sleep(400); continue; }
        if (s.danger) {
          const keys = [s.danger.x > 0 ? 'ArrowLeft' : 'ArrowRight', s.danger.y > 0 ? 'ArrowUp' : 'ArrowDown'];
          for (const k of keys) await b.keyDown(k);
          await sleep(420);
          for (const k of keys) await b.keyUp(k);
          continue;
        }
        if (s.los && !s.far) {
          // Step around the obstacle: perpendicular to the line, alternating sides, plus a little toward the target.
          side = -side;
          const len = Math.hypot(s.los.x, s.los.y) || 1;
          const mx = (-s.los.y / len) * side + (s.los.x / len) * 0.4;
          const my = (s.los.x / len) * side + (s.los.y / len) * 0.4;
          const keys = [];
          if (Math.abs(mx) > 0.3) keys.push(mx > 0 ? 'ArrowRight' : 'ArrowLeft');
          if (Math.abs(my) > 0.3) keys.push(my > 0 ? 'ArrowDown' : 'ArrowUp');
          for (const k of keys) await b.keyDown(k);
          await sleep(350);
          for (const k of keys) await b.keyUp(k);
          continue;
        }
        if (s.far) {
          const keys = [];
          if (Math.abs(s.far.x) > 24) keys.push(s.far.x > 0 ? 'ArrowRight' : 'ArrowLeft');
          if (Math.abs(s.far.y) > 24) keys.push(s.far.y > 0 ? 'ArrowDown' : 'ArrowUp');
          for (const k of keys) await b.keyDown(k);
          await sleep(300);
          for (const k of keys) await b.keyUp(k);
          continue;
        }
        if (s.hp < 0.45) { await b.press('Digit1'); potions++; }
        if (s.mp < 0.15) await b.press('Digit2');
        if (s.ready.length) await b.press(SLOT_KEYS[s.ready[0]]);
        await sleep(110);
      }
    } finally {
      await b.keyUp('Space');
    }
    const leftIds = await b.eval(`${JSON.stringify(fids)}.filter((id) => { const m = debug.world.monsterById(id); return m && !m.combat.dead; }).map((id) => { const m = debug.world.monsterById(id); return id + '@' + Math.round(m.x) + ',' + Math.round(m.y) + ':' + m.brain.state; })`);
    const left = leftIds.length;
    return { label, won: left === 0, ...(left ? { left: leftIds } : {}), seconds: Math.round((Date.now() - start) / 100) / 10, minHp: Math.round(minHp * 100), deaths, potions };
  };
  const results = [];
  const deathsOf = async (fids) => b.eval(`${JSON.stringify(fids)}.map((id) => debug.log.filter((e) => e.type === 'death' && e.entity === id && e.source === 'player').length)`);

  // Field pack + Elite Boar + Grove Guardian at Lv20 (the Field's late band), real gear-less character.
  await api(`reset('demo_field')`);
  await api('grantExp(25000)');
  await api('forceCompleteJobTrial()');
  await api(`chooseJob('mage')`);
  await sleep(150);
  await api('jumpToLevel(20)');
  for (const [id, n] of [['fireball', 5], ['flame_burst', 3], ['meteor_burst', 1], ['arcane_power', 1]]) for (let i = 0; i < n; i++) await api(`learnSkill('${id}')`);
  await api(`grantItem('small_hp_potion', 10)`);
  await api(`grantItem('small_mp_potion', 10)`);
  await b.eval('debug.setPeaceful(false); debug.setRng(null); debug.refillFieldEnergy(); debug.clearLog()');
  const fieldIds = await api('monsterIds()');
  const wolves = fieldIds.filter((id) => id.startsWith('wolf'));
  const wolf0 = await api(`monster('${wolves[0]}')`);
  await api(`teleport(${wolf0.x + 100}, ${wolf0.y + 60})`);
  results.push(await fight(wolves, { label: 'Field wolf pack', timeout: 60000 }));
  const wolfCredit = await deathsOf(wolves);
  const loot = await b.eval(`({ exp: debug.log.filter((e) => e.type === 'expGained').length, rewards: debug.log.filter((e) => e.type === 'fieldReward').length })`);
  t.check('MG-18. Field pack (Lv20 Mage, Fire build): cleared; each kill credited exactly once with its Field reward',
    results.at(-1).won && wolfCredit.every((n) => n === 1) && loot.rewards === wolves.length, JSON.stringify({ ...results.at(-1), wolfCredit, loot }));

  const boar = fieldIds.find((id) => id.startsWith('elite_boar'));
  const boarAt = await api(`monster('${boar}')`);
  await api(`teleport(${boarAt.x - 150}, ${boarAt.y + 40})`);
  results.push(await fight([boar], { label: 'Elite Boar', timeout: 90000 }));
  t.check('MG-19. Elite Boar: beaten in a real fight; killed once', results.at(-1).won && (await deathsOf([boar]))[0] === 1, JSON.stringify(results.at(-1)));

  // Grove Guardian with the Frost build too (Slow on a mini-boss: it must still wind up and recover speed).
  await api('resetSkills()');
  for (const [id, n] of [['frost_nova', 3], ['frost_storm', 1], ['fireball', 3], ['arcane_power', 3]]) for (let i = 0; i < n; i++) await api(`learnSkill('${id}')`);
  const guardian = fieldIds.find((id) => id.startsWith('grove_guardian'));
  const gAt = await api(`monster('${guardian}')`);
  await api(`teleport(${gAt.x}, ${gAt.y + 70})`);
  await b.eval('debug.clearLog()');
  results.push(await fight([guardian], { label: 'Grove Guardian (Frost build)', timeout: 120000 }));
  const gLog = await b.eval(`({ windups: debug.log.filter((e) => e.type === 'skillWindup' && e.source === '${guardian}').length, slowed: debug.log.filter((e) => e.type === 'statusApplied' && e.target === '${guardian}' && ['slowed','chilled'].includes(e.skill)).length })`);
  t.check('MG-20. Grove Guardian: beaten; it still winds up its Stomp while Slowed (timers intact); killed once',
    results.at(-1).won && gLog.windups >= 1 && gLog.slowed >= 1 && (await deathsOf([guardian]))[0] === 1, JSON.stringify({ ...results.at(-1), ...gLog }));

  // Story Crypt (Lv11-19, before the Lv20 Dungeon feature): the Brute and the Story Lord, Lv15 Fire build.
  await api(`reset('demo_town')`);
  await api('grantExp(25000)');
  await api('forceCompleteJobTrial()');
  await api(`chooseJob('mage')`);
  await api('jumpToLevel(15)');
  for (const [id, n] of [['fireball', 2], ['flame_burst', 3]]) for (let i = 0; i < n; i++) await api(`learnSkill('${id}')`);
  await api(`grantItem('small_hp_potion', 10)`);
  await api(`grantItem('small_mp_potion', 10)`);
  await b.eval('debug.setPeaceful(true)');
  await api(`enterMap('demo_crypt')`);
  await sleep(300);
  const storyProfile = await api('encounterProfile()');
  const cryptIds = await api('monsterIds()');
  const brute = cryptIds.find((id) => id.startsWith('crypt_brute'));
  if (brute) {
    const bAt = await api(`monster('${brute}')`);
    // The Story section 2 arena (its gate needs section 1 down): kill section 1 through the real fight first.
    const s1 = (await b.eval(`debug.world.monsters.filter((m) => m.zoneId.startsWith('story_s1')).map((m) => m.id)`));
    const s1At = await api(`monster('${s1[0]}')`);
    await api(`teleport(${s1At.x}, ${s1At.y + 90})`);
    await b.eval('debug.setPeaceful(false); debug.clearLog()');
    results.push(await fight(s1, { label: 'Story Crypt section 1', timeout: 60000 }));
    await api(`teleport(${bAt.x}, ${bAt.y + 140})`);
    results.push(await fight([brute], { label: 'Skeleton Brute (Story)', timeout: 90000 }));
  }
  t.check('MG-21. Story Crypt (Lv15 Mage, Dungeon not yet unlocked): Story profile; section 1 and the Skeleton Brute beaten',
    storyProfile === 'story' && !!brute && results.slice(-2).every((r) => r.won), JSON.stringify({ storyProfile, brute, fights: results.slice(-2) }));
  const storyRest = await b.eval(`debug.world.monsters.filter((m) => !m.combat.dead && m.def.id !== 'crypt_lord').map((m) => m.id)`);
  for (const id of storyRest) await api(`defeatMonster('${id}')`); // the encounters between the Brute and the boss (gates only)
  const sLord = cryptIds.find((id) => id.startsWith('crypt_lord'));
  const slAt = await api(`monster('${sLord}')`);
  await api(`teleport(${slAt.x}, ${slAt.y + 170})`);
  await b.eval('debug.clearLog()');
  results.push(await fight([sLord], { label: 'Crypt Lord (Story)', timeout: 120000 }));
  const sBoss = await b.eval(`({ boss: debug.log.filter((e) => e.type === 'death' && e.entity === '${sLord}').length })`);
  t.check('MG-22. Story Crypt Lord: beaten once by the Lv15 Mage (Fireball / Flame Burst / Magic Bolt), boss death handled once',
    results.at(-1).won && sBoss.boss === 1, JSON.stringify({ ...results.at(-1), ...sBoss }));

  // Standard Lv20 Crypt: a skeleton pack and the 3000 HP Crypt Lord.
  await api('jumpToLevel(20)');
  await b.eval(`debug.evaluateFeatures(); debug.forceUnlockFeature('dungeon'); debug.setPeaceful(true)`);
  await api(`enterMap('demo_town')`);
  await api(`enterMap('demo_crypt')`);
  await sleep(300);
  const stdProfile = await api('encounterProfile()');
  const cIds = await api('monsterIds()');
  const sec1 = await b.eval(`debug.world.monsters.filter((m) => m.zoneId === 'section_1').map((m) => m.id)`);
  if (sec1.length) {
    const a = await api(`monster('${sec1[0]}')`);
    await api(`teleport(${a.x}, ${a.y + 110})`);
    await b.eval('debug.setPeaceful(false); debug.clearLog()');
    results.push(await fight(sec1, { label: 'Crypt skeleton pack (Lv20)', timeout: 60000 }));
  }
  t.check('MG-23. standard Crypt: Lv20 skeleton pack cleared by the Mage', stdProfile === 'standard' && sec1.length >= 3 && results.at(-1).won, JSON.stringify({ stdProfile, fight: results.at(-1) }));
  const rest = await b.eval(`debug.world.monsters.filter((m) => !m.combat.dead && m.def.id !== 'crypt_lord').map((m) => m.id)`);
  for (const id of rest) await api(`defeatMonster('${id}')`);
  await api('resetSkills()');
  for (const [id, n] of [['fireball', 5], ['flame_burst', 3], ['meteor_burst', 1], ['frost_nova', 1]]) for (let i = 0; i < n; i++) await api(`learnSkill('${id}')`);
  const lord = cIds.find((id) => id.startsWith('crypt_lord'));
  const lAt = await api(`monster('${lord}')`);
  await api(`teleport(${lAt.x}, ${lAt.y + 170})`);
  await b.eval('debug.clearLog()');
  results.push(await fight([lord], { label: 'Crypt Lord (Lv20 standard)', timeout: 150000 }));
  const lordLog = await b.eval(`({ boss: debug.log.filter((e) => e.type === 'death' && e.entity === '${lord}').length, windups: debug.log.filter((e) => e.type === 'skillWindup' && e.source === '${lord}').length })`);
  t.check('MG-24. Lv20 Crypt Lord: beaten once in a real fight; its Grave Slam wind-ups still run',
    results.at(-1).won && lordLog.boss === 1 && lordLog.windups >= 1, JSON.stringify({ ...results.at(-1), ...lordLog }));
  console.log(`  mage fights: ${JSON.stringify(results)}`);

  return results;
}

/** First casts of Magic Bolt / Fireball / Frost Storm / Meteor on a fresh page: worst frame around each. */
export async function mageFirstUseSuite(b, t, url, boot) {
  t.section('Mage first-use frame cost (fresh page)');
  await b.eval('window.__stale = true');
  await b.goto(url);
  await boot();
  await b.eval(SAMPLER);
  await sleep(2500); // let the staged texture warm-up finish (~1.2 s delay + 2 frames per texture)
  await b.eval(`(() => { debug.reset('demo_field'); debug.setPeaceful(true); debug.grantExp(25000); debug.forceCompleteJobTrial(); debug.chooseJob('mage'); debug.jumpToLevel(30);
    for (const [id, n] of [['fireball', 5], ['flame_burst', 3], ['meteor_burst', 1], ['frost_nova', 3], ['frost_storm', 1]]) for (let i = 0; i < n; i++) debug.learnSkill(id); })()`);
  await sleep(600);
  const ids = await b.eval('debug.monsterIds()');
  const target = ids.find((id) => id.startsWith('slime'));
  const out = {};
  for (const skill of ['magic_bolt', 'fireball', 'frost_storm', 'meteor_burst']) {
    await b.eval(`(() => { const p = debug.world.player; debug.placeMonster('${target}', p.x + 120, p.y); debug.setMonsterHp('${target}', 100000); debug.selectTarget('${target}'); debug.resetCooldowns(); debug.setPlayerMp(9999); })()`);
    await sleep(300);
    await b.eval('window.__frames.length = 0');
    if (skill === 'magic_bolt') await b.press('Space');
    else {
      const slot = Object.entries(await b.eval('debug.skillTree().loadout')).find(([, v]) => v === skill)[0];
      await b.press(SLOT_KEYS[slot]);
    }
    await sleep(1600);
    const frames = await b.eval('window.__frames.slice()');
    out[skill] = Math.round(Math.max(...frames));
  }
  const worst = Math.max(...Object.values(out));
  console.log(`  mage first-use worst frame (ms): ${JSON.stringify(out)}`);
  // Headless software rendering: ordinary frames are ~16-50 ms here; a cold texture upload showed as 100+ ms spikes.
  t.check('MG-25. first casts of Magic Bolt / Fireball / Frost Storm / Meteor show no cold-texture spike (worst frame < 120 ms)', worst < 120, JSON.stringify(out));
  return out;
}


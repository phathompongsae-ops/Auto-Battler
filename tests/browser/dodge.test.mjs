import { sleep } from './cdp.mjs';
const W = `game.scene.getScene('World').world`;
export async function dodgeSuite(b, t) {
  t.section('Shared Basic Dodge');
  await b.eval(`debug.reset(); debug.setPeaceful(true); ${W}.player.facing = 'right'`);
  await sleep(150);
  const before = await b.eval('debug.player()');
  await b.press('ShiftLeft');
  await sleep(300);
  const after = await b.eval(`({ x: ${W}.player.x, y: ${W}.player.y, cd: (${W}.player.combat.utilityCooldowns.get('dodge') || 0) - ${W}.now })`);
  t.check('DG-1. Shift performs a 72px cardinal dodge and starts a separate cooldown', Math.abs(after.x - before.x - 72) < 1 && Math.abs(after.y - before.y) < 1 && after.cd > 4000, JSON.stringify(after));
  await b.press('ShiftRight'); await sleep(100);
  t.check('DG-2. repeat Shift cannot bypass cooldown', Math.abs((await b.eval(`${W}.player.x`)) - after.x) < 1);
  await b.eval(`debug.reset(); debug.setPeaceful(true); ${W}.player.facing = 'right'`);
  const pos = await b.eval(`${W}.player.x`);
  const rect = await b.eval(`(() => { const r = document.querySelector('[data-slot=dodge]').getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
  await b.mouse('mousePressed', rect.x, rect.y); await b.mouse('mouseReleased', rect.x, rect.y); await sleep(300);
  t.check('DG-3. utility button requests the same Dodge path', Math.abs((await b.eval(`${W}.player.x`)) - pos - 72) < 1);
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); debug.teleportPlayer(512, 1354); ${W}.player.facing='up'`);
  await b.press('ShiftLeft'); await sleep(300);
  t.check('DG-4. Dodge stops before a closed Story gate', await b.eval(`${W}.player.y >= 1340`));
  for (const [monsterId, skill, delay] of [['crypt_brute','brute_smash_story',1150], ['crypt_lord','crypt_slam_story',850]]) {
    await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); debug.teleportPlayer(512, ${monsterId === 'crypt_brute' ? 1150 : 400}); ${W}.player.facing='right'; (() => { const w=${W}; const m=w.monsters.find(m => m.def.id === '${monsterId}'); m.body.reset(w.player.x,w.player.y); w.skills.use(m,'${skill}',w.now); })()`);
    const hp = await b.eval('debug.player().hp');
    await sleep(delay); await b.press('ShiftLeft'); await sleep(400);
    t.check(`DG-5. ${monsterId} telegraph is dodged through real damage resolution`, await b.eval('debug.player().hp') === hp);
  }
  // Holding ATK: a swing locks 444 of every 500 ms. A Shift pressed mid-swing must still dodge (once the swing ends).
  await b.eval(`debug.reset(); debug.setPeaceful(true); (() => { const w = ${W}; const p = w.player; debug.placeMonster('slime-1', p.x + 30, p.y); debug.setMonsterHp('slime-1', 100000); debug.selectTarget('slime-1'); debug.resetCooldowns(); debug.clearLog(); })()`);
  await sleep(150);
  await b.keyDown('Space');
  await b.waitFor(`debug.log.some((e) => e.type === 'skillUsed' && e.skill === 'basic_attack')`, { timeout: 2000, label: 'swing starts' }).catch(() => {});
  await sleep(120);
  const midSwing = await b.eval(`${W}.player.combat.actionLocked(${W}.now)`);
  await b.press('ShiftLeft');
  await sleep(600);
  await b.keyUp('Space');
  const dodged = await b.eval(`(${W}.player.combat.utilityCooldowns.get('dodge') || 0) > ${W}.now`);
  t.check('DG-6. Shift pressed mid-swing while holding ATK still dodges once the swing ends (no lost press, swing not cancelled)', midSwing && dodged, JSON.stringify({ midSwing, dodged }));
  // A tap whose key-down and key-up arrive in the same frame (a quick tap, or a tap during a hitch) still counts.
  await b.eval(`debug.reset(); debug.setPeaceful(true); ${W}.player.facing = 'right'`);
  await sleep(150);
  const x0 = await b.eval(`${W}.player.x`);
  await Promise.all([b.keyDown('ShiftLeft'), b.keyUp('ShiftLeft')]);
  await sleep(350);
  const x1 = await b.eval(`${W}.player.x`);
  t.check('DG-7. a zero-length Shift tap (down and up in one frame) still dodges', Math.abs(x1 - x0 - 72) < 1, JSON.stringify({ x0, x1 }));
  await b.eval('debug.reset()');
}

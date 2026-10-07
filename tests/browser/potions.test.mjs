import { sleep } from './cdp.mjs';
const W = `game.scene.getScene('World').world`;
export async function potionSuite(b, t) {
  t.section('Potion recovery and Auto Potion');
  await b.eval(`debug.reset(); debug.setPeaceful(true); ${W}.inventory.add('small_hp_potion',3); ${W}.inventory.add('small_mp_potion',3); debug.setPlayerHp(100); debug.setPlayerMp(0)`);
  await sleep(150); await b.press('Digit1'); await b.press('Digit2'); await sleep(150);
  const result = await b.eval(`({ hp: debug.player().hp, mp: debug.player().mp, hpCount: ${W}.inventory.count('small_hp_potion'), mpCount: ${W}.inventory.count('small_mp_potion'), hpCD: ${W}.player.combat.utilityCooldowns.get('hp_potion')-${W}.now, mpCD:${W}.player.combat.utilityCooldowns.get('mp_potion')-${W}.now })`);
  t.check('PT-1. keys 1/2 consume real independent potions and restore resources', result.hp === 200 && result.mp >= 50 && result.hpCount === 2 && result.mpCount === 2 && result.hpCD > 7000 && result.mpCD > 11000, JSON.stringify(result));
  await b.eval(`debug.reset(); debug.setPeaceful(true); ${W}.inventory.add('small_hp_potion',2); ${W}.inventory.add('small_mp_potion',2); debug.setPlayerHp(100); debug.setPlayerMp(0)`);
  for (const id of ['potion','mp_potion']) {
    const r = await b.eval(`(() => { const r=document.querySelector('[data-slot=${id}]').getBoundingClientRect(); return { x:r.x+r.width/2,y:r.y+r.height/2 }; })()`);
    await b.mouse('mousePressed',r.x,r.y); await b.mouse('mouseReleased',r.x,r.y); await sleep(80);
  }
  t.check('PT-2. separate utility buttons consume HP/MP inventory items', await b.eval(`${W}.inventory.count('small_hp_potion') === 1 && ${W}.inventory.count('small_mp_potion') === 1`));
  await b.eval(`debug.reset(); debug.setPeaceful(true); ${W}.inventory.add('small_hp_potion',2); debug.setPlayerHp(100); (() => { const w=${W}; const m=w.monsters[0]; m.body.reset(w.player.x,w.player.y+28); debug.selectTarget(m.id); w.skills.use(w.player,'power_strike',w.now,{target:m}); window.__pending = w.skills.pendingCount(); window.__mp = w.player.combat.mp; })()`);
  const lock = await b.eval(`({ result:${W}.usePreferredPotion('hp'), pending:${W}.skills.pendingCount(), items:${W}.inventory.count('small_hp_potion') })`);
  t.check('PT-3. potion cannot cancel a pending skill action or consume an item while locked', !lock.result.ok && lock.result.reason === 'action_locked' && lock.pending > 0 && lock.items === 2, JSON.stringify(lock));
  const saved = await b.eval(`(${W}.player.progress.autoPotions.hpEnabled=false, ${W}.player.progress.autoPotions.mpThreshold=18, debug.save())`);
  await b.eval(`debug.load(${JSON.stringify(saved)})`);
  t.check('PT-4. reload retains item counts and Auto Potion preferences', await b.eval(`${W}.inventory.count('small_hp_potion') === 2 && !${W}.player.progress.autoPotions.hpEnabled && ${W}.player.progress.autoPotions.mpThreshold === 18`));
  await b.eval('debug.reset()');
}

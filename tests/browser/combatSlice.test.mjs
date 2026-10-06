// Combat vertical slice in the running game: Warrior basic attack, monster AI, damage/death/respawn,
// EXP / level-up, Gold and drops, the Field Elite and the Dungeon Boss encounters, and the combat UI.
import { sleep } from './cdp.mjs';

export async function combatSliceSuite(b, t, shot) {
  t.section('Combat vertical slice');
  const api = (expr) => b.eval(`debug.${expr}`);
  const events = (filter) => b.eval(`debug.log.filter(${filter})`);
  const player = () => api('player()');
  const target = () =>
    b.eval(`(() => { const el = document.querySelector('[data-hud="target"]'); const bar = el.querySelector('[data-bar="hp"]');
      return { hidden: el.hidden, id: el.dataset.targetId ?? null, tier: el.dataset.tier ?? null, state: el.dataset.state ?? '', text: el.textContent, ratio: Number(bar.dataset.ratio ?? 1) }; })()`);
  /** Active floating combat texts (damage numbers, +EXP, +Gold...). */
  const floating = () => b.eval(`game.scene.getScene('World').children.list.filter((o) => o.type === 'Text' && o.active && o.visible).map((o) => o.text)`);
  const hit = async (id, hp) => {
    const p = await player();
    await b.eval(`debug.placeMonster('${id}', ${p.x}, ${p.y - 40}); debug.resetCooldowns(); debug.selectTarget('${id}')${hp ? `; debug.setMonsterHp('${id}', ${hp})` : ''}`);
    await b.press('Space');
  };

  // Field test ground, a Lv11 Warrior.
  await api('reset()');
  await b.eval(`debug.setServerDay(60); debug.setPeaceful(true); debug.setRng(0.5); debug.jumpToLevel(11); debug.forceChangeJob('warrior'); debug.clearLog()`);
  await sleep(200);

  // 1. Warrior basic attack on a Field wolf + target frame + damage feedback.
  await hit('wolf-1');
  await sleep(120);
  let dmg = await events(`e => e.type === 'damage' && e.source === 'player' && e.skill === 'basic_attack' && e.target === 'wolf-1'`);
  let tf = await target();
  const texts = await floating();
  t.check(
    'CS-1. the Warrior basic attack damages a Field wolf; the target frame shows its name, level and HP; a damage number pops',
    (await api(`jobState().classId`)) === 'warrior' && dmg.length === 1 && !tf.hidden && tf.id === 'wolf-1' && tf.text.includes('Wolf') && tf.text.includes('Lv 2') &&
      tf.ratio < 1 && texts.includes(String(dmg[0].amount)),
    JSON.stringify({ dmg: dmg.map((d) => d.amount), tf, texts }),
  );

  // 2. Kill: EXP, Gold, a drop picked up, Field Energy spent.
  const before = await b.eval(`({ exp: debug.player().exp, gold: debug.equipment().gold, energy: debug.fieldEnergy() })`);
  await b.eval(`debug.setRng(0); debug.clearLog()`); // every drop chance succeeds
  await hit('wolf-1', 1);
  await b.waitFor(`debug.monster('wolf-1').dead`, { timeout: 2000, label: 'wolf dies' });
  const drop = (await api('drops()')).find((d) => d.item === 'wolf_fang');
  if (drop) await api(`teleport(${drop.x}, ${drop.y})`);
  await sleep(250);
  const after = await b.eval(`({ exp: debug.player().exp, gold: debug.equipment().gold, energy: debug.fieldEnergy(), inv: debug.player().inventory })`);
  const gold = await events(`e => e.type === 'goldGained'`);
  tf = await target();
  t.check(
    'CS-2. killing it grants EXP and Gold, spends Field Energy, drops its material (picked up), and clears the target frame',
    after.exp > before.exp && after.gold === before.gold + 6 && gold.length === 1 && after.energy === before.energy - 1 && after.inv.wolf_fang === 1 && tf.hidden,
    JSON.stringify({ before, after, gold, tf }),
  );
  await b.eval('debug.setRng(0.5)');

  // 3. Level-up from a kill.
  await b.eval(`(() => { const w = debug.world; w.player.combat.exp = debug.expToNext(w.player.combat.level) - 1; debug.clearLog(); })()`);
  const lv = (await player()).level;
  await hit('wolf-2', 1);
  await b.waitFor(`debug.monster('wolf-2').dead`, { timeout: 2000, label: 'wolf-2 dies' });
  const ups = await events(`e => e.type === 'levelUp'`);
  t.check('CS-3. the EXP from a kill levels the player up', ups.length === 1 && (await player()).level === lv + 1, JSON.stringify({ ups, lv }));

  // 4. AI: aggro → chase → attack → leash/return (HP restored), player takes damage and the HP bar shows it.
  await b.eval(`debug.setPeaceful(false); debug.clearLog()`);
  const home = await api(`monster('mushroom-1')`);
  await api(`teleport(${home.spawnX + 110}, ${home.spawnY})`);
  await b.waitFor(`['chase','attack'].includes(debug.monster('mushroom-1').state)`, { timeout: 1500, label: 'mushroom aggro' });
  await b.waitFor(`debug.log.some(e => e.type === 'damage' && e.source === 'mushroom-1' && e.target === 'player')`, { timeout: 4000, label: 'mushroom hits' });
  const hpBar = await b.eval(`Number(document.querySelector('[data-hud="player"] [data-bar="hp"]').dataset.ratio)`);
  await b.eval(`debug.setMonsterHp('mushroom-1', 20)`);
  await api(`teleport(${home.spawnX - 520}, ${home.spawnY - 40})`);
  await b.waitFor(`debug.monster('mushroom-1').state === 'return'`, { timeout: 2000, label: 'leash' });
  const back = await b.waitFor(`debug.monster('mushroom-1').state === 'idle' && debug.monster('mushroom-1')`, { timeout: 8000, label: 'returns home' });
  t.check(
    'CS-4. a Field mushroom aggroes, chases, hits the player (HP bar drops), then leashes home and resets to full HP',
    hpBar < 1 && Math.hypot(back.x - back.spawnX, back.y - back.spawnY) < 6 && back.hp === back.maxHp,
    JSON.stringify({ hpBar, back }),
  );

  // 5. Elite encounter: telegraphed Gore (target frame warns), dodged by stepping away; then the kill drops its tusk.
  await b.eval(`debug.setPeaceful(true); debug.setPlayerHp(9999); debug.clearLog()`);
  const elite = await api(`monster('elite_boar-1')`);
  await api(`teleport(${elite.spawnX - 40}, ${elite.spawnY})`);
  await b.eval(`debug.selectTarget('elite_boar-1'); debug.setPeaceful(false)`);
  await b.waitFor(`debug.log.some(e => e.type === 'skillWindup' && e.source === 'elite_boar-1' && e.skill === 'boar_gore')`, { timeout: 8000, label: 'Gore wind-up' });
  tf = await target();
  const elitePos = await api(`monster('elite_boar-1')`);
  await shot('combat-slice-01-elite-telegraph');
  await api(`teleport(${elitePos.x - 160}, ${elitePos.y})`); // step out of reach before it lands
  await b.waitFor(`debug.log.some(e => e.type === 'hitCancelled' && e.source === 'elite_boar-1')`, { timeout: 2000, label: 'Gore dodged' });
  const goreHits = await events(`e => e.type === 'damage' && e.skill === 'boar_gore'`);
  t.check(
    'CS-5. the Field Elite telegraphs Gore (target frame shows Elite + wind-up) and stepping out of reach dodges it',
    tf.tier === 'elite' && tf.state === 'windup' && tf.text.includes('Elite Boar') && goreHits.length === 0,
    JSON.stringify({ tf, goreHits: goreHits.length }),
  );
  await b.eval(`debug.setPeaceful(true); debug.setRng(0); debug.clearLog()`);
  await hit('elite_boar-1', 1);
  await b.waitFor(`debug.monster('elite_boar-1').dead`, { timeout: 2000, label: 'elite dies' });
  // Ground drops from the Elite (an earlier wolf kill may have left its boots on the ground); its tusk auto-loots.
  const eliteDrops = (await api('drops()')).map((d) => d.item).filter((i) => i !== 'traveler_boots').sort();
  const tusks = (await player()).inventory.boar_tusk;
  const eliteGold = await events(`e => e.type === 'goldGained'`);
  t.check(
    'CS-6. the Elite tusk (guaranteed) auto-loots; its Enhancement Stone and equipment wait on the ground; it pays Elite Gold',
    tusks === 1 && JSON.stringify(eliteDrops) === '["enhancement_stone","iron_sword","traveler_vest"]' && eliteGold[0]?.amount === 40,
    JSON.stringify({ tusks, eliteDrops, eliteGold }),
  );
  await b.eval('debug.setRng(0.5)');

  // 6. Death and respawn with the HUD notice.
  await b.eval(`debug.setPeaceful(false); debug.clearLog()`);
  const wolf3 = await api(`monster('wolf-3')`);
  await api(`teleport(${wolf3.spawnX + 30}, ${wolf3.spawnY})`);
  await b.eval(`debug.setPlayerHp(1)`);
  await b.waitFor(`debug.player().dead`, { timeout: 5000, label: 'player dies' });
  const notice = await b.eval(`(() => { const el = document.querySelector('[data-hud="respawn"]'); return { hidden: el.hidden, text: el.textContent }; })()`);
  await b.eval('debug.setPeaceful(true)');
  await b.waitFor(`!debug.player().dead`, { timeout: 8000, label: 'respawn' });
  const respawned = await player();
  const spawn = (await api('mapInfo()')).spawnPoint;
  const noticeAfter = await b.eval(`document.querySelector('[data-hud="respawn"]').hidden`);
  t.check(
    'CS-7. death shows the respawn countdown; the player respawns at the map spawn with full HP',
    !notice.hidden && /Respawning in \d+ s/.test(notice.text) && noticeAfter && respawned.hp === respawned.stats.maxHp &&
      Math.hypot(respawned.x - spawn.x, respawned.y - spawn.y) < 2,
    JSON.stringify({ notice, noticeAfter, hp: [respawned.hp, respawned.stats.maxHp] }),
  );

  // 7. Boss encounter: Lv20 unlocks the Dungeon; the gate starts a run; the boss telegraphs, enrages, and its defeat claims the run.
  await api(`reset('demo_town')`);
  await b.eval(`debug.setServerDay(60); debug.setPeaceful(true); debug.setRng(0.5); debug.jumpToLevel(11); debug.forceChangeJob('warrior'); debug.jumpToLevel(20); debug.clearLog()`);
  const entered = await api(`takePortal('demo_town_to_dungeon')`);
  const status0 = await api('dungeonStatus()');
  const boss = await api(`monster('crypt_lord-1')`);
  await api(`teleport(${boss.spawnX}, ${boss.spawnY + 70})`);
  await b.eval(`debug.setPlayerHp(9999); debug.selectTarget('crypt_lord-1'); debug.setPeaceful(false)`);
  await b.waitFor(`debug.log.some(e => e.type === 'skillWindup' && e.source === 'crypt_lord-1' && e.skill === 'crypt_slam')`, { timeout: 8000, label: 'boss slam wind-up' });
  tf = await target();
  await shot('combat-slice-02-boss-telegraph');
  await b.waitFor(`debug.log.some(e => e.type === 'damage' && e.skill === 'crypt_slam' && e.target === 'player')`, { timeout: 3000, label: 'slam lands' });
  // Enrage below its threshold.
  await b.eval('debug.setPeaceful(true)');
  await hit('crypt_lord-1', 900); // 30% of 3000: the next hit crosses the enrage threshold
  await b.waitFor(`debug.log.some(e => e.type === 'monsterEnraged' && e.entity === 'crypt_lord-1')`, { timeout: 2000, label: 'boss enrages' });
  const enragedFrame = await target();
  t.check(
    'CS-8. the Dungeon gate starts a run; the Boss shows in a Boss target frame, telegraphs Grave Slam (it lands if you stay) and enrages at low HP',
    entered && status0.inRun !== null && tf.tier === 'dungeon_boss' && tf.text.includes('Boss') && enragedFrame.state === 'enraged',
    JSON.stringify({ entered, inRun: status0.inRun, tf, enragedFrame }),
  );
  const wallet0 = await b.eval(`debug.equipment().gold`);
  await b.eval(`debug.clearLog()`);
  await hit('crypt_lord-1', 1);
  await b.waitFor(`debug.log.some(e => e.type === 'bossDefeated')`, { timeout: 3000, label: 'boss defeated' });
  const defeated = (await events(`e => e.type === 'bossDefeated'`))[0];
  const status1 = await api('dungeonStatus()');
  const wallet1 = await b.eval(`debug.equipment().gold`);
  const killExp = await events(`e => e.type === 'fieldReward' || (e.type === 'lootDropped')`);
  t.check(
    'CS-9. defeating the Boss resolves the run\'s claim (Full Reward used, Gold granted) and the boss kill itself rewards nothing',
    defeated.rewarded === true && defeated.item === status0.inRun && status1.fullClaimsUsed === status0.fullClaimsUsed + 1 && wallet1 > wallet0 && killExp.length === 0,
    JSON.stringify({ defeated, status0, status1, wallet0, wallet1, killExp }),
  );
  const retry = await api('claimDungeon()');
  t.check('CS-10. the run cannot be claimed twice', retry.ok === false && retry.reason === 'already_claimed', JSON.stringify(retry));

  await api('reset()');
  await b.eval('debug.setRng(null); debug.clearServerDayOverride(); debug.setPeaceful(true)');
}

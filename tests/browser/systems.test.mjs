// Demo system foundation wired into the running game (dev hooks; no final UI).
import { sleep } from './cdp.mjs';

const stats = (b) => b.eval('debug.player().stats');

export async function equipmentSuite(b, t) {
  t.section('Equipment in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.forceUnlockAllFeatures()');
  await sleep(100);

  const bare = await stats(b);
  const cap = await b.eval(`debug.grantEquipment('traveler_cap', 3)`);
  const equipped = await b.eval(`debug.equip(${JSON.stringify(cap)})`);
  const capItem = await b.eval(`debug.equipment().items.find((i) => i.instanceId === ${JSON.stringify(cap)})`);
  const withCap = await stats(b);
  // The cap's enchant line (common = 1) may add more HP/DEF; check the base part and the rest through the line.
  const line = capItem.enchants[0];
  const extraHp = line.optionId === 'max_hp' ? line.value : line.optionId === 'vit' ? line.value * 25 : 0;
  const extraDef = line.optionId === 'def' ? line.value : line.optionId === 'vit' ? line.value : 0;
  t.check(
    'E1. equipping updates live stats immediately',
    equipped.ok && withCap.maxHp === bare.maxHp + 30 + extraHp && withCap.defense === bare.defense + 4 + extraDef,
    `hp ${bare.maxHp}->${withCap.maxHp} def ${bare.defense}->${withCap.defense} line=${line.optionId}:${line.value}`,
  );

  const sword = await b.eval(`debug.grantEquipment('iron_sword', 4)`);
  const rejected = await b.eval(`debug.equip(${JSON.stringify(sword)})`);
  t.check('E2. the Novice cannot equip Warrior gear (demo Warrior is presentation only)', !rejected.ok && rejected.reason === 'class_restricted', JSON.stringify(rejected));

  await b.eval(`debug.grantItem('enhancement_stone', 5); debug.grantGold(10000)`);
  const enh = await b.eval(`debug.enhance(${JSON.stringify(cap)}, { roll: 0 })`);
  const eq = await b.eval('debug.equipment()');
  t.check('E3. enhancement attempt works in game and refreshes stats', enh.ok && enh.success && enh.to === 1 && eq.items.find((i) => i.instanceId === cap).enhancement === 1, JSON.stringify(enh));

  await b.eval(`debug.unequip('head')`);
  const after = await stats(b);
  t.check('E4. unequipping restores the bare stats', after.maxHp === bare.maxHp && after.defense === bare.defense, `hp=${after.maxHp} def=${after.defense}`);

  await b.eval('debug.reset()');
  await sleep(100);
}

export async function petSuite(b, t) {
  t.section('Pets, eggs and the Special Shop in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.forceUnlockAllFeatures()');
  await sleep(100);

  const bare = await stats(b);
  const dragon = await b.eval(`debug.grantPet('dragon', 'legendary', 50)`);
  const inactive = await stats(b);
  await b.eval(`debug.activatePet(${JSON.stringify(dragon)})`);
  const active = await stats(b);
  t.check('P-1. an owned but inactive pet adds nothing', inactive.maxHp === bare.maxHp && inactive.maxMp === bare.maxMp);
  t.check(
    'P-2. Legendary Lv50 INT Dragon: all +15, INT +25 on live stats',
    active.maxHp === bare.maxHp + 15 * 25 && active.maxMp === bare.maxMp + 25 * 15 && active.magicAttack === bare.magicAttack + 25 * 2 && active.attack === bare.attack + 15 * 2,
    `hp ${bare.maxHp}->${active.maxHp} mp ${bare.maxMp}->${active.maxMp}`,
  );
  await b.eval('debug.activatePet(null)');
  const off = await stats(b);
  t.check('P-3. deactivating removes the pet bonus', off.maxHp === bare.maxHp && off.maxMp === bare.maxMp);

  const first = await b.eval('debug.buyEggTicket()');
  const second = await b.eval('debug.buyEggTicket()');
  await b.eval('debug.advanceClock(24 * 3600 * 1000)');
  const nextDay = await b.eval('debug.buyEggTicket()');
  t.check('P-4. one Random Egg Ticket per refresh cycle', first.ok && !second.ok && second.reason === 'limit_reached' && nextDay.ok, JSON.stringify({ first, second, nextDay }));

  const used = await b.eval('debug.useEggTicket(3)');
  const opened = await b.eval(`debug.openEgg(${JSON.stringify(used.tier)}, 5)`);
  const pets = await b.eval('debug.pets()');
  t.check('P-5. ticket -> egg -> pet', used.ok && opened.ok && pets.owned.length === 2 && pets.owned.some((p) => p.petInstanceId === opened.pet.petInstanceId), JSON.stringify({ used, pet: opened.pet }));

  await b.eval('debug.reset()');
  await sleep(100);
}

export async function dungeonRewardSuite(b, t) {
  t.section('Dungeon rewards, daily quota, tickets and Assist in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.setServerDay(3); debug.forceUnlockAllFeatures()');
  const preview = await b.eval(`debug.rollDungeonReward('demo_dungeon', 'hard', 9)`);
  const first = await b.eval(`debug.clearDungeon('demo_dungeon', 'hard', 9)`);
  const firstRun = JSON.stringify(first.run);
  const retry = await b.eval(`debug.claimDungeon(9, ${firstRun})`);
  const inv = await b.eval('debug.player().inventory');
  const eq = await b.eval('debug.equipment()');
  let status = await b.eval('debug.dungeonStatus()');
  const level = await b.eval('debug.levelInfo()');
  t.check(
    'D-1. a boss clear grants its Full Reward once (EXP included); a retry grants nothing',
    first.result.ok && first.result.kind === 'full' && JSON.stringify(first.result.reward) === JSON.stringify(preview) &&
      !retry.ok && retry.reason === 'already_claimed' &&
      inv.boss_fragment === 2 && eq.gold === preview.gold && eq.items.length === preview.equipment.length &&
      status.fullClaimsUsed === 1 && level.level > 1,
    JSON.stringify({ result: first.result.kind, retry, inv, status, level: level.level }),
  );

  await b.eval(`debug.enterDungeon('demo_dungeon', 'hell'); debug.leaveDungeon()`);
  status = await b.eval('debug.dungeonStatus()');
  t.check('D-2. entering and leaving without a clear uses nothing', status.fullClaimsUsed === 1 && status.fullRewardsLeft === 4, JSON.stringify(status));

  const kinds = await b.eval(`[2, 3, 4, 5, 6].map((seed, i) => debug.clearDungeon('demo_dungeon', ['normal', 'hard', 'hell'][i % 3], seed).result.kind)`);
  t.check('D-3. Normal/Hard/Hell share 5 Full Rewards; the 6th clear is an Assist', JSON.stringify(kinds) === JSON.stringify(['full', 'full', 'full', 'full', 'assist']), JSON.stringify(kinds));

  await b.eval('debug.grantDungeonTicket(3)');
  const t1 = await b.eval(`debug.useItem('additional_dungeon_ticket')`);
  const c6 = await b.eval(`debug.clearDungeon('demo_dungeon', 'normal', 7).result.kind`);
  const t2 = await b.eval(`debug.useItem('additional_dungeon_ticket')`);
  const c7 = await b.eval(`debug.clearDungeon('demo_dungeon', 'hell', 8).result.kind`);
  const t3 = await b.eval(`debug.useItem('additional_dungeon_ticket')`);
  const tickets = (await b.eval('debug.player().inventory')).additional_dungeon_ticket;
  status = await b.eval('debug.dungeonStatus()');
  t.check(
    'D-4. tickets (real item path) allow Full Rewards #6 and #7; a third fails and is kept',
    t1.ok && t2.ok && c6 === 'full' && c7 === 'full' && !t3.ok && t3.reason === 'daily_extra_limit' && tickets === 1 && status.fullClaimsUsed === 7,
    JSON.stringify({ t1, t2, t3, c6, c7, tickets, status }),
  );

  const assists = await b.eval(`[11, 12, 13].map((seed) => debug.clearDungeon('demo_dungeon', 'normal', seed).result.kind)`);
  status = await b.eval('debug.dungeonStatus()');
  t.check('D-5. 3 rewarded Assists, then helping is allowed but unrewarded', JSON.stringify(assists) === JSON.stringify(['assist', 'assist', 'none']) && status.assistRewardsClaimed === 3, JSON.stringify({ assists, status }));
  t.check('D-6. a whole day of dungeon activity leaves Field Energy untouched', (await b.eval('debug.fieldEnergy()')) === 200);

  const saved = await b.eval('debug.save()');
  await b.eval('debug.reset(); debug.setServerDay(3)');
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  const afterLoad = await b.eval('debug.dungeonStatus()');
  const replay = await b.eval(`debug.claimDungeon(9, ${firstRun})`);
  t.check(
    'D-7. counters survive save/load and a claimed run stays claimed',
    loaded.ok && afterLoad.fullClaimsUsed === 7 && afterLoad.extraAdded === 2 && afterLoad.assistRewardsClaimed === 3 && !replay.ok && replay.reason === 'already_claimed',
    JSON.stringify({ loaded, afterLoad, replay }),
  );

  await b.eval('debug.setServerDay(4)');
  status = await b.eval('debug.dungeonStatus()');
  t.check('D-8. a new server day resets the dungeon quota, tickets used and Assists', status.fullRewardsLeft === 5 && status.extraAdded === 0 && status.assistRewardsClaimed === 0, JSON.stringify(status));
  await b.eval('debug.reset()');
}

// Demo system foundation wired into the running game (dev hooks; no final UI).
import { sleep } from './cdp.mjs';

const stats = (b) => b.eval('debug.player().stats');

export async function equipmentSuite(b, t) {
  t.section('Equipment in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true)');
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
  await b.eval('debug.reset(); debug.setPeaceful(true)');
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

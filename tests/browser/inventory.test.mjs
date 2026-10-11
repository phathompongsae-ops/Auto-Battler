// Inventory + Equipment + Loot UX in the running game:
// kill -> loot (auto + ground) -> open inventory -> compare -> equip -> stats change -> unequip -> stats return,
// plus Gold in the HUD, the loot feed, bag-full handling and save/load.
import { sleep } from './cdp.mjs';

export async function inventorySuite(b, t, shot) {
  t.section('Inventory, equipment and loot UX');
  const api = (expr) => b.eval(`debug.${expr}`);
  const player = () => api('player()');
  const stats = async () => (await player()).stats;
  const feed = () => b.eval(`[...document.querySelectorAll('[data-hud="loot-feed"] [data-loot-kind]')].map((e) => e.dataset.lootKind + ':' + e.textContent)`);
  const hudGold = () => b.eval(`document.querySelector('[data-hud="gold"]').textContent`);
  const click = (selector) => b.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  const clickTab = (windowId, label) =>
    b.eval(`(() => { const tab = [...document.querySelectorAll('[data-window="${windowId}"] .ui-tab')].find((x) => x.textContent === '${label}'); tab?.click(); return !!tab; })()`);
  const killMushroom = async (id) => {
    const p = await player();
    await b.eval(`debug.placeMonster('${id}', ${p.x}, ${p.y - 40}); debug.resetCooldowns(); debug.selectTarget('${id}'); debug.setMonsterHp('${id}', 1)`);
    await b.press('Space');
    await b.waitFor(`debug.monster('${id}').dead`, { timeout: 2000, label: `${id} dies` });
    await sleep(120);
  };

  // A fresh Novice on the Field; every drop chance succeeds.
  await api('reset()');
  await b.eval(`debug.setPeaceful(true); debug.setRng(0); debug.setEquipmentIds('drop'); debug.clearLog()`);
  await sleep(150);
  const bare = await stats();

  // 1. Kill -> loot: the cap material auto-loots, the equipment drop waits on the ground; Gold in the HUD; loot feed.
  await killMushroom('mushroom-1');
  let p = await player();
  const ground = await api('drops()');
  let lines = await feed();
  t.check(
    'I-1. a kill auto-loots its normal reward and Gold; its equipment drop waits on the ground; the HUD shows Gold and a loot feed',
    p.inventory.mushroom_cap === 1 && ground.length === 1 && ground[0].kind === 'equipment' && ground[0].item === 'traveler_cap' &&
      (await hudGold()) === '5 G' && lines.some((l) => l === 'item:+1 Mushroom Cap') && lines.some((l) => l === 'gold:+5 Gold') &&
      lines.some((l) => l.startsWith("rare:Drop: Traveler's Cap on the ground")),
    JSON.stringify({ inv: p.inventory, ground, gold: await hudGold(), lines }),
  );
  await shot('inventory-01-loot-feed');

  // 2. Walk onto the equipment drop: picked up as a real owned instance.
  await api(`teleport(${ground[0].x}, ${ground[0].y})`);
  await b.waitFor(`debug.drops().length === 0`, { timeout: 1500, label: 'equipment pickup' });
  const bag1 = await api('bag()');
  lines = await feed();
  t.check(
    'I-2. walking over the equipment drop picks it up into the bag (the loot feed names it)',
    bag1.entries.some((e) => e.kind === 'equipment' && e.id === 'traveler_cap' && e.instanceId === 'drop-1') && lines.some((l) => l.startsWith("equipment:Equipment: Traveler's Cap")),
    JSON.stringify({ bag: bag1.entries.map((e) => e.name), lines }),
  );

  // 3. Open the inventory: sorted (equipment first), usage, select -> details + comparison.
  await b.press('KeyI');
  await sleep(120);
  const inv = await b.eval(`(() => {
    const w = document.querySelector('[data-window="inventory"]');
    const slots = [...w.querySelectorAll('[data-bag-key]')].map((s) => s.dataset.kind + ':' + s.title);
    return { open: !!w, slots, usage: w.querySelector('[data-role="bag-usage"]').textContent, gold: w.querySelector('[data-role="gold"]').textContent };
  })()`);
  await click('[data-window="inventory"] [data-bag-key^="eq:"]');
  await sleep(80);
  const details = await b.eval(`(() => {
    const d = document.querySelector('[data-window="inventory"] [data-role="details"]');
    return { instance: d.dataset.instance, text: d.textContent, deltas: [...d.querySelectorAll('[data-stat]')].map((x) => [x.dataset.stat, Number(x.dataset.delta), x.textContent]),
      layers: [...d.querySelectorAll('[data-layer]')].map((x) => x.dataset.layer), sell: d.querySelector('[data-role="sell-value"]').textContent };
  })()`);
  t.check(
    'I-3. the Inventory window lists the bag sorted (equipment first) with usage and Gold; selecting the cap shows its stats, sell value and a comparison with the empty head slot',
    inv.open && inv.slots[0] === "equipment:Traveler's Cap" && inv.slots.includes('item:Mushroom Cap') && inv.usage === 'Bag 2 / 48' && inv.gold === '5 G' &&
      details.instance === 'drop-1' && details.layers.includes('enhancement') && details.text.includes('BaseDEF +4') && details.text.includes('slot is empty') && details.sell.startsWith('Sell value') &&
      details.deltas.some(([k, d]) => k === 'maxHp' && d > 0) && details.deltas.some(([k, d]) => k === 'defense' && d > 0),
    JSON.stringify({ inv, details }),
  );
  await shot('inventory-02-compare');

  // 4. Equip from the window: stats change immediately, as predicted; the cap leaves the bag.
  const predicted = Object.fromEntries(details.deltas.map(([k, d]) => [k, d]));
  await click('[data-window="inventory"] [data-action="equip"]');
  await sleep(80);
  const worn = await stats();
  const bag2 = await api('bag()');
  t.check(
    'I-4. Equip: the head slot takes the cap and stats change immediately by exactly the previewed amounts',
    (await api('equipment()')).equipped.head === 'drop-1' && worn.maxHp === bare.maxHp + predicted.maxHp && worn.defense === bare.defense + predicted.defense &&
      !bag2.entries.some((e) => e.kind === 'equipment'),
    JSON.stringify({ bare: [bare.maxHp, bare.defense], worn: [worn.maxHp, worn.defense], predicted }),
  );
  await b.press('Escape');

  // 5. Character -> Equipment: Unequip -> stats return; the cap is back in the bag.
  await b.press('KeyC');
  await sleep(80);
  await clickTab('character', 'Equipment');
  await sleep(80);
  const row = await b.eval(`document.querySelector('[data-window="character"] [data-slot="head"]').getAttribute('aria-label')`);
  // Select the head slot on the paper doll; its details offer Unequip.
  await click('[data-window="character"] [data-slot="head"]');
  await sleep(60);
  await click('[data-window="character"] [data-role="details"] [data-action="unequip"]');
  await sleep(80);
  const unworn = await stats();
  const bag3 = await api('bag()');
  t.check(
    'I-5. Character shows the cap in the paper doll head slot; selecting it and Unequip returns every stat and puts it back in the bag',
    row.includes("Traveler's Cap") && unworn.maxHp === bare.maxHp && unworn.defense === bare.defense && (await api('equipment()')).equipped.head === null &&
      bag3.entries.some((e) => e.kind === 'equipment' && e.instanceId === 'drop-1'),
    JSON.stringify({ row, unworn: [unworn.maxHp, unworn.defense] }),
  );
  await b.press('Escape');

  // 6. Bag full: a new item stays on the ground with a warning (an existing stack still takes more); unequip is refused.
  await api(`equip('drop-1')`);
  const free = await api('fillBag()');
  await b.eval('debug.clearLog()');
  await killMushroom('mushroom-2'); // its cap fits the existing Mushroom Cap stack
  await killMushroom('wolf-1'); // Wolf Fang needs a new slot
  const full = await api('bag()');
  const leftovers = (await api('drops()')).map((d) => d.item).sort();
  p = await player();
  const capBefore = p.inventory.mushroom_cap;
  lines = await feed();
  const refused = await api(`unequip('head')`);
  t.check(
    'I-6. with a full bag an existing stack still grows, a new item falls back to the ground (with a "Bag full" notice), and unequip is refused',
    free === 0 && full.free === 0 && JSON.stringify(leftovers) === '["traveler_boots","traveler_cap","wolf_fang"]' && capBefore === 2 &&
      (p.inventory.wolf_fang ?? 0) === 0 && lines.some((l) => l.startsWith('full:Bag full: Wolf Fang')) && refused.ok === false && refused.reason === 'inventory_full',
    JSON.stringify({ free, leftovers, capBefore, lines, refused }),
  );

  // 7. Save -> reset -> load: the bag (stacks and equipment) and the equipped cap come back; stats match.
  await b.eval(`debug.world.inventory.remove('slime_gel', debug.world.inventory.count('slime_gel'))`);
  const before = { stats: await stats(), bag: await api('bag()'), equipped: (await api('equipment()')).equipped };
  const saved = await api('save()');
  await api('reset()');
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  const after = { stats: await stats(), bag: await api('bag()'), equipped: (await api('equipment()')).equipped };
  t.check(
    'I-7. save -> reset -> load restores the bag, the equipped cap and the same stats',
    loaded.ok && JSON.stringify(after.bag.entries) === JSON.stringify(before.bag.entries) && after.equipped.head === 'drop-1' &&
      after.stats.maxHp === before.stats.maxHp && after.stats.defense === before.stats.defense,
    JSON.stringify({ before: before.bag.entries.map((e) => e.name), after: after.bag.entries.map((e) => e.name) }),
  );

  await api('reset()');
  await b.eval('debug.setRng(null)');
}

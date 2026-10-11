// Character / Inventory UX: one view behind both windows. Real equipment, real stats, real wallet; Equip /
// Unequip / Use through the normal player actions; categories, selection, Thai and three viewports.
import { sleep } from './cdp.mjs';

const W = (id) => `[data-window=${id}]`;

export async function characterInventorySuite(b, t, shot) {
  t.section('Character window / Inventory UX');
  const click = async (sel) => {
    await b.eval(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'nearest' })`);
    const r = await b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (!r) return false;
    await b.mouse('mousePressed', r[0], r[1]);
    await b.mouse('mouseReleased', r[0], r[1]);
    await sleep(80);
    return true;
  };
  const tab = async (win, label) => {
    const ok = await b.eval(`(() => { const x = [...document.querySelectorAll('${W(win)} .hero-tabs .ui-tab')].find((e) => e.textContent === ${JSON.stringify(label)}); if (!x) return false; x.click(); return true; })()`);
    await sleep(60);
    return ok;
  };
  const view = (win) => b.eval(`(() => {
    const w = document.querySelector('${W(win)}'); if (!w) return null;
    const text = (sel) => w.querySelector(sel)?.textContent ?? null;
    return {
      gold: text('[data-role=gold]'), diamond: text('[data-role=diamond]'), usage: text('[data-role=bag-usage]'),
      tab: w.querySelector('.hero-tabs .ui-tab.is-active')?.textContent ?? null,
      doll: [...w.querySelectorAll('[data-role=equipment] [data-slot]')].map((e) => ({ slot: e.dataset.slot, rarity: e.dataset.rarity ?? null, enh: e.querySelector('.hero-cell__enh')?.textContent ?? '', label: e.getAttribute('aria-label'), empty: e.classList.contains('ui-slot--empty') })),
      bag: [...w.querySelectorAll('[data-bag-key]')].map((e) => ({ key: e.dataset.bagKey, kind: e.dataset.kind, title: e.title, count: e.querySelector('.ui-slot__count')?.textContent ?? '', better: !!e.querySelector('[data-role=better]'), rarity: e.dataset.rarity })),
      cells: w.querySelectorAll('.hero-grid > .ui-slot').length,
      stats: Object.fromEntries([...w.querySelectorAll('[data-role=hero-stats] [data-stat]')].map((e) => [e.dataset.stat, { value: e.querySelector('.hero-stat__value').textContent, gear: e.querySelector('.hero-stat__gear')?.textContent ?? '' }])),
      details: (() => { const d = w.querySelector('[data-role=details]'); return d ? { instance: d.dataset.instance ?? null, item: d.dataset.item ?? null, text: d.textContent, actions: [...d.querySelectorAll('[data-action]')].map((x) => x.dataset.action + (x.disabled ? ':disabled' : '')) } : null; })(),
      result: text('[data-role=result]'),
    };
  })()`);

  // A Lv40 Warrior: +7 Iron Sword and +3 Guardian Helm worn; spare gear, potions and materials in the bag.
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); debug.jumpToLevel(40); debug.forceChangeJob('warrior'); debug.setEquipmentIds('ci');
    (() => { for (const [id, enh] of [['iron_sword', 7], ['guardian_helm', 3]]) { const i = debug.grantEquipment(id); debug.setEnhancement(i, enh); debug.equip(i); }
      for (const id of ['steel_greatsword', 'traveler_boots']) debug.grantEquipment(id);
      debug.grantItem('small_hp_potion', 5); debug.grantItem('slime_gel', 12); debug.grantItem('enhancement_stone', 3);
      debug.grantGold(4321); debug.world.wallet.add('diamond', 37); debug.setPlayerHp(Math.floor(debug.player().stats.maxHp / 2)); })(); true`);
  await sleep(200);

  // 1. Opens from the bottom strip; nine real slots on the paper doll; worn gear shows rarity and enhancement.
  await click('[data-hud=systems] [data-menu=character]');
  let v = await view('character');
  const wallet = await b.eval(`({ gold: debug.world.wallet.get('gold'), diamond: debug.world.wallet.get('diamond') })`);
  const bag = await b.eval(`debug.bag()`);
  const dollBy = (id) => v.doll.find((d) => d.slot === id);
  t.check('CI-1. Character opens from the strip: the nine real equipment slots around the hero, worn items with rarity frame and +N badge, empty slots labelled',
    !!v && v.doll.length === 9 && JSON.stringify(v.doll.map((d) => d.slot).sort()) === JSON.stringify(['armor', 'boots', 'gloves', 'head', 'necklace', 'off_hand', 'ring_1', 'ring_2', 'weapon']) &&
      dollBy('weapon').enh === '+7' && dollBy('weapon').label === 'Weapon: +7 Iron Sword' && dollBy('head').enh === '+3' && dollBy('head').rarity === 'rare' &&
      dollBy('boots').empty && dollBy('boots').label === 'Boots: Empty' && (await b.eval(`!!document.querySelector('${W('character')} [data-role=hero-preview]').style.backgroundImage`)),
    JSON.stringify(v?.doll));
  t.check('CI-2. Gold, Diamond and bag usage are the real wallet and bag values',
    v.gold === `${wallet.gold.toLocaleString('en-US')} G` && v.diamond === wallet.diamond.toLocaleString('en-US') && v.usage === `Bag ${bag.used} / ${bag.capacity}`, JSON.stringify({ v: [v.gold, v.diamond, v.usage], wallet, bag: [bag.used, bag.capacity] }));
  const stats = (await b.eval(`debug.player()`)).stats;
  t.check('CI-3. stats are the live combat stats (ATK, DEF, HP, MP, MATK exact; CRIT %; ASPD attacks per second), with the gear share shown for worn gear',
    v.stats.attack.value === String(stats.attack) && v.stats.defense.value === String(stats.defense) && v.stats.maxHp.value === String(stats.maxHp) &&
      v.stats.maxMp.value === String(stats.maxMp) && v.stats.magicAttack.value === String(stats.magicAttack) && v.stats.critChance.value === `${Math.round(stats.critChance * 1000) / 10}%` &&
      Number(v.stats.aspd.value) > 0 && v.stats.attack.gear.startsWith('+') && v.stats.defense.gear.startsWith('+'), JSON.stringify({ shown: v.stats, stats }));
  await shot('character-01-overview');

  // 2. Categories: All lists the whole bag plus free cells; each tab shows exactly its kind; selection never rebuilds the grid.
  const keys = (list) => list.map((e) => e.key).sort().join();
  const allView = v;
  await tab('character', 'Equipment'); const eq = await view('character');
  await tab('character', 'Consumables'); const con = await view('character');
  await tab('character', 'Materials'); const mat = await view('character');
  t.check('CI-4. All shows every bag entry plus free cells to capacity; Equipment / Consumables / Materials split it exactly',
    keys(allView.bag) === keys(bag.entries) && allView.cells === bag.capacity &&
      eq.bag.every((e) => e.kind === 'equipment') && eq.bag.length === bag.entries.filter((e) => e.kind === 'equipment').length &&
      con.bag.map((e) => e.key).join() === bag.entries.filter((e) => e.type === 'consumable').map((e) => e.key).join() &&
      mat.bag.length === bag.entries.filter((e) => e.kind === 'item' && e.type !== 'consumable').length && mat.bag.every((e) => e.kind === 'item'),
    JSON.stringify({ all: allView.bag.length, eq: eq.bag.map((e) => e.key), con: con.bag.map((e) => e.key), mat: mat.bag.map((e) => e.key) }));

  await tab('character', 'Consumables');
  const churn = await b.eval(`new Promise((done) => {
    const grid = document.querySelector('${W('character')} .hero-grid'), first = grid.firstElementChild; let changed = 0;
    const o = new MutationObserver((list) => { for (const m of list) if (m.type === 'childList') changed += m.addedNodes.length + m.removedNodes.length; });
    o.observe(grid, { childList: true }); first.click();
    setTimeout(() => { o.disconnect(); done({ changed, same: grid.firstElementChild === first, selected: first.classList.contains('ui-slot--selected') }); }, 150);
  })`);
  v = await view('character');
  t.check('CI-5. selecting an item moves the highlight and fills the details without rebuilding the grid; a potion shows its effect, count and Use',
    churn.changed === 0 && churn.same && churn.selected && v.details?.item === 'small_hp_potion' && v.details.text.includes('Restores 100 HP') && v.details.text.includes('×5') &&
      JSON.stringify(v.details.actions) === '["use"]', JSON.stringify({ churn, details: v.details }));

  // 3. Use: one potion consumed through the real item action; the Consumables tab stays selected.
  const hpBefore = (await b.eval(`debug.player()`)).hp;
  await click(`${W('character')} [data-role=details] [data-action=use]`);
  v = await view('character');
  const after = await b.eval(`({ hp: debug.player().hp, count: debug.player().inventory.small_hp_potion })`);
  t.check('CI-6. Use drinks one potion (count 5 → 4, HP up), reports it, and keeps the Consumables tab',
    after.count === 4 && after.hp > hpBefore && v.result === 'Used Small HP Potion.' && v.tab === 'Consumables' && v.bag[0]?.count === '4', JSON.stringify({ hpBefore, after, result: v.result, tab: v.tab }));

  // 4. Equip / Unequip through the paper doll: stats panel and bag follow the real result.
  await tab('character', 'Equipment');
  v = await view('character');
  const boots = v.bag.find((e) => e.title === "Traveler's Boots");
  await click(`${W('character')} [data-bag-key="${boots.key}"]`);
  const pick = await view('character');
  await click(`${W('character')} [data-role=details] [data-action=equip]`);
  const worn = { view: await view('character'), equipped: (await b.eval(`debug.equipment()`)).equipped.boots, stats: (await b.eval(`debug.player()`)).stats, bag: await b.eval(`debug.bag()`) };
  t.check('CI-7. a strictly better piece is marked; Equip puts it on the doll, and the stats panel and bag usage update to the real values',
    boots.better && JSON.stringify(pick.details.actions) === '["equip"]' && !!worn.equipped && worn.view.doll.find((d) => d.slot === 'boots').label === "Boots: Traveler's Boots" &&
      worn.view.stats.defense.value === String(worn.stats.defense) && worn.view.usage === `Bag ${worn.bag.used} / ${worn.bag.capacity}` && worn.bag.used === bag.used - 1 &&
      worn.view.result === "Equipped Traveler's Boots.", JSON.stringify({ boots, pick: pick.details, worn: { ...worn.view.stats.defense, usage: worn.view.usage, result: worn.view.result }, used: [bag.used, worn.bag.used] }));
  await click(`${W('character')} [data-role=equipment] [data-slot=boots]`);
  const sel = await view('character');
  await click(`${W('character')} [data-role=details] [data-action=unequip]`);
  const back = { view: await view('character'), equipped: (await b.eval(`debug.equipment()`)).equipped.boots, stats: (await b.eval(`debug.player()`)).stats };
  t.check('CI-8. selecting the worn slot offers Unequip; it returns the piece to the bag and every stat',
    sel.details?.actions.join() === 'unequip' && sel.details.text.includes('Equipped') && back.equipped === null && back.view.doll.find((d) => d.slot === 'boots').empty &&
      back.stats.defense === stats.defense && back.view.stats.defense.value === String(stats.defense) && back.view.bag.some((e) => e.title === "Traveler's Boots"),
    JSON.stringify({ sel: sel.details, def: [stats.defense, back.stats.defense] }));

  // 5. One bag, not two copies: the Inventory window (I) shows the same entries; Esc closes; the strip opens it too.
  await b.press('Escape'); await sleep(80);
  const closed = await b.eval(`!document.querySelector('${W('character')}')`);
  await click('[data-hud=systems] [data-menu=inventory]');
  const inv = await view('inventory');
  const bagNow = await b.eval(`debug.bag()`);
  t.check('CI-9. Esc closes; Inventory opens the same view on the same bag (same entries, nothing lost or duplicated)',
    closed && !!inv && inv.doll.length === 9 && keys(inv.bag) === keys(bagNow.entries) && new Set(inv.bag.map((e) => e.key)).size === inv.bag.length, JSON.stringify({ closed, inv: inv?.bag.length, bag: bagNow.entries.length }));
  await b.press('Escape'); await sleep(80);

  // 6. Three viewports: the window fits, the hero, grid, stats and the selected item's action are all on screen.
  const layout = [];
  for (const [width, height, mobile] of [[960, 540, false], [844, 390, false], [640, 360, true]]) {
    await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await sleep(200);
    await b.press('KeyC'); await sleep(150);
    await click(`${W('character')} [data-bag-key^="eq:"]`);
    layout.push(await b.eval(`(() => {
      const w = document.querySelector('${W('character')}'), r = (sel) => { const e = w.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
      const box = w.getBoundingClientRect(), frame = [box.left, box.top, box.right, box.bottom], body = r('.ui-window__body'), inside = (x) => !!x && x[0] >= body[0] - 0.5 && x[1] >= body[1] - 0.5 && x[2] <= body[2] + 0.5 && x[3] <= body[3] + 0.5;
      const parts = { figure: r('[data-role=hero-preview]'), grid: r('.hero-grid'), stats: r('[data-role=hero-stats]'), action: r('[data-role=details] [data-action=equip]'), weapon: r('[data-slot=weapon]'), ring: r('[data-slot=ring_2]') };
      return { size: '${width}x${height}', inView: frame[0] >= 0 && frame[1] >= 0 && frame[2] <= innerWidth && frame[3] <= innerHeight, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, inside(v)])),
        cell: Math.round(w.querySelector('.hero-grid > .ui-slot').getBoundingClientRect().width), figure: Math.round(parts.figure[3] - parts.figure[1]), scrolls: w.querySelector('.ui-window__body').scrollHeight > w.querySelector('.ui-window__body').clientHeight + 1 };
    })()`));
    await shot(`character-02-${width}x${height}`);
    await b.press('Escape'); await sleep(80);
  }
  t.check('CI-10. 960x540, 844x390 and 640x360: the window fits; hero, slots, grid, stats and the Equip action are all visible without scrolling the window; cells >= 36 px',
    layout.every((l) => l.inView && Object.values(l.parts).every(Boolean) && l.cell >= 36 && l.figure >= 80 && !l.scrolls), JSON.stringify(layout));

  // 7. Thai at 640x360 through the real Settings control: labels from the string table, nothing clipped.
  await click('[data-hud=systems] [data-menu=menu]');
  await click(`${W('menu')} [data-screen=settings]`);
  await click(`${W('settings')} [data-locale=th]`);
  await b.press('Escape'); await sleep(80);
  await b.press('KeyC'); await sleep(150);
  await click(`${W('character')} [data-bag-key^="eq:"]`);
  const thai = await b.eval(`(() => {
    const w = document.querySelector('${W('character')}'), fits = (e) => e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 2;
    const tabs = [...w.querySelectorAll('.hero-tabs .ui-tab')], action = w.querySelector('[data-role=details] [data-action]');
    const labels = [...w.querySelectorAll('.hero-cell__slot, .hero-stat dt, .hero-bag')];
    return { title: w.querySelector('.ui-title').textContent, tabs: tabs.map((x) => x.textContent), tabsFit: tabs.every(fits), action: action?.textContent, actionFit: !!action && fits(action),
      labelsFit: labels.every(fits), usage: w.querySelector('[data-role=bag-usage]').textContent, boots: w.querySelector('[data-slot=boots]').getAttribute('aria-label'),
      rowFit: (() => { const t = w.querySelector('.hero-tabs').getBoundingClientRect(), r = w.querySelector('.hero-right').getBoundingClientRect(); return t.right <= r.right + 0.5; })() };
  })()`);
  await shot('character-03-thai-640x360');
  await b.press('Escape'); await sleep(80);
  await click('[data-hud=systems] [data-menu=menu]');
  await click(`${W('menu')} [data-screen=settings]`);
  await click(`${W('settings')} [data-locale=en]`);
  await b.press('Escape'); await sleep(80);
  await b.setViewport({ mobile: false }); await sleep(150);
  t.check('CI-11. Thai 640x360: title, category tabs, Equip, slot / stat labels and bag usage come from the string table and fit',
    thai.title === 'ตัวละคร' && JSON.stringify(thai.tabs) === JSON.stringify(['ทั้งหมด', 'อุปกรณ์', 'ของใช้', 'วัตถุดิบ']) && thai.tabsFit && thai.rowFit &&
      thai.action === 'สวมใส่' && thai.actionFit && thai.labelsFit && thai.usage.startsWith('กระเป๋า ') && thai.boots === 'รองเท้า: ว่าง' &&
      (await b.eval(`document.querySelector('[data-ui-root]').lang`)) === 'en', JSON.stringify(thai));
}

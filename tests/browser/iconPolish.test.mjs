// Final Thai + icon polish in the running game: illustrated item / equipment / currency / passive art (code-drawn,
// cached), the shared currency mark in Character and Shop, empty-slot silhouettes, proc art in the HUD status row,
// the ?iconArt=off fallback, and Thai labels that fit at 640x360.
import { sleep } from './cdp.mjs';

const W = (id) => `[data-window=${id}]`;

export async function iconPolishSuite(b, t, shot, url, boot) {
  t.section('Final Thai + icon polish');
  const click = (sel) => b.eval(`(() => { const e = document.querySelector('${sel}'); if (e) e.click(); return !!e; })()`);
  const closeAll = async () => { for (let i = 0; i < 3; i++) { await b.press('Escape'); await sleep(60); } };
  const setup = () => b.eval(`(() => { debug.reset('demo_town'); debug.setPeaceful(true); debug.grantExp(25000); debug.forceCompleteJobTrial(); debug.chooseJob('warrior');
    debug.jumpToLevel(20); debug.forceUnlockAllFeatures();
    for (const [id, n] of [['small_hp_potion', 3], ['slime_gel', 5], ['enhancement_stone', 2], ['egg_basic', 1], ['additional_dungeon_ticket', 1]]) debug.grantItem(id, n);
    for (const e of ['iron_sword', 'traveler_cap']) debug.grantEquipment(e);
    debug.unequip('weapon'); debug.unequip('head'); debug.unequip('armor'); return true; })()`).catch(() => b.eval('true'));

  await closeAll();
  await setup();
  await sleep(250);

  // 1. Bag cells: every item / equipment cell shows its illustrated art (a cached data URL), not a lettered disc.
  await click('[data-menu=character]');
  await sleep(300);
  const bag = await b.eval(`(() => { const w = document.querySelector('${W('character')}');
    const cells = [...w.querySelectorAll('[data-bag-key] .ui-slot__icon')];
    return { cells: cells.length, art: cells.filter((c) => c.classList.contains('has-art') && c.style.backgroundImage.startsWith('url("data:image/png')).length,
      letters: cells.filter((c) => c.textContent.trim().length > 0).length };
  })()`);
  t.check('IP-1. every bag cell (items and equipment) draws its illustrated icon; no lettered discs remain',
    bag.cells >= 6 && bag.art === bag.cells && bag.letters === 0, JSON.stringify(bag));

  // 2. Empty paper-doll slots: one subtle silhouette per empty slot, of the right kind, with the slot name kept.
  const doll = await b.eval(`(() => { const w = document.querySelector('${W('character')}');
    return [...w.querySelectorAll('[data-slot]')].map((s) => ({ slot: s.dataset.slot, empty: s.classList.contains('ui-slot--empty'), silhouette: s.querySelector('[data-silhouette]')?.dataset.silhouette ?? null,
      opacity: Number(getComputedStyle(s.querySelector('[data-silhouette]') ?? s).opacity), label: !!s.querySelector('.hero-cell__slot') })); })()`);
  t.check('IP-2. each empty equipment slot shows a faint silhouette of its own slot (9 real slots only) and keeps its name',
    doll.length === 9 && doll.filter((d) => d.empty).length >= 3 && doll.every((d) => d.empty === (d.silhouette === d.slot)) && doll.filter((d) => d.empty).every((d) => d.label && d.opacity < 0.6),
    JSON.stringify(doll));

  // 3. Currency: Character and Shop use the same illustrated coin / gem (same cached image).
  const charCur = await b.eval(`[...document.querySelectorAll('${W('character')} [data-currency-icon]')].map((i) => [i.dataset.currencyIcon, i.src.length, i.naturalWidth])`);
  const charSrc = await b.eval(`Object.fromEntries([...document.querySelectorAll('${W('character')} [data-currency-icon]')].map((i) => [i.dataset.currencyIcon, i.src]))`);
  await shot('icon-01-character');
  await closeAll();
  await click('[data-menu=shop]');
  await sleep(300);
  const shopGold = await b.eval(`document.querySelector('${W('shop')} [data-currency-icon=gold]')?.src ?? null`);
  const shopCells = await b.eval(`[...document.querySelectorAll('${W('shop')} .ui-slot__icon')].map((c) => c.classList.contains('has-art'))`);
  await b.eval(`[...document.querySelectorAll('${W('shop')} [role=tab]')][1].click()`);
  await sleep(200);
  const shopDiamond = await b.eval(`document.querySelector('${W('shop')} [data-currency-icon=diamond]')?.src ?? null`);
  await shot('icon-02-shop-diamond');
  t.check('IP-3. Gold and Diamond use one shared illustrated mark in Character and Shop; Shop items show their icons; Shop stays read-only',
    charCur.length === 2 && charCur.every(([, len, w]) => len > 100 && w > 0) && shopGold === charSrc.gold && shopDiamond === charSrc.diamond &&
      shopCells.length > 0 && shopCells.every(Boolean) && (await b.eval(`[...document.querySelectorAll('${W('shop')} .shop-card__price')].every((x) => x.disabled)`)),
    JSON.stringify({ charCur, shopCells: shopCells.length }));
  await closeAll();

  // 4. Skills: passives / procs show their plate art, actives their medallion icon; the HUD status row shows proc art.
  await b.eval(`debug.learnSkill('heavy_armor_mastery'); true`).catch(() => {});
  await click('[data-menu=skills]');
  await sleep(300);
  const nodes = await b.eval(`[...document.querySelectorAll('${W('skills')} [data-node]')].map((n) => ({ id: n.dataset.node, type: n.dataset.type, icon: n.querySelector('[data-node-icon]')?.dataset.nodeIcon ?? null, ok: (n.querySelector('[data-node-icon]')?.naturalWidth ?? 0) > 0 }))`);
  await shot('icon-03-skills');
  await closeAll();
  await b.eval(`(() => { const s = game.scene.getScene('World'), w = s.world, p = w.player; w.statuses.apply(p, 'guardian_instinct', 3000, w.now); w.statuses.apply(p, 'battle_instinct', 3000, w.now); return true; })()`).catch(() => {});
  await sleep(250);
  const statusArt = await b.eval(`[...document.querySelectorAll('.hud-status [data-status-art]')].map((i) => i.dataset.statusArt)`);
  t.check('IP-4. every skill-tree node has its icon (actives: skill art; passives and procs: plate art); procs show the same plate in the HUD status row',
    nodes.length >= 12 && nodes.every((n) => n.icon === n.type && n.ok) && ['guardian_instinct', 'battle_instinct'].every((id) => statusArt.includes(id)),
    JSON.stringify({ nodes: nodes.map((n) => `${n.id}:${n.icon}`), statusArt }));

  // 5. Icons are drawn once and reused: re-opening windows does not grow the art cache.
  const cache = async () => b.eval(`import('/src/ui/art/iconArt.ts').then((m) => m.iconArtCacheSize())`);
  const before = await cache();
  for (const m of ['character', 'shop', 'character']) { await click(`[data-menu=${m}]`); await sleep(150); await closeAll(); }
  const after = await cache();
  t.check('IP-5. icon art is cached: reopening Character and Shop draws nothing new', before > 0 && after === before, JSON.stringify({ before, after }));

  // 6. Thai at 640x360: the Skills window chrome, the quest window and a world notice come from the string table and fit.
  await b.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  await click('[data-hud=systems] [data-menu=menu]');
  await click(`${W('menu')} [data-screen=settings]`);
  await click(`${W('settings')} [data-locale=th]`);
  await closeAll();
  await click('[data-menu=skills]');
  await sleep(300);
  const thai = await b.eval(`(() => { const w = document.querySelector('${W('skills')}'), fits = (e) => e.scrollWidth <= e.clientWidth + 1;
    const buttons = [...w.querySelectorAll('.ui-button')];
    return { points: w.querySelector('[data-role=points]').textContent, reset: w.querySelector('[data-action=reset]').textContent, slot: w.querySelector('[data-assign-slot]').textContent,
      buttonsFit: buttons.every(fits), english: /Skill Points|Active slots|Clear a slot|Empty|Reset/.test(w.textContent) }; })()`);
  await shot('icon-04-thai-640-skills');
  await closeAll();
  await click('[data-menu=quest]');
  await sleep(250);
  const quest = await b.eval(`document.querySelector('${W('quest')} .ui-list__row')?.textContent ?? ''`);
  await closeAll();
  const notice = await b.eval(`(() => { const s = game.scene.getScene('World'); s.world.events.emit('levelUp', { entityId: s.world.player.id, level: 21 });
    return s.children.list.filter((o) => o.type === 'Text' && /เลเวลอัป/.test(o.text)).length; })()`);
  await shot('icon-05-thai-640-levelup');
  await click('[data-hud=systems] [data-menu=menu]');
  await click(`${W('menu')} [data-screen=settings]`);
  await click(`${W('settings')} [data-locale=en]`);
  await closeAll();
  await b.setViewport({ mobile: false });
  await sleep(150);
  t.check('IP-6. Thai 640x360: Skills chrome (points, Reset, slots), quest phase / rewards and the level-up notice are Thai and the buttons fit',
    thai.points.startsWith('แต้มสกิล') && thai.reset === 'รีเซ็ต (ฟรี)' && thai.slot.endsWith('ว่าง') && thai.buttonsFit && !thai.english &&
      quest.includes('รางวัล:') && notice >= 1, JSON.stringify({ thai, quest, notice }));

  // 7. Fallback: with icon art off, cells keep their lettered discs / glyphs and currencies their vector marks.
  await b.eval('window.__stale = true');
  await b.goto(`${url}?iconArt=off`);
  await boot();
  await setup();
  await sleep(250);
  await click('[data-menu=character]');
  await sleep(300);
  const off = await b.eval(`(() => { const w = document.querySelector('${W('character')}'), cells = [...w.querySelectorAll('[data-bag-key] .ui-slot__icon')];
    return { cells: cells.length, art: cells.filter((c) => c.classList.contains('has-art')).length, fallback: cells.filter((c) => c.textContent.trim() || c.querySelector('svg')).length,
      currencyArt: w.querySelectorAll('[data-currency-icon]').length, currencyGlyph: w.querySelectorAll('[data-currency] svg').length }; })()`);
  await closeAll();
  t.check('IP-7. ?iconArt=off: every cell falls back to its lettered disc / vector glyph and currencies to their vector marks (nothing blank)',
    off.cells >= 6 && off.art === 0 && off.fallback === off.cells && off.currencyArt === 0 && off.currencyGlyph === 2, JSON.stringify(off));
  await b.eval('window.__stale = true');
  await b.goto(url);
  await boot();
}

// Shop shell (Gold / Diamond sections over the temporary catalogue, read-only) and the Thai
// interface foundation: real clicks, real wallet values, no game-state change, glyphs render,
// labels fit. Restores English and the runner's viewport.
import { sleep } from './cdp.mjs';

const W = `game.scene.getScene('World').world`;

/** Strip label fit: no clipped text and no label running into the next one. */
const STRIP_FIT = `(() => {
  const labels = [...document.querySelectorAll('[data-hud=systems] .ui-medallion__label')];
  const rects = labels.map((e) => e.getBoundingClientRect());
  return {
    fit: labels.every((e) => e.scrollWidth <= e.clientWidth + 1) && rects.every((r, i) => i === 0 || r.left >= rects[i - 1].right - 0.5),
    size: parseFloat(getComputedStyle(labels[0]).fontSize),
    font: getComputedStyle(labels[0]).fontFamily,
    text: labels.map((e) => e.textContent),
  };
})()`;

export async function shopAndLanguageSuite(b, t, shot, click) {
  t.section('Shop shell / Thai interface');
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); debug.grantGold(1234); ${W}.wallet.add('diamond', 56)`);
  await sleep(200);
  const state = () => b.eval(`JSON.stringify({ wallet: ${W}.wallet.toRecord(), bag: debug.player().inventory, level: debug.levelInfo() })`);
  const before = await state();

  await click('[data-hud=utilities] [data-menu=shop]');
  const gold = await b.eval(`(() => {
    const w = document.querySelector('[data-window=shop]');
    if (!w) return null;
    return {
      section: w.querySelector('[data-role=shop]').dataset.section,
      balance: w.querySelector('[data-role=shop-balance] strong').textContent,
      entries: [...w.querySelectorAll('[data-shop-entry]')].map((e) => e.dataset.shopEntry),
      temporary: !!w.querySelector('[data-role=shop-temporary]'),
      buyable: [...w.querySelectorAll('[data-shop-entry] button')].filter((e) => !e.disabled).length,
      tabs: [...w.querySelectorAll('[role=tab]')].map((e) => ({ text: e.textContent, h: e.getBoundingClientRect().height })),
    };
  })()`);
  t.check('SHOP-1. Shop utility opens the Shop on the Gold section with the real Gold balance and temporary, unpurchasable entries',
    gold?.section === 'gold' && gold.balance === '1,234' && gold.entries.length === 4 && gold.entries.every((id) => id.startsWith('dev_gold_')) &&
      gold.temporary && gold.buyable === 0 && gold.tabs.length === 2 && gold.tabs.every((tab) => tab.h >= 39.5), JSON.stringify(gold));
  await shot('hud-production-14-shop-gold');

  await b.eval(`[...document.querySelectorAll('[data-window=shop] [role=tab]')][1].click()`);
  await sleep(150);
  const diamond = await b.eval(`(() => {
    const w = document.querySelector('[data-window=shop]');
    return {
      section: w.querySelector('[data-role=shop]').dataset.section,
      balance: w.querySelector('[data-role=shop-balance] strong').textContent,
      entries: [...w.querySelectorAll('[data-shop-entry]')].map((e) => e.dataset.shopEntry),
      selected: w.querySelector('[role=tab][aria-selected=true]').textContent,
    };
  })()`);
  t.check('SHOP-2. Diamond is a separate section with its own balance and entries',
    diamond.section === 'diamond' && diamond.balance === '56' && diamond.selected === 'Diamond' && diamond.entries.length === 4 &&
      diamond.entries.every((id) => id.startsWith('dev_diamond_')), JSON.stringify(diamond));
  await shot('hud-production-15-shop-diamond');

  // Clicking a (disabled) entry button and closing must change nothing.
  await b.eval(`document.querySelector('[data-window=shop] [data-shop-entry] button').click()`);
  await b.press('Escape');
  await sleep(100);
  const closed = await b.eval(`!document.querySelector('[data-window=shop]') && document.querySelector('[data-menu=shop]').getAttribute('aria-expanded') === 'false'`);
  await b.press('KeyB');
  await sleep(100);
  const hotkey = await b.eval(`!!document.querySelector('[data-window=shop]')`);
  await b.press('KeyB');
  await sleep(100);
  const gone = await b.eval(`!document.querySelector('[data-window=shop]')`);
  t.check('SHOP-3. Shop closes (Esc; B toggles), leaves no window behind and changes no wallet / bag / progression state',
    closed && hotkey && gone && (await state()) === before, JSON.stringify({ closed, hotkey, gone }));

  // Thai through the real Settings control (More > Settings > ไทย).
  await click('[data-menu=menu]');
  await click('[data-window=menu] [data-screen=settings]');
  await click('[data-window=settings] [data-locale=th]');
  await sleep(150);
  const strip = await b.eval(STRIP_FIT);
  const thai = await b.eval(`(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '16px ' + ${JSON.stringify(strip.font)};
    // U+0E7F is unassigned: it draws the missing-glyph box, so real Thai glyphs measure differently.
    const glyphs = ctx.measureText('กขคง').width, tofu = ctx.measureText(String.fromCharCode(0xe7f, 0xe7f, 0xe7f, 0xe7f)).width;
    return {
      lang: document.querySelector('[data-ui-root]').lang,
      title: document.querySelector('[data-window=settings] .ui-title')?.textContent,
      shop: document.querySelector('[data-menu=shop]').getAttribute('aria-label'),
      tracker: document.querySelector('.hud-quests__toggle')?.textContent,
      glyphs, tofu,
    };
  })()`);
  t.check('TH-1. switching to Thai relabels the strip, utilities, tracker and the open window from the string table',
    thai.lang === 'th' && JSON.stringify(strip.text) === JSON.stringify(['ตัวละคร', 'กระเป๋า', 'สกิล', 'เควส', 'เพิ่มเติม']) &&
      thai.title === 'ตั้งค่า' && thai.shop === 'ร้านค้า' && thai.tracker === 'ผจญภัย', JSON.stringify({ strip, thai }));
  t.check('TH-2. Thai labels use a Thai-capable face, draw real glyphs (not missing-glyph boxes) and fit without overlap',
    /Leelawadee|Noto Sans Thai|Thonburi|Tahoma/.test(strip.font) && thai.glyphs > 0 && Math.abs(thai.glyphs - thai.tofu) > 0.5 && strip.fit, JSON.stringify({ strip, thai }));
  await b.press('Escape');
  await shot('hud-production-16-thai-960');

  await b.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 1, mobile: true });
  await sleep(250);
  const compact = await b.eval(STRIP_FIT);
  await click('[data-hud=utilities] [data-menu=shop]');
  const shopFits = await b.eval(`(() => {
    const r = document.querySelector('.ui-window[data-window=shop]').getBoundingClientRect(), c = document.querySelector('canvas').getBoundingClientRect();
    const names = [...document.querySelectorAll('[data-window=shop] .shop-card__name')].map((e) => e.getBoundingClientRect().height);
    return { inside: r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom,
      title: document.querySelector('[data-window=shop] .ui-title').textContent, tallestName: Math.max(...names) };
  })()`);
  t.check('TH-3. 640x360 Thai: strip labels stay >= 11px and separate; the Thai Shop window fits the screen, entry names on at most two lines',
    compact.fit && compact.size >= 11 && shopFits.inside && shopFits.title === 'ร้านค้า' && shopFits.tallestName < 40, JSON.stringify({ compact, shopFits }));
  await shot('hud-production-17-thai-640-shop');
  await b.press('Escape');
  await shot('hud-production-18-thai-640');

  // Back to English for every later suite.
  await b.setViewport({ mobile: false });
  await sleep(150);
  await click('[data-menu=menu]');
  await click('[data-window=menu] [data-screen=settings]');
  await click('[data-window=settings] [data-locale=en]');
  await b.press('Escape');
  await sleep(100);
  const english = await b.eval(`({ lang: document.querySelector('[data-ui-root]').lang, more: document.querySelector('[data-menu=menu] .ui-medallion__label').textContent })`);
  t.check('TH-4. English fallback restores in place', english.lang === 'en' && english.more === 'More', JSON.stringify(english));
}

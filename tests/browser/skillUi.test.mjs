// Skill + Character UI redesign: the Skills window as a skill / build screen (header, Q-G loadout, category tabs,
// scannable list, details) over the real SkillTree service, and the Character sheet (stats grouped with the hero,
// never a footer strip), at 960x540, 844x390 and 640x360 in English and Thai.
import { sleep } from './cdp.mjs';

const W = (id) => `[data-window=${id}]`;

export async function skillUiSuite(b, t, shot) {
  t.section('Skill + Character UI redesign');
  const click = (sel) => b.eval(`(() => { const e = document.querySelector('${sel}'); if (e) e.click(); return !!e; })()`);
  const closeAll = async () => { for (let i = 0; i < 3; i++) { await b.press('Escape'); await sleep(60); } };
  const tree = () => b.eval('debug.skillTree()');
  await closeAll();
  await b.eval(`(() => { debug.reset('demo_town'); debug.setPeaceful(true); debug.grantExp(25000); debug.forceCompleteJobTrial(); debug.chooseJob('warrior'); debug.jumpToLevel(20);
    debug.forceUnlockAllFeatures(); debug.learnSkill('power_slash'); debug.learnSkill('charge'); debug.learnSkill('heavy_armor_mastery'); debug.grantEquipment('iron_sword'); return true; })()`);
  await sleep(200);
  await click('[data-menu=skills]');
  await sleep(300);

  // 1. Loadout: exactly five slots Q E R F G; assigned ones show their real skill icon, empty ones a '+'.
  const loadout = await b.eval(`(() => { const lo = debug.skillTree().loadout;
    return [...document.querySelectorAll('${W('skills')} [data-assign-slot]')].map((s) => ({ slot: s.dataset.assignSlot, key: s.querySelector('.skills-slot__key').textContent,
      skill: lo[s.dataset.assignSlot], img: s.querySelector('img')?.getAttribute('src') ?? null, filled: s.classList.contains('is-filled'), plus: s.querySelector('.skills-slot__plus')?.textContent ?? null })); })()`);
  t.check('SK-1. the loadout shows exactly five slots Q-G: equipped skills with their real icon, empty slots with "+"',
    loadout.length === 5 && loadout.map((s) => s.key).join('') === 'QERFG' &&
      loadout.every((s) => (s.skill ? s.filled && s.img === `assets/ui/skills/${s.skill}.png` : !s.filled && s.plus === '+')) && loadout.some((s) => s.skill) && loadout.some((s) => !s.skill),
    JSON.stringify(loadout));

  // 2. Category tabs = the tree's real branches plus a Passive filter; each shows only its rows.
  const tabRows = {};
  for (const tab of ['core', 'tank', 'damage', 'passive']) {
    await click(`${W('skills')} [data-skill-tab=${tab}]`);
    await sleep(80);
    tabRows[tab] = await b.eval(`[...document.querySelectorAll('${W('skills')} [data-node]')].filter((r) => !r.hidden).map((r) => r.dataset.node + ':' + r.dataset.type)`);
  }
  const nodes = (await tree()).nodes;
  t.check('SK-2. tabs Core / Tank / Damage map to the real branches and Passive lists every passive / proc; no invented branch',
    tabRows.core.length > 0 && tabRows.tank.length > 0 && tabRows.damage.length > 0 &&
      tabRows.passive.every((r) => /:(passive|proc)$/.test(r)) && tabRows.passive.length === nodes.filter((n) => n.type === 'passive' || n.type === 'proc').length &&
      (await b.eval(`document.querySelectorAll('${W('skills')} [data-skill-tab]').length`)) === 4,
    JSON.stringify(tabRows));

  // 3. Selecting a row fills the details from real data; badges tell Active from Passive.
  await click(`${W('skills')} [data-skill-tab=core]`);
  await sleep(80);
  await click(`${W('skills')} [data-node=charge]`);
  await sleep(120);
  const detail = await b.eval(`(() => { const d = document.querySelector('${W('skills')} [data-role=skill-detail]'), def = debug.skillDef('charge');
    const stats = Object.fromEntries([...d.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent]));
    return { node: d.dataset.detailNode, badge: d.querySelector('[data-role=badge]').className, stats, cd: def.cooldown, mp: def.mpCost,
      badges: [...document.querySelectorAll('${W('skills')} [data-node]')].map((r) => r.dataset.type + ':' + r.querySelector('[data-role=badge]').classList.contains('skill-badge--passive')) }; })()`);
  t.check('SK-3. selecting a skill shows its details (real cooldown and MP); Active / Passive badges match each node type',
    detail.node === 'charge' && detail.badge.includes('skill-badge--active') && detail.stats.Cooldown === `${detail.cd / 1000}s` && detail.stats['MP cost'] === String(detail.mp) &&
      detail.badges.every((x) => x.endsWith(/^(passive|proc):/.test(x) ? 'true' : 'false')),
    JSON.stringify(detail));

  // 4. Learn / Upgrade from the details goes through the real path.
  await click(`${W('skills')} [data-node=power_slash]`);
  await sleep(80);
  const before = (await tree()).points.available;
  await click(`${W('skills')} [data-role=skill-detail] [data-action=learn]`);
  await sleep(80);
  const after = await tree();
  const rankShown = await b.eval(`document.querySelector('${W('skills')} [data-node=power_slash]').dataset.rank`);
  t.check('SK-4. Upgrade in the details spends one real Skill Point and the row rank follows',
    after.points.available === before - 1 && after.nodes.find((n) => n.id === 'power_slash').rank === 2 && rankShown === '2' &&
      (await b.eval(`document.querySelector('${W('skills')} [data-role=points]').dataset.available`)) === String(after.points.available),
    JSON.stringify({ before, after: after.points, rankShown }));

  // 5. Assignment: tap a learned skill, then a slot (real SkillTree.assign); Unequip clears its slot.
  await click(`${W('skills')} [data-node=charge]`);
  await click(`${W('skills')} [data-assign-slot=skill4]`);
  await sleep(80);
  const assigned = (await tree()).loadout;
  await click(`${W('skills')} [data-node=charge]`);
  await click(`${W('skills')} [data-role=skill-detail] [data-action=unequip-skill]`);
  await sleep(80);
  const cleared = (await tree()).loadout;
  t.check('SK-5. a learned skill moves to the tapped slot (swap, no duplicate) and Unequip empties it, through the real assignment',
    assigned.skill4 === 'charge' && Object.values(assigned).filter((x) => x === 'charge').length === 1 && !Object.values(cleared).includes('charge'),
    JSON.stringify({ assigned, cleared }));
  await click(`${W('skills')} [data-node=charge]`);
  await click(`${W('skills')} [data-assign-slot=skill2]`);
  await closeAll();

  // 6. Layout at three viewports, English and Thai: windows fit; nothing clipped; at 640 the details are a drawer
  //    over the list (loadout still visible); the character stats stay a 2-column block inside the character column.
  const layouts = [];
  for (const lang of ['en', 'th']) {
    if (lang === 'th') {
      await click('[data-hud=systems] [data-menu=menu]');
      await click(`${W('menu')} [data-screen=settings]`);
      await click(`${W('settings')} [data-locale=th]`);
      await closeAll();
    }
    for (const [width, height, mobile] of [[960, 540, false], [844, 390, false], [640, 360, true]]) {
      await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
      await sleep(200);
      await click('[data-menu=skills]');
      await sleep(250);
      const narrow = width < 760;
      const closed = await b.eval(`!!document.querySelector('${W('skills')} .skills-detail')?.offsetParent`);
      await click(`${W('skills')} [data-node=power_slash]`);
      await sleep(120);
      await shot(`skill-ui-${lang}-${width}x${height}`);
      const sk = await b.eval(`(() => { const w = document.querySelector('${W('skills')}'), box = w.getBoundingClientRect(), body = w.querySelector('.ui-window__body').getBoundingClientRect();
        const clipped = [...w.querySelectorAll('.skills-tab, .skills-row__name, .skills-detail__name, .skills-detail .ui-button, .skills-header .ui-button, .skills-slot__key')]
          .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.className);
        const d = w.querySelector('.skills-detail'), dr = d.getBoundingClientRect(), lo = w.querySelector('.skills-loadout').getBoundingClientRect();
        return { inView: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, clipped,
          detail: !!d.offsetParent && dr.bottom <= body.bottom + 1 && dr.top >= lo.bottom - 1, slots: [...w.querySelectorAll('[data-assign-slot]')].filter((s) => s.offsetParent).length,
          scrolls: w.querySelector('.ui-window__body').scrollHeight > w.querySelector('.ui-window__body').clientHeight + 1 }; })()`);
      await closeAll();
      await click('[data-menu=character]');
      await sleep(250);
      await shot(`character-ui-${lang}-${width}x${height}`);
      const ch = await b.eval(`(() => { const w = document.querySelector('${W('character')}'), r = (s) => w.querySelector(s).getBoundingClientRect();
        const left = r('.hero-left'), stats = r('[data-role=hero-stats]'), body = r('.ui-window__body'), right = r('.hero-right');
        return { grouped: stats.left >= left.left - 1 && stats.right <= left.right + 1 && stats.top >= r('.hero-doll').bottom - 1, inside: stats.bottom <= body.bottom + 1,
          cols: getComputedStyle(w.querySelector('[data-role=hero-stats]')).gridTemplateColumns.split(' ').length, notFooter: stats.width < body.width * 0.5, bagDominant: right.width > left.width,
          clipped: [...w.querySelectorAll('.hero-stat, .hero-tabs .ui-tab, .hero-cell__slot')].filter((e) => e.scrollWidth > e.clientWidth + 1).length }; })()`);
      await closeAll();
      layouts.push({ lang, size: `${width}x${height}`, closedAtStart: !closed, ...sk, narrow, character: ch });
    }
  }
  await click('[data-hud=systems] [data-menu=menu]');
  await click(`${W('menu')} [data-screen=settings]`);
  await click(`${W('settings')} [data-locale=en]`);
  await closeAll();
  await b.setViewport({ mobile: false });
  await sleep(150);
  t.check('SK-6. Skills at 960x540 / 844x390 / 640x360 (EN + TH): fits, five slots visible, nothing clipped; details beside the list, or a drawer under the loadout at 640',
    layouts.every((l) => l.inView && l.slots === 5 && l.clipped.length === 0 && l.detail && !l.scrolls && (!l.narrow || l.closedAtStart)), JSON.stringify(layouts.map(({ character, ...l }) => l)));
  t.check('CI-12. Character at the same sizes (EN + TH): stats are a 2-column block under the doll inside the character column (no footer strip), the bag stays dominant, nothing clipped',
    layouts.every((l) => l.character.grouped && l.character.inside && l.character.cols === 2 && l.character.notFooter && l.character.bagDominant && l.character.clipped === 0),
    JSON.stringify(layouts.map((l) => ({ size: `${l.lang} ${l.size}`, ...l.character }))));
  await b.eval(`debug.reset(); true`);
}

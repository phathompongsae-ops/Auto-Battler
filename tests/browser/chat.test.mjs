// Chat panel shell (local only): compact preview, expand / collapse, All / Party / System, real system messages
// archived from the game, no duplicate of visible feed lines, bounded history, Thai, three viewports, and no
// interference with the joystick or the combat cluster.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;
const LOG = `${S}.hud.chatLog`;

export async function chatSuite(b, t, shot) {
  t.section('Chat panel shell (local)');
  const click = async (sel) => {
    const r = await b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (!r) return false;
    await b.mouse('mousePressed', r[0], r[1]);
    await b.mouse('mouseReleased', r[0], r[1]);
    await sleep(80);
    return true;
  };
  const state = () => b.eval(`(() => {
    const c = document.querySelector('[data-hud=chat]'), rect = (e) => { if (!e || e.hidden || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
    const visible = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
    return {
      state: c.dataset.state, preview: rect(c.querySelector('.hud-chat__preview')), panel: rect(c.querySelector('[data-role=chat-panel]')),
      lines: [...c.querySelectorAll('.hud-chat__line')].filter((l) => !l.hidden).map((l) => l.textContent),
      unread: c.querySelector('.hud-chat__unread').hidden ? '' : c.querySelector('.hud-chat__unread').textContent,
      tabs: [...c.querySelectorAll('.hud-chat__tabs .ui-tab')].map((x) => ({ text: x.textContent, active: x.classList.contains('is-active'), fits: x.scrollWidth <= x.clientWidth + 1 })),
      list: [...c.querySelectorAll('[data-role=chat-list] .hud-chat__msg')].map((m) => ({ channel: m.dataset.channel, kind: m.dataset.kind, text: m.lastElementChild.textContent })),
      empty: visible(c.querySelector('[data-role=chat-empty]')) ? c.querySelector('[data-role=chat-empty]').textContent : null,
      feed: [...document.querySelectorAll('[data-hud=loot-feed] .hud-loot__line')].filter(visible).map((e) => e.textContent),
      feedHidden: getComputedStyle(document.querySelector('.hud__loot')).visibility === 'hidden',
      tag: c.querySelector('.hud-chat__tag').textContent,
    };
  })()`);
  const log = () => b.eval(`${LOG}.messages.map((m) => ({ channel: m.channel, kind: m.kind, text: m.text }))`);

  // 1. Real game messages: a kill's Gold and material go to the feed and are archived in System chat;
  //    the compact preview never repeats a line the feed is still showing.
  await b.eval(`debug.reset(); debug.setPeaceful(true); debug.setRng(0); debug.clearLog(); ${LOG}.messages.length; true`);
  await sleep(150);
  const before = (await log()).length;
  const p = await b.eval(`debug.player()`);
  await b.eval(`debug.placeMonster('mushroom-1', ${p.x}, ${p.y - 40}); debug.resetCooldowns(); debug.selectTarget('mushroom-1'); debug.setMonsterHp('mushroom-1', 1)`);
  await b.press('Space');
  await b.waitFor(`debug.monster('mushroom-1').dead`, { timeout: 2000, label: 'mushroom dies' });
  await sleep(200);
  const fresh = await state();
  const archived = (await log()).slice(before);
  t.check('CH-1. a kill\'s Gold and material lines are archived in System chat exactly as the feed shows them; the preview does not repeat visible feed lines',
    archived.some((m) => m.channel === 'system' && m.kind === 'gold' && m.text === '+5 Gold') && archived.some((m) => m.kind === 'item' && m.text === '+1 Mushroom Cap') &&
      fresh.feed.includes('+5 Gold') && !fresh.lines.some((l) => fresh.feed.includes(l)) && fresh.unread !== '' && fresh.state === 'collapsed',
    JSON.stringify({ archived, feed: fresh.feed, preview: fresh.lines, unread: fresh.unread }));
  await sleep(4800);
  const settled = await state();
  t.check('CH-2. once the feed lines expire, the compact preview shows the latest one or two of them (bounded to two lines)',
    settled.feed.length === 0 && settled.lines.length >= 1 && settled.lines.length <= 2 && settled.lines.includes('+1 Mushroom Cap'), JSON.stringify(settled.lines));

  // 2. Quest, level, map and dungeon messages from the real systems.
  await b.eval(`debug.startQuest('mvp_01_welcome'); debug.grantExp(200); debug.enterMap('demo_crypt'); true`);
  await sleep(300);
  const routed = (await log()).slice(before);
  t.check('CH-3. quest accepted, level up and entering the Crypt are logged in System (dungeon entry by map name)',
    routed.some((m) => m.kind === 'quest' && m.text.startsWith('Quest accepted:')) && routed.some((m) => m.kind === 'level' && /^Level up! You reached Lv \d+\.$/.test(m.text)) &&
      routed.some((m) => m.kind === 'map' && m.text === 'Entered Sunken Crypt.') && routed.every((m) => m.channel === 'system'), JSON.stringify(routed.slice(-6)));

  // A Story hint re-sent on re-entry is a new message with the same text: the preview still never repeats it.
  await sleep(7200);
  await b.eval(`debug.enterMap('demo_town'); true`);
  await sleep(200);
  await b.eval(`debug.enterMap('demo_crypt'); true`);
  await sleep(300);
  const reentry = await state();
  const hints = (await log()).filter((m) => m.kind === 'tutorial').map((m) => m.text);
  t.check('CH-11. a hint re-sent on re-entry (same text, new message) is never repeated by the preview while the feed shows it',
    reentry.feed.length > 0 && hints.length >= 2 && new Set(hints).size < hints.length && !reentry.lines.some((l) => reentry.feed.includes(l)), JSON.stringify({ feed: reentry.feed, preview: reentry.lines, hints }));

  // 3. Expand: tabs, full log, feed hidden under it, unread cleared; Party is a clean empty state.
  await click('[data-hud=chat] .hud-chat__preview');
  const open = await state();
  await shot('chat-01-expanded-960');
  const count = (await log()).length;
  t.check('CH-4. tapping the preview expands the panel upward: All / Party / System, the whole log, unread cleared, the feed hidden beneath',
    open.state === 'expanded' && !!open.panel && !open.preview && JSON.stringify(open.tabs.map((x) => x.text)) === '["All","Party","System"]' && open.tabs[0].active &&
      open.list.length === count && open.unread === '' && open.feedHidden && open.panel[3] <= fresh.preview[3] + 70, JSON.stringify({ panel: open.panel, list: open.list.length, count }));
  await b.eval(`[...document.querySelectorAll('[data-hud=chat] .hud-chat__tabs .ui-tab')].find((x) => x.textContent === 'Party').click()`);
  const party = await state();
  await b.eval(`[...document.querySelectorAll('[data-hud=chat] .hud-chat__tabs .ui-tab')].find((x) => x.textContent === 'System').click()`);
  const system = await state();
  t.check('CH-5. Party shows a clean empty state (no party system yet); System lists the system messages',
    party.list.length === 0 && party.empty === 'No party messages. Party play is not part of the Demo yet.' && system.list.length === count && system.list.every((m) => m.channel === 'system'),
    JSON.stringify({ party: party.empty, system: system.list.length }));

  // 4. While expanded the combat cluster still works: the ATK socket is hit-tested and attacks.
  const cluster = await b.eval(`(() => { const panel = document.querySelector('[data-role=chat-panel]').getBoundingClientRect();
    return [...document.querySelectorAll('.hud-actions > .ui-slot, [data-hud=systems] button, [data-hud=player], [data-hud=player-status]')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect();
      return { id: e.dataset.slot ?? e.dataset.menu ?? e.dataset.hud, overlap: r.left < panel.right && r.right > panel.left && r.top < panel.bottom && r.bottom > panel.top }; }).filter((x) => x.overlap); })()`);
  await b.eval(`debug.reset(); debug.setPeaceful(true); debug.setRng(0.5); debug.teleport(528, 464); debug.placeMonster('elite_boar-1', 528, 428); debug.selectTarget('elite_boar-1'); debug.resetCooldowns(); debug.clearLog(); true`);
  await sleep(200);
  const atkHit = await b.eval(`(() => { const r = document.querySelector('[data-slot=attack]').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-slot]')?.dataset.slot; })()`);
  await click('[data-slot=attack]');
  await sleep(250);
  const swung = await b.eval(`debug.log.some((e) => e.type === 'skillUsed' && e.skill === 'basic_attack')`);
  t.check('CH-6. the expanded panel covers no combat socket, system button or player frame; ATK still takes the tap and attacks',
    cluster.length === 0 && atkHit === 'attack' && swung && (await state()).state === 'expanded', JSON.stringify({ cluster, atkHit, swung }));

  // 5. Collapse returns the preview and the feed; a press on the preview never starts the joystick, a drag elsewhere does.
  await click('[data-hud=chat] [data-action=chat-collapse]');
  const shut = await state();
  const pv = shut.preview;
  await b.mouse('mousePressed', (pv[0] + pv[2]) / 2, (pv[1] + pv[3]) / 2);
  const stickOnPreview = await b.eval(`!!${S}.controls?.drag?.origin || !!document.querySelector('[data-hud=joystick][data-active=true]')`);
  await b.mouse('mouseReleased', (pv[0] + pv[2]) / 2, (pv[1] + pv[3]) / 2);
  await sleep(80);
  const reopened = (await state()).state;
  await click('[data-hud=chat] [data-action=chat-collapse]');
  await b.eval(`debug.setPeaceful(true); debug.teleport(528, 464); true`);
  await sleep(100);
  const start = await b.eval(`debug.player()`);
  await b.mouse('mousePressed', 300, 330);
  await sleep(50);
  await b.mouse('mouseMoved', 360, 330);
  await sleep(450);
  const stick = await b.eval(`document.querySelector('[data-hud=joystick]').dataset.active`);
  await b.mouse('mouseReleased', 360, 330);
  const moved = await b.eval(`debug.player()`);
  t.check('CH-7. collapse brings back the preview and the feed; pressing the preview opens chat without starting the joystick; a drag on the world still moves the hero',
    shut.state === 'collapsed' && !!shut.preview && !shut.feedHidden && !stickOnPreview && reopened === 'expanded' && stick === 'true' && moved.x - start.x > 10,
    JSON.stringify({ shut: shut.state, stickOnPreview, reopened, stick, dx: moved.x - start.x }));

  // 6. Bounded history: 400 more messages keep exactly the newest 150, in the log and in the DOM.
  await b.eval(`(() => { for (let i = 0; i < 400; i++) ${LOG}.add('system', 'test', 'Bounded ' + i); return true; })()`);
  await click('[data-hud=chat] .hud-chat__preview');
  const bounded = { log: await b.eval(`[${LOG}.messages.length, ${LOG}.messages[0].text, ${LOG}.messages.at(-1).text]`), dom: (await state()).list.length };
  await click('[data-hud=chat] [data-action=chat-collapse]');
  t.check('CH-8. history is bounded to the newest 150 messages, in the log and in the list', bounded.log[0] === 150 && bounded.log[1] === 'Bounded 250' && bounded.log[2] === 'Bounded 399' && bounded.dom === 150,
    JSON.stringify(bounded));

  // 7. Three viewports: the preview sits between the feed and the joystick ring and leaves the movement probe
  //    open; the expanded panel stays clear of the combat cluster, the system strip and the player frame.
  const layout = [];
  for (const [width, height, mobile] of [[960, 540, false], [844, 390, false], [640, 360, true]]) {
    await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await sleep(250);
    const collapsed = await b.eval(`(() => {
      const root = document.querySelector('[data-ui-root]').getBoundingClientRect(), s = parseFloat(document.querySelector('[data-ui-root]').style.getPropertyValue('--ui-scale'));
      const p = document.querySelector('.hud-chat__preview').getBoundingClientRect();
      const ringTop = root.bottom - 146 * s, ringRight = root.left + 146 * s, canvas = document.querySelector('canvas').getBoundingClientRect();
      const probe = document.elementFromPoint(canvas.x + canvas.width * 0.18, canvas.y + canvas.height * 0.78)?.tagName;
      return { preview: [p.left, p.top, p.right, p.bottom].map(Math.round), clearOfRing: p.bottom <= ringTop + 0.5, probe, left: p.right <= root.left + root.width * 0.45 };
    })()`);
    await click('[data-hud=chat] .hud-chat__preview');
    const expanded = await b.eval(`(() => {
      const panel = document.querySelector('[data-role=chat-panel]').getBoundingClientRect(), root = document.querySelector('[data-ui-root]').getBoundingClientRect();
      const hits = [...document.querySelectorAll('.hud-actions > .ui-slot, [data-hud=systems] button, [data-hud=player], [data-hud=player-status], [data-hud=minimap]')].filter((e) => e.offsetParent).filter((e) => { const r = e.getBoundingClientRect();
        return r.left < panel.right - 0.5 && r.right > panel.left + 0.5 && r.top < panel.bottom - 0.5 && r.bottom > panel.top + 0.5; }).map((e) => e.dataset.slot ?? e.dataset.menu ?? e.dataset.hud);
      const tabs = [...document.querySelectorAll('[data-hud=chat] .ui-tab')];
      return { panel: [panel.left, panel.top, panel.right, panel.bottom].map(Math.round), inside: panel.top >= root.top && panel.left >= root.left, hits, tabsFit: tabs.every((x) => x.scrollWidth <= x.clientWidth + 1 && x.getBoundingClientRect().right <= panel.right) };
    })()`);
    await shot(`chat-02-${width}x${height}`);
    await click('[data-hud=chat] [data-action=chat-collapse]');
    layout.push({ size: `${width}x${height}`, collapsed, expanded });
  }
  t.check('CH-9. 960x540, 844x390, 640x360: preview left of centre, above the joystick ring, movement probe still on the world; expanded panel in view, tabs fit, no combat / system / player overlap',
    layout.every((l) => l.collapsed.clearOfRing && l.collapsed.left && l.collapsed.probe === 'CANVAS' && l.expanded.inside && l.expanded.tabsFit && l.expanded.hits.length === 0), JSON.stringify(layout));

  // 8. Thai at 640x360 via the real Settings control: chat labels from the string table, tabs fit, empty state wraps inside.
  await click('[data-hud=systems] [data-menu=menu]');
  await b.eval(`document.querySelector('[data-window=menu] [data-screen=settings]').scrollIntoView({ block: 'nearest' })`);
  await click('[data-window=menu] [data-screen=settings]');
  await click('[data-window=settings] [data-locale=th]');
  await b.press('Escape'); await sleep(80);
  await click('[data-hud=chat] .hud-chat__preview');
  await b.eval(`[...document.querySelectorAll('[data-hud=chat] .hud-chat__tabs .ui-tab')][1].click()`);
  await sleep(60);
  const thai = await b.eval(`(() => { const c = document.querySelector('[data-hud=chat]'), panel = c.querySelector('[data-role=chat-panel]').getBoundingClientRect(), e = c.querySelector('[data-role=chat-empty]');
    return { tabs: [...c.querySelectorAll('.ui-tab')].map((x) => ({ text: x.textContent, fits: x.scrollWidth <= x.clientWidth + 1 && x.getBoundingClientRect().right <= panel.right })), empty: e.textContent,
      emptyFits: e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().bottom <= panel.bottom, close: c.querySelector('[data-action=chat-collapse]').getAttribute('aria-label') }; })()`);
  await shot('chat-03-thai-640x360');
  await click('[data-hud=chat] [data-action=chat-collapse]');
  const thaiTag = (await state()).tag;
  await click('[data-hud=systems] [data-menu=menu]');
  await b.eval(`document.querySelector('[data-window=menu] [data-screen=settings]').scrollIntoView({ block: 'nearest' })`);
  await click('[data-window=menu] [data-screen=settings]');
  await click('[data-window=settings] [data-locale=en]');
  await b.press('Escape'); await sleep(80);
  await b.setViewport({ mobile: false }); await sleep(150);
  t.check('CH-10. Thai 640x360: แชท / ทั้งหมด / ปาร์ตี้ / ระบบ and the Party empty state come from the string table and fit',
    JSON.stringify(thai.tabs.map((x) => x.text)) === JSON.stringify(['ทั้งหมด', 'ปาร์ตี้', 'ระบบ']) && thai.tabs.every((x) => x.fits) && thai.empty.startsWith('ยังไม่มีข้อความปาร์ตี้') &&
      thai.emptyFits && thai.close === 'ปิดแชท' && thaiTag === 'แชท' && (await b.eval(`document.querySelector('[data-ui-root]').lang`)) === 'en', JSON.stringify({ thai, thaiTag }));
}

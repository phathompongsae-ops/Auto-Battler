// Haven's HUD style lock: geometry, input space, cooldown presentation and
// review captures. Uses real game state/actions; screenshots are test artifacts.
import { sleep } from './cdp.mjs';

export async function hudStyleSuite(b, t, shot) {
  t.section('Fantasy HUD layout / visual review');
  const bounds = (sel) => b.eval(`(() => {
    const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`);
  const crop = async (name, sel) => {
    const r = await bounds(sel);
    const x = Math.max(0, r.x - 10), y = Math.max(0, r.y - 10);
    await shot(name, { x, y, width: Math.min(b.width - x, r.width + 20), height: Math.min(b.height - y, r.height + 20) });
  };
  const geometry = () => b.eval(`(() => {
    // Only displayed sockets are touch targets; compact layouts may hide inert reserved ones.
    const all = [...document.querySelectorAll('.hud-actions > .ui-slot')];
    const hidden = all.filter((e) => getComputedStyle(e).display === 'none').map((e) => ({ id: e.dataset.slot, inert: e.getAttribute('aria-disabled') === 'true' && e.dataset.group === 'utility' }));
    const slots = all.filter((e) => getComputedStyle(e).display !== 'none').map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.dataset.slot, group: e.dataset.group, x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const rect = (selector) => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const canvas = rect('canvas');
    return { slots, hidden, minimap: rect('[data-hud=minimap]'), quests: rect('[data-hud=quest-tracker]'), player: rect('[data-hud=player]'), systems: rect('[data-hud=systems]'), canvas,
      systemButtons: [...document.querySelectorAll('[data-hud=systems] button')].map((e) => { const r=e.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height }; }),
      openCentre: [[.5,.5],[.45,.6],[.35,.78],[.18,.78]].every(([x,y]) => document.elementFromPoint(canvas.x + canvas.w*x, canvas.y + canvas.h*y)?.tagName === 'CANVAS') };
  })()`);
  const checkGeometry = (g, label) => {
    const atk = g.slots.find((s) => s.id === 'attack');
    const ring = g.slots.filter((s) => s.group === 'combat' && s.id !== 'attack');
    const clashes = g.slots.flatMap((a, i) => g.slots.slice(i + 1).filter((s) => a.x < s.x+s.w && a.x+a.w > s.x && a.y < s.y+s.h && a.y+a.h > s.y).map((s) => `${a.id}/${s.id}`));
    t.check(label, ring.length === 4 && ring.every((s) => s.w < atk.w) && g.slots.every((s) => s.w >= 40 && s.h >= 40) && g.hidden.every((s) => s.inert) && g.slots.some((s) => s.id === 'skill5') && !clashes.length && g.openCentre && g.quests.y >= g.minimap.y+g.minimap.h,
      JSON.stringify({ atk: atk.w, skills: ring.map((s) => s.w), clashes, hidden: g.hidden.map((s) => s.id), openCentre: g.openCentre }));
  };
  const productionGeometry = (g, label) => {
    const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
    const clashes = g.slots.filter((s) => overlap(s,g.quests) || overlap(s,g.systems)).map(s => s.id);
    const movementBottom = g.canvas.y + g.canvas.h - (g.systems.y + g.systems.h);
    const movementReserved = movementBottom >= 110 || g.systems.x - g.canvas.x >= 130;
    t.check(label, !clashes.length && movementReserved && g.systemButtons.length === 5 && g.systemButtons.every((s) => s.w >= 44 && s.h >= 44) && g.openCentre,
      JSON.stringify({clashes,movementBottom,systems:g.systems,quests:g.quests}));
  };
  const click = async (sel) => { const r = await bounds(sel); await b.mouse('mousePressed',r.x+r.width/2,r.y+r.height/2); await b.mouse('mouseReleased',r.x+r.width/2,r.y+r.height/2); await sleep(180); };

  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); debug.resetJobChange(); debug.jumpToLevel(20); debug.forceChangeJob('warrior'); debug.resetSkills(); debug.learnSkill('power_slash'); debug.learnSkill('charge'); debug.learnSkill('shield_bash');`);
  for (let i = 0; i < 5; i++) await b.eval(`debug.learnSkill('heavy_armor_mastery')`);
  await b.eval(`debug.learnSkill('provoke'); debug.setPlayerMp(debug.player().stats.maxMp); debug.setPlayerHp(debug.player().stats.maxHp)`);
  // Let the normal progression notices finish before the clean HUD capture.
  await sleep(3500);
  checkGeometry(await geometry(), 'HUD-S1. ATK dominates four separated core skills; 40px targets; minimap/quests aligned; centre and movement area open');
  productionGeometry(await geometry(), 'HUD-P1. 960x540 system strip reserves joystick space, has 44px targets and avoids combat/quest collisions');
  await shot('hud-production-01-town');
  await shot('hud-production-02-town-system-strip');
  await shot('hud-review-01-town');
  await crop('hud-review-02-combat-cluster', '[data-hud=actions]');
  await crop('hud-review-03-minimap-quests', '[data-region=top-right]');
  await crop('hud-review-04-player-frame', '[data-hud=player]');
  await crop('hud-production-04-combat-cluster', '[data-hud=actions]');
  await crop('hud-production-05-player-frame', '[data-hud=player]');
  await crop('hud-production-06-minimap-quests', '[data-region=top-right]');
  await click('[data-action=quest-collapse]');
  t.check('HUD-P2. quest collapse removes objective content and announces state', await b.eval(`document.querySelector('[data-action=quest-collapse]').getAttribute('aria-expanded') === 'false' && document.querySelector('.hud-quests__body').hidden`));
  await click('[data-action=quest-collapse]');
  t.check('HUD-P3. quest expansion restores real objectives and Go action', await b.eval(`!document.querySelector('.hud-quests__body').hidden && !!document.querySelector('[data-action=quest-go]')`));

  await b.eval(`debug.acquireItem('mushroom_cap', 1); debug.startQuest('mvp_01_welcome'); debug.trackQuest('mvp_01_welcome'); debug.talkToNpc('npc_smith_brann')`);
  await sleep(100);
  const badges = await b.eval(`({inventory: document.querySelector('[data-menu=inventory] .ui-badge').textContent, quest: !document.querySelector('[data-menu=quest] .ui-badge').hidden, more: !document.querySelector('[data-menu=menu] .ui-badge').hidden})`);
  t.check('HUD-P4. real loot and completed quest produce count / dot badges on Inventory, Quests and More', Number(badges.inventory) > 0 && badges.quest && badges.more, JSON.stringify(badges));
  await click('[data-menu=menu]');
  const grid = await b.eval(`[...document.querySelectorAll('[data-window=menu] [data-screen]')].map(e => e.dataset.screen)`);
  t.check('HUD-P5. More opens original medallion grid with implemented systems only', grid.length === 12 && ['character','inventory','skills','quest','craft','enhancement','enchant','settings','map'].every(id => grid.includes(id)) && ['pet','party','dungeon'].every(id => !grid.includes(id)), JSON.stringify(grid));
  await shot('hud-production-03-system-grid');
  await click('[data-window=menu] [data-screen=inventory]');
  t.check('HUD-P6. menu grid opens real Inventory and clears its unread badge', await b.eval(`!!document.querySelector('[data-window=inventory] [data-role=inventory]') && document.querySelector('[data-menu=inventory] .ui-badge').hidden`));
  await shot('hud-production-10-inventory');
  await b.press('Escape');
  await click('[data-menu=character]');
  t.check('HUD-P7. strip opens Character with real stats', await b.eval(`!!document.querySelector('[data-window=character] .ui-stats')`));
  await shot('hud-production-11-character');
  await b.press('Escape');
  await click('[data-menu=map]');
  t.check('HUD-P8. Area Map draws current terrain instead of a placeholder', await b.eval(`document.querySelector('.ui-area-map')?.width > 0 && document.querySelector('[data-window=map]').textContent.includes('Haven Town')`));
  await b.press('Escape');
  await click('[data-menu=settings]');
  await click('[data-preference=contrast]');
  t.check('HUD-P9. Settings applies real session-only display preference', await b.eval(`document.querySelector('[data-ui-root]').dataset.contrast === 'true'`));
  await click('[data-preference=contrast]');
  await b.press('Escape');

  for (const [width,height] of [[1366,768],[844,390]]) {
    await b.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false}); await sleep(200);
    checkGeometry(await geometry(),`HUD-P10. ${width}x${height} combat geometry and open centre`);
    productionGeometry(await geometry(),`HUD-P11. ${width}x${height} strip / quest separation and joystick reservation`);
    await shot(`hud-production-${width === 1366 ? '12-desktop' : '13-compact-landscape'}`);
  }
  await b.setViewport({mobile:false}); await sleep(150);

  // Two reserved utility slots are explicit and inert, alongside the existing
  // special/potion/dodge positions and retained fifth skill binding.
  const utilities = await b.eval(`['pet','special'].map((id) => {
    const e = document.querySelector('[data-slot='+id+']'); return { id, utility: e.dataset.group === 'utility', disabled: e.getAttribute('aria-disabled') === 'true' };
  })`);
  t.check('HUD-S2. future utility positions are outside the combat ring and unavailable', utilities.every((s) => s.utility && s.disabled), JSON.stringify(utilities));

  // Small landscape phone: no tap-target overlap and no interception of centre
  // or the movement area; restore the runner's viewport afterwards.
  await b.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 360, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  checkGeometry(await geometry(), 'HUD-S3. compact 640x360 landscape keeps touch targets separate and centre/movement space open');
  productionGeometry(await geometry(), 'HUD-P12. 640x360 system strip and quest tracker avoid combat and reserve movement');
  await shot('hud-production-09-640x360');
  await shot('hud-review-07-compact-landscape');
  await b.setViewport({ mobile: false });
  await sleep(150);

  await b.eval(`debug.reset(); debug.resetJobChange(); debug.setPeaceful(true); debug.setRng(0.5); debug.setPlayerMp(debug.player().stats.maxMp); debug.teleport(528, 464);
    debug.placeMonster('elite_boar-1', 528, 428); debug.selectTarget('elite_boar-1'); debug.resetCooldowns(); debug.clearLog()`);
  await sleep(200);
  await b.press('Space');
  await sleep(140);
  await shot('hud-review-05-during-combat');
  await shot('hud-production-07-field-combat');
  await sleep(500);
  for (const key of ['KeyQ','KeyE','KeyR']) { await b.press(key); await sleep(450); }
  const cds = await b.eval(`['skill1','skill2','skill3'].map((id) => { const e = document.querySelector('[data-slot='+id+']'); return { id, cooldown: e.dataset.cooldown, text: e.querySelector('.ui-slot__cooldown-text').textContent, visible: !e.querySelector('.ui-slot__cooldown').hidden }; })`);
  t.check('HUD-S4. several real casts show visible cooldown wipes and numeric time', cds.every((s) => s.cooldown === 'true' && s.visible && Number(s.text) > 0), JSON.stringify(cds));
  const empty = await b.eval(`(() => { const e = document.querySelector('[data-slot=skill4]'); return e.classList.contains('ui-slot--empty') && e.getAttribute('aria-disabled') === 'true'; })()`);
  t.check('HUD-S5. unlearned / empty skill socket has a distinct unavailable state', empty);
  await shot('hud-review-06-several-cooldowns');
  await shot('hud-production-08-several-cooldowns');
  await b.eval(`debug.reset(); debug.setPeaceful(true)`);
}

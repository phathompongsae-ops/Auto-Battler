// Town / Field / Dungeon map foundation in the running game: real map loads, portals, collision, spawns, save/reload.
import { sleep } from './cdp.mjs';

const TILE = 32;
const center = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

/** `reload` reloads the page and waits for a fresh boot (a new game). */
export async function mapSuite(b, t, shot, reload) {
  t.section('Town / Field / Dungeon maps');
  const info = () => b.eval('debug.mapInfo()');
  const player = () => b.eval('debug.player()');
  const minimap = () => b.eval(`(() => { const el = document.querySelector('[data-hud="minimap"]'); return { mapId: el.dataset.mapId, type: el.dataset.mapType, label: el.textContent }; })()`);
  const waitMap = (mapId, timeout = 4000) => b.waitFor(`debug.mapInfo().mapId === '${mapId}' && debug.mapInfo()`, { timeout, label: `map ${mapId}` });
  const hold = async (code, ms) => {
    await b.keyDown(code);
    await sleep(ms);
    await b.keyUp(code);
    await sleep(60);
  };

  // 1. A new game starts in Town.
  let town = await info();
  let p = await player();
  let mm = await minimap();
  t.check(
    'M-1. a new game starts in Town at its safe spawn, with no hostile monsters',
    town.mapId === 'demo_town' && town.type === 'town' && town.monsters.length === 0 && town.plannedMonsters.length === 0 &&
      Math.hypot(p.x - town.spawnPoint.x, p.y - town.spawnPoint.y) < 2 && mm.mapId === 'demo_town' && mm.label.includes('Haven Town'),
    JSON.stringify({ map: town.mapId, monsters: town.monsters.length, p: [p.x, p.y], mm }),
  );
  await b.eval('debug.setPeaceful(true)');
  await sleep(500);
  await shot('maps-01-town');

  // 2. Moving around Town, with collision against a building.
  const before = await player();
  await hold('ArrowRight', 400);
  const moved = await player();
  await b.eval(`debug.teleport(${center(6, 8).x}, ${center(6, 8).y})`); // in front of the Job Hall (roof rows 3..6)
  await sleep(80);
  await hold('ArrowUp', 900);
  const blocked = await player();
  t.check(
    'M-2. the player walks around Town, and Town buildings block movement',
    moved.x > before.x + 30 && blocked.y > 200 && blocked.y < center(6, 8).y,
    JSON.stringify({ dx: moved.x - before.x, blockedY: blocked.y }),
  );

  // 3. Walking into the east gate loads the Field.
  await b.eval('debug.clearLog()');
  await b.eval(`debug.teleport(${center(33, 12).x}, ${center(33, 12).y})`);
  await b.keyDown('ArrowRight');
  const field = await waitMap('demo_field');
  await b.keyUp('ArrowRight');
  await sleep(150);
  p = await player();
  const changes = await b.eval(`debug.log.filter((e) => e.type === 'mapChanged').map((e) => e.target + ':' + e.item)`);
  t.check(
    'M-3. walking into the Town east gate takes the portal: the Field loads and the player stands at its west entrance',
    JSON.stringify(changes) === '["demo_field:demo_town_to_field"]' && p.x < 6 * TILE && Math.abs(p.y - center(3, 15).y) < 4,
    JSON.stringify({ changes, p: [p.x, p.y] }),
  );

  // 4-5. The Field is a different map with its own monsters.
  mm = await minimap();
  const tiers = [...new Set(field.monsters.map((m) => m.tier))].sort();
  t.check(
    'M-4. the Field is structurally different from Town (size, type, minimap)',
    field.type === 'field' && field.width === 40 && field.height === 30 && (town.width !== field.width || town.height !== field.height) &&
      mm.mapId === 'demo_field' && mm.label.includes('Green Meadow') && field.zone === 'field',
    JSON.stringify({ field: [field.width, field.height], town: [town.width, town.height], mm }),
  );
  t.check(
    'M-5. Field monsters exist: every Field spawn zone (Slime, Wolf, Mushroom, Elite, Mini Boss)',
    field.monsters.length === field.plannedMonsters.length && field.monsters.length >= 10 &&
      ['slime', 'wolf', 'mushroom', 'elite_boar', 'grove_guardian'].every((id) => field.monsters.some((m) => m.monsterId === id)) &&
      JSON.stringify(tiers) === '["elite","mini_boss","normal"]' && !field.monsters.some((m) => m.monsterId.startsWith('crypt_')),
    JSON.stringify({ count: field.monsters.length, tiers }),
  );
  await shot('maps-02-field');

  // 6. Back to Town through the west gate.
  await b.keyDown('ArrowLeft');
  town = await waitMap('demo_town');
  await b.keyUp('ArrowLeft');
  await sleep(100);
  p = await player();
  t.check(
    'M-6. walking into the Field west gate returns to Town; the Field monsters are gone',
    town.monsters.length === 0 && (await b.eval('debug.world.monsters.length')) === 0 && Math.abs(p.y - center(33, 12).y) < 4,
    JSON.stringify({ monsters: town.monsters.length, p: [p.x, p.y] }),
  );

  // 7. Auto Move to the Dungeon gate portal and through it.
  const toGate = await b.eval(`debug.navigateTo('nav_portal_demo_town_to_dungeon')`);
  const crypt = await waitMap('demo_crypt', 15000);
  const nav = await b.eval('debug.navState()');
  p = await player();
  t.check(
    'M-7. Auto Move walks to the Dungeon gate and the portal loads the Dungeon at its entrance hall',
    toGate.ok && nav.status === 'arrived' && Math.hypot(p.x - crypt.spawnPoint.x, p.y - crypt.spawnPoint.y) < 4,
    JSON.stringify({ toGate: toGate.ok, nav: nav.status, p: [p.x, p.y] }),
  );

  // 8-9. The Dungeon is different and has its own mobs, with dungeon reward rules.
  mm = await minimap();
  t.check(
    'M-8. the Dungeon is structurally different (32x64, dungeon type, dungeon reward zone, minimap)',
    crypt.type === 'dungeon' && crypt.kind === 'dungeon' && crypt.width === 32 && crypt.height === 64 && crypt.zone === 'dungeon' && mm.mapId === 'demo_crypt',
    JSON.stringify({ size: [crypt.width, crypt.height], zone: crypt.zone, mm }),
  );
  const ids = crypt.monsters.map((m) => m.monsterId);
  t.check(
    'M-9. Dungeon mobs exist (sections, elite, boss) and no Field monster came along',
    ids.includes('crypt_skeleton') && ids.includes('crypt_knight') && ids.includes('crypt_lord') && ids.every((id) => id.startsWith('crypt_')),
    JSON.stringify(ids),
  );
  await shot('maps-03-dungeon');

  const r0 = await b.eval(`({ exp: debug.player().exp, level: debug.player().level, energy: debug.fieldEnergy(), gold: debug.equipment().gold, inv: JSON.stringify(debug.player().inventory) })`);
  await b.eval(`debug.clearLog(); const p = debug.player(); debug.placeMonster('crypt_skeleton-1', p.x, p.y - 40); debug.resetCooldowns(); debug.selectTarget('crypt_skeleton-1'); debug.setMonsterHp('crypt_skeleton-1', 1)`);
  await b.press('Space');
  await b.waitFor(`debug.monster('crypt_skeleton-1').dead`, { timeout: 2000, label: 'skeleton dies' });
  await sleep(200);
  const r1 = await b.eval(`({ exp: debug.player().exp, level: debug.player().level, energy: debug.fieldEnergy(), gold: debug.equipment().gold, inv: JSON.stringify(debug.player().inventory), drops: debug.drops().length, gained: debug.log.filter((e) => e.type === 'expGained').length })`);
  t.check(
    'M-9b. a Dungeon mob kill grants nothing (0 EXP, 0 Gold, no drops) and uses no Field Energy',
    r1.exp === r0.exp && r1.level === r0.level && r1.energy === r0.energy && r1.gold === r0.gold && r1.inv === r0.inv && r1.drops === 0 && r1.gained === 0,
    JSON.stringify({ r0, r1 }),
  );

  // Leave through the entrance-hall exit.
  await b.eval(`debug.teleport(${crypt.spawnPoint.x}, ${crypt.spawnPoint.y})`);
  await b.keyDown('ArrowDown');
  town = await waitMap('demo_town');
  await b.keyUp('ArrowDown');
  t.check('M-9c. the Dungeon exit returns safely to Town (no Dungeon mobs left)', town.monsters.length === 0 && town.zone === 'field', JSON.stringify(town.monsters));

  // 10-12. Save in the Field, reload the page (a fresh game in Town), load: back on the Field at the saved spot.
  await b.eval(`debug.takePortal('demo_town_to_field')`);
  await waitMap('demo_field');
  await b.eval(`debug.teleport(${center(12, 18).x}, ${center(12, 18).y})`);
  await sleep(100);
  const savedAt = await player();
  const saved = await b.eval('debug.save()');
  await reload();
  const fresh = await info();
  await b.eval('debug.setPeaceful(true)');
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  await sleep(150);
  const after = await info();
  p = await player();
  mm = await minimap();
  t.check(
    'M-10. save in the Field → reload → load: the Field loads again with the player at the saved position',
    fresh.mapId === 'demo_town' && loaded.ok && after.mapId === 'demo_field' && after.lastFallback === null &&
      Math.abs(p.x - savedAt.x) < 1 && Math.abs(p.y - savedAt.y) < 1 && after.monsters.length === after.plannedMonsters.length && mm.mapId === 'demo_field',
    JSON.stringify({ fresh: fresh.mapId, loaded, after: after.mapId, fallback: after.lastFallback, p: [p.x, p.y], savedAt: [savedAt.x, savedAt.y] }),
  );

  // Bad saved locations load safely.
  const tweak = (location) => JSON.stringify({ ...JSON.parse(saved), location });
  const unknown = await b.eval(`debug.load(${JSON.stringify(tweak({ mapId: 'no_such_map', x: 100, y: 100 }))})`);
  const u = await info();
  const wall = await b.eval(`debug.load(${JSON.stringify(tweak({ mapId: 'demo_field', x: 16, y: 16 }))})`);
  const w = await info();
  p = await player();
  const deep = await b.eval(`debug.load(${JSON.stringify(tweak({ mapId: 'demo_crypt', x: 512, y: 8 * 32 + 16 }))})`);
  const d = await info();
  const dp = await player();
  t.check(
    'M-11. unsafe saved locations fall back safely: unknown map → Town spawn, wall → map spawn, inside the Dungeon → its entrance',
    unknown.ok && u.mapId === 'demo_town' && u.lastFallback === 'unknown_map' &&
      wall.ok && w.mapId === 'demo_field' && w.lastFallback === 'invalid_position' && Math.abs(p.x - w.spawnPoint.x) < 1 && Math.abs(p.y - w.spawnPoint.y) < 1 &&
      deep.ok && d.mapId === 'demo_crypt' && d.lastFallback === 'dungeon_entrance' && Math.abs(dp.y - d.spawnPoint.y) < 1 &&
      (await b.eval('debug.dungeonStatus().inRun')) === null,
    JSON.stringify({ u: [u.mapId, u.lastFallback], w: [w.mapId, w.lastFallback], d: [d.mapId, d.lastFallback, dp.y] }),
  );
}

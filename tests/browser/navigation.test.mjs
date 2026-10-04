// Auto Move / quest navigation through the real game loop, player and collision.
import { sleep } from './cdp.mjs';

const PLAYER_SPAWN = { x: 640, y: 608 };

export async function navigationSuite(b, t) {
  t.section('Auto Move / quest navigation in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.setRng(0.5); debug.clearLog()');
  await sleep(150);
  const nav = () => b.eval('debug.navState()');

  // 1-4. Navigate to the q_demo_01 NPC, then cancel with manual input.
  await b.eval(`debug.startQuest('q_demo_01')`);
  const started = await b.eval(`debug.navigateToQuest('q_demo_01', 0)`);
  const npc = (await b.eval('debug.navTargets()')).find((x) => x.id === 'nav_demo_npc_guide');
  const d0 = Math.hypot(npc.x - PLAYER_SPAWN.x, npc.y - PLAYER_SPAWN.y);
  await sleep(700);
  const mid = await nav();
  const d1 = Math.hypot(npc.x - mid.x, npc.y - mid.y);
  t.check(
    'N-1. navigating to the q_demo_01 objective walks the player toward the demo NPC',
    started.ok && started.state.targetId === 'nav_demo_npc_guide' && mid.status === 'moving' && d1 < d0 - 50,
    JSON.stringify({ started: started.ok, status: mid.status, d0: Math.round(d0), d1: Math.round(d1) }),
  );

  await b.keyDown('ArrowDown');
  await sleep(120);
  await b.keyUp('ArrowDown');
  await sleep(100); // let the release reach the game before taking the baseline
  const cancelled = await nav();
  await sleep(600);
  const later = await nav();
  t.check(
    'N-2. manual movement cancels Auto Move, and it does not restart by itself',
    cancelled.status === 'cancelled' && cancelled.reason === 'manual_input' && later.status === 'cancelled' && Math.abs(later.x - cancelled.x) < 1 && Math.abs(later.y - cancelled.y) < 1,
    JSON.stringify({ cancelled, later: { status: later.status, x: later.x, y: later.y } }),
  );

  // 5-8. Finish the chain up to q_demo_03 (real NPC event, real slime kills), then Auto Move to the marker.
  await b.eval(`debug.talkToNpc('demo_npc_guide'); debug.claimQuest('q_demo_01'); debug.startQuest('q_demo_02')`);
  for (const id of ['slime-1', 'slime-2', 'slime-3']) {
    const p = await nav();
    await b.eval(`debug.placeMonster('${id}', ${p.x}, ${p.y - 48})`);
    await b.eval(`debug.resetCooldowns(); debug.selectTarget('${id}'); debug.setMonsterHp('${id}', 5)`);
    await b.press('Space');
    await b.waitFor(`debug.monster('${id}').dead`, { timeout: 2000, label: `${id} dies` });
  }
  await b.eval(`debug.claimQuest('q_demo_02'); debug.startQuest('q_demo_03'); debug.clearLog()`);
  const toMarker = await b.eval(`debug.navigateToQuest('q_demo_03', 0)`);
  const arrived = await b.waitFor(`debug.navState().status !== 'moving' && debug.navState()`, { timeout: 8000, label: 'arrive at marker' });
  const visits = await b.eval(`debug.log.filter((e) => e.type === 'locationReached').map((e) => e.target)`);
  const quest = await b.eval(`debug.questProgress('q_demo_03')`);
  t.check(
    'N-3. Auto Move to the demo marker; arrival fires the real visit event and the quest objective completes',
    toMarker.ok && arrived.status === 'arrived' && JSON.stringify(visits) === '["demo_marker_gate"]' && quest.status === 'completed',
    JSON.stringify({ toMarker: toMarker.ok, arrived: arrived.status, visits, quest }),
  );

  // Portal continuation on the prototype map: field → portal → dungeon-entrance map → entrance.
  await b.eval('debug.clearLog()');
  const toEntrance = await b.eval(`debug.navigateTo('nav_demo_dungeon_entrance')`);
  const done = await b.waitFor(`['arrived', 'failed', 'cancelled'].includes(debug.navState().status) && debug.navState()`, { timeout: 12000, label: 'arrive at entrance' });
  const maps = await b.eval(`debug.log.filter((e) => e.type === 'mapChanged').map((e) => e.target + ':' + e.item)`);
  t.check(
    'N-4. a cross-map route walks to the portal, uses it, and continues to the dungeon entrance',
    toEntrance.ok && done.status === 'arrived' && done.mapId === 'demo_dungeon_entrance' && JSON.stringify(maps) === '["demo_dungeon_entrance:demo_field_to_dungeon"]',
    JSON.stringify({ route: toEntrance.state?.route, done: { status: done.status, reason: done.reason, mapId: done.mapId }, maps }),
  );

  // Loading never resumes Auto Move.
  await b.eval(`debug.navigateTo('nav_demo_npc_guide')`);
  const saved = await b.eval('debug.save()');
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  const afterLoad = await nav();
  t.check('N-5. loading a save leaves Auto Move inactive', loaded.ok && afterLoad.status === 'inactive', JSON.stringify(afterLoad));

  await b.eval('debug.reset(); debug.setRng(null)');
}

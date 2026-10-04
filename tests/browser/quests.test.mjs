// Quest Engine through the real game: NPC talk, real slime kills, claims, save/load.
import { sleep } from './cdp.mjs';

const PLAYER_SPAWN = { x: 640, y: 608 };

export async function questSuite(b, t) {
  t.section('Quest Engine in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.setRng(0.5)');
  await sleep(150);
  const statuses = async () => Object.fromEntries((await b.eval('debug.quests()')).map((q) => [q.questId, q.status]));
  const progress = (id) => b.eval(`debug.questProgress('${id}')`);

  let s = await statuses();
  t.check('Q-1. a fresh character: q_demo_01 available, the rest of the chain locked', s.q_demo_01 === 'available' && s.q_demo_02 === 'locked' && s.q_demo_03 === 'locked', JSON.stringify(s));

  const started = await b.eval(`debug.startQuest('q_demo_01')`);
  await b.eval(`debug.talkToNpc('demo_npc_guide')`);
  const talked = await progress('q_demo_01');
  const first = await b.eval(`debug.claimQuest('q_demo_01')`);
  const again = await b.eval(`debug.claimQuest('q_demo_01')`);
  const gold = (await b.eval('debug.equipment()')).gold;
  t.check(
    'Q-2. start, talk to the demo NPC, claim once (Gold 50); a second claim grants nothing',
    started.ok && talked.status === 'completed' && first.ok && !again.ok && again.reason === 'already_claimed' && gold === 50,
    JSON.stringify({ started, talked, first, again, gold }),
  );

  await b.eval(`debug.startQuest('q_demo_02'); debug.trackQuest('q_demo_02')`);
  const counts = [];
  for (const id of ['slime-1', 'slime-2', 'slime-3']) {
    await b.eval(`debug.placeMonster('${id}', ${PLAYER_SPAWN.x}, ${PLAYER_SPAWN.y - 48})`);
    await b.eval(`debug.resetCooldowns(); debug.selectTarget('${id}'); debug.setMonsterHp('${id}', 5)`);
    await b.press('Space');
    await b.waitFor(`debug.monster('${id}').dead`, { timeout: 2000, label: `${id} dies` });
    counts.push((await progress('q_demo_02')).objectives[0].current);
  }
  const killed = await progress('q_demo_02');
  t.check('Q-3. killing slimes in the game advances the kill objective to 3/3', JSON.stringify(counts) === '[1,2,3]' && killed.status === 'completed', JSON.stringify({ counts, killed }));

  const claim2 = await b.eval(`debug.claimQuest('q_demo_02')`);
  const claim2b = await b.eval(`debug.claimQuest('q_demo_02')`);
  const scrolls = (await b.eval('debug.player().inventory')).town_warp_scroll;
  t.check('Q-4. the kill quest reward (Town Warp Scroll) is granted once', claim2.ok && !claim2b.ok && scrolls === 1, JSON.stringify({ claim2, claim2b, scrolls }));

  await b.eval(`debug.startQuest('q_demo_03'); debug.trackQuest('q_demo_03')`);
  const saved = await b.eval('debug.save()');
  await b.eval('debug.reset()');
  const wiped = await statuses();
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  s = await statuses();
  const tracked = await b.eval('debug.trackedQuests()');
  t.check(
    'Q-5. quest state survives save -> reset -> load',
    wiped.q_demo_01 === 'available' && loaded.ok && s.q_demo_01 === 'claimed' && s.q_demo_02 === 'claimed' && s.q_demo_03 === 'active' && JSON.stringify(tracked) === '["q_demo_03"]',
    JSON.stringify({ loaded, s, tracked }),
  );

  await b.eval(`debug.reachLocation('demo_marker_gate')`);
  const claim3 = await b.eval(`debug.claimQuest('q_demo_03')`);
  const unlocked = await b.eval(`debug.isFeatureUnlocked('demo_feature')`);
  t.check('Q-6. visiting the demo marker completes the feature quest and unlocks its feature', claim3.ok && unlocked, JSON.stringify({ claim3, unlocked }));

  await b.eval('debug.reset(); debug.setRng(null)');
}

// Story Crypt structure in the running game: checkpoints (retry positions that heal nothing),
// party wipes with HP 100% / MP 50% retries and open-encounter resets, the Crypt Lord's arena
// (C-11), separate encounters (C-12), and running out of retries (fail -> Town, quest intact,
// enter again for a fresh attempt). Deaths and kills go through the real death path.
import { sleep } from './cdp.mjs';

export async function dungeonStructureSuite(b, t, shot) {
  t.section('Story Crypt structure (checkpoints, wipes, encounters)');
  const api = (expr) => b.eval(`debug.${expr}`);
  const attempt = () => api('dungeonAttempt()');
  const mon = (id) => api(`monster('${id}')`);
  const me = () => api('player()');
  const feed = () => b.eval(`[...document.querySelectorAll('[data-loot-kind=dungeon]')].map((e) => e.textContent)`);
  const CP_A = { x: 512, y: 29 * 32 + 16 };
  const CP_B = { x: 512, y: 19 * 32 + 16 };
  /** Real death (as if killed); waits for the party to reappear (or for the failure). */
  const wipe = async (expect = 'dungeonRetry') => {
    const before = await b.eval(`debug.log.filter((e) => e.type === '${expect}').length`);
    await api('defeatPlayer()');
    await b.waitFor(`debug.log.filter((e) => e.type === '${expect}').length > ${before}`, { timeout: 6000, label: expect });
    await sleep(150);
  };

  // A Story player (Lv3, Meadow turned in, no gear) enters: a fresh attempt with Normal's 4 retries.
  await api(`reset('demo_town')`);
  await b.eval(`debug.setPeaceful(true); debug.setRng(0.5); debug.meetDungeonAccess(); debug.allocateStat('vit', 1); debug.allocateStat('str', 1); debug.startQuest('mvp_03_crypt'); debug.clearLog()`);
  const status0 = await api('dungeonStatus()');
  await api(`takePortal('demo_town_to_dungeon')`);
  await sleep(200);
  const a0 = await attempt();
  const brute = await mon('crypt_brute-1');
  t.check(
    'DS-1. entering the Story Crypt starts an attempt: Normal wipe allowance (4), no checkpoint yet; the teaching Brute is there',
    (await api('encounterProfile()')) === 'story' && a0?.status === 'active' && a0.wipeLimit === 4 && a0.retriesLeft === 4 && a0.checkpoint === null &&
      brute.zone === 'story_s2_brute' && brute.special === 'brute_smash_story',
    JSON.stringify({ a0, brute }),
  );

  // Checkpoint A: standing in it does nothing until the teaching encounters are down; then it activates without healing.
  await api(`teleport(${CP_A.x}, ${CP_A.y})`);
  await sleep(300);
  const early = await attempt();
  await api('setPlayerHp(200)');
  const mp0 = (await me()).mp;
  await b.eval(`debug.defeatMonster('crypt_skeleton-1'); for (let i = 2; i <= 5; i++) debug.defeatMonster('crypt_skeleton-' + i); debug.defeatMonster('crypt_brute-1')`);
  await b.waitFor(`debug.dungeonAttempt().checkpoint === 'crypt_cp_elite'`, { timeout: 3000, label: 'checkpoint A' });
  const atA = await me();
  t.check(
    'DS-2. Checkpoint A (before the Elite Chamber) activates only once the teaching encounters are down, and heals nothing',
    early.checkpoint === null && atA.hp === 200 && atA.mp <= mp0 + 2 && (await feed()).some((l) => l === 'Checkpoint: Elite Chamber Gate'),
    JSON.stringify({ early, hp: atA.hp, mp: [mp0, atA.mp], feed: await feed() }),
  );

  // A wipe with the Knight engaged and hurt: retry at A with HP 100% / MP 50%; the open encounter (Knight) resets, cleared ones stay down.
  await b.eval(`debug.setMonsterHp('crypt_knight-1', 100)`);
  await wipe();
  const p1 = await me();
  const a1 = await attempt();
  const knight1 = await mon('crypt_knight-1');
  const brute1 = await mon('crypt_brute-1');
  t.check(
    'DS-3. a solo death is a party wipe: one retry spent; back at Checkpoint A with HP 100% and MP 50%; the open Knight encounter reset, cleared encounters stay down',
    a1.wipesUsed === 1 && a1.retriesLeft === 3 && Math.hypot(p1.x - CP_A.x, p1.y - CP_A.y) < 8 && !p1.dead &&
      // MP: exactly half at the retry, plus the few tenths regenerated before this read.
      p1.hp === p1.stats.maxHp && p1.mp >= Math.floor(p1.stats.maxMp * 0.5) && p1.mp < Math.floor(p1.stats.maxMp * 0.5) + 1 &&
      knight1.hp === knight1.maxHp && Math.hypot(knight1.x - knight1.spawnX, knight1.y - knight1.spawnY) < 2 && brute1.dead &&
      (await feed()).some((l) => l === 'Defeated: 3 retries left'),
    JSON.stringify({ a1, p: [p1.x, p1.y, p1.hp, p1.mp, p1.stats.maxHp, p1.stats.maxMp], knight1, brute1: brute1.dead }),
  );

  // C-12: in the corridor before the Boss Room the player is within the Knight's aggro radius, but not in its chamber.
  await api(`teleport(${CP_B.x}, ${CP_B.y})`);
  await b.eval(`debug.setPlayerHp(9999); debug.setPeaceful(false)`);
  await sleep(1500);
  const knight2 = await mon('crypt_knight-1');
  const a2 = await attempt();
  await api('setPeaceful(true)');
  t.check(
    'DS-4. C-12: the Crypt Knight never notices a player outside its chamber (even within its aggro radius); Checkpoint B stays shut while it stands',
    knight2.state === 'idle' && Math.hypot(knight2.x - knight2.spawnX, knight2.y - knight2.spawnY) < 2 && Math.hypot(knight2.x - CP_B.x, knight2.y - CP_B.y) <= 170 && a2.checkpoint === 'crypt_cp_elite',
    JSON.stringify({ knight2, a2 }),
  );

  // Checkpoint B once the Elite Chamber is down; walking back past A never moves the retry point back.
  await b.eval(`debug.defeatMonster('crypt_skeleton-6'); debug.defeatMonster('crypt_knight-1')`);
  await b.waitFor(`debug.dungeonAttempt().checkpoint === 'crypt_cp_boss'`, { timeout: 3000, label: 'checkpoint B' });
  await api(`teleport(${CP_A.x}, ${CP_A.y})`);
  await sleep(300);
  t.check('DS-5. Checkpoint B (after the Knight, before the Crypt Lord) becomes the retry point; returning to A keeps B', (await attempt()).checkpoint === 'crypt_cp_boss', JSON.stringify(await attempt()));

  // C-11: engage the Crypt Lord, then fight from a corner farther than the old 380 px leash: no reset.
  const lord = await mon('crypt_lord-1');
  await api(`teleport(${lord.spawnX}, ${lord.spawnY + 70})`);
  await b.eval(`debug.setPlayerHp(9999); debug.setPeaceful(false)`);
  await b.waitFor(`['chase', 'attack'].includes(debug.monster('crypt_lord-1').state)`, { timeout: 3000, label: 'boss engaged' });
  await b.eval(`debug.setMonsterHp('crypt_lord-1', 1500)`);
  const corner = { x: 7 * 32 + 16, y: 16 * 32 + 16 };
  await api(`teleport(${corner.x}, ${corner.y})`);
  const cornerStates = [];
  for (let i = 0; i < 10; i++) {
    await b.eval('debug.setPlayerHp(9999)');
    cornerStates.push((await mon('crypt_lord-1')).state);
    await sleep(250);
  }
  const lordCorner = await mon('crypt_lord-1');
  t.check(
    'DS-6. C-11: anywhere in the Boss Room (here a corner ~385 px from the throne, beyond the old leash) the Crypt Lord keeps fighting and keeps its damage',
    Math.hypot(corner.x - lord.spawnX, corner.y - lord.spawnY) > 380 && cornerStates.every((s) => s === 'chase' || s === 'attack') && lordCorner.hp <= 1500,
    JSON.stringify({ cornerStates, hp: lordCorner.hp }),
  );
  // Out of its encounter (the corridor): it gives up, walks home and resets.
  await api(`teleport(${CP_B.x}, ${CP_B.y})`);
  const reset = await b
    .waitFor(`debug.monster('crypt_lord-1').state === 'idle' && debug.monster('crypt_lord-1').hp === debug.monster('crypt_lord-1').maxHp`, { timeout: 12000, label: 'boss reset' })
    .then(() => true, () => false);
  const lordHome = await mon('crypt_lord-1');
  await shot('dungeon-structure-01-boss-reset');
  t.check(
    'DS-7. C-11: dragged out of the Boss Room, the Crypt Lord walks home and fully resets',
    reset && Math.hypot(lordHome.x - lordHome.spawnX, lordHome.y - lordHome.spawnY) < 8 && lordHome.hp === 2800,
    JSON.stringify(lordHome),
  );
  await api('setPeaceful(true)');

  // Spend the remaining retries, then one more wipe fails the attempt: back to Town, no reward, quest intact.
  for (let i = 0; i < 3; i++) await wipe();
  const last = await attempt();
  const progressBefore = await api(`questProgress('mvp_03_crypt')`);
  const gold0 = (await api('equipment()')).gold;
  await wipe('dungeonFailed');
  await b.waitFor(`debug.navState().mapId === 'demo_town' && !debug.player().dead`, { timeout: 6000, label: 'back in Town' });
  const after = await me();
  const progressAfter = await api(`questProgress('mvp_03_crypt')`);
  const status1 = await api('dungeonStatus()');
  t.check(
    'DS-8. out of retries (4 wipes recovered, the 5th fails): attempt failed, back in Town alive, no reward, no run spent, the Story quest exactly as it was',
    last.retriesLeft === 0 && last.wipesUsed === 4 && (await api('navState()')).mapId === 'demo_town' && after.hp === after.stats.maxHp &&
      (await api('dungeonAttempt()')) === null && (await api('equipment()')).gold === gold0 &&
      progressAfter.status === 'active' && JSON.stringify(progressAfter) === JSON.stringify(progressBefore) &&
      status1.nextRun === status0.nextRun && status1.fullClaimsUsed === status0.fullClaimsUsed &&
      (await feed()).some((l) => l === 'Dungeon failed: returned to Town') && (await feed()).some((l) => l === 'Defeated: no retries left'),
    JSON.stringify({ last, progressBefore, progressAfter, status0, status1 }),
  );

  // Enter again: a fresh attempt (full allowance, no checkpoint) with every encounter back.
  await api(`takePortal('demo_town_to_dungeon')`);
  await sleep(200);
  const a3 = await attempt();
  const again = await Promise.all(['crypt_skeleton-1', 'crypt_brute-1', 'crypt_knight-1', 'crypt_lord-1'].map(mon));
  t.check(
    'DS-9. the Story Crypt can be attempted again: fresh attempt (4 retries, no checkpoint), every encounter back, still the Story profile',
    a3?.status === 'active' && a3.retriesLeft === 4 && a3.checkpoint === null && (await api('encounterProfile()')) === 'story' &&
      again.every((m) => !m.dead && m.hp === m.maxHp),
    JSON.stringify({ a3, again: again.map((m) => [m.id, m.dead, m.hp]) }),
  );
  // Progression gates: on this fresh attempt, Auto Move toward the Crypt Lord stops at every doorway whose
  // encounters still stand (with what is missing), and goes on as soon as they are down.
  const GATE_BOTTOM = { s1: 42 * 32, s2: 31 * 32, elite: 21 * 32 };
  const goBoss = async () => {
    await b.eval('debug.clearLog()');
    await api(`navigateToQuest('mvp_03_crypt', 1)`);
    await b.waitFor(`debug.navState().status !== 'moving'`, { timeout: 30000, label: 'auto move settles' });
    await sleep(200);
    return b.eval(`({ ...debug.navState(), blocked: debug.log.filter((e) => e.type === 'progressBlocked').map((e) => e.item), gates: debug.progressionGates() })`);
  };
  const s1 = await goBoss();
  t.check(
    'DS-10. Story gates: Auto Move cannot run past Section I while its Skeletons stand (stopped at the doorway, told what is missing)',
    s1.mapId === 'demo_crypt' && s1.y >= GATE_BOTTOM.s1 && s1.blocked.includes('story_gate_section_1') && s1.status !== 'arrived' &&
      (await b.eval(`[...document.querySelectorAll('[data-loot-kind=locked]')].some((e) => e.textContent === 'Defeat the Skeletons of Section I first')`)),
    JSON.stringify(s1),
  );
  await b.eval(`for (let i = 1; i <= 5; i++) debug.defeatMonster('crypt_skeleton-' + i)`);
  const s2 = await goBoss();
  await b.eval(`debug.defeatMonster('crypt_brute-1')`);
  const s3 = await goBoss();
  await b.eval(`debug.defeatMonster('crypt_skeleton-6')`);
  const s3b = await goBoss();
  await b.eval(`debug.defeatMonster('crypt_knight-1')`);
  const s4 = await goBoss();
  const inBossRoom = (p) => p.x >= 6 * 32 && p.x < 26 * 32 && p.y >= 3 * 32 && p.y < 18 * 32;
  t.check(
    'DS-11. clearing each step opens exactly the next one: Section II → stopped by the Brute; Elite Chamber → stopped while the Knight or its guard stands; then the Boss Room',
    s2.y < GATE_BOTTOM.s1 && s2.y >= GATE_BOTTOM.s2 && s2.blocked.includes('story_gate_section_2') &&
      s3.y < GATE_BOTTOM.s2 && s3.y >= GATE_BOTTOM.elite && s3.blocked.includes('story_gate_elite') &&
      // (same gate again within 2 s: held back without repeating the message)
      s3b.y >= GATE_BOTTOM.elite && s3b.status !== 'arrived' && !inBossRoom(s3b) &&
      s4.status === 'arrived' && inBossRoom(s4) && s4.blocked.length === 0 && s4.gates.every((g) => g.open),
    JSON.stringify({ s2: [s2.y, s2.blocked], s3: [s3.y, s3.blocked], s3b: [s3b.y, s3b.blocked], s4: [s4.status, s4.x, s4.y, s4.gates] }),
  );
  await api(`takePortal('demo_dungeon_to_town')`);
  await b.eval('debug.setRng(null); debug.setPeaceful(true)');
}

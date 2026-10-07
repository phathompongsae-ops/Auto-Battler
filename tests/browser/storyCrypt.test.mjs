// Story Crypt (Lv3 tutorial profile) in the running game: a Lv3 Story player who meets the
// Dungeon 1 requirements walks in before the Lv20 Dungeon feature exists, meets the Story
// monsters (not the Lv20 repeat ones), and beats the Crypt Lord in a real fight (no HP
// set by hand): holding Attack, using the demo kit, stepping out of each Grave Slam.
// No dungeon run is issued or spent; the Story reward is granted once.
import { sleep } from './cdp.mjs';

// Boss room floor and pillars (data/maps/cryptMap.ts: floor tiles 6..25 x 3..17).
const ROOM = { left: 6 * 32 + 24, right: 26 * 32 - 24, top: 3 * 32 + 24, bottom: 18 * 32 - 24 };
const PILLARS = [[10, 6], [21, 6], [10, 14], [21, 14], [7, 13], [25, 13]].map(([x, y]) => ({ x: x * 32 + 16, y: y * 32 + 16 }));
const DIRS = [
  [['ArrowUp'], 0, -1], [['ArrowDown'], 0, 1], [['ArrowLeft'], -1, 0], [['ArrowRight'], 1, 0],
  [['ArrowUp', 'ArrowLeft'], -Math.SQRT1_2, -Math.SQRT1_2], [['ArrowUp', 'ArrowRight'], Math.SQRT1_2, -Math.SQRT1_2],
  [['ArrowDown', 'ArrowLeft'], -Math.SQRT1_2, Math.SQRT1_2], [['ArrowDown', 'ArrowRight'], Math.SQRT1_2, Math.SQRT1_2],
];

/**
 * How a player reads a Slam: step away or aside (never toward the boss), inside the room,
 * clear of pillars, and without dragging it far from its throne (which would
 * leash-reset it). Returns the arrow key(s) to hold.
 */
function dodgeKeys(s, home) {
  const ax = s.px - s.bx;
  const ay = s.py - s.by;
  const len = Math.hypot(ax, ay) || 1;
  let best = null;
  for (const [keys, dx, dy] of DIRS) {
    const away = (dx * ax + dy * ay) / len;
    if (away < 0) continue; // never toward the boss; sidesteps are fine
    const x = s.px + dx * 110;
    const y = s.py + dy * 110;
    const inside = x > ROOM.left && x < ROOM.right && y > ROOM.top && y < ROOM.bottom;
    const nearPillar = PILLARS.some((p) => Math.hypot(p.x - x, p.y - y) < 48 || Math.hypot(p.x - (s.px + dx * 55), p.y - (s.py + dy * 55)) < 40);
    const score = away * 60 - Math.hypot(x - home.x, y - home.y) * 0.6 - (inside ? 0 : 1000) - (nearPillar ? 500 : 0);
    if (!best || score > best.score) best = { keys, score };
  }
  return best.keys;
}

export async function storyCryptSuite(b, t, shot) {
  t.section('Story Crypt (Lv3 tutorial profile)');
  const api = (expr) => b.eval(`debug.${expr}`);

  // A legitimate Story player: Lv3, "Trouble in the Meadow" turned in, both free points spent, no gear.
  await api(`reset('demo_town')`);
  await b.eval(`debug.setPeaceful(true); debug.setRng(0.5); debug.meetDungeonAccess(); debug.allocateStat('vit', 1); debug.allocateStat('str', 1); debug.startQuest('mvp_03_crypt'); debug.clearLog()`);
  const who = await b.eval(`({ level: debug.levelInfo().level, dungeon: debug.feature('dungeon').unlocked, gear: Object.values(debug.equipment().equipped ?? {}).filter(Boolean).length })`);
  const status0 = await api('dungeonStatus()');
  const entered = await api(`takePortal('demo_town_to_dungeon')`);
  await sleep(200);
  const profile = await api('encounterProfile()');
  const lord = await api(`monster('crypt_lord-1')`);
  const knight = await api(`monster('crypt_knight-1')`);
  const skeleton = await api(`monster('crypt_skeleton-1')`);
  const status1 = await api('dungeonStatus()');
  t.check(
    'SC-1. a Lv3 Story player enters the Crypt before the Lv20 Dungeon feature: Story profile (Lv4 Skeletons, Lv5 Knight, Lv6 Crypt Lord with Story Slam), no run issued',
    entered && who.level === 3 && who.dungeon === false && who.gear === 0 && profile === 'story' &&
      lord.level === 6 && lord.maxHp === 2800 && lord.special === 'crypt_slam_story' &&
      knight.level === 5 && knight.maxHp === 550 && knight.special === 'crypt_cleave_story' &&
      skeleton.level === 4 && skeleton.maxHp === 110 &&
      status1.inRun === null && status1.nextRun === status0.nextRun,
    JSON.stringify({ who, profile, lord, knight, skeleton, status0, status1 }),
  );

  // The boss fight, for real. Start just south of the Crypt Lord, in its room.
  await api(`teleport(${lord.spawnX}, ${lord.spawnY + 64})`);
  await b.eval(`debug.selectTarget('crypt_lord-1'); debug.clearLog(); debug.setPeaceful(false)`);
  await b.keyDown('Space');
  const home = { x: lord.spawnX, y: lord.spawnY };
  const SLAM_RADIUS = 84;
  const PLAYER_RADIUS = 10;
  const BOSS_RADIUS = 24;
  let approaches = 0;
  const keys = { KeyQ: 4100, KeyE: 2600, KeyR: 12100 }; // Power Slash, Fire Bolt, Guard (demo kit)
  const nextPress = { KeyQ: 0, KeyE: 0, KeyR: 0 };
  let slamsSeen = 0;
  let dodged = 0;
  const start = Date.now();
  let s;
  for (;;) {
    s = await b.eval(`(() => { const m = debug.monster('crypt_lord-1'); const p = debug.player();
      return { bx: m.x, by: m.y, bossDead: m.dead, bossHp: m.hp, bossState: m.state, px: p.x, py: p.y, hp: p.hp, dead: p.dead,
        slams: debug.log.filter((e) => e.type === 'skillWindup' && e.source === 'crypt_lord-1').length }; })()`);
    if (s.bossDead || s.dead || Date.now() - start > 150000) break;
    if (s.slams > slamsSeen) {
      // A Grave Slam wind-up: let go of Attack and step straight out of its radius, then come back.
      slamsSeen = s.slams;
      await b.keyUp('Space');
      const step = dodgeKeys(s, home);
      const t0 = Date.now();
      for (const k of step) await b.keyDown(k);
      await b.waitFor(
        `(() => { const m = debug.monster('crypt_lord-1'); const p = debug.player(); return Math.hypot(p.x - m.x, p.y - m.y) - ${PLAYER_RADIUS} > ${SLAM_RADIUS + 14}; })()`,
        { timeout: 900, label: 'out of the Slam' },
      ).catch(() => {});
      for (const k of step) await b.keyUp(k);
      await sleep(Math.max(0, 1250 - (Date.now() - t0)));
      dodged++;
      await b.keyDown('Space');
      continue;
    }
    // Out of reach (the boss is still walking over, or caught on a pillar): close the gap like a player would.
    const gap = Math.hypot(s.bx - s.px, s.by - s.py) - BOSS_RADIUS - PLAYER_RADIUS;
    if (gap > 36) {
      const toward = DIRS.reduce((best, d) => {
        const dot = (d[1] * (s.bx - s.px) + d[2] * (s.by - s.py)) / (gap + BOSS_RADIUS + PLAYER_RADIUS);
        return dot > best.dot ? { dot, keys: d[0] } : best;
      }, { dot: -2, keys: [] });
      for (const k of toward.keys) await b.keyDown(k);
      await sleep(Math.min(250, (gap / 160) * 1000));
      for (const k of toward.keys) await b.keyUp(k);
      approaches++;
      continue;
    }
    const now = Date.now();
    for (const [k, every] of Object.entries(keys)) {
      if (now >= nextPress[k]) {
        await b.press(k);
        nextPress[k] = now + every;
      }
    }
    await sleep(80);
  }
  await b.keyUp('Space');
  const log = await b.eval(`({ enraged: debug.log.some((e) => e.type === 'monsterEnraged' && e.entity === 'crypt_lord-1'),
    defeated: debug.log.find((e) => e.type === 'bossDefeated') ?? null,
    slamHits: debug.log.filter((e) => e.type === 'damage' && e.skill === 'crypt_slam_story' && e.target === 'player').length,
    dealt: debug.log.filter((e) => e.type === 'damage' && e.target === 'crypt_lord-1').reduce((m, e) => ((m[e.skill] = [(m[e.skill]?.[0] ?? 0) + 1, (m[e.skill]?.[1] ?? 0) + e.amount]), m), {}),
    taken: debug.log.filter((e) => e.type === 'damage' && e.target === 'player').reduce((m, e) => ((m[e.skill] = [(m[e.skill]?.[0] ?? 0) + 1, (m[e.skill]?.[1] ?? 0) + e.amount]), m), {}),
    failed: debug.log.filter((e) => e.type === 'skillFailed').reduce((m, e) => ((m[e.skill + ':' + e.reason] = (m[e.skill + ':' + e.reason] ?? 0) + 1), m), {}) })`);
  const fightSec = Math.round((Date.now() - start) / 1000);
  const after = await api('player()');
  const status2 = await api('dungeonStatus()');
  await shot('story-crypt-01-lord-defeated');
  t.check(
    'SC-2. a Lv3 Story player beats the Story Crypt Lord in a real fight (no HP set by hand): several Slams telegraphed, the Enrage phase reached, no run claimed',
    s.bossDead && !after.dead && slamsSeen >= 3 && log.enraged && log.defeated && log.defeated.rewarded === false && log.defeated.item === undefined &&
      status2.inRun === null && status2.nextRun === status0.nextRun && status2.fullClaimsUsed === status0.fullClaimsUsed,
    JSON.stringify({ fightSec, slamsSeen, dodged, approaches, slamHits: log.slamHits, hpLeft: after.hp, bossHpLeft: s.bossHp, bossState: s.bossState, at: [Math.round(s.px), Math.round(s.py), Math.round(s.bx), Math.round(s.by)], enraged: log.enraged, defeated: log.defeated, dealt: log.dealt, taken: log.taken, failed: log.failed, status0, status2 }),
  );

  // The Story reward: once, then never again.
  const phase = await api(`questPhase('mvp_03_crypt')`);
  await api(`takePortal('demo_dungeon_boss_exit')`);
  const gold0 = (await api('equipment()')).gold;
  const first = await api(`turnInQuest('mvp_03_crypt', 'npc_captain_rowan')`);
  const gold1 = (await api('equipment()')).gold;
  const again = await api(`turnInQuest('mvp_03_crypt', 'npc_captain_rowan')`);
  const gold2 = (await api('equipment()')).gold;
  t.check(
    'SC-3. back in Town the Story reward (600 Gold) is granted once; a second turn-in is refused; still no dungeon run was spent',
    phase === 'ready' && (await api('navState()')).mapId === 'demo_town' && first.ok && gold1 === gold0 + 600 && again.reason === 'already_claimed' && gold2 === gold1 &&
      (await api('dungeonStatus()')).fullClaimsUsed === status0.fullClaimsUsed,
    JSON.stringify({ phase, first, again, gold0, gold1, gold2 }),
  );
  await b.eval('debug.setRng(null); debug.setPeaceful(true)');
}

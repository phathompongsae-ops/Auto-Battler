import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { FixedServerDay } from '../../src/core/serverDay';
import type { DifficultyId } from '../../src/data/dungeonDifficulty';
import { QUEST_TYPES, QUESTS, type QuestDef } from '../../src/data/questData';
import { DEMO_MARKER_ID, DEMO_NPC_ID } from '../../src/data/quests/demoTestQuests';
import { claimDungeonClear } from '../../src/dungeon/claim';
import { enhanceAndReport } from '../../src/equipment/enhancement';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { grantKillRewards } from '../../src/game/killRewards';
import { LootSystem } from '../../src/loot/LootSystem';
import { cumulativeExp } from '../../src/progression/expCurve';
import { changeJob } from '../../src/progression/statActions';
import { MAX_TRACKED_QUESTS } from '../../src/quests/QuestSystem';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave, type PlayerSave } from '../../src/save/playerSave';
import { makeSaveTarget } from './fixtures';

/** Test-only quest definitions (the demo chain is tested separately). */
const q = (id: string, over: Partial<QuestDef> = {}): QuestDef => ({
  id,
  title: `T ${id}`,
  description: '',
  type: 'side',
  objectives: [{ kind: 'talk', npcId: 'npc_a' }],
  rewards: {},
  ...over,
});

const DEFS: Record<string, QuestDef> = Object.fromEntries(
  [
    q('talk', { rewards: { gold: 10 } }),
    q('after_talk', { prerequisites: { requiredQuestIds: ['talk'] } }),
    q('lv5', { prerequisites: { requiredLevel: 5 } }),
    q('warrior_only', { type: 'job', prerequisites: { requiredClass: ['warrior'] } }),
    q('day3', { prerequisites: { requiredServerDay: 3 } }),
    q('needs_feature', { prerequisites: { requiredFeatureIds: ['demo_feature'] } }),
    q('kill3', { objectives: [{ kind: 'kill', monsterId: 'slime', count: 3 }] }),
    q('kill2', { objectives: [{ kind: 'kill', monsterId: 'slime', count: 2 }] }),
    q('kill_wolf', { objectives: [{ kind: 'kill', monsterId: 'wolf' }] }),
    q('collect3', { objectives: [{ kind: 'collect', itemId: 'slime_sample', count: 3 }] }),
    q('visit', { objectives: [{ kind: 'visit', locationId: 'loc_a' }] }),
    q('clear2', { objectives: [{ kind: 'dungeon_clear', dungeonId: 'demo_dungeon', count: 2 }] }),
    q('clear_hell', { objectives: [{ kind: 'dungeon_clear', dungeonId: 'demo_dungeon', difficulty: 'hell' }] }),
    q('enhance2', { objectives: [{ kind: 'enhance', count: 2 }] }),
    q('enhance_to3', { objectives: [{ kind: 'enhance', minLevel: 3 }] }),
    q('two_parts', { objectives: [{ kind: 'talk', npcId: 'npc_a' }, { kind: 'visit', locationId: 'loc_a' }] }),
    q('rich', {
      type: 'feature',
      objectives: [{ kind: 'talk', npcId: 'npc_rich' }],
      rewards: { exp: 500, gold: 25, diamond: 3, items: [{ itemId: 'town_warp_scroll', count: 2 }], unlockFeatures: ['crafting'] },
      featureUnlockId: 'demo_feature',
    }),
  ].map((d) => [d.id, d]),
);

function setup(defs: Record<string, QuestDef> = DEFS, level = 1, day = 1) {
  const serverDay = new FixedServerDay(day);
  const t = makeSaveTarget(level, undefined, serverDay, defs);
  const announced: string[] = [];
  const claimed: string[] = [];
  t.events.on('questAvailable', (e) => announced.push(e.questId));
  t.events.on('questClaimed', (e) => claimed.push(e.questId));
  t.quests.refresh();
  const loot = new LootSystem(t.events, t.inventory);
  const kill = (monsterId: string, zone: 'field' | 'dungeon' = 'field') => {
    loot.rng = () => 0;
    return grantKillRewards(
      { id: `${monsterId}-1`, x: 0, y: 0, def: { id: monsterId, tier: 'normal', expReward: 30, lootTable: 'slime' } },
      { zone, fieldEnergy: t.fieldEnergy, progression: t.progression, loot, player: t.player, now: 0, events: t.events },
    );
  };
  const ids = sequentialIds('eq');
  const claimRun = (run: ReturnType<typeof t.ledger.startRun>) =>
    claimDungeonClear(run, {
      ledger: t.ledger,
      entitlements: t.entitlements,
      inventory: t.inventory,
      wallet: t.wallet,
      equipment: t.equipment,
      grantExp: (n) => t.progression.grantExp(t.player, n),
      rng: seededRng(run.seq),
      newItemId: ids,
      events: t.events,
    });
  const clear = (difficulty: DifficultyId = 'normal') => claimRun(t.ledger.startRun('demo_dungeon', difficulty, t.combat.level));
  const talk = (npcId: string) => t.events.emit('npcInteracted', { npcId });
  const visit = (locationId: string) => t.events.emit('locationReached', { locationId });
  const status = (id: string) => t.quests.status(id);
  const progress = (id: string) => t.quests.progress(id).map((p) => p.current);
  return { t, qs: t.quests, serverDay, announced, claimed, loot, kill, clear, claimRun, talk, visit, status, progress, ids };
}

describe('quest data', () => {
  test('all six quest types are supported', () => {
    assert.deepEqual([...QUEST_TYPES], ['main', 'side', 'feature', 'daily', 'weekly', 'job']);
  });

  test('no quest can grant skill points: rewards only use exp/gold/diamond/items/unlockFeatures', () => {
    const allowed = new Set(['exp', 'gold', 'diamond', 'items', 'unlockFeatures']);
    for (const def of [...Object.values(QUESTS), ...Object.values(DEFS)]) {
      for (const key of Object.keys(def.rewards)) assert.ok(allowed.has(key), `${def.id}: ${key}`);
    }
  });

  test('quest data references only existing quests', () => {
    for (const def of Object.values(QUESTS)) {
      for (const id of [...(def.prerequisites?.requiredQuestIds ?? []), ...(def.nextQuestIds ?? [])]) assert.ok(id in QUESTS, `${def.id} -> ${id}`);
    }
  });
});

describe('prerequisites and availability', () => {
  test('no prerequisites: available; unmet: locked', () => {
    const s = setup();
    assert.equal(s.status('talk'), 'available');
    for (const id of ['after_talk', 'lv5', 'warrior_only', 'day3', 'needs_feature']) assert.equal(s.status(id), 'locked', id);
  });

  test('required level: opens on level-up (through real progression)', () => {
    const s = setup();
    s.t.progression.grantExp(s.t.player, cumulativeExp(5));
    assert.equal(s.t.combat.level, 5);
    assert.equal(s.status('lv5'), 'available');
    assert.ok(s.announced.includes('lv5'));
  });

  test('required previous quest: opens when it is claimed (not merely completed)', () => {
    const s = setup();
    s.qs.start('talk');
    s.talk('npc_a');
    assert.equal(s.status('talk'), 'completed');
    assert.equal(s.status('after_talk'), 'locked');
    s.qs.claim('talk');
    assert.equal(s.status('after_talk'), 'available');
  });

  test('required class: opens on job change', () => {
    const s = setup(DEFS, 11);
    assert.equal(changeJob(s.t, 'warrior').ok, true);
    s.t.events.emit('jobChanged', { entityId: 'p', jobId: 'warrior', fromJobId: 'novice', tier: 1 });
    assert.equal(s.status('warrior_only'), 'available');
    assert.ok(s.announced.includes('warrior_only'));
  });

  test('required server day: opens when the day arrives (refresh on day change)', () => {
    const s = setup();
    s.serverDay.value = 2;
    s.qs.refresh();
    assert.equal(s.status('day3'), 'locked');
    s.serverDay.value = 3;
    s.qs.refresh();
    assert.equal(s.status('day3'), 'available');
  });

  test('required feature: opens when a claimed quest unlocks it', () => {
    const s = setup();
    s.qs.start('rich');
    s.talk('npc_rich');
    s.qs.claim('rich');
    assert.equal(s.qs.isFeatureUnlocked('demo_feature'), true);
    assert.equal(s.status('needs_feature'), 'available');
    assert.ok(s.announced.includes('needs_feature'));
  });

  test('the available notification fires once per quest, however often availability is checked', () => {
    const s = setup();
    for (let i = 0; i < 5; i++) s.qs.refresh();
    s.t.progression.grantExp(s.t.player, cumulativeExp(8)); // several level-ups → several refreshes
    const counts = s.announced.reduce<Record<string, number>>((m, id) => ((m[id] = (m[id] ?? 0) + 1), m), {});
    assert.ok(Object.values(counts).every((n) => n === 1), JSON.stringify(counts));
    assert.equal(counts.talk, 1);
    assert.equal(counts.lv5, 1);
    assert.equal(counts.day3, undefined);
  });

  test('the notification carries id, title and type', () => {
    const s = setup();
    const events: unknown[] = [];
    s.t.events.on('questAvailable', (e) => events.push(e));
    s.t.progression.grantExp(s.t.player, cumulativeExp(5));
    assert.deepEqual(events, [{ questId: 'lv5', title: 'T lv5', questType: 'side' }]);
  });
});

describe('start and active', () => {
  test('an available quest starts; a locked, unknown or started one does not', () => {
    const s = setup();
    assert.deepEqual(s.qs.start('talk'), { ok: true });
    assert.equal(s.status('talk'), 'active');
    assert.deepEqual(s.qs.start('talk'), { ok: false, reason: 'already_started' });
    assert.deepEqual(s.qs.start('lv5'), { ok: false, reason: 'locked' });
    assert.deepEqual(s.qs.start('nope'), { ok: false, reason: 'unknown_quest' });
  });

  test('only ACTIVE quests progress; quests are never auto-started or auto-claimed', () => {
    const s = setup();
    s.talk('npc_a');
    assert.equal(s.status('talk'), 'available');
    assert.deepEqual(s.progress('talk'), [0]);
    s.qs.start('talk');
    s.talk('npc_a');
    assert.equal(s.status('talk'), 'completed');
    assert.deepEqual(s.claimed, []);
  });
});

describe('objectives', () => {
  test('talk: right NPC advances, wrong NPC does not', () => {
    const s = setup();
    s.qs.start('talk');
    s.talk('npc_b');
    assert.equal(s.status('talk'), 'active');
    s.talk('npc_a');
    assert.equal(s.status('talk'), 'completed');
  });

  test('kill: matching monster advances, others do not, and the count caps', () => {
    const s = setup();
    s.qs.start('kill3');
    s.kill('wolf');
    assert.deepEqual(s.progress('kill3'), [0]);
    for (let i = 0; i < 5; i++) s.kill('slime');
    assert.deepEqual(s.progress('kill3'), [3]);
    assert.equal(s.status('kill3'), 'completed');
  });

  test('kill: one event advances every matching active quest', () => {
    const s = setup();
    s.qs.start('kill3');
    s.qs.start('kill2');
    s.qs.start('kill_wolf');
    s.kill('slime');
    s.kill('slime');
    assert.deepEqual([s.progress('kill3'), s.progress('kill2'), s.progress('kill_wolf')], [[2], [2], [0]]);
    assert.equal(s.status('kill2'), 'completed');
  });

  test('kill: a field kill at 0 Energy still counts (no rewards, but quest progress)', () => {
    const s = setup();
    s.qs.start('kill3');
    s.t.fieldEnergy.set(0);
    const decision = s.kill('slime');
    assert.equal(decision.exp, false);
    assert.deepEqual(s.progress('kill3'), [1]);
  });

  test('kill: a dungeon kill counts for an explicit kill objective, still with zero dungeon rewards', () => {
    const s = setup();
    s.qs.start('kill3');
    const before = { exp: s.t.combat.exp, inv: s.t.inventory.entries(), energy: s.t.fieldEnergy.current() };
    const decision = s.kill('slime', 'dungeon');
    assert.deepEqual(decision, { exp: false, farmingDrops: false, questDrops: false, energySpent: 0 });
    assert.deepEqual(s.progress('kill3'), [1]);
    assert.deepEqual({ exp: s.t.combat.exp, inv: s.t.inventory.entries(), energy: s.t.fieldEnergy.current() }, before);
  });

  test('collect: acquired items advance cumulatively; losing them later does not regress', () => {
    const s = setup();
    s.t.inventory.add('slime_sample', 5); // owned before the quest: not an acquisition during it
    s.qs.start('collect3');
    assert.deepEqual(s.progress('collect3'), [0]);
    s.kill('slime'); // field kill with Energy: drops slime_gel + slime_sample on the ground
    s.loot.update(0, s.t.player); // pick up
    assert.deepEqual(s.progress('collect3'), [1]);
    s.t.inventory.remove('slime_sample', 6);
    assert.deepEqual(s.progress('collect3'), [1], 'removal does not regress');
    s.t.events.emit('itemAcquired', { itemId: 'slime_gel', amount: 4, source: 'dev' });
    assert.deepEqual(s.progress('collect3'), [1], 'other items do not count');
    s.t.events.emit('itemAcquired', { itemId: 'slime_sample', amount: 9, source: 'dev' });
    assert.deepEqual(s.progress('collect3'), [3], 'capped');
  });

  test('collect: loading a save does not count the inventory again', () => {
    const s = setup(QUESTS);
    s.qs.start('q_demo_01');
    const text = serializePlayerSave(capturePlayerSave(s.t));
    const loaded = setup(QUESTS);
    const progressEvents: unknown[] = [];
    loaded.t.events.on('questProgress', (e) => progressEvents.push(e));
    loaded.t.events.on('itemAcquired', (e) => progressEvents.push(e));
    applyPlayerSave(loaded.t, deserializePlayerSave(text));
    assert.deepEqual(progressEvents, []);
  });

  test('visit: matching location advances, others do not', () => {
    const s = setup();
    s.qs.start('visit');
    s.visit('loc_b');
    assert.equal(s.status('visit'), 'active');
    s.visit('loc_a');
    assert.equal(s.status('visit'), 'completed');
  });

  test('several objectives: each completes independently and stays completed', () => {
    const s = setup();
    s.qs.start('two_parts');
    s.talk('npc_a');
    s.talk('npc_a');
    assert.deepEqual(s.progress('two_parts'), [1, 0]);
    assert.equal(s.status('two_parts'), 'active');
    s.visit('loc_a');
    assert.equal(s.status('two_parts'), 'completed');
  });
});

describe('dungeon clear objective', () => {
  test('successful clears advance; any difficulty without a filter', () => {
    const s = setup(DEFS, 15);
    s.qs.start('clear2');
    s.clear('normal');
    assert.deepEqual(s.progress('clear2'), [1]);
    s.clear('hard');
    assert.equal(s.status('clear2'), 'completed');
  });

  test('failed or abandoned runs do not advance', () => {
    const s = setup(DEFS, 15);
    s.qs.start('clear2');
    for (let i = 0; i < 4; i++) s.t.ledger.startRun('demo_dungeon', 'hell', 15); // entered, died / left
    assert.deepEqual(s.progress('clear2'), [0]);
  });

  test('a duplicate claim of the same run does not double-progress', () => {
    const s = setup(DEFS, 15);
    s.qs.start('clear2');
    const run = s.t.ledger.startRun('demo_dungeon', 'normal', 15);
    s.claimRun(run);
    assert.deepEqual(s.claimRun(run), { ok: false, reason: 'already_claimed' });
    assert.deepEqual(s.progress('clear2'), [1]);
  });

  test('the difficulty filter only counts that difficulty', () => {
    const s = setup(DEFS, 15);
    s.qs.start('clear_hell');
    s.clear('normal');
    s.clear('hard');
    assert.equal(s.status('clear_hell'), 'active');
    s.clear('hell');
    assert.equal(s.status('clear_hell'), 'completed');
  });

  test('an Assist (or unrewarded) clear still counts; the reward quota is untouched by quests', () => {
    const s = setup(DEFS, 15);
    for (let i = 0; i < 5; i++) s.clear();
    s.qs.start('clear2');
    const assist = s.clear();
    assert.equal(assist.ok && assist.kind, 'assist');
    for (let i = 0; i < 3; i++) s.clear(); // 2 more assists, then 'none'
    assert.equal(s.status('clear2'), 'completed');
    const st = s.t.entitlements.status();
    assert.equal(st.fullClaimsUsed, 5);
    assert.equal(st.assistRewardsClaimed, 3);
  });
});

describe('enhance objective', () => {
  function armed(s: ReturnType<typeof setup>, level = 0) {
    s.t.inventory.add('enhancement_stone', 100);
    s.t.wallet.add('gold', 1_000_000);
    const item = createEquipment('knight_sword', seededRng(1), s.ids);
    item.enhancement = level;
    s.t.equipment.add(item);
    const ctx = (roll: number) => ({ inventory: s.t.inventory, wallet: s.t.wallet, rng: () => roll, events: s.t.events });
    return { item, succeed: () => enhanceAndReport(item, ctx(0)), fail: () => enhanceAndReport(item, ctx(0.9999)) };
  }

  test('successes advance; failures do not', () => {
    const s = setup();
    s.qs.start('enhance2');
    const e = armed(s, 10); // +11 is a 55% roll
    const failed = e.fail();
    assert.ok(failed.ok && !failed.success, 'the attempt happened and failed');
    assert.deepEqual(s.progress('enhance2'), [0]);
    const r = e.succeed();
    assert.ok(r.ok && r.success);
    assert.deepEqual(s.progress('enhance2'), [1]);
  });

  test('minimum target: only a success reaching +3 or higher counts', () => {
    const s = setup();
    s.qs.start('enhance_to3');
    const e = armed(s, 0);
    e.succeed(); // +1
    e.succeed(); // +2
    assert.equal(s.status('enhance_to3'), 'active');
    e.succeed(); // +3
    assert.equal(s.status('enhance_to3'), 'completed');
  });
});

describe('claiming rewards', () => {
  const ready = () => {
    const s = setup();
    s.qs.start('rich');
    s.talk('npc_rich');
    return s;
  };

  test('not ready, unknown or already claimed: nothing', () => {
    const s = setup();
    s.qs.start('talk');
    assert.deepEqual(s.qs.claim('talk'), { ok: false, reason: 'not_completed' });
    assert.deepEqual(s.qs.claim('lv5'), { ok: false, reason: 'not_completed' });
    assert.deepEqual(s.qs.claim('nope'), { ok: false, reason: 'unknown_quest' });
  });

  test('rewards are granted once: EXP through progression, Gold, Diamond, items, features', () => {
    const s = ready();
    const exp: number[] = [];
    const acquired: unknown[] = [];
    s.t.events.on('expGained', (e) => exp.push(e.amount));
    s.t.events.on('itemAcquired', (e) => acquired.push(e));
    const energy = s.t.fieldEnergy.current();
    const skillPointsBefore = s.t.progress.remainingSkillPoints(s.t.combat.level);

    assert.deepEqual(s.qs.claim('rich'), { ok: true, questId: 'rich' });
    assert.equal(s.status('rich'), 'claimed');
    assert.deepEqual(exp, [500]);
    assert.equal(s.t.combat.level > 1, true, 'real level-ups');
    assert.equal(s.t.wallet.get('gold'), 25);
    assert.equal(s.t.wallet.get('diamond'), 3);
    assert.equal(s.t.inventory.count('town_warp_scroll'), 2);
    assert.deepEqual(acquired, [{ itemId: 'town_warp_scroll', amount: 2, source: 'quest' }]);
    assert.ok(s.t.features.isFeatureUnlocked('crafting') && s.t.features.isFeatureUnlocked('demo_feature'), 'quest feature rewards');
    assert.equal(s.t.fieldEnergy.current(), energy, 'no Field Energy used');
    assert.equal(s.t.progress.remainingSkillPoints(s.t.combat.level), skillPointsBefore, 'no skill points from quests');

    const snapshot = () => [s.t.combat.level, s.t.combat.exp, s.t.wallet.toRecord(), s.t.inventory.entries(), [...s.t.features.unlocked]];
    const after = snapshot();
    for (let i = 0; i < 3; i++) assert.deepEqual(s.qs.claim('rich'), { ok: false, reason: 'already_claimed' });
    assert.deepEqual(snapshot(), after);
    assert.deepEqual(s.claimed, ['rich']);
  });

  test('quest EXP respects the level cap (Overflow)', () => {
    const s = setup({ big: q('big', { rewards: { exp: 100_000_000 } }) }, 39, 1); // day 1: cap 40
    s.qs.start('big');
    s.talk('npc_a');
    s.qs.claim('big');
    assert.equal(s.t.combat.level, 40);
  });
});

describe('tracking', () => {
  test(`up to ${MAX_TRACKED_QUESTS} tracked; a 4th fails safely; only started quests can be tracked`, () => {
    const s = setup();
    for (const id of ['talk', 'kill3', 'kill2', 'visit']) s.qs.start(id);
    assert.deepEqual(s.qs.track('lv5'), { ok: false, reason: 'not_active' });
    for (const id of ['talk', 'kill3', 'kill2']) assert.deepEqual(s.qs.track(id), { ok: true });
    assert.deepEqual(s.qs.track('talk'), { ok: true }, 'tracking again is a no-op');
    assert.deepEqual(s.qs.track('visit'), { ok: false, reason: 'tracking_full' });
    assert.deepEqual(s.qs.trackedQuestIds(), ['talk', 'kill3', 'kill2']);
    s.qs.untrack('kill2');
    assert.deepEqual(s.qs.track('visit'), { ok: true });
  });

  test('untracked active quests still progress; claiming untracks', () => {
    const s = setup();
    s.qs.start('talk');
    s.qs.start('visit');
    s.qs.track('talk');
    s.visit('loc_a');
    assert.equal(s.status('visit'), 'completed');
    s.talk('npc_a');
    s.qs.claim('talk');
    assert.deepEqual(s.qs.trackedQuestIds(), []);
  });
});

describe('demo quest chain (test fixtures)', () => {
  test('q_demo_01 → 02 → 03 with talk, kill and visit, ending in a feature unlock', () => {
    const s = setup(QUESTS);
    assert.deepEqual(s.announced, ['q_demo_01']);
    assert.equal(s.status('q_demo_02'), 'locked');

    s.qs.start('q_demo_01');
    s.talk(DEMO_NPC_ID);
    s.qs.claim('q_demo_01');
    assert.equal(s.t.wallet.get('gold'), 50);
    assert.equal(s.status('q_demo_02'), 'available');

    s.qs.start('q_demo_02');
    for (let i = 0; i < 3; i++) s.kill('slime');
    s.qs.claim('q_demo_02');
    assert.equal(s.t.inventory.count('town_warp_scroll'), 1);

    s.qs.start('q_demo_03');
    s.visit(DEMO_MARKER_ID);
    s.qs.claim('q_demo_03');
    assert.equal(s.qs.isFeatureUnlocked('demo_feature'), true);
    assert.deepEqual(s.announced, ['q_demo_01', 'q_demo_02', 'q_demo_03']);
  });
});

describe('quest save / load', () => {
  /** Mid-chain: 01 claimed, 02 half done and tracked, a feature unlocked. */
  function midChain() {
    const s = setup(QUESTS);
    s.qs.start('q_demo_01');
    s.talk(DEMO_NPC_ID);
    s.qs.claim('q_demo_01');
    s.qs.start('q_demo_02');
    s.kill('slime');
    s.kill('slime');
    s.qs.track('q_demo_02');
    s.t.features.unlock('warp');
    return s;
  }

  test('status, progress, claimed state, tracking and features persist; nothing is re-announced', () => {
    const a = midChain();
    const text = serializePlayerSave(capturePlayerSave(a.t));
    const b = setup(QUESTS);
    b.announced.length = 0;
    applyPlayerSave(b.t, deserializePlayerSave(text));
    b.qs.refresh();
    assert.equal(b.status('q_demo_01'), 'claimed');
    assert.equal(b.status('q_demo_02'), 'active');
    assert.deepEqual(b.progress('q_demo_02'), [2]);
    assert.deepEqual(b.qs.trackedQuestIds(), ['q_demo_02']);
    assert.equal(b.qs.isFeatureUnlocked('warp'), true);
    assert.deepEqual(b.announced, [], 'already announced before saving');
    assert.deepEqual(b.qs.claim('q_demo_01'), { ok: false, reason: 'already_claimed' });

    b.kill('slime');
    assert.equal(b.status('q_demo_02'), 'completed');
  });

  test('impossible quest state is rejected', () => {
    const good = capturePlayerSave(midChain().t);
    const bad = (mutate: (s: PlayerSave) => void) => {
      const s = structuredClone(good);
      mutate(s);
      return () => deserializePlayerSave(JSON.stringify(s));
    };
    assert.throws(bad((s) => (s.questLog.records.q_nope = { status: 'active', progress: [0] })), /unknown quest/);
    assert.throws(bad((s) => (s.questLog.records.q_demo_02.progress = [4])), /out of range/);
    assert.throws(bad((s) => (s.questLog.records.q_demo_02.progress = [1, 1])), /does not match/);
    assert.throws(bad((s) => (s.questLog.records.q_demo_02.status = 'claimed')), /without finishing/);
    assert.throws(bad((s) => (s.questLog.records.q_demo_02.progress = [3])), /still active/);
    assert.throws(bad((s) => (s.questLog.tracked = ['q_demo_01'])), /tracked/);
    assert.throws(bad((s) => (s.features = ['not_a_feature' as never])), /features/);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { FixedServerDay } from '../../src/core/serverDay';
import type { MonsterTier } from '../../src/data/monsterBalance';
import { DAILY_POOL, DAILY_QUESTS, RECURRING_CONFIG, WEEKLY_MILESTONES, WEEKLY_QUESTS } from '../../src/data/quests/recurringQuests';
import { claimDungeonClear } from '../../src/dungeon/claim';
import { enhanceAndReport } from '../../src/equipment/enhancement';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { grantKillRewards } from '../../src/game/killRewards';
import { LootSystem } from '../../src/loot/LootSystem';
import { selectDailyQuests, serverWeek } from '../../src/quests/RecurringQuests';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { makeSaveTarget } from './fixtures';

/** A Lv15 character on a settable server day, with every real event path the recurring quests listen to. */
function rig(day = 1, { unlock = true } = {}) {
  const serverDay = new FixedServerDay(day);
  const t = makeSaveTarget(15, undefined, serverDay);
  const r = t.recurring;
  if (unlock) {
    for (const id of ['daily_commission', 'weekly_quests'] as const) {
      t.features.unlock(id);
      t.events.emit('featureUnlocked', { featureId: id });
    }
  }
  const loot = new LootSystem(t.events, t.inventory);
  loot.rng = () => 0.99; // no drops unless a test wants them
  const kill = (tier: MonsterTier = 'normal', zone: 'field' | 'dungeon' = 'field') =>
    grantKillRewards(
      { id: 'm-1', x: 0, y: 0, def: { id: 'slime', tier, expReward: 1, lootTable: 'slime' } },
      { zone, fieldEnergy: t.fieldEnergy, progression: t.progression, loot, player: t.player, now: 0, events: t.events },
    );
  const ids = sequentialIds('eq');
  const clear = () =>
    claimDungeonClear(t.ledger.startRun('demo_dungeon', 'normal', t.combat.level), {
      ledger: t.ledger,
      entitlements: t.entitlements,
      inventory: t.inventory,
      wallet: t.wallet,
      equipment: t.equipment,
      grantExp: (n) => t.progression.grantExp(t.player, n),
      rng: seededRng(1),
      newItemId: ids,
      events: t.events,
    });
  const sword = createEquipment('knight_sword', seededRng(1), ids);
  t.equipment.add(sword);
  t.inventory.add('enhancement_stone', 999);
  t.wallet.add('gold', 10_000_000);
  const enhance = (roll = 0) => enhanceAndReport(sword, { inventory: t.inventory, wallet: t.wallet, rng: () => roll, events: t.events });
  const visit = (locationId: string) => t.events.emit('locationReached', { locationId });
  const status = (id: string) => t.quests.status(id);
  const progress = (id: string) => t.quests.progress(id).map((p) => p.current);
  /** Move to another server day and run the same sync the game runs on a day change. */
  const goToDay = (d: number) => {
    serverDay.value = d;
    r.sync();
    t.quests.refresh();
  };
  /** Finish a quest's objectives by emitting the gameplay events it listens to. */
  const finish = (questId: string) => {
    const def = t.quests.defs[questId];
    t.quests.progress(questId).forEach((p, i) => {
      const o = def.objectives[i];
      for (let n = p.current; n < p.required; n++) {
        if (o.kind === 'kill') t.events.emit('monsterKilled', { entityId: 'x', monsterId: o.monsterId ?? 'slime', tier: o.tier ?? 'normal', zone: o.zone ?? 'field' });
        if (o.kind === 'visit') visit(o.locationId);
        if (o.kind === 'collect') t.events.emit('itemAcquired', { itemId: o.itemId, amount: 1, source: 'loot' });
        if (o.kind === 'dungeon_clear') t.events.emit('dungeonCleared', { runId: 'x', dungeonId: 'demo_dungeon', difficulty: 'normal', assist: !!o.assist });
        if (o.kind === 'enhance') t.events.emit('equipmentEnhanced', { instanceId: 'x', success: true, from: 0, to: 1 });
      }
    });
  };
  return { t, r, serverDay, kill, clear, enhance, visit, status, progress, goToDay, finish, loot };
}

/** First server day (from `from`) whose Daily set includes `questId`. */
function dayWith(questId: string, from = 1, level = 15): number {
  for (let d = from; d < from + 500; d++) if (selectDailyQuests(d, level).includes(questId)) return d;
  throw new Error(`no day selects ${questId}`);
}

const reload = (s: ReturnType<typeof rig>, day = s.serverDay.value) => {
  const text = serializePlayerSave(capturePlayerSave(s.t));
  const l = rig(day, { unlock: false });
  applyPlayerSave(l.t, deserializePlayerSave(text));
  l.r.sync(); // what CombatWorld.loadPlayer does
  l.t.quests.refresh();
  return l;
};

describe('Daily selection', () => {
  test('exactly 3 distinct Daily quests every day, all from the pool', () => {
    for (let d = 1; d <= 200; d++) {
      const set = selectDailyQuests(d, 15);
      assert.equal(set.length, RECURRING_CONFIG.dailyCount, `day ${d}`);
      assert.equal(new Set(set).size, 3, `day ${d}`);
      assert.ok(set.every((id) => id in DAILY_QUESTS));
    }
  });

  test('deterministic from the server day alone (never browser randomness)', () => {
    const random = Math.random;
    Math.random = () => {
      throw new Error('Math.random used');
    };
    try {
      assert.deepEqual(selectDailyQuests(42, 15), selectDailyQuests(42, 15));
    } finally {
      Math.random = random;
    }
    const days = Array.from({ length: 30 }, (_, i) => selectDailyQuests(i + 1, 15).join());
    assert.ok(new Set(days).size > 5, 'the set changes from day to day');
  });

  test('eligibility filters the pool (level)', () => {
    const pool = [...DAILY_POOL, { questId: 'daily_late', weight: 1000, minLevel: 50 }];
    for (let d = 1; d <= 50; d++) assert.equal(selectDailyQuests(d, 15, pool).includes('daily_late'), false);
  });

  test('the same day keeps the same set, also across reloads; quests are assigned (active)', () => {
    const s = rig(5);
    const set = s.r.dailyQuestIds();
    assert.deepEqual(set, selectDailyQuests(5, 15));
    assert.ok(set.every((id) => s.status(id) === 'active'));
    s.r.sync();
    assert.deepEqual(s.r.dailyQuestIds(), set);
    const l = reload(s);
    assert.deepEqual(l.r.dailyQuestIds(), set);
    assert.ok(set.every((id) => l.status(id) === 'active'));
  });

  test('locked feature: nothing startable; unlocking assigns today\'s set', () => {
    const s = rig(3, { unlock: false });
    for (const id of s.r.dailyQuestIds()) {
      assert.equal(s.status(id), 'locked');
      assert.deepEqual(s.t.quests.start(id), { ok: false, reason: 'locked' });
    }
    for (const id of Object.keys(WEEKLY_QUESTS)) assert.equal(s.status(id), 'locked');
    s.t.features.unlock('daily_commission');
    s.t.events.emit('featureUnlocked', { featureId: 'daily_commission' });
    assert.ok(s.r.dailyQuestIds().every((id) => s.status(id) === 'active'));
    assert.equal(s.status('weekly_dungeon_hunter'), 'locked', 'weekly stays locked separately');
  });

  test('Daily quests not in today\'s set are never available', () => {
    const s = rig(dayWith('daily_field_hunter'));
    const other = Object.keys(DAILY_QUESTS).find((id) => !s.r.dailyQuestIds().includes(id))!;
    assert.equal(s.status(other), 'locked');
    assert.deepEqual(s.t.quests.start(other), { ok: false, reason: 'locked' });
  });
});

describe('Daily objectives through real events', () => {
  test('Field Hunter: field normal kills count; dungeon kills do not', () => {
    const s = rig(dayWith('daily_field_hunter'));
    s.kill('normal', 'dungeon');
    s.kill('elite', 'field');
    assert.deepEqual(s.progress('daily_field_hunter'), [0]);
    for (let i = 0; i < 25; i++) s.kill('normal', 'field');
    assert.deepEqual(s.progress('daily_field_hunter'), [20]);
    assert.equal(s.status('daily_field_hunter'), 'completed');
  });

  test('Elite / Mini Boss Dailies: weight 0 until real field content exists — never selected, definitions kept', () => {
    for (const id of ['daily_elite_hunter', 'daily_mini_boss_hunter']) {
      assert.ok(id in DAILY_QUESTS, `${id} still defined`);
      assert.equal(DAILY_POOL.find((p) => p.questId === id)!.weight, 0);
      for (let d = 1; d <= 1000; d++) assert.equal(selectDailyQuests(d, 15).includes(id), false, `${id} on day ${d}`);
    }
  });

  test('field Elite / Mini Boss kill filters (as used by Weekly Elite / Boss Hunter)', () => {
    const s = rig(1);
    s.kill('elite', 'dungeon');
    s.kill('mini_boss', 'dungeon');
    s.kill('normal', 'field');
    assert.deepEqual([s.progress('weekly_elite_hunter'), s.progress('weekly_boss_hunter')], [[0], [0]]);
    s.kill('elite', 'field');
    s.kill('mini_boss', 'field');
    assert.deepEqual([s.progress('weekly_elite_hunter'), s.progress('weekly_boss_hunter')], [[1], [1]]);
  });

  test('Material Collector: picked-up Slime Gel', () => {
    const s = rig(dayWith('daily_material_collector'));
    s.loot.rng = () => 0; // every slime drops its gel
    for (let i = 0; i < 10; i++) {
      s.kill('normal', 'field');
      s.loot.update(0, s.t.player);
    }
    assert.equal(s.status('daily_material_collector'), 'completed');
  });

  test('Dungeon Adventurer: a real dungeon clear (Full Reward)', () => {
    const s = rig(dayWith('daily_dungeon_adventurer'));
    assert.equal(s.clear().ok, true);
    assert.equal(s.status('daily_dungeon_adventurer'), 'completed');
  });

  test('Helping Hand: only a clear resolved as an Assist (rewarded or not); a duplicate claim never counts twice', () => {
    const s = rig(dayWith('daily_helping_hand'));
    for (let i = 0; i < 5; i++) s.clear(); // Full Rewards
    assert.deepEqual(s.progress('daily_helping_hand'), [0]);
    const run = s.t.ledger.startRun('demo_dungeon', 'normal', 15);
    const ctx = { ledger: s.t.ledger, entitlements: s.t.entitlements, inventory: s.t.inventory, wallet: s.t.wallet, equipment: s.t.equipment, grantExp: () => {}, rng: seededRng(2), events: s.t.events };
    const res = claimDungeonClear(run, ctx);
    assert.equal(res.ok && res.kind, 'assist');
    assert.equal(claimDungeonClear(run, ctx).ok, false);
    assert.equal(s.status('daily_helping_hand'), 'completed');
  });

  test('Enhancement Practice: a success counts, a failure does not', () => {
    const s = rig(dayWith('daily_enhancement_practice'));
    for (let i = 0; i < 10; i++) s.enhance(); // to +10 (safe levels)
    assert.equal(s.status('daily_enhancement_practice'), 'completed');
    const f = rig(dayWith('daily_enhancement_practice'));
    for (let i = 0; i < 10; i++) f.t.equipment.items.forEach((it) => (it.enhancement = 10));
    f.enhance(0.9999); // +11 attempt fails
    assert.equal(f.status('daily_enhancement_practice'), 'active');
  });

  test('Explorer: both configured locations', () => {
    const s = rig(dayWith('daily_explorer'));
    s.visit('demo_marker_gate');
    s.visit('somewhere_else');
    assert.equal(s.status('daily_explorer'), 'active');
    s.visit('demo_job_trial_marker');
    assert.equal(s.status('daily_explorer'), 'completed');
  });
});

describe('Daily claim and reset', () => {
  test('claim once through the real reward paths; the week counter counts it once; no Field Energy used', () => {
    const s = rig(dayWith('daily_field_hunter'));
    s.finish('daily_field_hunter');
    const exp: number[] = [];
    s.t.events.on('expGained', (e) => exp.push(e.amount));
    const energy = s.t.fieldEnergy.current();
    const gold = s.t.wallet.get('gold');
    const stones = s.t.inventory.count('enhancement_stone');
    assert.deepEqual(s.t.quests.claim('daily_field_hunter'), { ok: true, questId: 'daily_field_hunter' });
    assert.deepEqual(exp, [150]);
    assert.equal(s.t.wallet.get('gold'), gold + 100);
    assert.equal(s.t.inventory.count('enhancement_stone'), stones + 1);
    assert.equal(s.t.fieldEnergy.current(), energy);
    assert.equal(s.r.state.weekly.dailyClaims, 1);
    assert.deepEqual(s.progress('weekly_adventurer'), [1]);
    assert.deepEqual(s.t.quests.claim('daily_field_hunter'), { ok: false, reason: 'already_claimed' });
    assert.equal(s.r.state.weekly.dailyClaims, 1);
    assert.deepEqual(s.progress('weekly_adventurer'), [1]);
  });

  test('next day: unclaimed rewards expire, progress resets, a fresh set is assigned; Weekly progress stays', () => {
    const day = dayWith('daily_field_hunter', 1);
    const s = rig(day);
    s.finish('daily_field_hunter'); // completed, never claimed
    for (let i = 0; i < 4; i++) s.kill('normal', 'field');
    const weekly = s.progress('weekly_field_hunter')[0];
    assert.ok(weekly >= 24);
    const next = day % 7 === 0 ? day : day + 1; // stay inside the week when possible
    const s2 = next === day ? rig(day + 1) : s;
    if (s2 === s) s.goToDay(next);
    else return; // day was the last of a week; covered by the weekly reset tests
    assert.equal(s.r.state.daily.cycleId, next);
    if (!s.r.dailyQuestIds().includes('daily_field_hunter')) {
      assert.equal(s.status('daily_field_hunter'), 'locked');
      assert.deepEqual(s.t.quests.claim('daily_field_hunter'), { ok: false, reason: 'not_completed' }, 'yesterday\'s reward expired');
    } else assert.deepEqual(s.progress('daily_field_hunter'), [0], 'progress starts over');
    assert.ok(s.r.dailyQuestIds().every((id) => s.status(id) === 'active'));
    assert.equal(s.progress('weekly_field_hunter')[0], weekly, 'a daily reset never touches Weekly');
  });

  test('a reset happens once per day: later syncs the same day change nothing', () => {
    const s = rig(2);
    s.goToDay(3);
    const set = s.r.dailyQuestIds();
    s.kill('normal', 'field');
    const before = JSON.stringify(s.t.quests.toState());
    s.r.sync();
    s.r.sync();
    assert.equal(JSON.stringify(s.t.quests.toState()), before);
    assert.deepEqual(s.r.dailyQuestIds(), set);
  });
});

describe('Weekly quests', () => {
  test('the seven Weekly quests and their rewards', () => {
    assert.deepEqual(
      Object.values(WEEKLY_QUESTS).map((q) => [q.id, q.objectives[0].count, q.rewards.diamond ?? null]),
      [
        ['weekly_dungeon_hunter', 10, 40],
        ['weekly_helping_hand', 3, 30],
        ['weekly_field_hunter', 150, null],
        ['weekly_elite_hunter', 10, 30],
        ['weekly_boss_hunter', 3, null],
        ['weekly_gear_master', 5, 30],
        ['weekly_adventurer', 15, 40],
      ],
    );
  });

  test('Dungeon Hunter (10) and Helping Hand (3) from real dungeon clears', () => {
    const s = rig(1);
    for (let i = 0; i < 12; i++) s.clear(); // 5 Full, 3 rewarded Assists, then unrewarded Assists
    assert.deepEqual(s.progress('weekly_dungeon_hunter'), [10]);
    assert.deepEqual(s.progress('weekly_helping_hand'), [3]);
    const diamond = s.t.wallet.get('diamond');
    assert.equal(s.t.quests.claim('weekly_dungeon_hunter').ok, true);
    assert.equal(s.t.quests.claim('weekly_helping_hand').ok, true);
    assert.equal(s.t.wallet.get('diamond'), diamond + 70);
    assert.equal(s.t.quests.claim('weekly_dungeon_hunter').ok, false);
    assert.equal(s.t.wallet.get('diamond'), diamond + 70);
  });

  test('Field Hunter (150 field kills) → Gold + materials; dungeon kills ignored', () => {
    const s = rig(1);
    for (let i = 0; i < 20; i++) s.kill('normal', 'dungeon');
    for (let i = 0; i < 160; i++) s.kill('normal', 'field');
    assert.deepEqual(s.progress('weekly_field_hunter'), [150]);
    const gold = s.t.wallet.get('gold');
    s.t.quests.claim('weekly_field_hunter');
    assert.equal(s.t.wallet.get('gold'), gold + 2000);
    assert.equal(s.t.inventory.count('rare_craft_material'), 3);
  });

  test('Elite Hunter (10 field Elites) and Boss Hunter (3 field Mini Bosses)', () => {
    const s = rig(1);
    for (let i = 0; i < 12; i++) s.kill('elite', 'field');
    for (let i = 0; i < 5; i++) s.kill('mini_boss', 'dungeon');
    for (let i = 0; i < 3; i++) s.kill('mini_boss', 'field');
    assert.deepEqual(s.progress('weekly_elite_hunter'), [10]);
    assert.deepEqual(s.progress('weekly_boss_hunter'), [3]);
    const stones = s.t.inventory.count('enhancement_stone');
    s.t.quests.claim('weekly_boss_hunter');
    assert.equal(s.t.inventory.count('enhancement_stone'), stones + 10);
    const diamond = s.t.wallet.get('diamond');
    s.t.quests.claim('weekly_elite_hunter');
    assert.equal(s.t.wallet.get('diamond'), diamond + 30);
  });

  test('Gear Master (5 successful enhancements; failures ignored)', () => {
    const s = rig(1);
    for (let i = 0; i < 4; i++) s.enhance();
    s.t.equipment.items.forEach((it) => (it.enhancement = 10));
    s.enhance(0.9999); // fails
    assert.deepEqual(s.progress('weekly_gear_master'), [4]);
    s.enhance(0);
    assert.equal(s.status('weekly_gear_master'), 'completed');
  });

  test('Adventurer: 15 Daily claims across the week, each counted once', () => {
    const s = rig(1);
    for (let d = 1; d <= 5; d++) {
      if (d > 1) s.goToDay(d);
      for (const id of s.r.dailyQuestIds()) {
        s.finish(id);
        s.t.quests.claim(id);
        s.t.quests.claim(id); // duplicate: nothing
      }
    }
    assert.equal(s.r.state.weekly.dailyClaims, 15);
    assert.equal(s.status('weekly_adventurer'), 'completed');
    const diamond = s.t.wallet.get('diamond');
    s.t.quests.claim('weekly_adventurer');
    assert.equal(s.t.wallet.get('diamond'), diamond + 40);
  });
});

describe('Weekly milestones', () => {
  const claimWeeklies = (s: ReturnType<typeof rig>, n: number) => {
    const todo = Object.keys(WEEKLY_QUESTS).filter((q) => q !== 'weekly_adventurer' && s.status(q) !== 'claimed');
    for (const id of todo.slice(0, n)) {
      s.finish(id);
      assert.equal(s.t.quests.claim(id).ok, true, id);
    }
  };

  test('3 / 5 / 7: locked until reached, claimable once, exact rewards', () => {
    const s = rig(1);
    claimWeeklies(s, 2);
    assert.deepEqual(s.r.claimMilestone(3), { ok: false, reason: 'not_reached' });
    claimWeeklies(s, 1);
    assert.equal(s.r.weeklyClaimed(), 3);
    assert.deepEqual(s.r.claimMilestone(3), { ok: true, milestone: 3 });
    assert.equal(s.t.inventory.count('material_box'), 1);
    assert.deepEqual(s.r.claimMilestone(3), { ok: false, reason: 'already_claimed' });
    assert.equal(s.t.inventory.count('material_box'), 1);
    assert.deepEqual(s.r.claimMilestone(5), { ok: false, reason: 'not_reached' });

    for (const id of ['weekly_elite_hunter', 'weekly_boss_hunter']) {
      s.finish(id);
      s.t.quests.claim(id);
    }
    const d5 = s.t.wallet.get('diamond');
    assert.deepEqual(s.r.claimMilestone(5), { ok: true, milestone: 5 });
    assert.equal(s.t.wallet.get('diamond'), d5 + 50);

    s.finish('weekly_gear_master');
    s.t.quests.claim('weekly_gear_master');
    for (let d = 1; d <= 5; d++) {
      if (d > 1) s.goToDay(d);
      for (const id of s.r.dailyQuestIds()) {
        s.finish(id);
        s.t.quests.claim(id);
      }
    }
    s.t.quests.claim('weekly_adventurer');
    assert.equal(s.r.weeklyClaimed(), 7);
    const d7 = s.t.wallet.get('diamond');
    assert.deepEqual(s.r.claimMilestone(7), { ok: true, milestone: 7 });
    assert.equal(s.t.wallet.get('diamond'), d7 + 80);
    assert.equal(s.t.inventory.count('weekly_chest'), 1);
    assert.deepEqual(s.r.claimMilestone(7), { ok: false, reason: 'already_claimed' });
    assert.equal(s.t.inventory.count('weekly_chest'), 1);
    assert.deepEqual(s.r.claimMilestone(4), { ok: false, reason: 'unknown_milestone' });
  });

  test('milestones need the Weekly feature', () => {
    const s = rig(1, { unlock: false });
    assert.deepEqual(s.r.claimMilestone(3), { ok: false, reason: 'feature_locked' });
  });

  test('a new week resets Weekly quests, milestones and the Daily-claim counter (nothing else)', () => {
    const s = rig(1);
    claimWeeklies(s, 3);
    s.r.claimMilestone(3);
    for (const id of s.r.dailyQuestIds()) {
      s.finish(id);
      s.t.quests.claim(id);
    }
    const kept = { level: s.t.combat.level, gold: s.t.wallet.get('gold'), diamond: s.t.wallet.get('diamond'), box: s.t.inventory.count('material_box') };
    s.goToDay(8);
    assert.equal(serverWeek(8), 1);
    assert.equal(s.r.state.weekly.cycleId, 1);
    assert.equal(s.r.state.weekly.dailyClaims, 0);
    assert.deepEqual(s.r.state.weekly.milestonesClaimed, []);
    assert.equal(s.r.weeklyClaimed(), 0);
    assert.ok(Object.keys(WEEKLY_QUESTS).every((id) => s.status(id) === 'active'));
    assert.ok(Object.keys(WEEKLY_QUESTS).every((id) => s.progress(id).every((p) => p === 0)));
    assert.deepEqual({ level: s.t.combat.level, gold: s.t.wallet.get('gold'), diamond: s.t.wallet.get('diamond'), box: s.t.inventory.count('material_box') }, kept);
  });
});

describe('Diamond budget (Balance v1 config)', () => {
  test('about 300 free Diamond a week', () => {
    const quests = Object.values(WEEKLY_QUESTS).reduce((n, q) => n + (q.rewards.diamond ?? 0), 0);
    const milestones = WEEKLY_MILESTONES.reduce((n, m) => n + (m.rewards.diamond ?? 0), 0);
    assert.deepEqual([quests, milestones, quests + milestones], [170, 130, 300]);
    assert.ok(Object.values(DAILY_QUESTS).every((q) => !q.rewards.diamond), 'Daily is not a Diamond source');
  });

  test('no recurring quest grants Skill or Stat Points', () => {
    const allowed = new Set(['exp', 'gold', 'diamond', 'items', 'unlockFeatures']);
    for (const q of [...Object.values(DAILY_QUESTS), ...Object.values(WEEKLY_QUESTS)]) for (const k of Object.keys(q.rewards)) assert.ok(allowed.has(k), `${q.id}:${k}`);
  });
});

describe('tracking', () => {
  test('Daily and Weekly share the normal 3-quest tracker with other quests', () => {
    const s = rig(1);
    s.t.quests.start('q_demo_01');
    const daily = s.r.dailyQuestIds()[0];
    assert.equal(s.t.quests.track(daily).ok, true);
    assert.equal(s.t.quests.track('weekly_field_hunter').ok, true);
    assert.equal(s.t.quests.track('q_demo_01').ok, true);
    assert.deepEqual(s.t.quests.track('weekly_gear_master'), { ok: false, reason: 'tracking_full' });
    s.kill('normal', 'field');
    assert.ok(s.progress('weekly_elite_hunter')[0] === 0 && s.progress('weekly_field_hunter')[0] === 1);
  });
});

describe('save / load', () => {
  test('same-day reload: no reroll, progress and counters kept', () => {
    const s = rig(dayWith('daily_field_hunter'));
    for (let i = 0; i < 7; i++) s.kill('normal', 'field');
    const other = s.r.dailyQuestIds().find((id) => id !== 'daily_field_hunter')!;
    s.finish(other);
    s.t.quests.claim(other);
    const l = reload(s);
    assert.deepEqual(l.r.dailyQuestIds(), s.r.dailyQuestIds());
    assert.deepEqual(l.progress('daily_field_hunter'), [7]);
    assert.equal(l.status(other), 'claimed');
    assert.equal(l.r.state.weekly.dailyClaims, 1);
    assert.deepEqual(l.progress('weekly_field_hunter'), [7]);
  });

  test('loading on a later day of the same week resets Daily once and keeps Weekly', () => {
    const s = rig(2);
    for (let i = 0; i < 9; i++) s.kill('normal', 'field');
    const first = s.r.dailyQuestIds()[0];
    s.finish(first);
    s.t.quests.claim(first);
    const l = reload(s, 4);
    assert.equal(l.r.state.daily.cycleId, 4);
    assert.deepEqual(l.r.dailyQuestIds(), selectDailyQuests(4, 15));
    assert.ok(l.r.dailyQuestIds().every((id) => l.status(id) === 'active' && l.progress(id).every((p) => p === 0)));
    assert.deepEqual(l.progress('weekly_field_hunter'), [9]);
    assert.equal(l.r.state.weekly.dailyClaims, 1, 'the week\'s Daily count survives the daily reset');
    const again = reload(l, 4);
    assert.deepEqual(again.progress('weekly_field_hunter'), [9]);
    assert.equal(again.r.state.daily.cycleId, 4);
  });

  test('loading in a later week resets Weekly once; milestone state persists within the week', () => {
    const s = rig(1);
    for (const id of ['weekly_dungeon_hunter', 'weekly_helping_hand', 'weekly_field_hunter']) {
      s.finish(id);
      s.t.quests.claim(id);
    }
    s.r.claimMilestone(3);
    const same = reload(s, 6);
    assert.deepEqual(same.r.state.weekly.milestonesClaimed, [3]);
    assert.deepEqual(same.r.claimMilestone(3), { ok: false, reason: 'already_claimed' });
    const later = reload(s, 9);
    assert.equal(later.r.state.weekly.cycleId, 1);
    assert.deepEqual(later.r.state.weekly.milestonesClaimed, []);
    assert.equal(later.r.weeklyClaimed(), 0);
  });

  test('an older v4 save without recurring data initializes safely and keeps everything else', () => {
    const s = rig(3);
    s.t.quests.start('q_demo_01');
    const save = capturePlayerSave(s.t);
    const { recurring: _r, ...older } = save;
    void _r;
    // Older saves also had no recurring quest records.
    older.questLog = { ...older.questLog, records: { q_demo_01: older.questLog.records.q_demo_01 } };
    const loaded = deserializePlayerSave(JSON.stringify(older));
    assert.deepEqual(loaded.recurring, { daily: { cycleId: null, questIds: [] }, weekly: { cycleId: null, dailyClaims: 0, milestonesClaimed: [] } });
    const l = rig(3, { unlock: false });
    applyPlayerSave(l.t, loaded);
    l.r.sync();
    assert.deepEqual(l.r.dailyQuestIds(), selectDailyQuests(3, 15));
    assert.equal(l.status('q_demo_01'), 'active');
    assert.ok(l.t.features.isFeatureUnlocked('daily_commission'), 'features from the save are kept');
  });

  test('impossible recurring state is rejected', () => {
    const good = capturePlayerSave(rig(3).t);
    const bad = (mutate: (r: typeof good.recurring) => void) => {
      const s = structuredClone(good);
      mutate(s.recurring);
      return () => deserializePlayerSave(JSON.stringify(s));
    };
    assert.throws(bad((r) => (r.daily.questIds = ['nope'])), /questIds/);
    assert.throws(bad((r) => (r.daily.questIds = Object.keys(DAILY_QUESTS).slice(0, 4))), /too many/);
    assert.throws(bad((r) => (r.weekly.milestonesClaimed = [4])), /milestonesClaimed/);
    assert.throws(bad((r) => (r.weekly.milestonesClaimed = [3, 3])), /duplicates/);
    assert.throws(bad((r) => (r.weekly.dailyClaims = -1)), /dailyClaims/);
  });
});

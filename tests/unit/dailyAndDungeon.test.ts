import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ManualClock } from '../../src/core/clock';
import { seededRng, type Rng } from '../../src/core/rng';
import { ClockServerDay, FixedServerDay } from '../../src/core/serverDay';
import { DailyState } from '../../src/daily/DailyState';
import { DIFFICULTIES, type DifficultyId } from '../../src/data/dungeonDifficulty';
import { ASSIST_REWARD, DUNGEON_DAILY } from '../../src/data/dungeonEntitlementData';
import { DUNGEONS } from '../../src/data/dungeonRewards';
import { FIELD_ENERGY } from '../../src/data/energyData';
import type { ItemId } from '../../src/data/itemData';
import type { MonsterTier } from '../../src/data/monsterBalance';
import { claimDungeonClear } from '../../src/dungeon/claim';
import type { DungeonRun } from '../../src/dungeon/rewards';
import { FieldEnergy, type RewardZone } from '../../src/energy/fieldEnergy';
import { sequentialIds } from '../../src/equipment/factory';
import { grantKillRewards } from '../../src/game/killRewards';
import { useItem } from '../../src/items/useItem';
import { LootSystem } from '../../src/loot/LootSystem';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { DEMO_QUESTS } from '../../src/ui/data/quests';
import { QuestProgressSource } from '../../src/ui/hud/QuestTracker';
import { makeSaveTarget } from './fixtures';

const TICKET = 'additional_dungeon_ticket';

/** A Lv15 character with every daily system wired like the game, on a settable server day. */
function rig(day = 1, serverDay = new FixedServerDay(day)) {
  const t = makeSaveTarget(15, undefined, serverDay);
  const { events, progression, player } = t;
  const loot = new LootSystem(events, t.inventory);
  const log = { exp: [] as number[], drops: [] as ItemId[] };
  events.on('expGained', (e) => log.exp.push(e.amount));
  events.on('lootDropped', (e) => log.drops.push(e.itemId));
  const newItemId = sequentialIds('eq');

  /** The game's real kill path (CombatWorld.onDeath → grantKillRewards). rng 0 = every drop succeeds. */
  const kill = (tier: MonsterTier, zone: RewardZone = 'field', rng = 0) => {
    loot.rng = () => rng;
    return grantKillRewards(
      { id: 'slime-1', x: 0, y: 0, def: { id: 'slime', tier, expReward: 30, lootTable: 'slime' } },
      { zone, fieldEnergy: t.fieldEnergy, progression, loot, player, now: 0, events },
    );
  };
  const claim = (run: DungeonRun, rng: Rng = seededRng(run.seq)) =>
    claimDungeonClear(run, {
      ledger: t.ledger,
      entitlements: t.entitlements,
      inventory: t.inventory,
      wallet: t.wallet,
      equipment: t.equipment,
      grantExp: (amount) => progression.grantExp(player, amount),
      rng,
      newItemId,
      events,
    });
  const enter = (difficulty: DifficultyId = 'normal') => t.ledger.startRun('demo_dungeon', difficulty, t.combat.level);
  const clear = (difficulty: DifficultyId = 'normal', rng?: Rng) => claim(enter(difficulty), rng);
  const useTicket = () => useItem(t.inventory, t, TICKET, { dungeon: t.entitlements });
  /** Everything a reward could change. */
  const snapshot = () => ({
    inv: t.inventory.entries(),
    gold: t.wallet.get('gold'),
    gear: t.equipment.items.size,
    level: t.combat.level,
    exp: t.combat.exp,
    status: t.entitlements.status(),
    energy: t.fieldEnergy.current(),
  });
  return { t, events, progression, loot, log, kill, enter, claim, clear, useTicket, snapshot, serverDay };
}

describe('dungeon Full Reward quota (5 free + up to 2 tickets)', () => {
  test('the first 5 claims are Full Rewards; the 6th is not', () => {
    const r = rig();
    for (let i = 1; i <= 5; i++) {
      const res = r.clear();
      assert.equal(res.ok && res.kind, 'full', `claim #${i}`);
      assert.equal(r.t.entitlements.status().fullClaimsUsed, i);
    }
    const sixth = r.clear();
    assert.equal(sixth.ok && sixth.kind, 'assist', 'no Full Reward left: falls through to Assist');
    assert.equal(r.t.entitlements.status().fullClaimsUsed, 5);
  });

  test('tickets permit claims #6 and #7; a third ticket fails and is not consumed', () => {
    const r = rig();
    for (let i = 0; i < 5; i++) r.clear();
    r.t.inventory.add(TICKET, 3);

    assert.deepEqual(r.useTicket(), { ok: true, effect: 'addDungeonFullReward', dungeonFullRewardsLeft: 1 });
    const sixth = r.clear();
    assert.equal(sixth.ok && sixth.kind, 'full');

    assert.equal(r.useTicket().ok, true);
    const seventh = r.clear();
    assert.equal(seventh.ok && seventh.kind, 'full');

    assert.deepEqual(r.useTicket(), { ok: false, reason: 'daily_extra_limit' });
    assert.equal(r.t.inventory.count(TICKET), 1, 'failed use keeps the ticket');
    const status = r.t.entitlements.status();
    assert.equal(status.fullClaimsUsed, 7);
    assert.equal(status.fullRewardsLeft, 0);
    assert.equal(DUNGEON_DAILY.freeFullRewards + DUNGEON_DAILY.maxExtraFullRewards, 7);
  });

  test('tickets can be used ahead of time but never beyond +2 a day, however many are owned', () => {
    const r = rig();
    r.t.inventory.add(TICKET, 10);
    assert.equal(r.useTicket().ok, true);
    assert.equal(r.useTicket().ok, true);
    for (let i = 0; i < 5; i++) assert.equal(r.useTicket().ok, false);
    assert.equal(r.t.inventory.count(TICKET), 8);
    assert.equal(r.t.entitlements.status().fullRewardsLeft, 7);
  });

  test('a ticket without the dungeon system (wrong context) is not consumed', () => {
    const r = rig();
    r.t.inventory.add(TICKET);
    assert.deepEqual(useItem(r.t.inventory, r.t, TICKET), { ok: false, reason: 'not_usable' });
    assert.equal(r.t.inventory.count(TICKET), 1);
  });

  test('Normal, Hard and Hell share the same quota', () => {
    const r = rig();
    for (const d of ['normal', 'normal', 'hard', 'hard', 'hell'] as const) {
      const res = r.clear(d);
      assert.equal(res.ok && res.kind, 'full', d);
    }
    for (const d of ['normal', 'hard', 'hell'] as const) {
      const res = r.claim(r.enter(d));
      assert.notEqual(res.ok && res.kind, 'full', d);
    }
  });

  test('dying, failing or leaving before the claim uses nothing', () => {
    const r = rig();
    const before = r.snapshot();
    for (let i = 0; i < 10; i++) r.enter(i % 2 ? 'hell' : 'normal'); // runs started, never claimed
    assert.deepEqual(r.snapshot(), before);
    assert.equal(r.t.entitlements.status().fullRewardsLeft, 5);
  });

  test('a successful claim uses exactly one entitlement', () => {
    const r = rig();
    r.clear('hard');
    assert.equal(r.t.entitlements.status().fullClaimsUsed, 1);
    assert.equal(r.t.entitlements.status().fullRewardsLeft, 4);
  });

  test('a duplicate claim of the same run grants nothing and uses nothing', () => {
    const r = rig();
    const run = r.enter('hell');
    const first = r.claim(run);
    assert.equal(first.ok && first.kind, 'full');
    const after = r.snapshot();
    for (let i = 0; i < 3; i++) assert.deepEqual(r.claim(run, seededRng(99 + i)), { ok: false, reason: 'already_claimed' });
    assert.deepEqual(r.snapshot(), after, 'no EXP, equipment, fragments, materials, Gold or entitlement twice');
  });

  test('a claim for a run that was never issued is refused', () => {
    const r = rig();
    const forged: DungeonRun = { ...r.enter(), seq: 42 };
    assert.deepEqual(r.claim(forged), { ok: false, reason: 'unknown_run' });
  });

  test('a Full Reward claim grants the configured dungeon EXP (once)', () => {
    for (const d of ['normal', 'hard', 'hell'] as const) {
      const r = rig();
      const res = r.clear(d);
      const expected = Math.round(DUNGEONS.demo_dungeon.bossExp * DIFFICULTIES[d].rewards.exp);
      assert.equal(res.ok && res.kind === 'full' && res.reward.exp, expected, d);
      assert.deepEqual(r.log.exp, [expected]);
    }
  });

  test('a Full Reward includes equipment, Boss Fragments, materials and Gold', () => {
    const r = rig();
    const res = r.clear('hard');
    assert.ok(res.ok && res.kind === 'full');
    assert.equal(r.t.inventory.count('boss_fragment'), 2);
    assert.ok(r.t.inventory.count('enhancement_stone') >= 4);
    assert.ok(r.t.equipment.items.size >= 1);
    assert.equal(r.t.wallet.get('gold'), res.reward.gold);
  });

  test('Field Energy is unchanged through a whole day of dungeon activity', () => {
    const r = rig();
    r.t.inventory.add(TICKET, 2);
    for (let i = 0; i < 12; i++) {
      r.kill('elite', 'dungeon');
      if (i === 5) r.useTicket();
      r.clear(i % 3 === 0 ? 'hell' : 'normal');
    }
    assert.equal(r.t.fieldEnergy.current(), FIELD_ENERGY.daily);
  });
});

describe('Assist rewards', () => {
  const noFullRewardsLeft = () => {
    const r = rig();
    for (let i = 0; i < 5; i++) r.clear();
    return r;
  };

  test('data: an Assist reward can never contain EXP, main equipment or Boss Fragments', () => {
    assert.equal('exp' in ASSIST_REWARD, false);
    assert.equal('equipment' in ASSIST_REWARD, false);
    assert.equal(ASSIST_REWARD.items.some((i) => i.itemId === 'boss_fragment'), false);
  });

  test('3 rewarded Assists a day, then helping is still allowed but unrewarded', () => {
    const r = noFullRewardsLeft();
    for (let i = 1; i <= 3; i++) {
      const res = r.clear();
      assert.equal(res.ok && res.kind, 'assist', `assist #${i}`);
      assert.equal(r.t.entitlements.status().assistRewardsClaimed, i);
    }
    const before = r.snapshot();
    const fourth = r.clear();
    assert.deepEqual(fourth, { ok: true, kind: 'none' });
    assert.deepEqual(r.snapshot(), before, 'assist #4 grants nothing');
    assert.deepEqual(r.clear(), { ok: true, kind: 'none' }, 'still allowed');
  });

  test('an Assist grants no EXP, no equipment and no Boss Fragment; minor materials and Gold do arrive', () => {
    const r = noFullRewardsLeft();
    const before = r.snapshot();
    const fragments = r.t.inventory.count('boss_fragment');
    const res = r.clear('hell', () => 0); // every configured chance succeeds
    assert.ok(res.ok && res.kind === 'assist');
    assert.deepEqual(res.reward, { items: { enhancement_stone: 1, enchant_stone: 1, rare_craft_material: 1 }, gold: ASSIST_REWARD.gold });
    const after = r.snapshot();
    assert.equal(after.level, before.level);
    assert.equal(after.exp, before.exp);
    assert.equal(after.gear, before.gear);
    assert.equal(r.t.inventory.count('boss_fragment'), fragments);
    assert.equal(after.gold, before.gold + ASSIST_REWARD.gold);
  });

  test('Assist state survives save/load and resets on a new server day', () => {
    const r = noFullRewardsLeft();
    r.clear();
    r.clear();
    const text = serializePlayerSave(capturePlayerSave(r.t));

    const loaded = rig(1);
    applyPlayerSave(loaded.t, deserializePlayerSave(text));
    assert.equal(loaded.t.entitlements.status().assistRewardsClaimed, 2);
    assert.equal(loaded.clear().ok && loaded.t.entitlements.status().assistRewardsClaimed, 3);

    loaded.serverDay.value = 2;
    assert.equal(loaded.t.entitlements.status().assistRewardsClaimed, 0);
  });
});

describe('daily reset (one shared server-day record)', () => {
  /** A character that has used some of everything today. */
  const usedDay = (r = rig()) => {
    r.kill('mini_boss');
    r.t.inventory.add(TICKET);
    r.useTicket();
    for (let i = 0; i < 7; i++) r.clear();
    return r;
  };

  test('a new server day resets Energy, Full Rewards, ticket usage and Assists; unused allowance is lost', () => {
    const r = usedDay();
    assert.deepEqual(r.t.entitlements.status(), {
      freeFullRewards: 5, extraAdded: 1, extraAddsLeft: 1, fullClaimsUsed: 6, fullRewardsLeft: 0, assistRewardsClaimed: 1, assistRewardsLeft: 2,
    });
    assert.equal(r.t.fieldEnergy.current(), 190);
    r.serverDay.value = 2;
    assert.deepEqual(r.t.entitlements.status(), {
      freeFullRewards: 5, extraAdded: 0, extraAddsLeft: 2, fullClaimsUsed: 0, fullRewardsLeft: 5, assistRewardsClaimed: 0, assistRewardsLeft: 3,
    });
    assert.equal(r.t.fieldEnergy.current(), 200);
  });

  test('the reset happens once: spending after it is kept for the rest of the day', () => {
    const r = usedDay();
    r.serverDay.value = 2;
    r.kill('elite');
    r.clear();
    for (let i = 0; i < 3; i++) {
      assert.equal(r.t.fieldEnergy.current(), 195);
      assert.equal(r.t.entitlements.status().fullClaimsUsed, 1);
    }
  });

  test('loading on the same day never resets; loading again does not either', () => {
    const r = usedDay();
    const text = serializePlayerSave(capturePlayerSave(r.t));
    const loaded = rig(1);
    for (let i = 0; i < 2; i++) {
      applyPlayerSave(loaded.t, deserializePlayerSave(text));
      assert.equal(loaded.t.fieldEnergy.current(), 190);
      assert.equal(loaded.t.entitlements.status().fullClaimsUsed, 6);
      assert.equal(loaded.t.entitlements.status().extraAdded, 1);
    }
  });

  test('loading a save from an earlier server day resets safely on first use', () => {
    const r = usedDay();
    const text = serializePlayerSave(capturePlayerSave(r.t));
    const later = rig(3);
    applyPlayerSave(later.t, deserializePlayerSave(text));
    assert.equal(later.t.fieldEnergy.current(), 200);
    assert.equal(later.t.entitlements.status().fullRewardsLeft, 5);
    assert.equal(later.t.combat.level > 15, true, 'progression is untouched by the reset');
  });

  test('the injectable clock-based provider resets exactly at the day boundary', () => {
    const calendar = { launchAt: Date.UTC(2026, 9, 3, 17), resetHour: 0, utcOffsetMinutes: 420 };
    const clock = new ManualClock(calendar.launchAt + 3_600_000);
    const daily = new DailyState(new ClockServerDay(clock, calendar));
    const energy = new FieldEnergy(daily);
    energy.payForKill('field', 'mini_boss');
    clock.set(calendar.launchAt + 86_400_000 - 1);
    assert.equal(energy.current(), 190, 'same day');
    clock.advance(1);
    assert.equal(energy.current(), 200, 'next day');
    energy.payForKill('field', 'normal');
    assert.equal(energy.current(), 199);
  });

  test('a dev server-day override is deterministic', () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 3, 18));
    const day = new ClockServerDay(clock);
    const daily = new DailyState(day);
    const energy = new FieldEnergy(daily);
    day.override = 5;
    energy.set(10);
    assert.equal(energy.current(), 10);
    day.override = 6;
    assert.equal(energy.current(), 200);
    assert.equal(daily.record.day, 6);
  });
});

describe('Field Energy (confirmed rules)', () => {
  test('200 a day; normal 1, elite 5, mini boss 10', () => {
    const r = rig();
    assert.equal(FIELD_ENERGY.daily, 200);
    assert.deepEqual(r.kill('normal'), { exp: true, farmingDrops: true, questDrops: true, energySpent: 1 });
    assert.deepEqual(r.kill('elite'), { exp: true, farmingDrops: true, questDrops: true, energySpent: 5 });
    assert.deepEqual(r.kill('mini_boss'), { exp: true, farmingDrops: true, questDrops: true, energySpent: 10 });
    assert.equal(r.t.fieldEnergy.current(), 184);
  });

  test('at 0 Energy: no Field EXP and no farming drops, but the quest item still drops; nothing is spent', () => {
    const r = rig();
    r.t.fieldEnergy.set(0);
    const decision = r.kill('normal');
    assert.deepEqual(decision, { exp: false, farmingDrops: false, questDrops: true, energySpent: 0 });
    assert.deepEqual(r.log.exp, []);
    assert.deepEqual(r.log.drops, ['slime_sample'], 'quest drop only; no slime_gel');
    assert.equal(r.t.fieldEnergy.current(), 0);
  });

  test('with Energy, both the farming drop and the quest drop roll', () => {
    const r = rig();
    r.kill('normal');
    assert.deepEqual(r.log.drops, ['slime_gel', 'slime_sample']);
    assert.deepEqual(r.log.exp, [30]);
  });

  test('rare farming drops are also disabled at 0 Energy; quest drops are not', () => {
    const r = rig();
    r.loot.rng = () => 0;
    const entries = [
      { itemId: 'enchant_stone', chance: 0.01, category: 'rare' },
      { itemId: 'slime_gel', chance: 0.5 },
      { itemId: 'slime_sample', chance: 0.4, category: 'quest' },
    ] as const;
    const withEnergy = r.loot.rollEntries(entries, 0, 0, 0).map((d) => d.itemId);
    const without = r.loot.rollEntries(entries, 0, 0, 0, { farmingDrops: false }).map((d) => d.itemId);
    assert.deepEqual(withEnergy, ['enchant_stone', 'slime_gel', 'slime_sample']);
    assert.deepEqual(without, ['slime_sample']);
  });

  test('quest kill progress and quest collection still count at 0 Energy', () => {
    const r = rig();
    r.t.fieldEnergy.set(0);
    const monsters = [{ id: 'slime-1', def: { id: 'slime' } }];
    const world = { events: r.events, player: { id: 'p' }, monsters, inventory: r.t.inventory };
    const quests = new QuestProgressSource(world as never, DEMO_QUESTS);
    for (let i = 0; i < 3; i++) {
      r.events.emit('death', { entityId: 'slime-1', killerId: 'p' }); // what CombatSystem reports
      r.kill('normal');
    }
    // Quest drops go to the ground like any drop; pick them all up.
    r.loot.update(0, { id: 'p', x: 0, y: 0, hitRadius: 10, combat: r.t.combat });
    const progress = Object.fromEntries(quests.progress().map((p) => [p.def.id, p.current]));
    assert.deepEqual(progress, { 'slime-trouble': 3, 'sticky-supplies': 3 });
    assert.equal(r.t.inventory.count('slime_gel'), 0);
    quests.destroy();
  });

  test('3 Energy left + Mini Boss (cost 10): the full reward, Energy to 0; the next kill gets no normal reward', () => {
    const r = rig();
    r.t.fieldEnergy.set(3);
    assert.deepEqual(r.kill('mini_boss'), { exp: true, farmingDrops: true, questDrops: true, energySpent: 3 });
    assert.deepEqual(r.log.exp, [30], 'full EXP, not scaled');
    assert.ok(r.log.drops.includes('slime_gel'), 'full drops');
    assert.equal(r.t.fieldEnergy.current(), 0);

    r.log.exp.length = 0;
    r.log.drops.length = 0;
    assert.deepEqual(r.kill('normal'), { exp: false, farmingDrops: false, questDrops: true, energySpent: 0 });
    assert.deepEqual(r.log.exp, []);
    assert.deepEqual(r.log.drops, ['slime_sample']);
  });

  test('set() clamps to 0..200', () => {
    const r = rig();
    r.t.fieldEnergy.set(500);
    assert.equal(r.t.fieldEnergy.current(), 200);
    r.t.fieldEnergy.set(-4);
    assert.equal(r.t.fieldEnergy.current(), 0);
  });
});

describe('save and claim safety', () => {
  test('Full Reward, ticket and Assist counters survive save/load', () => {
    const r = rig();
    r.t.inventory.add(TICKET, 2);
    r.useTicket();
    for (let i = 0; i < 4; i++) r.clear();
    const before = r.t.entitlements.status();
    const loaded = rig(1);
    applyPlayerSave(loaded.t, deserializePlayerSave(serializePlayerSave(capturePlayerSave(r.t))));
    assert.deepEqual(loaded.t.entitlements.status(), before);
    assert.equal(loaded.t.inventory.count(TICKET), 1);
  });

  test('a claimed run cannot be rewarded again after save/load', () => {
    const r = rig();
    const run = r.enter('hard');
    r.claim(run);
    const text = serializePlayerSave(capturePlayerSave(r.t));

    const loaded = rig(1);
    applyPlayerSave(loaded.t, deserializePlayerSave(text));
    const before = loaded.snapshot();
    assert.deepEqual(loaded.claim(run), { ok: false, reason: 'already_claimed' });
    assert.deepEqual(loaded.snapshot(), before);
  });

  test('reloading the save made just before the claim rolls the claim back with it (no duplication)', () => {
    const r = rig();
    const run = r.enter('hard');
    const beforeClaim = serializePlayerSave(capturePlayerSave(r.t));
    r.claim(run, seededRng(7));
    const once = r.snapshot();

    const reloaded = rig(1);
    applyPlayerSave(reloaded.t, deserializePlayerSave(beforeClaim));
    reloaded.claim(run, seededRng(7));
    // The same single reward exists, never two.
    assert.deepEqual(reloaded.snapshot(), once);
    assert.deepEqual(reloaded.claim(run), { ok: false, reason: 'already_claimed' });
  });

  test('a run issued after the loaded save is unknown to it', () => {
    const r = rig();
    const text = serializePlayerSave(capturePlayerSave(r.t));
    const run = r.enter();
    const loaded = rig(1);
    applyPlayerSave(loaded.t, deserializePlayerSave(text));
    assert.deepEqual(loaded.claim(run), { ok: false, reason: 'unknown_run' });
  });

  test('claim history stays bounded', () => {
    const r = rig(21);
    for (let i = 0; i < 300; i++) r.clear();
    const save = capturePlayerSave(r.t);
    assert.ok(save.dungeonRuns.claimed.length <= 64, `${save.dungeonRuns.claimed.length}`);
    assert.deepEqual(deserializePlayerSave(serializePlayerSave(save)).dungeonRuns, save.dungeonRuns);
  });
});

describe('dungeon mobs are combat only (all rewards come from the boss-clear claim)', () => {
  /** Kill one dungeon enemy with every drop roll forced to succeed; report everything it changed. */
  const dungeonKill = (r: ReturnType<typeof rig>, tier: MonsterTier) => {
    const before = { level: r.t.combat.level, exp: r.t.combat.exp, gold: r.t.wallet.get('gold'), inv: r.t.inventory.entries(), energy: r.t.fieldEnergy.current() };
    const decision = r.kill(tier, 'dungeon', 0);
    const after = { level: r.t.combat.level, exp: r.t.combat.exp, gold: r.t.wallet.get('gold'), inv: r.t.inventory.entries(), energy: r.t.fieldEnergy.current() };
    return { decision, before, after };
  };

  for (const tier of ['normal', 'elite', 'mini_boss'] as const) {
    test(`dungeon ${tier}: 0 EXP, 0 Gold, 0 drops (quest items included), no Energy`, () => {
      const r = rig();
      const { decision, before, after } = dungeonKill(r, tier);
      assert.deepEqual(decision, { exp: false, farmingDrops: false, questDrops: false, energySpent: 0 });
      assert.deepEqual(after, before);
      assert.deepEqual(r.log.exp, [], 'no EXP event');
      assert.deepEqual(r.log.drops, [], 'nothing dropped, not even slime_sample');
      assert.equal(r.loot.drops.length, 0);
    });
  }

  test('the same at 0 and at full Field Energy, and Energy is never consumed', () => {
    for (const energy of [0, 3, FIELD_ENERGY.daily]) {
      const r = rig();
      r.t.fieldEnergy.set(energy);
      for (const tier of ['normal', 'elite', 'mini_boss'] as const) {
        const { decision } = dungeonKill(r, tier);
        assert.deepEqual(decision, { exp: false, farmingDrops: false, questDrops: false, energySpent: 0 }, `${tier} @${energy}`);
      }
      assert.deepEqual(r.log.drops, []);
      assert.deepEqual(r.log.exp, []);
      assert.equal(r.t.fieldEnergy.current(), energy);
    }
  });

  test('the loot gate can switch off quest entries too (the hook a future quest exception would use)', () => {
    const r = rig();
    r.loot.rng = () => 0;
    const entries = [
      { itemId: 'slime_gel', chance: 0.5 },
      { itemId: 'enchant_stone', chance: 0.01, category: 'rare' },
      { itemId: 'slime_sample', chance: 0.4, category: 'quest' },
    ] as const;
    assert.deepEqual(r.loot.rollEntries(entries, 0, 0, 0, { farmingDrops: false, questDrops: false }), []);
    assert.deepEqual(r.loot.rollEntries(entries, 0, 0, 0, { farmingDrops: false, questDrops: true }).map((d) => d.itemId), ['slime_sample']);
  });

  test('field monsters are unaffected: drops with Energy, quest items at 0 Energy', () => {
    const r = rig();
    r.kill('normal');
    assert.deepEqual(r.log.drops, ['slime_gel', 'slime_sample']);
    assert.deepEqual(r.log.exp, [30]);
    r.log.drops.length = 0;
    r.t.fieldEnergy.set(0);
    r.kill('normal');
    assert.deepEqual(r.log.drops, ['slime_sample']);
  });

  test('after a run of dungeon kills, the boss-clear claim grants the configured reward normally', () => {
    const r = rig();
    const run = r.enter('hard');
    for (const tier of ['normal', 'normal', 'elite', 'mini_boss'] as const) r.kill(tier, 'dungeon', 0);
    assert.deepEqual(r.log.exp, []);
    assert.deepEqual(r.log.drops, []);

    const res = r.claim(run, seededRng(3));
    assert.ok(res.ok && res.kind === 'full');
    assert.equal(res.reward.exp, Math.round(DUNGEONS.demo_dungeon.bossExp * DIFFICULTIES.hard.rewards.exp));
    assert.deepEqual(r.log.exp, [res.reward.exp]);
    assert.equal(r.t.wallet.get('gold'), res.reward.gold);
    assert.equal(r.t.inventory.count('boss_fragment'), 2);
    assert.ok(r.t.equipment.items.size >= 1);
    assert.equal(r.t.fieldEnergy.current(), FIELD_ENERGY.daily);
    assert.deepEqual(r.claim(run), { ok: false, reason: 'already_claimed' });
  });
});

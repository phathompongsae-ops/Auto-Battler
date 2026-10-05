import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEMO_MULTIPLIER_MAX, DemoTestMode } from '../../src/data/demoTestMode';
import { FixedServerDay } from '../../src/core/serverDay';
import { expToNext } from '../../src/progression/expCurve';
import { grantKillRewards } from '../../src/game/killRewards';
import { LootSystem } from '../../src/loot/LootSystem';
import { makeSaveTarget } from './fixtures';

describe('internal demo reward tuning', () => {
  test('EXP follows level modifier then demo multiplier, and zero stays zero', () => {
    const tuning = new DemoTestMode();
    assert.equal(tuning.exp(10), 100);
    assert.equal(tuning.exp(10, 0.5), 50);
    assert.equal(tuning.exp(0), 0);
    tuning.setExpMultiplier(2);
    assert.equal(tuning.exp(10), 20);
    tuning.reset();
    assert.equal(tuning.exp(10), 100);
  });

  test('drop multiplier changes chance, not quantity; zero and absent entries remain impossible', () => {
    const t = makeSaveTarget();
    const tuning = new DemoTestMode();
    const loot = new LootSystem(t.events, t.inventory, tuning);
    assert.equal(tuning.dropChance(0.05), 0.5);
    assert.equal(tuning.dropChance(0.15), 1);
    assert.equal(tuning.dropChance(0), 0);
    loot.rng = () => 0.49;
    assert.deepEqual(loot.rollEntries([{ itemId: 'slime_gel', chance: 0.05 }], 0, 0, 0).map((d) => d.itemId), ['slime_gel']);
    assert.deepEqual(loot.rollEntries([{ itemId: 'slime_gel', chance: 0 }], 0, 0, 0), []);
    assert.deepEqual(loot.rollEntries([], 0, 0, 0), []);
    assert.deepEqual(loot.rollEntries([{ itemId: 'slime_gel', chance: 0.15 }], 0, 0, 0, { farmingDrops: false }), []);
  });

  test('field kill earns tuned EXP and spends Energy; dungeon kill gives nothing', () => {
    const t = makeSaveTarget();
    const tuning = new DemoTestMode();
    const loot = new LootSystem(t.events, t.inventory, tuning);
    loot.rng = () => 0;
    const monster = { id: 'm-1', x: 0, y: 0, def: { id: 'slime', tier: 'normal' as const, expReward: 10, lootTable: 'slime' as const } };
    const context = { fieldEnergy: t.fieldEnergy, progression: t.progression, loot, player: t.player, now: 0, events: t.events, tuning };
    const beforeEnergy = t.fieldEnergy.current();
    grantKillRewards(monster, { ...context, zone: 'field' });
    assert.equal(t.combat.exp, 100);
    assert.equal(t.fieldEnergy.current(), beforeEnergy - 1);
    loot.clear();
    grantKillRewards(monster, { ...context, zone: 'dungeon' });
    assert.equal(t.combat.exp, 100);
    assert.equal(t.fieldEnergy.current(), beforeEnergy - 1);
    assert.deepEqual(loot.drops, []);
  });

  test('dev overrides clamp sensibly and reset restores x10', () => {
    const tuning = new DemoTestMode();
    assert.equal(tuning.setExpMultiplier(-5), 0);
    assert.equal(tuning.exp(35), 0);
    assert.equal(tuning.setDropRateMultiplier(1e9), DEMO_MULTIPLIER_MAX);
    assert.throws(() => tuning.setExpMultiplier(Number.NaN), RangeError);
    tuning.reset();
    assert.equal(tuning.expMultiplier, 10);
    assert.equal(tuning.dropRateMultiplier, 10);
    tuning.setExpMultiplier(1);
    tuning.setDropRateMultiplier(1);
    assert.equal(tuning.exp(35), 35, 'x1 is production balance');
    assert.equal(tuning.dropChance(0.05), 0.05);
  });

  test('worked examples: 35 -> 350, 35 at 50% -> 175; 8% -> 80%, 10% -> 100%; disabled is x1', () => {
    const tuning = new DemoTestMode();
    assert.equal(tuning.exp(35), 350);
    assert.equal(tuning.exp(35, 0.5), 175);
    assert.ok(Math.abs(tuning.dropChance(0.08) - 0.8) < 1e-9);
    assert.equal(tuning.dropChance(0.1), 1);
    tuning.enabled = false;
    assert.equal(tuning.exp(35), 35);
    assert.equal(tuning.dropChance(0.05), 0.05);
  });

  test('each successful roll still spawns exactly one item (quantity unchanged)', () => {
    const t = makeSaveTarget();
    const loot = new LootSystem(t.events, t.inventory, new DemoTestMode());
    loot.rng = () => 0;
    const drops = loot.roll('slime', 0, 0, 0);
    const counts: Record<string, number> = {};
    for (const d of drops) counts[d.itemId] = (counts[d.itemId] ?? 0) + 1;
    assert.ok(drops.length > 0);
    assert.ok(Object.values(counts).every((n) => n === 1), JSON.stringify(counts));
  });

  const killContext = (t: ReturnType<typeof makeSaveTarget>, tuning: DemoTestMode, loot: LootSystem) =>
    ({ fieldEnergy: t.fieldEnergy, progression: t.progression, loot, player: t.player, now: 0, events: t.events, tuning });

  test('elite and mini boss EXP are tuned and still pay 5 / 10 Field Energy', () => {
    const t = makeSaveTarget();
    const tuning = new DemoTestMode();
    const loot = new LootSystem(t.events, t.inventory, tuning);
    loot.rng = () => 1;
    const start = t.fieldEnergy.current();
    grantKillRewards({ id: 'e', x: 0, y: 0, def: { id: 'slime', tier: 'elite', expReward: 7, lootTable: 'slime' } }, { ...killContext(t, tuning, loot), zone: 'field' });
    assert.equal(t.combat.exp, 70);
    assert.equal(t.fieldEnergy.current(), start - 5);
    grantKillRewards({ id: 'b', x: 0, y: 0, def: { id: 'slime', tier: 'mini_boss', expReward: 3, lootTable: 'slime' } }, { ...killContext(t, tuning, loot), zone: 'field' });
    assert.equal(t.combat.exp, 100);
    assert.equal(t.fieldEnergy.current(), start - 15);
  });

  test('0 Field Energy blocks tuned EXP and farming drops; quest kill still counts', () => {
    const t = makeSaveTarget();
    const tuning = new DemoTestMode();
    const loot = new LootSystem(t.events, t.inventory, tuning);
    loot.rng = () => 0;
    t.fieldEnergy.set(0);
    let kills = 0;
    t.events.on('monsterKilled', () => kills++);
    grantKillRewards({ id: 'm', x: 0, y: 0, def: { id: 'slime', tier: 'normal', expReward: 10, lootTable: 'slime' } }, { ...killContext(t, tuning, loot), zone: 'field' });
    assert.equal(t.combat.exp, 0);
    assert.equal(kills, 1);
    assert.equal(loot.drops.some((d) => d.itemId === 'slime_gel'), false, 'no farming drop');
    assert.equal(t.fieldEnergy.current(), 0);
  });

  test('tuned EXP still stops at the Server Cap and keeps one level of Overflow', () => {
    const t = makeSaveTarget(39, undefined, new FixedServerDay(1)); // day 1: cap 40
    const tuning = new DemoTestMode();
    const loot = new LootSystem(t.events, t.inventory, tuning);
    loot.rng = () => 1;
    grantKillRewards({ id: 'm', x: 0, y: 0, def: { id: 'slime', tier: 'normal', expReward: expToNext(39), lootTable: 'slime' } }, { ...killContext(t, tuning, loot), zone: 'field' });
    assert.equal(t.combat.level, 40);
    assert.equal(t.combat.exp, expToNext(40));
  });

  test('dungeon mobs, elites and mini bosses stay at 0 EXP / 0 loot / 0 Energy even at a forced roll', () => {
    const t = makeSaveTarget();
    const tuning = new DemoTestMode();
    const loot = new LootSystem(t.events, t.inventory, tuning);
    loot.rng = () => 0;
    const start = t.fieldEnergy.current();
    for (const tier of ['normal', 'elite', 'mini_boss'] as const) {
      grantKillRewards({ id: tier, x: 0, y: 0, def: { id: 'slime', tier, expReward: 50, lootTable: 'slime' } }, { ...killContext(t, tuning, loot), zone: 'dungeon' });
    }
    assert.equal(t.combat.exp, 0);
    assert.deepEqual(loot.drops, []);
    assert.equal(t.fieldEnergy.current(), start);
  });
});

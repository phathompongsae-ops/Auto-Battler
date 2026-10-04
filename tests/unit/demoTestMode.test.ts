import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DemoTestMode } from '../../src/data/demoTestMode';
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
});

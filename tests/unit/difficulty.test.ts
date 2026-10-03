import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../src/data/dungeonDifficulty';
import { entryCheck, recommendedLevel, scaleMonster, scaleRareDropChance, scaleRewards } from '../../src/dungeon/difficulty';

describe('dungeon difficulty v1', () => {
  test('locked multipliers', () => {
    assert.deepEqual(DIFFICULTY_ORDER, ['normal', 'hard', 'hell']);

    const n = DIFFICULTIES.normal;
    assert.deepEqual(n.monster, { hp: 1, atk: 1, def: 1, mdef: 1 });
    assert.deepEqual({ hp: n.boss.hp, atk: n.boss.atk }, { hp: 1, atk: 1 });
    assert.deepEqual(n.rewards, { exp: 1, currency: 1, material: 1 });

    const h = DIFFICULTIES.hard;
    assert.deepEqual(h.monster, { hp: 1.45, atk: 1.2, def: 1.1, mdef: 1.1 });
    assert.deepEqual({ hp: h.boss.hp, atk: h.boss.atk }, { hp: 1.6, atk: 1.25 });
    assert.deepEqual(h.rewards, { exp: 1.3, currency: 1.5, material: 1.5 });

    const x = DIFFICULTIES.hell;
    assert.deepEqual(x.monster, { hp: 2, atk: 1.45, def: 1.25, mdef: 1.25 });
    assert.deepEqual({ hp: x.boss.hp, atk: x.boss.atk }, { hp: 2.3, atk: 1.55 });
    assert.deepEqual(x.rewards, { exp: 1.7, currency: 2, material: 2 });
  });

  test('Recommended Level = base, base +5, base +10', () => {
    assert.equal(recommendedLevel(20, 'normal'), 20);
    assert.equal(recommendedLevel(20, 'hard'), 25);
    assert.equal(recommendedLevel(20, 'hell'), 30);
  });

  test('no minimum-level gate: under-levelled players can always enter', () => {
    for (const d of DIFFICULTY_ORDER) {
      const check = entryCheck(1, 30, d);
      assert.equal(check.allowed, true, d);
      assert.equal(check.belowRecommended, true, d);
    }
    assert.equal(entryCheck(40, 30, 'hell').belowRecommended, false);
  });

  test('scaling keeps the monster level fixed and never uses the player level', () => {
    const slime = { level: 12, hp: 100, atk: 20, def: 10, mdef: 8 };
    assert.deepEqual(scaleMonster(slime, 'normal'), slime);
    assert.deepEqual(scaleMonster(slime, 'hard'), { level: 12, hp: 145, atk: 24, def: 11, mdef: 9 });
    assert.deepEqual(scaleMonster(slime, 'hell'), { level: 12, hp: 200, atk: 29, def: 13, mdef: 10 });
    assert.deepEqual(scaleMonster(slime, 'hell', true), { level: 12, hp: 230, atk: 31, def: 13, mdef: 10 });
  });

  test('reward scaling', () => {
    const r = { exp: 100, currency: 40, material: 10 };
    assert.deepEqual(scaleRewards(r, 'normal'), r);
    assert.deepEqual(scaleRewards(r, 'hard'), { exp: 130, currency: 60, material: 15 });
    assert.deepEqual(scaleRewards(r, 'hell'), { exp: 170, currency: 80, material: 20 });
  });

  test('rare-drop scaling is a hook only (unset = unchanged)', () => {
    for (const d of DIFFICULTY_ORDER) {
      assert.equal(DIFFICULTIES[d].rareDropMultiplier, null);
      assert.equal(scaleRareDropChance(0.02, d), 0.02);
    }
  });
});

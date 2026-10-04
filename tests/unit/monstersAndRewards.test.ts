import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../src/data/dungeonDifficulty';
import { BOSS_REWARDS, DUNGEONS } from '../../src/data/dungeonRewards';
import { EQUIPMENT_DEFS } from '../../src/data/equipmentItems';
import { MONSTER_BALANCE } from '../../src/data/monsterBalance';
import { DUNGEON_RUN_CLAIM_WINDOW } from '../../src/data/dungeonEntitlementData';
import { clearId, rollBossReward, RewardLedger } from '../../src/dungeon/rewards';
import { monsterBalance, MonsterBalanceRangeError, monsterStatsFromBalance } from '../../src/monsters/monsterBalance';

describe('monster balance v1', () => {
  const LOCKED = {
    normal: { 11: [600, 45, 12, 10, 35, 15], 20: [1200, 85, 30, 25, 80, 30], 30: [2200, 145, 55, 50, 150, 55], 40: [3600, 220, 85, 80, 260, 90] },
    elite: { 11: [3500, 60, 18, 15, 160, 60], 20: [7000, 110, 42, 36, 340, 120], 30: [12500, 190, 75, 65, 650, 220], 40: [21000, 290, 115, 105, 1100, 360] },
    mini_boss: { 11: [15000, 80, 25, 20, 550, 220], 20: [30000, 145, 55, 45, 1100, 450], 30: [55000, 240, 95, 85, 2100, 800], 40: [95000, 360, 145, 135, 3600, 1300] },
    dungeon_boss: { 11: [180000, 100, 35, 30], 20: [320000, 180, 70, 65], 30: [500000, 300, 120, 110], 40: [700000, 450, 175, 165] },
  } as const;

  for (const [tier, anchors] of Object.entries(LOCKED)) {
    test(`${tier}: every locked anchor`, () => {
      for (const [lv, v] of Object.entries(anchors)) {
        const got = monsterBalance(tier as keyof typeof LOCKED, Number(lv));
        const [hp, atk, def, mdef, exp, gold] = v as readonly number[];
        assert.deepEqual(got, exp === undefined ? { hp, atk, def, mdef } : { hp, atk, def, mdef, exp, gold }, `${tier} Lv${lv}`);
      }
    });
  }

  test('DEF and MDEF are separate values', () => {
    for (const anchors of Object.values(MONSTER_BALANCE)) for (const v of Object.values(anchors)) assert.notEqual(v.def, v.mdef);
  });

  test('interpolation is deterministic; no player level input; no extrapolation', () => {
    // Normal HP 600 → 1200 over Lv11–20: Lv15 = 600 + 600 × 4/9 = 866.67 → 867.
    assert.equal(monsterBalance('normal', 15).hp, 867);
    assert.deepEqual(monsterBalance('elite', 33), monsterBalance('elite', 33));
    assert.equal(monsterBalance.length, 2); // (tier, level): content level only
    assert.throws(() => monsterBalance('normal', 10), MonsterBalanceRangeError);
    assert.throws(() => monsterBalance('normal', 41), MonsterBalanceRangeError);
  });

  test('balance becomes monster combat stats', () => {
    const s = monsterStatsFromBalance('elite', 20, { moveSpeed: 80, critChance: 0.05, critMultiplier: 1.5 });
    assert.equal(s.maxHp, 7000);
    assert.equal(s.attack, 110);
    assert.equal(s.defense, 42);
    assert.equal(s.magicDefense, 36);
  });
});

describe('dungeon boss rewards', () => {
  test('locked tables', () => {
    for (const d of DIFFICULTY_ORDER) {
      const total = Object.values(BOSS_REWARDS[d].equipmentRarity).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - 100) < 1e-9, d);
    }
    assert.deepEqual(BOSS_REWARDS.normal.equipmentRarity, { common: 60, uncommon: 32, rare: 7.5, legendary: 0.5 });
    assert.deepEqual(BOSS_REWARDS.hard.equipmentRarity, { common: 35, uncommon: 45, rare: 18, legendary: 2 });
    assert.deepEqual(BOSS_REWARDS.hell.equipmentRarity, { common: 15, uncommon: 40, rare: 40, legendary: 5 });
    assert.deepEqual(DIFFICULTY_ORDER.map((d) => BOSS_REWARDS[d].bossFragments), [1, 2, 3]);
    assert.deepEqual(DIFFICULTY_ORDER.map((d) => BOSS_REWARDS[d].enhancementStones), [[2, 4], [4, 7], [7, 12]]);
    assert.deepEqual(DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d].rewards.currency), [1, 1.5, 2]);
    assert.deepEqual(DIFFICULTY_ORDER.map((d) => BOSS_REWARDS[d].chances.enchantStone), [0.25, 0.5, 0.8]);
    assert.deepEqual(DIFFICULTY_ORDER.map((d) => BOSS_REWARDS[d].chances.rareCraftMaterial), [0.15, 0.35, 0.65]);
    assert.deepEqual(DIFFICULTY_ORDER.map((d) => BOSS_REWARDS[d].chances.extraEquipment), [0.05, 0.12, 0.2]);
    for (const d of DIFFICULTY_ORDER) {
      assert.equal(BOSS_REWARDS[d].chances.blueprint, null);
      assert.equal(BOSS_REWARDS[d].chances.protectionStone, null);
      assert.equal(BOSS_REWARDS[d].chances.successBooster, null);
    }
  });

  test('guaranteed parts always present; values within locked ranges; pool matches rarity', () => {
    for (const d of DIFFICULTY_ORDER) {
      const rng = seededRng(17);
      for (let i = 0; i < 300; i++) {
        const r = rollBossReward('demo_dungeon', d, rng);
        assert.ok(r.equipment.length >= 1 && r.equipment.length <= 2);
        for (const e of r.equipment) assert.equal(EQUIPMENT_DEFS[e.defId].rarity, e.rarity);
        assert.equal(r.items.boss_fragment, BOSS_REWARDS[d].bossFragments);
        const [lo, hi] = BOSS_REWARDS[d].enhancementStones;
        assert.ok(r.items.enhancement_stone! >= lo && r.items.enhancement_stone! <= hi);
        assert.equal(r.gold, Math.round(DUNGEONS.demo_dungeon.bossGold * DIFFICULTIES[d].rewards.currency));
        assert.equal(r.items.protection_stone, undefined);
        assert.equal(r.items.success_booster, undefined);
        assert.equal(r.items.blueprint_guardian, undefined);
      }
    }
  });

  test('deterministic rolls; known chance drops follow their odds', () => {
    assert.deepEqual(rollBossReward('demo_dungeon', 'hell', seededRng(5)), rollBossReward('demo_dungeon', 'hell', seededRng(5)));
    const always = rollBossReward('demo_dungeon', 'hell', () => 0); // every chance succeeds, top rarity bands
    assert.equal(always.items.enchant_stone, 1);
    assert.equal(always.items.rare_craft_material, 1);
    assert.equal(always.equipment.length, 2);
    const never = rollBossReward('demo_dungeon', 'normal', () => 0.999);
    assert.equal(never.items.enchant_stone, undefined);
    assert.equal(never.equipment.length, 1);
    assert.equal(never.equipment[0].rarity, 'legendary');
  });

  test('runs are numbered; entry costs nothing; each run is claimable once inside a bounded window', () => {
    const ledger = new RewardLedger();
    const run = ledger.startRun('demo_dungeon', 'hard', 1);
    assert.equal(run.entry.allowed, true);
    assert.equal(run.clearId, clearId('demo_dungeon', 'hard', 'run-1'));
    assert.equal(ledger.state(run), 'claimable');
    ledger.markClaimed(run);
    assert.equal(ledger.state(run), 'already_claimed');
    assert.equal(ledger.state({ seq: 2 }), 'unknown_run', 'never issued');

    for (let i = 0; i < DUNGEON_RUN_CLAIM_WINDOW; i++) ledger.startRun('demo_dungeon', 'normal', 1);
    assert.equal(ledger.state(run), 'expired');
    assert.equal(ledger.claimed.size, 0, 'old claims are forgotten');
    assert.equal(ledger.state({ seq: ledger.nextSeq - DUNGEON_RUN_CLAIM_WINDOW }), 'claimable', 'oldest run still in the window');
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CombatantState } from '../../src/combat/CombatantState';
import { JOB_CHANGE_LEVEL, JOBS, type JobId } from '../../src/data/jobData';
import { NOVICE_BASE_STATS } from '../../src/data/statData';
import { useItem } from '../../src/items/useItem';
import { Inventory } from '../../src/loot/Inventory';
import { CharacterProgress, earnedStatPoints } from '../../src/progression/CharacterProgress';
import { allocateStat, changeJob, type StatOwner } from '../../src/progression/statActions';
import { DERIVED_STAT_KEYS, deriveStats, emptyDerived } from '../../src/stats/derivedStats';
import { finalPrimary, MODIFIER_SOURCES, primaryBySource, primaryModifier } from '../../src/stats/modifiers';
import { ModifierStack } from '../../src/stats/ModifierStack';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { PRIMARY_STATS, zeroPrimary, type PrimaryStats } from '../../src/stats/primaryStats';

const close = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${msg ?? ''} expected ${expected}, got ${actual}`);

/** A player-like stat owner without the game engine. */
function makeOwner(level = 1): StatOwner {
  const progress = new CharacterProgress();
  const combat = new CombatantState('p', 'P', 'player', (lv) => playerCombatStats(progress, lv), level);
  return { progress, combat };
}

describe('primary stats', () => {
  test('Lv1 Novice starts at 5 in all six stats', () => {
    const p = new CharacterProgress();
    assert.equal(p.classId, 'novice');
    assert.deepEqual(p.base, { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 });
    assert.deepEqual(finalPrimary(p.modifiers()), { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 });
  });

  test('base, allocated and job are separate modifier sources', () => {
    const p = new CharacterProgress({ allocated: { ...zeroPrimary(), str: 2 }, jobBonuses: { warrior: { str: 3, vit: 2 } } });
    const by = primaryBySource(p.modifiers());
    assert.equal(by.base.str, 5);
    assert.equal(by.allocated.str, 2);
    assert.equal(by.job.str, 3);
    assert.equal(finalPrimary(p.modifiers()).str, 10);
  });
});

describe('free stat points', () => {
  test('no free points at Lv1, +1 per level from Lv2', () => {
    assert.equal(earnedStatPoints(1), 0);
    assert.equal(earnedStatPoints(2), 1);
    assert.equal(earnedStatPoints(10), 9);
    assert.equal(earnedStatPoints(11), 10);
    assert.equal(earnedStatPoints(40), 39);
  });

  test('earned / spent / remaining are tracked', () => {
    const p = new CharacterProgress();
    assert.equal(p.remaining(1), 0);
    assert.deepEqual(p.allocate('str', 4, 10), { ok: true });
    assert.equal(p.earned(10), 9);
    assert.equal(p.spent(), 4);
    assert.equal(p.remaining(10), 5);
  });

  test('overspending is rejected and changes nothing', () => {
    const p = new CharacterProgress();
    assert.deepEqual(p.allocate('vit', 1, 1), { ok: false, reason: 'not_enough_points' });
    assert.deepEqual(p.allocate('vit', 10, 10), { ok: false, reason: 'not_enough_points' });
    assert.equal(p.spent(), 0);
  });

  test('invalid amounts and stats are rejected', () => {
    const p = new CharacterProgress();
    assert.deepEqual(p.allocate('str', 0, 10), { ok: false, reason: 'invalid_amount' });
    assert.deepEqual(p.allocate('str', 1.5, 10), { ok: false, reason: 'invalid_amount' });
    assert.deepEqual(p.allocate('str', -1, 10), { ok: false, reason: 'invalid_amount' });
    assert.deepEqual(p.allocate('fire' as never, 1, 10), { ok: false, reason: 'invalid_stat' });
  });

  test('no artificial per-stat cap: every point can go into one stat', () => {
    const p = new CharacterProgress();
    assert.deepEqual(p.allocate('luk', 39, 40), { ok: true });
    assert.equal(p.allocated.luk, 39);
    assert.equal(p.remaining(40), 0);
  });

  test('a job change grants no free stat points', () => {
    const p = new CharacterProgress();
    const before = p.remaining(11);
    assert.deepEqual(p.changeJob('warrior', 11), { ok: true });
    assert.equal(p.remaining(11), before);
  });
});

describe('job bonuses', () => {
  const expected: Record<string, Partial<PrimaryStats>> = {
    warrior: { str: 3, vit: 2 },
    archer: { dex: 3, agi: 2 },
    mage: { int: 3, dex: 2 },
    cleric: { int: 3, vit: 2 },
    ninja: { agi: 3, luk: 2 },
  };

  for (const [job, bonus] of Object.entries(expected)) {
    test(`${job}: Class 1 bonus is applied automatically and kept separate`, () => {
      const p = new CharacterProgress();
      p.allocate('str', 1, 11);
      assert.deepEqual(p.changeJob(job, 11), { ok: true });
      assert.equal(p.classId, job);
      assert.deepEqual(p.jobBonuses[job as JobId], bonus);
      // Allocated stats untouched, points not consumed.
      assert.deepEqual(p.allocated, { ...zeroPrimary(), str: 1 });
      assert.equal(p.spent(), 1);
      const final = finalPrimary(p.modifiers());
      for (const stat of PRIMARY_STATS) {
        assert.equal(final[stat], NOVICE_BASE_STATS[stat] + (bonus[stat] ?? 0) + (stat === 'str' ? 1 : 0), stat);
      }
    });
  }

  test('Class 1 requires Level 11 and Novice', () => {
    assert.equal(JOB_CHANGE_LEVEL[1], 11);
    const p = new CharacterProgress();
    assert.deepEqual(p.changeJob('warrior', 10), { ok: false, reason: 'level_too_low' });
    assert.deepEqual(p.changeJob('novice', 11), { ok: false, reason: 'not_allowed_from_current_job' });
    assert.deepEqual(p.changeJob('paladin', 11), { ok: false, reason: 'unknown_job' });
    p.changeJob('warrior', 11);
    assert.deepEqual(p.changeJob('archer', 11), { ok: false, reason: 'not_allowed_from_current_job' });
  });

  test('Class 2 is a hook only: tier and level exist, no jobs or bonuses defined', () => {
    assert.equal(JOB_CHANGE_LEVEL[2], 40);
    assert.equal(Object.values(JOBS).filter((j) => j.tier === 2).length, 0);
  });
});

describe('derived stats (literal formulas, origin 0)', () => {
  const derive = (stats: Partial<PrimaryStats>, attackStyle: 'melee' | 'ranged' = 'melee') =>
    deriveStats({ modifiers: [primaryModifier('base', 'base', stats)], attackStyle });

  test('STR: melee physical ATK +2 per point', () => {
    assert.equal(derive({ str: 7 }).physicalAtk, 14);
    assert.equal(derive({ str: 7 }, 'ranged').physicalAtk, 0);
  });
  test('VIT: Max HP +25 and DEF +1 per point', () => {
    const d = derive({ vit: 4 });
    assert.equal(d.maxHp, 100);
    assert.equal(d.def, 4);
    assert.equal(d.mdef, 0);
  });
  test('AGI: ASPD +0.2% and evasion +0.1% per point', () => {
    const d = derive({ agi: 10 });
    close(d.aspd, 0.02);
    close(d.evasion, 0.01);
  });
  test('DEX: accuracy +0.2%, archer ATK +2, cast time -0.1% per point', () => {
    const d = derive({ dex: 10 }, 'ranged');
    close(d.accuracy, 0.02);
    assert.equal(d.physicalAtk, 20);
    close(d.castTime, -0.01);
    assert.equal(derive({ dex: 10 }, 'melee').physicalAtk, 0);
  });
  test('INT: MATK +2, Max MP +15, heal power +0.4%, MDEF +1 per point', () => {
    const d = derive({ int: 10 });
    assert.equal(d.magicAtk, 20);
    assert.equal(d.maxMp, 150);
    close(d.healPower, 0.04);
    assert.equal(d.mdef, 10);
    assert.equal(d.def, 0);
  });
  test('LUK: crit rate +0.15%, crit damage +0.3% per point', () => {
    const d = derive({ luk: 10 });
    close(d.critRate, 0.015);
    close(d.critDamage, 0.03);
  });
  test('DEF and MDEF stay separate', () => {
    const d = derive({ vit: 3, int: 8 });
    assert.equal(d.def, 3);
    assert.equal(d.mdef, 8);
  });
  test('no elemental resistance stats exist', () => {
    const keys = [...DERIVED_STAT_KEYS, ...Object.keys(emptyDerived())];
    const elemental = keys.filter((k) => /resist|fire|water|wind|earth|holy|dark|element/i.test(k));
    assert.deepEqual(elemental, []);
    assert.deepEqual(Object.keys(emptyDerived()).sort(), [...DERIVED_STAT_KEYS].sort());
  });
});

describe('modifier pipeline', () => {
  test('every source (incl. learned passive skills) is supported and summed into final stats', () => {
    assert.deepEqual([...MODIFIER_SOURCES], ['base', 'allocated', 'job', 'skill', 'equipment', 'pet', 'buff', 'debuff']);
    const mods = [
      primaryModifier('base', 'base', { str: 5 }),
      primaryModifier('allocated', 'allocated', { str: 1 }),
      primaryModifier('job', 'job:warrior', { str: 3 }),
      primaryModifier('equipment', 'item:sword', { str: 2 }),
      primaryModifier('pet', 'pet:wolf', { str: 1 }),
      primaryModifier('buff', 'status:might', { str: 4 }),
      primaryModifier('debuff', 'status:weak', { str: -2 }),
    ];
    assert.equal(finalPrimary(mods).str, 14);
    const by = primaryBySource(mods);
    assert.equal(by.equipment.str, 2);
    assert.equal(by.debuff.str, -2);
  });

  test('flat then percent derived modifiers', () => {
    const d = deriveStats({
      attackStyle: 'melee',
      base: { physicalAtk: 10 },
      modifiers: [
        primaryModifier('base', 'base', { str: 5 }),
        { source: 'equipment', id: 'item:sword', flat: { physicalAtk: 10 } },
        { source: 'buff', id: 'status:might', percent: { physicalAtk: 0.1 } },
        { source: 'buff', id: 'status:rage', percent: { physicalAtk: 0.1 } },
      ],
    });
    // (10 base + 10 STR + 10 flat) × 1.2
    close(d.physicalAtk, 36);
  });
});

describe('player combat stats (literal stats on class base growth)', () => {
  test('a fresh Lv1 Novice: base 300/100/25/20/8/8 plus its six starting 5s', () => {
    const s = makeOwner(1).combat.stats;
    assert.equal(s.maxHp, 300 + 5 * 25);
    assert.equal(s.maxMp, 100 + 5 * 15);
    assert.equal(s.attack, 25 + 5 * 2);
    assert.equal(s.magicAttack, 20 + 5 * 2);
    assert.equal(s.defense, 8 + 5);
    assert.equal(s.magicDefense, 8 + 5);
    close(s.accuracy, 5 * 0.002);
    close(s.evasion, 5 * 0.001);
    close(s.attackSpeed, 5 * 0.002);
    close(s.critChance, 5 * 0.0015);
    close(s.critMultiplier, 1.5 + 5 * 0.003);
    close(s.castTime, 5 * -0.001);
    close(s.healPower, 5 * 0.004);
  });

  test('allocated points apply the locked per-point rates in combat', () => {
    const owner = makeOwner(11);
    const before = { ...owner.combat.stats };
    assert.deepEqual(allocateStat(owner, 'vit', 2), { ok: true });
    assert.equal(owner.combat.stats.maxHp, before.maxHp + 50);
    assert.equal(owner.combat.stats.defense, before.defense + 2);
  });

  test('a Lv11 Warrior: Warrior base + Novice 5s + Warrior job bonus', () => {
    const owner = makeOwner(11);
    assert.deepEqual(changeJob(owner, 'warrior'), { ok: true });
    const s = owner.combat.stats;
    assert.equal(s.maxHp, 700 + 7 * 25); // VIT 5 + 2
    assert.equal(s.attack, 70 + 8 * 2); // STR 5 + 3
    assert.equal(s.defense, 25 + 7);
    assert.equal(s.magicAttack, 25 + 5 * 2);
  });
});

describe('stat reset item', () => {
  test('returns exactly the allocated points and nothing else changes', () => {
    const owner = makeOwner(20);
    changeJob(owner, 'warrior');
    Object.assign(owner.progress.skillRanks, { power_slash: 5, charge: 1, shield_bash: 1 }); // 7 SP spent
    allocateStat(owner, 'str', 10);
    allocateStat(owner, 'luk', 5);
    const inventory = new Inventory();
    inventory.add('stat_reset_test', 2);
    const before = owner.progress.toData();

    const result = useItem(inventory, owner, 'stat_reset_test');
    assert.deepEqual(result, { ok: true, effect: 'resetAllocatedStats', refundedStatPoints: 15 });
    assert.equal(inventory.count('stat_reset_test'), 1);
    assert.deepEqual(owner.progress.allocated, zeroPrimary());
    assert.equal(owner.progress.remaining(20), 19);
    assert.deepEqual(owner.progress.base, before.base);
    assert.deepEqual(owner.progress.jobBonuses, before.jobBonuses);
    assert.equal(owner.progress.classId, 'warrior');
    assert.equal(owner.progress.skillPointsSpent, 7);
    assert.equal(owner.combat.level, 20);
  });

  test('cannot be used without owning one; materials are not usable', () => {
    const owner = makeOwner(5);
    const inventory = new Inventory();
    assert.deepEqual(useItem(inventory, owner, 'stat_reset_test'), { ok: false, reason: 'not_owned' });
    inventory.add('slime_gel');
    assert.deepEqual(useItem(inventory, owner, 'slime_gel'), { ok: false, reason: 'not_usable' });
    assert.deepEqual(useItem(inventory, owner, 'nope'), { ok: false, reason: 'unknown_item' });
  });
});

describe('modifier stack (future equipment / pet / buff hook)', () => {
  test('set replaces by id; replaceSource swaps only that source', () => {
    let changes = 0;
    const stack = new ModifierStack(() => changes++);
    stack.set(primaryModifier('equipment', 'item:sword', { str: 2 }));
    stack.set(primaryModifier('equipment', 'item:sword', { str: 4 }));
    stack.set(primaryModifier('pet', 'pet:wolf', { agi: 1 }));
    assert.equal(stack.list().length, 2);
    assert.equal(finalPrimary(stack.list()).str, 4);
    stack.replaceSource('equipment', [primaryModifier('equipment', 'item:axe', { str: 6 }), primaryModifier('equipment', 'item:ring', { luk: 1 })]);
    assert.deepEqual(stack.list().map((m) => m.id).sort(), ['item:axe', 'item:ring', 'pet:wolf']);
    assert.throws(() => stack.replaceSource('equipment', [primaryModifier('buff', 'x', {})]));
    stack.clear();
    assert.equal(stack.list().length, 0);
    assert.equal(changes, 5);
  });

  test('extra sources reach live combat stats without touching progress', () => {
    const progress = new CharacterProgress();
    let combat: CombatantState | null = null;
    const stack = new ModifierStack(() => combat?.refreshStats());
    combat = new CombatantState('p', 'P', 'player', (lv) => playerCombatStats(progress, lv, stack.list()), 1);
    const before = { ...combat.stats };
    stack.set(primaryModifier('equipment', 'item:helm', { vit: 2 }));
    stack.set({ source: 'buff', id: 'status:might', flat: { physicalAtk: 5 } });
    stack.set(primaryModifier('debuff', 'status:frail', { vit: -1 }));
    assert.equal(combat.stats.maxHp, before.maxHp + 25);
    assert.equal(combat.stats.attack, before.attack + 5);
    assert.deepEqual(progress.allocated, zeroPrimary());
  });
});

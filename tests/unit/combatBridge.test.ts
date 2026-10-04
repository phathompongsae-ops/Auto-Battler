import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { attackInterval } from '../../src/combat/attackSpeed';
import { CombatantState } from '../../src/combat/CombatantState';
import { CombatSystem } from '../../src/combat/CombatSystem';
import { hitChance, mitigatedDamage, resolveAttack } from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/ProjectileSystem';
import { SkillSystem } from '../../src/combat/SkillSystem';
import { StatusSystem } from '../../src/combat/StatusSystem';
import type { CombatEntity, CombatStats } from '../../src/combat/types';
import { EventBus } from '../../src/core/EventBus';
import { CLASS_GROWTH } from '../../src/data/classGrowth';
import { CLASS_PRESENTATION, presentationFor } from '../../src/data/demoConfig';
import { JOBS, type JobId } from '../../src/data/jobData';
import * as playerData from '../../src/data/playerData';
import { SKILLS } from '../../src/data/skillData';
import { NOVICE_BASE_STATS } from '../../src/data/statData';
import type { GameEvents } from '../../src/game/GameEvents';
import { CharacterProgress, earnedSkillPoints, earnedStatPoints } from '../../src/progression/CharacterProgress';
import { changeJob } from '../../src/progression/statActions';
import { capturePlayerSave } from '../../src/save/playerSnapshot';
import { effectiveCastTime, effectiveHeal } from '../../src/stats/castAndHeal';
import { classBaseStats, classGrowthMaxLevel, ClassGrowthRangeError } from '../../src/stats/classBaseStats';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { makeSaveTarget } from './fixtures';

const close = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${msg ?? ''} expected ${expected}, got ${actual}`);

/** Replays fixed rolls in order (then repeats the last). */
const rolls = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

function stats(over: Partial<CombatStats> = {}): CombatStats {
  return {
    maxHp: 100, maxMp: 0, attack: 100, magicAttack: 100, defense: 0, magicDefense: 0,
    accuracy: 0, evasion: 0, attackSpeed: 0, critChance: 0, critMultiplier: 1.5,
    castTime: 0, healPower: 0, moveSpeed: 0, mpRegen: 0, damageReduction: 0, skillDamageBonus: {}, skillCooldownReduction: {}, ...over,
  };
}

function entity(id: string, s: CombatStats, team: 'player' | 'monster' = 'monster'): CombatEntity {
  return { id, x: 0, y: 0, hitRadius: 10, combat: new CombatantState(id, id, team, () => ({ ...s })) };
}

function playerOwner(level = 1) {
  const progress = new CharacterProgress();
  const combat = new CombatantState('player', 'P', 'player', (lv, st) => playerCombatStats(progress, lv, [], st), level);
  return { id: 'player', x: 0, y: 0, hitRadius: 10, progress, combat };
}

describe('starting Novice', () => {
  test('base stats 5/5/5/5/5/5; Novice base combat values 300/100/25/20/8/8', () => {
    assert.deepEqual(NOVICE_BASE_STATS, { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 });
    assert.deepEqual(classBaseStats('novice', 1), { hp: 300, mp: 100, atk: 25, matk: 20, def: 8, mdef: 8 });
  });

  test('Novice base stays at the Lv1 values through Lv10 (stat points carry growth)', () => {
    for (let lv = 1; lv <= 10; lv++) assert.deepEqual(classBaseStats('novice', lv), classBaseStats('novice', 1), `Lv${lv}`);
  });

  test('starting stats contribute literally: no free first points', () => {
    const s = playerOwner(1).combat.stats;
    assert.equal(s.maxHp, 425);
    assert.equal(s.attack, 35);
    assert.equal(s.magicAttack, 30);
    assert.equal(s.defense, 13);
    assert.equal(s.magicDefense, 13);
    assert.equal(s.maxMp, 175);
  });
});

describe('class base growth v1', () => {
  const ANCHORS: Record<string, Record<number, [number, number, number, number, number, number]>> = {
    warrior: { 11: [700, 120, 70, 25, 25, 12], 20: [1050, 160, 110, 30, 40, 18], 30: [1550, 220, 165, 40, 60, 26], 40: [2150, 300, 230, 50, 85, 35] },
    archer: { 11: [560, 170, 75, 25, 18, 15], 20: [850, 220, 120, 30, 28, 22], 30: [1230, 300, 180, 40, 42, 32], 40: [1700, 400, 250, 50, 60, 45] },
    mage: { 11: [420, 300, 35, 85, 12, 25], 20: [620, 470, 45, 140, 18, 42], 30: [900, 680, 60, 210, 26, 62], 40: [1200, 920, 80, 290, 35, 90] },
    cleric: { 11: [560, 260, 40, 65, 18, 28], 20: [850, 410, 55, 105, 28, 45], 30: [1230, 590, 75, 160, 42, 66], 40: [1700, 800, 100, 220, 60, 95] },
    ninja: { 11: [500, 170, 78, 25, 16, 15], 20: [750, 230, 125, 30, 24, 22], 30: [1080, 310, 190, 40, 36, 32], 40: [1500, 420, 265, 50, 50, 45] },
  };

  for (const [job, anchors] of Object.entries(ANCHORS)) {
    test(`${job}: every locked anchor matches exactly`, () => {
      for (const [lv, [hp, mp, atk, matk, def, mdef]] of Object.entries(anchors)) {
        assert.deepEqual(classBaseStats(job as JobId, Number(lv)), { hp, mp, atk, matk, def, mdef }, `${job} Lv${lv}`);
      }
    });
  }

  test('between anchors: linear, rounded to nearest (deterministic)', () => {
    // Warrior HP 700 → 1050 over 9 levels: Lv15 = 700 + 350 × 4/9 = 855.6 → 856.
    assert.equal(classBaseStats('warrior', 15).hp, 856);
    // Warrior DEF 25 → 40: Lv12 = 26.67 → 27.
    assert.equal(classBaseStats('warrior', 12).def, 27);
    assert.deepEqual(classBaseStats('mage', 25), classBaseStats('mage', 25));
    // Monotonic for every class and stat.
    for (const job of ['warrior', 'archer', 'mage', 'cleric', 'ninja'] as const) {
      for (let lv = 12; lv <= 40; lv++) {
        const a = classBaseStats(job, lv - 1);
        const b = classBaseStats(job, lv);
        for (const k of ['hp', 'mp', 'atk', 'matk', 'def', 'mdef'] as const) assert.ok(b[k] >= a[k], `${job} ${k} Lv${lv}`);
      }
    }
  });

  test('Class 1 does not extrapolate: beyond Lv40 or below Lv11 throws', () => {
    assert.throws(() => classBaseStats('warrior', 41), ClassGrowthRangeError);
    assert.throws(() => classBaseStats('warrior', 10), ClassGrowthRangeError);
    const p = new CharacterProgress();
    assert.deepEqual(p.changeJob('warrior', 41), { ok: false, reason: 'level_too_high' });
  });

  test('level caps follow the growth range: Class 1 stops at Lv40, Novice holds', () => {
    for (const job of ['warrior', 'archer', 'mage', 'cleric', 'ninja'] as const) {
      assert.equal(classGrowthMaxLevel(job), 40, job);
      assert.equal(CLASS_GROWTH[job].afterLastAnchor, 'error', job);
    }
    assert.equal(classGrowthMaxLevel('novice'), null);
  });

  test('no legacy per-level growth remains', () => {
    assert.equal('PLAYER_GROWTH' in playerData, false);
    assert.equal('PLAYER_BASE_STATS' in playerData, false);
    // Lv1 → Lv10 Novice with no allocation: identical combat stats.
    assert.deepEqual(playerOwner(10).combat.stats, playerOwner(1).combat.stats);
  });
});

describe('free stat and skill points', () => {
  test('free stat points: Lv1 0, Lv10 9, Lv11 10, Lv40 39', () => {
    assert.deepEqual([1, 10, 11, 40].map(earnedStatPoints), [0, 9, 10, 39]);
  });

  test('Class 1 earns +1 skill point per level Lv11–40 (30 total); Novice earns none', () => {
    for (let lv = 1; lv <= 50; lv++) assert.equal(earnedSkillPoints('novice', lv), 0);
    assert.equal(earnedSkillPoints('warrior', 11), 1);
    assert.equal(earnedSkillPoints('warrior', 20), 10);
    assert.equal(earnedSkillPoints('warrior', 40), 30);
    for (const job of ['warrior', 'archer', 'mage', 'cleric', 'ninja'] as const) assert.equal(earnedSkillPoints(job, 40), 30);
  });

  test('skill points are separate from stat points; job change still grants no stat points', () => {
    const p = new CharacterProgress();
    p.changeJob('warrior', 15);
    assert.equal(p.remaining(15), 14);
    assert.equal(p.remainingSkillPoints(15), 5);
  });

  test('job bonuses unchanged and separate', () => {
    assert.deepEqual(JOBS.warrior.jobBonus, { str: 3, vit: 2 });
    assert.deepEqual(JOBS.archer.jobBonus, { dex: 3, agi: 2 });
    assert.deepEqual(JOBS.mage.jobBonus, { int: 3, dex: 2 });
    assert.deepEqual(JOBS.cleric.jobBonus, { int: 3, vit: 2 });
    assert.deepEqual(JOBS.ninja.jobBonus, { agi: 3, luk: 2 });
  });
});

describe('physical and magic damage', () => {
  test('physical uses ATK vs DEF; magic uses MATK vs MDEF', () => {
    const atk = stats({ attack: 120, magicAttack: 80 });
    const def = stats({ defense: 20, magicDefense: 60 });
    const phys = resolveAttack(atk, def, 1, 'physical', rolls(0, 0.99));
    const magic = resolveAttack(atk, def, 1, 'magic', rolls(0, 0.99));
    assert.deepEqual(phys, { hit: true, amount: 100, crit: false }); // 120 × 100/120
    assert.deepEqual(magic, { hit: true, amount: 50, crit: false }); // 80 × 100/160
  });

  test('skill multiplier and minimum 1 damage', () => {
    close(mitigatedDamage(50, 2.2, 10), (50 * 2.2 * 100) / 110);
    assert.equal(resolveAttack(stats({ attack: 0.1 }), stats({ defense: 999 }), 1, 'physical', rolls(0, 0.99)).hit, true);
    assert.deepEqual(resolveAttack(stats({ attack: 0.1 }), stats({ defense: 999 }), 1, 'physical', rolls(0, 0.99)), { hit: true, amount: 1, crit: false });
  });

  test('skills declare their damage type in data', () => {
    const type = (id: keyof typeof SKILLS) => {
      const e = SKILLS[id].effect;
      return e.kind === 'damage' || e.kind === 'projectile' ? e.damageType : null;
    };
    assert.equal(type('basic_attack'), 'physical');
    assert.equal(type('power_strike'), 'physical');
    assert.equal(type('fire_bolt'), 'magic');
  });

  test('Fire Bolt resolves on the magic path (MATK vs MDEF), ignoring ATK and DEF', () => {
    const events = new EventBus<GameEvents>();
    const combat = new CombatSystem(events);
    combat.rng = rolls(0, 0.99, 0, 0.99);
    const caster = entity('c', stats({ attack: 1, magicAttack: 120 }), 'player');
    const target = entity('t', stats({ maxHp: 1000, defense: 900, magicDefense: 20 }));
    const result = combat.dealDamage(caster, target, 'fire_bolt', SKILLS.fire_bolt.effect.kind === 'projectile' ? SKILLS.fire_bolt.effect.power : 0);
    assert.deepEqual(result, { hit: true, amount: 160, crit: false }); // 120 × 1.6 × 100/120
  });
});

describe('hit, evasion and crit', () => {
  test('hit chance: 95% + accuracy - evasion, clamped to 70%..100%', () => {
    close(hitChance(0, 0), 0.95);
    close(hitChance(0.03, 0.01), 0.97);
    close(hitChance(0, 0.5), 0.7);
    close(hitChance(0.5, 0), 1);
  });

  test('a deterministic miss deals no damage and reports a miss', () => {
    const events = new EventBus<GameEvents>();
    const combat = new CombatSystem(events);
    const misses: string[] = [];
    const damage: number[] = [];
    events.on('miss', (e) => misses.push(e.skillId));
    events.on('damage', (e) => damage.push(e.amount));
    combat.rng = rolls(0.96); // ≥ 95% hit chance → miss
    const a = entity('a', stats(), 'player');
    const t = entity('t', stats());
    assert.deepEqual(combat.dealDamage(a, t, 'basic_attack', 1), { hit: false });
    assert.equal(t.combat.hp, 100);
    assert.deepEqual(misses, ['basic_attack']);
    assert.deepEqual(damage, []);
  });

  test('base crit damage is 150%, applied after mitigation', () => {
    const atk = stats({ attack: 100, critChance: 1 });
    const def = stats({ defense: 100 });
    // 100 × 100/200 = 50, then × 1.5 = 75 (not (100 × 1.5) mitigated differently).
    assert.deepEqual(resolveAttack(atk, def, 1, 'physical', rolls(0, 0)), { hit: true, amount: 75, crit: true });
    close(playerOwner(1).combat.stats.critMultiplier, 1.5 + 5 * 0.003);
  });
});

describe('attack speed', () => {
  test('ASPD shortens the basic-attack interval; a safety floor holds', () => {
    assert.equal(attackInterval(500, 0), 500);
    close(attackInterval(500, 0.25), 400);
    assert.equal(attackInterval(500, 100), 100);
    assert.equal(attackInterval(500, -5), 5000);
  });

  test('AGI reduces the basic attack interval but not Power Strike cooldown', () => {
    const events = new EventBus<GameEvents>();
    const combat = new CombatSystem(events);
    const statuses = new StatusSystem(events);
    const skills = new SkillSystem(events, combat, statuses, new ProjectileSystem(events, combat));
    const owner = playerOwner(11);
    const before = skills.cooldownDuration(owner, 'basic_attack');
    owner.progress.allocate('agi', 10, 11);
    owner.combat.refreshStats();
    const after = skills.cooldownDuration(owner, 'basic_attack');
    close(before, 500 / (1 + 5 * 0.002));
    close(after, 500 / (1 + 15 * 0.002));
    assert.ok(after < before);
    assert.equal(skills.cooldownDuration(owner, 'power_strike'), SKILLS.power_strike.cooldown);
  });
});

describe('cast time and heal power hooks', () => {
  test('exact values', () => {
    assert.equal(effectiveCastTime(1000, -0.1), 900);
    assert.equal(effectiveCastTime(1000, 0), 1000);
    assert.equal(effectiveCastTime(1000, -2), 0);
    close(effectiveHeal(200, 0.04), 208);
    assert.equal(effectiveHeal(200, 0), 200);
  });
});

describe('Guard through the buff modifier source', () => {
  test('applies DEF × 2 + 6 while active, removed on expiry, no permanent change', () => {
    const events = new EventBus<GameEvents>();
    const statuses = new StatusSystem(events);
    const owner = playerOwner(1);
    const def = owner.combat.stats.defense;
    statuses.apply(owner, 'guard', 5000, 0);
    assert.equal(owner.combat.stats.defense, def * 2 + 6);
    statuses.update([owner], 4999);
    assert.equal(owner.combat.stats.defense, def * 2 + 6);
    statuses.update([owner], 5000);
    assert.equal(owner.combat.stats.defense, def);
    assert.deepEqual(owner.progress.allocated, { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 });
  });
});

describe('Novice vs demo Warrior', () => {
  test('the demo Warrior presentation is not the character class and is not saved', () => {
    assert.equal(presentationFor('novice').art.displayName, 'Warrior');
    assert.equal(presentationFor('novice').temporaryFallback, true, 'explicitly a temporary fallback');
    assert.equal(presentationFor('warrior').temporaryFallback, false, 'real for a Warrior');
    for (const job of ['archer', 'mage', 'cleric', 'ninja'] as const) assert.equal(CLASS_PRESENTATION[job].temporaryFallback, true, job);
    const save = capturePlayerSave(makeSaveTarget(1));
    assert.equal(save.classId, 'novice');
    assert.deepEqual(save.stats.jobBonuses, {});
    assert.equal(JSON.stringify(save).includes('warrior'), false);
  });
});

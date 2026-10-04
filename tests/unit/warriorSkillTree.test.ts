import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CombatantState } from '../../src/combat/CombatantState';
import { CombatSystem } from '../../src/combat/CombatSystem';
import { ProjectileSystem } from '../../src/combat/ProjectileSystem';
import { SkillSystem } from '../../src/combat/SkillSystem';
import { StatusSystem } from '../../src/combat/StatusSystem';
import type { CombatEntity, CombatStats } from '../../src/combat/types';
import { FixedServerDay } from '../../src/core/serverDay';
import { SKILLS, type SkillId } from '../../src/data/skillData';
import { WARRIOR_C1_TREE } from '../../src/data/skillTrees/warriorTree';
import { cumulativeExp } from '../../src/progression/expCurve';
import { SkillProcs } from '../../src/skills/SkillProcs';
import { SkillTree } from '../../src/skills/SkillTree';
import { passiveModifiers, skillAtRank } from '../../src/skills/skillTreeRules';
import { allocateStat } from '../../src/progression/statActions';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { makeSaveTarget } from './fixtures';

const TILE = 32;
const node = (id: string) => WARRIOR_C1_TREE.nodes.find((n) => n.id === id)!;

/** A monster with fixed stats (enough HP to survive, no evasion unless asked). */
function monster(id: string, x: number, y: number, over: Partial<CombatStats> = {}): CombatEntity & { x: number; y: number } {
  const stats: CombatStats = {
    maxHp: 100_000, maxMp: 0, attack: 50, magicAttack: 0, defense: 0, magicDefense: 0, accuracy: 0, evasion: 0,
    attackSpeed: 0, critChance: 0, critMultiplier: 1.5, castTime: 0, healPower: 0, moveSpeed: 0, mpRegen: 0,
    damageReduction: 0, skillDamageBonus: {}, skillCooldownReduction: {}, ...over,
  };
  return { id, x, y, hitRadius: 12, combat: new CombatantState(id, id, 'monster', () => ({ ...stats })) };
}

/**
 * A Warrior wired like the game: the real SkillTree, SkillSystem (resolving the
 * player's skills through the tree), StatusSystem, CombatSystem and procs.
 * `job` lets tests try other jobs; `unlock` the class_1_skills feature.
 */
function rig({ level = 11, job = 'warrior', unlock = true } = {}) {
  const t = makeSaveTarget(level, undefined, new FixedServerDay(21));
  if (job !== 'novice') t.jobChange.select(job, { skipTrial: true });
  if (!unlock) t.features.unlocked.delete('class_1_skills');
  const player = Object.assign(t.player, { x: 0, y: 0 });
  const monsters = [monster('m1', 30, 0), monster('m2', 0, 40), monster('far', 400, 0)];
  let now = 0;
  const rolls: number[] = [];
  const combat = new CombatSystem(t.events);
  combat.rng = () => (rolls.length ? rolls.shift()! : 0.5);
  const statuses = new StatusSystem(t.events);
  const procs = new SkillProcs(player, t.events, statuses, () => now);
  const tree = new SkillTree(player, t.features, t.events, () => procs.reset());
  const skills = new SkillSystem(t.events, combat, statuses, new ProjectileSystem(t.events, combat), {
    resolve: (caster, id) => (caster === player ? tree.resolve(id) : SKILLS[id]),
    entities: () => [player, ...monsters],
    dash: (caster, target, max) => {
      const d = Math.hypot(target.x - caster.x, target.y - caster.y);
      const travel = Math.min(max, d - target.hitRadius - caster.hitRadius - 2);
      if (travel > 0) {
        player.x += ((target.x - caster.x) / d) * travel;
        player.y += ((target.y - caster.y) / d) * travel;
      }
    },
  });
  const log: { type: string; e: Record<string, unknown> }[] = [];
  for (const type of ['damage', 'miss', 'skillRankChanged', 'skillTreeReset', 'skillAvailabilityChanged', 'skillProc', 'taunted'] as const) {
    t.events.on(type, (e) => log.push({ type, e: e as Record<string, unknown> }));
  }
  const learn = (id: string, times = 1) => {
    for (let i = 0; i < times; i++) assert.equal(tree.learn(id).ok, true, `learn ${id} #${i + 1}`);
  };
  const cast = (skillId: SkillId, target: CombatEntity | null = monsters[0]) => skills.use(player, skillId, now, { target, quiet: true });
  const advance = (ms: number) => {
    now += ms;
    skills.update(now);
    statuses.update([player, ...monsters], now);
  };
  const p = player.combat;
  return { t, player, p, monsters, tree, skills, statuses, combat, procs, rolls, log, learn, cast, advance, now: () => now };
}

/** Level a rig's character up through real progression. */
const levelTo = (r: ReturnType<typeof rig>, level: number) =>
  r.t.progression.grantExp(r.player, cumulativeExp(level) - cumulativeExp(r.p.level));

describe('Warrior tree data', () => {
  test('structure: Core 6, Tank 20, Damage 20; exact max ranks and gates', () => {
    const total = (branch: string) => WARRIOR_C1_TREE.nodes.filter((n) => n.branch === branch).reduce((s, n) => s + n.maxRank, 0);
    assert.deepEqual([total('core'), total('tank'), total('damage')], [6, 20, 20]);
    const shape = Object.fromEntries(WARRIOR_C1_TREE.nodes.map((n) => [n.id, [n.branch, n.maxRank, n.branchSpendRequirement ?? 0, n.type]]));
    assert.deepEqual(shape, {
      power_slash: ['core', 5, 0, 'active'],
      charge: ['core', 1, 0, 'active'],
      heavy_armor_mastery: ['tank', 10, 0, 'passive'],
      shield_bash: ['tank', 5, 0, 'active'],
      provoke: ['tank', 3, 5, 'active'],
      iron_guard: ['tank', 1, 10, 'buff'],
      guardian_instinct: ['tank', 1, 15, 'proc'],
      sword_mastery: ['damage', 10, 0, 'passive'],
      whirlwind: ['damage', 5, 0, 'active'],
      heavy_strike: ['damage', 3, 5, 'active'],
      berserk: ['damage', 1, 10, 'buff'],
      battle_instinct: ['damage', 1, 15, 'proc'],
    });
  });
});

describe('Skill Points and spending', () => {
  test('earned: Lv11 = 1, Lv20 = 10, Lv40 = 30; available = earned - spent', () => {
    const r = rig();
    assert.deepEqual(r.tree.points(), { earned: 1, spent: 0, available: 1 });
    levelTo(r, 20);
    assert.deepEqual(r.tree.points(), { earned: 10, spent: 0, available: 10 });
    r.learn('power_slash', 3);
    assert.deepEqual(r.tree.points(), { earned: 10, spent: 3, available: 7 });
    levelTo(r, 40);
    assert.equal(r.tree.points().earned, 30);
  });

  test('cannot spend more than available, or past max rank; a failure changes nothing', () => {
    const r = rig();
    r.learn('power_slash');
    const before = JSON.stringify(r.t.progress.skillRanks);
    assert.deepEqual(r.tree.learn('power_slash'), { ok: false, reason: 'not_enough_points' });
    levelTo(r, 20);
    r.learn('charge');
    assert.deepEqual(r.tree.learn('charge'), { ok: false, reason: 'max_rank' });
    r.learn('power_slash', 4);
    assert.deepEqual(r.tree.learn('power_slash'), { ok: false, reason: 'max_rank' });
    assert.equal(r.tree.rank('power_slash'), 5);
    assert.deepEqual(r.tree.learn('nope'), { ok: false, reason: 'unknown_skill' });
    assert.notEqual(before, JSON.stringify(r.t.progress.skillRanks));
  });

  test('Novice, other Class 1 jobs and a locked feature cannot spend', () => {
    const novice = rig({ level: 15, job: 'novice' });
    assert.deepEqual(novice.tree.learn('power_slash'), { ok: false, reason: 'no_skill_tree' });
    for (const job of ['archer', 'mage', 'cleric', 'ninja']) {
      const r = rig({ level: 15, job });
      assert.deepEqual(r.tree.learn('power_slash'), { ok: false, reason: 'no_skill_tree' }, job);
      assert.deepEqual(r.t.progress.skillRanks, {});
    }
    const locked = rig({ unlock: false });
    assert.deepEqual(locked.tree.learn('power_slash'), { ok: false, reason: 'feature_locked' });
    assert.equal(locked.tree.points().available, 1);
  });

  test('a successful learn adds exactly one rank and reports it', () => {
    const r = rig();
    assert.deepEqual(r.tree.learn('power_slash'), { ok: true, rank: 1 });
    assert.deepEqual(r.log.filter((x) => x.type === 'skillRankChanged').map((x) => x.e), [{ nodeId: 'power_slash', rank: 1, available: 0 }]);
    assert.equal(r.log.filter((x) => x.type === 'skillAvailabilityChanged').length, 1, 'a new active reaches the action bar');
  });
});

describe('Core skills', () => {
  test('Power Slash ranks 1–5: exact damage / cooldown / MP, range 1.4 tiles', () => {
    const expected = [[1.25, 4000, 8], [1.4, 3800, 9], [1.55, 3600, 10], [1.7, 3400, 11], [1.9, 3200, 12]];
    expected.forEach(([power, cd, mp], i) => {
      const s = skillAtRank(node('power_slash'), i + 1)!;
      assert.deepEqual([s.effect.kind === 'damage' && s.effect.power, s.cooldown, s.mpCost], [power, cd, mp], `rank ${i + 1}`);
      assert.equal(s.range, 1.4 * TILE);
      assert.equal(s.id, 'power_strike', 'the existing Power Slash combat skill (animation, wind-up, cancel rules)');
      assert.deepEqual(s.windup, SKILLS.power_strike.windup);
    });
    assert.equal(skillAtRank(node('power_slash'), 0), null);
  });

  test('Power Slash at rank 0 cannot be cast; at rank 1 it costs 8 MP, starts a 4 s cooldown and hits for 125%', () => {
    const r = rig();
    assert.deepEqual(r.cast('power_strike'), { ok: false, reason: 'not_learned' });
    r.learn('power_slash');
    const mp = r.p.mp;
    assert.deepEqual(r.cast('power_strike'), { ok: true });
    assert.equal(r.p.mp, mp - 8);
    assert.equal(r.skills.cooldownRemaining(r.player, 'power_strike', r.now()), 4000);
    r.advance(312); // the existing wind-up still delays the hit to the swing's hit frame
    const dmg = r.log.find((x) => x.type === 'damage')!.e;
    assert.equal(dmg.amount, Math.max(1, Math.round(r.p.stats.attack * 1.25)));
  });

  test('Charge: 140% / 12 s / 16 MP, one rank; dashes up to 4.5 tiles and interrupts 0.5 s on a hit', () => {
    const s = skillAtRank(node('charge'), 1)!;
    assert.ok(s.effect.kind === 'dash_strike');
    assert.deepEqual([s.effect.power, s.cooldown, s.mpCost, s.effect.distance, s.effect.onHit?.duration], [1.4, 12000, 16, 4.5 * TILE, 500]);
    const r = rig();
    r.learn('charge');
    const target = monster('runner', 120, 0);
    r.monsters.push(target);
    assert.deepEqual(r.cast('charge', target), { ok: true });
    assert.ok(r.player.x > 80, `dashed to ${r.player.x}`);
    assert.ok(target.combat.hasStatus('stunned'));
  });
});

describe('branch gates and cross-build', () => {
  test('Tank: Provoke at 5, Iron Guard at 10, Guardian Instinct at 15 Tank SP', () => {
    const r = rig({ level: 40 });
    const gate = (id: string) => r.tree.canLearn(id);
    r.learn('heavy_armor_mastery', 4);
    assert.deepEqual(gate('provoke'), { ok: false, reason: 'branch_requirement' });
    r.learn('heavy_armor_mastery');
    assert.equal(gate('provoke').ok, true);
    r.learn('heavy_armor_mastery', 5);
    assert.equal(gate('iron_guard').ok, true);
    assert.deepEqual(gate('guardian_instinct'), { ok: false, reason: 'branch_requirement' });
    r.learn('shield_bash', 4);
    assert.deepEqual(gate('guardian_instinct'), { ok: false, reason: 'branch_requirement' });
    r.learn('shield_bash');
    assert.equal(gate('guardian_instinct').ok, true);
  });

  test('Damage: Heavy Strike at 5, Berserk at 10, Battle Instinct at 15 Damage SP', () => {
    const r = rig({ level: 40 });
    r.learn('sword_mastery', 4);
    assert.deepEqual(r.tree.canLearn('heavy_strike'), { ok: false, reason: 'branch_requirement' });
    r.learn('sword_mastery');
    assert.equal(r.tree.canLearn('heavy_strike').ok, true);
    r.learn('sword_mastery', 4);
    assert.deepEqual(r.tree.canLearn('berserk'), { ok: false, reason: 'branch_requirement' });
    r.learn('sword_mastery');
    assert.equal(r.tree.canLearn('berserk').ok, true);
    r.learn('whirlwind', 4);
    assert.deepEqual(r.tree.canLearn('battle_instinct'), { ok: false, reason: 'branch_requirement' });
    r.learn('whirlwind');
    assert.equal(r.tree.canLearn('battle_instinct').ok, true);
  });

  test('both branches can be spent in; one branch never counts toward the other', () => {
    const r = rig({ level: 40 });
    r.learn('power_slash', 5);
    r.learn('charge');
    r.learn('sword_mastery', 10);
    r.learn('heavy_armor_mastery', 4);
    assert.deepEqual(r.tree.canLearn('provoke'), { ok: false, reason: 'branch_requirement' }, '10 Damage SP do not open a Tank gate');
    r.learn('heavy_armor_mastery');
    r.learn('provoke');
    assert.equal(r.tree.points().spent, 22);
    r.learn('berserk');
    r.learn('whirlwind', 5);
    r.learn('battle_instinct');
    assert.deepEqual(r.tree.points(), { earned: 30, spent: 29, available: 1 });
  });
});

describe('passives', () => {
  test('Heavy Armor Mastery: +2% DEF and +1% Max HP per rank (rank 10: +20% / +10%)', () => {
    const r = rig({ level: 20 });
    const base = { ...r.p.stats };
    r.learn('heavy_armor_mastery', 10);
    assert.deepEqual(passiveModifiers(WARRIOR_C1_TREE, r.t.progress.skillRanks).map((m) => m.percent), [{ def: 0.2, maxHp: 0.1 }]);
    assert.equal(r.p.stats.defense, Math.round((base.defense) * 1.2));
    assert.equal(r.p.stats.maxHp, Math.round(base.maxHp * 1.1));
  });

  test('Sword Mastery: +1.5% Physical ATK and +1 Accuracy point per rank (rank 10: +15% / +10 points)', () => {
    const r = rig({ level: 20 });
    const base = { ...r.p.stats };
    r.learn('sword_mastery', 10);
    const m = passiveModifiers(WARRIOR_C1_TREE, r.t.progress.skillRanks)[0];
    assert.equal(m.percent?.physicalAtk, 0.15);
    assert.ok(Math.abs((m.flat?.accuracy ?? 0) - 0.1) < 1e-12);
    assert.equal(r.p.stats.attack, Math.round(base.attack * 1.15));
    assert.ok(Math.abs(r.p.stats.accuracy - base.accuracy - 0.1) < 1e-9);
  });

  test('passives are not castable and never appear on the action bar', () => {
    const r = rig({ level: 20 });
    r.learn('heavy_armor_mastery', 3);
    r.learn('sword_mastery', 3);
    assert.deepEqual(Object.values(r.tree.loadout()).filter(Boolean), []);
  });
});

describe('active skills', () => {
  test('Shield Bash: rank values; a hit stuns, a miss neither damages nor stuns', () => {
    const want = [[0.9, 8000, 10, 800], [1.0, 7750, 11, 1000], [1.1, 7500, 12, 1200], [1.2, 7250, 13, 1400], [1.3, 7000, 14, 1600]];
    want.forEach(([power, cd, mp, stun], i) => {
      const s = skillAtRank(node('shield_bash'), i + 1)!;
      assert.ok(s.effect.kind === 'damage');
      assert.deepEqual([s.effect.power, s.cooldown, s.mpCost, s.effect.onHit?.duration], [power, cd, mp, stun]);
    });
    const r = rig();
    r.learn('shield_bash');
    r.rolls.push(0, 0.9); // hit, no crit
    r.cast('shield_bash');
    assert.ok(r.monsters[0].combat.hasStatus('stunned'));

    const miss = rig();
    miss.learn('shield_bash');
    const dodgy = monster('dodgy', 30, 0, { evasion: 0.5 });
    miss.monsters.push(dodgy);
    miss.rolls.push(0.99);
    miss.cast('shield_bash', dodgy);
    assert.equal(dodgy.combat.hasStatus('stunned'), false);
    assert.equal(dodgy.combat.hp, dodgy.combat.stats.maxHp);
  });

  test('Provoke: rank radius / duration / cooldown / MP; taunts only monsters in range', () => {
    const want = [[3.0, 3000, 12000, 12], [3.5, 4000, 11000, 14], [4.0, 5000, 10000, 16]];
    want.forEach(([radius, dur, cd, mp], i) => {
      const s = skillAtRank(node('provoke'), i + 1)!;
      assert.ok(s.effect.kind === 'taunt');
      assert.deepEqual([s.effect.radius, s.effect.duration, s.cooldown, s.mpCost], [radius * TILE, dur, cd, mp]);
    });
    const r = rig({ level: 20 });
    r.learn('heavy_armor_mastery', 5);
    r.learn('provoke');
    r.cast('provoke', null);
    assert.deepEqual(r.monsters.map((m) => m.combat.hasStatus('taunted')), [true, true, false]);
    assert.deepEqual(r.log.filter((x) => x.type === 'taunted').map((x) => x.e.targetId), ['m1', 'm2']);
    r.advance(3000);
    assert.equal(r.monsters[0].combat.hasStatus('taunted'), false);
  });

  test('Iron Guard: damage received -45% for 4 s, then gone', () => {
    const r = rig({ level: 21 }); // 10 Tank SP for the gate + 1
    r.learn('heavy_armor_mastery', 10);
    r.learn('iron_guard');
    const s = skillAtRank(node('iron_guard'), 1)!;
    assert.deepEqual([s.cooldown, s.mpCost, s.effect.kind === 'status' && s.effect.duration], [24000, 18, 4000]);
    r.cast('iron_guard', null);
    assert.equal(r.p.stats.damageReduction, 0.45);
    r.advance(3999);
    assert.equal(r.p.hasStatus('iron_guard'), true);
    r.advance(1);
    assert.equal(r.p.hasStatus('iron_guard'), false);
    assert.equal(r.p.stats.damageReduction, 0);
  });

  test('Whirlwind: total damage per rank on every enemy within 2 tiles (one hit each)', () => {
    const want = [[1.4, 7000, 14], [1.6, 6750, 16], [1.8, 6500, 18], [2.0, 6250, 20], [2.2, 6000, 22]];
    want.forEach(([power, cd, mp], i) => {
      const s = skillAtRank(node('whirlwind'), i + 1)!;
      assert.ok(s.effect.kind === 'aoe_damage');
      assert.deepEqual([s.effect.power, s.cooldown, s.mpCost, s.effect.radius], [power, cd, mp, 2 * TILE]);
    });
    const r = rig();
    r.learn('whirlwind');
    r.rolls.push(0, 0.9, 0, 0.9);
    r.cast('whirlwind', null);
    const hits = r.log.filter((x) => x.type === 'damage').map((x) => [x.e.targetId, x.e.amount]);
    const each = Math.round(r.p.stats.attack * 1.4);
    assert.deepEqual(hits, [['m1', each], ['m2', each]], 'the far monster is untouched');
  });

  test('Heavy Strike: rank damage; its crit bonus applies to this skill only', () => {
    const want = [[1.8, 7500, 14, 0.1], [2.2, 7000, 17, 0.15], [2.6, 6500, 20, 0.2]];
    want.forEach(([power, cd, mp, crit], i) => {
      const s = skillAtRank(node('heavy_strike'), i + 1)!;
      assert.ok(s.effect.kind === 'damage');
      assert.deepEqual([s.effect.power, s.cooldown, s.mpCost, s.effect.critBonus], [power, cd, mp, crit]);
    });
    const r = rig({ level: 20 });
    r.learn('sword_mastery', 5);
    r.learn('heavy_strike');
    const critRate = r.p.stats.critChance;
    const roll = critRate + 0.05; // above the character's crit, below crit + 10 points
    r.rolls.push(0, roll);
    r.cast('heavy_strike');
    r.advance(312);
    assert.equal(r.log.filter((x) => x.type === 'damage').at(-1)!.e.crit, true);
    r.rolls.push(0, roll);
    r.advance(500);
    r.combat.dealDamage(r.player, r.monsters[0], 'basic_attack', 1);
    assert.equal(r.log.filter((x) => x.type === 'damage').at(-1)!.e.crit, false, 'other attacks keep the normal crit chance');
    assert.equal(r.p.stats.critChance, critRate);
  });

  test('Berserk: ATK +20%, ASPD +15%, DEF -15% for 10 s, then removed (cooldowns unaffected)', () => {
    const r = rig({ level: 21 }); // 10 Damage SP for the gate + 1
    r.learn('sword_mastery', 10);
    const base = { ...r.p.stats };
    r.learn('berserk');
    const s = skillAtRank(node('berserk'), 1)!;
    assert.deepEqual([s.cooldown, s.mpCost, s.effect.kind === 'status' && s.effect.duration], [30000, 20, 10000]);
    r.cast('berserk', null);
    // ATK already has Sword Mastery +15%: percents add up (+35% total over class/stat ATK).
    const rawAtk = base.attack / 1.15;
    assert.ok(Math.abs(r.p.stats.attack - Math.round(rawAtk * 1.35)) <= 1);
    assert.ok(Math.abs(r.p.stats.attackSpeed - base.attackSpeed - 0.15) < 1e-9);
    assert.equal(r.p.stats.defense, Math.round(base.defense * 0.85));
    assert.equal(r.skills.cooldownDuration(r.player, 'power_strike'), SKILLS.power_strike.cooldown, 'ASPD never shortens skill cooldowns (unlearned skill falls back to data)');
    r.advance(10000);
    assert.equal(r.p.hasStatus('berserk'), false);
    assert.deepEqual(r.p.stats, base);
  });
});

describe('procs', () => {
  test('Guardian Instinct: below 30% HP → -20% damage taken for 5 s; 30 s internal cooldown; no spam', () => {
    const r = rig({ level: 40 });
    r.learn('heavy_armor_mastery', 10);
    r.learn('shield_bash', 5);
    r.learn('guardian_instinct');
    const max = r.p.stats.maxHp;
    const hit = () => {
      r.rolls.push(0, 0.9);
      r.combat.dealDamage(r.monsters[0], r.player, 'basic_attack', 1);
    };
    r.p.hp = max * 0.9;
    hit();
    assert.equal(r.p.hasStatus('guardian_instinct'), false, 'above 30%: nothing');
    r.p.hp = max * 0.3 + 5;
    hit();
    assert.equal(r.p.hasStatus('guardian_instinct'), true);
    assert.equal(r.p.stats.damageReduction, 0.2);
    for (let i = 0; i < 3; i++) {
      r.advance(1000);
      r.p.hp = max * 0.2;
      hit();
    }
    assert.equal(r.log.filter((x) => x.type === 'skillProc').length, 1, 'no re-proc while still low');
    r.advance(2000);
    assert.equal(r.p.hasStatus('guardian_instinct'), false, 'lasted 5 s');
    r.advance(24_999); // 29.999 s after the proc
    r.p.hp = max * 0.2;
    hit();
    assert.equal(r.log.filter((x) => x.type === 'skillProc').length, 1);
    r.advance(1);
    r.p.hp = max * 0.2;
    hit();
    assert.equal(r.log.filter((x) => x.type === 'skillProc').length, 2, 'a new hit after the cooldown triggers again');
  });

  test('Battle Instinct: 3 hits within 5 s → +8 crit points and +10% Physical damage for 6 s; misses and timeouts do not count', () => {
    const r = rig({ level: 40 });
    r.learn('sword_mastery', 10);
    r.learn('whirlwind', 5);
    r.learn('battle_instinct');
    const dodgy = monster('dodgy', 30, 0, { evasion: 0.5 });
    const swing = (target: CombatEntity = r.monsters[0], roll = 0) => {
      r.rolls.push(roll, 0.99);
      r.combat.dealDamage(r.player, target, 'basic_attack', 1);
    };
    const crit = r.p.stats.critChance;
    swing(); // t=0
    swing(dodgy, 0.99); // miss: doesn't count
    r.advance(1000);
    swing(); // t=1000: 2 hits
    r.advance(4500);
    swing(); // t=5500: the t=0 hit timed out → still 2
    r.advance(1000);
    swing(); // t=6500: the t=1000 hit timed out → still 2
    assert.equal(r.p.hasStatus('battle_instinct'), false);
    r.advance(500);
    swing(); // t=7000: 5500, 6500, 7000
    assert.equal(r.p.hasStatus('battle_instinct'), true, 'three hits inside 5 s');
    assert.ok(Math.abs(r.p.stats.critChance - crit - 0.08) < 1e-9);
    assert.equal(r.p.stats.physicalDamageBonus, 0.1);
    const before = r.p.statuses.length;
    swing(); swing(); swing(); // another streak refreshes, never stacks
    assert.equal(r.p.statuses.length, before);
    r.advance(6000);
    assert.equal(r.p.hasStatus('battle_instinct'), false);
  });

  test('+10% Physical damage applies to the damage dealt', () => {
    const r = rig({ level: 40 });
    r.learn('sword_mastery', 10);
    r.learn('whirlwind', 5);
    r.learn('battle_instinct');
    r.rolls.push(0, 0.99);
    r.combat.dealDamage(r.player, r.monsters[0], 'basic_attack', 1);
    const plain = r.log.filter((x) => x.type === 'damage').at(-1)!.e.amount as number;
    r.statuses.apply(r.player, 'battle_instinct', 6000, r.now());
    r.rolls.push(0, 0.99);
    r.combat.dealDamage(r.player, r.monsters[0], 'basic_attack', 1);
    const boosted = r.log.filter((x) => x.type === 'damage').at(-1)!.e.amount as number;
    assert.equal(boosted, Math.round(plain * 1.1));
  });
});

describe('reset', () => {
  test('free reset: all SP back, ranks 0, passives and tree buffs/procs gone; job, level, allocation untouched; repeatable', () => {
    const r = rig({ level: 40 });
    allocateStat(r.t, 'str', 5);
    const statsBefore = { ...r.p.stats };
    const allocated = { ...r.t.progress.allocated };
    r.learn('heavy_armor_mastery', 10);
    r.learn('iron_guard');
    r.learn('sword_mastery', 10);
    r.learn('berserk');
    r.cast('iron_guard', null);
    r.cast('berserk', null);
    assert.notDeepEqual(r.p.stats, statsBefore);

    assert.equal(r.tree.reset(), 22);
    assert.deepEqual(r.t.progress.skillRanks, {});
    assert.deepEqual(r.tree.points(), { earned: 30, spent: 0, available: 30 });
    assert.equal(r.p.hasStatus('iron_guard') || r.p.hasStatus('berserk'), false);
    assert.deepEqual(r.p.stats, statsBefore);
    assert.equal(r.t.progress.classId, 'warrior');
    assert.equal(r.p.level, 40);
    assert.deepEqual(r.t.progress.allocated, allocated);
    assert.equal(r.tree.reset(), 0, 'a second reset refunds nothing');
    assert.deepEqual(r.tree.points(), { earned: 30, spent: 0, available: 30 });
    assert.deepEqual(r.cast('iron_guard', null), { ok: false, reason: 'not_learned' });
  });
});

describe('save / load', () => {
  const reload = (r: ReturnType<typeof rig>, times = 1) => {
    let text = serializePlayerSave(capturePlayerSave(r.t));
    let l = rig({ level: 1, job: 'novice' });
    for (let i = 0; i < times; i++) {
      l = rig({ level: 1, job: 'novice' });
      applyPlayerSave(l.t, deserializePlayerSave(text));
      text = serializePlayerSave(capturePlayerSave(l.t));
    }
    return l;
  };

  test('ranks persist; points restore; passives apply exactly once, however many times it is loaded', () => {
    const r = rig({ level: 30 });
    r.learn('power_slash', 5);
    r.learn('heavy_armor_mastery', 10);
    r.learn('sword_mastery', 4);
    const l = reload(r, 3);
    assert.deepEqual(l.t.progress.skillRanks, r.t.progress.skillRanks);
    assert.deepEqual(l.tree.points(), r.tree.points());
    assert.deepEqual(l.p.stats, r.p.stats);
    assert.equal(l.t.progress.modifiers().filter((m) => m.source === 'skill').length, 2);
  });

  test('a v4 save from before skill trees loads with every rank at 0 and keeps everything else', () => {
    const r = rig({ level: 15 });
    const save = capturePlayerSave(r.t);
    const { skillRanks: _r, ...older } = save;
    void _r;
    const loaded = deserializePlayerSave(JSON.stringify({ ...older, skillPointsSpent: 4 })); // a dev save that had "spent" points
    assert.deepEqual(loaded.skillRanks, {});
    assert.equal(loaded.skillPointsSpent, 0);
    assert.equal(loaded.classId, 'warrior');
    assert.equal(loaded.level, 15);
  });

  test('impossible ranks are rejected: above max, gate not reachable, over the earned total, wrong job', () => {
    const r = rig({ level: 20 });
    const good = capturePlayerSave(r.t);
    const bad = (ranks: Record<string, number>, classId = good.classId) => () =>
      deserializePlayerSave(JSON.stringify({ ...good, classId, skillRanks: ranks, skillPointsSpent: Object.values(ranks).reduce((a, b) => a + b, 0) }));
    assert.throws(bad({ power_slash: 6 }), /outside 0..5/);
    assert.throws(bad({ heavy_armor_mastery: 4, provoke: 1 }), /provoke could not have been learned/);
    assert.throws(bad({ heavy_armor_mastery: 9, iron_guard: 1 }), /iron_guard could not have been learned/);
    assert.throws(bad({ sword_mastery: 10, power_slash: 1 }), /more skill points/);
    assert.throws(bad({ nope: 1 }), /unknown skill/);
    assert.doesNotThrow(bad({ heavy_armor_mastery: 5, provoke: 1 }));
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CombatantState } from '../../src/combat/CombatantState';
import { CombatSystem } from '../../src/combat/CombatSystem';
import { ProjectileSystem } from '../../src/combat/ProjectileSystem';
import { SkillSystem } from '../../src/combat/SkillSystem';
import { StatusSystem } from '../../src/combat/StatusSystem';
import { applyStatusModifiers } from '../../src/combat/stats';
import type { CombatEntity, CombatStats } from '../../src/combat/types';
import { FixedServerDay } from '../../src/core/serverDay';
import { JOBS } from '../../src/data/jobData';
import { MAGE_ART } from '../../src/data/characterArt';
import { presentationFor } from '../../src/data/demoConfig';
import { SKILLS, type SkillId } from '../../src/data/skillData';
import { PASSIVE_ICONS, SKILL_ICONS } from '../../src/data/skillIcons';
import { MAGE_C1_TREE } from '../../src/data/skillTrees/mageTree';
import { SKILL_VFX } from '../../src/data/skillVfx';
import { VFX_ART } from '../../src/data/vfxArt';
import { cumulativeExp } from '../../src/progression/expCurve';
import { allocateStat } from '../../src/progression/statActions';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { SkillTree } from '../../src/skills/SkillTree';
import { basicAttackFor, rankProblem, treeForJob } from '../../src/skills/skillTreeRules';
import { classBaseStats } from '../../src/stats/classBaseStats';
import { makeSaveTarget } from './fixtures';

const TILE = 32;
type Mob = CombatEntity & { x: number; y: number };

/** A monster whose stats apply its statuses like the game's monsters (Slow included). */
function monster(id: string, x: number, y: number, over: Partial<CombatStats> = {}): Mob {
  const stats: CombatStats = {
    maxHp: 100_000, maxMp: 0, attack: 50, magicAttack: 0, defense: 0, magicDefense: 10, accuracy: 0, evasion: 0,
    attackSpeed: 0, critChance: 0, critMultiplier: 1.5, castTime: 0, healPower: 0, moveSpeed: 100, mpRegen: 0,
    damageReduction: 0, skillDamageBonus: {}, skillCooldownReduction: {}, ...over,
  };
  return { id, x, y, hitRadius: 12, combat: new CombatantState(id, id, 'monster', (_lv, st) => applyStatusModifiers(stats, st)) };
}

/** A Mage wired like the game: the real SkillTree resolving the player's skills, statuses with DoT, projectiles. */
function rig({ level = 20, job = 'mage' } = {}) {
  const t = makeSaveTarget(level, undefined, new FixedServerDay(21));
  if (job !== 'novice') t.jobChange.select(job, { skipTrial: true });
  const player = Object.assign(t.player, { x: 0, y: 0 });
  const monsters = [monster('m1', 100, 0), monster('m2', 130, 0), monster('m3', 0, 100), monster('far', 600, 0)];
  let now = 0;
  const combat = new CombatSystem(t.events);
  combat.rng = () => 0.5; // always hits, never crits (crit chance < 0.5)
  const statuses = new StatusSystem(t.events, combat);
  const projectiles = new ProjectileSystem(t.events, combat, statuses);
  const tree = new SkillTree(player, t.features, t.events);
  const entities = () => [player, ...monsters];
  const skills = new SkillSystem(t.events, combat, statuses, projectiles, {
    resolve: (caster, id) => (caster === player ? tree.resolve(id) : SKILLS[id]),
    entities,
  });
  const walls = { blocked: (_x: number, _y: number) => false };
  const log: { type: string; e: Record<string, unknown> }[] = [];
  for (const type of ['damage', 'miss', 'death', 'skillWindup', 'areaLanded', 'zoneStarted', 'zoneTick', 'zoneEnded', 'projectileRemoved', 'statusApplied', 'statusExpired'] as const) {
    t.events.on(type, (e) => log.push({ type, e: e as Record<string, unknown> }));
  }
  /** One simulation step in the game's order (skills, projectiles, statuses). */
  const step = (ms: number) => {
    now += ms;
    combat.now = now;
    skills.update(now);
    projectiles.update(ms, entities(), { blocksProjectile: (x, y) => walls.blocked(x, y) });
    statuses.update(entities(), now);
  };
  const advance = (ms: number, frame = 16) => {
    for (let left = ms; left > 0; left -= frame) step(Math.min(frame, left));
  };
  const learn = (id: string, times = 1) => {
    for (let i = 0; i < times; i++) assert.equal(tree.learn(id).ok, true, `learn ${id} #${i + 1}`);
  };
  const cast = (skillId: SkillId, target: CombatEntity | null = monsters[0]) => {
    combat.now = now;
    return skills.use(player, skillId, now, { target, quiet: true });
  };
  const damage = (skill?: string) => log.filter((l) => l.type === 'damage' && (!skill || l.e.skillId === skill)).map((l) => l.e);
  return { t, player, p: player.combat, monsters, tree, skills, statuses, projectiles, combat, walls, log, learn, cast, advance, step, damage, now: () => now };
}

const levelTo = (r: ReturnType<typeof rig>, level: number) => r.t.progression.grantExp(r.player, cumulativeExp(level) - cumulativeExp(r.p.level));
/** Expected magic hit: MATK x power x 100 / (100 + MDEF), rounded (no crit, no reduction). */
const magic = (matk: number, power: number, mdef = 10) => Math.max(1, Math.round((matk * power * 100) / (100 + mdef)));
const node = (id: string) => MAGE_C1_TREE.nodes.find((n) => n.id === id)!;

describe('Mage class registration', () => {
  test('mage_c1 is registered, makes the Mage selectable, and keeps the job identity and growth', () => {
    assert.equal(treeForJob('mage'), MAGE_C1_TREE);
    assert.equal(JOBS.mage.skillTreeId, 'mage_c1');
    assert.deepEqual(JOBS.mage.jobBonus, { int: 3, dex: 2 });
    const b = classBaseStats('mage', 11);
    assert.deepEqual([b.hp, b.mp, b.matk, b.def, b.mdef], [420, 300, 85, 12, 25]);
    const r = rig({ level: 11, job: 'novice' });
    assert.deepEqual(r.t.jobChange.select('mage', { skipTrial: true }), { ok: true, jobId: 'mage' });
    assert.equal(r.t.progress.classId, 'mage');
    assert.equal(presentationFor('mage').temporaryKit, false);
    assert.equal(presentationFor('mage').art, MAGE_ART);
  });

  test('tree shape: 39 ranks for 30 SP; exactly the five actives and three passives; every gate reachable', () => {
    const ranks = MAGE_C1_TREE.nodes.reduce((s, n) => s + n.maxRank, 0);
    assert.equal(ranks, 39);
    assert.ok(ranks > 30);
    assert.deepEqual(MAGE_C1_TREE.nodes.filter((n) => n.type === 'active').map((n) => n.combatSkillId), ['fireball', 'flame_burst', 'meteor_burst', 'frost_nova', 'frost_storm']);
    assert.deepEqual(MAGE_C1_TREE.nodes.filter((n) => n.type === 'passive').map((n) => n.id), ['arcane_power', 'mana_flow', 'elemental_mastery']);
    // A full Fire build and a full Frost build are legal within 30 SP.
    assert.equal(rankProblem(MAGE_C1_TREE, { fireball: 5, flame_burst: 3, meteor_burst: 3, arcane_power: 10, elemental_mastery: 5, mana_flow: 4 }, 30), null);
    assert.equal(rankProblem(MAGE_C1_TREE, { frost_nova: 3, frost_storm: 3, fireball: 1 }, 30), null);
    assert.notEqual(rankProblem(MAGE_C1_TREE, { meteor_burst: 1 }, 30), null, 'Meteor needs 8 Fire SP');
    assert.notEqual(rankProblem(MAGE_C1_TREE, { frost_storm: 1 }, 30), null, 'Storm needs Frost Nova maxed');
  });

  test('every Mage skill has its icon and presentation strip registered', () => {
    for (const id of ['magic_bolt', 'fireball', 'flame_burst', 'frost_nova', 'frost_storm', 'meteor_burst'] as const) assert.ok(SKILL_ICONS[id], id);
    for (const id of ['arcane_power', 'mana_flow', 'elemental_mastery']) assert.ok(PASSIVE_ICONS[id], id);
    for (const v of Object.values(SKILL_VFX)) for (const part of [v.projectile, v.impact, v.area, v.zone, v.fall]) if (part) assert.ok(VFX_ART[part.vfx], part.vfx);
    assert.deepEqual(MAGE_ART.skillActions.magic_bolt, 'attack');
    for (const id of ['fireball', 'flame_burst', 'frost_nova', 'frost_storm', 'meteor_burst'] as const) assert.equal(MAGE_ART.skillActions[id], 'cast');
    for (const dir of ['down', 'up', 'right'] as const) {
      const cast = MAGE_ART.actions.cast[dir]!;
      assert.equal(cast.frames, 8);
      assert.equal((cast.hitFrame * 1000) / cast.frameRate, 312.5, 'release on frame 5 at 16 fps');
      assert.equal(cast.visibleHeight, MAGE_ART.actions.attack[dir]!.visibleHeight, 'one render scale for every strip');
    }
  });
});

describe('Magic Bolt (Mage basic attack)', () => {
  test('the Mage basic attack is Magic Bolt; the melee Attack is not castable; Warrior keeps the melee one', () => {
    const r = rig();
    assert.equal(basicAttackFor('mage'), 'magic_bolt');
    assert.equal(r.tree.basicAttack(), 'magic_bolt');
    assert.equal(r.tree.resolve('basic_attack'), null, 'no melee fallback');
    assert.equal(r.tree.resolve('magic_bolt'), SKILLS.magic_bolt);
    assert.equal(basicAttackFor('warrior'), 'basic_attack');
    assert.equal(basicAttackFor('novice'), 'basic_attack');
    const w = rig({ job: 'warrior' });
    assert.equal(w.tree.resolve('magic_bolt'), null);
    assert.equal(w.tree.resolve('basic_attack'), SKILLS.basic_attack);
  });

  test('ranged projectile: no MP, released on the attack frame, MATK damage, ASPD-scaled 600 ms cadence', () => {
    const r = rig();
    const mp = r.p.mp;
    assert.deepEqual(r.cast('magic_bolt'), { ok: true });
    assert.equal(r.p.mp, mp, 'no MP cost');
    assert.equal(r.projectiles.active.length, 0, 'not before the release frame');
    r.advance(240);
    assert.equal(r.projectiles.active.length, 0);
    r.advance(20);
    assert.equal(r.projectiles.active.length, 1, 'released at 250 ms');
    r.advance(600);
    assert.deepEqual(r.damage('magic_bolt').map((d) => [d.targetId, d.amount]), [['m1', magic(r.p.stats.magicAttack, 1)]]);
    assert.equal(r.skills.cooldownDuration(r.player, 'magic_bolt'), 600 / (1 + r.p.stats.attackSpeed));
  });

  test('range 7 tiles: a target beyond it is refused; no target is refused (never a melee swing)', () => {
    const r = rig();
    assert.equal(SKILLS.magic_bolt.range, 7 * TILE);
    assert.deepEqual(r.cast('magic_bolt', r.monsters[3]), { ok: false, reason: 'out_of_range' });
    assert.deepEqual(r.cast('magic_bolt', null), { ok: false, reason: 'no_target' });
  });

  test('walls stop it: no damage', () => {
    const r = rig();
    r.walls.blocked = (x) => x > 50;
    r.cast('magic_bolt');
    r.advance(900);
    assert.equal(r.damage().length, 0);
    assert.equal(r.log.find((l) => l.type === 'projectileRemoved')?.e.reason, 'wall');
  });

  test('homing: it follows a target that walks off its line', () => {
    const r = rig();
    r.cast('magic_bolt');
    r.advance(260);
    r.monsters[0].y = 40; // stepped aside after the release
    r.advance(800);
    assert.equal(r.damage('magic_bolt').length, 1);
  });
});

describe('Fireball', () => {
  test('rank power and MP; primary hit plus 50% splash on every other enemy near the impact, once each', () => {
    const r = rig();
    r.learn('fireball');
    const mp = r.p.mp;
    r.cast('fireball');
    assert.equal(mp - r.p.mp, 10);
    r.advance(1200);
    const matk = r.p.stats.magicAttack;
    const hits = r.damage('fireball');
    assert.deepEqual(hits.map((h) => [h.targetId, h.amount, h.delivery ?? 'direct']), [
      ['m1', magic(matk, 1.6), 'direct'],
      ['m2', magic(matk, 0.8), 'splash'],
    ]);
    assert.ok(!hits.some((h) => h.targetId === 'm3' || h.targetId === 'far'), 'outside the 1.25-tile splash');
  });

  test('a splash kill is credited to the Mage', () => {
    const r = rig();
    r.learn('fireball');
    r.monsters[1].combat.hp = 1;
    r.cast('fireball');
    r.advance(1200);
    assert.deepEqual(r.log.filter((l) => l.type === 'death').map((l) => l.e), [{ entityId: 'm2', killerId: 'p' }]);
  });
});

describe('Flame Burst and Burn', () => {
  test('area at the target point; Burn ticks every 1 s for 4 s (4 ticks), deterministic and credited to the Mage', () => {
    const r = rig();
    r.learn('fireball');
    r.learn('flame_burst');
    r.cast('flame_burst');
    r.advance(312);
    const matk = r.p.stats.magicAttack;
    const area = r.damage('flame_burst').filter((d) => d.delivery === 'area');
    assert.deepEqual(area.map((d) => [d.targetId, d.amount]), [['m1', magic(matk, 1.5)], ['m2', magic(matk, 1.5)]]);
    const landed = r.log.find((l) => l.type === 'areaLanded')!.e;
    assert.deepEqual([landed.x, landed.y, landed.radius], [100, 0, 2 * TILE]);
    // Irregular frames: exactly 4 ticks per burning monster, at 1, 2, 3 and 4 s after the hit.
    for (const ms of [333, 17, 650, 1000, 999, 1, 1200, 800]) r.advance(ms, ms);
    const ticks = r.damage('flame_burst').filter((d) => d.delivery === 'dot');
    assert.equal(ticks.length, 8, '4 ticks x 2 monsters');
    for (const tick of ticks) assert.equal(tick.amount, magic(matk, 0.15));
    assert.equal(r.monsters[0].combat.statuses.length, 0, 'Burn expired');
  });

  test('a Burn tick kill goes through the normal kill path once', () => {
    const r = rig();
    r.learn('fireball');
    r.learn('flame_burst');
    r.cast('flame_burst');
    r.advance(312);
    r.monsters[0].combat.hp = 1;
    r.advance(1000);
    const deaths = r.log.filter((l) => l.type === 'death').map((l) => l.e);
    assert.deepEqual(deaths, [{ entityId: 'm1', killerId: 'p' }]);
    r.advance(4000);
    assert.equal(r.log.filter((l) => l.type === 'death').length, 1, 'no further ticks on a dead monster');
  });
});

describe('Frost Nova and Slow', () => {
  test('caster-centred: hits nearby enemies, Slows them -40% for 3 s, then movement is restored', () => {
    const r = rig();
    r.learn('frost_nova');
    r.monsters[0].x = 60;
    r.cast('frost_nova', null);
    r.advance(312);
    const hit = r.damage('frost_nova').map((d) => d.targetId).sort();
    assert.deepEqual(hit, ['m1'], 'only m1 is within 2.5 tiles of the Mage (m3 is 88 px from its edge)');
    assert.equal(r.monsters[0].combat.stats.moveSpeed, 60);
    assert.equal(r.monsters[1].combat.stats.moveSpeed, 100, 'outside: untouched');
    r.advance(2990);
    assert.equal(r.monsters[0].combat.stats.moveSpeed, 60);
    r.advance(30);
    assert.equal(r.monsters[0].combat.stats.moveSpeed, 100);
  });

  test('Slow changes movement only (attack, defence and wind-up timing untouched); Slows never stack', () => {
    const r = rig();
    const m = r.monsters[0];
    const before = { ...m.combat.stats };
    r.statuses.apply(m, 'slowed', 3000, 0);
    r.statuses.apply(m, 'chilled', 3000, 0);
    assert.equal(m.combat.stats.moveSpeed, 60, 'strongest wins');
    assert.deepEqual({ ...m.combat.stats, moveSpeed: 0 }, { ...before, moveSpeed: 0 });
  });
});

describe('Frost Storm', () => {
  test('a lingering zone at the target point: exactly 10 ticks over 5 s however frames fall; Slow while inside', () => {
    const r = rig();
    r.learn('frost_nova', 3);
    r.learn('frost_storm');
    r.cast('frost_storm');
    r.advance(312);
    assert.equal(r.skills.zones.active.length, 1);
    const z = r.skills.zones.active[0];
    assert.deepEqual([z.x, z.y, z.radius, z.ticks], [100, 0, 2.5 * TILE, 10]);
    for (const ms of [7, 493, 1, 1499, 250, 250, 2000, 1000]) r.advance(ms, ms);
    const ticks = r.log.filter((l) => l.type === 'zoneTick').map((l) => l.e.tick);
    assert.deepEqual(ticks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(r.skills.zones.active.length, 0);
    assert.equal(r.log.filter((l) => l.type === 'zoneEnded').length, 1);
    const m1 = r.damage('frost_storm').filter((d) => d.targetId === 'm1');
    assert.equal(m1.length, 10, 'one hit per tick, no duplicates');
    assert.equal(m1[0].amount, magic(r.p.stats.magicAttack, 0.35));
  });

  test('who is inside is decided per tick from real positions; Slow ends soon after leaving', () => {
    const r = rig();
    r.learn('frost_nova', 3);
    r.learn('frost_storm');
    r.cast('frost_storm');
    r.advance(1328); // released on the 320 ms frame: ticks at 820 and 1320
    r.monsters[0].x = 400; // walks out
    r.advance(1000);
    assert.equal(r.damage('frost_storm').filter((d) => d.targetId === 'm1').length, 2);
    assert.equal(r.monsters[0].combat.stats.moveSpeed, 100, 'Chill (0.7 s) lapsed after leaving');
    assert.equal(r.monsters[1].combat.stats.moveSpeed, 70, 'still inside: -30%');
  });

  test('a zone kill is credited to the Mage once; a dead caster ends the zone; clear() ends it', () => {
    const r = rig();
    r.learn('frost_nova', 3);
    r.learn('frost_storm');
    r.monsters[0].combat.hp = 1;
    r.cast('frost_storm');
    r.advance(900);
    assert.deepEqual(r.log.filter((l) => l.type === 'death').map((l) => l.e), [{ entityId: 'm1', killerId: 'p' }]);
    r.p.dead = true;
    r.advance(16);
    assert.equal(r.skills.zones.active.length, 0);
    r.p.dead = false;
    r.p.cooldowns.clear();
    r.cast('frost_storm');
    r.advance(400);
    r.skills.clear();
    assert.equal(r.skills.zones.active.length, 0);
  });
});

describe('Meteor Burst', () => {
  test('friendly warning at the target point; lands once after 800 ms; moving does not cancel; walking out avoids it', () => {
    const r = rig({ level: 20 });
    r.learn('fireball', 5);
    r.learn('flame_burst', 3);
    r.learn('meteor_burst');
    const mp = r.p.mp;
    assert.deepEqual(r.cast('meteor_burst'), { ok: true });
    assert.equal(mp - r.p.mp, 60);
    const windup = r.log.find((l) => l.type === 'skillWindup')!.e;
    assert.deepEqual([windup.x, windup.y, windup.radius, windup.ms], [100, 0, 3 * TILE, 800]);
    assert.equal(SKILLS.meteor_burst.friendlyTelegraph, true);
    r.skills.interruptMovement(r.player); // the Mage walks during the warning
    r.player.x = -50;
    r.monsters[1].x = 300; // m2 walks out of the marked ground
    r.advance(784);
    assert.equal(r.damage('meteor_burst').length, 0);
    r.advance(32);
    const hits = r.damage('meteor_burst');
    assert.deepEqual(hits.map((h) => h.targetId), ['m1'], 'only m1 is still inside (m2 walked out; m3 is 141 px away)');
    assert.equal(hits[0].amount, magic(r.p.stats.magicAttack, 4.0));
    r.advance(3000);
    assert.equal(r.damage('meteor_burst').length, hits.length, 'no repeated impact');
    assert.equal(r.log.filter((l) => l.type === 'areaLanded').length, 1);
  });
});

describe('Mage passives', () => {
  test('Arcane Power: MATK +1.5% per rank', () => {
    const r = rig({ level: 30 });
    const base = r.p.stats.magicAttack;
    r.learn('arcane_power', 10);
    assert.ok(Math.abs(r.p.stats.magicAttack - base * 1.15) <= 1, `${r.p.stats.magicAttack} vs ${base} x 1.15`);
  });

  test('Mana Flow: Max MP +4% per rank and skill MP cost -2% per rank (rounded, never below 0)', () => {
    const r = rig({ level: 30 });
    r.learn('fireball');
    r.learn('flame_burst');
    const base = r.p.stats.maxMp;
    r.learn('mana_flow', 5);
    assert.ok(Math.abs(r.p.stats.maxMp - base * 1.2) <= 1, `${r.p.stats.maxMp} vs ${base} x 1.2`);
    assert.ok(Math.abs(r.p.stats.mpCostReduction! - 0.1) < 1e-9);
    assert.equal(r.skills.mpCost(r.player, r.tree.resolve('flame_burst')!), 20, '22 x 0.9 = 19.8');
    assert.equal(r.skills.mpCost(r.player, SKILLS.magic_bolt), 0);
    const mp = r.p.mp;
    r.cast('flame_burst');
    assert.equal(mp - r.p.mp, 20, 'the reduced cost is what is paid');
    // A runaway reduction is capped; the cost stays a whole number >= 0.
    (r.p.stats as { mpCostReduction?: number }).mpCostReduction = 5;
    for (const id of ['fireball', 'flame_burst'] as const) {
      const cost = r.skills.mpCost(r.player, r.tree.resolve(id)!);
      assert.ok(Number.isInteger(cost) && cost >= 0, `${id}: ${cost}`);
    }
  });

  test('Elemental Mastery: +3% per rank on Fire and Frost skills (Burn included), never on untagged Magic Bolt', () => {
    const r = rig({ level: 30 });
    r.learn('arcane_power', 5);
    r.learn('fireball');
    r.learn('elemental_mastery', 5);
    const bonus = r.p.stats.elementDamageBonus!;
    assert.ok(Math.abs(bonus.fire - 0.15) < 1e-9 && Math.abs(bonus.frost - 0.15) < 1e-9, JSON.stringify(bonus));
    r.cast('fireball');
    r.advance(1200);
    const matk = r.p.stats.magicAttack;
    assert.equal(r.damage('fireball')[0].amount, magic(matk, 1.6 * (1 + bonus.fire)));
    r.p.cooldowns.clear();
    r.cast('magic_bolt');
    r.advance(1200);
    assert.equal(r.damage('magic_bolt')[0].amount, magic(matk, 1));
  });
});

describe('Mage hotbar and save', () => {
  test('learned actives auto-fill the bar; Magic Bolt never takes a slot; ranks, passives, hotbar and stats survive a reload', () => {
    const r = rig({ level: 30 });
    allocateStat(r.t, 'int', 3);
    r.learn('fireball', 5);
    r.learn('flame_burst', 3);
    r.learn('frost_nova', 3);
    r.learn('frost_storm');
    r.learn('meteor_burst');
    r.learn('arcane_power', 4);
    r.learn('mana_flow', 2);
    const bar = r.tree.loadout();
    assert.deepEqual(Object.values(bar), ['fireball', 'flame_burst', 'frost_nova', 'frost_storm', 'meteor_burst'], 'in learn order');
    r.tree.assign('skill1', 'frost_storm');
    const text = serializePlayerSave(capturePlayerSave(r.t));
    const l = rig({ level: 1, job: 'novice' });
    applyPlayerSave(l.t, deserializePlayerSave(text));
    assert.equal(l.t.progress.classId, 'mage');
    assert.deepEqual(l.t.progress.skillRanks, r.t.progress.skillRanks);
    assert.deepEqual(l.tree.loadout(), r.tree.loadout());
    assert.equal(l.tree.loadout().skill1, 'frost_storm');
    assert.deepEqual(l.t.progress.allocated, r.t.progress.allocated);
    assert.deepEqual(l.p.stats, r.p.stats);
    assert.equal(l.tree.basicAttack(), 'magic_bolt');
  });
});

describe('Warrior unchanged', () => {
  test('Whirlwind and the melee Attack: same damage, no delivery change in numbers, no element bonus, full MP cost', () => {
    const r = rig({ job: 'warrior', level: 20 });
    r.monsters[0].x = 30;
    r.learn('whirlwind');
    const atk = r.p.stats.attack;
    const mp = r.p.mp;
    r.cast('whirlwind', null);
    assert.equal(mp - r.p.mp, 14);
    const ww = r.damage('whirlwind');
    assert.deepEqual(ww.map((d) => d.targetId), ['m1']);
    assert.equal(ww[0].amount, Math.max(1, Math.round((atk * 1.4 * 100) / 100)));
    r.cast('basic_attack');
    assert.equal(r.damage('basic_attack')[0].amount, Math.max(1, Math.round(atk)));
    assert.equal(r.p.stats.mpCostReduction, 0);
    assert.deepEqual(r.p.stats.elementDamageBonus, {});
  });
});

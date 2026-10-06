import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MonsterBrain, type MonsterAgent, type MonsterWorld } from '../../src/ai/MonsterBrain';
import { CombatantState } from '../../src/combat/CombatantState';
import { CombatSystem } from '../../src/combat/CombatSystem';
import { ProjectileSystem } from '../../src/combat/ProjectileSystem';
import { SkillSystem } from '../../src/combat/SkillSystem';
import { applyStatusModifiers } from '../../src/combat/stats';
import { StatusSystem } from '../../src/combat/StatusSystem';
import type { CombatEntity } from '../../src/combat/types';
import { EventBus } from '../../src/core/EventBus';
import { seededRng } from '../../src/core/rng';
import { FIELD_ENERGY } from '../../src/data/energyData';
import { LOOT_TABLES } from '../../src/data/itemData';
import { CRYPT_MAP_ID, FIELD_MAP_ID, MAPS } from '../../src/data/maps';
import { monsterCombatStats, MONSTERS, type MonsterDef } from '../../src/data/monsterData';
import { SKILLS } from '../../src/data/skillData';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { ITEM_STAT_LAYERS, itemModifier, itemModifierFrom, type ItemStatLayer } from '../../src/equipment/equipment';
import type { GameEvents } from '../../src/game/GameEvents';
import { grantKillRewards } from '../../src/game/killRewards';
import { LootSystem } from '../../src/loot/LootSystem';
import { spawnPlan } from '../../src/world/mapRules';
import { makeSaveTarget } from './fixtures';

/** A monster body without an engine: moves instantly toward where the brain asks. */
class FakeMonster implements MonsterAgent {
  x: number;
  y: number;
  readonly hitRadius: number;
  readonly combat: CombatantState;
  moved = 0;
  constructor(
    readonly id: string,
    readonly def: MonsterDef,
    public spawnX = 0,
    public spawnY = 0,
  ) {
    this.x = spawnX;
    this.y = spawnY;
    this.hitRadius = def.hitRadius;
    const base = monsterCombatStats(def.stats);
    this.combat = new CombatantState(id, def.name, 'monster', (_lv, st) => applyStatusModifiers(base, st), def.level);
  }
  moveToward(x: number, y: number): void {
    const d = Math.hypot(x - this.x, y - this.y);
    const step = Math.min(d, 10);
    if (d > 0) {
      this.x += ((x - this.x) / d) * step;
      this.y += ((y - this.y) / d) * step;
      this.moved += step;
    }
  }
  halt(): void {}
  snapToSpawn(): void {
    this.x = this.spawnX;
    this.y = this.spawnY;
  }
  respawn(): void {
    this.combat.reset();
    this.snapToSpawn();
  }
  applySeparation(): void {}
}

function playerEntity(x = 0, y = 0): CombatEntity {
  const stats = { ...monsterCombatStats(MONSTERS.slime.stats), maxHp: 1000, defense: 0 };
  return { id: 'player', x, y, hitRadius: 10, combat: new CombatantState('player', 'P', 'player', () => ({ ...stats })) };
}

/** Real skill / status / combat systems over fake entities; rolls fixed (always hit, no crit). */
function arena() {
  const events = new EventBus<GameEvents>();
  const combat = new CombatSystem(events);
  combat.rng = () => 0.5;
  const statuses = new StatusSystem(events);
  const entities: CombatEntity[] = [];
  const skills = new SkillSystem(events, combat, statuses, new ProjectileSystem(events, combat), { entities: () => entities });
  const log: { type: string; [k: string]: unknown }[] = [];
  events.on('skillWindup', (e) => log.push({ type: 'windup', ...e }));
  events.on('damage', (e) => log.push({ type: 'damage', ...e }));
  events.on('hitCancelled', (e) => log.push({ type: 'cancelled', ...e }));
  return { events, skills, statuses, entities, log };
}

describe('elite / boss telegraphed attacks', () => {
  test('a single-target wind-up is announced, roots the caster, lands on time; stepping out of reach makes it miss', () => {
    const a = arena();
    const boar = new FakeMonster('boar', MONSTERS.elite_boar);
    const p = playerEntity(30, 0);
    a.entities.push(boar, p);
    assert.ok(a.skills.use(boar, 'boar_gore', 0, { target: p }).ok);
    assert.deepEqual(a.log[0], { type: 'windup', casterId: 'boar', skillId: 'boar_gore', targetId: 'player', radius: null, ms: SKILLS.boar_gore.windup!.ms });
    assert.equal(a.skills.windingUp(boar), true);
    a.skills.update(SKILLS.boar_gore.windup!.ms - 1);
    assert.equal(a.log.filter((e) => e.type === 'damage').length, 0, 'nothing before the wind-up ends');
    a.skills.update(SKILLS.boar_gore.windup!.ms);
    assert.equal(a.log.filter((e) => e.type === 'damage').length, 1);
    assert.equal(a.skills.windingUp(boar), false);

    // Dodge: walk out of reach during the wind-up.
    a.skills.use(boar, 'boar_gore', 10_000, { target: p });
    p.x = 200;
    a.skills.update(10_000 + SKILLS.boar_gore.windup!.ms);
    assert.equal(a.log.filter((e) => e.type === 'damage').length, 1, 'no second hit');
    assert.ok(a.log.some((e) => e.type === 'cancelled' && e.reason === 'out_of_range'));
  });

  test('an area wind-up hits whoever is still inside its radius when it lands', () => {
    const a = arena();
    const lord = new FakeMonster('lord', MONSTERS.crypt_lord);
    const stay = playerEntity(40, 0);
    a.entities.push(lord, stay);
    assert.ok(a.skills.use(lord, 'crypt_slam', 0, { target: stay }).ok);
    const w = a.log.find((e) => e.type === 'windup');
    assert.equal(w?.radius, (SKILLS.crypt_slam.effect as { radius: number }).radius);
    a.skills.update(SKILLS.crypt_slam.windup!.ms);
    assert.equal(a.log.filter((e) => e.type === 'damage').length, 1, 'inside: hit');

    a.skills.use(lord, 'crypt_slam', 20_000, { target: stay });
    stay.x = 400; // escaped
    a.skills.update(20_000 + SKILLS.crypt_slam.windup!.ms);
    assert.equal(a.log.filter((e) => e.type === 'damage').length, 1, 'outside: no hit');
    assert.equal(a.skills.pendingCount(), 0);
  });

  test('a dead caster never lands its wind-up', () => {
    const a = arena();
    const lord = new FakeMonster('lord', MONSTERS.crypt_lord);
    const p = playerEntity(40, 0);
    a.entities.push(lord, p);
    a.skills.use(lord, 'crypt_slam', 0, { target: p });
    lord.combat.dead = true;
    a.skills.update(5000);
    assert.equal(a.log.filter((e) => e.type === 'damage').length, 0);
  });
});

describe('monster AI with encounters', () => {
  function brainRig(def: MonsterDef, world: Partial<MonsterWorld> = {}) {
    const m = new FakeMonster('m', def, 100, 100);
    const p = playerEntity(100 + 120, 100);
    const attacks: string[] = [];
    const w: MonsterWorld = {
      findAggroTarget: (mon) => (Math.hypot(p.x - mon.x, p.y - mon.y) <= mon.def.aggroRange ? p : null),
      tryAttack: () => attacks.push('attack'),
      ...world,
    };
    const brain = new MonsterBrain(m, w, 0);
    let now = 0;
    const tick = (n = 1) => {
      for (let i = 0; i < n; i++) brain.update((now += 16), 16);
    };
    return { m, p, brain, attacks, tick };
  }

  test('aggro → chase → attack, and leash → return home with HP restored', () => {
    const r = brainRig(MONSTERS.wolf);
    r.tick();
    assert.equal(r.brain.state, 'chase');
    r.tick(40);
    assert.equal(r.brain.state, 'attack');
    assert.ok(r.attacks.length > 0);
    r.m.combat.hp = 10;
    r.p.x = 100 + MONSTERS.wolf.leashRange + 200; // runs away past the leash
    r.tick(5);
    assert.equal(r.brain.state, 'return');
    r.tick(200);
    assert.equal(r.brain.state, 'idle');
    assert.deepEqual([r.m.x, r.m.y], [100, 100]);
    assert.equal(r.m.combat.hp, r.m.combat.stats.maxHp);
  });

  test('a monster mid wind-up holds still and makes no decisions', () => {
    let busy = true;
    const r = brainRig(MONSTERS.elite_boar, { busy: () => busy });
    r.tick(30);
    assert.equal(r.brain.state, 'idle');
    assert.equal(r.m.moved, 0);
    busy = false;
    r.tick(2);
    assert.equal(r.brain.state, 'chase');
  });

  test('a leash reset ends an enrage (the monster\'s own buffs) and refills HP', () => {
    const r = brainRig(MONSTERS.grove_guardian);
    const statuses = new StatusSystem(new EventBus<GameEvents>());
    r.tick();
    statuses.apply(r.m, 'enraged', 600_000, 0);
    const enragedAtk = r.m.combat.stats.attack;
    assert.ok(enragedAtk > monsterCombatStats(MONSTERS.grove_guardian.stats).attack);
    r.p.x = 5000;
    r.tick(400);
    assert.equal(r.brain.state, 'idle');
    assert.equal(r.m.combat.statuses.length, 0);
    assert.equal(r.m.combat.stats.attack, monsterCombatStats(MONSTERS.grove_guardian.stats).attack);
  });
});

describe('combat slice data', () => {
  const field = new Set(spawnPlan(MAPS[FIELD_MAP_ID]).map((s) => s.monsterId));
  const crypt = new Set(spawnPlan(MAPS[CRYPT_MAP_ID]).map((s) => s.monsterId));

  test('normal Field monsters: EXP, Gold and a real drop table', () => {
    for (const id of field) {
      const def = MONSTERS[id];
      assert.ok(def.expReward > 0 && (def.goldReward ?? 0) > 0, id);
      assert.ok(LOOT_TABLES[def.lootTable].length > 0, `${id} drops something`);
    }
  });

  test('one Field Elite and one Field Mini Boss with telegraphed signatures; the Dungeon boss enrages', () => {
    const elites = [...field].filter((id) => MONSTERS[id].tier === 'elite');
    const minis = [...field].filter((id) => MONSTERS[id].tier === 'mini_boss');
    assert.deepEqual(elites, ['elite_boar']);
    assert.deepEqual(minis, ['grove_guardian']);
    for (const id of [...elites, ...minis, 'crypt_lord'] as const) {
      const special = MONSTERS[id].specialSkill;
      assert.ok(special && SKILLS[special].windup, `${id} telegraphs`);
    }
    assert.ok(MONSTERS.grove_guardian.enrageBelow && MONSTERS.crypt_lord.enrageBelow);
    const bosses = [...crypt].filter((id) => MONSTERS[id].tier === 'dungeon_boss');
    assert.deepEqual(bosses, ['crypt_lord']);
  });

  test('Dungeon monsters keep the dungeon rule: no EXP, Gold or drops of their own', () => {
    for (const id of crypt) {
      const def = MONSTERS[id];
      assert.equal(def.expReward, 0, id);
      assert.equal(def.goldReward ?? 0, 0, id);
      assert.deepEqual(LOOT_TABLES[def.lootTable], [], id);
    }
  });
});

describe('kill rewards: EXP, Gold, drops', () => {
  function kill(monsterId: keyof typeof MONSTERS, zone: 'field' | 'dungeon', energy?: number) {
    const t = makeSaveTarget(30);
    if (energy !== undefined) t.fieldEnergy.set(energy);
    const events = new EventBus<GameEvents>();
    const gold: number[] = [];
    events.on('goldGained', (e) => gold.push(e.amount));
    const loot = new LootSystem(events, t.inventory);
    loot.rng = () => 0; // every chance succeeds
    const levelExp = () => t.combat.level * 1e6 + t.combat.exp;
    const before = levelExp();
    const def = MONSTERS[monsterId];
    grantKillRewards({ id: `${monsterId}-1`, x: 0, y: 0, def }, { zone, fieldEnergy: t.fieldEnergy, progression: t.progression, loot, player: t.player, now: 0, events, wallet: t.wallet });
    return { exp: levelExp() - before, gold: t.wallet.get('gold'), goldEvents: gold, drops: loot.drops.map((d) => d.itemId) };
  }

  test('a rewarded Field kill credits its Gold once, with EXP and drops', () => {
    const r = kill('wolf', 'field');
    assert.ok(r.exp > 0);
    assert.equal(r.gold, MONSTERS.wolf.goldReward);
    assert.deepEqual(r.goldEvents, [MONSTERS.wolf.goldReward]);
    assert.deepEqual(r.drops, ['wolf_fang']);
  });

  test('Elite and Mini Boss drops: guaranteed material plus progression materials', () => {
    assert.deepEqual(kill('elite_boar', 'field').drops.sort(), ['boar_tusk', 'enhancement_stone']);
    assert.deepEqual(kill('grove_guardian', 'field').drops.sort(), ['enchant_stone', 'enhancement_stone', 'guardian_bark']);
  });

  test('no Field Energy → no EXP, Gold or farming drops; dungeon kills → nothing', () => {
    assert.deepEqual(kill('mushroom', 'field', 0), { exp: 0, gold: 0, goldEvents: [], drops: [] });
    assert.deepEqual(kill('crypt_lord', 'dungeon'), { exp: 0, gold: 0, goldEvents: [], drops: [] });
    assert.equal(FIELD_ENERGY.costByTier.elite > FIELD_ENERGY.costByTier.normal, true);
  });
});

describe('equipment stat layers (Enhancement / Enchant today, Socket / Card later)', () => {
  const item = () => {
    const it = createEquipment('knight_sword', seededRng(3), sequentialIds('eq'));
    it.enhancement = 5;
    return it;
  };

  test('the item modifier is the sum of its layers: definition + enhancement + enchant', () => {
    assert.deepEqual(ITEM_STAT_LAYERS.map((l) => l.id), ['definition', 'enhancement', 'enchant']);
    assert.deepEqual(itemModifierFrom(item(), ITEM_STAT_LAYERS), itemModifier(item()));
  });

  test('a future layer (e.g. a socketed card) adds on top without changing the others', () => {
    const card: ItemStatLayer = { id: 'socket_card_test', contribute: () => ({ flat: { physicalAtk: 7 }, effects: { damageReduction: 0.02 } }) };
    const base = itemModifier(item());
    const withCard = itemModifierFrom(item(), [...ITEM_STAT_LAYERS, card]);
    assert.equal(withCard.flat!.physicalAtk, (base.flat!.physicalAtk ?? 0) + 7);
    assert.equal(withCard.effects!.damageReduction, (base.effects!.damageReduction ?? 0) + 0.02);
    assert.deepEqual({ ...withCard.flat, physicalAtk: base.flat!.physicalAtk }, { ...base.flat, physicalAtk: base.flat!.physicalAtk });
    assert.deepEqual(withCard.primary, base.primary);
  });
});

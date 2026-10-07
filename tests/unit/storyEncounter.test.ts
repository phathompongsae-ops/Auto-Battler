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
import { FEATURES } from '../../src/data/featureData';
import { CRYPT_MAP_ID, FIELD_MAP_ID, TOWN_MAP_ID } from '../../src/data/maps';
import { monsterCombatStats, MONSTERS, type MonsterDef } from '../../src/data/monsterData';
import { SKILLS, type SkillId } from '../../src/data/skillData';
import { STORY_ENCOUNTERS } from '../../src/data/storyEncounters';
import { profiledMonsterDef, selectEncounterProfile } from '../../src/dungeon/encounterProfile';
import type { GameEvents } from '../../src/game/GameEvents';
import { makeSaveTarget } from './fixtures';

/** A monster body without an engine, moving at its own speed. */
class Body implements MonsterAgent {
  x: number;
  y: number;
  readonly hitRadius: number;
  readonly combat: CombatantState;
  step = 0;
  constructor(
    readonly id: string,
    readonly def: MonsterDef,
    public spawnX: number,
    public spawnY: number,
  ) {
    this.x = spawnX;
    this.y = spawnY;
    this.hitRadius = def.hitRadius;
    const base = monsterCombatStats(def.stats);
    this.combat = new CombatantState(id, def.name, 'monster', (_lv, st) => applyStatusModifiers(base, st), def.level);
  }
  moveToward(x: number, y: number): void {
    const d = Math.hypot(x - this.x, y - this.y);
    const s = Math.min(d, this.step);
    if (d > 0) {
      this.x += ((x - this.x) / d) * s;
      this.y += ((y - this.y) / d) * s;
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

/** A realistic Story player: a Novice at `level`, free points split STR / VIT, no gear, the demo kit. */
function storyPlayer(level: number) {
  const t = makeSaveTarget(level);
  const pts = t.progress.remaining(level);
  const vit = Math.floor(pts / 2);
  if (vit) t.progress.allocate('vit', vit, level);
  if (pts - vit) t.progress.allocate('str', pts - vit, level);
  t.combat.refreshStats();
  t.combat.restore();
  return t.combat;
}

interface DuelOptions {
  /** Which telegraphs the player steps out of (by order, 0-based). Default: 3 of every 4. */
  dodges?: (n: number) => boolean;
  /** Player casts Power Slash / Fire Bolt / Guard (otherwise basic attacks only). */
  useSkills?: boolean;
  /** Starting HP as a fraction of max. */
  startHp?: number;
  /** Starting MP as a fraction of max (a checkpoint retry starts at 50%). */
  startMp?: number;
  seed?: number;
}

/**
 * One fight through the real skill / status / damage / monster-AI systems,
 * stepped the way CombatWorld.update does (50 ms frames). The player stands
 * in melee, uses the demo kit (Guard, Power Slash, Fire Bolt, Attack) and
 * walks straight away from the telegraphs it chooses to dodge. Monsters
 * engage together and use CombatWorld's attack choice and enrage rule.
 */
function duel(level: number, defs: MonsterDef[], o: DuelOptions = {}) {
  const DT = 50;
  const events = new EventBus<GameEvents>();
  const combat = new CombatSystem(events);
  combat.rng = seededRng(o.seed ?? 1);
  const statuses = new StatusSystem(events);
  const projectiles = new ProjectileSystem(events, combat);
  const pc = storyPlayer(level);
  pc.hp = Math.round(pc.stats.maxHp * (o.startHp ?? 1));
  pc.mp = Math.floor(pc.stats.maxMp * (o.startMp ?? 1));
  const player: CombatEntity = { id: pc.id, x: 0, y: 0, hitRadius: 10, combat: pc };
  const mons = defs.map((d, i) => new Body(`${d.id}-${i}`, d, 60 + i * 30, (i % 2) * 30));
  const entities: CombatEntity[] = [player, ...mons];
  const skills = new SkillSystem(events, combat, statuses, projectiles, { entities: () => entities });
  let now = 0;
  const world: MonsterWorld = {
    findAggroTarget: (m) => (!pc.dead && Math.hypot(player.x - m.x, player.y - m.y) <= m.def.aggroRange ? player : null),
    tryAttack: (m, target, t) => {
      const special = m.def.specialSkill;
      if (special && skills.use(m, special, t, { target, quiet: true }).ok) return;
      skills.use(m, m.def.attackSkill, t, { target, quiet: true });
    },
    busy: (m) => skills.windingUp(m),
  };
  const brains = mons.map((m) => new MonsterBrain(m, world, 0));
  let telegraphs = 0;
  let dodgeUntil = -1;
  let dodgeFrom: Body | null = null;
  /** Distance from the caster's centre that is safe from the telegraph being dodged (its radius or reach, plus a step). */
  let safeGap = 0;
  const dodges = o.dodges ?? ((n: number) => n % 4 !== 3);
  const taken = { total: 0, special: 0, biggestSpecial: 0 };
  let enragedAt: number | null = null;
  events.on('skillWindup', (e) => {
    const m = mons.find((x) => x.id === e.casterId);
    if (!m) return;
    if (dodges(telegraphs++)) {
      dodgeUntil = now + e.ms + 100;
      dodgeFrom = m;
      safeGap = (e.radius ?? SKILLS[e.skillId].range) + 12;
    }
  });
  events.on('damage', (e) => {
    if (e.targetId === player.id) {
      taken.total += e.amount;
      if (e.skillId !== 'slime_bump') {
        taken.special += e.amount;
        taken.biggestSpecial = Math.max(taken.biggestSpecial, e.amount);
      }
      return;
    }
    // CombatWorld.checkEnrage: once below the threshold, an attack buff until death or a reset.
    const m = mons.find((x) => x.id === e.targetId);
    const below = m?.def.enrageBelow;
    if (m && below && !m.combat.dead && m.combat.hp / m.combat.stats.maxHp < below && !m.combat.statuses.some((s) => s.def.id === 'enraged')) {
      statuses.apply(m, 'enraged', 600_000, now);
      enragedAt ??= now;
    }
  });
  const casts: SkillId[] = o.useSkills === false ? ['basic_attack'] : ['guard', 'power_strike', 'fire_bolt', 'basic_attack'];
  while (now < 300_000) {
    now += DT;
    const alive = mons.filter((m) => !m.combat.dead);
    if (pc.dead || !alive.length) break;
    const target = alive[0];
    const speed = (pc.stats.moveSpeed * DT) / 1000;
    for (const m of mons) m.step = (m.def.stats.moveSpeed * DT) / 1000;
    if (now < dodgeUntil && dodgeFrom) {
      // Step straight out of the telegraph and wait there (moving breaks the player's own wind-up).
      const d = Math.hypot(player.x - dodgeFrom.x, player.y - dodgeFrom.y) || 1;
      // Radius and reach are measured from the caster's centre to the target's edge.
      if (d - player.hitRadius < safeGap) {
        player.x += ((player.x - dodgeFrom.x) / d) * speed;
        player.y += ((player.y - dodgeFrom.y) / d) * speed;
        skills.interruptMovement(player);
      }
    } else {
      const gap = Math.hypot(target.x - player.x, target.y - player.y) - target.hitRadius - player.hitRadius;
      if (gap > SKILLS.basic_attack.range - 4) {
        const d = gap + target.hitRadius + player.hitRadius;
        player.x += ((target.x - player.x) / d) * speed;
        player.y += ((target.y - player.y) / d) * speed;
        skills.interruptMovement(player);
      } else if (!skills.windingUp(player)) {
        for (const id of casts) {
          if (id === 'guard' && target.def.tier === 'normal') continue;
          if (skills.use(player, id, now, { target: id === 'guard' ? undefined : target, quiet: true }).ok) break;
        }
      }
    }
    skills.update(now);
    for (const b of brains) b.update(now, DT);
    projectiles.update(DT, entities, { blocksProjectile: () => false });
    statuses.update(entities, now);
    pc.mp = Math.min(pc.stats.maxMp, pc.mp + (pc.stats.mpRegen * DT) / 1000);
  }
  return { won: !pc.dead && mons.every((m) => m.combat.dead), ms: now, hpLeft: pc.hp / pc.stats.maxHp, maxHp: pc.stats.maxHp, taken, telegraphs, enragedAt };
}

const story = (id: keyof typeof MONSTERS) => profiledMonsterDef(MONSTERS[id], CRYPT_MAP_ID, 'story');
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const runs = (level: number, defs: () => MonsterDef[], o: DuelOptions = {}) => SEEDS.map((seed) => duel(level, defs(), { ...o, seed }));
const winRate = (rs: ReturnType<typeof duel>[]) => rs.filter((r) => r.won).length / rs.length;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

// Measurement printout for tuning (node tests/unit/run.mjs prints it once).
if (process.env.STORY_BALANCE_REPORT) {
  for (const lv of [3, 4, 5]) {
    for (const [name, defs] of [
      ['1 skeleton', () => [story('crypt_skeleton')]],
      ['4 skeletons', () => [story('crypt_skeleton'), story('crypt_skeleton'), story('crypt_skeleton'), story('crypt_skeleton')]],
      ['brute', () => [MONSTERS.crypt_brute]],
      ['knight + skeleton', () => [story('crypt_knight'), story('crypt_skeleton')]],
      ['lord', () => [story('crypt_lord')]],
    ] as const) {
      for (const [label, o] of [['dodge 3/4', {}], ['never dodge', { dodges: () => false }], ['60% HP', { startHp: 0.6 }], ['retry (MP 50%)', { startMp: 0.5 }]] as const) {
        const rs = runs(lv, defs as () => MonsterDef[], o);
        console.log(`Lv${lv} ${name} ${label}: win ${winRate(rs)}, ${median(rs.map((r) => r.ms)) / 1000}s, hpLeft ${median(rs.map((r) => r.hpLeft)).toFixed(2)}, biggest special ${median(rs.map((r) => r.taken.biggestSpecial))}/${rs[0].maxHp}, telegraphs ${median(rs.map((r) => r.telegraphs))}`);
      }
    }
  }
}

describe('Story encounter profile: selection', () => {
  test('the Crypt uses the Story profile only while the Lv20 Dungeon feature is locked; other maps never do', () => {
    assert.ok(STORY_ENCOUNTERS[CRYPT_MAP_ID]);
    assert.equal(selectEncounterProfile(CRYPT_MAP_ID, { dungeonFeatureUnlocked: false }), 'story');
    assert.equal(selectEncounterProfile(CRYPT_MAP_ID, { dungeonFeatureUnlocked: true }), 'standard');
    for (const mapId of [TOWN_MAP_ID, FIELD_MAP_ID]) {
      assert.equal(selectEncounterProfile(mapId, { dungeonFeatureUnlocked: false }), 'standard');
    }
    assert.equal(FEATURES.dungeon.conditions?.requiredLevel, 20);
  });

  test('the standard profile returns the base definitions unchanged; the Story profile only overrides its listed monsters', () => {
    for (const id of ['crypt_skeleton', 'crypt_knight', 'crypt_lord', 'wolf'] as const) {
      assert.equal(profiledMonsterDef(MONSTERS[id], CRYPT_MAP_ID, 'standard'), MONSTERS[id]);
    }
    assert.equal(profiledMonsterDef(MONSTERS.wolf, CRYPT_MAP_ID, 'story'), MONSTERS.wolf);
    assert.equal(profiledMonsterDef(MONSTERS.crypt_lord, FIELD_MAP_ID, 'story'), MONSTERS.crypt_lord);
    const lord = story('crypt_lord');
    assert.deepEqual(
      { level: lord.level, hp: lord.stats.maxHp, atk: lord.stats.attack, def: lord.stats.defense, mdef: lord.stats.magicDefense, special: lord.specialSkill },
      { level: 6, hp: 2800, atk: 9, def: 8, mdef: 8, special: 'crypt_slam_story' },
    );
    // Everything that isn't balance stays the boss's own: tier (quest kill / boss defeat), id, enrage, art, leash.
    for (const key of ['id', 'tier', 'enrageBelow', 'texture', 'scale', 'hitRadius', 'aggroRange', 'leashRange', 'attackSkill', 'lootTable'] as const) {
      assert.equal(lord[key], MONSTERS.crypt_lord[key], key);
    }
  });

  test('Lv20 repeat-dungeon data is unchanged (monsters and signature attacks)', () => {
    const pick = (id: 'crypt_skeleton' | 'crypt_knight' | 'crypt_lord') => {
      const d = MONSTERS[id];
      return [d.level, d.stats.maxHp, d.stats.attack, d.stats.defense, d.specialSkill ?? null, d.enrageBelow ?? null, d.respawnDelay];
    };
    assert.deepEqual(pick('crypt_skeleton'), [20, 140, 14, 6, null, null, 5000]);
    assert.deepEqual(pick('crypt_knight'), [20, 700, 20, 12, 'boar_gore', null, 15000]);
    assert.deepEqual(pick('crypt_lord'), [20, 3000, 26, 16, 'crypt_slam', 0.35, 120000]);
    assert.equal((SKILLS.crypt_slam.effect as { power: number }).power, 2.2);
    assert.equal((SKILLS.boar_gore.effect as { power: number }).power, 2.4);
  });

  test('Story signature attacks keep the telegraph of the attacks they stand in for', () => {
    const same = (a: SkillId, b: SkillId) => {
      const x = SKILLS[a];
      const y = SKILLS[b];
      assert.deepEqual([x.cooldown, x.range, x.target, x.windup, x.heavy, x.effect.kind], [y.cooldown, y.range, y.target, y.windup, y.heavy, y.effect.kind], `${a} vs ${b}`);
    };
    same('crypt_slam_story', 'crypt_slam');
    same('crypt_cleave_story', 'boar_gore');
    assert.equal((SKILLS.crypt_slam_story.effect as { radius: number }).radius, (SKILLS.crypt_slam.effect as { radius: number }).radius);
  });
});

describe('Story Crypt balance (real combat systems, Lv3–5 Novice, no gear, demo kit)', () => {
  test('normal mobs: a group of three is won every time and costs a modest but real share of HP', () => {
    for (const lv of [3, 5]) {
      const rs = runs(lv, () => [story('crypt_skeleton'), story('crypt_skeleton'), story('crypt_skeleton')]);
      assert.equal(winRate(rs), 1, `Lv${lv}`);
      const lost = 1 - median(rs.map((r) => r.hpLeft));
      assert.ok(lost >= 0.04 && lost <= 0.2, `Lv${lv} group costs ${lost.toFixed(2)} of HP`);
    }
  });

  test('Crypt Knight: a tutorial Elite (won every time) whose telegraphed Cleave is worth avoiding', () => {
    for (const lv of [3, 5]) {
      const rs = runs(lv, () => [story('crypt_knight'), story('crypt_skeleton')]);
      assert.equal(winRate(rs), 1, `Lv${lv}`);
      assert.ok(median(rs.map((r) => r.ms)) <= 20_000, 'not a miniboss-length fight');
      const lost = 1 - median(rs.map((r) => r.hpLeft));
      assert.ok(lost <= 0.4, `Lv${lv} Elite costs ${lost.toFixed(2)} of HP`);
    }
    const hit = median(runs(3, () => [story('crypt_knight')], { dodges: () => false }).map((r) => r.taken.biggestSpecial / r.maxHp));
    assert.ok(hit >= 0.12, `a Cleave that lands takes ${hit.toFixed(2)} of a Lv3 bar`);
  });

  test('Crypt Lord: beatable at Lv3 from full HP by reading most telegraphs, after a fight long enough to learn it', () => {
    const rs = runs(3, () => [story('crypt_lord')]);
    assert.ok(winRate(rs) >= 0.85, `win rate ${winRate(rs)}`);
    assert.ok(median(rs.map((r) => r.ms)) >= 25_000, 'survives long enough to show its pattern');
    assert.ok(median(rs.map((r) => r.telegraphs)) >= 4, 'several Slams per fight');
    assert.ok(rs.filter((r) => r.won).every((r) => r.enragedAt !== null), 'every win goes through the Enrage phase');
    assert.ok(winRate(runs(5, () => [story('crypt_lord')])) >= 0.95, 'Lv5');
  });

  test('Crypt Lord: not trivial — ignoring Slam usually loses, and arriving hurt is a real risk', () => {
    assert.ok(winRate(runs(3, () => [story('crypt_lord')], { dodges: () => false })) <= 0.5, 'Lv3 ignoring every Slam');
    assert.ok(winRate(runs(3, () => [story('crypt_lord')], { startHp: 0.6 })) < 0.9, 'Lv3 arriving with 60% HP');
    const slam = median(runs(3, () => [story('crypt_lord')], { dodges: () => false }).map((r) => r.taken.biggestSpecial / r.maxHp));
    assert.ok(slam >= 0.12, `a Slam that lands takes ${slam.toFixed(2)} of a Lv3 bar`);
  });

  test('Crypt Lord: its basic attacks alone never beat a Lv3 player who keeps attacking (basic attacks only)', () => {
    const noSlam = () => [{ ...story('crypt_lord'), specialSkill: undefined }];
    assert.equal(winRate(runs(3, noSlam, { useSkills: false })), 1);
  });

  test('teaching encounters: a pack of four is a real but survivable group; the Skeleton Brute telegraphs at least twice and a Smash that lands hurts', () => {
    const pack = runs(3, () => [story('crypt_skeleton'), story('crypt_skeleton'), story('crypt_skeleton'), story('crypt_skeleton')]);
    assert.equal(winRate(pack), 1);
    const lost = 1 - median(pack.map((r) => r.hpLeft));
    assert.ok(lost >= 0.08 && lost <= 0.25, `pack of four costs ${lost.toFixed(2)} of HP`);
    const brute = runs(3, () => [MONSTERS.crypt_brute]);
    assert.equal(winRate(brute), 1);
    assert.ok(median(brute.map((r) => r.telegraphs)) >= 2, 'the lesson comes round again');
    const hit = median(runs(3, () => [MONSTERS.crypt_brute], { dodges: () => false }).map((r) => r.taken.biggestSpecial / r.maxHp));
    assert.ok(hit >= 0.08, `a Smash that lands takes ${hit.toFixed(2)} of a Lv3 bar`);
  });

  test('Crypt Lord after a checkpoint retry (HP 100%, MP 50%): still a fair, winnable fight at Lv3', () => {
    const rs = runs(3, () => [story('crypt_lord')], { startMp: 0.5 });
    assert.ok(winRate(rs) >= 0.85, `win rate ${winRate(rs)}`);
  });

  test('the Lv20 Crypt Lord stays out of reach for the same Lv3 player (why the Story profile exists)', () => {
    assert.equal(winRate(runs(3, () => [MONSTERS.crypt_lord])), 0);
  });
});

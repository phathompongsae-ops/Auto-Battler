import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MonsterBrain, type MonsterAgent, type MonsterWorld } from '../../src/ai/MonsterBrain';
import { CombatantState } from '../../src/combat/CombatantState';
import { applyStatusModifiers } from '../../src/combat/stats';
import type { CombatEntity } from '../../src/combat/types';
import { TILE_SIZE } from '../../src/config';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../src/data/dungeonDifficulty';
import { CRYPT_MAP_ID, MAPS, type CheckpointDef } from '../../src/data/maps';
import { monsterCombatStats, MONSTERS, type MonsterDef } from '../../src/data/monsterData';
import { SKILLS } from '../../src/data/skillData';
import { STORY_ENCOUNTERS } from '../../src/data/storyEncounters';
import { checkpointReady, DungeonAttempt, partyDefeated, RETRY_HP_FRACTION, RETRY_MP_FRACTION } from '../../src/dungeon/attempt';
import { inArena, inTileRect, tileRectToPx, withinEncounter, type PxRect } from '../../src/world/encounters';
import { activeGates, closedGateAt, gateOpen } from '../../src/dungeon/gates';
import { activeSpawnZones, mapCollision, spawnPlan } from '../../src/world/mapRules';

const CRYPT = MAPS[CRYPT_MAP_ID];
const cp = (id: string) => CRYPT.checkpoints!.find((c) => c.id === id)!;
const arena = (id: string) => CRYPT.encounterAreas![id].rects.map((r) => tileRectToPx(r));
const center = (tx: number, ty: number) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });

describe('party wipe limits and the dungeon attempt', () => {
  test('locked wipe limits: Normal 4, Hard 3, Hell 2', () => {
    assert.deepEqual(DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d].partyWipeLimit), [4, 3, 2]);
  });

  test('each wipe with a retry left spends it; the wipe after the last retry fails the attempt; later deaths are ignored', () => {
    for (const d of DIFFICULTY_ORDER) {
      const limit = DIFFICULTIES[d].partyWipeLimit;
      const a = new DungeonAttempt(CRYPT_MAP_ID, limit);
      for (let i = 1; i <= limit; i++) {
        const w = a.recordPartyWipe();
        assert.deepEqual(w, { kind: 'retry', retriesLeft: limit - i, checkpoint: null }, `${d} wipe ${i}`);
        assert.equal(a.status, 'active');
      }
      assert.deepEqual(a.recordPartyWipe(), { kind: 'failed' }, `${d}: out of retries`);
      assert.equal(a.status, 'failed');
      assert.equal(a.wipesUsed, limit);
      assert.deepEqual(a.recordPartyWipe(), { kind: 'ignored' });
    }
  });

  test('the wipe allowance can follow a run chosen after entry (read when a wipe happens)', () => {
    let difficulty: 'normal' | 'hard' | 'hell' = 'normal';
    const a = new DungeonAttempt(CRYPT_MAP_ID, () => DIFFICULTIES[difficulty].partyWipeLimit);
    assert.equal(a.wipeLimit, 4);
    difficulty = 'hell';
    assert.equal(a.wipeLimit, 2);
    a.recordPartyWipe();
    a.recordPartyWipe();
    assert.deepEqual(a.recordPartyWipe(), { kind: 'failed' });
  });

  test('a wipe is every active party member down: one member down is not a wipe (future party), solo death is', () => {
    const m = (dead: boolean) => ({ combat: { dead } });
    assert.equal(partyDefeated([m(true)]), true, 'solo: the player is the whole party');
    assert.equal(partyDefeated([m(false)]), false);
    assert.equal(partyDefeated([m(true), m(false), m(false)]), false, 'one of three down');
    assert.equal(partyDefeated([m(true), m(true), m(false), m(true)]), false, 'three of four down');
    assert.equal(partyDefeated([m(true), m(true), m(true), m(true)]), true, 'all four down');
    assert.equal(partyDefeated([]), false);
  });

  test('retry vitals are locked at HP 100% / MP 50%', () => {
    assert.equal(RETRY_HP_FRACTION, 1);
    assert.equal(RETRY_MP_FRACTION, 0.5);
  });

  test('a clear stops counting: later deaths spend nothing', () => {
    const a = new DungeonAttempt(CRYPT_MAP_ID, 4);
    a.markCleared();
    assert.deepEqual(a.recordPartyWipe(), { kind: 'ignored' });
    assert.equal(a.retriesLeft, 4);
  });
});

describe('checkpoints', () => {
  test('the furthest checkpoint reached is the retry point; going back past an earlier one never moves it back', () => {
    const a = new DungeonAttempt(CRYPT_MAP_ID, 4);
    assert.equal(a.checkpoint, null, 'no checkpoint yet: retry from the entrance');
    assert.equal(a.activate(cp('crypt_cp_elite')), true);
    assert.equal(a.checkpoint?.id, 'crypt_cp_elite');
    assert.equal(a.activate(cp('crypt_cp_elite')), false, 'already there');
    assert.equal(a.activate(cp('crypt_cp_boss')), true);
    assert.equal(a.activate(cp('crypt_cp_elite')), false, 'walking back does not regress');
    assert.equal(a.checkpoint?.id, 'crypt_cp_boss');
    const w = a.recordPartyWipe();
    assert.equal(w.kind === 'retry' && w.checkpoint?.id, 'crypt_cp_boss');
  });

  test('a checkpoint activates only in its trigger with its encounters down (absent zones count as down)', () => {
    const c: CheckpointDef = cp('crypt_cp_boss');
    assert.equal(checkpointReady(c, { inTrigger: false, zoneCleared: () => true }), false);
    assert.equal(checkpointReady(c, { inTrigger: true, zoneCleared: (z) => z !== 'elite_section' }), false, 'Knight still up');
    assert.equal(checkpointReady(c, { inTrigger: true, zoneCleared: () => true }), true);
  });

  test('activating restores nothing: a checkpoint carries no healing data, only a retry position', () => {
    for (const c of CRYPT.checkpoints!) {
      assert.deepEqual(Object.keys(c).sort(), ['id', 'label', 'order', 'requiresCleared', 'respawn', 'trigger'].sort(), c.id);
    }
  });
});

describe('Story Crypt structure (data)', () => {
  const solid = mapCollision(CRYPT_MAP_ID)!;
  const walkable = (x: number, y: number) => !solid.isBlocked(x, y);
  const allArenas = Object.keys(CRYPT.encounterAreas!).map(arena);

  test('every arena is room floor, and arenas never overlap (encounters are separate)', () => {
    for (const [id, area] of Object.entries(CRYPT.encounterAreas!)) {
      for (const r of area.rects) {
        for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) assert.notEqual(CRYPT.tiles[ty][tx], CRYPT.tiles[0][0], `${id} (${tx},${ty}) is floor`);
      }
    }
    const ids = Object.keys(CRYPT.encounterAreas!);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        for (const r of arena(ids[i])) assert.ok(!arena(ids[j]).some((q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h), `${ids[i]} / ${ids[j]}`);
      }
    }
  });

  test('every Crypt monster belongs to an arena; every spawn stands inside its own arena', () => {
    for (const profile of ['story', 'standard'] as const) {
      for (const s of spawnPlan(CRYPT, profile)) {
        assert.ok(s.arena, `${profile} ${s.id} has an arena`);
        assert.ok(inArena(s.arena!, s.x, s.y), `${profile} ${s.id} inside its arena`);
        assert.ok(walkable(s.x, s.y), `${profile} ${s.id} on open floor`);
      }
    }
  });

  test('checkpoints sit in the connecting corridors (outside every encounter), on open floor, in route order', () => {
    const [a, b] = [cp('crypt_cp_elite'), cp('crypt_cp_boss')];
    assert.ok(a.order < b.order);
    for (const c of [a, b]) {
      assert.ok(walkable(c.respawn.x, c.respawn.y), `${c.id} respawn walkable`);
      assert.ok(inTileRect(c.trigger, c.respawn.x, c.respawn.y), `${c.id} respawn inside its own trigger`);
      for (const r of allArenas) assert.ok(!inArena(r, c.respawn.x, c.respawn.y), `${c.id} respawn outside every encounter`);
    }
    // A: after the teaching encounters, before the Elite Chamber. B: after the Knight, before the Crypt Lord.
    assert.deepEqual(a.requiresCleared, ['story_s1_lone', 'story_s1_pack', 'story_s2_brute']);
    assert.deepEqual(b.requiresCleared, ['elite_section_guard', 'elite_section']);
    const y = (id: string) => arena(id)[0].y;
    assert.ok(a.respawn.y < y('section_2') && a.respawn.y > y('elite'), 'A between Section II and the Elite Chamber');
    assert.ok(b.respawn.y < y('elite') && b.respawn.y > y('boss'), 'B between the Elite Chamber and the Boss Room');
  });

  test('Story teaching flow: lone Skeleton → pack of four → Skeleton Brute (telegraph) → Elite → Boss', () => {
    const zones = activeSpawnZones(CRYPT, 'story').map((z) => [z.id, z.monsterId, z.points.length, z.arena]);
    assert.deepEqual(zones, [
      ['story_s1_lone', 'crypt_skeleton', 1, 'section_1'],
      ['story_s1_pack', 'crypt_skeleton', 4, 'section_1'],
      ['story_s2_brute', 'crypt_brute', 1, 'section_2'],
      ['elite_section_guard', 'crypt_skeleton', 1, 'elite'],
      ['elite_section', 'crypt_knight', 1, 'elite'],
      ['boss_room', 'crypt_lord', 1, 'boss'],
    ]);
    // The first fight can't pull the pack: everything of the pack is beyond aggro range of the lone Skeleton's spot.
    const story = spawnPlan(CRYPT, 'story');
    const lone = story.find((s) => s.zoneId === 'story_s1_lone')!;
    for (const s of story.filter((x) => x.zoneId === 'story_s1_pack')) {
      assert.ok(Math.hypot(s.x - lone.x, s.y - lone.y - 48) > MONSTERS.crypt_skeleton.aggroRange, `${s.id} out of reach of the first fight`);
    }
    // The Brute is the telegraph lesson: a slow, wide, announced Smash, seen at least twice in its fight.
    const smash = SKILLS.brute_smash_story;
    assert.equal(MONSTERS.crypt_brute.specialSkill, 'brute_smash_story');
    assert.ok(smash.windup!.ms >= 1300 && (smash.effect as { radius: number }).radius >= 64);
    assert.equal(MONSTERS.crypt_brute.respawnDelay, 30 * 60_000, 'stays down for the Story visit');
  });

  test('Lv20 runs keep exactly their original spawns (ids, kinds, places)', () => {
    const plan = spawnPlan(CRYPT, 'standard').map((s) => [s.id, s.zoneId, (s.x - 16) / 32, (s.y - 16) / 32]);
    assert.deepEqual(plan, [
      ['crypt_skeleton-1', 'section_1', 8, 45],
      ['crypt_skeleton-2', 'section_1', 23, 46],
      ['crypt_skeleton-3', 'section_1', 16, 44],
      ['crypt_skeleton-4', 'section_2', 8, 34],
      ['crypt_skeleton-5', 'section_2', 23, 34],
      ['crypt_skeleton-6', 'section_2', 15, 33],
      ['crypt_skeleton-7', 'elite_section_guard', 11, 23],
      ['crypt_knight-1', 'elite_section', 16, 24],
      ['crypt_lord-1', 'boss_room', 16, 8],
    ]);
    assert.ok(!spawnPlan(CRYPT, 'standard').some((s) => s.monsterId === 'crypt_brute'), 'the Brute is Story-only');
  });

  test('the Story encounter profile is intact', () => {
    const m = STORY_ENCOUNTERS[CRYPT_MAP_ID].monsters;
    assert.deepEqual(
      Object.fromEntries(Object.entries(m).map(([k, o]) => [k, [o.level, o.stats.maxHp, o.stats.attack, o.stats.defense, o.specialSkill ?? null]])),
      {
        crypt_skeleton: [4, 110, 10, 4, null],
        crypt_knight: [5, 550, 12, 7, 'crypt_cleave_story'],
        crypt_lord: [6, 2800, 9, 8, 'crypt_slam_story'],
      },
    );
  });
});

/** A monster body over the real brain, stepping toward where it is told. */
class Agent implements MonsterAgent {
  x: number;
  y: number;
  readonly hitRadius: number;
  readonly combat: CombatantState;
  constructor(
    readonly id: string,
    readonly def: MonsterDef,
    public spawnX: number,
    public spawnY: number,
    readonly arena?: readonly PxRect[],
  ) {
    this.x = spawnX;
    this.y = spawnY;
    this.hitRadius = def.hitRadius;
    const base = monsterCombatStats(def.stats);
    this.combat = new CombatantState(id, def.name, 'monster', (_lv, st) => applyStatusModifiers(base, st), def.level);
  }
  moveToward(x: number, y: number): void {
    const d = Math.hypot(x - this.x, y - this.y);
    const s = Math.min(d, 6);
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

/** The world's rule for noticing a player (CombatWorld.findAggroTarget): in aggro range and on the monster's floor. */
function rig(id: 'crypt_lord' | 'crypt_knight', zone: string) {
  const s = spawnPlan(CRYPT, 'standard').find((x) => x.zoneId === zone)!;
  const m = new Agent(s.id, MONSTERS[id], s.x, s.y, s.arena);
  const p: CombatEntity = { id: 'p', x: s.x, y: s.y + 60, hitRadius: 10, combat: new CombatantState('p', 'P', 'player', () => monsterCombatStats(MONSTERS.slime.stats)) };
  const world: MonsterWorld = {
    findAggroTarget: (mon) => (Math.hypot(p.x - mon.x, p.y - mon.y) <= mon.def.aggroRange && withinEncounter(mon.arena, p.x, p.y) ? p : null),
    tryAttack: () => {},
  };
  const brain = new MonsterBrain(m, world, 0);
  let now = 0;
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) brain.update((now += 16), 16);
  };
  return { m, p, brain, tick };
}

describe('C-11: the Crypt Lord fights anywhere in its arena and resets only outside it', () => {
  test('in every corner of the Boss Room (some beyond the old 380 px leash) the boss keeps fighting and keeps its damage', () => {
    const boss = arena('boss')[0];
    const corners = [
      { x: boss.x + 20, y: boss.y + 20 },
      { x: boss.x + boss.w - 20, y: boss.y + 20 },
      { x: boss.x + 20, y: boss.y + boss.h - 20 },
      { x: boss.x + boss.w - 20, y: boss.y + boss.h - 20 },
    ];
    const s = spawnPlan(CRYPT, 'standard').find((x) => x.zoneId === 'boss_room')!;
    assert.ok(corners.some((c) => Math.hypot(c.x - s.x, c.y - s.y) > MONSTERS.crypt_lord.leashRange), 'the room is bigger than the radius leash');
    for (const c of corners) {
      const r = rig('crypt_lord', 'boss_room');
      r.tick();
      assert.equal(r.brain.state, 'chase');
      r.m.combat.hp = 1000;
      r.p.x = c.x;
      r.p.y = c.y;
      r.tick(200);
      assert.ok(['chase', 'attack'].includes(r.brain.state), `${JSON.stringify(c)}: ${r.brain.state}`);
      assert.equal(r.m.combat.hp, 1000, 'no reset, no refill');
    }
  });

  test('dragged out of its encounter (the player leaves the Boss Room), it walks home and resets', () => {
    const r = rig('crypt_lord', 'boss_room');
    r.tick();
    r.m.combat.hp = 1000;
    const gate = cp('crypt_cp_boss').respawn; // the corridor south of the room
    r.p.x = gate.x;
    r.p.y = gate.y;
    r.tick();
    assert.equal(r.brain.state, 'return');
    r.tick(400);
    assert.equal(r.brain.state, 'idle');
    assert.equal(r.m.combat.hp, r.m.combat.stats.maxHp, 'full reset at home');
  });
});

describe('C-12: the Crypt Knight never joins another encounter', () => {
  test('a player in the corridor or the Boss Room, even within its aggro range, is never noticed', () => {
    const r = rig('crypt_knight', 'elite_section');
    const knight = { x: r.m.x, y: r.m.y };
    const spots = [cp('crypt_cp_boss').respawn, center(16, 20), center(16, 17)];
    assert.ok(spots.some((p) => Math.hypot(p.x - knight.x, p.y - knight.y) <= MONSTERS.crypt_knight.aggroRange), 'within its radius');
    for (const p of spots) {
      r.p.x = p.x;
      r.p.y = p.y;
      r.tick(30);
      assert.equal(r.brain.state, 'idle', JSON.stringify(p));
    }
  });

  test('engaged in its chamber, it gives up as soon as the player leaves the chamber (it cannot follow into the boss fight)', () => {
    const r = rig('crypt_knight', 'elite_section');
    r.tick();
    assert.equal(r.brain.state, 'chase');
    r.p.x = center(16, 12).x;
    r.p.y = center(16, 12).y; // Boss Room
    r.tick();
    assert.equal(r.brain.state, 'return');
  });
});

describe('Story progression gates (no skipping the tutorial encounters)', () => {
  const solid = mapCollision(CRYPT_MAP_ID)!;
  const gates = activeGates(CRYPT, 'story');
  const STEPS = [
    ['story_s1_lone', 'story_s1_pack'],
    ['story_s2_brute'],
    ['elite_section_guard', 'elite_section'],
  ];

  /** Rooms reachable on foot from the entrance (real collision), with closed gates shut. */
  function reachableRooms(cleared: ReadonlySet<string>): string[] {
    const zoneCleared = (z: string) => cleared.has(z);
    const start = { tx: Math.floor(CRYPT.spawnPoint.x / TILE_SIZE), ty: Math.floor(CRYPT.spawnPoint.y / TILE_SIZE) };
    const seen = new Set<string>([`${start.tx},${start.ty}`]);
    const queue = [start];
    const rooms = new Set<string>();
    while (queue.length) {
      const { tx, ty } = queue.shift()!;
      const c = center(tx, ty);
      for (const id of Object.keys(CRYPT.encounterAreas!)) if (inArena(arena(id), c.x, c.y)) rooms.add(id);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { tx: tx + dx, ty: ty + dy };
        const k = `${n.tx},${n.ty}`;
        const p = center(n.tx, n.ty);
        if (seen.has(k) || n.tx < 0 || n.ty < 0 || n.ty >= CRYPT.tiles.length || n.tx >= CRYPT.tiles[0].length) continue;
        if (solid.isBlocked(p.x, p.y) || closedGateAt(gates, p.x, p.y, zoneCleared)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    return [...rooms].sort();
  }

  test('Lv20 runs have no gates (their progression is unchanged); the Story Crypt has one per doorway, in route order', () => {
    assert.deepEqual(activeGates(CRYPT, 'standard'), []);
    assert.deepEqual(gates.map((g) => g.id), ['story_gate_section_1', 'story_gate_section_2', 'story_gate_elite']);
    // Each gate fills its doorway: every tile of its row inside the corridor is gated, the tiles either side are wall.
    for (const g of gates) {
      const y = g.area.y;
      for (let x = g.area.x; x < g.area.x + g.area.w; x++) assert.ok(!solid.isBlocked(center(x, y).x, center(x, y).y), `${g.id} (${x},${y}) is the doorway`);
      assert.ok(solid.isBlocked(center(g.area.x - 1, y).x, center(g.area.x - 1, y).y) && solid.isBlocked(center(g.area.x + g.area.w, y).x, center(g.area.x + g.area.w, y).y), `${g.id} no way around`);
      for (const id of Object.keys(CRYPT.encounterAreas!)) assert.ok(!arena(id).some((r) => inArena([r], center(g.area.x, y).x, center(g.area.x, y).y)), `${g.id} is outside every room (rooms stay free to move in)`);
    }
  });

  test('requirements are cumulative and follow the tutorial order; the boss gate needs everything Checkpoint B needs', () => {
    let needed: string[] = [];
    for (const [i, g] of gates.entries()) {
      needed = [...needed, ...STEPS[i]];
      assert.deepEqual([...g.requiresCleared].sort(), [...needed].sort(), g.id);
    }
    for (const z of cp('crypt_cp_boss').requiresCleared ?? []) assert.ok(gates[2].requiresCleared.includes(z));
  });

  test('on foot, each room opens only when the encounters before it are down; the Boss Room only after the Elite', () => {
    const cleared = new Set<string>();
    assert.deepEqual(reachableRooms(cleared), ['section_1'], 'start: Section I only');
    // Clearing only part of a step opens nothing.
    cleared.add('story_s1_lone');
    assert.deepEqual(reachableRooms(cleared), ['section_1'], 'the pack is still up');
    cleared.add('story_s1_pack');
    assert.deepEqual(reachableRooms(cleared), ['section_1', 'section_2']);
    // Skipping ahead: even with the Elite down, the Brute still holds the way.
    assert.deepEqual(reachableRooms(new Set([...cleared, 'elite_section_guard', 'elite_section'])), ['section_1', 'section_2']);
    cleared.add('story_s2_brute');
    assert.deepEqual(reachableRooms(cleared), ['elite', 'section_1', 'section_2']);
    cleared.add('elite_section_guard');
    assert.deepEqual(reachableRooms(cleared), ['elite', 'section_1', 'section_2'], 'the Knight is still up: no Boss Room');
    cleared.add('elite_section');
    assert.deepEqual(reachableRooms(cleared), ['boss', 'elite', 'section_1', 'section_2']);
  });

  test('a gate is closed exactly while one of its encounters still stands', () => {
    const g = gates[0];
    const at = center(g.area.x + 1, g.area.y);
    assert.equal(closedGateAt(gates, at.x, at.y, () => false)?.id, g.id);
    assert.equal(closedGateAt(gates, at.x, at.y, (z) => z === 'story_s1_lone'), g);
    assert.equal(closedGateAt(gates, at.x, at.y, () => true), null);
    assert.equal(gateOpen(g, () => true), true);
    const inRoom = center(16, 45);
    assert.equal(closedGateAt(gates, inRoom.x, inRoom.y, () => false), null, 'moving inside a room is never blocked');
  });
});

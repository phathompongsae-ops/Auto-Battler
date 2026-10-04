import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NAVIGATION, type NavigationData, type NavPoint, type NavTarget } from '../../src/data/navigationData';
import { PROTOTYPE_MAP_ID } from '../../src/data/navigation/demoNavigation';
import { QUESTS, type QuestDef } from '../../src/data/questData';
import { DEMO_MARKER_ID, DEMO_NPC_ID } from '../../src/data/quests/demoTestQuests';
import type { Location, PortalDef } from '../../src/data/warpData';
import { DIRECTION_VECTORS, type Direction } from '../../src/input/Direction';
import { AutoMove, type NavigationState, type NavWorld } from '../../src/navigation/AutoMove';
import { NavIndex, portalTransition } from '../../src/navigation/NavIndex';
import { LPathPlanner, steerToward, tileGrid, type CollisionGrid } from '../../src/navigation/pathing';
import { resolveObjectiveTarget, resolveQuestObjective } from '../../src/navigation/questNavigation';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { buildTestMap, PLAYER_SPAWN, SOLID_TILES } from '../../src/world/testMap';
import { makeSaveTarget } from './fixtures';

const SPEED = 160;
const DT = 16;

/** A player-like body on a map: moves by direction * speed, stopped by solid tiles (like the arcade collider). */
class SimWorld implements NavWorld {
  combat = false;
  dead = false;
  reached: string[] = [];
  portals: string[] = [];
  /** Frames moved in a direction (to prove no teleporting within a map). */
  maxStep = 0;

  constructor(
    readonly nav: NavIndex,
    public pos: NavPoint,
    public loc: Location,
    private readonly grid?: CollisionGrid,
    private readonly onReach: (id: string) => void = () => {},
  ) {}

  mapId = () => this.loc.mapId;
  position = () => ({ ...this.pos });
  inCombat = () => this.combat;
  isDead = () => this.dead;
  takePortal = (portalId: string) => {
    const t = portalTransition(this.nav, this.loc, portalId);
    if (!t.ok) return false;
    this.loc = t.location;
    this.pos = { ...t.arrival };
    this.portals.push(portalId);
    return true;
  };
  reachLocation = (id: string) => {
    this.reached.push(id);
    this.onReach(id);
  };

  step(direction: Direction | null, dtMs = DT): void {
    if (!direction) return;
    const v = DIRECTION_VECTORS[direction];
    const d = (SPEED * dtMs) / 1000;
    const next = { x: this.pos.x + v.x * d, y: this.pos.y + v.y * d };
    if (this.grid?.isBlocked(next.x, next.y)) return;
    this.maxStep = Math.max(this.maxStep, Math.hypot(next.x - this.pos.x, next.y - this.pos.y));
    this.pos = next;
  }
}

/** Run frames through the real drive() rule until navigation ends (or `frames` runs out). */
function run(auto: AutoMove, world: SimWorld, frames = 5000, manual: (frame: number) => Direction | null = () => null) {
  let moved = 0;
  for (let i = 0; i < frames; i++) {
    const dir = auto.drive(manual(i), DT, SPEED);
    world.step(dir);
    if (dir) moved++;
    if (!auto.isActive() && !manual(i + 1)) break;
  }
  return moved;
}

const target = (over: Partial<NavTarget> & Pick<NavTarget, 'id' | 'type' | 'mapId' | 'x' | 'y'>): NavTarget => over;

/** Two lightweight test maps linked by a portal, plus an island no portal reaches. */
const TEST_PORTALS: Record<string, PortalDef> = {
  nav_test_a_to_b: { id: 'nav_test_a_to_b', from: 'nav_test_a', to: 'nav_test_b' },
};
const TEST_NAV: NavigationData = {
  targets: Object.fromEntries(
    [
      target({ id: 'a_npc', type: 'npc', mapId: 'nav_test_a', x: 300, y: 100, npcId: 'npc_a', radius: 30 }),
      target({ id: 'a_portal', type: 'portal', mapId: 'nav_test_a', x: 500, y: 300, radius: 16, portalId: 'nav_test_a_to_b', arrival: { x: 40, y: 40 } }),
      target({ id: 'b_marker', type: 'location', mapId: 'nav_test_b', x: 200, y: 240, locationId: 'b_spot' }),
      target({ id: 'b_zone', type: 'monster_zone', mapId: 'nav_test_b', x: 400, y: 400, monsterIds: ['wolf'] }),
      target({ id: 'island_npc', type: 'npc', mapId: 'nav_test_island', x: 10, y: 10, npcId: 'hermit' }),
    ].map((t) => [t.id, t]),
  ),
  stations: { enhance: null },
};

function testRig(start: NavPoint = { x: 100, y: 300 }, mapId = 'nav_test_a') {
  const nav = new NavIndex(TEST_NAV, TEST_PORTALS);
  const world = new SimWorld(nav, start, { kind: 'field', mapId });
  const states: NavigationState[] = [];
  const auto = new AutoMove(nav, new LPathPlanner(), world, (s) => states.push(s));
  return { nav, world, auto, states };
}

/** The real demo data on the real prototype map collision. */
function demoRig() {
  const t = makeSaveTarget(1);
  const nav = new NavIndex(NAVIGATION);
  const grid = tileGrid(buildTestMap(), 32, SOLID_TILES);
  const world = new SimWorld(nav, { ...PLAYER_SPAWN }, { kind: 'field', mapId: PROTOTYPE_MAP_ID }, grid, (locationId) =>
    t.events.emit('locationReached', { locationId }),
  );
  const auto = new AutoMove(nav, new LPathPlanner(() => grid), world, () => {}, t.quests);
  return { t, nav, world, auto };
}

const dist = (a: NavPoint, b: NavPoint) => Math.hypot(a.x - b.x, a.y - b.y);

describe('quest objective → navigation target', () => {
  const nav = new NavIndex(NAVIGATION);
  const resolve = (o: QuestDef['objectives'][number]) => {
    const r = resolveObjectiveTarget(o, nav);
    return r.ok ? r.target.id : r.reason;
  };

  test('talk → NPC, visit → marker, kill → monster zone, dungeon_clear → entrance', () => {
    assert.equal(resolve({ kind: 'talk', npcId: DEMO_NPC_ID }), 'nav_demo_npc_guide');
    assert.equal(resolve({ kind: 'visit', locationId: DEMO_MARKER_ID }), 'nav_demo_marker_gate');
    assert.equal(resolve({ kind: 'kill', monsterId: 'slime', count: 3 }), 'nav_demo_slime_zone');
    assert.equal(resolve({ kind: 'dungeon_clear', dungeonId: 'demo_dungeon' }), 'nav_demo_dungeon_entrance');
  });

  test('collect → a zone whose monsters drop the item (from real loot data); otherwise unavailable', () => {
    assert.equal(resolve({ kind: 'collect', itemId: 'slime_sample', count: 3 }), 'nav_demo_slime_zone');
    assert.equal(resolve({ kind: 'collect', itemId: 'boss_fragment' }), 'no_target');
  });

  test('nothing configured → a safe "no target" (no invented destinations)', () => {
    assert.equal(resolve({ kind: 'talk', npcId: 'nobody' }), 'no_target');
    assert.equal(resolve({ kind: 'kill', monsterId: 'dragon' }), 'no_target');
    assert.equal(resolve({ kind: 'visit', locationId: 'nowhere' }), 'no_target');
    assert.equal(resolve({ kind: 'dungeon_clear', dungeonId: 'other_dungeon' }), 'no_target');
    assert.equal(resolve({ kind: 'enhance' }), 'no_target', 'no enhancement station yet');
  });

  test('enhance uses the configured station when one exists (data hook)', () => {
    const withStation = new NavIndex({ ...TEST_NAV, stations: { enhance: 'a_npc' } }, TEST_PORTALS);
    const r = resolveObjectiveTarget({ kind: 'enhance', minLevel: 3 }, withStation);
    assert.equal(r.ok && r.target.id, 'a_npc');
  });

  test('quest objectives resolve only for ACTIVE quests (tracked or not) and unfinished objectives', () => {
    const t = makeSaveTarget(1);
    assert.deepEqual(resolveQuestObjective(t.quests, 'q_demo_01', 0, nav), { ok: false, reason: 'quest_not_active' });
    t.quests.start('q_demo_01');
    const r = resolveQuestObjective(t.quests, 'q_demo_01', 0, nav);
    assert.equal(r.ok && r.target.id, 'nav_demo_npc_guide');
    assert.deepEqual(resolveQuestObjective(t.quests, 'q_demo_01', 5, nav), { ok: false, reason: 'unknown_objective' });
    assert.deepEqual(resolveQuestObjective(t.quests, 'nope', 0, nav), { ok: false, reason: 'unknown_quest' });
    t.events.emit('npcInteracted', { npcId: DEMO_NPC_ID });
    assert.deepEqual(resolveQuestObjective(t.quests, 'q_demo_01', 0, nav), { ok: false, reason: 'quest_not_active' }, 'completed');
  });
});

describe('Auto Move state', () => {
  test('start → moving → arrived inside the radius, moving smoothly (no teleport), then stops', () => {
    const { auto, world, states } = testRig();
    const r = auto.navigateTo('a_npc');
    assert.ok(r.ok && r.state.status === 'moving');
    run(auto, world);
    const s = auto.state();
    assert.equal(s.status, 'arrived');
    assert.ok(dist(world.pos, TEST_NAV.targets.a_npc) <= 30);
    assert.ok(world.maxStep <= (SPEED * DT) / 1000 + 1e-9, 'one frame of normal speed at most');
    assert.equal(auto.drive(null, DT, SPEED), null, 'stays still once arrived');
    assert.deepEqual(states.map((x) => x.status), ['moving', 'arrived']);
  });

  test('no jitter: after arriving, further frames never move the player', () => {
    const { auto, world } = testRig({ x: 300, y: 160 });
    auto.navigateTo('a_npc');
    run(auto, world);
    const at = world.position();
    for (let i = 0; i < 60; i++) world.step(auto.drive(null, DT, SPEED));
    assert.deepEqual(world.position(), at);
  });

  test('already inside the arrival radius: arrives immediately without moving', () => {
    const { auto, world } = testRig({ x: 310, y: 110 });
    const r = auto.navigateTo('a_npc');
    assert.ok(r.ok && r.state.status === 'arrived');
    assert.equal(run(auto, world), 0);
  });

  test('a new target replaces the current one (cancelled: replaced), only one active at a time', () => {
    const { auto, world, states } = testRig();
    auto.navigateTo('a_npc');
    run(auto, world, 10);
    auto.navigateTo('a_portal');
    assert.equal(auto.state().targetId, 'a_portal');
    assert.ok(states.some((s) => s.status === 'cancelled' && s.reason === 'replaced' && s.targetId === 'a_npc'));
  });

  test('cancel stops it; an unknown target is refused and leaves current navigation alone', () => {
    const { auto, world } = testRig();
    auto.navigateTo('a_npc');
    assert.deepEqual(auto.navigateTo('nope'), { ok: false, reason: 'unknown_target' });
    assert.equal(auto.state().status, 'moving');
    auto.cancel();
    assert.deepEqual([auto.state().status, auto.state().reason], ['cancelled', 'cancelled']);
    const at = world.position();
    run(auto, world, 30);
    assert.deepEqual(world.position(), at);
  });

  test('a blocked straight path fails as no_path instead of walking into walls', () => {
    const blocked: CollisionGrid = { isBlocked: (x) => x > 200 && x < 220 };
    const nav = new NavIndex(TEST_NAV, TEST_PORTALS);
    const world = new SimWorld(nav, { x: 100, y: 100 }, { kind: 'field', mapId: 'nav_test_a' }, blocked);
    const auto = new AutoMove(nav, new LPathPlanner(() => blocked), world);
    auto.navigateTo('a_npc');
    run(auto, world);
    assert.deepEqual([auto.state().status, auto.state().reason], ['failed', 'no_path']);
  });

  test('unexpected obstacles end in a clear failure (stuck), not an endless walk', () => {
    const blocked: CollisionGrid = { isBlocked: (x) => x > 200 && x < 220 };
    const nav = new NavIndex(TEST_NAV, TEST_PORTALS);
    const world = new SimWorld(nav, { x: 100, y: 100 }, { kind: 'field', mapId: 'nav_test_a' }, blocked);
    const auto = new AutoMove(nav, new LPathPlanner(), world); // planner unaware of the wall
    auto.navigateTo('a_npc');
    run(auto, world);
    assert.deepEqual([auto.state().status, auto.state().reason], ['failed', 'stuck']);
  });
});

describe('manual input cancels Auto Move', () => {
  test('any manual direction cancels immediately and is used as-is; Auto Move never restarts itself', () => {
    const { auto, world } = testRig();
    auto.navigateTo('a_npc');
    run(auto, world, 20);
    const manual = auto.drive('down', DT, SPEED);
    assert.equal(manual, 'down');
    assert.deepEqual([auto.state().status, auto.state().reason], ['cancelled', 'manual_input']);
    for (let i = 0; i < 100; i++) assert.equal(auto.drive(null, DT, SPEED), null);
    assert.equal(auto.state().status, 'cancelled');
  });

  test('every direction cancels', () => {
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const { auto } = testRig();
      auto.navigateTo('a_npc');
      auto.drive(dir, DT, SPEED);
      assert.equal(auto.state().reason, 'manual_input', dir);
    }
  });
});

describe('combat while Auto Moving (no Auto Battle)', () => {
  test('pauses while a monster engages the player, then resumes on its own', () => {
    const { auto, world, states } = testRig();
    auto.navigateTo('a_npc');
    run(auto, world, 20);
    world.combat = true;
    const at = world.position();
    for (let i = 0; i < 200; i++) world.step(auto.drive(null, DT, SPEED));
    assert.deepEqual(world.position(), at, 'stands still: no attacking, no moving');
    assert.equal(auto.state().status, 'moving');
    assert.equal(auto.state().paused, true);
    world.combat = false;
    run(auto, world);
    assert.equal(auto.state().status, 'arrived');
    assert.ok(states.some((s) => s.paused) && !states.at(-1)!.paused);
  });

  test('a long fight does not count as being stuck', () => {
    const { auto, world } = testRig();
    auto.navigateTo('a_npc');
    world.combat = true;
    for (let i = 0; i < 1000; i++) auto.drive(null, DT, SPEED);
    assert.equal(auto.state().status, 'moving');
  });

  test('manual input during a combat pause still cancels permanently; death cancels too', () => {
    const { auto, world } = testRig();
    auto.navigateTo('a_npc');
    world.combat = true;
    auto.drive(null, DT, SPEED);
    auto.drive('left', DT, SPEED);
    assert.equal(auto.state().reason, 'manual_input');

    const other = testRig();
    other.auto.navigateTo('a_npc');
    other.world.dead = true;
    other.auto.drive(null, DT, SPEED);
    assert.deepEqual([other.auto.state().status, other.auto.state().reason], ['cancelled', 'player_died']);
  });
});

describe('cross-map routing through portals', () => {
  test('route: walk to the portal, use the real portal transition, continue on the next map', () => {
    const { auto, world, states } = testRig();
    const r = auto.navigateTo('b_marker');
    assert.ok(r.ok);
    assert.deepEqual(r.state.route, ['a_portal', 'b_marker']);
    run(auto, world);
    assert.equal(auto.state().status, 'arrived');
    assert.deepEqual(world.portals, ['nav_test_a_to_b']);
    assert.equal(world.mapId(), 'nav_test_b');
    assert.ok(dist(world.pos, TEST_NAV.targets.b_marker) <= 24);
    assert.deepEqual(world.reached, ['b_spot']);
    assert.ok(states.some((s) => s.status === 'waiting_for_transition'));
  });

  test('a portal is never used from the wrong map, and maps are never skipped by teleporting', () => {
    const nav = new NavIndex(TEST_NAV, TEST_PORTALS);
    assert.deepEqual(portalTransition(nav, { kind: 'field', mapId: 'nav_test_b' }, 'nav_test_a_to_b'), { ok: false });
    const { auto, world } = testRig();
    auto.navigateTo('b_zone');
    run(auto, world, 3);
    assert.equal(world.mapId(), 'nav_test_a', 'still walking on map A');
  });

  test('a destination no portal reaches fails safely', () => {
    const { auto } = testRig();
    assert.deepEqual(auto.navigateTo('island_npc'), { ok: false, reason: 'unreachable' });
    assert.equal(auto.state().status, 'inactive');
  });

  test('a failing transition ends as portal_failed', () => {
    const { auto, world } = testRig();
    world.takePortal = () => false;
    auto.navigateTo('b_marker');
    run(auto, world);
    assert.deepEqual([auto.state().status, auto.state().reason], ['failed', 'portal_failed']);
  });

  test('the demo route: field → portal → dungeon entrance map → entrance (no automatic dungeon entry)', () => {
    const { auto, world } = demoRig();
    const r = auto.navigateTo('nav_demo_dungeon_entrance');
    assert.ok(r.ok);
    assert.deepEqual(r.state.route, ['nav_demo_portal_to_dungeon', 'nav_demo_dungeon_entrance']);
    run(auto, world);
    assert.equal(auto.state().status, 'arrived');
    assert.equal(world.mapId(), 'demo_dungeon_entrance');
    assert.equal(world.loc.kind, 'dungeon');
  });
});

describe('demo quests through Auto Move (real prototype map collision)', () => {
  test('q_demo_01 → walks to the demo NPC and stops there (no automatic dialogue)', () => {
    const { t, auto, world } = demoRig();
    t.quests.start('q_demo_01');
    const r = auto.navigateToQuestObjective('q_demo_01', 0);
    assert.ok(r.ok && r.state.targetId === 'nav_demo_npc_guide');
    run(auto, world);
    assert.equal(auto.state().status, 'arrived');
    assert.ok(dist(world.pos, NAVIGATION.targets.nav_demo_npc_guide) <= 40);
    assert.equal(t.quests.status('q_demo_01'), 'active', 'arriving is not talking');
  });

  test('q_demo_02 → walks to the slime hunting area and stops (no attacking)', () => {
    const { t, auto, world } = demoRig();
    t.quests.start('q_demo_01');
    t.events.emit('npcInteracted', { npcId: DEMO_NPC_ID });
    t.quests.claim('q_demo_01');
    t.quests.start('q_demo_02');
    assert.ok(auto.navigateToQuestObjective('q_demo_02', 0).ok);
    run(auto, world);
    assert.equal(auto.state().status, 'arrived');
    assert.ok(dist(world.pos, NAVIGATION.targets.nav_demo_slime_zone) <= 40);
    assert.deepEqual(t.quests.progress('q_demo_02'), [{ current: 0, required: 3 }]);
  });

  test('q_demo_03 → arriving at the marker reports reachLocation and the quest progresses', () => {
    const { t, auto, world } = demoRig();
    const q = QUESTS;
    for (const id of ['q_demo_01', 'q_demo_02']) {
      t.quests.start(id);
      for (const o of q[id].objectives) {
        if (o.kind === 'talk') t.events.emit('npcInteracted', { npcId: o.npcId });
        if (o.kind === 'kill') for (let i = 0; i < (o.count ?? 1); i++) t.events.emit('monsterKilled', { entityId: 'x', monsterId: o.monsterId, zone: 'field' });
      }
      t.quests.claim(id);
    }
    t.quests.start('q_demo_03');
    assert.ok(auto.navigateToQuestObjective('q_demo_03', 0).ok);
    run(auto, world);
    assert.deepEqual(world.reached, [DEMO_MARKER_ID]);
    assert.equal(t.quests.status('q_demo_03'), 'completed');
  });

  test('a quest that is not active cannot be navigated', () => {
    const { auto } = demoRig();
    assert.deepEqual(auto.navigateToQuestObjective('q_demo_02', 0), { ok: false, reason: 'quest_not_active' });
  });
});

describe('pathing helpers', () => {
  test('steering closes the horizontal gap first, then the vertical one', () => {
    assert.equal(steerToward({ x: 0, y: 0 }, { x: 50, y: 50 }, 4), 'right');
    assert.equal(steerToward({ x: 48, y: 0 }, { x: 50, y: 50 }, 4), 'down');
    assert.equal(steerToward({ x: 48, y: 47 }, { x: 50, y: 50 }, 4), null);
  });

  test('the L planner picks the clear elbow and refuses when neither is clear', () => {
    const wallBelow: CollisionGrid = { isBlocked: (x, y) => y > 150 && y < 170 && x < 250 };
    const planner = new LPathPlanner(() => wallBelow, 0);
    assert.deepEqual(planner.plan('m', { x: 100, y: 100 }, { x: 300, y: 300 }), [{ x: 300, y: 100 }, { x: 300, y: 300 }]);
    const boxed: CollisionGrid = { isBlocked: (x, y) => (x > 150 && x < 170) || (y > 150 && y < 170) };
    assert.equal(new LPathPlanner(() => boxed, 0).plan('m', { x: 100, y: 100 }, { x: 300, y: 300 }), null);
  });
});

describe('save / load', () => {
  test('Auto Move is never saved; quest state is untouched by navigation', () => {
    const { t, auto, world } = demoRig();
    t.quests.start('q_demo_01');
    auto.navigateToQuestObjective('q_demo_01', 0);
    run(auto, world, 30);
    assert.equal(auto.state().status, 'moving');
    const text = serializePlayerSave(capturePlayerSave(t));
    for (const key of ['navigation', 'autoMove', 'targetId', 'nav_demo']) assert.equal(text.includes(key), false, key);

    const loaded = makeSaveTarget(1);
    applyPlayerSave(loaded, deserializePlayerSave(text));
    assert.equal(loaded.quests.status('q_demo_01'), 'active');
    // CombatWorld.loadPlayer clears Auto Move; clear() leaves it inactive with no event.
    auto.clear();
    assert.equal(auto.state().status, 'inactive');
    assert.equal(auto.drive(null, DT, SPEED), null);
  });
});

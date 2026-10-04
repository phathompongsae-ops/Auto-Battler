import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ManualClock } from '../../src/core/clock';
import { seededRng } from '../../src/core/rng';
import { validateRecipe, CraftingQueue } from '../../src/crafting/crafting';
import { RECIPES } from '../../src/data/craftingData';
import { DUNGEON_WARPS, type Location } from '../../src/data/warpData';
import { Wallet } from '../../src/economy/Wallet';
import { sequentialIds } from '../../src/equipment/factory';
import { Inventory } from '../../src/loot/Inventory';
import { defaultUnlocks, useDungeonWarp, usePortal, useTownWarp, type WarpContext } from '../../src/warp/warp';

const HOUR = 3_600_000;

function craftSetup() {
  const clock = new ManualClock(Date.UTC(2026, 9, 3, 6));
  const inventory = new Inventory();
  inventory.add('blueprint_warborn');
  inventory.add('boss_fragment', 4);
  inventory.add('rare_craft_material', 2);
  const wallet = new Wallet({ gold: 6000 });
  return { clock, inventory, wallet, queue: new CraftingQueue(clock) };
}

describe('crafting', () => {
  test('every recipe matches its output definition', () => {
    for (const recipe of Object.values(RECIPES)) assert.deepEqual(validateRecipe(recipe), [], recipe.id);
  });

  test('a mismatched recipe is reported', () => {
    assert.notDeepEqual(validateRecipe({ ...RECIPES.demo_warborn_plate, rarity: 'legendary' }), []);
    assert.notDeepEqual(validateRecipe({ ...RECIPES.demo_warborn_plate, durationMs: 0 }), []);
    assert.deepEqual(validateRecipe({ ...RECIPES.demo_warborn_plate, outputDefId: 'nope' }), ['unknown output nope']);
  });

  test('starting consumes every requirement exactly once', () => {
    const { inventory, wallet, queue, clock } = craftSetup();
    const result = queue.start('demo_warborn_plate', inventory, wallet, sequentialIds('job'));
    assert.equal(result.ok, true);
    assert.equal(inventory.count('blueprint_warborn'), 0);
    assert.equal(inventory.count('boss_fragment'), 0);
    assert.equal(inventory.count('rare_craft_material'), 0);
    assert.equal(wallet.get('gold'), 0);
    if (result.ok) assert.equal(result.job.completesAt, clock.now() + 2 * HOUR);
  });

  test('missing requirements fail without consuming anything', () => {
    const cases = [
      ['missing_blueprint', (s: ReturnType<typeof craftSetup>) => s.inventory.remove('blueprint_warborn')],
      ['missing_fragments', (s: ReturnType<typeof craftSetup>) => s.inventory.remove('boss_fragment')],
      ['missing_materials', (s: ReturnType<typeof craftSetup>) => s.inventory.remove('rare_craft_material')],
      ['not_enough_gold', (s: ReturnType<typeof craftSetup>) => s.wallet.spend('gold', 1)],
    ] as const;
    for (const [reason, mutate] of cases) {
      const s = craftSetup();
      mutate(s);
      const before = { items: s.inventory.entries(), gold: s.wallet.get('gold') };
      assert.deepEqual(s.queue.start('demo_warborn_plate', s.inventory, s.wallet, sequentialIds('job')), { ok: false, reason });
      assert.deepEqual({ items: s.inventory.entries(), gold: s.wallet.get('gold') }, before, reason);
      assert.equal(s.queue.jobs.length, 0);
    }
    const s = craftSetup();
    assert.deepEqual(s.queue.start('nope', s.inventory, s.wallet, sequentialIds('job')), { ok: false, reason: 'unknown_recipe' });
  });

  test('a job can be claimed once, only after its time is up', () => {
    const { inventory, wallet, queue, clock } = craftSetup();
    queue.start('demo_warborn_plate', inventory, wallet, sequentialIds('job'));
    const ids = sequentialIds('eq');
    assert.deepEqual(queue.claim('job-1', seededRng(1), ids), { ok: false, reason: 'not_ready' });
    clock.advance(2 * HOUR - 1);
    assert.deepEqual(queue.claim('job-1', seededRng(1), ids), { ok: false, reason: 'not_ready' });
    clock.advance(1);
    const claimed = queue.claim('job-1', seededRng(1), ids);
    assert.equal(claimed.ok, true);
    if (claimed.ok) assert.equal(claimed.item.defId, 'warborn_plate');
    assert.deepEqual(queue.claim('job-1', seededRng(1), ids), { ok: false, reason: 'already_claimed' });
    assert.deepEqual(queue.claim('job-9', seededRng(1), ids), { ok: false, reason: 'unknown_job' });
  });
});

describe('warp scrolls and portals', () => {
  const field: Location = { kind: 'field', mapId: 'demo_field' };
  const inDungeon: Location = { kind: 'dungeon', mapId: 'demo_dungeon_boss' };

  function ctx(location: Location, scrolls: { town?: number; dungeon?: number } = {}): WarpContext {
    const inventory = new Inventory();
    if (scrolls.town) inventory.add('town_warp_scroll', scrolls.town);
    if (scrolls.dungeon) inventory.add('dungeon_warp_scroll', scrolls.dungeon);
    return { location, inCombat: false, inventory, unlocks: defaultUnlocks() };
  }

  test('town warp goes to the default town and consumes one scroll', () => {
    const c = ctx(field, { town: 2 });
    assert.deepEqual(useTownWarp(c), { ok: true, destination: { kind: 'town', mapId: 'demo_town' }, leftDungeon: false });
    assert.equal(c.inventory.count('town_warp_scroll'), 1);
  });

  test('town warp from inside a dungeon exits it', () => {
    const result = useTownWarp(ctx(inDungeon, { town: 1 }));
    assert.equal(result.ok && result.leftDungeon, true);
  });

  test('town warp prefers an unlocked home town, ignores a locked one', () => {
    const c = ctx(field, { town: 2 });
    c.unlocks.homeTown = 'locked_town';
    const r = useTownWarp(c);
    assert.equal(r.ok && r.destination.mapId, 'demo_town');
  });

  test('failures never consume a scroll', () => {
    const combat = ctx(field, { town: 1, dungeon: 1 });
    combat.inCombat = true;
    assert.deepEqual(useTownWarp(combat), { ok: false, reason: 'in_combat' });
    assert.deepEqual(useDungeonWarp(combat, 'demo_dungeon'), { ok: false, reason: 'in_combat' });
    assert.equal(combat.inventory.count('town_warp_scroll'), 1);
    assert.equal(combat.inventory.count('dungeon_warp_scroll'), 1);

    assert.deepEqual(useTownWarp(ctx(field)), { ok: false, reason: 'no_scroll' });

    const noTown = ctx(field, { town: 1 });
    noTown.unlocks.towns.clear();
    assert.deepEqual(useTownWarp(noTown), { ok: false, reason: 'no_town' });
    assert.equal(noTown.inventory.count('town_warp_scroll'), 1);

    const locked = ctx(field, { dungeon: 1 });
    assert.deepEqual(useDungeonWarp(locked, 'demo_dungeon'), { ok: false, reason: 'dungeon_locked' });
    assert.deepEqual(useDungeonWarp(locked, 'nope'), { ok: false, reason: 'unknown_dungeon' });
    assert.equal(locked.inventory.count('dungeon_warp_scroll'), 1);
  });

  test('dungeon warp lands at the entrance of a discovered dungeon, never the boss room', () => {
    const c = ctx(field, { dungeon: 1 });
    c.unlocks.dungeons.add('demo_dungeon');
    assert.deepEqual(useDungeonWarp(c, 'demo_dungeon'), {
      ok: true,
      destination: { kind: 'dungeon', mapId: DUNGEON_WARPS.demo_dungeon.entranceMapId },
      leftDungeon: false,
    });
    assert.equal(c.inventory.count('dungeon_warp_scroll'), 0);
    assert.deepEqual(useDungeonWarp(c, 'demo_dungeon'), { ok: false, reason: 'no_scroll' });
  });

  test('portals are free and only work from their own map', () => {
    assert.deepEqual(usePortal(field, 'demo_field_to_town'), { ok: true, toMapId: 'demo_town' });
    assert.deepEqual(usePortal(field, 'demo_town_to_field'), { ok: false, reason: 'not_here' });
    assert.deepEqual(usePortal(field, 'nope'), { ok: false, reason: 'unknown_portal' });
  });
});

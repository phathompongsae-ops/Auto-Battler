import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { EQUIPMENT_DEFS } from '../../src/data/equipmentItems';
import { BAG_CAPACITY, DEFAULT_MAX_STACK, equipmentSellValue } from '../../src/data/inventoryData';
import { ITEMS, LOOT_TABLES, type ItemId } from '../../src/data/itemData';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { PlayerActions } from '../../src/game/PlayerActions';
import { Bag } from '../../src/inventory/Bag';
import { formatComparison, itemStatSections, previewEquip } from '../../src/inventory/itemInfo';
import { LootSystem, type LootCollector, type LootDrop } from '../../src/loot/LootSystem';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { makeSaveTarget } from './fixtures';

/** A character with a bag and the real equip / unequip actions (Equipment is unlocked from Lv1). */
function rig(level = 1, capacity = BAG_CAPACITY) {
  const t = makeSaveTarget(level);
  const bag = new Bag(t.inventory, t.equipment, capacity);
  const actions = new PlayerActions({
    features: t.featureProgression,
    inventory: t.inventory,
    wallet: t.wallet,
    equipment: t.equipment,
    pets: t.pets,
    crafting: t.crafting,
    shop: t.shop,
    warpUnlocks: t.warp,
    events: t.events,
    rng: () => seededRng(1),
    world: { location: () => ({ kind: 'field', mapId: 'demo_field' }), inCombat: () => false, arrive: () => {}, startDungeonRun: (id, d) => t.ledger.startRun(id, d, 1) },
    bag,
  });
  const ids = sequentialIds('eq');
  const give = (defId: string, seed = 1) => {
    const item = createEquipment(defId, seededRng(seed), ids);
    t.equipment.add(item);
    return item.instanceId;
  };
  return { t, bag, actions, give };
}

/** A loot system wired like the game: the bag receives loot; equipment drops become instances. */
function lootRig(capacity = BAG_CAPACITY) {
  const r = rig(1, capacity);
  const loot = new LootSystem(r.t.events, r.t.inventory);
  loot.rng = () => 0;
  const ids = sequentialIds('loot');
  loot.receiver = {
    id: 'p',
    store: (drop: LootDrop) => {
      if (drop.kind === 'item') {
        if (!r.bag.hasRoomForItem(drop.itemId)) return { ok: false, reason: 'inventory_full' };
        r.t.inventory.add(drop.itemId);
        return { ok: true };
      }
      if (!r.bag.hasRoomForEquipment()) return { ok: false, reason: 'inventory_full' };
      const item = createEquipment(drop.defId, seededRng(2), ids);
      r.t.equipment.add(item);
      return { ok: true, instanceId: item.instanceId };
    },
  };
  const log: { type: string; [k: string]: unknown }[] = [];
  for (const type of ['lootDropped', 'lootPicked', 'equipmentDropped', 'equipmentPicked', 'lootBlocked', 'itemAcquired'] as const) {
    r.t.events.on(type, (e) => log.push({ type, ...e }));
  }
  const player = { id: 'p', x: 0, y: 0, hitRadius: 10, combat: r.t.combat };
  return { ...r, loot, log, player };
}

describe('item metadata', () => {
  test('every item has a type, a rarity and a sell value; equipment sell value scales with rarity, level and enhancement', () => {
    for (const def of Object.values(ITEMS)) {
      assert.ok(['consumable', 'material', 'quest', 'misc'].includes(def.type), def.id);
      assert.ok(Number.isInteger(def.sellValue) && def.sellValue >= 0, def.id);
    }
    assert.equal(ITEMS.slime_sample.sellValue, 0, 'quest items are not sellable');
    const cap = EQUIPMENT_DEFS.traveler_cap;
    const sword = EQUIPMENT_DEFS.knight_sword;
    assert.ok(equipmentSellValue(sword) > equipmentSellValue(cap));
    assert.ok(equipmentSellValue(cap, 5) > equipmentSellValue(cap, 0));
  });

  test('equipment loot entries name real equipment', () => {
    for (const entries of Object.values(LOOT_TABLES)) for (const e of entries) if ('equipmentId' in e) assert.ok(EQUIPMENT_DEFS[e.equipmentId], e.equipmentId);
  });
});

describe('bag: stacking, capacity, sorting', () => {
  test('materials stack (one slot per full stack); unequipped equipment takes one slot each; equipped gear takes none', () => {
    const { t, bag, give, actions } = rig();
    t.inventory.add('slime_gel', 5);
    t.inventory.add('slime_gel', 7);
    assert.equal(bag.usedSlots(), 1, 'one stack');
    assert.equal(bag.entries().find((e) => e.kind === 'item')!.kind === 'item' && bag.entries()[0].kind === 'item' ? (bag.entries()[0] as { count: number }).count : -1, 12);
    t.inventory.add('slime_gel', DEFAULT_MAX_STACK); // 1011 → 2 stacks
    assert.equal(bag.usedSlots(), 2);
    assert.deepEqual(
      bag.entries('materials').map((e) => (e.kind === 'item' ? e.count : 0)),
      [DEFAULT_MAX_STACK, 12],
    );
    const cap = give('traveler_cap');
    assert.equal(bag.usedSlots(), 3);
    assert.ok(actions.equip(cap).ok);
    assert.equal(bag.usedSlots(), 2, 'equipped items leave the bag');
  });

  test('room checks use free space in existing stacks before new slots', () => {
    const { t, bag } = rig(1, 2);
    t.inventory.add('slime_gel', DEFAULT_MAX_STACK - 1);
    t.inventory.add('wolf_fang', 1);
    assert.equal(bag.isFull(), true);
    assert.equal(bag.hasRoomForItem('slime_gel'), true, 'the slime stack has 1 left');
    assert.equal(bag.hasRoomForItem('slime_gel', 2), false);
    assert.equal(bag.hasRoomForItem('mushroom_cap'), false, 'a new item needs a new slot');
    assert.equal(bag.hasRoomForEquipment(), false);
  });

  test('sorted by type (equipment by slot, then consumable / material / quest / misc), rarity high→low, then name', () => {
    const { t, bag, give } = rig();
    for (const id of ['slime_sample', 'egg_basic', 'slime_gel', 'enchant_stone', 'town_warp_scroll', 'boar_tusk'] as ItemId[]) t.inventory.add(id, 1);
    give('traveler_boots');
    give('quartz_ring');
    give('traveler_cap');
    give('iron_sword');
    assert.deepEqual(
      bag.entries().map((e) => (e.kind === 'item' ? e.itemId : e.item.defId)),
      ['iron_sword', 'traveler_cap', 'traveler_boots', 'quartz_ring', 'town_warp_scroll', 'enchant_stone', 'boar_tusk', 'slime_gel', 'slime_sample', 'egg_basic'],
    );
    assert.deepEqual(bag.entries('equipment').map((e) => e.kind), ['equipment', 'equipment', 'equipment', 'equipment']);
    assert.ok(bag.entries('materials').every((e) => e.kind === 'item'));
  });
});

describe('equip / unequip with immediate stats', () => {
  test('equipping changes stats at once; unequipping restores them exactly; the comparison predicts the change', () => {
    const { t, actions, give } = rig();
    const bare = { ...t.combat.stats };
    const cap = give('traveler_cap');
    const preview = previewEquip({ progress: t.progress, level: t.combat.level, modifiers: t.stack.list(), statuses: [], equipment: t.equipment }, cap)!;
    assert.equal(preview.slotItem, null);
    const hp = preview.changes.find((c) => c.key === 'maxHp')!;
    assert.ok(hp.delta > 0);
    assert.match(formatComparison(hp), /^Max HP \d+ → \d+ \(\+\d+\)$/);

    assert.ok(actions.equip(cap).ok);
    assert.equal(t.combat.stats.maxHp, hp.after, 'the preview is exactly what equipping does');
    assert.ok(t.combat.stats.defense > bare.defense);
    const off = actions.unequip('head');
    assert.deepEqual(off, { ok: true, instanceId: cap });
    assert.deepEqual({ ...t.combat.stats }, bare);
  });

  test('comparing against the equipped item in the same slot (swap shows a difference, not a sum)', () => {
    const { t, actions, give } = rig();
    const vest = give('traveler_vest', 3);
    const plate = give('traveler_vest', 9);
    actions.equip(vest);
    const p = previewEquip({ progress: t.progress, level: t.combat.level, modifiers: t.stack.list(), statuses: [], equipment: t.equipment }, plate)!;
    assert.equal(p.slotItem?.instanceId, vest);
    // Same base: only the rolled enchant line can differ.
    for (const c of p.changes) assert.ok(Math.abs(c.delta) < 200, c.label);
  });

  test('items the job cannot use have no preview and cannot be equipped', () => {
    const { t, actions, give } = rig();
    const sword = give('iron_sword');
    assert.equal(previewEquip({ progress: t.progress, level: 1, modifiers: [], statuses: [], equipment: t.equipment }, sword), null);
    const r = actions.equip(sword);
    assert.ok(!r.ok && r.reason === 'class_restricted');
  });

  test('readable stat sections per layer: base, enhanced base, enchant', () => {
    const { t, give } = rig();
    const id = give('traveler_cap');
    const item = t.equipment.items.get(id)!;
    item.enhancement = 3;
    const sections = itemStatSections(item);
    assert.deepEqual(sections.map((s) => s.layer).filter((l) => l !== 'definition'), ['enhancement', 'enchant']);
    assert.ok(sections.find((s) => s.layer === 'enhancement')!.lines.some((l) => l.startsWith('DEF +')));
  });
});

describe('inventory full', () => {
  test('unequip needs a free bag slot; a one-for-one swap does not', () => {
    const { t, bag, actions, give } = rig(1, 2);
    const a = give('traveler_vest', 1);
    const b = give('traveler_vest', 2);
    assert.ok(actions.equip(a).ok);
    t.inventory.add('slime_gel', 1); // bag: vest b + slime = 2 / 2
    assert.equal(bag.isFull(), true);
    assert.deepEqual(actions.unequip('armor'), { ok: false, reason: 'inventory_full' });
    assert.equal(t.equipment.equipped.armor, a, 'nothing changed');
    assert.ok(actions.equip(b).ok, 'swap: a comes back as b leaves');
    assert.equal(t.equipment.equipped.armor, b);
  });

  test('loot: auto-loot falls back to the ground when the bag is full (reported once), then a collector picks it up after space frees', () => {
    const r = lootRig(1);
    r.t.inventory.add('enhancement_stone', 1); // full
    const [drop] = r.loot.rollEntries([{ itemId: 'wolf_fang', chance: 1 }], 0, 0, 0);
    assert.equal(drop.delivery, 'ground');
    assert.equal(r.loot.drops.length, 1);
    assert.equal(r.log.filter((e) => e.type === 'lootBlocked').length, 1);
    r.loot.update(10, r.player);
    r.loot.update(20, r.player);
    assert.equal(r.log.filter((e) => e.type === 'lootBlocked').length, 1, 'reported once');
    assert.equal(r.t.inventory.count('wolf_fang'), 0);
    r.t.inventory.remove('enhancement_stone', 1);
    r.loot.update(30, r.player);
    assert.equal(r.t.inventory.count('wolf_fang'), 1);
    assert.equal(r.loot.drops.length, 0);
  });
});

describe('loot pipeline: auto-loot, ground drops, collectors', () => {
  test('normal rewards are auto-looted (never on the ground); rare materials and equipment wait on the ground', () => {
    const r = lootRig();
    const rolled = r.loot.roll('elite_boar', 100, 100, 0);
    assert.deepEqual(rolled.map((d) => [d.kind === 'item' ? d.itemId : d.defId, d.delivery]), [
      ['boar_tusk', 'auto'],
      ['enhancement_stone', 'ground'],
      ['iron_sword', 'ground'],
      ['traveler_vest', 'ground'],
    ]);
    assert.equal(r.t.inventory.count('boar_tusk'), 1);
    assert.equal(r.log.some((e) => e.type === 'lootPicked' && e.itemId === 'boar_tusk' && e.auto === true), true);
    assert.equal(r.loot.drops.length, 3);
    assert.equal(r.log.filter((e) => e.type === 'equipmentDropped').length, 2);

    r.player.x = 120; // drops are spaced 10 px apart from x=100
    r.player.y = 100;
    r.loot.update(1, r.player);
    assert.equal(r.loot.drops.length, 0);
    assert.equal(r.t.inventory.count('enhancement_stone'), 1);
    const picked = r.log.filter((e) => e.type === 'equipmentPicked');
    assert.deepEqual(picked.map((e) => e.defId).sort(), ['iron_sword', 'traveler_vest']);
    for (const p of picked) assert.ok(r.t.equipment.items.has(p.instanceId as string), 'a real owned instance');
  });

  test('a second collector (e.g. a future pet) picks up ground drops with its own radius, through the same rules', () => {
    const r = lootRig();
    r.loot.rollEntries([{ itemId: 'enchant_stone', chance: 1, category: 'rare' }], 300, 300, 0);
    const pet: LootCollector = { id: 'pet-1', position: () => ({ x: 250, y: 300 }), radius: 80, active: () => true };
    r.loot.addCollector(pet);
    r.loot.update(1, r.player); // the player is far away
    assert.equal(r.t.inventory.count('enchant_stone'), 1);
    assert.equal(r.log.find((e) => e.type === 'lootPicked')?.byId, 'pet-1');
    r.loot.removeCollector('pet-1');
  });

  test('without a receiver (engine-free tests) every drop stays on the ground, as before', () => {
    const r = rig();
    const loot = new LootSystem(r.t.events, r.t.inventory);
    loot.rng = () => 0;
    const drops = loot.roll('slime', 0, 0, 0);
    assert.deepEqual(drops.map((d) => d.delivery), ['ground', 'ground']);
    assert.equal(loot.drops.length, 2);
  });
});

describe('save / load of the bag and equipped gear', () => {
  test('stacks, owned and equipped equipment (with enhancement and enchants) survive save / load; stats match', () => {
    const { t, actions, give } = rig(15);
    t.inventory.add('slime_gel', 1200);
    t.inventory.add('enhancement_stone', 3);
    const cap = give('traveler_cap', 4);
    const vest = give('traveler_vest', 5);
    t.equipment.items.get(vest)!.enhancement = 4;
    assert.ok(actions.equip(vest).ok);
    const stats = { ...t.combat.stats };
    const text = serializePlayerSave(capturePlayerSave(t));

    const l = rig(1);
    applyPlayerSave(l.t, deserializePlayerSave(text));
    assert.equal(l.t.inventory.count('slime_gel'), 1200);
    assert.equal(l.bag.usedSlots(), 2 + 1 + 1, 'two slime stacks, stones, the cap');
    assert.equal(l.t.equipment.equipped.armor, vest);
    assert.deepEqual(l.t.equipment.items.get(cap), t.equipment.items.get(cap));
    assert.equal(l.t.equipment.items.get(vest)!.enhancement, 4);
    assert.deepEqual({ ...l.t.combat.stats }, stats);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CombatantState } from '../../src/combat/CombatantState';
import { ManualClock } from '../../src/core/clock';
import { seededRng } from '../../src/core/rng';
import { EGG_RARITY_TABLES, EGG_TIERS, PET_MAX_LEVEL, PET_SPECIES, RANDOM_EGG_TICKET_TIERS, SPECIAL_SHOP } from '../../src/data/petData';
import { Wallet } from '../../src/economy/Wallet';
import { sequentialIds } from '../../src/equipment/factory';
import { Inventory } from '../../src/loot/Inventory';
import { openEgg, useRandomEggTicket } from '../../src/pets/eggActions';
import { petPrimaryBonus, petStatPoint, PetCollection, rollPetRarity, rollTicketEggTier, type PetInstance } from '../../src/pets/pets';
import { shopCycleId, SpecialShop } from '../../src/pets/specialShop';
import { CharacterProgress } from '../../src/progression/CharacterProgress';
import { finalPrimary } from '../../src/stats/modifiers';
import { ModifierStack } from '../../src/stats/ModifierStack';
import { playerCombatStats } from '../../src/stats/playerCombatStats';

const pet = (id: string, speciesId: PetInstance['speciesId'], rarity: PetInstance['rarity'], level = 50, passiveIds: PetInstance['mutation']['passiveIds'] = []): PetInstance => ({
  petInstanceId: id,
  speciesId,
  rarity,
  level,
  mutation: { mutated: passiveIds.length > 0, passiveIds, variant: null },
});

function makeOwner() {
  const progress = new CharacterProgress();
  let combat: CombatantState | null = null;
  const stack = new ModifierStack(() => combat?.refreshStats());
  combat = new CombatantState('p', 'P', 'player', (lv, st) => playerCombatStats(progress, lv, stack.list(), st), 1);
  const pets = new PetCollection((mods) => stack.replaceSource('pet', mods));
  return { progress, combat, stack, pets };
}

describe('pet stats', () => {
  test('locked max-level targets per rarity', () => {
    assert.equal(PET_MAX_LEVEL, 50);
    assert.deepEqual(petStatPoint('common', 50), { all: 2, main: 5 });
    assert.deepEqual(petStatPoint('rare', 50), { all: 5, main: 10 });
    assert.deepEqual(petStatPoint('epic', 50), { all: 8, main: 15 });
    assert.deepEqual(petStatPoint('legendary', 50), { all: 15, main: 25 });
  });

  test('Legendary curve: Lv1 5/10, Lv25 10/18, Lv50 15/25; deterministic between', () => {
    assert.deepEqual(petStatPoint('legendary', 1), { all: 5, main: 10 });
    assert.deepEqual(petStatPoint('legendary', 25), { all: 10, main: 18 });
    assert.deepEqual(petStatPoint('legendary', 50), { all: 15, main: 25 });
    assert.deepEqual(petStatPoint('legendary', 13), petStatPoint('legendary', 13));
    for (let lv = 2; lv <= 50; lv++) {
      const a = petStatPoint('legendary', lv - 1);
      const b = petStatPoint('legendary', lv);
      assert.ok(b.all >= a.all && b.main >= a.main, `Lv${lv}`);
    }
    assert.throws(() => petStatPoint('legendary', 51));
  });

  test('INT Dragon Legendary Lv50: every stat +15, INT +25 (not +40)', () => {
    assert.equal(PET_SPECIES.dragon.mainStat, 'int');
    assert.deepEqual(petPrimaryBonus(pet('d', 'dragon', 'legendary')), { str: 15, agi: 15, vit: 15, int: 25, dex: 15, luk: 15 });
  });

  test('species main stats: Wolf STR, Turtle VIT, Dragon INT', () => {
    assert.equal(PET_SPECIES.wolf.mainStat, 'str');
    assert.equal(PET_SPECIES.turtle.mainStat, 'vit');
    assert.equal(PET_SPECIES.dragon.mainStat, 'int');
  });
});

describe('active pet', () => {
  test('only the active pet contributes; owning more adds nothing', () => {
    const o = makeOwner();
    o.pets.add(pet('w', 'wolf', 'legendary'));
    o.pets.add(pet('t', 'turtle', 'epic'));
    assert.deepEqual(finalPrimary([...o.progress.modifiers(), ...o.stack.list()]), { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 });
    o.pets.setActive('w');
    const withWolf = finalPrimary([...o.progress.modifiers(), ...o.stack.list()]);
    assert.deepEqual(withWolf, { str: 30, agi: 20, vit: 20, int: 20, dex: 20, luk: 20 });
  });

  test('switching removes the previous pet; clearing removes everything', () => {
    const o = makeOwner();
    o.pets.add(pet('w', 'wolf', 'legendary'));
    o.pets.add(pet('t', 'turtle', 'rare'));
    o.pets.setActive('w');
    const hpWolf = o.combat.stats.maxHp;
    o.pets.setActive('t');
    assert.equal(o.stack.list().filter((m) => m.source === 'pet').length, 1);
    assert.equal(finalPrimary(o.stack.list()).str, 5); // rare all = 5
    assert.equal(finalPrimary(o.stack.list()).vit, 10); // turtle main
    assert.equal(o.combat.stats.maxHp, hpWolf + (10 - 15) * 25);
    o.pets.setActive(null);
    assert.equal(o.stack.list().length, 0);
    assert.equal(o.pets.setActive('missing'), false);
  });

  test('level change on the active pet refreshes stats', () => {
    const o = makeOwner();
    o.pets.add(pet('w', 'wolf', 'legendary', 1));
    o.pets.setActive('w');
    assert.equal(finalPrimary(o.stack.list()).str, 10);
    o.pets.setLevel('w', 50);
    assert.equal(finalPrimary(o.stack.list()).str, 25);
  });

  test('mutation passive applies only through the active mutated pet', () => {
    const o = makeOwner();
    o.pets.add(pet('m', 'turtle', 'common', 1, ['demo_tranquil_mind']));
    const base = o.combat.stats.healPower;
    o.pets.setActive('m');
    // +1% from the passive, +0.4% from the pet's own INT +1 (Common Lv1: all +1).
    assert.ok(Math.abs(o.combat.stats.healPower - base - (0.01 + 0.004)) < 1e-9);
  });
});

describe('eggs and the Random Egg Ticket', () => {
  test('every table totals 100', () => {
    for (const tier of EGG_TIERS) {
      const total = Object.values(EGG_RARITY_TABLES[tier]).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - 100) < 1e-9, tier);
    }
    assert.ok(Math.abs(Object.values(RANDOM_EGG_TICKET_TIERS).reduce((a, b) => a + b, 0) - 100) < 1e-9);
    assert.deepEqual(EGG_RARITY_TABLES.basic, { common: 85, rare: 13.5, epic: 1.3, legendary: 0.2 });
    assert.deepEqual(EGG_RARITY_TABLES.ancient, { common: 0, rare: 25, epic: 60, legendary: 15 });
    assert.deepEqual(RANDOM_EGG_TICKET_TIERS, { basic: 70, fine: 25, mystic: 4.5, ancient: 0.5 });
  });

  test('deterministic rolls land in the right band', () => {
    const at = (x: number) => () => x;
    assert.equal(rollPetRarity('basic', at(0.84)), 'common');
    assert.equal(rollPetRarity('basic', at(0.86)), 'rare');
    assert.equal(rollPetRarity('basic', at(0.99)), 'epic');
    assert.equal(rollPetRarity('basic', at(0.999)), 'legendary');
    assert.equal(rollPetRarity('ancient', at(0)), 'rare'); // 0% common is never picked
    assert.equal(rollTicketEggTier(at(0.69)), 'basic');
    assert.equal(rollTicketEggTier(at(0.94)), 'fine');
    assert.equal(rollTicketEggTier(at(0.99)), 'mystic');
    assert.equal(rollTicketEggTier(at(0.9999)), 'ancient');
  });

  test('a ticket becomes an egg, not a pet; opening the egg makes the pet', () => {
    const inventory = new Inventory();
    const pets = new PetCollection();
    inventory.add('random_egg_ticket');
    const r = useRandomEggTicket(inventory, () => 0.1);
    assert.deepEqual(r, { ok: true, tier: 'basic' });
    assert.equal(pets.owned.size, 0);
    assert.equal(inventory.count('egg_basic'), 1);
    assert.equal(inventory.count('random_egg_ticket'), 0);
    const opened = openEgg(inventory, pets, 'basic', seededRng(4), sequentialIds('pet'));
    assert.equal(opened.ok, true);
    assert.equal(pets.owned.size, 1);
    assert.equal(inventory.count('egg_basic'), 0);
    assert.deepEqual(openEgg(inventory, pets, 'basic', seededRng(4), sequentialIds('pet')), { ok: false, reason: 'no_egg' });
    assert.deepEqual(useRandomEggTicket(inventory, () => 0), { ok: false, reason: 'no_ticket' });
  });

  test('hatched pets are Lv1, from the demo species pool, unmutated (hook unset)', () => {
    const pets = new PetCollection();
    const inventory = new Inventory();
    inventory.add('egg_fine', 30);
    const ids = sequentialIds('pet');
    for (let i = 0; i < 30; i++) openEgg(inventory, pets, 'fine', seededRng(i), ids);
    for (const p of pets.owned.values()) {
      assert.equal(p.level, 1);
      assert.ok(['wolf', 'turtle', 'dragon'].includes(p.speciesId));
      assert.equal(p.mutation.mutated, false);
    }
  });
});

describe('special shop refresh', () => {
  // 2026-10-03 11:59 and 12:00 in UTC+7 (the DEMO shop timezone).
  const at = (h: number, m: number, day = 3) => Date.UTC(2026, 9, day, h - 7, m);

  test('cycles change at 12:00 local shop time', () => {
    assert.equal(SPECIAL_SHOP.refreshHour, 12);
    assert.equal(shopCycleId(at(11, 59)) + 1, shopCycleId(at(12, 0)));
    assert.equal(shopCycleId(at(12, 0)), shopCycleId(at(11, 59, 4)));
    assert.equal(shopCycleId(at(12, 0)) + 1, shopCycleId(at(12, 0, 4)));
  });

  test('one ticket per refresh cycle; the next noon allows another', () => {
    const clock = new ManualClock(at(9, 0));
    const shop = new SpecialShop(clock);
    const inventory = new Inventory();
    const wallet = new Wallet();
    assert.equal(shop.buyRandomEggTicket(inventory, wallet).ok, true);
    assert.deepEqual(shop.buyRandomEggTicket(inventory, wallet), { ok: false, reason: 'limit_reached' });
    clock.set(at(11, 59));
    assert.equal(shop.ticketsLeft(), 0);
    clock.set(at(12, 0));
    assert.equal(shop.ticketsLeft(), 1);
    assert.equal(shop.buyRandomEggTicket(inventory, wallet).ok, true);
    assert.equal(inventory.count('random_egg_ticket'), 2);
  });
});

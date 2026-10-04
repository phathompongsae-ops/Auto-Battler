import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { useItem } from '../../src/items/useItem';
import { allocateStat, changeJob } from '../../src/progression/statActions';
import {
  deserializePlayerSave,
  newPlayerSave,
  PLAYER_SAVE_VERSION,
  SaveError,
  serializePlayerSave,
  type PlayerSave,
} from '../../src/save/playerSave';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { zeroPrimary } from '../../src/stats/primaryStats';
import { makeSaveTarget } from './fixtures';

/** A mid-game character with every system populated. */
function midGame() {
  const t = makeSaveTarget(15);
  t.combat.exp = 123;
  changeJob(t, 'warrior');
  allocateStat(t, 'str', 6);
  allocateStat(t, 'vit', 3);
  t.progress.skillPointsSpent = 4;
  t.inventory.add('slime_gel', 7);
  t.inventory.add('stat_reset_test', 1);
  t.inventory.add('egg_fine', 2);
  t.inventory.add('town_warp_scroll', 3);
  t.wallet.add('gold', 250);

  const ids = sequentialIds('eq');
  const rng = seededRng(8);
  for (const defId of ['knight_sword', 'oak_shield', 'guardian_helm', 'guardian_plate', 'copper_ring', 'steel_greatsword']) {
    t.equipment.add(createEquipment(defId, rng, ids));
  }
  t.equipment.items.get('eq-1')!.enhancement = 12;
  for (const id of ['eq-1', 'eq-2', 'eq-3', 'eq-4', 'eq-5']) assert.equal(t.equipment.equip(id).ok, true);

  t.pets.add({ petInstanceId: 'pet-1', speciesId: 'dragon', rarity: 'legendary', level: 30, mutation: { mutated: true, passiveIds: ['demo_tranquil_mind'], variant: 'demo_glow' } });
  t.pets.add({ petInstanceId: 'pet-2', speciesId: 'wolf', rarity: 'common', level: 3, mutation: { mutated: false, passiveIds: [], variant: null } });
  t.pets.setActive('pet-1');

  t.shop.buyRandomEggTicket(t.inventory, t.wallet);
  t.inventory.add('blueprint_warborn');
  t.inventory.add('boss_fragment', 4);
  t.inventory.add('rare_craft_material', 2);
  t.wallet.add('gold', 6000);
  assert.equal(t.crafting.start('demo_warborn_plate', t.inventory, t.wallet, sequentialIds('job')).ok, true);
  t.warp.dungeons.add('demo_dungeon');
  t.warp.homeTown = 'demo_town';
  t.ledger.claimed.add('demo_dungeon:hard:run-1');

  t.hooks.energy = { current: 40, updatedAt: 1_700_000_000_000 };
  t.hooks.quests = { 'slime-trouble': { state: 'active', progress: { slime: 3 } } };
  t.hooks.dungeons = { demo_dungeon: { cleared: ['normal'] } };
  return t;
}

const roundTrip = (save: PlayerSave) => deserializePlayerSave(serializePlayerSave(save));

describe('player save v3', () => {
  test('version and stable ids', () => {
    assert.equal(PLAYER_SAVE_VERSION, 3);
    const save = capturePlayerSave(midGame());
    assert.equal(save.schemaVersion, 3);
    assert.equal(save.classId, 'warrior');
    assert.equal('className' in save, false);
  });

  test('state -> serialize -> deserialize -> same state', () => {
    const save = capturePlayerSave(midGame());
    assert.deepEqual(roundTrip(save), save);
  });

  test('loading restores every system and the same derived stats', () => {
    const original = midGame();
    const save = capturePlayerSave(original);
    const loaded = makeSaveTarget(1);
    applyPlayerSave(loaded, roundTrip(save));
    assert.deepEqual(capturePlayerSave(loaded), save);
    assert.deepEqual(loaded.combat.stats, original.combat.stats);
    assert.equal(loaded.equipment.items.get('eq-1')!.enhancement, 12);
    assert.deepEqual(loaded.equipment.items.get('eq-1')!.enchants, original.equipment.items.get('eq-1')!.enchants);
    assert.equal(loaded.pets.activeId, 'pet-1');
    assert.equal(loaded.shop.ticketsLeft(), 0);
    assert.equal(loaded.crafting.jobs.length, 1);
    assert.equal(loaded.warp.dungeons.has('demo_dungeon'), true);
    assert.equal(loaded.ledger.claimed.has('demo_dungeon:hard:run-1'), true);
  });

  test('job bonus and allocated stats stay distinct after load', () => {
    const loaded = makeSaveTarget(1);
    applyPlayerSave(loaded, roundTrip(capturePlayerSave(midGame())));
    assert.deepEqual(loaded.progress.jobBonuses, { warrior: { str: 3, vit: 2 } });
    assert.deepEqual(loaded.progress.allocated, { ...zeroPrimary(), str: 6, vit: 3 });
  });

  test('a reset state stays valid through save/load', () => {
    const t = midGame();
    assert.equal(useItem(t.inventory, t, 'stat_reset_test').ok, true);
    const save = roundTrip(capturePlayerSave(t));
    assert.deepEqual(save.stats.allocated, zeroPrimary());
    assert.equal(save.unspentStatPoints, 14);
  });

  test('derived totals are never stored', () => {
    const json = serializePlayerSave(capturePlayerSave(midGame()));
    for (const derived of ['maxHp', 'maxMp', '"attack"', 'physicalAtk', 'critRate', 'activeSets', 'setBonus', '"all"', '"main"', 'enhancedBase', 'skillDamage']) {
      assert.equal(json.includes(derived.startsWith('"') ? derived : `"${derived}"`), false, derived);
    }
  });

  test('a new character save is valid', () => {
    const save = newPlayerSave('char-new');
    assert.deepEqual(roundTrip(save), save);
  });
});

describe('save migration', () => {
  const v2From = (save: PlayerSave): Record<string, unknown> => {
    const { equipment: _e, pets: _p, specialShop: _s, crafting: _c, warp: _w, claimedClears: _l, ...rest } = save;
    void [_e, _p, _s, _c, _w, _l];
    return { ...rest, schemaVersion: 2, equipment: {}, activePetId: null };
  };

  test('v2 -> v3: inputs intact, new systems start empty', () => {
    const t = makeSaveTarget(15);
    changeJob(t, 'warrior');
    allocateStat(t, 'str', 4);
    t.wallet.add('gold', 99);
    const current = capturePlayerSave(t);
    const migrated = deserializePlayerSave(JSON.stringify(v2From(current)));
    assert.deepEqual(migrated, current);
  });

  test('v1 -> v3 chains through v2', () => {
    const t = makeSaveTarget(15);
    changeJob(t, 'warrior');
    const current = capturePlayerSave(t);
    const { skillPointsSpent: _s, ...v2 } = v2From(current);
    void _s;
    const migrated = deserializePlayerSave(JSON.stringify({ ...v2, schemaVersion: 1, skillPoints: 0 }));
    assert.deepEqual(migrated, current);
  });

  test('a v2 save referencing items or pets it could not own is rejected', () => {
    const v2 = v2From(capturePlayerSave(makeSaveTarget(1)));
    assert.throws(() => deserializePlayerSave(JSON.stringify({ ...v2, equipment: { weapon: 'eq-9' } })), /cannot migrate/);
    assert.throws(() => deserializePlayerSave(JSON.stringify({ ...v2, activePetId: 'pet-9' })), /cannot migrate/);
  });

  test('unsupported versions are rejected', () => {
    assert.throws(() => deserializePlayerSave(JSON.stringify({ schemaVersion: 99 })), /unsupported save version/);
  });
});

describe('impossible state is rejected', () => {
  const bad = (mutate: (s: PlayerSave) => void) => {
    const s = structuredClone(capturePlayerSave(midGame()));
    mutate(s);
    return () => deserializePlayerSave(JSON.stringify(s));
  };

  test('core rules', () => {
    assert.throws(() => deserializePlayerSave('not json'), SaveError);
    assert.throws(bad((s) => ((s as { classId: string }).classId = 'Warrior')), /classId/);
    assert.throws(bad((s) => (s.stats.allocated.str = 50)), /more stat points/);
    assert.throws(bad((s) => (s.unspentStatPoints = 99)), /unspentStatPoints/);
    assert.throws(bad((s) => (s.skillPointsSpent = 6)), /more skill points spent/);
    assert.throws(bad((s) => (s.inventory = [{ itemId: 'nope' as never, count: 1 }])), /inventory/);
  });

  test('equipment', () => {
    assert.throws(bad((s) => (s.equipment.items[0].enhancement = 16)), /enhancement/);
    assert.throws(bad((s) => (s.equipment.items[1].instanceId = 'eq-1')), /duplicate instance/);
    assert.throws(bad((s) => (s.equipment.items[0].enchants[0].optionId = 'max_hp')), /cannot roll/);
    assert.throws(bad((s) => (s.equipment.items[0].enchants[0].value = 9999)), /out of range/);
    assert.throws(bad((s) => (s.equipment.items[0].enchants[0].quality = 'perfect')), /impossible/);
    assert.throws(bad((s) => (s.equipment.equipped.weapon = 'eq-6')), /equipped/); // 2H with an off-hand
    assert.throws(bad((s) => (s.equipment.equipped.armor = 'eq-3')), /wrong_slot|already_equipped/);
    assert.throws(bad((s) => (s.equipment.equipped.ring_2 = 'eq-5')), /already_equipped/);
    assert.throws(bad((s) => ((s as { classId: string }).classId = 'archer')), /class_restricted|weapon_not_allowed/);
  });

  test('pets, shop, crafting, warp, claims', () => {
    assert.throws(bad((s) => (s.pets.owned[0].level = 51)), /level/);
    assert.throws(bad((s) => (s.pets.activePetId = 'pet-9')), /activePetId/);
    assert.throws(bad((s) => (s.pets.owned[0].mutation.passiveIds = ['nope' as never])), /unknown ids/);
    assert.throws(bad((s) => (s.specialShop.ticketsBought = 2)), /specialShop/);
    assert.throws(bad((s) => (s.crafting.jobs[0].completesAt += 1)), /timing/);
    assert.throws(bad((s) => (s.crafting.jobs[0].recipeId = 'nope')), /unknown recipe/);
    assert.throws(bad((s) => (s.warp.homeTown = 'nowhere')), /homeTown/);
    assert.throws(bad((s) => (s.warp.dungeons = ['nope'])), /unknown ids/);
    assert.throws(bad((s) => (s.claimedClears = ['a', 'a'])), /duplicates/);
  });
});

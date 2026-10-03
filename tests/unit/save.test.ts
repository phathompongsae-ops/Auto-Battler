import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CombatantState } from '../../src/combat/CombatantState';
import { useItem } from '../../src/items/useItem';
import { Inventory } from '../../src/loot/Inventory';
import { CharacterProgress } from '../../src/progression/CharacterProgress';
import { allocateStat, changeJob } from '../../src/progression/statActions';
import {
  deserializePlayerSave,
  newPlayerSave,
  PLAYER_SAVE_VERSION,
  SaveError,
  serializePlayerSave,
  type PlayerSave,
} from '../../src/save/playerSave';
import { applyPlayerSave, capturePlayerSave, emptyHooks, type SaveTarget } from '../../src/save/playerSnapshot';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { zeroPrimary } from '../../src/stats/primaryStats';

function makeTarget(level = 1): SaveTarget {
  const progress = new CharacterProgress();
  const combat = new CombatantState('p', 'P', 'player', (lv) => playerCombatStats(progress, lv), level);
  return { characterId: 'char-1', progress, combat, inventory: new Inventory(), hooks: emptyHooks() };
}

/** A mid-game character: Warrior, allocated points, items, hooks filled in. */
function midGame(): SaveTarget {
  const t = makeTarget(15);
  t.combat.exp = 123;
  changeJob(t, 'warrior');
  allocateStat(t, 'str', 6);
  allocateStat(t, 'vit', 3);
  t.progress.skillPointsSpent = 4;
  t.inventory.add('slime_gel', 7);
  t.inventory.add('stat_reset_test', 1);
  t.hooks.currencies = { gold: 250 };
  t.hooks.equipment = { weapon: 'item-inst-1', armor: null };
  t.hooks.activePetId = 'pet-inst-9';
  t.hooks.energy = { current: 40, updatedAt: 1_700_000_000_000 };
  t.hooks.quests = { 'slime-trouble': { state: 'active', progress: { slime: 3 } } };
  t.hooks.dungeons = { 'green-cave': { cleared: ['normal'] } };
  return t;
}

const roundTrip = (save: PlayerSave) => deserializePlayerSave(serializePlayerSave(save));

describe('player save v1', () => {
  test('schema version and stable ids', () => {
    const save = capturePlayerSave(midGame());
    assert.equal(save.schemaVersion, PLAYER_SAVE_VERSION);
    assert.equal(save.classId, 'warrior');
    assert.equal('className' in save, false);
  });

  test('state -> serialize -> deserialize -> same state', () => {
    const save = capturePlayerSave(midGame());
    assert.deepEqual(roundTrip(save), save);
  });

  test('loading restores the same meaningful state into a fresh character', () => {
    const original = midGame();
    const save = capturePlayerSave(original);
    const loaded = makeTarget(1);
    applyPlayerSave(loaded, roundTrip(save));
    assert.deepEqual(capturePlayerSave(loaded), save);
    assert.deepEqual(loaded.combat.stats, original.combat.stats);
    assert.equal(loaded.combat.hp, loaded.combat.stats.maxHp);
  });

  test('job bonus and allocated stats stay distinct after load', () => {
    const loaded = makeTarget(1);
    applyPlayerSave(loaded, roundTrip(capturePlayerSave(midGame())));
    assert.deepEqual(loaded.progress.jobBonuses, { warrior: { str: 3, vit: 2 } });
    assert.deepEqual(loaded.progress.allocated, { ...zeroPrimary(), str: 6, vit: 3 });
    assert.equal(loaded.progress.remaining(15), 14 - 9);
  });

  test('a reset state stays valid through save/load', () => {
    const t = midGame();
    assert.equal(useItem(t.inventory, t, 'stat_reset_test').ok, true);
    const save = roundTrip(capturePlayerSave(t));
    assert.deepEqual(save.stats.allocated, zeroPrimary());
    assert.equal(save.unspentStatPoints, 14);
    assert.deepEqual(save.stats.jobBonuses, { warrior: { str: 3, vit: 2 } });
    assert.equal(save.inventory.some((i) => i.itemId === 'stat_reset_test'), false);
  });

  test('hooks for unbuilt systems survive load -> save untouched', () => {
    const save = capturePlayerSave(midGame());
    const loaded = makeTarget(1);
    applyPlayerSave(loaded, roundTrip(save));
    const again = capturePlayerSave(loaded);
    for (const key of ['equipment', 'activePetId', 'currencies', 'energy', 'quests', 'dungeons'] as const) {
      assert.deepEqual(again[key], save[key], key);
    }
  });

  test('derived values are not stored', () => {
    const json = serializePlayerSave(capturePlayerSave(midGame()));
    for (const derived of ['maxHp', 'maxMp', 'attack', 'physicalAtk', 'def', 'mdef', 'critRate']) {
      assert.equal(json.includes(`"${derived}"`), false, derived);
    }
  });

  test('a new character save is valid', () => {
    const save = newPlayerSave('char-new');
    assert.deepEqual(roundTrip(save), save);
    assert.equal(save.classId, 'novice');
    assert.equal(save.unspentStatPoints, 0);
  });

  test('invalid or tampered saves are rejected', () => {
    const good = capturePlayerSave(midGame());
    const bad = (mutate: (s: Record<string, unknown>) => void) => {
      const s = JSON.parse(serializePlayerSave(good));
      mutate(s);
      return JSON.stringify(s);
    };
    assert.throws(() => deserializePlayerSave('not json'), SaveError);
    assert.throws(() => deserializePlayerSave(bad((s) => (s.schemaVersion = 99))), /unsupported save version/);
    assert.throws(() => deserializePlayerSave(bad((s) => (s.classId = 'Warrior'))), /classId/);
    assert.throws(() => deserializePlayerSave(bad((s) => ((s.stats as PlayerSave['stats']).allocated.str = 50))), /more stat points/);
    assert.throws(() => deserializePlayerSave(bad((s) => (s.unspentStatPoints = 99))), /unspentStatPoints/);
    assert.throws(() => deserializePlayerSave(bad((s) => (s.inventory = [{ itemId: 'nope', count: 1 }]))), /inventory/);
  });
});

describe('save schema migration', () => {
  const asV1 = (save: PlayerSave) => {
    const { skillPointsSpent: _spent, ...rest } = save;
    void _spent;
    return JSON.stringify({ ...rest, schemaVersion: 1, skillPoints: 0 });
  };

  test('current version is 2', () => {
    assert.equal(PLAYER_SAVE_VERSION, 2);
    assert.equal(capturePlayerSave(midGame()).schemaVersion, 2);
  });

  test('a v1 save migrates to v2 with its stat inputs intact and nothing spent', () => {
    const t = midGame();
    t.progress.skillPointsSpent = 0;
    const current = capturePlayerSave(t);
    const migrated = deserializePlayerSave(asV1(current));
    assert.equal(migrated.schemaVersion, 2);
    assert.equal(migrated.skillPointsSpent, 0);
    assert.equal('skillPoints' in migrated, false);
    assert.deepEqual(migrated, current);
  });

  test('a v1 save that breaks current rules is rejected with a clear error', () => {
    const bad = JSON.parse(asV1(capturePlayerSave(midGame())));
    bad.level = 45; // Warrior (Class 1) growth ends at Lv40
    bad.unspentStatPoints = 44 - 9;
    assert.throws(() => deserializePlayerSave(JSON.stringify(bad)), /above warrior's maximum 40/);
  });

  test('skill points spent beyond what job and level earned are rejected', () => {
    const save = capturePlayerSave(midGame());
    save.skillPointsSpent = 6; // Lv15 Warrior earned 5
    assert.throws(() => deserializePlayerSave(serializePlayerSave(save)), /more skill points spent/);
  });
});

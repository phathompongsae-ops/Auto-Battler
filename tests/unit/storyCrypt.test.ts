import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DUNGEON_ACCESS } from '../../src/data/dungeonAccess';
import { CRYPT_MAP_ID, TOWN_MAP_ID } from '../../src/data/maps';
import { MVP_CRYPT_ENTRANCE_ID } from '../../src/data/quests/mainQuests';
import { FEATURES } from '../../src/data/featureData';
import { QUESTS } from '../../src/data/questData';
import { cumulativeExp } from '../../src/progression/expCurve';
import { checkMapEntry } from '../../src/world/dungeonAccess';
import { makeSaveTarget } from './fixtures';

/*
 * Gameplay source of truth (docs/design/gameplay-source-of-truth.md): the
 * Story Crypt is the introductory dungeon. Its story loop needs only Lv3 and
 * "Trouble in the Meadow" turned in; the Lv20 Dungeon feature (runs, reward
 * tiers, the Dungeon menu) must never block it.
 */
describe('Story Crypt loop is independent of the Lv20 Dungeon feature', () => {
  test('a Lv3 player with the Dungeon feature still locked enters, defeats the Crypt Lord, and turns in mvp_03_crypt once', () => {
    const t = makeSaveTarget(1);
    const q = t.quests;
    const access = () => checkMapEntry(TOWN_MAP_ID, CRYPT_MAP_ID, { level: t.combat.level, questStatus: (id) => q.status(id), questTitle: (id) => q.defs[id]?.title });

    // Story up to the Crypt, through the real quest engine.
    q.start('mvp_01_welcome');
    t.events.emit('npcInteracted', { npcId: QUESTS.mvp_01_welcome.turnInNpcId! });
    assert.equal(q.claim('mvp_01_welcome').ok, true);
    q.start('mvp_02_meadow');
    t.events.emit('locationReached', { locationId: 'demo_field_entry' });
    for (let i = 0; i < 3; i++) t.events.emit('monsterKilled', { entityId: 'w', monsterId: 'wolf', tier: 'normal', zone: 'field' });
    t.inventory.add('wolf_fang', 3);
    t.events.emit('itemAcquired', { itemId: 'wolf_fang', amount: 3, source: 'loot' });
    t.events.emit('monsterKilled', { entityId: 'b', monsterId: 'elite_boar', tier: 'elite', zone: 'field' });
    assert.equal(q.claim('mvp_02_meadow').ok, true);
    const minimum = DUNGEON_ACCESS[CRYPT_MAP_ID].minimumLevel;
    if (t.combat.level < minimum) t.progression.grantExp(t.player, cumulativeExp(minimum) - cumulativeExp(t.combat.level));

    // Exactly the Story Crypt requirements: Lv3, well below the Dungeon feature's level.
    assert.equal(minimum, 3);
    assert.ok(t.combat.level >= 3 && t.combat.level < FEATURES.dungeon.conditions!.requiredLevel!, `level ${t.combat.level}`);
    assert.equal(t.features.isFeatureUnlocked('dungeon'), false);
    assert.deepEqual(access(), { ok: true });

    // Enter, defeat the boss (a dungeon-zone kill, no run issued), turn in.
    assert.equal(q.status('mvp_03_crypt'), 'available');
    assert.equal(q.start('mvp_03_crypt').ok, true);
    t.events.emit('locationReached', { locationId: MVP_CRYPT_ENTRANCE_ID });
    t.events.emit('monsterKilled', { entityId: 'crypt_lord-1', monsterId: 'crypt_lord', tier: 'dungeon_boss', zone: 'dungeon' });
    assert.equal(q.status('mvp_03_crypt'), 'completed');

    const gold = t.wallet.get('gold');
    const enchant = t.inventory.count('enchant_stone');
    const protection = t.inventory.count('protection_stone');
    assert.equal(q.claim('mvp_03_crypt').ok, true);
    assert.equal(t.wallet.get('gold'), gold + 600);
    assert.equal(t.inventory.count('enchant_stone'), enchant + 2);
    assert.equal(t.inventory.count('protection_stone'), protection + 1);

    // Story rewards never repeat.
    assert.deepEqual(q.claim('mvp_03_crypt'), { ok: false, reason: 'already_claimed' });
    assert.equal(t.wallet.get('gold'), gold + 600);
  });
});

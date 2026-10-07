import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { FixedServerDay } from '../../src/core/serverDay';
import { DUNGEON_ACCESS, type DungeonAccessRule } from '../../src/data/dungeonAccess';
import { CRYPT_MAP_ID, MAPS, TOWN_MAP_ID } from '../../src/data/maps';
import { QUESTS } from '../../src/data/questData';
import type { Location } from '../../src/data/warpData';
import { PlayerActions } from '../../src/game/PlayerActions';
import { cumulativeExp } from '../../src/progression/expCurve';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { checkAccess, checkMapEntry, type AccessState } from '../../src/world/dungeonAccess';
import { makeSaveTarget } from './fixtures';

const RULE: DungeonAccessRule = { mapId: 'd', displayName: 'the Test Crypt', minimumLevel: 3, requiredQuestId: 'q', questState: 'claimed' };
const state = (level: number, status: string): AccessState => ({ level, questStatus: () => status, questTitle: () => 'Trouble in the Meadow' });

describe('dungeon access rule (data-driven)', () => {
  test('Dungeon 1 (the Crypt) requires a minimum level and the story quest that unlocks it, both configurable data', () => {
    const rule = DUNGEON_ACCESS[CRYPT_MAP_ID];
    assert.ok(rule, 'the Crypt has an entry rule');
    assert.equal(rule.minimumLevel, 3);
    assert.equal(rule.requiredQuestId, 'mvp_02_meadow');
    assert.equal(rule.questState, 'claimed');
    assert.ok(QUESTS[rule.requiredQuestId!], 'required quest exists');
    // The story quest into the Crypt follows exactly this one.
    assert.deepEqual(QUESTS.mvp_03_crypt.prerequisites?.requiredQuestIds, [rule.requiredQuestId]);
    for (const r of Object.values(DUNGEON_ACCESS)) assert.equal(MAPS[r.mapId].type, 'dungeon', `${r.mapId} is a dungeon`);
  });

  test('level too low: blocked with "Requires Level X"', () => {
    const r = checkAccess(RULE, state(2, 'claimed'));
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.message === 'Requires Level 3');
    assert.deepEqual(!r.ok && r.missing, [{ kind: 'level', required: 3, current: 2 }]);
  });

  test('quest incomplete (any state short of turned in): blocked with "Complete <quest> first"', () => {
    for (const status of ['locked', 'available', 'active', 'completed']) {
      const r = checkAccess(RULE, state(10, status));
      assert.ok(!r.ok && r.message === 'Complete Trouble in the Meadow first', status);
    }
  });

  test('both missing: one message naming both', () => {
    const r = checkAccess(RULE, state(1, 'active'));
    assert.ok(!r.ok && r.message === 'Requires Level 3 and complete Trouble in the Meadow first');
    assert.deepEqual(!r.ok && r.missing.map((m) => m.kind), ['level', 'quest']);
  });

  test('both satisfied (level exactly the minimum, quest turned in): allowed', () => {
    assert.deepEqual(checkAccess(RULE, state(3, 'claimed')), { ok: true });
    assert.deepEqual(checkAccess({ ...RULE, questState: 'completed' }, state(3, 'completed')), { ok: true });
  });

  test('only entering a guarded map from outside is checked; unguarded maps and moves within the dungeon are free', () => {
    const low = state(1, 'locked');
    assert.equal(checkMapEntry(TOWN_MAP_ID, CRYPT_MAP_ID, low).ok, false);
    assert.equal(checkMapEntry(CRYPT_MAP_ID, CRYPT_MAP_ID, low).ok, true);
    assert.equal(checkMapEntry(CRYPT_MAP_ID, TOWN_MAP_ID, low).ok, true);
    assert.equal(checkMapEntry(TOWN_MAP_ID, 'demo_field', low).ok, true);
  });
});

/** A real quest log / level / save target, plus PlayerActions with the world's entry check. */
function rig(level = 1) {
  const t = makeSaveTarget(level, undefined, new FixedServerDay(1));
  const access = () => checkMapEntry(location.mapId, CRYPT_MAP_ID, { level: t.combat.level, questStatus: (id) => t.quests.status(id), questTitle: (id) => t.quests.defs[id]?.title });
  let location: Location = { kind: 'town', mapId: TOWN_MAP_ID };
  const refused: string[] = [];
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
    world: {
      location: () => location,
      inCombat: () => false,
      entryAccess: (mapId) => {
        const r = checkMapEntry(location.mapId, mapId, { level: t.combat.level, questStatus: (id) => t.quests.status(id), questTitle: (id) => t.quests.defs[id]?.title });
        if (!r.ok) refused.push(r.message);
        return r;
      },
      arrive: (d) => {
        location = d;
      },
      startDungeonRun: (id, difficulty) => t.ledger.startRun(id, difficulty, t.combat.level),
    },
  });
  const levelTo = (n: number) => t.progression.grantExp(t.player, cumulativeExp(n) - cumulativeExp(t.combat.level));
  /** Turn in the story quests up to the Crypt through the real quest engine. */
  const finishMeadow = () => {
    const q = t.quests;
    q.start('mvp_01_welcome');
    t.events.emit('npcInteracted', { npcId: QUESTS.mvp_01_welcome.turnInNpcId! });
    assert.equal(q.claim('mvp_01_welcome').ok, true);
    q.start('mvp_02_meadow');
    t.events.emit('locationReached', { locationId: 'demo_field_entry' });
    for (let i = 0; i < 3; i++) t.events.emit('monsterKilled', { entityId: 'w', monsterId: 'wolf', tier: 'normal', zone: 'field' });
    t.inventory.add('wolf_fang', 3);
    t.events.emit('itemAcquired', { itemId: 'wolf_fang', amount: 3, source: 'loot' });
    t.events.emit('monsterKilled', { entityId: 'b', monsterId: 'elite_boar', tier: 'elite', zone: 'field' });
    assert.equal(q.claim('mvp_02_meadow').ok, true, JSON.stringify(q.progress('mvp_02_meadow')));
  };
  return { t, actions, access, refused, levelTo, finishMeadow, where: () => location };
}

describe('Dungeon 1 access through the real systems', () => {
  test('the real quest log and level drive the check: blocked until both are met', () => {
    const r = rig(1);
    assert.ok(!r.access().ok && (r.access() as { message: string }).message === 'Requires Level 3 and complete Trouble in the Meadow first');
    r.finishMeadow();
    // The story alone does not reach the minimum level (that is the point of the level gate).
    if (r.t.combat.level < 3) assert.ok(!r.access().ok && (r.access() as { message: string }).message === 'Requires Level 3');
    r.levelTo(3);
    assert.deepEqual(r.access(), { ok: true });
  });

  test('saved player state: requirements met before saving are still met after loading (no save format change)', () => {
    const a = rig(1);
    a.finishMeadow();
    a.levelTo(3);
    const json = serializePlayerSave(capturePlayerSave(a.t));
    assert.ok(!json.includes('dungeonAccess'), 'nothing new is persisted');
    const b = rig(1);
    assert.equal(b.access().ok, false);
    applyPlayerSave(b.t, deserializePlayerSave(json));
    assert.deepEqual(b.access(), { ok: true });
  });

  test('a Dungeon Warp Scroll cannot bypass the requirements, and no scroll is spent while refused', () => {
    const r = rig(1);
    r.levelTo(5); // Warp unlocks at Lv5; the quest is still missing.
    r.t.warp.dungeons.add('demo_dungeon');
    r.t.inventory.add('dungeon_warp_scroll', 1);
    const refused = r.actions.useWarpScroll('dungeon', 'demo_dungeon');
    assert.deepEqual(refused, { ok: false, reason: 'entry_requirements', message: 'Complete Trouble in the Meadow first' });
    assert.deepEqual(r.refused, ['Complete Trouble in the Meadow first']);
    assert.equal(r.where().mapId, TOWN_MAP_ID);
    assert.equal(r.t.inventory.count('dungeon_warp_scroll'), 1);

    r.finishMeadow();
    const ok = r.actions.useWarpScroll('dungeon', 'demo_dungeon');
    assert.equal(ok.ok, true);
    assert.equal(r.where().mapId, CRYPT_MAP_ID);
    assert.equal(r.t.inventory.count('dungeon_warp_scroll'), 0);
  });
});

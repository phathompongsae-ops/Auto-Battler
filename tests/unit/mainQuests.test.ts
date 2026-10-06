import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { ENHANCEMENT_COST } from '../../src/data/equipmentData';
import { NAVIGATION } from '../../src/data/navigationData';
import { CAPTAIN_NPC_ID, NPCS, SMITH_NPC_ID } from '../../src/data/npcData';
import { INTERNAL_DEMO_QUESTS, QUESTS } from '../../src/data/questData';
import { MAIN_QUESTS, MVP_CRYPT_ENTRANCE_ID, MVP_FIELD_ENTRY_ID } from '../../src/data/quests/mainQuests';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { PlayerActions } from '../../src/game/PlayerActions';
import { NavIndex } from '../../src/navigation/NavIndex';
import { resolveQuestObjective } from '../../src/navigation/questNavigation';
import { npcMarker, npcQuests, objectiveText, questPhase } from '../../src/quests/questText';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { makeSaveTarget } from './fixtures';

/** A Lv1 character on the Internal Demo quests, with gameplay-event shortcuts. */
function rig(level = 1) {
  const t = makeSaveTarget(level, undefined, undefined, INTERNAL_DEMO_QUESTS);
  const q = t.quests;
  const talk = (npcId: string) => t.events.emit('npcInteracted', { npcId });
  const visit = (locationId: string) => t.events.emit('locationReached', { locationId });
  const kill = (monsterId: string, tier: 'normal' | 'elite' | 'dungeon_boss' = 'normal', zone: 'field' | 'dungeon' = 'field') =>
    t.events.emit('monsterKilled', { entityId: `${monsterId}-x`, monsterId, tier, zone });
  const loot = (itemId: 'wolf_fang' | 'mushroom_cap', amount = 1) => {
    t.inventory.add(itemId, amount);
    t.events.emit('itemAcquired', { itemId, amount, source: 'loot' });
  };
  const phase = (id: string) => questPhase(q, id);
  return { t, q, talk, visit, kill, loot, phase };
}

/** Plays the whole MVP chain through gameplay events, checking each step. */
function playChain(r: ReturnType<typeof rig>) {
  r.q.start('mvp_01_welcome');
  r.talk(SMITH_NPC_ID);
  assert.equal(r.q.claim('mvp_01_welcome').ok, true);
  r.q.start('mvp_02_meadow');
  r.visit(MVP_FIELD_ENTRY_ID);
  for (let i = 0; i < 3; i++) {
    r.kill('wolf');
    r.loot('wolf_fang');
  }
  r.kill('elite_boar', 'elite');
  assert.equal(r.q.claim('mvp_02_meadow').ok, true);
  r.q.start('mvp_03_crypt');
  r.visit(MVP_CRYPT_ENTRANCE_ID);
  r.kill('crypt_lord', 'dungeon_boss', 'dungeon');
  assert.equal(r.q.claim('mvp_03_crypt').ok, true);
}

describe('MVP main quest chain: data', () => {
  test('three main quests, chained by prerequisites, each with a giver and a turn-in NPC that exist', () => {
    assert.deepEqual(Object.keys(MAIN_QUESTS), ['mvp_01_welcome', 'mvp_02_meadow', 'mvp_03_crypt']);
    for (const def of Object.values(MAIN_QUESTS)) {
      assert.equal(def.type, 'main');
      assert.ok(NPCS[def.giverNpcId!] && NPCS[def.turnInNpcId!], def.id);
      assert.ok(QUESTS[def.id] && INTERNAL_DEMO_QUESTS[def.id]);
      assert.ok(def.rewards.exp && def.rewards.gold && def.rewards.items?.length, `${def.id} rewards EXP, Gold and items`);
    }
    assert.deepEqual(MAIN_QUESTS.mvp_02_meadow.prerequisites?.requiredQuestIds, ['mvp_01_welcome']);
    assert.deepEqual(MAIN_QUESTS.mvp_03_crypt.prerequisites?.requiredQuestIds, ['mvp_02_meadow']);
    const kinds = Object.values(MAIN_QUESTS).flatMap((d) => d.objectives.map((o) => `${o.kind}${o.kind === 'kill' && o.tier && o.tier !== 'normal' ? `:${o.tier}` : ''}`));
    for (const k of ['talk', 'visit', 'kill', 'collect', 'kill:elite', 'kill:dungeon_boss']) assert.ok(kinds.includes(k), k);
  });

  test('every objective has a navigation target (Auto Move), and every NPC stands on a real map target', () => {
    const nav = new NavIndex(NAVIGATION);
    const r = rig();
    for (const def of Object.values(MAIN_QUESTS)) {
      for (const [i, o] of def.objectives.entries()) {
        if (o.kind === 'collect') continue; // collected from the monsters of a hunted zone
        r.q.forget(def.id);
        // Resolve as if active: start with prerequisites ignored by loading a record.
        r.q.load({ records: { [def.id]: { status: 'active', progress: def.objectives.map(() => 0) } }, tracked: [], announced: [] });
        const res = resolveQuestObjective(r.q, def.id, i, nav);
        assert.ok(res.ok, `${def.id}[${i}] ${o.kind}`);
      }
    }
    for (const npc of Object.values(NPCS)) assert.ok(NAVIGATION.targets[npc.navTargetId]?.npcId === npc.id, npc.id);
  });
});

describe('quest states and objectives', () => {
  test('available → accepted → in progress → ready to turn in → completed', () => {
    const r = rig();
    assert.equal(r.phase('mvp_01_welcome'), 'available');
    assert.equal(r.phase('mvp_02_meadow'), 'locked');
    r.q.start('mvp_01_welcome');
    assert.equal(r.phase('mvp_01_welcome'), 'accepted');
    r.talk(SMITH_NPC_ID);
    assert.equal(r.phase('mvp_01_welcome'), 'ready');
    r.q.claim('mvp_01_welcome');
    assert.equal(r.phase('mvp_01_welcome'), 'completed');
    assert.equal(r.phase('mvp_02_meadow'), 'available');
    r.q.start('mvp_02_meadow');
    assert.equal(r.phase('mvp_02_meadow'), 'accepted');
    r.visit(MVP_FIELD_ENTRY_ID);
    assert.equal(r.phase('mvp_02_meadow'), 'in_progress');
  });

  test('kill objectives count only the named monster; progress text reads "Wolves 2 / 3"', () => {
    const r = rig();
    r.q.load({ records: { mvp_02_meadow: { status: 'active', progress: [0, 0, 0, 0] } }, tracked: [], announced: [] });
    r.kill('wolf');
    r.kill('mushroom');
    r.kill('wolf');
    const p = r.q.progress('mvp_02_meadow');
    assert.deepEqual(p.map((x) => x.current), [0, 2, 0, 0]);
    assert.equal(objectiveText(MAIN_QUESTS.mvp_02_meadow.objectives[1], p[1].current, p[1].required), 'Wolves 2 / 3');
  });

  test('collect objectives count items acquired while the quest is active (capped); earlier ones do not', () => {
    const r = rig();
    r.loot('wolf_fang', 2); // before accepting: does not count
    r.q.load({ records: { mvp_02_meadow: { status: 'active', progress: [0, 0, 0, 0] } }, tracked: [], announced: [] });
    r.loot('wolf_fang');
    r.loot('mushroom_cap');
    assert.equal(r.q.progress('mvp_02_meadow')[2].current, 1);
    r.loot('wolf_fang', 5);
    assert.equal(r.q.progress('mvp_02_meadow')[2].current, 3, 'capped at the required amount');
  });

  test('location objectives complete when the location is reached', () => {
    const r = rig();
    r.q.load({ records: { mvp_03_crypt: { status: 'active', progress: [0, 0] } }, tracked: [], announced: [] });
    r.visit('somewhere_else');
    assert.equal(r.q.progress('mvp_03_crypt')[0].current, 0);
    r.visit(MVP_CRYPT_ENTRANCE_ID);
    assert.equal(r.q.progress('mvp_03_crypt')[0].current, 1);
  });

  test('Elite and Boss objectives: a normal kill never counts; the Elite / Boss kill does (Boss in the dungeon)', () => {
    const r = rig();
    r.q.load({
      records: { mvp_02_meadow: { status: 'active', progress: [1, 3, 3, 0] }, mvp_03_crypt: { status: 'active', progress: [1, 0] } },
      tracked: [],
      announced: [],
    });
    r.kill('wolf');
    r.kill('crypt_skeleton', 'normal', 'dungeon');
    assert.equal(r.q.status('mvp_02_meadow'), 'active');
    assert.equal(r.q.status('mvp_03_crypt'), 'active');
    r.kill('elite_boar', 'elite');
    assert.equal(r.q.status('mvp_02_meadow'), 'completed');
    r.kill('crypt_lord', 'dungeon_boss', 'dungeon');
    assert.equal(r.q.status('mvp_03_crypt'), 'completed');
  });
});

describe('rewards and duplicate-claim prevention', () => {
  test('the whole chain grants each quest reward exactly once (EXP, Gold, items)', () => {
    const r = rig();
    const exp0 = r.t.combat.exp + r.t.combat.level * 1e9;
    playChain(r);
    const gold = Object.values(MAIN_QUESTS).reduce((n, d) => n + (d.rewards.gold ?? 0), 0);
    assert.equal(r.t.wallet.get('gold'), gold);
    assert.equal(r.t.inventory.count('enhancement_stone'), 3);
    assert.equal(r.t.inventory.count('enchant_stone'), 2);
    assert.equal(r.t.inventory.count('protection_stone'), 1);
    assert.equal(r.t.inventory.count('town_warp_scroll'), 1);
    assert.ok(r.t.combat.exp + r.t.combat.level * 1e9 > exp0, 'EXP granted');
    for (const id of Object.keys(MAIN_QUESTS)) assert.deepEqual(r.q.claim(id), { ok: false, reason: 'already_claimed' });
    assert.equal(r.t.wallet.get('gold'), gold, 'no second payout');
    assert.equal(r.q.start('mvp_01_welcome').ok, false, 'a claimed quest cannot be restarted');
  });

  test('an unfinished quest cannot be claimed', () => {
    const r = rig();
    r.q.start('mvp_01_welcome');
    assert.deepEqual(r.q.claim('mvp_01_welcome'), { ok: false, reason: 'not_completed' });
  });
});

describe('NPC quest offers and markers', () => {
  test('"!" over the giver while a quest is offered, "?" over the turn-in NPC when it is ready, and the dialogue actions match', () => {
    const r = rig();
    assert.equal(npcMarker(r.q, CAPTAIN_NPC_ID), '!');
    assert.equal(npcMarker(r.q, SMITH_NPC_ID), null);
    assert.deepEqual(npcQuests(r.q, CAPTAIN_NPC_ID).map((x) => [x.questId, x.action]), [['mvp_01_welcome', 'accept']]);
    r.q.start('mvp_01_welcome');
    assert.equal(npcMarker(r.q, CAPTAIN_NPC_ID), null);
    assert.deepEqual(npcQuests(r.q, CAPTAIN_NPC_ID).map((x) => x.action), ['continue']);
    r.talk(SMITH_NPC_ID);
    assert.equal(npcMarker(r.q, SMITH_NPC_ID), '?');
    assert.deepEqual(npcQuests(r.q, SMITH_NPC_ID).map((x) => [x.questId, x.action]), [['mvp_01_welcome', 'complete']]);
    r.q.claim('mvp_01_welcome');
    // The smith now offers the next quest.
    assert.equal(npcMarker(r.q, SMITH_NPC_ID), '!');
    assert.deepEqual(npcQuests(r.q, SMITH_NPC_ID).map((x) => [x.questId, x.action]), [['mvp_02_meadow', 'accept']]);
  });
});

describe('quest save / load', () => {
  test('mid-chain progress, tracking and claims survive save / load; nothing is granted twice after loading', () => {
    const r = rig();
    r.q.start('mvp_01_welcome');
    r.talk(SMITH_NPC_ID);
    r.q.claim('mvp_01_welcome');
    r.q.start('mvp_02_meadow');
    r.q.track('mvp_02_meadow');
    r.visit(MVP_FIELD_ENTRY_ID);
    r.kill('wolf');
    r.kill('wolf');
    const text = serializePlayerSave(capturePlayerSave(r.t));

    const l = rig();
    applyPlayerSave(l.t, deserializePlayerSave(text));
    assert.equal(l.phase('mvp_01_welcome'), 'completed');
    assert.deepEqual(l.q.progress('mvp_02_meadow').map((p) => p.current), [1, 2, 0, 0]);
    assert.deepEqual(l.q.trackedQuestIds(), ['mvp_02_meadow']);
    assert.deepEqual(l.q.claim('mvp_01_welcome'), { ok: false, reason: 'already_claimed' });
    l.kill('wolf');
    assert.equal(l.q.progress('mvp_02_meadow')[1].current, 3);
  });
});

describe('Town services: basic Enhancement and Enchant', () => {
  function serviceRig() {
    const t = makeSaveTarget(20);
    for (const f of ['enhancement', 'enchant'] as const) t.features.unlock(f);
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
      world: { location: () => ({ kind: 'town', mapId: 'demo_town' }), inCombat: () => false, arrive: () => {}, startDungeonRun: (id, d) => t.ledger.startRun(id, d, 1) },
    });
    const item = createEquipment('traveler_vest', seededRng(4), sequentialIds('svc'));
    t.equipment.add(item);
    return { t, actions, item };
  }

  test('Enhancement: one success with a stone and Gold raises the item to +1 and its stats immediately (equipped)', () => {
    const { t, actions, item } = serviceRig();
    t.equipment.equip(item.instanceId);
    const hp0 = t.combat.stats.maxHp;
    t.inventory.add('enhancement_stone', 2);
    t.wallet.add('gold', 1000);
    const r = actions.enhance(item.instanceId, {}, () => 0);
    assert.ok(r.ok && 'success' in r && r.success && r.to === 1, JSON.stringify(r));
    assert.equal(item.enhancement, 1);
    assert.equal(t.inventory.count('enhancement_stone'), 2 - ENHANCEMENT_COST[1].stones);
    assert.equal(t.wallet.get('gold'), 1000 - ENHANCEMENT_COST[1].gold);
    assert.ok(t.combat.stats.maxHp > hp0, 'the enhanced base stat (Max HP) applies at once');
  });

  test('Enhancement without stones is refused and changes nothing', () => {
    const { t, actions, item } = serviceRig();
    t.wallet.add('gold', 1000);
    const r = actions.enhance(item.instanceId, {}, () => 0);
    assert.equal(r.ok, false);
    assert.equal(item.enhancement, 0);
    assert.equal(t.wallet.get('gold'), 1000);
  });

  test('Enchant: a reroll spends its cost and rerolls the lines (the enchant layer only)', () => {
    const { t, actions, item } = serviceRig();
    const before = structuredClone(item.enchants);
    t.inventory.add('enchant_stone', 5);
    t.wallet.add('gold', 10_000);
    const r = actions.rerollEnchants(item.instanceId, [], seededRng(99));
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(item.enchants.length, before.length);
    assert.notDeepEqual(item.enchants, before);
    assert.ok(t.inventory.count('enchant_stone') < 5 || t.wallet.get('gold') < 10_000, 'the reroll had a cost');
    assert.equal(item.enhancement, 0, 'enhancement untouched');
  });
});

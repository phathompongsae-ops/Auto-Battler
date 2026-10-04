import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { FixedServerDay } from '../../src/core/serverDay';
import { FEATURE_IDS, FEATURES, lockedMessage, type FeatureId } from '../../src/data/featureData';
import { NAVIGATION } from '../../src/data/navigationData';
import type { Location } from '../../src/data/warpData';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { FeatureProgression } from '../../src/features/FeatureProgression';
import { FeatureUnlocks } from '../../src/features/FeatureUnlocks';
import { PlayerActions } from '../../src/game/PlayerActions';
import { NavIndex, portalTransition } from '../../src/navigation/NavIndex';
import { cumulativeExp } from '../../src/progression/expCurve';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { SCREENS } from '../../src/ui/data/screens';
import { makeSaveTarget } from './fixtures';

/** The Demo features earned by progression (demo_feature is a quest-reward fixture). */
const PROGRESSION_FEATURES = FEATURE_IDS.filter((id) => id !== 'demo_feature');

function rig(level = 1) {
  const t = makeSaveTarget(level, undefined, new FixedServerDay(1));
  const unlocks: { id: string; restored: boolean }[] = [];
  t.events.on('featureUnlocked', (e) => unlocks.push({ id: e.featureId, restored: e.restored }));
  let location: Location = { kind: 'field', mapId: 'demo_field' };
  const arrivals: Location[] = [];
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
      arrive: (d) => {
        location = d;
        arrivals.push(d);
      },
      startDungeonRun: (id, difficulty) => t.ledger.startRun(id, difficulty, t.combat.level),
    },
  });
  const levelTo = (n: number) => t.progression.grantExp(t.player, cumulativeExp(n) - cumulativeExp(t.combat.level));
  const unlocked = () => FEATURE_IDS.filter((id) => t.features.isFeatureUnlocked(id));
  const has = (id: FeatureId) => t.features.isFeatureUnlocked(id);
  /** Run the Job Trial and choose a job through the real Job Change. */
  const becomeWarrior = () => {
    const q = t.quests;
    q.start('job_c1_01_instructor');
    t.events.emit('npcInteracted', { npcId: 'demo_job_instructor' });
    q.claim('job_c1_01_instructor');
    q.start('job_c1_02_trial');
    t.events.emit('locationReached', { locationId: 'demo_job_trial_marker' });
    for (let i = 0; i < 3; i++) t.events.emit('monsterKilled', { entityId: 's', monsterId: 'slime', tier: 'normal', zone: 'field' });
    q.claim('job_c1_02_trial');
    q.start('job_c1_03_report');
    t.events.emit('npcInteracted', { npcId: 'demo_job_instructor' });
    q.claim('job_c1_03_report');
    return t.jobChange.select('warrior');
  };
  return { t, actions, unlocks, arrivals, levelTo, unlocked, has, becomeWarrior, location: () => location };
}

const locked = (r: unknown) => (r as { reason?: string }).reason === 'feature_locked';

describe('feature definitions', () => {
  test('the Demo list, each with name, description and data-driven conditions', () => {
    assert.deepEqual(PROGRESSION_FEATURES, [
      'equipment', 'warp', 'job_change', 'class_1_skills', 'enhancement', 'daily_commission',
      'enchant', 'pet', 'dungeon', 'crafting', 'weekly_quests',
    ]);
    const levels = Object.fromEntries(PROGRESSION_FEATURES.map((id) => [id, FEATURES[id].conditions?.requiredLevel ?? null]));
    assert.deepEqual(levels, {
      equipment: null, warp: 5, job_change: 11, class_1_skills: null, enhancement: 15, daily_commission: 16,
      enchant: 18, pet: 20, dungeon: 20, crafting: 20, weekly_quests: 20,
    });
    assert.deepEqual(FEATURES.class_1_skills.conditions, { requiredClassTier: 1 });
    assert.deepEqual(FEATURES.weekly_quests.conditions?.requiredFeatureIds, ['daily_commission']);
    for (const id of FEATURE_IDS) assert.ok(FEATURES[id].displayName && FEATURES[id].description, id);
  });

  test('player-facing lock messages', () => {
    assert.equal(lockedMessage('warp'), 'Unlocks at Lv5');
    assert.equal(lockedMessage('enhancement'), 'Unlocks at Lv15');
    assert.equal(lockedMessage('daily_commission'), 'Unlocks at Lv16');
    assert.equal(lockedMessage('pet'), 'Unlocks at Lv20');
    assert.equal(lockedMessage('class_1_skills'), 'Change Job to unlock');
  });
});

describe('unlocking by progression', () => {
  test('a new Lv1 character has only Equipment', () => {
    const r = rig(1);
    assert.deepEqual(r.unlocked(), ['equipment']);
  });

  test('every level threshold, exactly', () => {
    const r = rig(1);
    const steps: [number, FeatureId[], FeatureId[]][] = [
      [4, [], ['warp']],
      [5, ['warp'], ['job_change']],
      [10, [], ['job_change']],
      [11, ['job_change'], ['class_1_skills', 'enhancement']],
      [14, [], ['enhancement']],
      [15, ['enhancement'], ['daily_commission']],
      [16, ['daily_commission'], ['enchant']],
      [17, [], ['enchant']],
      [18, ['enchant'], ['pet', 'dungeon', 'crafting', 'weekly_quests']],
      [19, [], ['pet', 'dungeon', 'crafting', 'weekly_quests']],
      [20, ['pet', 'dungeon', 'crafting', 'weekly_quests'], ['class_1_skills']],
    ];
    for (const [level, open, closed] of steps) {
      r.levelTo(level);
      for (const id of open) assert.equal(r.has(id), true, `${id} at Lv${level}`);
      for (const id of closed) assert.equal(r.has(id), false, `${id} still locked at Lv${level}`);
    }
  });

  test('Class 1 Skills: not at Lv11 as a Novice; unlocked by the real Job Change; kept after reload', () => {
    const r = rig(11);
    assert.equal(r.has('job_change'), true);
    assert.equal(r.has('class_1_skills'), false);
    assert.equal(r.t.quests.status('job_c1_01_instructor'), 'available', 'the Job Quest follows job_change');
    assert.equal(r.becomeWarrior().ok, true);
    assert.equal(r.has('class_1_skills'), true);
    const l = rig(1);
    applyPlayerSave(l.t, deserializePlayerSave(serializePlayerSave(capturePlayerSave(r.t))));
    assert.equal(l.has('class_1_skills'), true);
  });

  test('the Job Quest stays unavailable while job_change is locked', () => {
    const r = rig(11);
    r.t.features.unlocked.delete('job_change');
    assert.equal(r.t.quests.status('job_c1_01_instructor'), 'locked');
  });

  test('dependencies: Weekly needs Daily; a chain resolves in one evaluation', () => {
    const t = makeSaveTarget(20);
    const features = new FeatureUnlocks();
    const fp = new FeatureProgression(
      features,
      { level: () => 20, classTier: () => 0, questClaimed: () => false, serverDay: () => 1 },
      t.events,
      'nobody',
    );
    assert.equal(fp.conditionsMet('weekly_quests'), false, 'Daily not unlocked yet');
    const order = fp.evaluate();
    assert.ok(order.indexOf('daily_commission') < order.indexOf('weekly_quests'));
    assert.equal(features.isFeatureUnlocked('weekly_quests'), true);
  });

  test('unlocks are permanent (a temporary condition change never relocks)', () => {
    const r = rig(16);
    assert.equal(r.has('daily_commission'), true);
    r.t.combat.level = 3; // e.g. a dev level drop
    r.t.featureProgression.evaluate();
    assert.equal(r.has('daily_commission'), true);
  });
});

describe('unlock events', () => {
  test('each unlock is announced once, with name and description; re-evaluating adds nothing', () => {
    const r = rig(1);
    const named: unknown[] = [];
    r.t.events.on('featureUnlocked', (e) => named.push(e));
    r.levelTo(5);
    assert.deepEqual(named, [{ featureId: 'warp', displayName: 'Warp', description: FEATURES.warp.description, restored: false }]);
    for (let i = 0; i < 3; i++) r.t.featureProgression.evaluate();
    r.levelTo(20);
    const ids = r.unlocks.filter((u) => !u.restored).map((u) => u.id);
    assert.deepEqual(ids, ['warp', 'job_change', 'enhancement', 'daily_commission', 'enchant', 'pet', 'dungeon', 'crafting', 'weekly_quests']);
  });

  test('save/load does not announce anything again', () => {
    const r = rig(20);
    const text = serializePlayerSave(capturePlayerSave(r.t));
    const l = rig(1);
    l.unlocks.length = 0;
    applyPlayerSave(l.t, deserializePlayerSave(text));
    l.t.featureProgression.evaluate({ restored: true });
    assert.deepEqual(l.unlocks, []);
    assert.deepEqual(l.unlocked(), r.unlocked());
  });
});

describe('menu / screen bindings', () => {
  test('screens are bound to their features; locked ones report the right reason', () => {
    const bound = Object.fromEntries(SCREENS.filter((s) => s.feature).map((s) => [s.id, s.feature]));
    assert.deepEqual(bound, {
      inventory: 'equipment', skills: 'class_1_skills', commissions: 'daily_commission', pet: 'pet', job: 'job_change',
      warp: 'warp', enhancement: 'enhancement', enchant: 'enchant', craft: 'crafting', dungeon: 'dungeon',
    });
    const r = rig(1);
    for (const s of SCREENS.filter((x) => x.feature && x.feature !== 'equipment')) {
      const check = r.t.featureProgression.check(s.feature!);
      assert.equal(check.ok, false, s.id);
      if (!check.ok) assert.equal(check.message, lockedMessage(s.feature!));
    }
    assert.equal(r.t.featureProgression.check('equipment').ok, true);
  });
});

describe('action gating (the real player paths)', () => {
  test('Enhancement: blocked at Lv14, works at Lv15 (balance unchanged)', () => {
    const r = rig(14);
    const item = createEquipment('knight_sword', seededRng(1), sequentialIds('eq'));
    r.t.equipment.add(item);
    r.t.inventory.add('enhancement_stone', 10);
    r.t.wallet.add('gold', 100_000);
    assert.ok(locked(r.actions.enhance(item.instanceId)));
    assert.equal(item.enhancement, 0);
    r.levelTo(15);
    const res = r.actions.enhance(item.instanceId, {}, () => 0);
    assert.ok(res.ok && 'success' in res && res.success);
    assert.equal(item.enhancement, 1);
  });

  test('Enchant: blocked at Lv17, available at Lv18', () => {
    const r = rig(17);
    const item = createEquipment('knight_sword', seededRng(1), sequentialIds('eq'));
    r.t.equipment.add(item);
    assert.ok(locked(r.actions.rerollEnchants(item.instanceId)));
    r.levelTo(18);
    assert.ok(!locked(r.actions.rerollEnchants(item.instanceId)));
  });

  test('Dungeon, Crafting and Pet actions: blocked at Lv19, available at Lv20', () => {
    const r = rig(19);
    assert.ok(locked(r.actions.enterDungeon('demo_dungeon', 'normal')));
    assert.equal(r.t.ledger.nextSeq, 1, 'no run issued');
    assert.ok(locked(r.actions.startCraft('demo_warborn_plate')));
    assert.ok(locked(r.actions.claimCraft('nope')));
    assert.ok(locked(r.actions.buyEggTicket()));
    assert.ok(locked(r.actions.useEggTicket()));
    assert.ok(locked(r.actions.openEgg('basic')));
    assert.ok(locked(r.actions.setActivePet(null)));
    r.levelTo(20);
    const run = r.actions.enterDungeon('demo_dungeon', 'normal');
    assert.ok(run.ok && run.run.seq === 1);
    assert.ok(!locked(r.actions.startCraft('demo_warborn_plate')), 'crafting reaches its own rules');
    assert.ok(!locked(r.actions.buyEggTicket()));
  });

  test('Warp Scrolls: blocked at Lv4 (scroll kept), usable at Lv5', () => {
    const r = rig(4);
    r.t.inventory.add('town_warp_scroll', 2);
    assert.ok(locked(r.actions.useWarpScroll('town')));
    assert.equal(r.t.inventory.count('town_warp_scroll'), 2);
    r.levelTo(5);
    const res = r.actions.useWarpScroll('town');
    assert.ok(res.ok);
    assert.equal(r.t.inventory.count('town_warp_scroll'), 1);
    assert.deepEqual(r.arrivals, [{ kind: 'town', mapId: 'demo_town' }]);
  });

  test('normal map portals are not part of the Warp feature', () => {
    const r = rig(1);
    assert.equal(r.has('warp'), false);
    const t = portalTransition(new NavIndex(NAVIGATION), { kind: 'field', mapId: 'demo_field' }, 'demo_field_to_dungeon');
    assert.equal(t.ok, true);
  });

  test('Equipment works from the start', () => {
    const r = rig(1);
    const item = createEquipment('traveler_cap', seededRng(1), sequentialIds('eq')); // any job can wear it
    r.t.equipment.add(item);
    assert.equal(r.actions.equip(item.instanceId).ok, true);
  });
});

describe('migration of older saves', () => {
  test('an old Lv20 Warrior save gains every earned feature quietly and keeps everything else', () => {
    const src = rig(20);
    src.becomeWarrior();
    src.t.quests.start('q_demo_01');
    Object.assign(src.t.progress.skillRanks, { power_slash: 3 });
    src.t.features.unlock('demo_feature'); // an explicit quest-granted feature
    const save = capturePlayerSave(src.t);
    const old = { ...save, features: ['demo_feature'] }; // a dev save from before the gate existed

    const l = rig(1);
    l.unlocks.length = 0;
    applyPlayerSave(l.t, deserializePlayerSave(JSON.stringify(old)));
    l.t.featureProgression.evaluate({ restored: true }); // what CombatWorld.loadPlayer does
    assert.deepEqual(l.unlocked(), [...PROGRESSION_FEATURES, 'demo_feature']);
    assert.ok(l.unlocks.length > 0 && l.unlocks.every((u) => u.restored), 'all quiet (restored)');
    const after = capturePlayerSave(l.t);
    const strip = (s: typeof save) => ({ ...s, features: [] });
    assert.deepEqual({ ...strip(after), recurring: save.recurring, questLog: save.questLog }, { ...strip(save) });
    assert.equal(l.t.quests.status('q_demo_01'), 'active');
    assert.deepEqual(l.t.progress.skillRanks, { power_slash: 3 });
  });
});

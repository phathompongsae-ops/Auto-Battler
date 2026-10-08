import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MVP_CRYPT_ENTRANCE_ID } from '../../src/data/quests/mainQuests';
import { QUESTS } from '../../src/data/questData';
import { normalizePotionSettings } from '../../src/items/potionSettings';
import { deserializePlayerSave, newPlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { SkillTree } from '../../src/skills/SkillTree';
import { activeSkills } from '../../src/skills/hotbar';
import { SaveError } from '../../src/save/playerSave';
import { makeSaveTarget } from './fixtures';

/*
 * Core-system save / migration QA: every persistent system added for the Demo
 * (hotbar, Dodge, potions, Auto Potion, Story progression, the Warrior-only
 * Job guard) through the real capture → serialize → deserialize → apply path.
 */

/** A Lv40 Warrior with seven learned active skills (more than the five slots). */
function warrior() {
  const t = makeSaveTarget(40);
  assert.equal(t.jobChange.select('warrior', { skipTrial: true }).ok, true);
  const tree = new SkillTree(t.player, t.features, t.events, () => {}, () => false);
  const learn = (id: string, n = 1) => { for (let i = 0; i < n; i++) assert.equal(tree.learn(id).ok, true, id); };
  learn('power_slash'); learn('charge'); learn('heavy_armor_mastery', 8); learn('shield_bash'); learn('provoke'); learn('iron_guard');
  learn('whirlwind'); learn('sword_mastery', 4); learn('heavy_strike');
  return { t, tree };
}
const roundTrip = (t: ReturnType<typeof makeSaveTarget>) => {
  const json = serializePlayerSave(capturePlayerSave(t));
  const loaded = makeSaveTarget(1);
  applyPlayerSave(loaded, deserializePlayerSave(json));
  return { json, loaded };
};

describe('save / migration QA (Demo core systems)', () => {
  test('1. a brand-new save is valid, loads, and gets the starter potions exactly once', () => {
    const save = newPlayerSave('new-1');
    const parsed = deserializePlayerSave(serializePlayerSave(save));
    assert.deepEqual(parsed.inventory, [{ itemId: 'small_hp_potion', count: 3 }, { itemId: 'small_mp_potion', count: 3 }]);
    const t = makeSaveTarget(1);
    applyPlayerSave(t, parsed);
    const again = deserializePlayerSave(serializePlayerSave(capturePlayerSave(t)));
    assert.deepEqual(again.inventory, parsed.inventory, 'saving again adds nothing');
    assert.deepEqual(again.autoPotions, normalizePotionSettings(null));
  });

  test('2–4, 13–14. more than five learned actives: five slots, every skill still learned; a pre-hotbar save migrates without loss or duplicates', () => {
    const { t, tree } = warrior();
    const actives = activeSkills('warrior', t.progress.skillRanks);
    assert.equal(actives.length, 7, 'seven learned active skills');
    const bar = Object.values(tree.loadout());
    assert.equal(bar.length, 5);
    assert.equal(new Set(bar.filter(Boolean)).size, bar.filter(Boolean).length, 'no duplicates on the bar');
    const save = capturePlayerSave(t);
    // Pre-hotbar save: same data without the hotbar field.
    const old: Record<string, unknown> = JSON.parse(serializePlayerSave(save));
    delete old.hotbar;
    const migrated = deserializePlayerSave(JSON.stringify(old));
    assert.deepEqual(migrated.skillRanks, save.skillRanks, 'no learned skill lost');
    assert.equal(migrated.skillPointsSpent, save.skillPointsSpent);
    const slots = Object.values(migrated.hotbar).filter(Boolean);
    assert.equal(slots.length, 5);
    assert.equal(new Set(slots).size, 5, 'no duplicated skills after migration');
    for (const s of slots) assert.ok(actives.includes(s!), `${s} is a learned active`);
    assert.deepEqual(migrated.inventory, save.inventory, 'no duplicated items after migration');
  });

  test('5–6. a rearranged hotbar survives save/reload; a cooldown stays with its skill through slot changes', () => {
    const { t, tree } = warrior();
    assert.equal(tree.assign('skill1', 'whirlwind').ok, true);
    assert.equal(tree.assign('skill5', 'heavy_strike').ok, true);
    const arranged = tree.loadout();
    t.combat.cooldowns.set('whirlwind', 99_999);
    assert.equal(tree.assign('skill3', 'whirlwind').ok, true, 'move it again');
    assert.equal(t.combat.cooldowns.get('whirlwind'), 99_999, 'the cooldown belongs to the skill');
    assert.equal(tree.assign('skill1', 'whirlwind').ok, true);
    const { loaded } = roundTrip(t);
    assert.deepEqual(loaded.progress.hotbar, arranged);
  });

  test('7. Dodge state and utility cooldowns are runtime-only: never saved, never corrupting a load', () => {
    const { t } = warrior();
    t.combat.utilityCooldowns.set('dodge', 1e9);
    t.combat.utilityCooldowns.set('hp_potion', 1e9);
    t.combat.dodge = { direction: 'left', startX: 0, startY: 0, startedAt: 0, distance: 72, travelled: 10 };
    const { json, loaded } = roundTrip(t);
    assert.ok(!/utilityCooldowns|"dodge"/.test(json), 'not in the save');
    assert.equal(loaded.combat.dodge, null);
    assert.equal(loaded.combat.utilityCooldowns.size, 0);
  });

  test('8–11. potion counts and Auto HP / MP preferences and thresholds persist', () => {
    const { t } = warrior();
    t.inventory.add('small_hp_potion', 4);
    t.inventory.add('medium_mp_potion', 2);
    t.progress.autoPotions = { hpEnabled: true, mpEnabled: false, hpThreshold: 37, mpThreshold: 22 };
    const { loaded } = roundTrip(t);
    assert.equal(loaded.inventory.count('small_hp_potion'), t.inventory.count('small_hp_potion'));
    assert.equal(loaded.inventory.count('medium_mp_potion'), 2);
    assert.deepEqual(loaded.progress.autoPotions, { hpEnabled: true, mpEnabled: false, hpThreshold: 37, mpThreshold: 22 });
  });

  test('12. Story quest progression persists mid-quest', () => {
    const t = makeSaveTarget(3);
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
    assert.equal(q.claim('mvp_02_meadow').ok, true);
    q.start('mvp_03_crypt');
    t.events.emit('locationReached', { locationId: MVP_CRYPT_ENTRANCE_ID });
    const { loaded } = roundTrip(t);
    assert.equal(loaded.quests.status('mvp_02_meadow'), 'claimed');
    assert.equal(loaded.quests.status('mvp_03_crypt'), 'active');
    assert.deepEqual(loaded.quests.progress('mvp_03_crypt'), q.progress('mvp_03_crypt'));
  });

  test('15. the Warrior-only Demo guard: other classes cannot be chosen, older non-Warrior saves still load, forged ranks are rejected', () => {
    const fresh = makeSaveTarget(11);
    assert.deepEqual(fresh.jobChange.canSelect('archer', { skipTrial: false }), { ok: false, reason: 'trial_incomplete' });
    const forced = makeSaveTarget(11);
    assert.equal(forced.jobChange.select('archer', { skipTrial: true }).ok, true, 'dev preview path');
    const { loaded } = roundTrip(forced);
    assert.equal(loaded.progress.classId, 'archer', 'an existing Archer save keeps its class');
    assert.deepEqual(loaded.progress.skillRanks, {});
    const forged: Record<string, unknown> = JSON.parse(serializePlayerSave(capturePlayerSave(forced)));
    forged.skillRanks = { power_slash: 1 };
    forged.skillPointsSpent = 1;
    assert.throws(() => deserializePlayerSave(JSON.stringify(forged)), SaveError, 'ranks without a tree are rejected');
  });
});

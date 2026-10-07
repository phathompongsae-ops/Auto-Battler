import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSaveTarget } from './fixtures';
import { AutoPotion, PotionSystem, POTION_COOLDOWNS } from '../../src/items/PotionSystem';
import { normalizePotionSettings } from '../../src/items/potionSettings';
import { useItem } from '../../src/items/useItem';
import { PeriodicResourceSystem } from '../../src/combat/PeriodicResourceSystem';
import { ITEMS, type ItemId } from '../../src/data/itemData';
import { capturePlayerSave, applyPlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, newPlayerSave } from '../../src/save/playerSave';

function rig() {
  const t = makeSaveTarget(3); let now = 0;
  const potions = new PotionSystem(t.events, () => now);
  const use = (id: ItemId) => useItem(t.inventory, t.player, id, { potions });
  return { t, c: t.combat, potions, use, time: (n: number) => { now = n; }, now: () => now };
}
test('real inventory consumption, independent HP/MP cooldowns, no GCD, count zero and full/dead/lock refusal', () => {
  const { t, c, use, time } = rig();
  assert.deepEqual(POTION_COOLDOWNS, { hp: 8000, mp: 12000 });
  assert.equal(use('small_hp_potion').ok, false);
  t.inventory.add('small_hp_potion', 3); t.inventory.add('small_mp_potion', 3);
  assert.deepEqual(use('small_hp_potion'), { ok: false, reason: 'resource_full' });
  c.hp = 1; c.mp = 0; c.actionLockedUntil = 312;
  assert.deepEqual(use('small_hp_potion'), { ok: false, reason: 'action_locked' });
  assert.equal(c.actionLockedUntil, 312); assert.equal(t.inventory.count('small_hp_potion'), 3);
  time(312); assert.equal(use('small_hp_potion').ok, true); assert.equal(use('small_mp_potion').ok, true);
  assert.equal(t.inventory.count('small_hp_potion'), 2); assert.equal(t.inventory.count('small_mp_potion'), 2);
  assert.equal(c.utilityCooldowns.get('hp_potion'), 8312); assert.equal(c.utilityCooldowns.get('mp_potion'), 12312);
  c.hp = 1; c.mp = 0; time(8311); assert.equal(use('small_hp_potion').ok, false);
  time(8312); assert.equal(use('small_hp_potion').ok, true); assert.equal(use('small_mp_potion').ok, false);
  c.dead = true; time(20000); assert.deepEqual(use('small_mp_potion'), { ok: false, reason: 'dead' });
});
test('all four locked instant/HoT totals, three ticks, no early ticks, no max overflow', () => {
  for (const id of ['small_hp_potion', 'medium_hp_potion', 'small_mp_potion', 'medium_mp_potion'] as const) {
    const { t, c, potions, use } = rig();
    const effect = ITEMS[id].use! as any, resource = effect.resource as 'hp' | 'mp';
    const max = resource === 'hp' ? c.stats.maxHp : c.stats.maxMp;
    t.inventory.add(id); c[resource] = 0;
    assert.equal(use(id).ok, true); assert.equal(c[resource], Math.min(max, effect.instant));
    const instant = c[resource];
    potions.periodic.update(c, 999); assert.equal(c[resource], instant);
    for (let tick = 1; tick <= 3; tick++) {
      potions.periodic.update(c, tick * 1000);
      assert.equal(c[resource], Math.min(max, instant + Math.round(Math.round(max * effect.hotPercent) * tick / 3)));
    }
    assert.equal(c.periodicResources.size, 0);
    potions.periodic.update(c, 4000); assert.ok(c[resource] <= max);
  }
});
test('same-resource potion HoT replaces; HP/MP coexist; cumulative rounding independent of frame size', () => {
  const { t, c, potions, use, time } = rig();
  c.hp = 1; c.mp = 0;
  t.inventory.add('small_hp_potion', 2); t.inventory.add('medium_hp_potion'); t.inventory.add('small_mp_potion');
  use('small_hp_potion'); use('small_mp_potion'); assert.equal(c.periodicResources.size, 2);
  // Slow update: a new HP potion replaces its earlier overdue ticks instead of stacking them.
  time(8000); c.hp = 1; use('medium_hp_potion');
  assert.equal(c.periodicResources.size, 2); assert.equal(c.periodicResources.get('potion_hp')!.sourceId, 'medium_hp_potion');
  const base = c.hp; potions.periodic.update(c, 11000);
  assert.equal(c.hp, Math.min(c.stats.maxHp, base + Math.round(c.stats.maxHp * .08)));
  const periodic = new PeriodicResourceSystem(); c.hp = 0;
  periodic.add(c, 'test', { resource: 'hp', sourceId: 'test', amount: 11, duration: 3000, interval: 1000 }, 0);
  periodic.update(c, 3000); assert.equal(c.hp, 11);
});
test('Auto thresholds, Small preference, Medium fallback, cooldown/inventory/lock/death/combat guards and debounce', () => {
  const { t, c, use, time } = rig(); const auto = new AutoPotion(); const settings = normalizePotionSettings(null);
  t.inventory.add('small_hp_potion', 5); t.inventory.add('small_mp_potion'); t.inventory.add('medium_mp_potion');
  c.hp = c.stats.maxHp * .36; c.mp = c.stats.maxMp * .26;
  let requests = 0;
  const request = (id: ItemId) => { requests++; return use(id); };
  const step = (now: number, combat = true) => { time(now); auto.update(c, t.inventory, settings, combat, now, request); };
  step(0); assert.equal(requests, 0);
  c.hp = 1; c.mp = 0; step(250, false); assert.equal(requests, 0);
  c.dead = true; step(500); assert.equal(requests, 0); c.dead = false;
  c.actionLockedUntil = 1200; step(750); assert.equal(requests, 0);
  step(1250); assert.equal(requests, 2); assert.equal(t.inventory.count('small_mp_potion'), 0);
  for (let ms = 1260; ms < 9000; ms += 16) { c.hp = 1; c.mp = 0; step(ms); }
  assert.equal(requests, 2);
  step(9500); assert.equal(requests, 3);
  c.hp = c.stats.maxHp; step(14000); assert.equal(t.inventory.count('medium_mp_potion'), 0);
  const count = requests; step(16000); assert.equal(requests, count);
});
test('inventory and Auto settings persist; older saves never receive repeated starter items', () => {
  const { t } = rig(); t.inventory.add('small_hp_potion', 2);
  t.progress.autoPotions = { hpEnabled: false, mpEnabled: true, hpThreshold: 42, mpThreshold: 18 };
  const save = capturePlayerSave(t), loaded = makeSaveTarget(1);
  applyPlayerSave(loaded, deserializePlayerSave(JSON.stringify(save)));
  assert.deepEqual(loaded.progress.autoPotions, t.progress.autoPotions);
  assert.equal(loaded.inventory.count('small_hp_potion'), 2);
  const old: any = { ...save }; delete old.autoPotions; delete old.hotbar;
  const migrated = deserializePlayerSave(JSON.stringify(old));
  assert.deepEqual(migrated.autoPotions, normalizePotionSettings(null));
  assert.deepEqual(migrated.inventory, save.inventory);
  assert.deepEqual(newPlayerSave('new').inventory, [{ itemId: 'small_hp_potion', count: 3 }, { itemId: 'small_mp_potion', count: 3 }]);
});

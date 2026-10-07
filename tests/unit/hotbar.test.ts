import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSaveTarget } from './fixtures';
import { SkillTree } from '../../src/skills/SkillTree';
import { activeSkills, normalizeHotbar } from '../../src/skills/hotbar';
import { deserializePlayerSave } from '../../src/save/playerSave';
import { capturePlayerSave, applyPlayerSave } from '../../src/save/playerSnapshot';
import { STATUSES } from '../../src/data/statusData';

function rig() {
  const t = makeSaveTarget(40);
  t.jobChange.select('warrior', { skipTrial: true });
  let locked = false;
  const tree = new SkillTree(t.player, t.features, t.events, () => {}, () => locked);
  const learn = (id: string, count = 1) => { for (let i = 0; i < count; i++) assert.equal(tree.learn(id).ok, true); };
  return { t, tree, learn, lock: (value: boolean) => { locked = value; } };
}
test('five slots fill in learning order; a sixth stays learned and emits feedback', () => {
  const { t, tree, learn } = rig();
  let unassigned = '';
  t.events.on('skillUnassigned', e => { unassigned = e.skillId; });
  learn('whirlwind'); learn('charge'); learn('power_slash'); learn('shield_bash', 5); learn('provoke');
  assert.deepEqual(Object.values(tree.loadout()), ['whirlwind', 'charge', 'power_strike', 'shield_bash', 'provoke']);
  learn('heavy_armor_mastery', 4); learn('iron_guard');
  assert.equal(unassigned, 'iron_guard');
  assert.equal(tree.rank('iron_guard'), 1);
  assert.equal(Object.values(tree.loadout()).includes('iron_guard'), false);
});
test('swap, replacement, clear and re-equip preserve cooldowns and effects; duplicates/passives rejected', () => {
  const { t, tree, learn } = rig();
  learn('power_slash'); learn('charge'); learn('shield_bash');
  t.combat.cooldowns.set('power_strike', 4000);
  t.combat.statuses.push({ def: STATUSES.guard, expiresAt: 9000 });
  const effects = [...t.combat.statuses];
  assert.equal(tree.assign('skill2', 'power_strike', false).ok, false);
  assert.equal(tree.assign('skill2', 'power_strike').ok, true);
  assert.equal(tree.loadout().skill1, 'charge');
  tree.assign('skill2', null); tree.assign('skill3', 'power_strike');
  assert.equal(tree.loadout().skill3, 'power_strike');
  assert.equal(tree.loadout().skill2, null);
  assert.equal(t.combat.cooldowns.get('power_strike'), 4000);
  assert.deepEqual(t.combat.statuses, effects);
  assert.equal(tree.assign('skill1', 'iron_guard').ok, false);
});
test('assignment waits for the action; save round trip and old-save migration preserve learned ranks', () => {
  const { t, tree, learn, lock } = rig();
  learn('charge'); learn('power_slash');
  lock(true); tree.assign('skill5', 'charge');
  assert.equal(tree.loadout().skill1, 'charge');
  tree.flushPending(); assert.equal(tree.loadout().skill5, null);
  lock(false); tree.flushPending(); assert.equal(tree.loadout().skill5, 'charge');
  const saved = capturePlayerSave(t);
  const restored = makeSaveTarget(1);
  applyPlayerSave(restored, deserializePlayerSave(JSON.stringify(saved)));
  assert.deepEqual(restored.progress.hotbar, tree.loadout());
  const old: any = { ...saved }; delete old.hotbar;
  const migrated = deserializePlayerSave(JSON.stringify(old));
  assert.deepEqual(migrated.skillRanks, saved.skillRanks);
  assert.deepEqual(Object.values(migrated.hotbar), ['power_strike', 'charge', null, null, null]);
  assert.deepEqual(normalizeHotbar({ skill1: 'charge', skill2: 'charge', skill3: 'fire_bolt' }, activeSkills('warrior', saved.skillRanks)),
    { skill1: 'charge', skill2: null, skill3: null, skill4: null, skill5: null });
});

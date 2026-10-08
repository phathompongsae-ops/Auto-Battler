import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CRYPT_MAP_ID, MAPS } from '../../src/data/maps';
import { STORY_ENCOUNTERS } from '../../src/data/storyEncounters';
import { dueTutorialBeats } from '../../src/dungeon/tutorial';
import { activeSpawnZones } from '../../src/world/mapRules';

const beats = STORY_ENCOUNTERS[CRYPT_MAP_ID].tutorial!;

describe('Story Crypt tutorial beats', () => {
  test('one short line per teaching moment, in route order, tied to real zones and checkpoints', () => {
    assert.deepEqual(beats.map((b) => b.id), ['entrance', 'first_skeleton', 'pack', 'brute', 'checkpoint_a', 'elite', 'checkpoint_b', 'boss', 'potion']);
    const zones = new Set(activeSpawnZones(MAPS[CRYPT_MAP_ID], 'story').map((z) => z.id));
    const checkpoints = new Set(MAPS[CRYPT_MAP_ID].checkpoints!.map((c) => c.id));
    for (const b of beats) {
      if (b.trigger.on === 'engage') assert.ok(zones.has(b.trigger.zone), `${b.id}: ${b.trigger.zone}`);
      if (b.trigger.on === 'checkpoint') assert.ok(checkpoints.has(b.trigger.checkpointId), `${b.id}: ${b.trigger.checkpointId}`);
      assert.ok(b.message.length <= 80, `${b.id} is short (${b.message.length})`);
    }
  });

  test('wording: only controls that exist, telegraphs by movement, Elite (not miniboss), checkpoints never heal', () => {
    const all = beats.map((b) => b.message).join(' ');
    assert.doesNotMatch(all, /mini.?boss/i);
    assert.match(all, /Dodge \(Shift\)/);
    assert.match(all, /HP Potion \(1\)/);
    assert.match(beats.find((b) => b.id === 'first_skeleton')!.message, /Tab/);
    assert.match(beats.find((b) => b.id === 'first_skeleton')!.message, /ATK \(Space\)/);
    assert.match(beats.find((b) => b.id === 'brute')!.message, /Dodge/);
    assert.match(beats.find((b) => b.id === 'elite')!.message, /^Elite/);
    for (const id of ['checkpoint_a', 'checkpoint_b']) assert.match(beats.find((b) => b.id === id)!.message, /not heal|no healing/i, id);
  });

  test('each beat is due only at its moment, and never twice', () => {
    const seen = new Set<string>();
    const take = (m: Parameters<typeof dueTutorialBeats>[2]) => dueTutorialBeats(beats, seen, m).map((b) => (seen.add(b.id), b.id));
    assert.deepEqual(take({}), []);
    assert.deepEqual(take({ entered: true }), ['entrance']);
    assert.deepEqual(take({ entered: true }), [], 'entering again in the same attempt repeats nothing');
    assert.deepEqual(take({ engaged: (z) => z === 'story_s1_lone' }), ['first_skeleton']);
    assert.deepEqual(take({ engaged: (z) => z === 'story_s1_lone' }), []);
    assert.deepEqual(take({ checkpointId: 'crypt_cp_boss' }), ['checkpoint_b']);
    assert.deepEqual(take({ engaged: () => true }), ['pack', 'brute', 'elite', 'boss']);
    assert.deepEqual(take({ checkpointId: 'crypt_cp_elite' }), ['checkpoint_a']);
    assert.deepEqual(take({ hpFraction: .44, hasHpPotion: false }), []);
    assert.deepEqual(take({ hpFraction: .46, hasHpPotion: true }), []);
    assert.deepEqual(take({ hpFraction: 0, hasHpPotion: true }), [], 'a lethal hit is not a recovery lesson');
    assert.deepEqual(take({ hpFraction: .44, hasHpPotion: true }), ['potion']);
    assert.deepEqual(take({ hpFraction: .1, hasHpPotion: true }), []);
    assert.equal(seen.size, beats.length);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, acceptStarterQuest, defeatSlime, completeStarterQuest } from '../src/game/state.js';
import { CLASS_DEFS } from '../src/data/classes.js';

test('starter vertical slice progresses end-to-end', () => {
  const state = createGameState();
  assert.equal(state.starterQuest, 'not_started');
  acceptStarterQuest(state);
  assert.equal(state.starterQuest, 'accepted');
  defeatSlime(state);
  assert.equal(state.starterQuest, 'ready_to_turn_in');
  assert.equal(state.exp, 25);
  assert.deepEqual(state.inventory, ['slime_core']);
  completeStarterQuest(state);
  assert.equal(state.starterQuest, 'complete');
  assert.equal(state.exp, 50);
  assert.deepEqual(state.inventory, []);
});

test('four launch classes are data-driven', () => {
  assert.deepEqual(Object.keys(CLASS_DEFS), ['warrior','archer','mage','cleric']);
});

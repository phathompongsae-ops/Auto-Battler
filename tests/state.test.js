import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, acceptStarterQuest, defeatSlime, completeStarterQuest, damagePlayer, respawnPlayer } from '../src/game/state.js';
import { CLASS_DEFS } from '../src/data/classes.js';

test('starter vertical slice progresses end-to-end', () => {
  const state=createGameState();
  assert.equal(state.starterQuest,'not_started');
  acceptStarterQuest(state); assert.equal(state.starterQuest,'accepted');
  defeatSlime(state); assert.equal(state.starterQuest,'ready_to_turn_in'); assert.equal(state.exp,25); assert.deepEqual(state.inventory,['slime_core']);
  completeStarterQuest(state); assert.equal(state.starterQuest,'complete'); assert.equal(state.exp,75); assert.equal(state.gold,20); assert.deepEqual(state.inventory,[]);
});
test('player damage and respawn remain playable', () => {
  const state=createGameState(); damagePlayer(state,999); assert.equal(state.hp,0); respawnPlayer(state); assert.equal(state.hp,state.maxHp);
});
test('class architecture includes Ninja advancement without enabling it in gameplay', () => {
  assert.deepEqual(Object.keys(CLASS_DEFS),['warrior','archer','mage','cleric','ninja']);
  assert.equal(CLASS_DEFS.ninja.advancedPaths.shinobi.name,'Shinobi');
  assert.equal(CLASS_DEFS.ninja.advancedPaths.onmyoji.name,'Onmyoji');
});

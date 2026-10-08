import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Action } from '../../src/input/Action';
import { PlayerCombatController, UTILITY_INPUT_BUFFER_MS } from '../../src/game/PlayerCombatController';

/** The real controller over a fake input, a lockable player and a skill system that records casts. */
function rig() {
  const pressed = new Set<Action>();
  const held = new Set<Action>();
  const input = { consumePressed: (a: Action) => pressed.delete(a), isHeld: (a: Action) => held.has(a) };
  const combat = { dead: false, actionLockedUntil: 0, actionLocked(now: number) { return now < this.actionLockedUntil; }, dodge: null as unknown };
  const player = { combat, facing: 'down', faceToward() {} };
  const calls: string[] = [];
  const skills = { use: (_c: unknown, id: string) => (calls.push(`cast:${id}`), { ok: false }) };
  const targeting = { isValid: () => false, selectNearest: () => null, cycle() {} };
  const controller = new PlayerCombatController(
    player as never, input as never, skills as never, targeting as never, () => [], () => ({ skill1: null, skill2: null, skill3: null, skill4: null, skill5: null }),
    (now) => calls.push(`dodge@${now}`),
    (resource) => calls.push(`potion:${resource}`),
  );
  return { pressed, held, combat, calls, step: (now: number) => controller.update(now) };
}

describe('Dodge / potion input buffer (presses during an executing action)', () => {
  test('a Dodge pressed mid-swing waits for the swing to end, then happens once; it never cancels the swing', () => {
    const r = rig();
    r.combat.actionLockedUntil = 1444; // a basic-attack swing
    r.pressed.add('dodge');
    r.step(1000);
    r.step(1200);
    assert.deepEqual(r.calls.filter((c) => c.startsWith('dodge')), [], 'not while the action executes');
    r.step(1450);
    r.step(1500);
    assert.deepEqual(r.calls.filter((c) => c.startsWith('dodge')), ['dodge@1450'], 'first free frame, exactly once');
  });

  test('held ATK cannot starve a waiting Dodge: no new swing starts while it waits', () => {
    const r = rig();
    r.held.add('attack');
    r.combat.actionLockedUntil = 1444;
    r.pressed.add('dodge');
    r.step(1100);
    r.step(1300);
    assert.equal(r.calls.filter((c) => c === 'cast:basic_attack').length, 0);
    r.step(1450);
    assert.ok(r.calls.includes('dodge@1450'));
  });

  test(`a press older than ${UTILITY_INPUT_BUFFER_MS} ms expires instead of firing late`, () => {
    const r = rig();
    r.combat.actionLockedUntil = 5000;
    r.pressed.add('dodge');
    r.pressed.add('hp_potion');
    r.step(1000);
    r.step(1000 + UTILITY_INPUT_BUFFER_MS + 1);
    r.combat.actionLockedUntil = 0;
    r.step(1000 + UTILITY_INPUT_BUFFER_MS + 50);
    assert.deepEqual(r.calls, []);
  });

  test('unlocked presses are immediate, as before; potions wait for a lock like Dodge', () => {
    const r = rig();
    r.pressed.add('dodge');
    r.pressed.add('mp_potion');
    r.step(100);
    assert.deepEqual(r.calls, ['potion:mp', 'dodge@100']);
    r.combat.actionLockedUntil = 600;
    r.pressed.add('hp_potion');
    r.step(300);
    assert.equal(r.calls.filter((c) => c === 'potion:hp').length, 0);
    r.step(600);
    r.step(700);
    assert.equal(r.calls.filter((c) => c === 'potion:hp').length, 1);
  });

  test('death drops any waiting request', () => {
    const r = rig();
    r.combat.actionLockedUntil = 400;
    r.pressed.add('dodge');
    r.step(100);
    r.combat.dead = true;
    r.step(200);
    r.combat.dead = false;
    r.step(450);
    assert.deepEqual(r.calls.filter((c) => c.startsWith('dodge')), []);
  });
});

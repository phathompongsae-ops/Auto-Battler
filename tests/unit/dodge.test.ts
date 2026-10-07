import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSaveTarget } from './fixtures';
import { BASIC_DODGE, DodgeSystem, dodgeDirection } from '../../src/combat/DodgeSystem';
import { CombatSystem } from '../../src/combat/CombatSystem';
import { closedGateAt } from '../../src/dungeon/gates';

function rig(blocked = (_x: number, _y: number) => false) {
  const t = makeSaveTarget(3);
  const actor = Object.assign(t.player, { x: 0, y: 0 });
  const dodge = new DodgeSystem({ blocked: (_, x, y) => blocked(x, y), move: (_, x, y) => { actor.x = x; actor.y = y; } });
  return { t, actor, dodge };
}
test('Dodge constants, cardinal priority, independent cooldown and exact game-time iframe', () => {
  assert.deepEqual(BASIC_DODGE, { cooldown: 5000, iframe: 300, distance: 72, duration: 200, minimum: 8 });
  assert.equal(dodgeDirection('up', 'left'), 'up');
  assert.equal(dodgeDirection(null, 'left'), 'left');
  assert.equal(dodgeDirection({ x: 0.2, y: 1 }, 'left'), 'down');
  const { actor, dodge } = rig();
  actor.combat.cooldowns.set('power_strike', 7000);
  assert.equal(dodge.start(actor, 'right', 'down', 100), true);
  dodge.update(actor, 200); assert.equal(actor.x, 36);
  dodge.update(actor, 300); assert.equal(actor.x, 72);
  assert.equal(actor.combat.invulnerable(399.999), true);
  assert.equal(actor.combat.invulnerable(400), false);
  assert.equal(dodge.start(actor, null, 'down', 5099), false);
  assert.equal(dodge.start(actor, null, 'down', 5100), true);
  assert.equal(actor.combat.cooldowns.get('power_strike'), 7000);
  assert.equal('stamina' in actor.combat, false);
  assert.equal('charges' in actor.combat, false);
});
test('blocked start consumes nothing; partial displacement consumes; large frames never tunnel', () => {
  const r = rig(x => x >= 6);
  assert.equal(r.dodge.start(r.actor, 'right', 'down', 0), false);
  assert.equal(r.actor.combat.utilityCooldowns.size, 0);
  assert.equal(r.actor.combat.invulnerableUntil, 0);
  const p = rig(x => x >= 30);
  assert.equal(p.dodge.start(p.actor, 'right', 'down', 0), true);
  p.dodge.update(p.actor, 200);
  assert.equal(p.actor.x, 28);
  assert.equal(p.actor.combat.utilityCooldowns.get('dodge'), 5000);
});
test('same collision hook rejects closed Story gates and active action lock', () => {
  const gate: any = { id: 'test', area: { x: 1, y: 0, w: 1, h: 1 }, requiresCleared: ['zone'] };
  const { actor, dodge } = rig((x, y) => !!closedGateAt([gate], x, y, () => false));
  actor.combat.actionLockedUntil = 312;
  assert.equal(dodge.start(actor, 'right', 'down', 100), false);
  assert.equal(dodge.start(actor, 'right', 'down', 312), true);
  dodge.update(actor, 512); assert.equal(actor.x, 30);
});
test('all damage uses reusable invulnerability; damage resumes at expiry', () => {
  const { t, actor, dodge } = rig();
  const enemy = { ...actor, id: 'enemy' };
  const combat = new CombatSystem(t.events);
  combat.rng = () => 0.5;
  dodge.start(actor, 'right', 'down', 100);
  const hp = actor.combat.hp;
  combat.now = 399;
  for (const id of ['slime_bump', 'crypt_slam_story', 'brute_smash_story'] as const) {
    assert.deepEqual(combat.dealDamage(enemy, actor, id, 1), { hit: false });
  }
  assert.equal(actor.combat.hp, hp);
  combat.now = 400;
  assert.equal(combat.dealDamage(enemy, actor, 'basic_attack', 1)?.hit, true);
  assert.ok(actor.combat.hp < hp);
});

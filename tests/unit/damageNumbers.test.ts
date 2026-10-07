import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { COMBAT_NUMBER_STYLES, damageKind, NORMAL_DAMAGE_SIZE, NumberSlots, STACK_PATTERN, STACK_WINDOW_MS } from '../../src/rendering/damageNumbers';

describe('floating combat numbers: classification and hierarchy', () => {
  test('damage events map to their style', () => {
    assert.equal(damageKind({ targetIsPlayer: false, crit: false, heavy: false }), 'normal');
    assert.equal(damageKind({ targetIsPlayer: false, crit: false, heavy: true }), 'heavy');
    assert.equal(damageKind({ targetIsPlayer: false, crit: true, heavy: true }), 'crit', 'a crit wins over heavy');
    assert.equal(damageKind({ targetIsPlayer: true, crit: false, heavy: true }), 'player_hit', 'damage taken stays distinct');
    assert.equal(damageKind({ targetIsPlayer: true, crit: true, heavy: false }), 'player_crit');
  });

  test('a critical reads first: ~1.5x size, harder pop, stronger outline, a little longer, with a spark', () => {
    const n = COMBAT_NUMBER_STYLES.normal;
    const c = COMBAT_NUMBER_STYLES.crit;
    assert.equal(n.size, NORMAL_DAMAGE_SIZE);
    assert.ok(c.size / n.size >= 1.4 && c.size / n.size <= 1.6, `ratio ${c.size / n.size}`);
    assert.ok(c.pop > n.pop && c.strokeThickness > n.strokeThickness && c.duration > n.duration);
    assert.ok(c.spark && !n.spark && !COMBAT_NUMBER_STYLES.heal.spark);
    assert.notEqual(c.color, n.color);
  });

  test('normal hits stay short and moderate; heals are green and calmer than crits; misses are pale grey', () => {
    const n = COMBAT_NUMBER_STYLES.normal;
    assert.ok(n.duration >= 450 && n.duration <= 600, `normal lifetime ${n.duration}`);
    const heal = COMBAT_NUMBER_STYLES.heal;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(heal.color.slice(i, i + 2), 16));
    assert.ok(g > r + 60 && g > b + 60, `heal ${heal.color} is green`);
    assert.ok(heal.pop < COMBAT_NUMBER_STYLES.crit.pop && heal.size < COMBAT_NUMBER_STYLES.crit.size);
    assert.equal(COMBAT_NUMBER_STYLES.miss.pop, 1);
    for (const s of Object.values(COMBAT_NUMBER_STYLES)) assert.ok(s.strokeThickness >= 3, 'always outlined');
  });
});

describe('floating combat numbers: bounded target-local slotting', () => {
  test('rapid hits on one target walk the small pattern instead of overlapping, then wrap', () => {
    const slots = new NumberSlots();
    const seen = Array.from({ length: STACK_PATTERN.length }, (_, i) => slots.next('wolf-1', i * 50));
    assert.deepEqual(seen, STACK_PATTERN);
    assert.equal(new Set(seen.map((p) => `${p.dx},${p.dy}`)).size, STACK_PATTERN.length, 'no two consecutive spots coincide');
    assert.deepEqual(slots.next('wolf-1', STACK_PATTERN.length * 50), STACK_PATTERN[0], 'wraps around');
  });

  test('the pattern stays close to the target (±14 px across, 12 px up)', () => {
    for (const p of STACK_PATTERN) assert.ok(Math.abs(p.dx) <= 14 && p.dy <= 0 && p.dy >= -12, JSON.stringify(p));
  });

  test('targets are independent, and a pause restarts at the centre', () => {
    const slots = new NumberSlots();
    slots.next('a', 0);
    assert.deepEqual(slots.next('b', 10), STACK_PATTERN[0], 'another target starts at the centre');
    assert.deepEqual(slots.next('a', 20), STACK_PATTERN[1]);
    assert.deepEqual(slots.next('a', 20 + STACK_WINDOW_MS + 1), STACK_PATTERN[0], 'after a pause');
  });

  test('memory is bounded however many targets are hit', () => {
    const slots = new NumberSlots();
    for (let i = 0; i < 500; i++) slots.next(`m-${i}`, i);
    assert.ok(slots.tracked <= 48, `tracked ${slots.tracked}`);
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatCooldown } from '../../src/ui/components/Slot';

describe('skill cooldown timer text (HUD)', () => {
  test('whole seconds from 10 s, one decimal from 1 s, nothing below 1 s', () => {
    assert.equal(formatCooldown(12_000), '12');
    assert.equal(formatCooldown(12_900), '12', 'truncated, never more time than is left');
    assert.equal(formatCooldown(10_000), '10');
    assert.equal(formatCooldown(9_990), '9.9', 'never "10.0"');
    assert.equal(formatCooldown(7_450), '7.4');
    assert.equal(formatCooldown(2_100), '2.1');
    assert.equal(formatCooldown(1_000), '1');
    assert.equal(formatCooldown(999), '', 'the sweep finishes the last fraction of a second');
    assert.equal(formatCooldown(0), '');
    assert.equal(formatCooldown(-50), '');
  });

  test('no unnecessary trailing zeros', () => {
    assert.equal(formatCooldown(4_000), '4');
    assert.equal(formatCooldown(4_050), '4');
    assert.equal(formatCooldown(4_100), '4.1');
    for (let ms = 1_000; ms < 30_000; ms += 37) assert.doesNotMatch(formatCooldown(ms), /\.0$/, String(ms));
  });
});

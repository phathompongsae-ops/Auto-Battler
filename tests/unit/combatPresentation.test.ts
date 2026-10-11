import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { WARRIOR_ART, WARRIOR_IDLE_TIMING } from '../../src/data/characterArt';
import { telegraphIntensity, telegraphStyle } from '../../src/rendering/telegraphCurve';

describe('combat presentation polish', () => {
  test('telegraph intensity: soft early, rising, urgent over the final 30%, clamped to 0..1', () => {
    const at = (p: number) => telegraphIntensity(p);
    assert.ok(at(0) > 0 && at(0) < 0.2, 'faint but visible at the start');
    assert.equal(at(1), 1);
    assert.equal(at(-1), at(0));
    assert.equal(at(2), at(1));
    for (let p = 0; p < 1; p += 0.05) assert.ok(at(p + 0.05) >= at(p), `monotonic at ${p}`);
    const early = at(0.2), mid = at(0.5), late = at(0.9);
    assert.ok(early < mid && mid < late, JSON.stringify({ early, mid, late }));
    // The last 30% of the wind-up gains more intensity than the 30% before it.
    assert.ok(at(1) - at(0.7) > 1.5 * (at(0.7) - at(0.4)));
  });

  test('telegraph style follows intensity: fill / edge stronger late, never an opaque disc', () => {
    const early = telegraphStyle(0.2, telegraphIntensity(0.2)), late = telegraphStyle(0.9, telegraphIntensity(0.9));
    assert.ok(early.fillAlpha < late.fillAlpha && early.edgeAlpha < late.edgeAlpha && early.edgeWidth < late.edgeWidth);
    assert.ok(late.fillAlpha <= 0.25 && early.fillAlpha <= 0.1, 'a soft ground shadow, not a solid fill');
    assert.ok(late.coreScale > early.coreScale);
  });

  test('Warrior idle: the same four frames in a calm, uneven ~1.8 s rhythm on every facing', () => {
    const total = WARRIOR_IDLE_TIMING.reduce((s, f) => s + f.ms, 0);
    assert.ok(total >= 1500 && total <= 2200, String(total));
    assert.deepEqual(WARRIOR_IDLE_TIMING.map((f) => f.frame).sort(), [0, 1, 2, 3]);
    assert.ok(new Set(WARRIOR_IDLE_TIMING.map((f) => f.ms)).size > 2, 'uneven holds, not a metronome');
    for (const dir of ['down', 'up', 'right'] as const) assert.equal(WARRIOR_ART.anims.idle[dir].timing, WARRIOR_IDLE_TIMING);
    // Walking keeps its even cadence.
    for (const dir of ['down', 'up', 'right'] as const) assert.equal(WARRIOR_ART.anims.walk[dir].timing, undefined);
  });
});

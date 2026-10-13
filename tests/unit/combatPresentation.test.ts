import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { WARRIOR_ART, WARRIOR_IDLE_TIMING } from '../../src/data/characterArt';
import { IDLE_MOTION_ROWS, WARRIOR_IDLE_MOTION, idleDisplacement } from '../../src/data/idleMotion';
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

  test('telegraph style: a soft red danger shadow that darkens; no rim early / mid, a feathered one late; never opaque', () => {
    const at = (p: number) => telegraphStyle(p, telegraphIntensity(p));
    const early = at(0.2), mid = at(0.5), late = at(0.9);
    assert.ok(early.fillAlpha < mid.fillAlpha && mid.fillAlpha < late.fillAlpha, 'the field darkens');
    assert.ok(early.shadeAlpha < mid.shadeAlpha && mid.shadeAlpha < late.shadeAlpha);
    assert.ok(early.fillAlpha <= 0.16, 'very faint at first');
    assert.ok(late.fillAlpha <= 0.5 && late.shadeAlpha <= 0.4, 'translucent even at impact, never a solid disc');
    // No border during early / mid wind-up; the soft rim only firms up in the late phase.
    assert.equal(early.rimAlpha, 0);
    assert.equal(mid.rimAlpha, 0);
    assert.ok(late.rimAlpha > 0.3 && late.rimAlpha <= 0.75);
    assert.ok(telegraphStyle(0.95, telegraphIntensity(0.95), 1).rimAlpha <= 0.75, 'the pulse stays restrained');
    assert.ok(late.coreScale > mid.coreScale && mid.coreScale > early.coreScale);
  });

  test('Warrior idle motion: a calm ~2.6 s breath + weight shift, feet rows untouched, small smooth steps', () => {
    const poses = WARRIOR_IDLE_MOTION;
    const total = poses.reduce((s, p) => s + p.ms, 0);
    assert.ok(total >= 2200 && total <= 3000, String(total));
    assert.ok(new Set(poses.map((p) => p.ms)).size > 2, 'uneven holds, not a metronome');
    assert.deepEqual([...new Set(poses.map((p) => p.frame))].sort(), [0, 1, 2, 3], 'uses all four drawn frames');
    // Restrained: ≤ 3 source px of lift (≈ 1 world px), ≤ 2 px of lean at the head, never a squash below rest.
    for (const p of poses) assert.ok(p.lift >= 0 && p.lift <= 3 && Math.abs(p.sway) <= 2 && Math.abs(p.trail) <= 1, JSON.stringify(p));
    // Smooth: consecutive poses (looping) move the crown by < 1 source px.
    const crown = (p: (typeof poses)[number]) => idleDisplacement(IDLE_MOTION_ROWS.crown, p);
    for (let i = 0; i < poses.length; i++) {
      const a = crown(poses[i]), b = crown(poses[(i + 1) % poses.length]);
      assert.ok(Math.hypot(a.dx - b.dx, a.dy - b.dy) < 1, `step ${i}`);
    }
    // Feet anchored: no displacement at or below the knee band, in any pose.
    for (const p of poses) for (let above = -40; above <= IDLE_MOTION_ROWS.still; above++) assert.deepEqual(idleDisplacement(above, p), { dx: 0, dy: 0 });
    // Every facing breathes; walk and actions don't.
    for (const dir of ['down', 'up', 'right'] as const) assert.equal(WARRIOR_ART.anims.idle[dir].motion, WARRIOR_IDLE_MOTION);
    for (const dir of ['down', 'up', 'right'] as const) assert.equal(WARRIOR_ART.anims.walk[dir].motion, undefined);
  });

  test('Warrior idle fallback: the same four frames in a calm, uneven ~1.8 s rhythm on every facing', () => {
    const total = WARRIOR_IDLE_TIMING.reduce((s, f) => s + f.ms, 0);
    assert.ok(total >= 1500 && total <= 2200, String(total));
    assert.deepEqual(WARRIOR_IDLE_TIMING.map((f) => f.frame).sort(), [0, 1, 2, 3]);
    assert.ok(new Set(WARRIOR_IDLE_TIMING.map((f) => f.ms)).size > 2, 'uneven holds, not a metronome');
    for (const dir of ['down', 'up', 'right'] as const) assert.equal(WARRIOR_ART.anims.idle[dir].timing, WARRIOR_IDLE_TIMING);
    // Walking keeps its even cadence.
    for (const dir of ['down', 'up', 'right'] as const) assert.equal(WARRIOR_ART.anims.walk[dir].timing, undefined);
  });
});

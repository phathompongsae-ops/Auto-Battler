import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionHitDelayMs,
  allAnimArt,
  ARCHER_ART,
  artLayout,
  artScale,
  CLERIC_ART,
  MAGE_ART,
  NINJA_ART,
  WARRIOR_ART,
} from '../../src/data/characterArt';
import { PRESENTATION_ARTS } from '../../src/data/demoConfig';
import { cardinalFacing } from '../../src/input/Direction';

const CLASS1 = [ARCHER_ART, MAGE_ART, CLERIC_ART, NINJA_ART];
const publicFile = (url: string) => join(process.cwd(), 'public', url);

describe('Class 1 character art', () => {
  test('every strip and portrait exists on disk, keys are unique', () => {
    const keys = new Set<string>();
    for (const art of [WARRIOR_ART, ...CLASS1]) {
      assert.ok(existsSync(publicFile(art.portrait.url)), art.portrait.url);
      for (const anim of allAnimArt(art)) {
        assert.ok(existsSync(publicFile(anim.url)), anim.url);
        assert.ok(!keys.has(anim.key), `duplicate key ${anim.key}`);
        keys.add(anim.key);
      }
    }
  });

  test('all five sprite sets are preloaded', () => {
    for (const art of [WARRIOR_ART, ...CLASS1]) assert.ok(PRESENTATION_ARTS.includes(art), art.displayName);
  });

  test('standard: 4f idle @5, 8f walk @10, 8f attack at the class rate; feet row 153', () => {
    const fps = { Archer: 16, Mage: 16, Cleric: 18, Ninja: 20 } as Record<string, number>;
    for (const art of CLASS1) {
      assert.equal(art.feetY, 153, art.displayName);
      for (const dir of ['down', 'up', 'right'] as const) {
        assert.deepEqual([art.anims.idle[dir].frames, art.anims.idle[dir].frameRate], [4, 5]);
        assert.deepEqual([art.anims.walk[dir].frames, art.anims.walk[dir].frameRate], [8, 10]);
        const attack = art.actions.attack[dir]!;
        assert.deepEqual([attack.frames, attack.frameRate], [8, fps[art.displayName]]);
        assert.ok(attack.hitFrame >= 0 && attack.hitFrame < attack.frames);
        // 8 frames finish inside the 500 ms basic-attack cooldown.
        assert.ok((attack.frames * 1000) / attack.frameRate <= 500, art.displayName);
      }
    }
  });

  test('visual hit / release frames from the animation manifest', () => {
    const hit = (art: typeof ARCHER_ART) => ['down', 'up', 'right'].map((d) => art.actions.attack[d as 'down']!.hitFrame);
    assert.deepEqual(hit(ARCHER_ART), [5, 5, 4]);
    assert.deepEqual(hit(MAGE_ART), [4, 3, 4]);
    assert.deepEqual(hit(CLERIC_ART), [4, 4, 4]);
    assert.deepEqual(hit(NINJA_ART), [3, 3, 2]);
  });

  test('one render scale per class: no size change between idle, walk and attack', () => {
    for (const art of CLASS1) {
      const scales = new Set(allAnimArt(art).map((anim) => artScale(art, anim)));
      assert.equal(scales.size, 1, art.displayName);
      assert.ok(Math.abs([...scales][0] - 40 / 125) < 1e-9);
    }
  });

  test('same world layout as the Warrior, so overhead UI does not move between classes', () => {
    for (const art of CLASS1) assert.deepEqual(artLayout(art), artLayout(WARRIOR_ART), art.displayName);
  });

  test('Warrior: North idle is the 4-frame strip; combat timing unchanged', () => {
    assert.equal(WARRIOR_ART.anims.idle.up.frames, 4);
    assert.match(WARRIOR_ART.anims.idle.up.url, /warrior_idle_v2_north\.png$/);
    assert.equal(WARRIOR_ART.actions.attack.down!.frameRate, 18);
    assert.equal(WARRIOR_ART.actions.attack.down!.hitFrame, 4);
    assert.equal(Math.round(actionHitDelayMs(WARRIOR_ART.actions.powerSlash.down!)), 313);
  });
});

describe('4-direction facing from free movement', () => {
  test('nearest cardinal', () => {
    assert.equal(cardinalFacing({ x: 1, y: 0.2 }), 'right');
    assert.equal(cardinalFacing({ x: -0.3, y: -1 }), 'up');
    assert.equal(cardinalFacing({ x: 0.1, y: 1 }), 'down');
    assert.equal(cardinalFacing({ x: -1, y: 0.5 }), 'left');
  });

  test('hysteresis: a near-diagonal stick keeps the current facing', () => {
    // 47° below the horizontal: dominant axis is down, but still within the band around 45°.
    const v = { x: Math.cos((47 * Math.PI) / 180), y: Math.sin((47 * Math.PI) / 180) };
    assert.equal(cardinalFacing(v), 'down');
    assert.equal(cardinalFacing(v, 'right'), 'right');
    // Clearly past the band (60°): turns.
    const w = { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) };
    assert.equal(cardinalFacing(w, 'right'), 'down');
    // Reversing the stick always turns, whatever the band.
    assert.equal(cardinalFacing({ x: -1, y: 0.1 }, 'right'), 'left');
  });
});

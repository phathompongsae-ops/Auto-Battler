import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
// @ts-expect-error: plain ESM tool without type declarations
import { checkStrip, decodePng, encodePng, measureStrip } from '../../tools/monster-art/stripMetrics.mjs';
import { MONSTER_ANIM_STATES, MONSTER_ART } from '../../src/data/monsterArt';
import { MONSTER_ANIM_ART } from '../../src/data/monsterAnimArt';

const pub = (url: string) => join(process.cwd(), 'public', url);

/** A strip of `frames` cells, each with an opaque box from (x0, top) to (x1, bottom) inclusive. */
function strip(cellWidth: number, cellHeight: number, boxes: [number, number, number, number][]) {
  const width = cellWidth * boxes.length, data = new Uint8Array(width * cellHeight * 4);
  boxes.forEach(([x0, top, x1, bottom], f) => {
    for (let y = top; y <= bottom; y++) for (let x = x0; x <= x1; x++) data.set([200, 180, 160, 255], (y * width + f * cellWidth + x) * 4);
  });
  return decodePng(encodePng(width, cellHeight, data));
}

describe('monster strip alpha / height validator', () => {
  const spec = { cellWidth: 112, cellHeight: 108, feetRow: 106, frames: 2, stand: [88, 100] as [number, number] };

  test('a well-formed strip passes and reports its bounds (PNG encode / decode round-trips)', () => {
    const png = strip(112, 108, [[40, 12, 70, 105], [41, 14, 71, 104]]);
    const { problems, metrics } = checkStrip(png, spec);
    assert.deepEqual(problems, []);
    assert.deepEqual([metrics.cells[0].top, metrics.cells[0].bottom, metrics.cells[0].height], [12, 105, 94]);
    assert.equal(metrics.cells[1].height, 92);
  });

  test('catches wrong size, crops, feet below the row, floating feet and out-of-band heights', () => {
    const fails = (boxes: [number, number, number, number][], frames = 2) => checkStrip(strip(112, 108, boxes), { ...spec, frames }).problems.join(' | ');
    assert.match(fails([[40, 12, 70, 105], [40, 12, 70, 105]], 3), /width/);
    assert.match(fails([[0, 12, 70, 105], [40, 12, 70, 105]]), /touches the cell edge/);
    assert.match(fails([[40, 12, 70, 106], [40, 12, 70, 105]]), /on \/ below the feet row/);
    assert.match(fails([[40, 12, 70, 95], [40, 12, 70, 105]]), /float 10 px/);
    assert.match(fails([[40, 2, 70, 105], [40, 12, 70, 105]]), /standing height 104 outside 88-100/);
    assert.match(fails([[40, 30, 70, 105], [40, 12, 70, 105]]), /standing height 76/);
    assert.throws(() => decodePng(Buffer.from('nope')), /not a PNG/);
  });

  test('baseline: the approved Pass 2 sheets fit the convention and the Pass 4 bands (tallest pose: Lord 151, Guardian 134, Knight 106)', () => {
    const heights = (id: string) => {
      const art = MONSTER_ART[id];
      const cells = measureStrip(decodePng(readFileSync(pub(art.url))), art.frameWidth, art.frameHeight, art.feetRow).cells;
      // Lowest visible pixel sits just above the feet row (the Lord's idle lifts a foot 2 px on its breathing frame).
      assert.ok(cells.every((c: { bottom: number }) => c.bottom < art.feetRow && art.feetRow - 1 - c.bottom <= 2), id);
      // The tallest pose: breathing frames dip a little lower.
      return [Math.max(...cells.map((c: { height: number }) => c.height))];
    };
    const lord = heights('crypt_lord'), guardian = heights('grove_guardian'), knight = heights('crypt_knight');
    const band = (id: string) => MONSTER_ANIM_ART[id].standHeight;
    assert.ok(lord.every((h: number) => h >= band('crypt_lord')[0] && h <= band('crypt_lord')[1]), `lord ${lord}`);
    assert.ok(guardian.every((h: number) => h >= band('grove_guardian')[0] && h <= band('grove_guardian')[1]), `guardian ${guardian}`);
    assert.ok(knight.every((h: number) => h > band('crypt_brute')[1]), `knight ${knight} stays taller than the Brute band`);
  });

  test('every integrated contract strip passes: exact size, no crop, feet on the row, idle / walk inside the standing band', () => {
    for (const [id, art] of Object.entries(MONSTER_ANIM_ART)) {
      if (art.status !== 'integrated') continue;
      for (const state of MONSTER_ANIM_STATES) {
        const png = decodePng(readFileSync(pub(art.anims[state].url)));
        const { problems } = checkStrip(png, {
          cellWidth: art.frameWidth, cellHeight: art.frameHeight, feetRow: art.feetRow, frames: art.anims[state].frames,
          stand: state === 'idle' || state === 'walk' ? art.standHeight : null,
        });
        assert.deepEqual(problems, [], `${id} ${state}`);
      }
    }
  });
});

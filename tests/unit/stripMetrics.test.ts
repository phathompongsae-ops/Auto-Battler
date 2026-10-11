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
  // The live Skeleton Brute contract (176x144, feet row 142, standing 88-100): a wide cell for weapon excursion, same body height.
  const brute = MONSTER_ANIM_ART.crypt_brute;
  const spec = { cellWidth: brute.frameWidth, cellHeight: brute.frameHeight, feetRow: brute.feetRow, frames: 2, stand: brute.standHeight };

  test('the Brute contract: 176x144 cell, feet row 142 (lowest pixel 141, rows 142-143 clear), standing band still 88-100', () => {
    assert.deepEqual([spec.cellWidth, spec.cellHeight, spec.feetRow], [176, 144, 142]);
    assert.deepEqual(spec.stand, [88, 100]);
  });

  test('a well-formed strip passes and reports its bounds (PNG encode / decode round-trips)', () => {
    const png = strip(176, 144, [[70, 48, 100, 141], [71, 50, 101, 140]]);
    const { problems, metrics } = checkStrip(png, spec);
    assert.deepEqual(problems, []);
    assert.deepEqual([metrics.cells[0].top, metrics.cells[0].bottom, metrics.cells[0].height], [48, 141, 94]);
    assert.equal(metrics.cells[1].height, 92);
  });

  test('catches wrong size, crops, feet below the row, floating feet and out-of-band heights', () => {
    const fails = (boxes: [number, number, number, number][], frames = 2) => checkStrip(strip(176, 144, boxes), { ...spec, frames }).problems.join(' | ');
    assert.match(fails([[70, 48, 100, 141], [70, 48, 100, 141]], 3), /width/);
    assert.match(fails([[0, 48, 100, 141], [70, 48, 100, 141]]), /touches the cell edge/);
    assert.match(fails([[70, 48, 175, 141], [70, 48, 100, 141]]), /touches the cell edge/);
    assert.match(fails([[70, 48, 100, 142], [70, 48, 100, 141]]), /on \/ below the feet row/);
    assert.match(fails([[70, 48, 100, 131], [70, 48, 100, 141]]), /float 10 px/);
    assert.match(fails([[70, 38, 100, 141], [70, 48, 100, 141]]), /standing height 104 outside 88-100/);
    assert.match(fails([[70, 66, 100, 141], [70, 48, 100, 141]]), /standing height 76/);
    // Room in the cell is not room in the band: a Brute scaled up to fill the canvas still fails.
    assert.match(fails([[20, 2, 155, 141], [20, 2, 155, 141]]), /standing height 140 outside 88-100/);
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

  test('staged Brute production idle (art-source, contract still pending) passes the 176x144 contract, feet centred', () => {
    const png = decodePng(readFileSync(join(process.cwd(), 'art-source/monsters/crypt_brute/idle.png')));
    const { problems, metrics } = checkStrip(png, { ...spec, frames: brute.anims.idle.frames });
    assert.deepEqual(problems, []);
    assert.deepEqual(metrics.cells.map((c: { height: number }) => c.height), [94, 95]);
    // The lowest band also holds the hammer head, so the feet are measured on row 138, which only the feet cross.
    for (let f = 0; f < 2; f++) {
      const xs: number[] = [];
      for (let x = 0; x < spec.cellWidth; x++) if (png.data[(138 * png.width + f * spec.cellWidth + x) * 4 + 3] >= 128) xs.push(x);
      const centre = (xs[0] + xs[xs.length - 1]) / 2;
      assert.ok(Math.abs(centre - (spec.cellWidth - 1) / 2) <= 1, `frame ${f} feet centre ${centre}`);
    }
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
        // Even faint matte/antialias pixels must not leak into the two reserved bottom rows.
        for (let y = art.feetRow; y < art.frameHeight; y++) {
          for (let x = 0; x < png.width; x++) assert.equal(png.data[(y * png.width + x) * 4 + 3], 0, `${id} ${state}: bottom alpha at ${x},${y}`);
        }
      }
    }
  });
});

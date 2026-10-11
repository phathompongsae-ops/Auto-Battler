import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { NPC_ART, NPC_ART_CONTRACT, NPC_ART_SCALE, NPC_ART_TARGETS } from '../../src/data/npcArt';
import { NPCS } from '../../src/data/npcData';

describe('NPC production art contract', () => {
  test('the contract is the Class 1 master contract (same feet row, axis and on-screen height as the player)', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'art-source/characters/class1_masters_manifest.json'), 'utf8'));
    assert.equal(manifest.standard.canvas.width, NPC_ART_CONTRACT.canvas);
    assert.equal(manifest.standard.groundBaselineY, NPC_ART_CONTRACT.feetRow);
    assert.equal(manifest.standard.bodyAxisX, NPC_ART_CONTRACT.axisX);
    assert.ok(Math.abs(NPC_ART_SCALE - 40 / 125) < 1e-9);
  });

  test('every NPC has one delivery target, and nothing else does', () => {
    assert.deepEqual(Object.keys(NPC_ART_TARGETS).sort(), Object.keys(NPCS).sort());
    assert.equal(new Set(Object.values(NPC_ART_TARGETS)).size, Object.keys(NPCS).length);
  });

  test('only delivered files are listed: each listed NPC art file exists and is its target path', () => {
    for (const [npcId, url] of Object.entries(NPC_ART)) {
      assert.ok(NPCS[npcId], `unknown NPC ${npcId}`);
      assert.equal(url, NPC_ART_TARGETS[npcId]);
      assert.ok(existsSync(join(process.cwd(), 'public', url!)), `${url} missing`);
    }
  });
});

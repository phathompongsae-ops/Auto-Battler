import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { ENV_MAP_GROUND, ENV_PROP_ART, type EnvTileSkin } from '../../src/data/environmentArt';
import { MAPS } from '../../src/data/maps';
import { MONSTER_ART, MONSTER_ART_DRAW_SCALE } from '../../src/data/monsterArt';
import { MONSTERS } from '../../src/data/monsterData';
import { SKILL_ICONS } from '../../src/data/skillIcons';
import { VFX_ART } from '../../src/data/vfxArt';

const pub = (url: string) => join(process.cwd(), 'public', url);
function pngSize(url: string): { w: number; h: number } {
  const b = readFileSync(pub(url));
  assert.equal(b.toString('ascii', 1, 4), 'PNG', url);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('Visual Pass 2 production art contracts', () => {
  test('Field and Crypt props replace their placeholder prop kinds', () => {
    for (const kind of ['tree', 'pine', 'cave', 'pillar', 'torch', 'brazier', 'throne'] as const) assert.ok(ENV_PROP_ART[kind], kind);
  });

  test('the Crypt tile skin: an atlas holding every frame it names, for tiles the Crypt actually uses', () => {
    const skin = ENV_MAP_GROUND.demo_crypt as EnvTileSkin;
    assert.equal(skin.kind, 'tiles');
    const { w, h } = pngSize(skin.url);
    const count = (w - 2 * skin.margin + skin.spacing) / (skin.frameSize + skin.spacing);
    assert.ok(Number.isInteger(count) && h === skin.frameSize + 2 * skin.margin, `${w}x${h}`);
    const used = new Set(MAPS.demo_crypt.tiles.flat());
    for (const [tile, frames] of Object.entries(skin.tiles)) {
      assert.ok(used.has(Number(tile)), `tile ${tile} appears in the Crypt`);
      for (const f of frames!) assert.ok(f >= 0 && f < count, `frame ${f} < ${count}`);
    }
    assert.equal(ENV_MAP_GROUND.demo_field, undefined, 'the Field keeps code-drawn ground until approved ground art exists');
  });

  test('every monster texture has a production sheet: two whole frames, feet inside the frame, fitted for its home scale', () => {
    const textures = new Set(Object.values(MONSTERS).map((m) => m.texture));
    for (const texture of textures) {
      const art = MONSTER_ART[texture];
      assert.ok(art, `${texture} has art`);
      const { w, h } = pngSize(art.url);
      assert.equal(w, art.frameWidth * 2, `${texture} strip width`);
      assert.equal(h, art.frameHeight, `${texture} strip height`);
      assert.ok(art.feetRow > art.frameHeight * 0.8 && art.feetRow <= art.frameHeight, `${texture} feet row`);
      const home = Object.values(MONSTERS).find((m) => m.id === texture);
      assert.equal(art.homeScale, home?.scale ?? 1, `${texture} home scale matches its MonsterDef`);
    }
    assert.equal(MONSTER_ART_DRAW_SCALE, 0.5);
  });

  test('visual tier order at runtime: slime < wolf / mushroom < boar < guardian; skeleton < brute < knight < lord', () => {
    const height = (id: keyof typeof MONSTERS) => {
      const def = MONSTERS[id];
      const art = MONSTER_ART[def.texture];
      return art.feetRow * MONSTER_ART_DRAW_SCALE * ((def.scale ?? 1) / art.homeScale);
    };
    assert.ok(height('slime') < height('wolf') && height('slime') < height('mushroom'));
    assert.ok(height('mushroom') < height('elite_boar') && height('elite_boar') < height('grove_guardian'));
    assert.ok(height('crypt_skeleton') < height('crypt_brute') && height('crypt_brute') < height('crypt_knight') && height('crypt_knight') < height('crypt_lord'));
  });

  test('combat VFX strips hold exactly their frames', () => {
    for (const [id, v] of Object.entries(VFX_ART)) {
      const { w, h } = pngSize(v.url);
      assert.equal(w, v.frameWidth * v.frames, id);
      assert.equal(h, v.frameHeight, id);
      assert.ok(v.durationMs || v.fps, `${id} has a playback rate`);
    }
  });

  test('every player active skill has a 96 px icon', () => {
    for (const skill of ['power_strike', 'fire_bolt', 'guard', 'charge', 'shield_bash', 'provoke', 'iron_guard', 'whirlwind', 'heavy_strike', 'berserk'] as const) {
      const url = SKILL_ICONS[skill];
      assert.ok(url, skill);
      assert.deepEqual(pngSize(url!), { w: 96, h: 96 }, skill);
    }
  });
});

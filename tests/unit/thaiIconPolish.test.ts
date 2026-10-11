import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EQUIPMENT_DEFS } from '../../src/data/equipmentItems';
import { ITEMS } from '../../src/data/itemData';
import { WARRIOR_C1_TREE as WARRIOR_TREE } from '../../src/data/skillTrees/warriorTree';
import { equipmentArtId, hasIconArt, jewelleryArtId } from '../../src/ui/art/iconArt';
import { STRINGS } from '../../src/ui/i18n/strings';

describe('Final Thai + icon polish', () => {
  test('every interface string has a non-empty Thai entry, and placeholders match the English ones', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [key, en] of Object.entries(STRINGS.en)) {
      const th = STRINGS.th[key as keyof typeof STRINGS.th];
      assert.ok(th && th.trim().length > 0, `th.${key} empty`);
      assert.equal(vars(th), vars(en), `th.${key} placeholders`);
    }
  });

  test('the brief\'s core terms read the same everywhere in Thai', () => {
    const th = STRINGS.th;
    assert.equal(th['nav.character'], th['screen.character']);
    assert.equal(th['nav.inventory'], th['screen.inventory']);
    assert.equal(th['tab.gold'], th['currency.gold']);
    assert.equal(th['tab.diamond'], th['currency.diamond']);
    assert.equal(th['chat.all'], th['tab.all']);
    assert.equal(th['hud.enraged'] + '!', th['notice.enraged']);
    assert.equal(th['tab.equipment'], th['hero.equipment']);
    assert.equal(th['tab.consumables'], th['itemType.consumable']);
  });

  test('every item, every equipment piece and the currencies have illustrated art', () => {
    for (const id of Object.keys(ITEMS)) assert.ok(hasIconArt(id), `item ${id}`);
    for (const [id, def] of Object.entries(EQUIPMENT_DEFS)) assert.ok(hasIconArt(jewelleryArtId(def.slotType, id) ?? equipmentArtId(def.slotType, def.weaponType, id)), `equipment ${id}`);
    assert.ok(hasIconArt('currency_gold') && hasIconArt('currency_diamond'));
  });

  test('Warrior passives and procs (and only those) need plate art; actives keep their skill icons', () => {
    const plates = WARRIOR_TREE.nodes.filter((n) => !n.combatSkillId).map((n) => n.id);
    assert.deepEqual(plates.sort(), ['battle_instinct', 'guardian_instinct', 'heavy_armor_mastery', 'sword_mastery']);
    for (const id of plates) assert.ok(hasIconArt(id), id);
  });

  test('an unknown id has no art, so its caller keeps the lettered disc / glyph fallback', () => {
    assert.equal(hasIconArt('not_an_item'), false);
  });
});

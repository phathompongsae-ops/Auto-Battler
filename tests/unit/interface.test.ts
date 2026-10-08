import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ITEMS } from '../../src/data/itemData';
import { SHOP_CATALOG } from '../../src/data/shopCatalog';
import { ACTION_CLUSTER, ACTION_SLOTS } from '../../src/ui/data/actionBar';
import { SCREEN_BY_ID, screenTabs, screenTitle } from '../../src/ui/data/screens';
import { UTILITY_SCREENS } from '../../src/ui/hud/MenuBar';
import { locale, onLocaleChange, setLocale, t } from '../../src/ui/i18n';
import { STRINGS } from '../../src/ui/i18n/strings';

describe('interface strings (Thai foundation)', () => {
  test('every locale defines every key with non-empty text and the same placeholders', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [key, en] of Object.entries(STRINGS.en)) {
      const th = STRINGS.th[key as keyof typeof STRINGS.en];
      assert.ok(th && th.trim(), `th.${key} is missing`);
      assert.equal(placeholders(th), placeholders(en), `th.${key} placeholders`);
    }
  });

  test('t() fills placeholders, follows the locale and falls back to English; ids stay English', () => {
    assert.equal(locale(), 'en');
    assert.equal(t('hud.questTurnIn', { npc: 'Captain Rowan' }), 'Turn in to Captain Rowan');
    const seen: string[] = [];
    const off = onLocaleChange((l) => seen.push(l));
    setLocale('th');
    assert.equal(t('nav.more'), 'เพิ่มเติม');
    assert.equal(screenTitle('shop'), 'ร้านค้า');
    assert.deepEqual(screenTabs('shop')?.map((tab) => [tab.id, tab.label]), [['gold', 'โกลด์'], ['diamond', 'เพชร']]);
    assert.equal(SCREEN_BY_ID.shop.title, 'Shop', 'data definitions keep their English ids / titles');
    setLocale('en');
    off();
    assert.deepEqual(seen, ['th', 'en']);
    assert.equal(screenTitle('shop'), 'Shop');
  });
});

describe('Shop shell data', () => {
  test('Shop is a real screen with separate Gold and Diamond tabs, pinned first in the top-right utility row', () => {
    assert.deepEqual(SCREEN_BY_ID.shop.tabs?.map((tab) => tab.id), ['gold', 'diamond']);
    assert.deepEqual([...UTILITY_SCREENS], ['shop', 'commissions', 'map']);
  });

  test('the catalogue is a temporary development placeholder: existing items, no prices', () => {
    assert.ok(SHOP_CATALOG.some((e) => e.section === 'gold') && SHOP_CATALOG.some((e) => e.section === 'diamond'));
    assert.equal(new Set(SHOP_CATALOG.map((e) => e.id)).size, SHOP_CATALOG.length);
    for (const entry of SHOP_CATALOG) {
      assert.ok(ITEMS[entry.itemId], `${entry.id}: unknown item`);
      assert.equal(entry.price, null, `${entry.id}: prices are not designed yet`);
      assert.equal(entry.temporary, true);
      assert.ok(entry.quantity > 0);
    }
  });
});

describe('combat cluster layout', () => {
  // Rendered size at a given --ui-scale, with the stylesheet minimums (interface.css).
  const SIZE = { primary: 96, skill: 58, dodge: 48, potion: 42 } as const;
  const MIN = { primary: 0, skill: 44, dodge: 40, potion: 40 } as const;
  const rects = (scale: number) =>
    ACTION_SLOTS.map((s) => {
      const size = Math.max(SIZE[s.tier] * scale, MIN[s.tier]);
      return { id: s.id, x: s.x * scale, y: s.y * scale, r: size / 2, size };
    });

  test('one cluster: ATK, Skill 1-5, Dodge, HP / MP Potion, with no inert placeholders', () => {
    assert.deepEqual(ACTION_SLOTS.map((s) => s.id), ['attack', 'skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'dodge', 'potion', 'mp_potion']);
    assert.deepEqual(ACTION_SLOTS.map((s) => s.binding.action), ['attack', 'skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'dodge', 'hp_potion', 'mp_potion']);
    assert.deepEqual(ACTION_SLOTS.map((s) => s.keyHint), ['Space', 'Q', 'E', 'R', 'F', 'G', 'Shift', '1', '2'], 'keyboard mappings unchanged');
  });

  for (const scale of [0.8, 1, 1.5]) {
    test(`sockets never touch and stay inside the cluster box at --ui-scale ${scale}`, () => {
      const all = rects(scale);
      for (let i = 0; i < all.length; i++) {
        const a = all[i];
        assert.ok(a.x - a.r >= -1 && a.x + a.r <= ACTION_CLUSTER.width * scale + 1, `${a.id} horizontal`);
        assert.ok(a.y - a.r >= -1 && a.y + a.r <= ACTION_CLUSTER.height * scale + 1, `${a.id} vertical`);
        for (const b of all.slice(i + 1)) {
          const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
          assert.ok(gap >= 4, `${a.id}/${b.id} gap ${gap.toFixed(1)} px at scale ${scale}`);
        }
      }
    });
  }
});

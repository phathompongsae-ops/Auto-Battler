import { ITEMS } from '../../data/itemData';
import { SHOP_CATALOG, type ShopSection } from '../../data/shopCatalog';
import type { CombatWorld } from '../../game/CombatWorld';
import { ItemSlot, type Rarity } from '../components/Slot';
import { h } from '../dom';
import { t } from '../i18n';
import { currencyIcon, itemIconUrl } from '../itemIcons';

/*
 * Shop shell: separate Gold and Diamond sections over the temporary
 * development catalogue (src/data/shopCatalog.ts). Read-only: it shows real
 * wallet balances and never changes game state. Built only while the window
 * is open; nothing polls when it is closed.
 */

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export function renderShop(world: CombatWorld, tab: string | null): HTMLElement {
  const section: ShopSection = tab === 'diamond' ? 'diamond' : 'gold';
  const currency = t(section === 'gold' ? 'currency.gold' : 'currency.diamond');
  const entries = SHOP_CATALOG.filter((entry) => entry.section === section);

  const balance = h('div', { className: 'shop-balance', attrs: { 'data-role': 'shop-balance', 'data-currency': section } }, [
    currencyIcon(section),
    h('span', { className: 'ui-caption', text: t('shop.balance', { currency }) }),
    h('strong', { text: world.wallet.get(section).toLocaleString('en-US') }),
  ]);
  const header = h('div', { className: 'shop-header' }, [
    h('div', { className: 'ui-label', text: t(section === 'gold' ? 'shop.goldIntro' : 'shop.diamondIntro') }),
    balance,
  ]);
  const notice = entries.some((entry) => entry.temporary)
    ? h('div', { className: 'shop-notice', attrs: { 'data-role': 'shop-temporary' }, text: t('shop.temporary') })
    : null;

  const cards = entries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const slot = new ItemSlot({
      content: { abbr: item.name.slice(0, 2), color: hex(item.color), title: item.name, ...(itemIconUrl(entry.itemId) ? { iconUrl: itemIconUrl(entry.itemId) } : {}) },
      rarity: item.rarity as Rarity,
    });
    const buy = h('button', { className: 'ui-button shop-card__price', text: t('shop.notForSale'), attrs: { type: 'button', disabled: '', 'aria-disabled': 'true' } });
    return h('div', { className: 'shop-card', attrs: { 'data-shop-entry': entry.id, 'data-item': entry.itemId } }, [
      slot.el,
      h('div', { className: 'shop-card__text' }, [
        h('div', { className: 'ui-label shop-card__name', text: item.name }),
        h('div', { className: 'ui-caption', text: `${t('shop.quantity', { count: entry.quantity })} · ${entry.price ?? t('shop.priceTbd')}` }),
      ]),
      buy,
    ]);
  });

  return h('div', { className: 'shop', attrs: { 'data-role': 'shop', 'data-section': section } }, [
    header,
    notice,
    h('div', { className: 'shop-grid' }, cards),
  ]);
}

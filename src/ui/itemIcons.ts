import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import type { ItemId } from '../data/itemData';
import { equipmentArtId, iconArtUrl, jewelleryArtId } from './art/iconArt';
import { h } from './dom';
import { icon } from './icons';

/*
 * The one place UI code asks for item / currency / passive art (ui/art/iconArt.ts).
 * Every lookup can come back empty, and callers then keep their existing
 * fallback (lettered disc, vector glyph), so a missing drawing never breaks a cell.
 */

export function itemIconUrl(itemId: ItemId | string): string | undefined {
  return iconArtUrl(itemId) ?? undefined;
}

export function equipmentIconUrl(defId: string): string | undefined {
  const def = EQUIPMENT_DEFS[defId];
  if (!def) return undefined;
  const id = jewelleryArtId(def.slotType, defId) ?? equipmentArtId(def.slotType, def.weaponType, defId);
  return iconArtUrl(id) ?? undefined;
}

/** Passive / proc art by skill-tree node or status id (Warrior: masteries and instincts). */
export function passiveIconUrl(id: string): string | undefined {
  return iconArtUrl(id) ?? undefined;
}

export type Currency = 'gold' | 'diamond';
const CURRENCY_GLYPH = { gold: 'coin', diamond: 'gem' } as const;

/**
 * The shared currency mark used everywhere a balance shows (Character, Inventory, Shop):
 * the illustrated coin / gem, or the vector glyph when icon art is unavailable.
 */
export function currencyIcon(kind: Currency): Element {
  const url = iconArtUrl(`currency_${kind}`);
  if (!url) return icon(CURRENCY_GLYPH[kind]);
  return h('img', { className: 'ui-currency-icon', attrs: { src: url, alt: '', 'aria-hidden': 'true', 'data-currency-icon': kind, draggable: 'false' } });
}

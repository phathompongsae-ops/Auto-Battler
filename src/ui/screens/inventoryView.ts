import { EQUIPMENT_SLOTS, RARITY_INFO, type EquipmentSlot } from '../../data/equipmentData';
import { EQUIPMENT_DEFS } from '../../data/equipmentItems';
import { ITEMS } from '../../data/itemData';
import type { CombatWorld } from '../../game/CombatWorld';
import type { BagEntry, BagFilter } from '../../inventory/Bag';
import { formatComparison, itemName, itemStatSections, itemSummary, previewEquip, SLOT_TYPE_LABEL } from '../../inventory/itemInfo';
import { createButton } from '../components/Button';
import { ItemSlot } from '../components/Slot';
import { h, setText } from '../dom';

/*
 * Inventory and equipment screens (functional placeholder UI). The bag is
 * read from CombatWorld.bag (sorted by type and rarity); every action goes
 * through the feature-gated player actions, so stats refresh exactly as the
 * game applies them.
 */

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const caption = (text: string, role?: string) => h('div', { className: 'ui-caption', text, attrs: role ? { 'data-role': role } : {} });

/** The selected bag entry survives re-renders and tab switches (by key). */
let selectedKey: string | null = null;

const FAIL_TEXT: Record<string, string> = {
  inventory_full: 'Your bag is full.',
  class_restricted: 'Your job cannot use this item.',
  weapon_not_allowed: 'Your job cannot use this weapon type.',
  off_hand_blocked_by_two_handed: 'A two-handed weapon is equipped.',
  wrong_slot: 'That item does not go there.',
  empty_slot: 'Nothing is equipped there.',
};
const failText = (r: { ok: boolean; reason?: string; message?: string }) => r.message ?? FAIL_TEXT[r.reason ?? ''] ?? r.reason ?? 'Not possible.';

function slotFor(entry: BagEntry): ItemSlot {
  if (entry.kind === 'equipment') {
    const def = EQUIPMENT_DEFS[entry.item.defId];
    return new ItemSlot({
      content: { abbr: def.name.slice(0, 2), color: RARITY_INFO[def.rarity].color, title: itemName(entry.item) },
      rarity: def.rarity,
    });
  }
  const def = ITEMS[entry.itemId];
  return new ItemSlot({ content: { abbr: def.name.slice(0, 2), color: hex(def.color), title: def.name }, count: entry.count, rarity: def.rarity });
}

/** Header: bag usage and Gold. */
function bagHeader(world: CombatWorld): HTMLElement {
  const used = world.bag.usedSlots();
  const full = used >= world.bag.capacity;
  return h('div', { className: 'inv-header' }, [
    h('span', { className: `ui-label${full ? ' inv-full' : ''}`, text: `Bag ${used} / ${world.bag.capacity}${full ? ' (full)' : ''}`, attrs: { 'data-role': 'bag-usage' } }),
    h('span', { className: 'ui-label inv-gold', text: `${world.wallet.get('gold')} G`, attrs: { 'data-role': 'gold' } }),
  ]);
}

/** The selected entry's details: name, type, stats per layer, comparison with what's equipped, actions. */
function details(world: CombatWorld, entry: BagEntry | undefined, rerender: () => void, say: (t: string) => void): HTMLElement {
  if (!entry) return h('div', { className: 'inv-details' }, [caption('Select an item to see its details.')]);
  const rows: Node[] = [];
  if (entry.kind === 'item') {
    const def = ITEMS[entry.itemId];
    rows.push(
      h('div', { className: 'ui-label', text: def.name, style: { color: RARITY_INFO[def.rarity].color } }),
      caption(`${def.type[0].toUpperCase()}${def.type.slice(1)} · ${RARITY_INFO[def.rarity].name} · ×${world.inventory.count(entry.itemId)}`),
      caption(def.sellValue > 0 ? `Sell value: ${def.sellValue} G each` : 'Cannot be sold', 'sell-value'),
    );
    return h('div', { className: 'inv-details', attrs: { 'data-role': 'details', 'data-item': entry.itemId } }, rows);
  }

  const item = entry.item;
  const def = EQUIPMENT_DEFS[item.defId];
  rows.push(h('div', { className: 'ui-label', text: itemName(item), style: { color: RARITY_INFO[def.rarity].color } }), caption(itemSummary(item)));
  for (const section of itemStatSections(item)) {
    rows.push(h('div', { className: 'inv-section', attrs: { 'data-layer': section.layer } }, [caption(section.title), ...section.lines.map((l) => h('div', { className: 'inv-stat', text: l }))]));
  }
  rows.push(caption(`Sell value: ${entry.sellValue} G`, 'sell-value'));

  // Comparison against the item currently in that slot.
  const p = world.player;
  const preview = previewEquip({ progress: p.progress, level: p.combat.level, modifiers: p.statModifiers.list(), statuses: p.combat.statuses, equipment: p.equipment }, item.instanceId);
  const compare: Node[] = [];
  if (preview) {
    compare.push(caption(preview.slotItem ? `Compared to equipped ${itemName(preview.slotItem)}` : `${SLOT_TYPE_LABEL[def.slotType]} slot is empty`));
    if (!preview.changes.length) compare.push(caption('No stat change.'));
    for (const c of preview.changes) {
      compare.push(h('div', { className: `inv-delta ${c.delta > 0 ? 'inv-delta--up' : 'inv-delta--down'}`, text: formatComparison(c), attrs: { 'data-stat': c.key, 'data-delta': String(c.delta) } }));
    }
  } else {
    const check = p.equipment.canEquip(item.instanceId);
    compare.push(caption(check.ok ? '' : failText(check), 'cannot-equip'));
  }
  rows.push(h('div', { className: 'inv-compare', attrs: { 'data-role': 'compare' } }, compare));

  const equip = createButton({
    label: 'Equip',
    variant: 'primary',
    onClick: () => {
      const r = world.equipPlayerItem(item.instanceId);
      if (r.ok) {
        selectedKey = null;
        say(`Equipped ${itemName(item)}.`);
      } else say(failText(r));
      rerender();
    },
  });
  equip.dataset.action = 'equip';
  equip.disabled = !preview;
  rows.push(equip);
  return h('div', { className: 'inv-details', attrs: { 'data-role': 'details', 'data-instance': item.instanceId } }, rows);
}

/** Inventory window body: header, sorted slot grid, details of the selected entry. */
export function renderInventory(world: CombatWorld, tab: string | null): HTMLElement {
  const filter: BagFilter = tab === 'equipment' || tab === 'materials' ? tab : 'all';
  const root = h('div', { className: 'inv', attrs: { 'data-role': 'inventory' } });
  const result = caption('', 'result');
  const say = (t: string) => setText(result, t);
  const rerender = () => {
    const entries = world.bag.entries(filter);
    const selected = entries.find((e) => e.key === selectedKey);
    const grid = h('div', { className: 'ui-grid inv-grid', style: { '--cols': '6' } });
    for (const entry of entries) {
      const slot = slotFor(entry);
      slot.el.dataset.bagKey = entry.key;
      slot.el.dataset.kind = entry.kind;
      if (entry === selected) slot.el.classList.add('ui-slot--selected');
      slot.el.addEventListener('click', () => {
        selectedKey = entry.key;
        say('');
        rerender();
      });
      grid.append(slot.el);
    }
    // Empty slots up to the bag capacity (on the All tab).
    if (filter === 'all') for (let i = entries.length; i < world.bag.capacity; i++) grid.append(new ItemSlot().el);
    root.replaceChildren(bagHeader(world), h('div', { className: 'inv-body' }, [grid, details(world, selected, rerender, say)]), result);
  };
  rerender();
  return root;
}

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  off_hand: 'Off-hand',
  head: 'Head',
  armor: 'Armor',
  gloves: 'Gloves',
  boots: 'Boots',
  necklace: 'Necklace',
  ring_1: 'Ring',
  ring_2: 'Ring',
};

/** Character → Equipment: every slot with its item, stats summary and Unequip. */
export function renderEquipment(world: CombatWorld): HTMLElement {
  const root = h('div', { className: 'ui-list', attrs: { 'data-role': 'equipment' } });
  const result = caption('', 'result');
  const rerender = () => {
    const eq = world.player.equipment;
    const rows = EQUIPMENT_SLOTS.map((slot) => {
      const item = eq.inSlot(slot);
      const row = h('div', { className: 'ui-list__row inv-equip-row', attrs: { 'data-slot': slot } });
      if (!item) {
        row.append(h('div', {}, [h('div', { className: 'ui-label', text: SLOT_LABEL[slot] }), caption('Empty')]));
        return row;
      }
      const def = EQUIPMENT_DEFS[item.defId];
      const lines = itemStatSections(item).flatMap((s) => s.lines);
      const unequip = createButton({
        label: 'Unequip',
        onClick: () => {
          const r = world.unequipPlayerSlot(slot);
          setText(result, r.ok ? `Unequipped ${itemName(item)}.` : failText(r));
          rerender();
        },
      });
      unequip.dataset.action = 'unequip';
      row.append(
        h('div', {}, [
          h('div', { className: 'ui-label', text: `${SLOT_LABEL[slot]}: ${itemName(item)}`, style: { color: RARITY_INFO[def.rarity].color } }),
          caption(lines.join(' · ')),
        ]),
        unequip,
      );
      return row;
    });
    const s = world.player.combat.stats;
    root.replaceChildren(caption(`ATK ${s.attack} · DEF ${s.defense} · Max HP ${s.maxHp} · Max MP ${s.maxMp}`, 'equip-stats'), ...rows, result);
  };
  rerender();
  return root;
}

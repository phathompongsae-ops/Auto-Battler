import { attackInterval } from '../../combat/attackSpeed';
import type { CombatStats } from '../../combat/types';
import type { EquipmentSlot } from '../../data/equipmentData';
import { EQUIPMENT_DEFS } from '../../data/equipmentItems';
import { ITEMS, type ItemDef } from '../../data/itemData';
import { JOBS } from '../../data/jobData';
import { PLAYER_BASIC_ATTACK } from '../../data/playerData';
import type { EquipmentInstance } from '../../equipment/equipment';
import type { CombatWorld } from '../../game/CombatWorld';
import type { BagEntry } from '../../inventory/Bag';
import { formatComparison, itemName, itemStatSections, previewEquip } from '../../inventory/itemInfo';
import { playerCombatStats } from '../../stats/playerCombatStats';
import { createButton } from '../components/Button';
import { ItemSlot, type SlotContent } from '../components/Slot';
import { Tabs } from '../components/Tabs';
import { h, setText, toggleClass } from '../dom';
import { icon, type IconName } from '../icons';
import { t, type StringKey } from '../i18n';
import { currencyIcon, equipmentIconUrl, itemIconUrl } from '../itemIcons';

/*
 * Character + Inventory: one view behind both the Character and the Inventory
 * windows (one bag, one equipment set, never two copies). Left: a paper doll
 * of the nine real equipment slots around the hero's idle animation, then
 * the stats that matter in combat (equipment's share in green). Right: the
 * bag by category, and the selected item's details and actions.
 *
 * Everything is read from CombatWorld and every action goes through its
 * feature-gated player actions, so stats change exactly as the game applies
 * them. Rebuilt only after an action or a category change; selecting an item
 * only moves the highlight and replaces the details.
 */

type Category = 'all' | 'equipment' | 'consumables' | 'materials';
const CATEGORIES: readonly Category[] = ['all', 'equipment', 'consumables', 'materials'];

type Selection = { kind: 'bag'; key: string } | { kind: 'slot'; slot: EquipmentSlot } | null;

/** Paper-doll columns: weapon side and armour on the left, off-hand and jewellery on the right. */
const LEFT_SLOTS: readonly EquipmentSlot[] = ['weapon', 'head', 'armor', 'gloves', 'boots'];
const RIGHT_SLOTS: readonly EquipmentSlot[] = ['off_hand', 'necklace', 'ring_1', 'ring_2'];

/** Subtle outline in an empty paper-doll slot: what goes there. */
const SLOT_SILHOUETTE: Record<EquipmentSlot, IconName> = {
  weapon: 'sword', off_hand: 'shield', head: 'helm', armor: 'chest', gloves: 'glove', boots: 'boot', necklace: 'necklace', ring_1: 'ring', ring_2: 'ring',
};

const slotLabel = (slot: EquipmentSlot) => t(`slot.${slot.startsWith('ring') ? 'ring' : slot}` as StringKey);
const rarityName = (rarity: string) => t(`rarity.${rarity}` as StringKey);

/** "Weapon · Lv20 · Uncommon · Warrior" from the string table (job names stay game data). */
function summaryText(item: EquipmentInstance): string {
  const def = EQUIPMENT_DEFS[item.defId];
  const classes = def.classes.length ? def.classes.map((c) => JOBS[c].name).join(' / ') : t('hero.anyClass');
  return [t(`slot.${def.slotType}` as StringKey), `Lv${def.equipmentLevel}`, rarityName(def.rarity), classes].join(' · ');
}

/** Stat-section titles: base (with its enhancement), bonus, enchant; future layers keep their id. */
function sectionTitle(layer: string, item: EquipmentInstance): string {
  if (layer === 'enhancement') return item.enhancement > 0 ? t('hero.section.baseEnhanced', { level: item.enhancement }) : t('hero.section.base');
  if (layer === 'definition') return t('hero.section.bonus');
  if (layer === 'enchant') return t('hero.section.enchant');
  return layer;
}
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const caption = (text: string, role?: string) => h('div', { className: 'ui-caption', text, attrs: role ? { 'data-role': role } : {} });

function failText(r: { ok: boolean; reason?: string }): string {
  const key = `hero.fail.${r.reason ?? ''}`;
  return key in FAIL_KEYS ? t(key as StringKey) : t('hero.fail.generic');
}
const FAIL_KEYS: Record<string, true> = Object.fromEntries(
  ['inventory_full', 'class_restricted', 'weapon_not_allowed', 'off_hand_blocked_by_two_handed', 'cooldown', 'resource_full', 'action_locked'].map((r) => [`hero.fail.${r}`, true]),
);

/** Vector glyph for what an item is: the fallback when its illustrated icon is unavailable. */
function equipmentGlyph(item: EquipmentInstance): IconName | undefined {
  const type = EQUIPMENT_DEFS[item.defId].slotType;
  return type === 'weapon' ? 'sword' : type === 'off_hand' ? 'shield' : undefined;
}

function equipmentContent(item: EquipmentInstance): SlotContent {
  const def = EQUIPMENT_DEFS[item.defId];
  const iconUrl = equipmentIconUrl(item.defId);
  return { abbr: def.name.slice(0, 2), color: `var(--rarity-${def.rarity})`, title: itemName(item), glyph: equipmentGlyph(item), ...(iconUrl ? { iconUrl } : {}) };
}

function itemContent(def: ItemDef): SlotContent {
  const iconUrl = itemIconUrl(def.id);
  return { abbr: def.name.slice(0, 2), color: hex(def.color), title: def.name, glyph: def.use?.kind === 'potion' ? 'potion' : undefined, ...(iconUrl ? { iconUrl } : {}) };
}

/** A bag or doll cell: rarity frame, enhancement badge, stack count, optional "better" mark. */
function cell(content: SlotContent | null, options: { rarity?: string; count?: number; enhancement?: number; better?: boolean } = {}): ItemSlot {
  const slot = new ItemSlot({ content, count: options.count ?? 0 });
  slot.el.classList.add('hero-cell');
  if (options.rarity) slot.el.dataset.rarity = options.rarity;
  if (options.enhancement) slot.el.append(h('span', { className: 'hero-cell__enh', text: `+${options.enhancement}` }));
  if (options.better) slot.el.append(h('span', { className: 'hero-cell__better', attrs: { title: t('hero.better'), 'data-role': 'better' } }));
  return slot;
}

/** Stats with and without equipment (same level, allocation, passives and statuses): the difference is the gear's share. */
function statBlock(world: CombatWorld): HTMLElement {
  const p = world.player;
  const all = p.statModifiers.list();
  const s = p.combat.stats;
  const bare: CombatStats = playerCombatStats(p.progress, p.combat.level, all.filter((m) => m.source !== 'equipment'), p.combat.statuses);
  const basic = world.skills.definition(p, PLAYER_BASIC_ATTACK);
  const aps = (stats: CombatStats) => (basic ? 1000 / attackInterval(basic.cooldown, stats.attackSpeed) : 0);
  const rows: { key: string; label: StringKey; value: string; gear: number; format: (n: number) => string }[] = [
    { key: 'attack', label: 'stat.atk', value: String(s.attack), gear: s.attack - bare.attack, format: (n) => String(Math.round(n)) },
    { key: 'defense', label: 'stat.def', value: String(s.defense), gear: s.defense - bare.defense, format: (n) => String(Math.round(n)) },
    { key: 'maxHp', label: 'stat.hp', value: String(s.maxHp), gear: s.maxHp - bare.maxHp, format: (n) => String(Math.round(n)) },
    { key: 'maxMp', label: 'stat.mp', value: String(s.maxMp), gear: s.maxMp - bare.maxMp, format: (n) => String(Math.round(n)) },
    { key: 'critChance', label: 'stat.crit', value: `${Math.round(s.critChance * 1000) / 10}%`, gear: s.critChance - bare.critChance, format: (n) => `${Math.round(n * 1000) / 10}%` },
    { key: 'aspd', label: 'stat.aspd', value: aps(s).toFixed(2), gear: aps(s) - aps(bare), format: (n) => n.toFixed(2) },
    { key: 'magicAttack', label: 'stat.matk', value: String(s.magicAttack), gear: s.magicAttack - bare.magicAttack, format: (n) => String(Math.round(n)) },
  ];
  return h(
    'dl',
    { className: 'ui-stats hero-stats', attrs: { 'data-role': 'hero-stats', 'aria-label': t('hero.stats') } },
    rows.map((r) => {
      const shown = Math.abs(r.gear) > 1e-9 && r.format(Math.abs(r.gear)) !== r.format(0);
      return h('div', { className: 'hero-stat', attrs: { 'data-stat': r.key } }, [
        h('dt', { text: t(r.label) }),
        h('dd', {}, [
          h('span', { className: 'hero-stat__value', text: r.value }),
          shown ? h('span', { className: `hero-stat__gear ${r.gear > 0 ? 'is-up' : 'is-down'}`, text: `${r.gear > 0 ? '+' : '−'}${r.format(Math.abs(r.gear))}`, attrs: { title: t('stat.fromGear') } }) : null,
        ]),
      ]);
    }),
  );
}

/** The hero's south-facing idle loop, drawn from its real strip with a CSS step animation (no extra renderer). */
function preview(world: CombatWorld): HTMLElement {
  const p = world.player;
  const art = p.currentArt;
  const strip = art?.anims.idle.down;
  const figure = h('div', { className: 'hero-preview__figure', attrs: { 'data-role': 'hero-preview' } });
  if (art && strip) {
    figure.style.backgroundImage = `url("${strip.url}")`;
    figure.style.backgroundSize = `${strip.frames * 100}% 100%`;
    figure.style.setProperty('--frames', String(strip.frames));
    figure.style.setProperty('--loop', `${strip.frames / strip.frameRate}s`);
    figure.dataset.art = art.displayName.toLowerCase();
    toggleClass(figure, 'is-pixel', !art.smooth);
  }
  return h('div', { className: 'hero-preview' }, [
    figure,
    h('div', { className: 'hero-preview__name' }, [
      h('span', { className: 'hero-preview__level', text: `Lv ${p.combat.level}` }),
      h('span', { className: 'ui-label', text: JOBS[p.progress.classId].name }),
    ]),
  ]);
}

function entryMatches(entry: BagEntry, category: Category): boolean {
  if (category === 'all') return true;
  if (category === 'equipment') return entry.kind === 'equipment';
  if (entry.kind === 'equipment') return false;
  return category === 'consumables' ? entry.type === 'consumable' : entry.type !== 'consumable';
}

/** Equipping it changes something and lowers nothing (the existing comparison). */
function strictlyBetter(world: CombatWorld, item: EquipmentInstance): boolean {
  const p = world.player;
  const preview = previewEquip({ progress: p.progress, level: p.combat.level, modifiers: p.statModifiers.list(), statuses: p.combat.statuses, equipment: p.equipment }, item.instanceId);
  return !!preview && preview.changes.length > 0 && preview.changes.every((c) => c.delta > 0);
}

/** Character / Inventory window body. `focus` only names the window; both show the same hero, bag and actions. */
export function renderHero(world: CombatWorld, focus: 'character' | 'inventory'): HTMLElement {
  let category: Category = 'all';
  let selection: Selection = null;
  const bagOpen = world.featureProgression.check('equipment').ok;

  const root = h('div', { className: 'hero', attrs: { 'data-role': focus === 'inventory' ? 'inventory' : 'character', 'data-focus': focus } });
  const result = caption('', 'result');
  const say = (text: string) => setText(result, text);
  const cells = new Map<string, HTMLElement>();
  const details = h('div', { className: 'hero-details' });
  const grid = h('div', { className: 'ui-grid inv-grid hero-grid', attrs: { 'data-role': 'bag-grid' } });

  let built = false;
  const tabs = new Tabs(
    CATEGORIES.map((id) => ({ id, label: t(`tab.${id}` as StringKey) })),
    (id) => {
      category = id as Category;
      if (selection?.kind === 'bag') selection = null;
      if (built) build();
    },
  );
  tabs.el.classList.add('hero-tabs');

  const select = (next: Selection) => {
    selection = next;
    say('');
    for (const [key, el] of cells) toggleClass(el, 'ui-slot--selected', !!next && (next.kind === 'bag' ? `bag:${next.key}` : `slot:${next.slot}`) === key);
    renderDetails();
  };

  const act = (run: () => { ok: boolean; reason?: string }, done: string) => {
    const r = run();
    if (r.ok) selection = null;
    build();
    say(r.ok ? done : failText(r));
  };

  function renderDetails(): void {
    const sel = selection;
    if (!sel) {
      details.replaceChildren(caption(t('hero.selectHint')));
      details.removeAttribute('data-role');
      return;
    }
    details.dataset.role = 'details';
    delete details.dataset.instance;
    delete details.dataset.item;
    if (sel.kind === 'slot') {
      const item = world.player.equipment.inSlot(sel.slot);
      if (!item) {
        details.replaceChildren(caption(t('hero.emptySlot', { slot: slotLabel(sel.slot) })));
        return;
      }
      const unequip = createButton({ label: t('hero.unequip'), onClick: () => act(() => world.unequipPlayerSlot(sel.slot), t('hero.didUnequip', { item: itemName(item) })) });
      unequip.dataset.action = 'unequip';
      details.dataset.instance = item.instanceId;
      details.replaceChildren(head(itemName(item), EQUIPMENT_DEFS[item.defId].rarity, `${summaryText(item)} · ${t('hero.equipped')}`, [unequip]), body(equipmentLines(item, false)));
      return;
    }
    const entry = world.bag.entries('all').find((e) => e.key === sel.key);
    if (!entry) {
      selection = null;
      renderDetails();
      return;
    }
    if (entry.kind === 'equipment') {
      const item = entry.item;
      const p = world.player;
      const comparison = previewEquip({ progress: p.progress, level: p.combat.level, modifiers: p.statModifiers.list(), statuses: p.combat.statuses, equipment: p.equipment }, item.instanceId);
      const equip = createButton({ label: t('hero.equip'), variant: 'primary', onClick: () => act(() => world.equipPlayerItem(item.instanceId), t('hero.didEquip', { item: itemName(item) })) });
      equip.dataset.action = 'equip';
      equip.disabled = !comparison;
      details.dataset.instance = item.instanceId;
      const lines = equipmentLines(item, true);
      const compare: Node[] = [];
      const check = p.equipment.canEquip(item.instanceId);
      if (comparison && check.ok) {
        // Stat deltas come from the shared item text (English game data, like item names); the captions are interface text.
        compare.push(caption(comparison.slotItem ? t('hero.compareEquipped', { item: itemName(comparison.slotItem) }) : t('hero.compareEmpty', { slot: slotLabel(check.slot) })));
        for (const c of comparison.changes) {
          compare.push(h('div', { className: `inv-delta ${c.delta > 0 ? 'inv-delta--up' : 'inv-delta--down'}`, text: formatComparison(c), attrs: { 'data-stat': c.key, 'data-delta': String(c.delta) } }));
        }
      } else compare.push(caption(failText(check), 'cannot-equip'));
      lines.push(h('div', { className: 'inv-compare', attrs: { 'data-role': 'compare' } }, compare));
      details.replaceChildren(head(itemName(item), entry.rarity, summaryText(item), [equip]), body(lines));
      return;
    }
    const def = ITEMS[entry.itemId];
    const count = world.inventory.count(entry.itemId);
    const actions: HTMLElement[] = [];
    if (def.use) {
      const use = createButton({ label: t('hero.use'), variant: 'primary', onClick: () => act(() => world.usePlayerItem(entry.itemId), t('hero.didUse', { item: def.name })) });
      use.dataset.action = 'use';
      actions.push(use);
    }
    details.dataset.item = entry.itemId;
    const lines: Node[] = [];
    const effect = useText(def);
    if (effect) lines.push(h('div', { className: 'inv-stat', text: effect, attrs: { 'data-role': 'effect' } }));
    lines.push(caption(def.sellValue > 0 ? t('hero.sellValueEach', { gold: def.sellValue }) : t('hero.notSellable'), 'sell-value'));
    details.replaceChildren(head(def.name, def.rarity, `${t(`itemType.${def.type}` as StringKey)} · ${rarityName(def.rarity)} · ×${count}`, actions), body(lines));
  }

  function head(name: string, rarity: string, sub: string, actions: HTMLElement[]): HTMLElement {
    return h('div', { className: 'hero-details__head' }, [
      h('div', { className: 'hero-details__title' }, [
        h('div', { className: 'ui-label hero-details__name', text: name, attrs: { 'data-rarity': rarity } }),
        caption(sub),
      ]),
      ...(actions.length ? [h('div', { className: 'hero-details__actions' }, actions)] : []),
    ]);
  }
  const body = (lines: Node[]) => h('div', { className: 'hero-details__body' }, lines);

  function equipmentLines(item: EquipmentInstance, withSell: boolean): Node[] {
    const lines: Node[] = itemStatSections(item).map((section) =>
      h('div', { className: 'inv-section', attrs: { 'data-layer': section.layer } }, [caption(sectionTitle(section.layer, item)), ...section.lines.map((l) => h('div', { className: 'inv-stat', text: l }))]),
    );
    if (withSell) {
      const entry = world.bag.entries('equipment').find((e) => e.kind === 'equipment' && e.item.instanceId === item.instanceId);
      if (entry) lines.push(caption(t('hero.sellValue', { gold: entry.sellValue }), 'sell-value'));
    }
    return lines;
  }

  function dollSlot(slot: EquipmentSlot): HTMLElement {
    const item = world.player.equipment.inSlot(slot);
    const def = item ? EQUIPMENT_DEFS[item.defId] : null;
    const c = cell(item ? equipmentContent(item) : null, { rarity: def?.rarity, enhancement: item?.enhancement });
    c.el.dataset.slot = slot;
    c.el.setAttribute('role', 'button');
    c.el.setAttribute('aria-label', item ? `${slotLabel(slot)}: ${itemName(item)}` : `${slotLabel(slot)}: ${t('hero.empty')}`);
    if (!item) {
      const silhouette = icon(SLOT_SILHOUETTE[slot]);
      silhouette.classList.add('hero-cell__silhouette');
      silhouette.dataset.silhouette = slot;
      c.el.append(silhouette, h('span', { className: 'hero-cell__slot', text: slotLabel(slot) }));
    }
    else c.el.title = `${slotLabel(slot)}: ${itemName(item)}`;
    c.el.addEventListener('click', () => select({ kind: 'slot', slot }));
    cells.set(`slot:${slot}`, c.el);
    return c.el;
  }

  function build(): void {
    built = true;
    cells.clear();
    const used = world.bag.usedSlots();
    const full = used >= world.bag.capacity;
    const bar = h('div', { className: 'hero-bar' }, [
      h('span', { className: 'hero-currency', attrs: { 'data-currency': 'gold', title: t('currency.gold') } }, [
        currencyIcon('gold'),
        h('span', { text: `${world.wallet.get('gold').toLocaleString('en-US')} G`, attrs: { 'data-role': 'gold' } }),
      ]),
      h('span', { className: 'hero-currency', attrs: { 'data-currency': 'diamond', title: t('currency.diamond') } }, [
        currencyIcon('diamond'),
        h('span', { text: world.wallet.get('diamond').toLocaleString('en-US'), attrs: { 'data-role': 'diamond' } }),
      ]),
      result,
      bagOpen ? h('span', { className: `hero-bag${full ? ' inv-full' : ''}`, text: t(full ? 'hero.bagFull' : 'hero.bag', { used, capacity: world.bag.capacity }), attrs: { 'data-role': 'bag-usage' } }) : null,
    ]);

    const doll = h('div', { className: 'hero-doll', attrs: { 'data-role': 'equipment', 'aria-label': t('hero.equipment') } }, [
      h('div', { className: 'hero-doll__column' }, LEFT_SLOTS.map(dollSlot)),
      preview(world),
      h('div', { className: 'hero-doll__column' }, RIGHT_SLOTS.map(dollSlot)),
    ]);
    // Stats sit under the paper doll as one character sheet (a 2-column block at every size, never a footer strip).
    const left = h('div', { className: 'hero-left' }, [doll, h('section', { className: 'hero-sheet', attrs: { 'aria-label': t('hero.stats') } }, [h('div', { className: 'hero-sheet__title', text: t('hero.stats') }), statBlock(world)])]);

    let right: HTMLElement;
    if (bagOpen) {
      const entries = world.bag.entries('all').filter((e) => entryMatches(e, category));
      const bagCells = entries.map((entry) => {
        const c =
          entry.kind === 'equipment'
            ? cell(equipmentContent(entry.item), { rarity: entry.rarity, enhancement: entry.item.enhancement, better: strictlyBetter(world, entry.item) })
            : cell(itemContent(ITEMS[entry.itemId]), { rarity: entry.rarity, count: entry.count });
        c.el.dataset.bagKey = entry.key;
        c.el.dataset.kind = entry.kind;
        c.el.setAttribute('role', 'button');
        c.el.addEventListener('click', () => select({ kind: 'bag', key: entry.key }));
        cells.set(`bag:${entry.key}`, c.el);
        return c.el;
      });
      // Free capacity as empty cells on All, so the bag reads as a bag.
      const empties = category === 'all' ? Array.from({ length: Math.max(0, world.bag.capacity - entries.length) }, () => new ItemSlot().el) : [];
      grid.replaceChildren(...bagCells, ...empties);
      right = h('div', { className: 'hero-right' }, [tabs.el, grid, details]);
    } else right = h('div', { className: 'hero-right' }, [caption(t('hero.locked'), 'bag-locked'), details]);

    root.replaceChildren(bar, left, right);
    select(selection);
  }

  build();
  return root;
}

function useText(def: ItemDef): string | null {
  const use = def.use;
  if (!use) return null;
  if (use.kind === 'potion') return t('hero.effect.potion', { amount: use.instant, resource: use.resource.toUpperCase(), percent: Math.round(use.hotPercent * 100) });
  return t(`hero.effect.${use.kind}` as StringKey);
}


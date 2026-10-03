import { h, setText, setVar, toggleClass } from '../dom';

export type SlotSize = 'sm' | 'md' | 'lg';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** What a slot shows. Until icon art exists, `abbr` + `color` draw a placeholder disc. */
export interface SlotContent {
  abbr: string;
  color?: string;
  /** Icon image URL; replaces the placeholder disc when set. */
  iconUrl?: string;
  title?: string;
}

interface BaseSlotOptions {
  size?: SlotSize;
  content?: SlotContent | null;
}

function slotClasses(kind: string, size: SlotSize | undefined): string {
  return `ui-slot ui-slot--${kind}${size && size !== 'md' ? ` ui-slot--${size}` : ''}`;
}

/** Shared visual part of skill and item slots. */
abstract class SlotBase {
  readonly el: HTMLDivElement;
  protected readonly icon: HTMLDivElement;

  protected constructor(kind: string, options: BaseSlotOptions) {
    this.icon = h('div', { className: 'ui-slot__icon' });
    this.el = h('div', { className: slotClasses(kind, options.size) }, [this.icon]);
    this.setContent(options.content ?? null);
  }

  setContent(content: SlotContent | null): void {
    toggleClass(this.el, 'ui-slot--empty', !content);
    this.icon.hidden = !content;
    if (!content) {
      this.el.removeAttribute('title');
      return;
    }
    setText(this.icon, content.iconUrl ? '' : content.abbr);
    setVar(this.icon, '--slot-color', content.color ?? '#5b6478');
    this.icon.style.backgroundImage = content.iconUrl ? `url("${content.iconUrl}")` : '';
    if (content.title) this.el.title = content.title;
  }
}

export interface SkillSlotOptions extends BaseSlotOptions {
  /** Keyboard hint shown in the corner, e.g. "Q". */
  keyHint?: string;
  /** Round action button (attack/skills) vs. square bar slot. */
  kind?: 'skill' | 'action';
}

/** Skill or action button with a clock-wipe cooldown and disabled state. */
export class SkillSlot extends SlotBase {
  private readonly cooldown: HTMLDivElement;
  private readonly cooldownText: HTMLSpanElement;
  private readonly keyHint: HTMLSpanElement;

  constructor(options: SkillSlotOptions = {}) {
    super(options.kind ?? 'skill', options);
    this.cooldown = h('div', { className: 'ui-slot__cooldown' });
    this.cooldownText = h('span', { className: 'ui-slot__cooldown-text' });
    this.keyHint = h('span', { className: 'ui-slot__key', text: options.keyHint ?? '' });
    this.el.append(this.cooldown, this.cooldownText, this.keyHint);
    this.setCooldown(0, 0);
  }

  /** @param remainingMs time left; @param totalMs full cooldown length. */
  setCooldown(remainingMs: number, totalMs: number): void {
    const fraction = remainingMs > 0 && totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
    setVar(this.cooldown, '--cd', fraction.toFixed(3));
    this.cooldown.hidden = fraction === 0;
    // Only label long cooldowns; a half-second swing timer would just flicker.
    setText(this.cooldownText, remainingMs >= 1000 ? (remainingMs / 1000).toFixed(remainingMs < 10000 ? 1 : 0) : '');
    this.el.dataset.cooldown = fraction > 0 ? 'true' : 'false';
  }

  setDisabled(disabled: boolean): void {
    toggleClass(this.el, 'is-disabled', disabled);
  }
}

export interface ItemSlotOptions extends BaseSlotOptions {
  count?: number;
  rarity?: Rarity;
}

/** Inventory / equipment / reward slot with stack count and rarity border. */
export class ItemSlot extends SlotBase {
  private readonly count: HTMLSpanElement;

  constructor(options: ItemSlotOptions = {}) {
    super('item', options);
    this.count = h('span', { className: 'ui-slot__count' });
    this.el.append(this.count);
    this.setCount(options.count ?? 0);
    this.setRarity(options.rarity ?? 'common');
  }

  setCount(count: number): void {
    setText(this.count, count > 1 ? String(count) : '');
  }

  setRarity(rarity: Rarity): void {
    this.el.dataset.rarity = rarity;
  }
}

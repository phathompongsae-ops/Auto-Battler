import { h, setText, setVar, toggleClass } from '../dom';
import { icon, type IconName } from '../icons';

export type SlotSize = 'sm' | 'md' | 'lg';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** What a slot shows. Until icon art exists, `abbr` + `color` draw a placeholder disc. */
export interface SlotContent {
  abbr: string;
  color?: string;
  /** Icon image URL; replaces the placeholder disc when set. */
  iconUrl?: string;
  /** Original vector glyph from the game's shared icon language. */
  glyph?: IconName;
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
    // An illustrated icon replaces the vector glyph; the art is the element's background. A glyph shown before
    // (e.g. the melee ATK swords before a Mage's Magic Bolt) is removed: it has no text for setText to clear.
    if (content.glyph && !content.iconUrl) this.icon.replaceChildren(icon(content.glyph));
    else if (content.iconUrl) this.icon.replaceChildren();
    toggleClass(this.icon, 'has-art', !!content.iconUrl);
    setVar(this.icon, '--slot-color', content.color ?? '#5b6478');
    setVar(this.el, '--slot-color', content.color ?? '#5b6478');
    this.icon.style.backgroundImage = content.iconUrl ? `url("${content.iconUrl}")` : '';
    if (content.title) this.el.title = content.title;
  }
}

export interface SkillSlotOptions extends BaseSlotOptions {
  /** Keyboard hint shown in the corner, e.g. "Q". */
  keyHint?: string;
  /** Round action button (attack/skills) vs. square bar slot. */
  kind?: 'skill' | 'action';
  /**
   * Show the cooldown sweep / timer (default true). Off for the basic attack,
   * whose swing interval is not a player-facing cooldown.
   */
  showCooldown?: boolean;
}

/**
 * Player-facing cooldown text: whole seconds from 10 s ("12"), one decimal
 * from 1 s ("7.4", "2.1"; never a trailing ".0"), nothing below 1 s (the
 * sweep finishes on its own). Values are truncated, so the number never
 * shows more time than is left and never reads "10.0".
 */
export function formatCooldown(remainingMs: number): string {
  if (!(remainingMs >= 1000)) return '';
  const seconds = remainingMs / 1000;
  if (seconds >= 10) return String(Math.floor(seconds));
  const tenths = Math.floor(seconds * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
}

/** Skill or action button with a clock-wipe cooldown and disabled state. */
export class SkillSlot extends SlotBase {
  private readonly cooldown: HTMLDivElement;
  private readonly cooldownText: HTMLSpanElement;
  private readonly keyHint: HTMLSpanElement;
  private readonly showCooldown: boolean;
  /** Whether the last update was cooling down (a cooldown ending gets one brief ready flash). */
  private coolingDown = false;

  constructor(options: SkillSlotOptions = {}) {
    super(options.kind ?? 'skill', options);
    this.showCooldown = options.showCooldown ?? true;
    this.cooldown = h('div', { className: 'ui-slot__cooldown' });
    this.cooldownText = h('span', { className: 'ui-slot__cooldown-text' });
    this.keyHint = h('span', { className: 'ui-slot__key', text: options.keyHint ?? '' });
    this.el.append(this.cooldown, this.cooldownText, this.keyHint);
    // The ready flash is a one-shot CSS animation; clear its class when it ends so it can run again.
    this.el.addEventListener('animationend', (e) => {
      if (e.animationName === 'ui-slot-ready') this.el.classList.remove('is-ready-flash');
    });
    this.setCooldown(0, 0);
  }

  /**
   * @param remainingMs time left; @param totalMs full cooldown length. Drives
   * the radial sweep (--cd = remaining fraction) and the small timer; called
   * every frame, it only touches the DOM when a value actually changes.
   */
  setCooldown(remainingMs: number, totalMs: number): void {
    const fraction = this.showCooldown && remainingMs > 0 && totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
    setVar(this.cooldown, '--cd', fraction.toFixed(3));
    // Called every frame: only write what changed (attribute writes invalidate the styles keyed on them).
    if (this.cooldown.hidden !== (fraction === 0)) this.cooldown.hidden = fraction === 0;
    setText(this.cooldownText, fraction > 0 ? formatCooldown(remainingMs) : '');
    const state = fraction > 0 ? 'true' : 'false';
    if (this.el.dataset.cooldown !== state) this.el.dataset.cooldown = state;
    if (this.coolingDown && fraction === 0) this.el.classList.add('is-ready-flash');
    this.coolingDown = fraction > 0;
  }

  setDisabled(disabled: boolean): void {
    toggleClass(this.el, 'is-disabled', disabled);
    if (this.el.getAttribute('aria-disabled') !== String(disabled)) this.el.setAttribute('aria-disabled', String(disabled));
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

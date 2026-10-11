import type { CombatantState } from '../../combat/CombatantState';
import { h, setText, setVar, toggleClass } from '../dom';
import { icon, type IconName } from '../icons';
import { passiveIconUrl } from '../itemIcons';

/**
 * A compact row of timed-state icons for one combatant: its active statuses
 * (data/statusData) and its periodic recoveries (potion HoTs). Presentation
 * only; it reads the existing combat state and never changes it.
 *
 * Every cell is created once and reused: per frame only the remaining-time
 * sweep (--cd) and the seconds text change, and only when their rounded
 * values do. More than `max` states collapse into a "+N" chip.
 */

/** Longer than this reads as "until it ends" (Enrage lasts until death or reset): no timer, no sweep. */
const UNTIMED_MS = 99_000;

const GLYPHS: Record<string, IconName> = {
  guard: 'shield',
  iron_guard: 'shield',
  guardian_instinct: 'shield',
  berserk: 'flame',
  battle_instinct: 'sword',
  enraged: 'flame',
  stunned: 'whirl',
  taunted: 'crossed_swords',
  potion_hp: 'heal',
  potion_mp: 'potion',
};

/** Procs from the Warrior tree show their illustrated plate (the same art as in Skills); everything else keeps its glyph. */
const PROC_ART = new Set(['guardian_instinct', 'battle_instinct']);

function statusSymbol(id: string, kind: 'buff' | 'debuff'): Element {
  const url = PROC_ART.has(id) ? passiveIconUrl(id) : undefined;
  if (!url) return icon(GLYPHS[id] ?? (kind === 'buff' ? 'rune' : 'lock'));
  return h('img', { className: 'ui-icon ui-icon--art', attrs: { src: url, alt: '', 'aria-hidden': 'true', 'data-status-art': id, draggable: 'false' } });
}

const RECOVERY: Record<string, { name: string; color: string }> = {
  potion_hp: { name: 'HP Recovery', color: '#86ef8f' },
  potion_mp: { name: 'MP Recovery', color: '#7fd4ff' },
};

interface Cell {
  el: HTMLDivElement;
  time: HTMLSpanElement;
  id: string;
  /** Duration first seen for the current application (a refresh re-measures it). */
  total: number;
  expiresAt: number;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class StatusRow {
  readonly el: HTMLDivElement;
  private readonly cells: Cell[] = [];
  private readonly more: HTMLSpanElement;
  private shownCount = -1;
  private hiddenCount = -1;
  /** Emphasised applications already pulsed, per combatant (id → expiresAt): re-targeting never replays a pulse. */
  private readonly pulsed = new WeakMap<CombatantState, Map<string, number>>();
  private owner: CombatantState | null = null;

  /**
   * @param label Short visible label per status id (the boss frame names Enrage; the player row shows icons only).
   * @param emphasise Status ids that get a brief pulse when they first appear.
   */
  constructor(
    hud: string,
    private readonly max = 6,
    private readonly label: (id: string) => string | null = () => null,
    private readonly emphasise: ReadonlySet<string> = new Set(),
  ) {
    this.more = h('span', { className: 'hud-status__more' });
    this.more.hidden = true;
    this.el = h('div', { className: 'hud-status', attrs: { 'data-hud': hud, role: 'list' } });
    for (let i = 0; i < max; i++) {
      const time = h('span', { className: 'hud-status__time' });
      const el = h('div', { className: 'hud-status__cell', attrs: { role: 'listitem' } }, [h('span', { className: 'hud-status__sweep' }), time]);
      el.hidden = true;
      el.addEventListener('animationend', () => el.classList.remove('is-new'));
      this.cells.push({ el, time, id: '', total: 0, expiresAt: 0 });
      this.el.append(el);
    }
    this.el.append(this.more);
    this.el.hidden = true;
  }

  setLabel(text: string): void {
    this.el.setAttribute('aria-label', text);
  }

  /** Relabel visible cells (after a language change). */
  relabel(): void {
    for (const cell of this.cells) if (cell.id) this.applyLabel(cell);
  }

  update(c: CombatantState | null, now: number): void {
    let n = 0;
    let extra = 0;
    this.owner = c;
    if (c && !c.dead) {
      for (const s of c.statuses) {
        if (n < this.max) this.fill(this.cells[n++], s.def.id, s.def.name, s.def.kind, hex(s.def.color), s.expiresAt, now);
        else extra++;
      }
      for (const [group, effect] of c.periodicResources) {
        const meta = RECOVERY[group];
        if (!meta) continue;
        // The next tick plus the ticks still to come after it.
        const expiresAt = effect.nextAt + (effect.ticks - effect.appliedTicks - 1) * effect.interval;
        if (n < this.max) this.fill(this.cells[n++], group, meta.name, 'buff', meta.color, expiresAt, now, effect.ticks * effect.interval);
        else extra++;
      }
    }
    for (let i = n; i < this.cells.length; i++) this.clear(this.cells[i]);
    if (n !== this.shownCount) {
      this.shownCount = n;
      this.el.hidden = n === 0;
    }
    if (extra !== this.hiddenCount) {
      this.hiddenCount = extra;
      this.more.hidden = extra === 0;
      setText(this.more, extra ? `+${extra}` : '');
    }
  }

  private fill(cell: Cell, id: string, name: string, kind: 'buff' | 'debuff', color: string, expiresAt: number, now: number, total?: number): void {
    if (cell.id !== id) {
      cell.id = id;
      cell.el.dataset.status = id;
      cell.el.dataset.kind = kind;
      cell.el.style.setProperty('--status-color', color);
      cell.el.querySelector('.ui-icon')?.remove();
      cell.el.prepend(statusSymbol(id, kind));
      cell.el.title = name;
      cell.el.setAttribute('aria-label', name);
      this.applyLabel(cell);
      cell.el.hidden = false;
      cell.expiresAt = -1;
    }
    if (this.emphasise.has(id) && this.owner) {
      let seen = this.pulsed.get(this.owner);
      if (!seen) this.pulsed.set(this.owner, (seen = new Map()));
      if (seen.get(id) !== expiresAt) {
        seen.set(id, expiresAt);
        cell.el.classList.add('is-new');
      }
    }
    if (expiresAt !== cell.expiresAt) {
      // Applied or refreshed: this is the full duration from here.
      cell.expiresAt = expiresAt;
      cell.total = total ?? Math.max(1, expiresAt - now);
    }
    const remaining = Math.max(0, expiresAt - now);
    const timed = remaining <= UNTIMED_MS;
    toggleClass(cell.el, 'is-untimed', !timed);
    setText(cell.time, timed ? String(Math.ceil(remaining / 1000)) : '');
    // Elapsed fraction, in 2% steps: the sweep never writes the style more often than it can visibly move.
    setVar(cell.el, '--cd', timed ? (Math.round((1 - remaining / cell.total) * 50) / 50).toFixed(2) : '0');
  }

  private applyLabel(cell: Cell): void {
    const text = this.label(cell.id);
    let tag = cell.el.querySelector<HTMLSpanElement>('.hud-status__label');
    if (text) {
      if (!tag) cell.el.append((tag = h('span', { className: 'hud-status__label' })));
      setText(tag, text);
    } else tag?.remove();
    toggleClass(cell.el, 'has-label', !!text);
  }

  private clear(cell: Cell): void {
    if (!cell.id) return;
    cell.id = '';
    cell.el.hidden = true;
    cell.el.classList.remove('is-new');
    delete cell.el.dataset.status;
  }
}

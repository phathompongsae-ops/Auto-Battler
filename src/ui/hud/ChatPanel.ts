import { JOBS } from '../../data/jobData';
import { MAPS } from '../../data/maps';
import { MONSTERS, type MonsterId } from '../../data/monsterData';
import type { CombatWorld } from '../../game/CombatWorld';
import { createButton } from '../components/Button';
import { Tabs } from '../components/Tabs';
import { h, setText, toggleClass } from '../dom';
import { icon } from '../icons';
import { onLocaleChange, t } from '../i18n';
import { inTab, type ChatChange, type ChatLog, type ChatMessage, type ChatTab } from './chatLog';

/** Preview lines in the compact state. */
const PREVIEW_LINES = 2;
/** The compact preview stays at full strength this long after a new message, then quietens. */
const FRESH_MS = 6000;
const TABS: readonly ChatTab[] = ['all', 'party', 'system'];

/**
 * Lower-left chat (Demo shell, local only). Compact: the latest one or two
 * messages that the loot feed is no longer showing, plus an unread count;
 * tap to expand. Expanded: All / Party / System tabs over a scrollable log
 * that grows upward, and a close button. No input bar: there is no online
 * chat to send to yet. Everything updates on chat changes only, never per frame.
 */
export class ChatPanel {
  readonly el: HTMLDivElement;
  private readonly preview: HTMLButtonElement;
  private readonly previewLines: HTMLDivElement[] = [];
  private readonly previewTag: HTMLSpanElement;
  private readonly unreadEl: HTMLSpanElement;
  private readonly panel: HTMLDivElement;
  private readonly tabsHost: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly empty: HTMLDivElement;
  private readonly note: HTMLDivElement;
  private readonly close: HTMLButtonElement;
  private tabs!: Tabs;
  private tab: ChatTab = 'all';
  private expanded = false;
  private unread = 0;
  private freshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly nodes = new Map<number, HTMLDivElement>();
  private readonly cleanups: (() => void)[] = [];

  constructor(
    world: CombatWorld,
    private readonly chat: ChatLog,
    private readonly onToggle: (expanded: boolean) => void,
  ) {
    this.previewTag = h('span', { className: 'hud-chat__tag' });
    this.unreadEl = h('span', { className: 'hud-chat__unread' });
    for (let i = 0; i < PREVIEW_LINES; i++) this.previewLines.push(h('div', { className: 'hud-chat__line' }));
    this.preview = h('button', { className: 'hud-chat__preview', attrs: { type: 'button', 'data-action': 'chat-expand' } }, [
      h('div', { className: 'hud-chat__head' }, [icon('chat'), this.previewTag, this.unreadEl]),
      ...this.previewLines,
    ]);
    this.preview.addEventListener('click', () => this.setExpanded(true));

    this.tabsHost = h('div', { className: 'hud-chat__tabs' });
    this.close = createButton({ icon: 'close', iconOnly: true, variant: 'ghost', title: t('chat.collapse'), onClick: () => this.setExpanded(false) });
    this.close.dataset.action = 'chat-collapse';
    this.list = h('div', { className: 'hud-chat__list', attrs: { role: 'log', 'aria-live': 'off', 'data-role': 'chat-list' } });
    this.empty = h('div', { className: 'hud-chat__empty', attrs: { 'data-role': 'chat-empty' } });
    this.note = h('div', { className: 'hud-chat__note' });
    this.panel = h('div', { className: 'hud-chat__panel', attrs: { 'data-role': 'chat-panel' } }, [
      h('div', { className: 'hud-chat__bar' }, [this.tabsHost, this.close]),
      this.list,
      this.empty,
      this.note,
    ]);
    this.panel.hidden = true;
    this.el = h('div', { className: 'hud-chat', attrs: { 'data-hud': 'chat', 'data-state': 'collapsed' } }, [this.preview, this.panel]);

    this.buildTabs();
    this.relabel();
    this.renderList();
    this.renderPreview();
    this.cleanups.push(
      chat.onChange((change) => this.onChange(change)),
      routeNotices(world, chat),
      onLocaleChange(() => {
        this.buildTabs();
        this.relabel();
        this.renderList();
      }),
    );
  }

  get isExpanded(): boolean {
    return this.expanded;
  }

  setExpanded(expanded: boolean): void {
    if (expanded === this.expanded) return;
    this.expanded = expanded;
    this.el.dataset.state = expanded ? 'expanded' : 'collapsed';
    this.panel.hidden = !expanded;
    this.preview.hidden = expanded;
    if (expanded) {
      this.unread = 0;
      this.renderPreview();
      this.list.scrollTop = this.list.scrollHeight;
      this.close.focus({ preventScroll: true });
    }
    this.onToggle(expanded);
  }

  destroy(): void {
    for (const off of this.cleanups) off();
    if (this.freshTimer) clearTimeout(this.freshTimer);
  }

  private buildTabs(): void {
    const current = this.tab;
    this.tabs = new Tabs(TABS.map((id) => ({ id, label: t(`chat.${id}`) })), (id) => {
      if (id === this.tab) return;
      this.tab = id as ChatTab;
      this.renderList();
    });
    this.tabs.select(current);
    this.tabsHost.replaceChildren(this.tabs.el);
  }

  private relabel(): void {
    setText(this.previewTag, t('chat.title'));
    this.preview.setAttribute('aria-label', t('chat.expand'));
    this.preview.title = t('chat.expand');
    this.close.title = t('chat.collapse');
    this.close.setAttribute('aria-label', t('chat.collapse'));
    this.panel.setAttribute('aria-label', t('chat.title'));
    setText(this.note, t('chat.localOnly'));
    this.renderUnread();
  }

  private onChange(change: ChatChange): void {
    if (change.type === 'added') {
      if (inTab(change.message, this.tab)) {
        const stick = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 24;
        this.list.append(this.node(change.message));
        this.syncEmpty();
        if (stick) this.list.scrollTop = this.list.scrollHeight;
      }
      if (!this.expanded) {
        this.unread++;
        this.markFresh();
      }
    } else if (change.type === 'updated') {
      const node = this.nodes.get(change.message.id);
      if (node) setText(node.lastElementChild as HTMLElement, change.message.text);
    } else if (change.type === 'trimmed') {
      for (const id of change.ids) {
        this.nodes.get(id)?.remove();
        this.nodes.delete(id);
      }
    }
    this.renderPreview();
  }

  private node(message: ChatMessage): HTMLDivElement {
    const node = h('div', { className: 'hud-chat__msg', attrs: { 'data-channel': message.channel, 'data-kind': message.kind, 'data-id': String(message.id) } }, [
      h('span', { className: 'hud-chat__channel', text: t(`chat.${message.channel}`) }),
      h('span', { className: 'hud-chat__text', text: message.text }),
    ]);
    if (message.color) node.style.setProperty('--msg-color', message.color);
    this.nodes.set(message.id, node);
    return node;
  }

  /** Full rebuild: only on tab or language changes. */
  private renderList(): void {
    this.nodes.clear();
    this.list.replaceChildren(...this.chat.messages.filter((m) => inTab(m, this.tab)).map((m) => this.node(m)));
    this.syncEmpty();
    this.list.scrollTop = this.list.scrollHeight;
  }

  private syncEmpty(): void {
    const none = this.list.childElementCount === 0;
    this.empty.hidden = !none;
    this.list.hidden = none;
    if (none) setText(this.empty, t(this.tab === 'party' ? 'chat.partyEmpty' : 'chat.empty'));
  }

  /** The newest messages the loot feed is not already showing (by message, or by text: a hint can be re-sent). */
  private renderPreview(): void {
    const shown: ChatMessage[] = [];
    const all = this.chat.messages;
    const liveTexts = new Set<string>();
    for (const m of all) if (this.chat.isLive(m.id)) liveTexts.add(m.text);
    for (let i = all.length - 1; i >= 0 && shown.length < PREVIEW_LINES; i--) {
      const m = all[i];
      if (!this.chat.isLive(m.id) && !liveTexts.has(m.text) && !shown.some((s) => s.text === m.text)) shown.unshift(m);
    }
    this.previewLines.forEach((line, i) => {
      const message = shown[i - (PREVIEW_LINES - shown.length)];
      setText(line, message?.text ?? '');
      line.hidden = !message;
      if (message?.color) line.style.setProperty('--msg-color', message.color);
    });
    toggleClass(this.preview, 'is-empty', shown.length === 0);
    this.renderUnread();
  }

  private renderUnread(): void {
    setText(this.unreadEl, this.unread ? t('chat.unread', { count: this.unread }) : '');
    this.unreadEl.hidden = !this.unread;
    toggleClass(this.preview, 'has-unread', this.unread > 0);
  }

  private markFresh(): void {
    this.preview.classList.add('is-fresh');
    if (this.freshTimer) clearTimeout(this.freshTimer);
    this.freshTimer = setTimeout(() => {
      this.freshTimer = null;
      this.preview.classList.remove('is-fresh');
    }, FRESH_MS);
  }
}

/**
 * System notices that have no loot-feed line (their world text stays as combat feedback): level up,
 * feature unlocks, job change, entering a map and boss defeats. Only the player's own events.
 */
function routeNotices(world: CombatWorld, chat: ChatLog): () => void {
  const ev = world.events;
  const isPlayer = (id: string) => id === world.player.id;
  const offs = [
    ev.on('levelUp', ({ entityId, level }) => isPlayer(entityId) && void chat.add('system', 'level', t('chat.levelUp', { level }), '#ffe066')),
    ev.on('featureUnlocked', ({ displayName, restored }) => !restored && void chat.add('system', 'feature', t('chat.featureUnlocked', { feature: displayName }), '#7fd4ff')),
    ev.on('jobChanged', ({ entityId, jobId }) => isPlayer(entityId) && void chat.add('system', 'job', t('chat.jobChanged', { job: JOBS[jobId].name }), '#ffe066')),
    // Debug resets move the player too; they are not travel.
    ev.on('mapChanged', ({ toMapId, portalId }) => portalId !== 'dev_reset' && void chat.add('system', 'map', t('chat.mapEntered', { map: MAPS[toMapId]?.displayName ?? toMapId }), '#c9d6e3')),
    ev.on('bossDefeated', ({ monsterId }) => void chat.add('system', 'boss', t('chat.bossDefeated', { boss: MONSTERS[monsterId as MonsterId]?.name ?? monsterId }), '#ffe066')),
  ];
  return () => offs.forEach((off) => off());
}

import { RARITY_INFO, type Rarity } from '../../data/equipmentData';
import { EQUIPMENT_DEFS } from '../../data/equipmentItems';
import { SKILLS } from '../../data/skillData';
import { ITEMS } from '../../data/itemData';
import type { CombatWorld } from '../../game/CombatWorld';
import { rewardText } from '../../quests/questText';
import { h } from '../dom';
import { t, type StringKey } from '../i18n';
import type { ChatLog } from './chatLog';

/** How long a line stays on screen (real time, ms). */
const LINE_MS = 4500;
/** Story tutorial lines stay a little longer: they are read, not glanced at. */
const TUTORIAL_LINE_MS = 7000;
const MAX_LINES = 6;

export type LootFeedKind = 'gold' | 'item' | 'equipment' | 'rare' | 'full' | 'quest' | 'locked' | 'dungeon' | 'tutorial';

/**
 * Left side: a short feed of what the player just received or what dropped
 * for them: Gold, materials (auto-looted), equipment and rare drops waiting
 * on the ground, and "bag full" warnings. Newest at the bottom. Every line is
 * also archived in the System chat channel; while a line is on screen the chat
 * preview skips it, so nothing shows twice.
 */
export class LootFeed {
  readonly el: HTMLDivElement;
  private readonly unsubscribe: (() => void)[] = [];
  /** Merges repeated pickups of the same item within a short window ("+3 Wolf Fang"). */
  private readonly recent = new Map<string, { line: HTMLDivElement; amount: number; at: number }>();
  private readonly chatIds = new WeakMap<HTMLDivElement, number>();

  constructor(world: CombatWorld, private readonly chat: ChatLog) {
    this.el = h('div', { className: 'hud-loot', attrs: { 'data-hud': 'loot-feed', 'aria-live': 'polite' } });
    const ev = world.events;
    this.unsubscribe.push(
      ev.on('skillUnassigned', ({ skillId }) => this.push('locked', t('feed.skillUnassigned', { skill: SKILLS[skillId].name }), '#fbe7b8')),
      ev.on('goldGained', ({ amount }) => this.stack('gold', 'gold', amount, (n) => t('feed.gold', { amount: n }), '#ffd166')),
      ev.on('itemAcquired', ({ itemId, amount, source }) => {
        if (source !== 'loot') return;
        const def = ITEMS[itemId];
        this.stack('item', itemId, amount, (n) => `+${n} ${def.name}`, RARITY_INFO[def.rarity].color);
      }),
      ev.on('equipmentPicked', ({ defId }) => {
        const def = EQUIPMENT_DEFS[defId];
        this.push('equipment', t('feed.equipment', { item: def.name, rarity: t(`rarity.${def.rarity}` as StringKey) }), RARITY_INFO[def.rarity].color);
      }),
      ev.on('equipmentDropped', ({ defId, rarity }) => this.push('rare', dropText(rarity, EQUIPMENT_DEFS[defId].name), RARITY_INFO[rarity].color)),
      ev.on('lootDropped', ({ itemId, delivery }) => {
        if (delivery !== 'ground') return;
        const def = ITEMS[itemId];
        this.push('rare', dropText(def.rarity, def.name), RARITY_INFO[def.rarity].color);
      }),
      ev.on('lootBlocked', ({ name }) => this.push('full', t('feed.bagFull', { item: name }), '#ff6b6b')),
      // Dungeon entry refused: say exactly what is missing (the player stays on this map).
      ev.on('mapEntryBlocked', ({ message }) => this.push('locked', message, '#ffb86b')),
      // Dungeon attempt: checkpoints (retry positions, no healing), party wipes and failure.
      ev.on('tutorialHint', ({ message }) => this.push('tutorial', message, '#fbe7b8', TUTORIAL_LINE_MS)),
      // Story guidance belongs to its dungeon: leaving the map clears it from the feed.
      ev.on('mapChanged', () => {
        for (const line of this.el.querySelectorAll<HTMLDivElement>('[data-loot-kind=tutorial]')) this.drop(line);
      }),
      ev.on('progressBlocked', ({ message }) => this.push('locked', message, '#ffb86b')),
      // Auto Move never fails silently: no route found, stuck on the way, or it could not start at all.
      ev.on('navigationChanged', ({ status }) => {
        if (status === 'failed') this.push('locked', t('feed.autoMoveFailed'), '#ffb86b');
      }),
      ev.on('navigationUnavailable', () => this.push('locked', t('feed.autoMoveFailed'), '#ffb86b')),
      ev.on('checkpointReached', ({ label }) => this.push('dungeon', t('feed.checkpoint', { label }), '#9fd8ff')),
      ev.on('partyWiped', ({ retriesLeft, failed }) =>
        this.push('dungeon', failed ? t('feed.wipedNoRetries') : retriesLeft === 1 ? t('feed.wipedRetry') : t('feed.wipedRetries', { count: retriesLeft }), '#ff6b6b'),
      ),
      ev.on('dungeonFailed', () => this.push('dungeon', t('feed.dungeonFailed'), '#ff6b6b')),
      // Quest feedback (main / side quests; Daily and Weekly have their own screen).
      ev.on('questStarted', ({ questId }) => {
        const def = world.quests.defs[questId];
        if (def && !def.repeat) this.push('quest', t('feed.questAccepted', { quest: def.title }), '#7fd4ff');
      }),
      ev.on('questCompleted', ({ questId }) => {
        const def = world.quests.defs[questId];
        if (def && !def.repeat) this.push('quest', t('feed.questDone', { quest: def.title }), '#7fd4ff');
      }),
      ev.on('questClaimed', ({ questId }) => {
        const def = world.quests.defs[questId];
        if (!def || def.repeat) return;
        this.push('quest', t('feed.questComplete', { quest: def.title }), '#ffe066');
        const reward = rewardText(def);
        if (reward) this.push('quest', reward, '#ffe066');
      }),
    );
  }

  private stack(kind: LootFeedKind, key: string, amount: number, text: (n: number) => string, color: string): void {
    const now = performance.now();
    const prev = this.recent.get(key);
    if (prev && prev.line.isConnected && now - prev.at < 1500) {
      prev.amount += amount;
      prev.at = now;
      prev.line.textContent = text(prev.amount);
      const id = this.chatIds.get(prev.line);
      if (id !== undefined) this.chat.update(id, text(prev.amount));
      return;
    }
    const line = this.push(kind, text(amount), color);
    this.recent.set(key, { line, amount, at: now });
  }

  private push(kind: LootFeedKind, text: string, color: string, ms = LINE_MS): HTMLDivElement {
    const line = h('div', { className: `hud-loot__line hud-loot__line--${kind}`, text, attrs: { 'data-loot-kind': kind }, style: { color } });
    this.el.append(line);
    const message = this.chat.add('system', kind, text, color);
    this.chatIds.set(line, message.id);
    this.chat.setLive(message.id, true);
    while (this.el.childElementCount > MAX_LINES) this.drop(this.el.firstElementChild as HTMLDivElement);
    setTimeout(() => this.drop(line), ms);
    return line;
  }

  /** Remove a line from the feed; its archived chat message becomes previewable. */
  private drop(line: HTMLDivElement): void {
    line.remove();
    const id = this.chatIds.get(line);
    if (id !== undefined) this.chat.setLive(id, false);
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.el.remove();
  }
}

const dropText = (rarity: Rarity, item: string) => t(rarity === 'rare' || rarity === 'legendary' ? 'feed.rareDrop' : 'feed.drop', { item });

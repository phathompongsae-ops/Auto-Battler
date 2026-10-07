import { RARITY_INFO, type Rarity } from '../../data/equipmentData';
import { EQUIPMENT_DEFS } from '../../data/equipmentItems';
import { ITEMS } from '../../data/itemData';
import type { CombatWorld } from '../../game/CombatWorld';
import { rewardText } from '../../quests/questText';
import { h } from '../dom';

/** How long a line stays on screen (real time, ms). */
const LINE_MS = 4500;
/** Story tutorial lines stay a little longer: they are read, not glanced at. */
const TUTORIAL_LINE_MS = 7000;
const MAX_LINES = 6;

export type LootFeedKind = 'gold' | 'item' | 'equipment' | 'rare' | 'full' | 'quest' | 'locked' | 'dungeon' | 'tutorial';

/**
 * Left side: a short feed of what the player just received or what dropped
 * for them: Gold, materials (auto-looted), equipment and rare drops waiting
 * on the ground, and "bag full" warnings. Newest at the bottom.
 */
export class LootFeed {
  readonly el: HTMLDivElement;
  private readonly unsubscribe: (() => void)[] = [];
  /** Merges repeated pickups of the same item within a short window ("+3 Wolf Fang"). */
  private readonly recent = new Map<string, { line: HTMLDivElement; amount: number; at: number }>();

  constructor(world: CombatWorld) {
    this.el = h('div', { className: 'hud-loot', attrs: { 'data-hud': 'loot-feed', 'aria-live': 'polite' } });
    const ev = world.events;
    this.unsubscribe.push(
      ev.on('goldGained', ({ amount }) => this.stack('gold', 'gold', amount, (n) => `+${n} Gold`, '#ffd166')),
      ev.on('itemAcquired', ({ itemId, amount, source }) => {
        if (source !== 'loot') return;
        const def = ITEMS[itemId];
        this.stack('item', itemId, amount, (n) => `+${n} ${def.name}`, RARITY_INFO[def.rarity].color);
      }),
      ev.on('equipmentPicked', ({ defId }) => {
        const def = EQUIPMENT_DEFS[defId];
        this.push('equipment', `Equipment: ${def.name} (${RARITY_INFO[def.rarity].name})`, RARITY_INFO[def.rarity].color);
      }),
      ev.on('equipmentDropped', ({ defId, rarity }) => this.push('rare', `${dropLabel(rarity)}: ${EQUIPMENT_DEFS[defId].name} on the ground`, RARITY_INFO[rarity].color)),
      ev.on('lootDropped', ({ itemId, delivery }) => {
        if (delivery !== 'ground') return;
        const def = ITEMS[itemId];
        this.push('rare', `${dropLabel(def.rarity)}: ${def.name} on the ground`, RARITY_INFO[def.rarity].color);
      }),
      ev.on('lootBlocked', ({ name }) => this.push('full', `Bag full: ${name} left on the ground`, '#ff6b6b')),
      // Dungeon entry refused: say exactly what is missing (the player stays on this map).
      ev.on('mapEntryBlocked', ({ message }) => this.push('locked', message, '#ffb86b')),
      // Dungeon attempt: checkpoints (retry positions, no healing), party wipes and failure.
      ev.on('tutorialHint', ({ message }) => this.push('tutorial', message, '#fbe7b8', TUTORIAL_LINE_MS)),
      // Story guidance belongs to its dungeon: leaving the map clears it from the feed.
      ev.on('mapChanged', () => {
        for (const line of this.el.querySelectorAll('[data-loot-kind=tutorial]')) line.remove();
      }),
      ev.on('progressBlocked', ({ message }) => this.push('locked', message, '#ffb86b')),
      ev.on('checkpointReached', ({ label }) => this.push('dungeon', `Checkpoint: ${label}`, '#9fd8ff')),
      ev.on('partyWiped', ({ retriesLeft, failed }) =>
        this.push('dungeon', failed ? 'Defeated: no retries left' : `Defeated: ${retriesLeft} ${retriesLeft === 1 ? 'retry' : 'retries'} left`, '#ff6b6b'),
      ),
      ev.on('dungeonFailed', () => this.push('dungeon', 'Dungeon failed: returned to Town', '#ff6b6b')),
      // Quest feedback (main / side quests; Daily and Weekly have their own screen).
      ev.on('questStarted', ({ questId }) => {
        const def = world.quests.defs[questId];
        if (def && !def.repeat) this.push('quest', `Quest accepted: ${def.title}`, '#7fd4ff');
      }),
      ev.on('questCompleted', ({ questId }) => {
        const def = world.quests.defs[questId];
        if (def && !def.repeat) this.push('quest', `Objectives done: ${def.title}`, '#7fd4ff');
      }),
      ev.on('questClaimed', ({ questId }) => {
        const def = world.quests.defs[questId];
        if (!def || def.repeat) return;
        this.push('quest', `Quest complete: ${def.title}`, '#ffe066');
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
      return;
    }
    const line = this.push(kind, text(amount), color);
    this.recent.set(key, { line, amount, at: now });
  }

  private push(kind: LootFeedKind, text: string, color: string, ms = LINE_MS): HTMLDivElement {
    const line = h('div', { className: `hud-loot__line hud-loot__line--${kind}`, text, attrs: { 'data-loot-kind': kind }, style: { color } });
    this.el.append(line);
    while (this.el.childElementCount > MAX_LINES) this.el.firstElementChild?.remove();
    setTimeout(() => line.remove(), ms);
    return line;
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.el.remove();
  }
}

const dropLabel = (rarity: Rarity) => (rarity === 'rare' || rarity === 'legendary' ? 'Rare drop' : 'Drop');

/**
 * Local chat history (Demo): no network, no server sync. Messages are game and
 * system notices produced on this device; Party has no producer until a party
 * system exists. History is bounded; the oldest messages are dropped first.
 */

export type ChatChannel = 'party' | 'system';
/** A view over the channels: All shows every channel. */
export type ChatTab = 'all' | ChatChannel;

export interface ChatMessage {
  readonly id: number;
  readonly channel: ChatChannel;
  /** What produced it (loot, quest, dungeon, level, …); drives colour and tests, never layout. */
  readonly kind: string;
  text: string;
  readonly color?: string;
  /** Game-session real time (performance.now) when it was logged. */
  readonly at: number;
  /** Speaker for player messages (none for system notices). */
  readonly source?: string;
}

export type ChatChange = { type: 'added'; message: ChatMessage } | { type: 'updated'; message: ChatMessage } | { type: 'trimmed'; ids: readonly number[] } | { type: 'live' };

export const CHAT_HISTORY_LIMIT = 150;

export const inTab = (message: ChatMessage, tab: ChatTab) => tab === 'all' || message.channel === tab;

export class ChatLog {
  private readonly list: ChatMessage[] = [];
  private readonly listeners = new Set<(change: ChatChange) => void>();
  /** Messages still on screen in the HUD loot feed: the chat preview skips them so nothing shows twice. */
  private readonly liveIds = new Set<number>();
  private nextId = 1;

  constructor(readonly limit = CHAT_HISTORY_LIMIT) {}

  get messages(): readonly ChatMessage[] {
    return this.list;
  }

  add(channel: ChatChannel, kind: string, text: string, color?: string, source?: string): ChatMessage {
    const message: ChatMessage = { id: this.nextId++, channel, kind, text, color, at: performance.now(), source };
    this.list.push(message);
    this.emit({ type: 'added', message });
    if (this.list.length > this.limit) {
      const dropped = this.list.splice(0, this.list.length - this.limit);
      for (const m of dropped) this.liveIds.delete(m.id);
      this.emit({ type: 'trimmed', ids: dropped.map((m) => m.id) });
    }
    return message;
  }

  /** A stacked feed line changed ("+3 Wolf Fang"): the logged message follows it instead of adding another. */
  update(id: number, text: string): void {
    const message = this.list.find((m) => m.id === id);
    if (!message || message.text === text) return;
    message.text = text;
    this.emit({ type: 'updated', message });
  }

  setLive(id: number, live: boolean): void {
    if (live === this.liveIds.has(id)) return;
    if (live) this.liveIds.add(id);
    else this.liveIds.delete(id);
    this.emit({ type: 'live' });
  }

  isLive(id: number): boolean {
    return this.liveIds.has(id);
  }

  onChange(listener: (change: ChatChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: ChatChange): void {
    for (const listener of this.listeners) listener(change);
  }
}

import type { EventBus } from '../core/EventBus';
import type { FeatureId } from '../data/featureData';
import type { ItemId } from '../data/itemData';
import type { JobId } from '../data/jobData';
import type { QuestDef, QuestRewards } from '../data/questData';
import type { FeatureUnlocks } from '../features/FeatureUnlocks';
import type { GameEvents } from '../game/GameEvents';
import { advanceBy, required, type QuestSignal } from './objectives';

/**
 * locked → available (prerequisites met) → active (started) → completed (every
 * objective done, ready to claim) → claimed (rewards granted, once).
 * locked/available are derived from prerequisites; the rest is stored.
 */
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed' | 'claimed';

/** Stored state of a started quest. */
export interface QuestRecord {
  status: 'active' | 'completed' | 'claimed';
  /** Per objective, capped at its required amount. */
  progress: number[];
}

/** Everything the Quest Engine persists. */
export interface QuestLogState {
  records: Record<string, QuestRecord>;
  /** UI preference only (max MAX_TRACKED_QUESTS); never affects progress. */
  tracked: string[];
  /** Quests already announced as available, so the notification fires once. */
  announced: string[];
}

export const MAX_TRACKED_QUESTS = 3;

/** What the engine reads about the character. */
export interface QuestCharacter {
  level(): number;
  classId(): JobId;
  serverDay(): number;
}

/**
 * How claimed rewards are granted: through the real systems (progression for
 * EXP, wallet, inventory). No Field Energy is involved and there is no
 * skill-point path.
 */
export interface QuestRewardSink {
  grantExp(amount: number): void;
  addCurrency(currency: 'gold' | 'diamond', amount: number): void;
  addItem(itemId: ItemId, count: number): void;
}

/** Grant quest-style rewards through the real systems (quest claims and Weekly milestones). */
export function grantQuestRewards(sink: QuestRewardSink, r: QuestRewards): void {
  if (r.gold) sink.addCurrency('gold', r.gold);
  if (r.diamond) sink.addCurrency('diamond', r.diamond);
  for (const item of r.items ?? []) sink.addItem(item.itemId, item.count);
  if (r.exp) sink.grantExp(r.exp);
}

export type StartQuestResult = { ok: true } | { ok: false; reason: 'unknown_quest' | 'locked' | 'already_started' };
export type ClaimQuestResult = { ok: true; questId: string } | { ok: false; reason: 'unknown_quest' | 'not_completed' | 'already_claimed' };
export type TrackQuestResult = { ok: true } | { ok: false; reason: 'unknown_quest' | 'not_active' | 'tracking_full' };

/**
 * Data-driven quests. Progress comes only from game events (only ACTIVE
 * quests progress; one event can advance several quests). Quests are never
 * auto-started or auto-claimed. Engine-free.
 */
export class QuestSystem {
  private records = new Map<string, QuestRecord>();
  private tracked: string[] = [];
  private announced = new Set<string>();
  private readonly unsubscribe: (() => void)[] = [];
  /**
   * Recurring (Daily / Weekly) quests are only available while their cycle
   * offers them (set by RecurringQuests). Default: never.
   */
  offered: (questId: string) => boolean = () => false;

  constructor(
    readonly defs: Readonly<Record<string, QuestDef>>,
    private readonly character: QuestCharacter,
    readonly features: FeatureUnlocks,
    private readonly rewards: QuestRewardSink,
    private readonly events: EventBus<GameEvents>,
    private readonly playerId = 'player',
  ) {
    const on = <K extends keyof GameEvents>(type: K, fn: (e: GameEvents[K]) => void) => this.unsubscribe.push(this.events.on(type, fn));
    on('npcInteracted', (e) => this.signal({ kind: 'talk', npcId: e.npcId }));
    on('locationReached', (e) => this.signal({ kind: 'visit', locationId: e.locationId }));
    on('monsterKilled', (e) => this.signal({ kind: 'kill', monsterId: e.monsterId, tier: e.tier, zone: e.zone }));
    on('itemAcquired', (e) => this.signal({ kind: 'collect', itemId: e.itemId, amount: e.amount }));
    on('dungeonCleared', (e) => this.signal({ kind: 'dungeon_clear', dungeonId: e.dungeonId, difficulty: e.difficulty, assist: e.assist }));
    on('dailyCommissionClaimed', () => this.signal({ kind: 'daily_commission' }));
    on('equipmentEnhanced', (e) => this.signal({ kind: 'enhance', success: e.success, level: e.to }));
    // Prerequisite inputs that change through events.
    on('levelUp', (e) => e.entityId === this.playerId && this.refresh());
    on('jobChanged', (e) => e.entityId === this.playerId && this.refresh());
    on('featureUnlocked', () => this.refresh());
  }

  destroy(): void {
    for (const off of this.unsubscribe.splice(0)) off();
  }

  // --- Status -------------------------------------------------------------

  status(questId: string): QuestStatus {
    const def = this.defs[questId];
    if (!def) throw new Error(`unknown quest ${questId}`);
    const record = this.records.get(questId);
    if (record) return record.status;
    return this.prerequisitesMet(def) ? 'available' : 'locked';
  }

  /** Objective progress (current / required) for a quest; zeros if not started. */
  progress(questId: string): { current: number; required: number }[] {
    const def = this.defs[questId];
    if (!def) throw new Error(`unknown quest ${questId}`);
    const record = this.records.get(questId);
    return def.objectives.map((o, i) => ({ current: record?.progress[i] ?? 0, required: required(o) }));
  }

  /** Every quest with its status (for UI and dev tools). */
  list(): { questId: string; title: string; type: QuestDef['type']; status: QuestStatus; tracked: boolean }[] {
    return Object.values(this.defs).map((d) => ({ questId: d.id, title: d.title, type: d.type, status: this.status(d.id), tracked: this.tracked.includes(d.id) }));
  }

  isFeatureUnlocked(id: FeatureId): boolean {
    return this.features.isFeatureUnlocked(id);
  }

  prerequisitesMet(def: QuestDef): boolean {
    if (def.repeat && !this.offered(def.id)) return false;
    const p = def.prerequisites;
    if (!p) return true;
    if (p.requiredLevel !== undefined && this.character.level() < p.requiredLevel) return false;
    if (p.requiredServerDay !== undefined && this.character.serverDay() < p.requiredServerDay) return false;
    if (p.requiredClass && !p.requiredClass.includes(this.character.classId())) return false;
    if (p.requiredQuestIds?.some((id) => this.records.get(id)?.status !== 'claimed')) return false;
    if (p.requiredFeatureIds?.some((id) => !this.features.isFeatureUnlocked(id))) return false;
    return true;
  }

  /**
   * Re-evaluate availability (call on level-up, job change, quest claim,
   * feature unlock, server-day change, load). Announces each newly available
   * quest once, ever.
   */
  refresh(): void {
    for (const def of Object.values(this.defs)) {
      if (this.announced.has(def.id) || this.records.has(def.id)) continue;
      if (!this.prerequisitesMet(def)) continue;
      this.announced.add(def.id);
      this.events.emit('questAvailable', { questId: def.id, title: def.title, questType: def.type });
    }
  }

  // --- Actions ------------------------------------------------------------

  start(questId: string): StartQuestResult {
    const def = this.defs[questId];
    if (!def) return { ok: false, reason: 'unknown_quest' };
    if (this.records.has(questId)) return { ok: false, reason: 'already_started' };
    if (!this.prerequisitesMet(def)) return { ok: false, reason: 'locked' };
    this.announced.add(questId);
    this.records.set(questId, { status: 'active', progress: def.objectives.map(() => 0) });
    this.events.emit('questStarted', { questId });
    return { ok: true };
  }

  /** Grant a completed quest's rewards, exactly once. */
  claim(questId: string): ClaimQuestResult {
    const def = this.defs[questId];
    if (!def) return { ok: false, reason: 'unknown_quest' };
    const record = this.records.get(questId);
    if (record?.status === 'claimed') return { ok: false, reason: 'already_claimed' };
    if (record?.status !== 'completed') return { ok: false, reason: 'not_completed' };

    record.status = 'claimed';
    this.tracked = this.tracked.filter((id) => id !== questId);
    const r = def.rewards;
    grantQuestRewards(this.rewards, r);
    for (const feature of [def.featureUnlockId, ...(r.unlockFeatures ?? [])]) {
      if (feature) this.features.unlock(feature);
    }
    this.events.emit('questClaimed', { questId });
    this.refresh(); // chained quests and feature-gated quests may open up
    return { ok: true, questId };
  }

  track(questId: string): TrackQuestResult {
    if (!this.defs[questId]) return { ok: false, reason: 'unknown_quest' };
    const status = this.records.get(questId)?.status;
    if (status !== 'active' && status !== 'completed') return { ok: false, reason: 'not_active' };
    if (this.tracked.includes(questId)) return { ok: true };
    if (this.tracked.length >= MAX_TRACKED_QUESTS) return { ok: false, reason: 'tracking_full' };
    this.tracked.push(questId);
    return { ok: true };
  }

  untrack(questId: string): void {
    this.tracked = this.tracked.filter((id) => id !== questId);
  }

  trackedQuestIds(): string[] {
    return [...this.tracked];
  }

  // --- Progress -----------------------------------------------------------

  /** Apply one gameplay signal to every ACTIVE quest with a matching objective. */
  signal(signal: QuestSignal): void {
    for (const [questId, record] of this.records) {
      if (record.status !== 'active') continue;
      const def = this.defs[questId];
      def.objectives.forEach((objective, i) => {
        const need = required(objective);
        if (record.progress[i] >= need) return;
        const step = advanceBy(objective, signal);
        if (step <= 0) return;
        record.progress[i] = Math.min(need, record.progress[i] + step);
        this.events.emit('questProgress', { questId, objective: i, current: record.progress[i], required: need });
      });
      if (def.objectives.every((o, i) => record.progress[i] >= required(o))) {
        record.status = 'completed';
        this.events.emit('questCompleted', { questId });
      }
    }
  }

  /**
   * Drop a quest's record (recurring cycle reset): progress, completion and
   * claim are gone, it is untracked, and it may be announced again later.
   */
  forget(questId: string): void {
    this.records.delete(questId);
    this.tracked = this.tracked.filter((id) => id !== questId);
    this.announced.delete(questId);
  }

  // --- Persistence --------------------------------------------------------

  toState(): QuestLogState {
    return {
      records: Object.fromEntries([...this.records].map(([id, r]) => [id, { status: r.status, progress: [...r.progress] }])),
      tracked: [...this.tracked],
      announced: [...this.announced],
    };
  }

  /** Replace all quest state (validated save data). Emits nothing; call refresh() afterwards. */
  load(state: QuestLogState): void {
    this.records = new Map(Object.entries(state.records).map(([id, r]) => [id, { status: r.status, progress: [...r.progress] }]));
    this.tracked = [...state.tracked];
    this.announced = new Set(state.announced);
  }

  /** Back to a fresh character's quest log (features are reset by their owner). */
  reset(): void {
    this.load({ records: {}, tracked: [], announced: [] });
  }
}

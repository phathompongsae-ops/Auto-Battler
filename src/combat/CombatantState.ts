import type { SkillId } from '../data/skillData';
import type { StatusDef } from '../data/statusData';
import { MAX_LEVEL } from '../data/progressionData';
import type { CombatStats, Team } from './types';

export interface ActiveStatus {
  def: StatusDef;
  expiresAt: number;
}

/**
 * All combat-relevant state of one participant, with no rendering or engine
 * types. This is the part a server would own in multiplayer.
 */
export class CombatantState {
  level: number;
  exp = 0;
  hp: number;
  mp: number;
  dead = false;

  readonly statuses: ActiveStatus[] = [];
  /** Skill id → time (ms) when it is ready again. */
  readonly cooldowns = new Map<SkillId, number>();

  private readonly effectiveStats: CombatStats;

  /**
   * @param statsFor Full stats at a level with the given active statuses
   *   applied. The owner decides how statuses count (the player through its
   *   stat pipeline, monsters on their data stats).
   * @param maxLevel Highest level this combatant may reach (checked on level-up).
   */
  constructor(
    readonly id: string,
    readonly name: string,
    readonly team: Team,
    private readonly statsFor: (level: number, statuses: readonly ActiveStatus[]) => CombatStats,
    level = 1,
    readonly maxLevel: () => number = () => MAX_LEVEL,
  ) {
    this.level = level;
    this.effectiveStats = statsFor(level, this.statuses);
    this.hp = this.effectiveStats.maxHp;
    this.mp = this.effectiveStats.maxMp;
  }

  /** Current stats including status effects. Cached; refreshed on change. */
  get stats(): Readonly<CombatStats> {
    return this.effectiveStats;
  }

  hasStatus(id: string): boolean {
    return this.statuses.some((s) => s.def.id === id);
  }

  /** Re-derive stats after a level, status or stat-input change. */
  refreshStats(): void {
    Object.assign(this.effectiveStats, this.statsFor(this.level, this.statuses));
    this.hp = Math.min(this.hp, this.effectiveStats.maxHp);
    this.mp = Math.min(this.mp, this.effectiveStats.maxMp);
  }

  restore(): void {
    this.hp = this.effectiveStats.maxHp;
    this.mp = this.effectiveStats.maxMp;
  }

  /** Back to a fresh, living state at the current level. */
  reset(): void {
    this.dead = false;
    this.statuses.length = 0;
    this.cooldowns.clear();
    this.refreshStats();
    this.restore();
  }
}

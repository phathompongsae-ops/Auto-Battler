import type { SkillId } from '../data/skillData';
import type { StatusDef } from '../data/statusData';
import { applyStatusModifiers } from './stats';
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

  private baseStats: CombatStats;
  private readonly effectiveStats: CombatStats;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly team: Team,
    private readonly statsForLevel: (level: number) => CombatStats,
    level = 1,
  ) {
    this.level = level;
    this.baseStats = statsForLevel(level);
    this.effectiveStats = { ...this.baseStats };
    this.hp = this.baseStats.maxHp;
    this.mp = this.baseStats.maxMp;
  }

  /** Current stats including status effects. Cached; refreshed on change. */
  get stats(): Readonly<CombatStats> {
    return this.effectiveStats;
  }

  hasStatus(id: string): boolean {
    return this.statuses.some((s) => s.def.id === id);
  }

  /** Re-derive stats after a level or status change. */
  refreshStats(): void {
    this.baseStats = this.statsForLevel(this.level);
    applyStatusModifiers(
      this.baseStats,
      this.statuses.map((s) => s.def),
      this.effectiveStats,
    );
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

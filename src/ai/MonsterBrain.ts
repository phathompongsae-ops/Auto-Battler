import { reach } from '../combat/SkillSystem';
import type { CombatEntity } from '../combat/types';
import { distance } from '../core/math';
import { SKILLS } from '../data/skillData';
import type { MonsterDef } from '../data/monsterData';
import { StateMachine, type State } from './StateMachine';

export type MonsterAiState = 'idle' | 'chase' | 'attack' | 'return' | 'dead';

/** What the brain needs from a monster body. Implemented by the Monster entity. */
export interface MonsterAgent extends CombatEntity {
  readonly def: MonsterDef;
  spawnX: number;
  spawnY: number;
  moveToward(x: number, y: number): void;
  halt(): void;
  /** Instantly place back at spawn (stuck safety net). */
  snapToSpawn(): void;
  respawn(): void;
}

/** What the brain needs from the world. Implemented by CombatWorld. */
export interface MonsterWorld {
  findAggroTarget(monster: MonsterAgent): CombatEntity | null;
  tryAttack(monster: MonsterAgent, target: CombatEntity, now: number): void;
}

interface BrainContext {
  monster: MonsterAgent;
  world: MonsterWorld;
  target: CombatEntity | null;
  stateSince: number;
}

const HOME_TOLERANCE = 4; // px
const ATTACK_EXIT_SLACK = 8; // px of hysteresis before switching back to chase
const RETURN_TIMEOUT = 8000; // ms before snapping home if stuck on terrain

const spawnOf = (m: MonsterAgent) => ({ x: m.spawnX, y: m.spawnY });
const attackRange = (m: MonsterAgent) => SKILLS[m.def.attackSkill].range;
const targetAlive = (t: CombatEntity | null): t is CombatEntity => !!t && !t.combat.dead;

function leashed(m: MonsterAgent, target: CombatEntity): boolean {
  const home = spawnOf(m);
  return distance(m, home) > m.def.leashRange || distance(target, home) > m.def.leashRange;
}

const idle: State<BrainContext, MonsterAiState> = {
  enter: (ctx) => {
    ctx.target = null;
    ctx.monster.halt();
  },
  update: (ctx) => {
    if (ctx.monster.combat.dead) return 'dead';
    const target = ctx.world.findAggroTarget(ctx.monster);
    if (target) {
      ctx.target = target;
      return 'chase';
    }
  },
};

const chase: State<BrainContext, MonsterAiState> = {
  update: (ctx) => {
    const m = ctx.monster;
    if (m.combat.dead) return 'dead';
    if (!targetAlive(ctx.target) || leashed(m, ctx.target)) return 'return';
    if (reach(m, ctx.target) <= attackRange(m)) return 'attack';
    m.moveToward(ctx.target.x, ctx.target.y);
  },
};

const attack: State<BrainContext, MonsterAiState> = {
  enter: (ctx) => ctx.monster.halt(),
  update: (ctx, now) => {
    const m = ctx.monster;
    if (m.combat.dead) return 'dead';
    if (!targetAlive(ctx.target) || leashed(m, ctx.target)) return 'return';
    if (reach(m, ctx.target) > attackRange(m) + ATTACK_EXIT_SLACK) return 'chase';
    m.halt();
    ctx.world.tryAttack(m, ctx.target, now);
  },
};

const returnHome: State<BrainContext, MonsterAiState> = {
  enter: (ctx) => {
    ctx.target = null;
  },
  update: (ctx, now) => {
    const m = ctx.monster;
    if (m.combat.dead) return 'dead';
    if (distance(m, spawnOf(m)) <= HOME_TOLERANCE || now - ctx.stateSince > RETURN_TIMEOUT) {
      m.snapToSpawn();
      m.combat.restore(); // reset like an MMO mob that lost its target
      return 'idle';
    }
    m.moveToward(m.spawnX, m.spawnY);
  },
};

const dead: State<BrainContext, MonsterAiState> = {
  enter: (ctx) => {
    ctx.target = null;
    ctx.monster.halt();
  },
  update: (ctx, now) => {
    if (now - ctx.stateSince >= ctx.monster.def.respawnDelay) {
      ctx.monster.respawn();
      return 'idle';
    }
  },
};

const STATES: Record<MonsterAiState, State<BrainContext, MonsterAiState>> = {
  idle,
  chase,
  attack,
  return: returnHome,
  dead,
};

/** Idle → chase → attack → return → idle, with death/respawn. Engine-agnostic. */
export class MonsterBrain {
  private readonly ctx: BrainContext;
  private readonly fsm: StateMachine<BrainContext, MonsterAiState>;

  constructor(monster: MonsterAgent, world: MonsterWorld, now: number) {
    this.ctx = { monster, world, target: null, stateSince: now };
    this.fsm = new StateMachine(this.ctx, STATES, 'idle', now);
  }

  get state(): MonsterAiState {
    return this.fsm.current;
  }

  get target(): CombatEntity | null {
    return this.ctx.target;
  }

  update(now: number, dtMs: number): void {
    const before = this.fsm.current;
    this.fsm.update(now, dtMs);
    if (this.fsm.current !== before) this.ctx.stateSince = now;
  }

  /** Being hit makes an idle/chasing monster fight back. Returning monsters ignore it. */
  provoke(attacker: CombatEntity, now: number): void {
    const s = this.fsm.current;
    if (s === 'dead' || s === 'return' || attacker.combat.dead) return;
    this.ctx.target = attacker;
    if (s === 'idle') this.setState('chase', now);
  }

  /** Force a state (deaths reported by the combat system, debug resets). */
  setState(state: MonsterAiState, now: number): void {
    // Set stateSince first so enter() and the next update see the new timestamp.
    this.ctx.stateSince = now;
    const keepTarget = this.ctx.target;
    this.fsm.transition(state, now);
    if (state === 'chase' || state === 'attack') this.ctx.target = keepTarget;
  }
}

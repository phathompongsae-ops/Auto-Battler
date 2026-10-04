import { NAV_DEFAULT_RADIUS, type NavPoint, type NavTarget } from '../data/navigationData';
import type { Direction, MoveIntent } from '../input/Direction';
import type { QuestSystem } from '../quests/QuestSystem';
import type { NavIndex, RouteStep } from './NavIndex';
import { steerToward, type PathPlanner } from './pathing';
import { resolveQuestObjective, type NavResolution } from './questNavigation';

/**
 * inactive: nothing requested. moving: walking a route (may be `paused` while
 * a monster engages the player). waiting_for_transition: at a portal, waiting
 * for the map change. arrived / cancelled / failed: finished, with `reason`.
 */
export type NavStatus = 'inactive' | 'moving' | 'waiting_for_transition' | 'arrived' | 'cancelled' | 'failed';

export type NavCancelReason = 'manual_input' | 'replaced' | 'cancelled' | 'player_died';
export type NavFailReason = 'no_path' | 'stuck' | 'portal_failed';

export interface NavigationState {
  status: NavStatus;
  /** Final destination. */
  targetId: string | null;
  /** Route target ids (portals first) and the index being walked. */
  route: string[];
  step: number;
  /** Moving, but holding still because a monster is engaging the player. */
  paused: boolean;
  reason: NavCancelReason | NavFailReason | null;
}

export type StartNavFailure = 'unknown_target' | 'unreachable' | Extract<NavResolution, { ok: false }>['reason'];

export type StartNavResult = { ok: true; state: NavigationState } | { ok: false; reason: StartNavFailure };

/** What Auto Move needs from the game. CombatWorld implements it; tests fake it. */
export interface NavWorld {
  mapId(): string;
  position(): NavPoint;
  /** A monster is actively engaging the player (Auto Move pauses; no Auto Battle). */
  inCombat(): boolean;
  isDead(): boolean;
  /** The real portal transition; false if it can't be used from here. */
  takePortal(portalId: string): boolean;
  /** The real visit-location report (quests listen to it). */
  reachLocation(locationId: string): void;
}

/** No progress toward the current waypoint for this long (while not paused) = stuck. */
const STUCK_MS = 1500;
/** A portal that doesn't change the map within this long has failed. */
const TRANSITION_TIMEOUT_MS = 3000;

const IDLE: NavigationState = { status: 'inactive', targetId: null, route: [], step: 0, paused: false, reason: null };

/**
 * Auto Move: walks the player along a route to a navigation target by
 * producing the same movement direction manual input would (the player entity
 * and its physics/collision are unchanged). One target at a time; manual
 * input cancels it (CombatWorld does that, in one place). No Auto Battle.
 */
export class AutoMove {
  private current: NavigationState = { ...IDLE };
  private steps: RouteStep[] = [];
  private path: NavPoint[] | null = null;
  private best = Infinity;
  private stuckMs = 0;
  private waitMs = 0;

  constructor(
    readonly nav: NavIndex,
    private readonly planner: PathPlanner,
    private readonly world: NavWorld,
    private readonly onChange: (state: NavigationState) => void = () => {},
    private readonly quests?: QuestSystem,
  ) {}

  state(): NavigationState {
    return { ...this.current, route: [...this.current.route] };
  }

  isActive(): boolean {
    return this.current.status === 'moving' || this.current.status === 'waiting_for_transition';
  }

  /** Start walking to a navigation target, replacing any current navigation. */
  navigateTo(targetId: string): StartNavResult {
    const target = this.nav.target(targetId);
    if (!target) return { ok: false, reason: 'unknown_target' };
    const route = this.nav.route(this.world.mapId(), target);
    if (!route) return { ok: false, reason: 'unreachable' };
    if (this.isActive()) this.finish('cancelled', 'replaced');

    this.steps = route;
    this.resetLeg();
    this.set({ status: 'moving', targetId, route: route.map((s) => s.target.id), step: 0, paused: false, reason: null });
    this.checkArrival(); // already there?
    return { ok: true, state: this.state() };
  }

  /** Go where objective `index` of an ACTIVE quest needs the player. */
  navigateToQuestObjective(questId: string, index: number): StartNavResult {
    if (!this.quests) return { ok: false, reason: 'unknown_quest' };
    const resolved = resolveQuestObjective(this.quests, questId, index, this.nav, this.world.mapId());
    if (!resolved.ok) return { ok: false, reason: resolved.reason };
    return this.navigateTo(resolved.target.id);
  }

  cancel(reason: NavCancelReason = 'cancelled'): void {
    if (this.isActive()) this.finish('cancelled', reason);
  }

  /** Forget everything (load / reset): back to inactive, no event. */
  clear(): void {
    this.steps = [];
    this.resetLeg();
    this.current = { ...IDLE };
  }

  /**
   * The single rule joining manual control and Auto Move, called once per
   * frame with the player's input direction: any manual direction cancels
   * Auto Move immediately (it never restarts by itself) and is used as-is;
   * without one, Auto Move steers.
   */
  drive(manual: MoveIntent | null, dtMs: number, speed: number): MoveIntent | null {
    if (manual) {
      this.cancel('manual_input');
      return manual;
    }
    return this.update(dtMs, speed);
  }

  /**
   * One simulation step. Returns the direction to move this frame, or null
   * to stand still. `speed` (px/s) sizes the arrival tolerance so the player
   * never oscillates around a point.
   */
  update(dtMs: number, speed: number): Direction | null {
    if (!this.isActive()) return null;
    if (this.world.isDead()) {
      this.finish('cancelled', 'player_died');
      return null;
    }

    if (this.current.status === 'waiting_for_transition') {
      if (this.transitioned()) return null;
      this.waitMs += dtMs;
      if (this.waitMs > TRANSITION_TIMEOUT_MS) this.finish('failed', 'portal_failed');
      return null;
    }

    const combat = this.world.inCombat();
    if (combat !== this.current.paused) this.set({ ...this.current, paused: combat });
    if (combat) {
      this.stuckMs = 0;
      return null;
    }

    if (this.checkArrival()) return null;
    const pos = this.world.position();
    const step = this.steps[this.current.step];
    if (!this.path) {
      this.path = this.planner.plan(step.target.mapId, pos, step.target, step.target.waypoints);
      if (!this.path) {
        this.finish('failed', 'no_path');
        return null;
      }
    }

    const tolerance = Math.max(4, (speed * dtMs) / 1000 + 1);
    while (this.path.length && !steerToward(pos, this.path[0], tolerance)) {
      this.path.shift();
      this.best = Infinity;
    }
    if (!this.path.length) {
      this.reachStep();
      return null;
    }

    const goal = this.path[0];
    const d = Math.hypot(goal.x - pos.x, goal.y - pos.y);
    if (d < this.best - 1) {
      this.best = d;
      this.stuckMs = 0;
    } else if ((this.stuckMs += dtMs) > STUCK_MS) {
      this.finish('failed', 'stuck');
      return null;
    }
    return steerToward(pos, goal, tolerance);
  }

  // ------------------------------------------------------------------------

  /** Inside the current step's radius → handle it. Returns true if the step was reached. */
  private checkArrival(): boolean {
    const target = this.steps[this.current.step]?.target;
    if (!target) return false;
    const pos = this.world.position();
    if (Math.hypot(target.x - pos.x, target.y - pos.y) > (target.radius ?? NAV_DEFAULT_RADIUS)) return false;
    this.reachStep();
    return true;
  }

  private reachStep(): void {
    const step = this.steps[this.current.step];
    if (step.usePortal && step.target.portalId) {
      this.set({ ...this.current, status: 'waiting_for_transition', paused: false });
      this.waitMs = 0;
      if (!this.world.takePortal(step.target.portalId)) {
        this.finish('failed', 'portal_failed');
        return;
      }
      this.transitioned();
      return;
    }
    this.arrive(step.target);
  }

  /** After a portal: once on the expected map, continue (or finish if the portal was the destination). */
  private transitioned(): boolean {
    const step = this.steps[this.current.step];
    if (this.world.mapId() !== step.toMapId) return false;
    if (this.current.step === this.steps.length - 1) {
      this.finish('arrived', null);
      return true;
    }
    this.resetLeg();
    this.set({ ...this.current, status: 'moving', step: this.current.step + 1 });
    this.checkArrival();
    return true;
  }

  /**
   * Destination reached. A location reports itself through the real
   * reachLocation path; NPCs, hunting zones and dungeon entrances only stop
   * (no dialogue, no attacking, no automatic dungeon entry).
   */
  private arrive(target: NavTarget): void {
    this.finish('arrived', null);
    if (target.type === 'location' && target.locationId) this.world.reachLocation(target.locationId);
  }

  private finish(status: 'arrived' | 'cancelled' | 'failed', reason: NavigationState['reason']): void {
    this.steps = [];
    this.resetLeg();
    this.set({ ...this.current, status, paused: false, reason });
  }

  private resetLeg(): void {
    this.path = null;
    this.best = Infinity;
    this.stuckMs = 0;
    this.waitMs = 0;
  }

  private set(state: NavigationState): void {
    this.current = state;
    this.onChange(this.state());
  }
}

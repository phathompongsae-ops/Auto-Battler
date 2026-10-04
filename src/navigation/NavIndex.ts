import type { NavigationData, NavPoint, NavTarget } from '../data/navigationData';
import { PORTALS, type Location, type PortalDef } from '../data/warpData';
import { locationKind, usePortal } from '../warp/warp';

/** One leg of a route: walk to a target on the current map (a portal leg then crosses to the next map). */
export interface RouteStep {
  target: NavTarget;
  usePortal: boolean;
  /** Map a portal step leads to. */
  toMapId?: string;
}

/**
 * Lookups over navigation data plus a map graph made of portals: an edge
 * exists for every portal target whose warp portal (PORTALS) starts on its map.
 */
export class NavIndex {
  constructor(
    readonly data: NavigationData,
    readonly portals: Readonly<Record<string, PortalDef>> = PORTALS,
  ) {}

  target(id: string): NavTarget | undefined {
    return this.data.targets[id];
  }

  all(): NavTarget[] {
    return Object.values(this.data.targets);
  }

  /**
   * Best match: a target dedicated to `questId` first, then general targets,
   * then ones dedicated to other quests; ties go to the current map, then data order.
   */
  find(predicate: (t: NavTarget) => boolean, preferMapId?: string, questId?: string): NavTarget | undefined {
    const score = (t: NavTarget) =>
      (questId && t.questIds?.includes(questId) ? 4 : t.questIds?.length ? 0 : 2) + (t.mapId === preferMapId ? 1 : 0);
    let best: NavTarget | undefined;
    for (const t of this.all()) if (predicate(t) && (!best || score(t) > score(best))) best = t;
    return best;
  }

  /** Portal targets usable from `mapId`, with the map each leads to. */
  exits(mapId: string): { target: NavTarget; toMapId: string }[] {
    const out: { target: NavTarget; toMapId: string }[] = [];
    for (const t of this.all()) {
      if (t.type !== 'portal' || t.mapId !== mapId || !t.portalId || !t.arrival) continue;
      const portal = this.portals[t.portalId];
      if (portal && portal.from === mapId) out.push({ target: t, toMapId: portal.to });
    }
    return out;
  }

  /**
   * Route from `fromMapId` to `target`: portal legs (fewest maps, BFS) then
   * the target itself. null when no chain of portals reaches its map.
   */
  route(fromMapId: string, target: NavTarget): RouteStep[] | null {
    const prev = new Map<string, { mapId: string; portal: NavTarget; toMapId: string } | null>([[fromMapId, null]]);
    const queue = [fromMapId];
    while (queue.length && !prev.has(target.mapId)) {
      const mapId = queue.shift()!;
      for (const exit of this.exits(mapId)) {
        if (prev.has(exit.toMapId)) continue;
        prev.set(exit.toMapId, { mapId, portal: exit.target, toMapId: exit.toMapId });
        queue.push(exit.toMapId);
      }
    }
    if (!prev.has(target.mapId)) return null;
    const final = target.type === 'portal' ? this.exits(target.mapId).find((e) => e.target.id === target.id) : undefined;
    const steps: RouteStep[] = [{ target, usePortal: !!final, toMapId: final?.toMapId }];
    for (let at = prev.get(target.mapId); at; at = prev.get(at.mapId)) steps.unshift({ target: at.portal, usePortal: true, toMapId: at.toMapId });
    return steps;
  }
}

/**
 * The portal transition rule shared by the game and tests: the warp portal
 * must start on the current map (warp.usePortal) and the navigation data must
 * know where its far side puts the player.
 */
export function portalTransition(
  nav: NavIndex,
  from: Location,
  portalId: string,
): { ok: true; location: Location; arrival: NavPoint } | { ok: false } {
  const result = usePortal(from, portalId, nav.portals);
  if (!result.ok) return { ok: false };
  const exit = nav.exits(from.mapId).find((e) => e.target.portalId === portalId);
  if (!exit?.target.arrival) return { ok: false };
  return { ok: true, location: { kind: locationKind(result.toMapId), mapId: result.toMapId }, arrival: exit.target.arrival };
}

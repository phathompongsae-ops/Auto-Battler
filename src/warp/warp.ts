import { DUNGEON_WARPS, PORTALS, TOWNS, type Location } from '../data/warpData';
import type { Inventory } from '../loot/Inventory';

/** Towns unlocked and dungeons discovered by the character (persisted). */
export interface WarpUnlocks {
  towns: Set<string>;
  dungeons: Set<string>;
  /** Town Warp destination; must be unlocked. Falls back to the default town. */
  homeTown: string | null;
}

export function defaultUnlocks(): WarpUnlocks {
  return { towns: new Set(Object.values(TOWNS).filter((t) => t.isDefault).map((t) => t.id)), dungeons: new Set(), homeTown: null };
}

export interface WarpContext {
  location: Location;
  inCombat: boolean;
  inventory: Inventory;
  unlocks: WarpUnlocks;
}

export type WarpResult =
  | { ok: true; destination: Location; leftDungeon: boolean }
  | { ok: false; reason: 'in_combat' | 'no_scroll' | 'no_town' | 'dungeon_locked' | 'unknown_dungeon' };

function townDestination(unlocks: WarpUnlocks): string | null {
  if (unlocks.homeTown && unlocks.towns.has(unlocks.homeTown)) return unlocks.homeTown;
  return Object.values(TOWNS).find((t) => t.isDefault && unlocks.towns.has(t.id))?.id ?? null;
}

/**
 * Town Warp Scroll: to the home / default town, from a field or from inside a
 * dungeon (which exits it). Not in combat. Consumes one scroll only on
 * success. Never touches dungeon Energy.
 */
export function useTownWarp(ctx: WarpContext): WarpResult {
  if (ctx.inCombat) return { ok: false, reason: 'in_combat' };
  if (ctx.inventory.count('town_warp_scroll') < 1) return { ok: false, reason: 'no_scroll' };
  const town = townDestination(ctx.unlocks);
  if (!town) return { ok: false, reason: 'no_town' };
  ctx.inventory.remove('town_warp_scroll');
  return { ok: true, destination: { kind: 'town', mapId: town }, leftDungeon: ctx.location.kind === 'dungeon' };
}

/**
 * Dungeon Warp Scroll: to the ENTRANCE of a discovered dungeon (never the boss
 * room). Not in combat. Consumes one scroll only on success. No Energy.
 */
export function useDungeonWarp(ctx: WarpContext, dungeonId: string): WarpResult {
  if (ctx.inCombat) return { ok: false, reason: 'in_combat' };
  const dungeon = DUNGEON_WARPS[dungeonId];
  if (!dungeon) return { ok: false, reason: 'unknown_dungeon' };
  if (!ctx.unlocks.dungeons.has(dungeonId)) return { ok: false, reason: 'dungeon_locked' };
  if (ctx.inventory.count('dungeon_warp_scroll') < 1) return { ok: false, reason: 'no_scroll' };
  ctx.inventory.remove('dungeon_warp_scroll');
  return { ok: true, destination: { kind: 'dungeon', mapId: dungeon.entranceMapId }, leftDungeon: ctx.location.kind === 'dungeon' };
}

/** Take a normal portal from the current map. Free; separate from scrolls. */
export function usePortal(location: Location, portalId: string): { ok: true; toMapId: string } | { ok: false; reason: 'unknown_portal' | 'not_here' } {
  const portal = PORTALS[portalId];
  if (!portal) return { ok: false, reason: 'unknown_portal' };
  if (portal.from !== location.mapId) return { ok: false, reason: 'not_here' };
  return { ok: true, toMapId: portal.to };
}

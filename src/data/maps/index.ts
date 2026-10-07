import type { NavTarget } from '../navigationData';
import { CRYPT_MAP, CRYPT_MAP_ID } from './cryptMap';
import { FIELD_MAP, FIELD_MAP_ID } from './fieldMap';
import { TOWN_MAP, TOWN_MAP_ID } from './townMap';
import type { MapDef, MapPortalDef } from './types';

export { CRYPT_MAP_ID, FIELD_MAP_ID, TOWN_MAP_ID };
export type { CheckpointDef, EncounterAreaDef, EncounterProfileId, MapDef, MapPortalDef, MapType, MonsterSpawnZone, ProgressionGateDef, TileRect } from './types';
export { tileCenter } from './types';
export { PROP_KINDS, type PropKind, type PropPlacement } from './props';

/** Every playable map, by id. */
export const MAPS: Readonly<Record<string, MapDef>> = {
  [TOWN_MAP_ID]: TOWN_MAP,
  [FIELD_MAP_ID]: FIELD_MAP,
  [CRYPT_MAP_ID]: CRYPT_MAP,
};

/** Where a new character starts, and the fallback for an unknown saved map. */
export const DEFAULT_MAP_ID = TOWN_MAP_ID;

export function isMapId(id: unknown): id is string {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(MAPS, id);
}

export function mapDef(id: string): MapDef | undefined {
  return isMapId(id) ? MAPS[id] : undefined;
}

/** Map width / height in tiles. */
export function mapSize(map: MapDef): { width: number; height: number } {
  return { width: map.tiles[0]?.length ?? 0, height: map.tiles.length };
}

/** Navigation target id of a portal (derived from the map's portal list). */
export const portalNavId = (portalId: string) => `nav_portal_${portalId}`;

/** A portal's trigger centre in world px. */
export function portalCenter(portal: MapPortalDef, tileSize = 32) {
  return { x: (portal.area.x + portal.area.w / 2) * tileSize, y: (portal.area.y + portal.area.h / 2) * tileSize };
}

/** Every map portal with its source map. */
export function allPortals(): (MapPortalDef & { from: string })[] {
  return Object.values(MAPS).flatMap((m) => m.portals.map((p) => ({ ...p, from: m.id })));
}

/** Navigation targets of every map, including one 'portal' target per map portal. */
export function mapNavigationTargets(): NavTarget[] {
  const out: NavTarget[] = [];
  for (const map of Object.values(MAPS)) {
    out.push(...map.navigationTargets);
    for (const p of map.portals) {
      out.push({
        id: portalNavId(p.id),
        type: 'portal',
        mapId: map.id,
        ...portalCenter(p),
        radius: 20,
        portalId: p.id,
        arrival: { ...p.arrival },
        ...(p.waypoints ? { waypoints: p.waypoints } : {}),
        meta: { label: p.label },
      });
    }
  }
  return out;
}

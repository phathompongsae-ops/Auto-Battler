import type { EncounterProfileId, MapDef, ProgressionGateDef } from '../data/maps';
import { inTileRect } from '../world/encounters';

/*
 * Encounter progression gates (engine-free). A gate shuts a doorway until
 * the encounters before it are down, so a dungeon's required encounters
 * cannot be skipped by running through their rooms. Inside a room the player
 * moves freely; only the doorway onward is shut. Data: MapDef.progressionGates.
 */

/** The gates in force under a profile (gates without `profiles` apply to every profile). */
export function activeGates(map: MapDef, profile: EncounterProfileId): ProgressionGateDef[] {
  return (map.progressionGates ?? []).filter((g) => !g.profiles || g.profiles.includes(profile));
}

export function gateOpen(gate: ProgressionGateDef, zoneCleared: (zoneId: string) => boolean): boolean {
  return gate.requiresCleared.every((z) => zoneCleared(z));
}

/** The closed gate whose doorway contains (x, y), if any. */
export function closedGateAt(gates: readonly ProgressionGateDef[], x: number, y: number, zoneCleared: (zoneId: string) => boolean): ProgressionGateDef | null {
  return gates.find((g) => inTileRect(g.area, x, y) && !gateOpen(g, zoneCleared)) ?? null;
}

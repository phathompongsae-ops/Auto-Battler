import type { Rng } from '../core/rng';
import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import { rollEnchants } from './enchant';
import type { EquipmentInstance } from './equipment';

/** Unique instance ids. Injected so tests (and a future server) control them. */
export type IdSource = () => string;

export const randomIdSource: IdSource = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Deterministic ids: prefix-1, prefix-2, ... */
export function sequentialIds(prefix: string, start = 1): IdSource {
  let n = start;
  return () => `${prefix}-${n++}`;
}

/** A new +0 item with freshly rolled enchant lines. */
export function createEquipment(defId: string, rng: Rng, newId: IdSource = randomIdSource): EquipmentInstance {
  const def = EQUIPMENT_DEFS[defId];
  if (!def) throw new Error(`unknown equipment def ${defId}`);
  return { instanceId: newId(), defId, enhancement: 0, enchants: rollEnchants(def, rng), bound: false };
}

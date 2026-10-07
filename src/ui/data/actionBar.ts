import type { Action } from '../../input/Action';
import type { SlotSize } from '../components/Slot';

/*
 * Bottom-right action cluster. Positions are centres in cluster pixels
 * (scaled with --ui-scale); the attack button sits in the thumb corner and
 * the skills arc around it.
 */

export type ActionBinding =
  /** Fires an input Action; its skill comes from the player's loadout. */
  | { kind: 'action'; action: Action }
  /** Reserved for a mechanic that doesn't exist yet; drawn disabled. */
  | { kind: 'reserved'; label: string; abbr: string; color: string };

export interface ActionSlotDef {
  id: string;
  /** Primary combat ring vs the quieter outer utility positions. */
  group: 'combat' | 'utility';
  binding: ActionBinding;
  size: SlotSize;
  /** Keyboard hint drawn in the corner. */
  keyHint?: string;
  x: number;
  y: number;
  /**
   * Position on compact landscape screens, where minimum touch sizes no longer
   * shrink with the layout; null hides an inert reserved socket there.
   * Omitted: same as x / y.
   */
  compact?: { x: number; y: number } | null;
}

/** Cluster box size in unscaled pixels. */
export const ACTION_CLUSTER = { width: 262, height: 256 };

const CX = 196;
const CY = 198;
const RING = 116;
/** Smaller utility sockets ride an outer arc hugging the skill ring (never a column into the play area). */
const OUTER = 176;

const polar = (radius: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.round(CX + radius * Math.cos(a)), y: Math.round(CY + radius * Math.sin(a)) };
};
/** Four primary skills curve around the thumb's largest target, ATK. */
const ring = (i: number) => polar(RING, 180 + i * 35);
/** Outer utility arc, from the lower-left (closest to the thumb) up over the ring. */
const outer = (i: number) => polar(OUTER, 188 + i * 19);

export const ACTION_SLOTS: readonly ActionSlotDef[] = [
  { id: 'attack', group: 'combat', binding: { kind: 'action', action: 'attack' }, size: 'lg', keyHint: 'Space', x: CX, y: CY },
  { id: 'skill1', group: 'combat', binding: { kind: 'action', action: 'skill1' }, size: 'md', keyHint: 'Q', ...ring(0) },
  { id: 'skill2', group: 'combat', binding: { kind: 'action', action: 'skill2' }, size: 'md', keyHint: 'E', ...ring(1) },
  { id: 'skill3', group: 'combat', binding: { kind: 'action', action: 'skill3' }, size: 'md', keyHint: 'R', ...ring(2) },
  { id: 'skill4', group: 'combat', binding: { kind: 'action', action: 'skill4' }, size: 'md', keyHint: 'F', ...ring(3) },
  { id: 'dodge', group: 'utility', binding: { kind: 'action', action: 'dodge' }, keyHint: 'Shift', size: 'sm', compact: { x: 23, y: 80 }, ...outer(0) },
  { id: 'potion', group: 'utility', binding: { kind: 'action', action: 'hp_potion' }, keyHint: '1', size: 'sm', compact: { x: 23, y: 136 }, ...outer(1) },
  // Keep the fifth existing binding available outside the primary four-skill ring.
  { id: 'skill5', group: 'utility', binding: { kind: 'action', action: 'skill5' }, size: 'sm', keyHint: 'G', ...outer(2), compact: { x: 23, y: 24 } },
  { id: 'special', group: 'utility', binding: { kind: 'reserved', label: 'Special (coming soon)', abbr: 'SP', color: '#b781ff' }, size: 'sm', compact: null, ...outer(3) },
  { id: 'mp_potion', group: 'utility', binding: { kind: 'action', action: 'mp_potion' }, keyHint: '2', size: 'sm', compact: { x: -30, y: 136 }, ...outer(4) },
  { id: 'pet', group: 'utility', binding: { kind: 'reserved', label: 'Pet / Summon (coming soon)', abbr: 'P', color: '#a4ba89' }, size: 'sm', ...outer(5), compact: null },
];

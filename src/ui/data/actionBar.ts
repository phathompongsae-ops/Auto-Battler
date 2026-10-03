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
  binding: ActionBinding;
  size: SlotSize;
  /** Keyboard hint drawn in the corner. */
  keyHint?: string;
  x: number;
  y: number;
}

/** Cluster box size in unscaled pixels. */
export const ACTION_CLUSTER = { width: 272, height: 216 };

const CX = 205;
const CY = 158;
const RING = 118;

/** Five skill positions on an arc from left (180°) to straight up (270°). */
const ring = (i: number) => {
  const a = ((180 + i * 22.5) * Math.PI) / 180;
  return { x: Math.round(CX + RING * Math.cos(a)), y: Math.round(CY + RING * Math.sin(a)) };
};

export const ACTION_SLOTS: readonly ActionSlotDef[] = [
  { id: 'attack', binding: { kind: 'action', action: 'attack' }, size: 'lg', keyHint: 'Space', x: CX, y: CY },
  { id: 'skill1', binding: { kind: 'action', action: 'skill1' }, size: 'md', keyHint: 'Q', ...ring(0) },
  { id: 'skill2', binding: { kind: 'action', action: 'skill2' }, size: 'md', keyHint: 'E', ...ring(1) },
  { id: 'skill3', binding: { kind: 'action', action: 'skill3' }, size: 'md', keyHint: 'R', ...ring(2) },
  { id: 'skill4', binding: { kind: 'reserved', label: 'Empty skill slot', abbr: '', color: '' }, size: 'md', ...ring(3) },
  { id: 'skill5', binding: { kind: 'reserved', label: 'Empty skill slot', abbr: '', color: '' }, size: 'md', ...ring(4) },
  { id: 'special', binding: { kind: 'reserved', label: 'Special (coming soon)', abbr: 'SP', color: '#b781ff' }, size: 'sm', x: 40, y: 104 },
  { id: 'potion', binding: { kind: 'reserved', label: 'Potion (coming soon)', abbr: 'HP', color: '#e0524a' }, size: 'sm', x: 36, y: 158 },
  { id: 'dodge', binding: { kind: 'reserved', label: 'Dodge (coming soon)', abbr: 'DG', color: '#7fd4ff' }, size: 'sm', x: 250, y: 46 },
];

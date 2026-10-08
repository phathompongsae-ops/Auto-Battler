import type { Action } from '../../input/Action';
import type { SlotSize } from '../components/Slot';

/*
 * Bottom-right combat cluster, one system around the thumb (Visual Production
 * Pass 1). Positions are centres in cluster pixels, scaled with --ui-scale:
 *
 *   ATK        the largest target, inset from the corner so the skill arc can
 *              wrap over its top;
 *   Skill 1–5  one arc from ATK's left, over its top, to its upper right
 *              (slightly flattened so it stays under the quest tracker on
 *              640×360);
 *   Dodge      beside ATK on the right edge, a short flick from the thumb;
 *   HP / MP    the quietest sockets, on an outer arc beyond Skill 1–2.
 *
 * Spacing is chosen for the compact minimum sizes (skills 44 px, utilities
 * 40 px at --ui-scale 0.8), so one geometry serves every supported viewport
 * (640×360 and up) without separate compact positions.
 */

export type ActionBinding =
  /** Fires an input Action; its skill comes from the player's loadout. */
  { kind: 'action'; action: Action };

/** Visual hierarchy: primary > skill > dodge > potion. */
export type ActionTier = 'primary' | 'skill' | 'dodge' | 'potion';

export interface ActionSlotDef {
  id: string;
  /** Combat actions (ATK, Skill 1–5) vs the quieter utility actions (Dodge, potions). */
  group: 'combat' | 'utility';
  tier: ActionTier;
  binding: ActionBinding;
  size: SlotSize;
  /** Keyboard hint drawn in the corner. */
  keyHint?: string;
  x: number;
  y: number;
}

/** Cluster box size in unscaled pixels. */
export const ACTION_CLUSTER = { width: 326, height: 216 };

/** ATK centre: 120 px from the right edge, 54 px from the bottom (room for its key tag). */
const CX = 206;
const CY = 162;
const at = (dx: number, dy: number) => ({ x: CX + dx, y: CY + dy });

export const ACTION_SLOTS: readonly ActionSlotDef[] = [
  { id: 'attack', group: 'combat', tier: 'primary', binding: { kind: 'action', action: 'attack' }, size: 'lg', keyHint: 'Space', ...at(0, 0) },
  // Even ~8 px gaps (44 px compact sockets) from 9 o'clock round to ATK's upper right.
  { id: 'skill1', group: 'combat', tier: 'skill', binding: { kind: 'action', action: 'skill1' }, size: 'md', keyHint: 'Q', ...at(-124, 8) },
  { id: 'skill2', group: 'combat', tier: 'skill', binding: { kind: 'action', action: 'skill2' }, size: 'md', keyHint: 'E', ...at(-110, -58) },
  { id: 'skill3', group: 'combat', tier: 'skill', binding: { kind: 'action', action: 'skill3' }, size: 'md', keyHint: 'R', ...at(-58, -102) },
  { id: 'skill4', group: 'combat', tier: 'skill', binding: { kind: 'action', action: 'skill4' }, size: 'md', keyHint: 'F', ...at(10, -110) },
  { id: 'skill5', group: 'combat', tier: 'skill', binding: { kind: 'action', action: 'skill5' }, size: 'md', keyHint: 'G', ...at(76, -84) },
  { id: 'dodge', group: 'utility', tier: 'dodge', binding: { kind: 'action', action: 'dodge' }, size: 'sm', keyHint: 'Shift', ...at(94, 6) },
  // Outer arc (radius 190 at 200° / 225°), clear of the quest tracker and the system strip.
  { id: 'potion', group: 'utility', tier: 'potion', binding: { kind: 'action', action: 'hp_potion' }, size: 'sm', keyHint: '1', ...at(-179, -65) },
  { id: 'mp_potion', group: 'utility', tier: 'potion', binding: { kind: 'action', action: 'mp_potion' }, size: 'sm', keyHint: '2', ...at(-134, -134) },
];

import type { StatKey } from '../combat/types';

export interface StatModifier {
  add?: number;
  mul?: number;
}

export interface StatusDef {
  id: string;
  name: string;
  modifiers: Partial<Record<StatKey, StatModifier>>;
  /** Tint used by the status indicator. */
  color: number;
}

const STATUS_DEFS = {
  guard: {
    id: 'guard',
    name: 'Guard',
    modifiers: { defense: { mul: 2, add: 6 } },
    color: 0x7fd4ff,
  },
} satisfies Record<string, StatusDef>;

export type StatusId = keyof typeof STATUS_DEFS;
export const STATUSES: Record<StatusId, StatusDef> = STATUS_DEFS;

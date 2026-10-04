import type { StatModifier } from '../stats/modifiers';
import { WARRIOR_STATUS_DEFS } from './skillTrees/warriorTree';

/**
 * Timed buffs and debuffs. Their stat effect is an ordinary modifier from the
 * 'buff' / 'debuff' source: while active it is added to the stat pipeline,
 * and it disappears on expiry because stats are re-derived from the active
 * statuses (never written into stored stats).
 */
export interface StatusDef {
  id: string;
  name: string;
  kind: 'buff' | 'debuff';
  /** Stat effect: primary / flat / percent / combat-effect parts of a StatModifier. */
  modifier: Pick<StatModifier, 'primary' | 'flat' | 'percent' | 'effects'>;
  /** Crowd control: the holder can't move or act while it lasts. */
  stun?: boolean;
  /** Taunted: the holder keeps attacking whoever taunted it and won't give up the chase. */
  taunt?: boolean;
  /** Tint used by the status indicator. */
  color: number;
}

const STATUS_DEFS = {
  guard: {
    id: 'guard',
    name: 'Guard',
    kind: 'buff',
    // Same effect as before the migration: DEF × 2 + 6 (flat applies before percent).
    modifier: { flat: { def: 3 }, percent: { def: 1 } },
    color: 0x7fd4ff,
  },
  stunned: { id: 'stunned', name: 'Stunned', kind: 'debuff', modifier: {}, stun: true, color: 0xffe066 },
  taunted: { id: 'taunted', name: 'Taunted', kind: 'debuff', modifier: {}, taunt: true, color: 0xff6b6b },
  ...WARRIOR_STATUS_DEFS,
} satisfies Record<string, StatusDef>;

export type StatusId = keyof typeof STATUS_DEFS;
export const STATUSES: Record<StatusId, StatusDef> = STATUS_DEFS;

import type { StatModifier } from '../stats/modifiers';
import { effectKey } from '../stats/modifiers';

/*
 * Armor sets. Only head / armor / gloves / boots count. Thresholds 2 and 4.
 * A set bonus is a modifier (flat / percent / effects) plus, where the
 * mechanic doesn't exist yet, a special-effect id for later systems.
 */

export const SET_PIECE_SLOTS = ['head', 'armor', 'gloves', 'boots'] as const;

export type SetThreshold = 2 | 4;

export interface SetBonusDef {
  /** Applied while active. */
  modifier?: Pick<StatModifier, 'primary' | 'flat' | 'percent' | 'effects'>;
  /**
   * Special mechanic handled outside the stat pipeline. `params` values that
   * are null are NOT tuned yet: the hook exists, the effect is inert.
   */
  special?: { effectId: string; params: Readonly<Record<string, number | null>> };
}

export interface SetDef {
  id: string;
  name: string;
  equipmentLevel: number;
  direction: string;
  bonuses: Record<SetThreshold, SetBonusDef>;
}

const SET_DEFS = {
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    equipmentLevel: 40,
    direction: 'Tank / defense',
    bonuses: {
      // Locked: Max HP +8%, DEF +8%.
      2: { modifier: { percent: { maxHp: 0.08, def: 0.08 } } },
      // Intended: improves Guard / defensive play / Provoke. Mechanics not built: hook only.
      4: { special: { effectId: 'guardian_bulwark', params: { guardBonus: null, provokeBonus: null } } },
    },
  },
  warborn: {
    id: 'warborn',
    name: 'Warborn',
    equipmentLevel: 40,
    direction: 'Heavy physical DPS',
    bonuses: {
      // Locked: Physical ATK +8%.
      2: { modifier: { percent: { physicalAtk: 0.08 } } },
      // Power Slash (power_strike) damage +15% (demo direction, active). Cooldown benefit: unset hook.
      4: {
        modifier: { effects: { [effectKey.skillDamage('power_strike')]: 0.15 } },
        special: { effectId: 'warborn_power_slash_cooldown', params: { cooldownReduction: null } },
      },
    },
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    equipmentLevel: 40,
    direction: 'ASPD / crit / continuous attacks',
    bonuses: {
      // Locked: ASPD +6%, Crit Rate +5%.
      2: { modifier: { flat: { aspd: 0.06, critRate: 0.05 } } },
      // Intended: continuous hits build a temporary damage bonus. Stack values not locked: hook only.
      4: { special: { effectId: 'berserker_momentum', params: { maxStacks: null, durationMs: null, damagePerStack: null } } },
    },
  },
} satisfies Record<string, SetDef>;

export type SetId = keyof typeof SET_DEFS;
export const SETS: Record<SetId, SetDef> = SET_DEFS;

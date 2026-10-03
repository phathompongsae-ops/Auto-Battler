/*
 * Monster Balance v1 — LOCKED reference anchors. These are Balance v1 /
 * reference data, not final values: Dungeon Boss HP is meant to be tuned
 * later as reference party DPS × ~300–420 s.
 *
 * Monster and dungeon levels are fixed; nothing here scales to the player.
 */

export const MONSTER_TIERS = ['normal', 'elite', 'mini_boss', 'dungeon_boss'] as const;
export type MonsterTier = (typeof MONSTER_TIERS)[number];

export interface MonsterBalanceValues {
  hp: number;
  atk: number;
  def: number;
  mdef: number;
  /** Not set for dungeon bosses (their rewards come from the dungeon reward model). */
  exp?: number;
  gold?: number;
}

export const MONSTER_BALANCE: Record<MonsterTier, Record<number, MonsterBalanceValues>> = {
  normal: {
    11: { hp: 600, atk: 45, def: 12, mdef: 10, exp: 35, gold: 15 },
    20: { hp: 1200, atk: 85, def: 30, mdef: 25, exp: 80, gold: 30 },
    30: { hp: 2200, atk: 145, def: 55, mdef: 50, exp: 150, gold: 55 },
    40: { hp: 3600, atk: 220, def: 85, mdef: 80, exp: 260, gold: 90 },
  },
  elite: {
    11: { hp: 3500, atk: 60, def: 18, mdef: 15, exp: 160, gold: 60 },
    20: { hp: 7000, atk: 110, def: 42, mdef: 36, exp: 340, gold: 120 },
    30: { hp: 12500, atk: 190, def: 75, mdef: 65, exp: 650, gold: 220 },
    40: { hp: 21000, atk: 290, def: 115, mdef: 105, exp: 1100, gold: 360 },
  },
  mini_boss: {
    11: { hp: 15000, atk: 80, def: 25, mdef: 20, exp: 550, gold: 220 },
    20: { hp: 30000, atk: 145, def: 55, mdef: 45, exp: 1100, gold: 450 },
    30: { hp: 55000, atk: 240, def: 95, mdef: 85, exp: 2100, gold: 800 },
    40: { hp: 95000, atk: 360, def: 145, mdef: 135, exp: 3600, gold: 1300 },
  },
  dungeon_boss: {
    11: { hp: 180000, atk: 100, def: 35, mdef: 30 },
    20: { hp: 320000, atk: 180, def: 70, mdef: 65 },
    30: { hp: 500000, atk: 300, def: 120, mdef: 110 },
    40: { hp: 700000, atk: 450, def: 175, mdef: 165 },
  },
};

import type { JobId } from './jobData';

/*
 * Class Base Growth v1: a class's combat values BEFORE primary stats, job
 * bonus, allocated points, equipment, pet and buffs. Locked anchor values per
 * level; levels between anchors are interpolated (see classBaseStats.ts).
 */

export interface ClassBaseValues {
  hp: number;
  mp: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
}

export interface ClassGrowthDef {
  /** Level → locked values. Must include the class's first level. */
  anchors: Record<number, ClassBaseValues>;
  /**
   * Past the last anchor: 'hold' keeps its values (Novice: fixed until
   * Novice growth is designed); 'error' refuses (Class 1 ends at Lv40 and
   * must not be extrapolated).
   */
  afterLastAnchor: 'hold' | 'error';
}

export const CLASS_GROWTH: Record<JobId, ClassGrowthDef> = {
  // Lv1–10: fixed at the Lv1 base; Novice progression comes from allocated stats.
  novice: {
    anchors: { 1: { hp: 300, mp: 100, atk: 25, matk: 20, def: 8, mdef: 8 } },
    afterLastAnchor: 'hold',
  },
  warrior: {
    anchors: {
      11: { hp: 700, mp: 120, atk: 70, matk: 25, def: 25, mdef: 12 },
      20: { hp: 1050, mp: 160, atk: 110, matk: 30, def: 40, mdef: 18 },
      30: { hp: 1550, mp: 220, atk: 165, matk: 40, def: 60, mdef: 26 },
      40: { hp: 2150, mp: 300, atk: 230, matk: 50, def: 85, mdef: 35 },
    },
    afterLastAnchor: 'error',
  },
  archer: {
    anchors: {
      11: { hp: 560, mp: 170, atk: 75, matk: 25, def: 18, mdef: 15 },
      20: { hp: 850, mp: 220, atk: 120, matk: 30, def: 28, mdef: 22 },
      30: { hp: 1230, mp: 300, atk: 180, matk: 40, def: 42, mdef: 32 },
      40: { hp: 1700, mp: 400, atk: 250, matk: 50, def: 60, mdef: 45 },
    },
    afterLastAnchor: 'error',
  },
  mage: {
    anchors: {
      11: { hp: 420, mp: 300, atk: 35, matk: 85, def: 12, mdef: 25 },
      20: { hp: 620, mp: 470, atk: 45, matk: 140, def: 18, mdef: 42 },
      30: { hp: 900, mp: 680, atk: 60, matk: 210, def: 26, mdef: 62 },
      40: { hp: 1200, mp: 920, atk: 80, matk: 290, def: 35, mdef: 90 },
    },
    afterLastAnchor: 'error',
  },
  cleric: {
    anchors: {
      11: { hp: 560, mp: 260, atk: 40, matk: 65, def: 18, mdef: 28 },
      20: { hp: 850, mp: 410, atk: 55, matk: 105, def: 28, mdef: 45 },
      30: { hp: 1230, mp: 590, atk: 75, matk: 160, def: 42, mdef: 66 },
      40: { hp: 1700, mp: 800, atk: 100, matk: 220, def: 60, mdef: 95 },
    },
    afterLastAnchor: 'error',
  },
  ninja: {
    anchors: {
      11: { hp: 500, mp: 170, atk: 78, matk: 25, def: 16, mdef: 15 },
      20: { hp: 750, mp: 230, atk: 125, matk: 30, def: 24, mdef: 22 },
      30: { hp: 1080, mp: 310, atk: 190, matk: 40, def: 36, mdef: 32 },
      40: { hp: 1500, mp: 420, atk: 265, matk: 50, def: 50, mdef: 45 },
    },
    afterLastAnchor: 'error',
  },
};

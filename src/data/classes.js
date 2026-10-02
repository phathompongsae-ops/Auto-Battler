export const CLASS_DEFS = {
  warrior: { name: 'Warrior', hp: 140, mp: 30, speed: 165, role: 'melee' },
  archer: { name: 'Archer', hp: 100, mp: 55, speed: 180, role: 'ranged' },
  mage: { name: 'Mage', hp: 80, mp: 110, speed: 170, role: 'magic' },
  cleric: { name: 'Cleric', hp: 95, mp: 100, speed: 165, role: 'support' },
  ninja: {
    name: 'Ninja',
    hp: 90,
    mp: 70,
    speed: 195,
    role: 'mobile-dps',
    advancedPaths: {
      shinobi: { name: 'Shinobi', focus: 'physical-crit-mobility-boss' },
      onmyoji: { name: 'Onmyoji', focus: 'magic-aoe-control-farm' }
    }
  }
};

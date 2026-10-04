// Shared test fixtures (not a test file: the runner only loads *.test.ts).
import { CombatantState } from '../../src/combat/CombatantState';
import { ManualClock } from '../../src/core/clock';
import { CraftingQueue } from '../../src/crafting/crafting';
import { RewardLedger } from '../../src/dungeon/rewards';
import { Wallet } from '../../src/economy/Wallet';
import { EquipmentManager } from '../../src/equipment/equipment';
import { Inventory } from '../../src/loot/Inventory';
import { PetCollection } from '../../src/pets/pets';
import { SpecialShop } from '../../src/pets/specialShop';
import { CharacterProgress } from '../../src/progression/CharacterProgress';
import { emptyHooks, type SaveTarget } from '../../src/save/playerSnapshot';
import { ModifierStack } from '../../src/stats/ModifierStack';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { defaultUnlocks } from '../../src/warp/warp';

/** A complete player-like save target wired the way the game wires it. */
export function makeSaveTarget(level = 1, clock = new ManualClock(Date.UTC(2026, 9, 3, 6))) {
  const progress = new CharacterProgress();
  let combat: CombatantState | null = null;
  const stack = new ModifierStack(() => combat?.refreshStats());
  combat = new CombatantState('p', 'P', 'player', (lv, st) => playerCombatStats(progress, lv, stack.list(), st), level);
  const target: SaveTarget & { stack: ModifierStack; clock: ManualClock } = {
    characterId: 'char-1',
    progress,
    combat,
    inventory: new Inventory(),
    wallet: new Wallet(),
    equipment: new EquipmentManager(() => progress.classId, (mods) => stack.replaceSource('equipment', mods)),
    pets: new PetCollection((mods) => stack.replaceSource('pet', mods)),
    shop: new SpecialShop(clock),
    crafting: new CraftingQueue(clock),
    warp: defaultUnlocks(),
    ledger: new RewardLedger(),
    hooks: emptyHooks(),
    stack,
    clock,
  };
  return target;
}

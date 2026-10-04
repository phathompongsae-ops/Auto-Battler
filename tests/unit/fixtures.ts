// Shared test fixtures (not a test file: the runner only loads *.test.ts).
import { CombatantState } from '../../src/combat/CombatantState';
import { ManualClock } from '../../src/core/clock';
import { FixedServerDay } from '../../src/core/serverDay';
import { CraftingQueue } from '../../src/crafting/crafting';
import { RewardLedger } from '../../src/dungeon/rewards';
import { Wallet } from '../../src/economy/Wallet';
import { DailyState } from '../../src/daily/DailyState';
import { DungeonEntitlements } from '../../src/dungeon/entitlements';
import { FieldEnergy } from '../../src/energy/fieldEnergy';
import { EquipmentManager } from '../../src/equipment/equipment';
import { Inventory } from '../../src/loot/Inventory';
import { PetCollection } from '../../src/pets/pets';
import { SpecialShop } from '../../src/pets/specialShop';
import { CharacterProgress } from '../../src/progression/CharacterProgress';
import { emptyHooks, type SaveTarget } from '../../src/save/playerSnapshot';
import { MAX_LEVEL } from '../../src/data/progressionData';
import { classGrowthMaxLevel } from '../../src/stats/classBaseStats';
import { ModifierStack } from '../../src/stats/ModifierStack';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { defaultUnlocks } from '../../src/warp/warp';
import { EventBus } from '../../src/core/EventBus';
import { QUESTS, type QuestDef } from '../../src/data/questData';
import { FeatureUnlocks } from '../../src/features/FeatureUnlocks';
import type { GameEvents } from '../../src/game/GameEvents';
import { ProgressionSystem } from '../../src/progression/ProgressionSystem';
import { QuestSystem } from '../../src/quests/QuestSystem';
import { JobChange } from '../../src/progression/JobChange';

/** A complete player-like save target wired the way the game wires it. */
export function makeSaveTarget(
  level = 1,
  clock = new ManualClock(Date.UTC(2026, 9, 3, 6)),
  serverDay = new FixedServerDay(1),
  questDefs: Readonly<Record<string, QuestDef>> = QUESTS,
) {
  const progress = new CharacterProgress();
  let combat: CombatantState | null = null;
  const stack = new ModifierStack(() => combat?.refreshStats());
  combat = new CombatantState('p', 'P', 'player', (lv, st) => playerCombatStats(progress, lv, stack.list(), st), level, () => classGrowthMaxLevel(progress.classId) ?? MAX_LEVEL);
  const daily = new DailyState(serverDay);
  const events = new EventBus<GameEvents>();
  const progression = new ProgressionSystem(events, serverDay);
  const inventory = new Inventory();
  const wallet = new Wallet();
  const features = new FeatureUnlocks();
  const player = { id: 'p', x: 0, y: 0, hitRadius: 10, combat };
  const quests = new QuestSystem(
    questDefs,
    { level: () => combat!.level, classId: () => progress.classId, serverDay: () => serverDay.day() },
    features,
    {
      grantExp: (amount) => progression.grantExp(player, amount),
      addCurrency: (currency, amount) => wallet.add(currency, amount),
      addItem: (itemId, count) => {
        inventory.add(itemId, count);
        events.emit('itemAcquired', { itemId, amount: count, source: 'quest' });
      },
    },
    events,
    'p',
  );
  const target: SaveTarget & {
    stack: ModifierStack;
    clock: ManualClock;
    serverDay: FixedServerDay;
    fieldEnergy: FieldEnergy;
    entitlements: DungeonEntitlements;
    jobChange: JobChange;
    events: EventBus<GameEvents>;
    progression: ProgressionSystem;
    player: typeof player;
  } = {
    characterId: 'char-1',
    progress,
    combat,
    inventory,
    wallet,
    equipment: new EquipmentManager(() => progress.classId, (mods) => stack.replaceSource('equipment', mods)),
    pets: new PetCollection((mods) => stack.replaceSource('pet', mods)),
    shop: new SpecialShop(clock),
    crafting: new CraftingQueue(clock),
    warp: defaultUnlocks(),
    ledger: new RewardLedger(),
    daily,
    fieldEnergy: new FieldEnergy(daily),
    entitlements: new DungeonEntitlements(daily),
    quests,
    features,
    jobChange: new JobChange({ progress, combat }, quests, features, events, 'p'),
    events,
    progression,
    player,
    hooks: emptyHooks(),
    stack,
    clock,
    serverDay,
  };
  return target;
}

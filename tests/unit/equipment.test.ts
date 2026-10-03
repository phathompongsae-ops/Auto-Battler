import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seededRng } from '../../src/core/rng';
import { ENCHANT_LINES, ENCHANT_OPTIONS, ENCHANT_POOLS } from '../../src/data/enchantData';
import {
  ENHANCEMENT_CURVE,
  ENHANCEMENT_SUCCESS,
  EQUIPMENT_SLOTS,
  MAX_ENHANCEMENT,
  RARITIES,
  type EquipmentSlot,
} from '../../src/data/equipmentData';
import { EQUIPMENT_DEFS } from '../../src/data/equipmentItems';
import { SETS } from '../../src/data/setData';
import { Wallet } from '../../src/economy/Wallet';
import { rerollEnchants, rollEnchants } from '../../src/equipment/enchant';
import { attemptEnhancement, boosterBonus, enhancementChance, enhancementVfxTier, levelAfterFailure } from '../../src/equipment/enhancement';
import { enhancedBaseStats, EquipmentManager, itemModifier, type EquipmentInstance } from '../../src/equipment/equipment';
import { createEquipment, sequentialIds } from '../../src/equipment/factory';
import { evaluateSets } from '../../src/equipment/sets';
import type { JobId } from '../../src/data/jobData';
import { Inventory } from '../../src/loot/Inventory';
import { CharacterProgress } from '../../src/progression/CharacterProgress';
import { ModifierStack } from '../../src/stats/ModifierStack';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { CombatantState } from '../../src/combat/CombatantState';

const close = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} expected ${b}, got ${a}`);
const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

/** Plain item without enchants, for exact stat checks. */
const plain = (defId: string, id = defId, enhancement = 0): EquipmentInstance => ({ instanceId: id, defId, enhancement, enchants: [], bound: false });

/** A player-like owner whose equipment feeds a ModifierStack (as in the game). */
function makePlayer(job: JobId = 'warrior', level = 40) {
  const progress = new CharacterProgress();
  if (job !== 'novice') progress.changeJob(job, Math.max(level, 11));
  let combat: CombatantState | null = null;
  const stack = new ModifierStack(() => combat?.refreshStats());
  combat = new CombatantState('p', 'P', 'player', (lv, st) => playerCombatStats(progress, lv, stack.list(), st), level);
  const equipment = new EquipmentManager(() => progress.classId, (mods) => stack.replaceSource('equipment', mods));
  return { progress, combat, stack, equipment };
}

describe('equipment slots and equipping', () => {
  test('nine locked slots', () => {
    assert.deepEqual([...EQUIPMENT_SLOTS], ['weapon', 'off_hand', 'head', 'armor', 'gloves', 'boots', 'necklace', 'ring_1', 'ring_2']);
  });

  test('every slot accepts its item type', () => {
    const { equipment } = makePlayer();
    const bySlot: Record<EquipmentSlot, string> = {
      weapon: 'iron_sword', off_hand: 'oak_shield', head: 'traveler_cap', armor: 'traveler_vest', gloves: 'traveler_gloves',
      boots: 'traveler_boots', necklace: 'bead_necklace', ring_1: 'copper_ring', ring_2: 'quartz_ring',
    };
    for (const [slot, defId] of Object.entries(bySlot) as [EquipmentSlot, string][]) {
      equipment.add(plain(defId, `${slot}-item`));
      assert.deepEqual(equipment.equip(`${slot}-item`, slot), { ok: true, unequipped: [] }, slot);
    }
    for (const slot of EQUIPMENT_SLOTS) assert.equal(equipment.equipped[slot], `${slot}-item`);
  });

  test('wrong slot rejected; rings fit either ring slot', () => {
    const { equipment } = makePlayer();
    equipment.add(plain('traveler_cap', 'cap'));
    assert.deepEqual(equipment.equip('cap', 'armor'), { ok: false, reason: 'wrong_slot' });
    equipment.add(plain('copper_ring', 'r1'));
    equipment.add(plain('quartz_ring', 'r2'));
    assert.equal(equipment.equip('r1').ok, true);
    assert.equal(equipment.equip('r2').ok, true);
    assert.equal(equipment.equipped.ring_1, 'r1');
    assert.equal(equipment.equipped.ring_2, 'r2');
    assert.deepEqual(equipment.equip('r1', 'ring_2'), { ok: false, reason: 'already_equipped' });
  });

  test('replacement swaps modifiers; unequip removes them', () => {
    const { combat, equipment } = makePlayer();
    const bare = combat.stats.attack;
    equipment.add(plain('iron_sword', 'a'));
    equipment.add(plain('knight_sword', 'b'));
    equipment.equip('a');
    assert.equal(combat.stats.attack, bare + 20);
    assert.deepEqual(equipment.equip('b'), { ok: true, unequipped: ['a'] });
    assert.equal(combat.stats.attack, bare + 110);
    equipment.unequip('weapon');
    assert.equal(combat.stats.attack, bare);
  });

  test('two-handed weapon clears the off-hand; off-hand is blocked while it is equipped', () => {
    const { equipment } = makePlayer();
    equipment.add(plain('iron_sword', 'sword'));
    equipment.add(plain('oak_shield', 'shield'));
    equipment.add(plain('steel_greatsword', 'great'));
    equipment.equip('sword');
    equipment.equip('shield');
    assert.deepEqual(equipment.equip('great'), { ok: true, unequipped: ['sword', 'shield'] });
    assert.equal(equipment.equipped.off_hand, null);
    assert.deepEqual(equipment.equip('shield'), { ok: false, reason: 'off_hand_blocked_by_two_handed' });
  });

  test('class and weapon-type restrictions', () => {
    const warrior = makePlayer('warrior');
    warrior.equipment.add(plain('hunter_bow', 'bow'));
    assert.deepEqual(warrior.equipment.equip('bow'), { ok: false, reason: 'class_restricted' });
    const novice = makePlayer('novice', 5);
    novice.equipment.add(plain('iron_sword', 's'));
    novice.equipment.add(plain('traveler_cap', 'c'));
    assert.deepEqual(novice.equipment.equip('s'), { ok: false, reason: 'class_restricted' });
    assert.equal(novice.equipment.equip('c').ok, true);
    const cleric = makePlayer('cleric');
    cleric.equipment.add(plain('oak_staff', 'staff'));
    cleric.equipment.add(plain('iron_mace', 'mace'));
    cleric.equipment.add(plain('oak_shield', 'shield'));
    assert.equal(cleric.equipment.equip('mace').ok, true);
    assert.equal(cleric.equipment.equip('shield').ok, true);
    assert.deepEqual(cleric.equipment.equip('staff'), { ok: true, unequipped: ['mace', 'shield'] });
    const ninja = makePlayer('ninja');
    ninja.equipment.add(plain('twin_fangs', 'fangs'));
    assert.equal(ninja.equipment.equip('fangs').ok, true);
    assert.equal(ninja.equipment.twoHanded(), true);
  });

  test('equipment level, rarity and set are independent item data', () => {
    assert.deepEqual([...RARITIES], ['common', 'uncommon', 'rare', 'legendary']);
    const levels = new Set(Object.values(EQUIPMENT_DEFS).map((d) => d.equipmentLevel));
    for (const lv of [10, 20, 40]) assert.ok(levels.has(lv), `Lv${lv}`);
    assert.equal(EQUIPMENT_DEFS.guardian_helm.setId, EQUIPMENT_DEFS.guardian_helm_legendary.setId);
    assert.notEqual(EQUIPMENT_DEFS.guardian_helm.rarity, EQUIPMENT_DEFS.guardian_helm_legendary.rarity);
  });
});

describe('enhancement', () => {
  const ctx = (stones = 100, gold = 1_000_000, rng = fixed(0)) => {
    const inventory = new Inventory();
    inventory.add('enhancement_stone', stones);
    return { inventory, wallet: new Wallet({ gold }), rng };
  };

  test('max +15 and the locked success table', () => {
    assert.equal(MAX_ENHANCEMENT, 15);
    assert.deepEqual(ENHANCEMENT_SUCCESS.slice(1), [1, 1, 1, 1, 0.95, 0.9, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.18, 0.12]);
    const item = plain('knight_sword', 'k', 15);
    assert.deepEqual(attemptEnhancement(item, ctx()), { ok: false, reason: 'max_level' });
  });

  test('curve hits the milestones and only base stats are enhanced', () => {
    close(ENHANCEMENT_CURVE.weapon[10], 0.25);
    close(ENHANCEMENT_CURVE.weapon[15], 0.34);
    close(ENHANCEMENT_CURVE.armor[10], 0.2);
    close(ENHANCEMENT_CURVE.armor[15], 0.26);
    for (const curve of Object.values(ENHANCEMENT_CURVE)) for (let i = 1; i < curve.length; i++) assert.ok(curve[i] > curve[i - 1]);
    assert.deepEqual(enhancedBaseStats(plain('knight_sword', 'k', 10)), { physicalAtk: Math.round(110 * 1.25) });
    // Fixed bonuses (warborn_plate's STR +3) and enchants are untouched.
    const plate: EquipmentInstance = { ...plain('warborn_plate', 'w', 15), enchants: [{ optionId: 'max_hp', quality: 'normal', value: 50 }] };
    const mod = itemModifier(plate);
    assert.equal(mod.flat?.def, Math.round(48 * 1.26));
    assert.equal(mod.primary?.str, 3);
    assert.equal(mod.flat?.maxHp, 50);
  });

  test('+0..+10 failures never lower the level; above +10 a failure loses one, never below +10', () => {
    for (let lv = 0; lv <= 9; lv++) assert.equal(levelAfterFailure(lv, false), lv);
    assert.equal(levelAfterFailure(10, false), 10);
    assert.equal(levelAfterFailure(11, false), 10);
    assert.equal(levelAfterFailure(14, false), 13);
    const item = plain('knight_sword', 'k', 12);
    const r = attemptEnhancement(item, ctx(100, 1e6, fixed(0.99)));
    assert.deepEqual(r, { ok: true, success: false, from: 12, to: 11, chance: 0.25 });
  });

  test('a failed attempt still consumes stones and gold; nothing is consumed on rejection', () => {
    const c = ctx(1, 100, fixed(0.99));
    const item = plain('knight_sword', 'k', 0);
    assert.equal(attemptEnhancement(item, c).ok, true); // +1 is 100%
    assert.equal(c.inventory.count('enhancement_stone'), 0);
    assert.equal(c.wallet.get('gold'), 0);
    assert.deepEqual(attemptEnhancement(item, c), { ok: false, reason: 'not_enough_stones' });
  });

  test('Protection Stone stops level loss but adds no chance', () => {
    const c = ctx(100, 1e6, fixed(0.3));
    c.inventory.add('protection_stone', 1);
    const item = plain('knight_sword', 'k', 12);
    const r = attemptEnhancement(item, c, { protectionStone: true });
    assert.deepEqual(r, { ok: true, success: false, from: 12, to: 12, chance: 0.25 });
    assert.equal(c.inventory.count('protection_stone'), 0);
  });

  test('Success Booster adds its configured chance but protects nothing', () => {
    assert.equal(boosterBonus(), 0.1);
    const c = ctx(100, 1e6, fixed(0.3));
    c.inventory.add('success_booster', 2);
    const item = plain('knight_sword', 'k', 12);
    const win = attemptEnhancement(item, c, { successBooster: true }); // 0.3 < 0.35
    assert.deepEqual(win, { ok: true, success: true, from: 12, to: 13, chance: 0.35 });
    const lose = attemptEnhancement(item, { ...c, rng: fixed(0.9) }, { successBooster: true });
    assert.deepEqual(lose, { ok: true, success: false, from: 13, to: 12, chance: 0.28 });
  });

  test('both together: boosted chance and no loss', () => {
    const c = ctx(100, 1e6, fixed(0.99));
    c.inventory.add('success_booster', 1);
    c.inventory.add('protection_stone', 1);
    const item = plain('knight_sword', 'k', 14);
    const r = attemptEnhancement(item, c, { successBooster: true, protectionStone: true });
    assert.equal(r.ok && r.to, 14);
    assert.equal(r.ok && r.chance, enhancementChance(15, 0.1));
    assert.deepEqual(attemptEnhancement(item, c, { protectionStone: true }), { ok: false, reason: 'missing_protection_stone' });
  });

  test('no pity: repeated failures never change the chance', () => {
    const c = ctx(1000, 1e8, fixed(0.99));
    const item = plain('knight_sword', 'k', 10);
    const chances = Array.from({ length: 20 }, () => {
      const r = attemptEnhancement(item, c);
      return r.ok ? r.chance : -1;
    });
    assert.ok(chances.every((ch) => ch === 0.45));
    assert.equal(item.enhancement, 10);
  });

  test('VFX tiers', () => {
    assert.deepEqual([0, 9, 10, 11, 12, 14, 15].map(enhancementVfxTier), [0, 0, 1, 1, 2, 2, 3]);
  });
});

describe('enchants', () => {
  test('line counts follow rarity: 1 / 2 / 3 / 3', () => {
    assert.deepEqual(ENCHANT_LINES, { common: 1, uncommon: 2, rare: 3, legendary: 3 });
    const rng = seededRng(7);
    assert.equal(rollEnchants(EQUIPMENT_DEFS.copper_ring, rng).length, 1);
    assert.equal(rollEnchants(EQUIPMENT_DEFS.quartz_ring, rng).length, 2);
    assert.equal(rollEnchants(EQUIPMENT_DEFS.knight_sword, rng).length, 3);
    assert.equal(rollEnchants(EQUIPMENT_DEFS.guardian_helm_legendary, rng).length, 3);
  });

  test('slot-specific pools: rolls stay inside the pool, no duplicates, valid ranges', () => {
    const rng = seededRng(11);
    for (let i = 0; i < 200; i++) {
      for (const [defId, pool] of [['knight_sword', 'weapon'], ['guardian_plate', 'armor'], ['quartz_ring', 'accessory']] as const) {
        const lines = rollEnchants(EQUIPMENT_DEFS[defId], rng);
        assert.equal(new Set(lines.map((l) => l.optionId)).size, lines.length);
        for (const l of lines) {
          assert.ok(ENCHANT_POOLS[pool].includes(l.optionId), `${defId} rolled ${l.optionId}`);
          const [min, max] = ENCHANT_OPTIONS[l.optionId].ranges[l.quality];
          assert.ok(l.value >= min - 1e-9 && l.value <= max + 1e-9, `${l.optionId} ${l.value}`);
        }
      }
    }
    assert.equal(ENCHANT_POOLS.armor.includes('physical_atk'), false);
    assert.equal(ENCHANT_POOLS.weapon.includes('max_hp'), false);
  });

  test('only Legendary can roll Perfect quality', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 300; i++) for (const l of rollEnchants(EQUIPMENT_DEFS.knight_sword, rng)) assert.notEqual(l.quality, 'perfect');
    let perfect = 0;
    for (let i = 0; i < 300; i++) perfect += rollEnchants(EQUIPMENT_DEFS.guardian_helm_legendary, rng).filter((l) => l.quality === 'perfect').length;
    assert.ok(perfect > 0);
  });

  test('same seed, same result', () => {
    assert.deepEqual(rollEnchants(EQUIPMENT_DEFS.knight_sword, seededRng(99)), rollEnchants(EQUIPMENT_DEFS.knight_sword, seededRng(99)));
    assert.deepEqual(createEquipment('knight_sword', seededRng(5), sequentialIds('eq')), createEquipment('knight_sword', seededRng(5), sequentialIds('eq')));
  });

  test('reroll: locked lines identical, unlocked lines rerolled, cost grows with locks', () => {
    const item = createEquipment('knight_sword', seededRng(21), sequentialIds('eq'));
    const before = structuredClone(item.enchants);
    const inventory = new Inventory();
    inventory.add('enchant_stone', 100);
    const wallet = new Wallet({ gold: 100000 });
    const r = rerollEnchants(item, [1], { inventory, wallet, rng: seededRng(22) });
    assert.equal(r.ok, true);
    assert.deepEqual(item.enchants[1], before[1]);
    assert.equal(item.enchants.length, 3);
    assert.equal(new Set(item.enchants.map((l) => l.optionId)).size, 3);
    assert.equal(inventory.count('enchant_stone'), 100 - 3);
    assert.equal(wallet.get('gold'), 100000 - 1500);
    rerollEnchants(item, [0, 2], { inventory, wallet, rng: seededRng(23) });
    assert.equal(inventory.count('enchant_stone'), 97 - 5);
    assert.deepEqual(rerollEnchants(item, [0, 1, 2], { inventory, wallet, rng: seededRng(1) }), { ok: false, reason: 'all_locked' });
    assert.deepEqual(rerollEnchants(item, [5], { inventory, wallet, rng: seededRng(1) }), { ok: false, reason: 'invalid_lock' });
  });

  test('enchant lines feed the item modifier, including the damage-reduction hook', () => {
    const item: EquipmentInstance = {
      ...plain('guardian_plate', 'g'),
      enchants: [
        { optionId: 'vit', quality: 'good', value: 3 },
        { optionId: 'mdef', quality: 'normal', value: 4 },
        { optionId: 'damage_reduction', quality: 'normal', value: 0.01 },
      ],
    };
    const mod = itemModifier(item);
    assert.equal(mod.primary?.vit, 3);
    assert.equal(mod.flat?.mdef, 4);
    assert.equal(mod.effects?.damageReduction, 0.01);
  });
});

describe('sets', () => {
  const equipSet = (pieces: string[]) => {
    const p = makePlayer();
    pieces.forEach((defId, i) => {
      p.equipment.add(plain(defId, `${defId}-${i}`));
      p.equipment.equip(`${defId}-${i}`);
    });
    return p;
  };
  const active = (p: ReturnType<typeof makePlayer>) => evaluateSets(p.equipment.equipped, p.equipment.items).active.map((a) => `${a.setId}:${a.threshold}`);

  test('definitions load', () => {
    assert.deepEqual(Object.keys(SETS).sort(), ['berserker', 'guardian', 'warborn']);
    assert.deepEqual(SETS.guardian.bonuses[2].modifier?.percent, { maxHp: 0.08, def: 0.08 });
    assert.deepEqual(SETS.warborn.bonuses[2].modifier?.percent, { physicalAtk: 0.08 });
    assert.deepEqual(SETS.berserker.bonuses[2].modifier?.flat, { aspd: 0.06, critRate: 0.05 });
  });

  test('0 / 1 / 2 / 3 / 4 pieces', () => {
    assert.deepEqual(active(equipSet([])), []);
    assert.deepEqual(active(equipSet(['guardian_helm'])), []);
    assert.deepEqual(active(equipSet(['guardian_helm', 'guardian_plate'])), ['guardian:2']);
    assert.deepEqual(active(equipSet(['guardian_helm', 'guardian_plate', 'guardian_gauntlets'])), ['guardian:2']);
    assert.deepEqual(active(equipSet(['guardian_helm', 'guardian_plate', 'guardian_gauntlets', 'guardian_greaves'])), ['guardian:2', 'guardian:4']);
  });

  test('rarity mixes within a set; removing a piece drops the 4-set at once', () => {
    const p = equipSet(['guardian_helm_legendary', 'guardian_plate', 'guardian_gauntlets', 'guardian_greaves']);
    assert.deepEqual(active(p), ['guardian:2', 'guardian:4']);
    p.equipment.unequip('boots');
    assert.deepEqual(active(p), ['guardian:2']);
  });

  test('mixed sets count independently; weapons and accessories never count', () => {
    const p = equipSet(['warborn_helm', 'warborn_plate', 'berserker_gauntlets', 'berserker_greaves', 'knight_sword', 'copper_ring']);
    assert.deepEqual(active(p).sort(), ['berserker:2', 'warborn:2']);
  });

  test('Guardian 2-piece: Max HP +8% and DEF +8% on live stats; removed when broken', () => {
    const p = makePlayer();
    const bare = { ...p.combat.stats };
    for (const id of ['guardian_gauntlets', 'guardian_greaves']) {
      p.equipment.add(plain(id));
      p.equipment.equip(id);
    }
    // (base DEF + 22 + 22) × 1.08
    assert.equal(p.combat.stats.defense, Math.round((bare.defense + 44) * 1.08));
    assert.equal(p.combat.stats.maxHp, Math.round(bare.maxHp * 1.08));
    p.equipment.unequip('boots');
    assert.equal(p.combat.stats.defense, bare.defense + 22);
  });

  test('Warborn 4-piece: Power Slash +15% damage (cooldown is an inert hook)', () => {
    const p = equipSet(['warborn_helm', 'warborn_plate', 'warborn_gauntlets', 'warborn_greaves']);
    close(p.combat.stats.skillDamageBonus.power_strike ?? 0, 0.15);
    assert.equal(p.combat.stats.skillCooldownReduction.power_strike, undefined);
    assert.equal(SETS.warborn.bonuses[4].special?.params.cooldownReduction, null);
  });

  test('Berserker 2-piece: ASPD +6%, Crit Rate +5%; 4-piece is a hook only', () => {
    const p = makePlayer();
    const bare = { ...p.combat.stats };
    const q = equipSet(['berserker_helm', 'berserker_plate']);
    close(q.combat.stats.attackSpeed - bare.attackSpeed, 0.06 + (2 + 2) * 0.002); // set + AGI from pieces
    close(q.combat.stats.critChance - bare.critChance, 0.05 + 1 * 0.0015);
    assert.equal(SETS.berserker.bonuses[4].modifier, undefined);
    assert.equal(SETS.berserker.bonuses[4].special?.effectId, 'berserker_momentum');
  });
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CombatantState } from '../../src/combat/CombatantState';
import { ManualClock } from '../../src/core/clock';
import { EventBus } from '../../src/core/EventBus';
import { ClockServerDay, FixedServerDay } from '../../src/core/serverDay';
import { EXP_ANCHORS, MAX_LEVEL } from '../../src/data/progressionData';
import type { GameEvents } from '../../src/game/GameEvents';
import { cumulativeExp, expToNext, serverLevelCap } from '../../src/progression/expCurve';
import { CharacterProgress } from '../../src/progression/CharacterProgress';
import { ProgressionSystem } from '../../src/progression/ProgressionSystem';
import { changeJob } from '../../src/progression/statActions';
import { applyPlayerSave, capturePlayerSave } from '../../src/save/playerSnapshot';
import { deserializePlayerSave, serializePlayerSave } from '../../src/save/playerSave';
import { playerCombatStats } from '../../src/stats/playerCombatStats';
import { makeSaveTarget } from './fixtures';

/** A Novice (no class growth cap) wired to a ProgressionSystem on a settable server day. */
function setup(level = 1, day = 21) {
  const serverDay = new FixedServerDay(day);
  const t = makeSaveTarget(level, undefined, serverDay);
  const events = new EventBus<GameEvents>();
  const log: string[] = [];
  events.on('levelUp', (e) => log.push(`lv${e.level}`));
  events.on('expGained', (e) => log.push(`exp+${e.amount}-${e.discarded}`));
  const entity = { id: 'p', x: 0, y: 0, hitRadius: 10, combat: t.combat };
  return { t, entity, serverDay, log, progression: new ProgressionSystem(events, serverDay) };
}

describe('EXP curve', () => {
  test('anchors are exact; Lv1 starts at 0; max level 60', () => {
    assert.equal(MAX_LEVEL, 60);
    assert.equal(cumulativeExp(1), 0);
    for (const [level, exp] of Object.entries(EXP_ANCHORS)) assert.equal(cumulativeExp(Number(level)), exp, `Lv${level}`);
    assert.equal(cumulativeExp(10), 20_000);
    assert.equal(cumulativeExp(60), 2_700_000);
  });

  test('smooth: every level costs something and never less than the level before', () => {
    let prev = 0;
    for (let level = 1; level < MAX_LEVEL; level++) {
      const cost = expToNext(level);
      assert.ok(cost > 0 && cost >= prev, `Lv${level} costs ${cost} after ${prev}`);
      assert.equal(cumulativeExp(level + 1) - cumulativeExp(level), cost);
      prev = cost;
    }
    assert.equal(expToNext(MAX_LEVEL), 0);
  });
});

describe('server level cap', () => {
  test('cap by server day', () => {
    const expected: [number, number][] = [
      [1, 40], [2, 45], [3, 45], [4, 50], [6, 50], [7, 53], [9, 53],
      [10, 55], [13, 55], [14, 57], [20, 57], [21, 60], [400, 60],
    ];
    for (const [day, cap] of expected) assert.equal(serverLevelCap(day), cap, `day ${day}`);
  });

  test('server day comes from the clock and calendar; a dev override wins', () => {
    const calendar = { launchAt: Date.UTC(2026, 9, 3, 17), resetHour: 0, utcOffsetMinutes: 420 };
    const clock = new ManualClock(calendar.launchAt);
    const day = new ClockServerDay(clock, calendar);
    assert.equal(day.day(), 1);
    clock.advance(86_400_000 - 1);
    assert.equal(day.day(), 1);
    clock.advance(1);
    assert.equal(day.day(), 2);
    clock.set(calendar.launchAt - 5);
    assert.equal(day.day(), 1, 'never before day 1');
    day.override = 14;
    assert.equal(day.day(), 14);
    day.override = null;
    assert.equal(day.day(), 1);
  });
});

describe('EXP gain and level-up', () => {
  test('gain without levelling', () => {
    const { t, entity, progression, log } = setup();
    assert.deepEqual(progression.grantExp(entity, 30), { gained: 30, discarded: 0, levelsGained: 0 });
    assert.equal(t.combat.exp, 30);
    assert.deepEqual(log, ['exp+30-0']);
  });

  test('one reward can gain several levels; stats, HP and stat points follow', () => {
    const { t, entity, progression, log } = setup();
    assert.equal(t.progress.remaining(1), 0, 'Lv1 starts with 0 unspent stat points');
    const hpBefore = t.combat.stats.maxHp;
    t.combat.hp = 1;
    const result = progression.grantExp(entity, cumulativeExp(5) + 7);
    assert.deepEqual(result, { gained: cumulativeExp(5) + 7, discarded: 0, levelsGained: 4 });
    assert.equal(t.combat.level, 5);
    assert.equal(t.combat.exp, 7);
    assert.deepEqual(log, ['lv2', 'lv3', 'lv4', 'lv5', `exp+${cumulativeExp(5) + 7}-0`]);
    assert.equal(t.progress.remaining(5), 4, '+1 stat point per level from Lv2');
    assert.equal(t.combat.hp, t.combat.stats.maxHp, 'level-up refills HP');
    assert.equal(t.combat.stats.maxHp, hpBefore, 'Novice base is fixed; growth comes from points');
  });

  test('derived stats are recalculated after a level-up', () => {
    const { t, entity, progression } = setup(11);
    assert.equal(changeJob(t, 'warrior').ok, true);
    const before = t.combat.stats.maxHp;
    progression.grantExp(entity, expToNext(11));
    assert.equal(t.combat.level, 12);
    assert.ok(t.combat.stats.maxHp > before, `${before} -> ${t.combat.stats.maxHp}`);
  });

  test('nothing for zero, negative or NaN EXP', () => {
    const { t, entity, progression, log } = setup();
    for (const n of [0, -5, Number.NaN]) progression.grantExp(entity, n);
    assert.equal(t.combat.exp, 0);
    assert.deepEqual(log, []);
  });
});

describe('Overflow EXP at the server cap', () => {
  test('stops at the cap and stores up to exactly one level of Overflow', () => {
    const { t, entity, progression } = setup(39, 1); // day 1: cap 40
    const toCap = expToNext(39);
    const result = progression.grantExp(entity, toCap + 1000);
    assert.equal(t.combat.level, 40);
    assert.equal(progression.overflowExp(entity), 1000);
    assert.equal(result.discarded, 0);

    const full = expToNext(40);
    const more = progression.grantExp(entity, full);
    assert.equal(t.combat.level, 40, 'never bypasses the cap');
    assert.equal(progression.overflowExp(entity), full);
    assert.deepEqual(more, { gained: full - 1000, discarded: 1000, levelsGained: 0 });

    assert.deepEqual(progression.grantExp(entity, 500), { gained: 0, discarded: 500, levelsGained: 0 }, 'full Overflow discards');
  });

  test('when the cap rises, stored Overflow is applied normally (one level at most)', () => {
    const { t, entity, progression, serverDay } = setup(39, 1);
    progression.grantExp(entity, expToNext(39) + expToNext(40) + 99_999);
    assert.equal(t.combat.level, 40);
    assert.equal(progression.settle(entity), 0, 'nothing changes while the cap holds');

    serverDay.value = 2; // cap 45
    assert.equal(progression.settle(entity), 1);
    assert.equal(t.combat.level, 41);
    assert.equal(t.combat.exp, 0);
    assert.equal(progression.overflowExp(entity), 0);
  });

  test('a partial Overflow becomes progress toward the next level', () => {
    const { t, entity, progression, serverDay } = setup(40, 1);
    progression.grantExp(entity, 1234);
    serverDay.value = 2;
    progression.settle(entity);
    assert.equal(t.combat.level, 40);
    assert.equal(t.combat.exp, 1234);
    assert.equal(progression.overflowExp(entity), 0);
  });

  test('the class growth range is a cap too (Class 1 ends at Lv40)', () => {
    const { t, entity, progression } = setup(11, 21);
    assert.equal(changeJob(t, 'warrior').ok, true);
    t.combat.level = 39;
    t.combat.refreshStats();
    progression.grantExp(entity, 10_000_000);
    assert.equal(t.combat.level, 40);
    assert.equal(progression.levelCap(entity), 40);
    assert.equal(t.combat.exp, expToNext(40));
  });

  test('at Lv60 every point of EXP is discarded', () => {
    const { t, entity, progression } = setup(60, 21);
    assert.deepEqual(progression.grantExp(entity, 500), { gained: 0, discarded: 500, levelsGained: 0 });
    assert.equal(t.combat.exp, 0);
  });

  test('a lowered day (dev) never pushes a character past the cap or takes levels away', () => {
    const { t, entity, progression } = setup(50, 1); // above day-1 cap 40
    progression.grantExp(entity, 10);
    assert.equal(t.combat.level, 50);
    assert.equal(t.combat.exp, 10);
  });

  test('level and Overflow survive save/load, then apply once the cap allows', () => {
    const a = setup(39, 1);
    a.progression.grantExp(a.entity, expToNext(39) + 500);
    const text = serializePlayerSave(capturePlayerSave(a.t));

    const b = setup(1, 2);
    applyPlayerSave(b.t, deserializePlayerSave(text));
    assert.equal(b.t.combat.level, 40);
    assert.equal(b.t.combat.exp, 500);
    b.progression.settle(b.entity);
    assert.equal(b.t.combat.level, 40, '500 is not a full level');
    assert.equal(b.t.combat.exp, 500);
  });
});

describe('class level limit and Overflow', () => {
  /** A Novice-stat character whose class limit can be raised (stands in for a future class advancement). */
  function limited(classLimit: number, day: number, level: number) {
    const limit = { value: classLimit };
    const serverDay = new FixedServerDay(day);
    const progress = new CharacterProgress();
    const combat = new CombatantState('p', 'P', 'player', (lv, st) => playerCombatStats(progress, lv, [], st), level, () => limit.value);
    const entity = { id: 'p', x: 0, y: 0, hitRadius: 10, combat };
    return { limit, serverDay, combat, entity, progression: new ProgressionSystem(new EventBus<GameEvents>(), serverDay) };
  }

  test('Overflow accumulates (one level max) while blocked by the class limit', () => {
    const { combat, entity, progression } = limited(40, 21, 39);
    const result = progression.grantExp(entity, expToNext(39) + expToNext(40) + 777);
    assert.equal(combat.level, 40);
    assert.equal(progression.levelCap(entity), 40);
    assert.equal(progression.overflowExp(entity), expToNext(40));
    assert.equal(result.discarded, 777);
  });

  test('raising the class limit lets stored Overflow apply normally', () => {
    const { limit, combat, entity, progression } = limited(40, 21, 39);
    progression.grantExp(entity, expToNext(39) + expToNext(40));
    limit.value = 60;
    assert.equal(progression.settle(entity), 1);
    assert.equal(combat.level, 41);
    assert.equal(combat.exp, 0);
  });

  test('the server cap still wins when it is lower than or equal to the raised class limit', () => {
    const { limit, serverDay, combat, entity, progression } = limited(45, 2, 44); // day 2: server cap 45
    progression.grantExp(entity, expToNext(44) + expToNext(45));
    assert.equal(combat.level, 45);
    limit.value = 60; // class no longer blocks; server cap 45 still does
    assert.equal(progression.settle(entity), 0);
    assert.equal(combat.level, 45);
    assert.equal(progression.overflowExp(entity), expToNext(45));
    serverDay.value = 4; // cap 50
    assert.equal(progression.settle(entity), 1);
    assert.equal(combat.level, 46);
  });
});

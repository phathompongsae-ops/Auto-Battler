#!/usr/bin/env node

// Tests the DOM-free augment module (src/augment-runtime.js): canonical offer/option
// definitions, pure aggregation, deterministic class selection, and fail-closed lookup.

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); };
const eq = (a, b, msg) => assert(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const code = await readFile(new URL('../src/augment-runtime.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('globalThis', code)(sandbox);
const A = sandbox.AugmentRuntime;
assert(!!A, 'augment-runtime.js must set globalThis.AugmentRuntime');

if (A) {
  // --- Canonical offers/options ---
  const o5 = A.getOfferOptions('augment.map1.after_5');
  const o10 = A.getOfferOptions('augment.map1.after_10');
  eq(o5.length, 2, 'after_5 has two options');
  eq(o10.length, 2, 'after_10 has two options');
  eq(o5[0].kind, 'team_max_hp_pct', 'after_5 opt1 kind'); eq(o5[0].value, 8, 'after_5 opt1 value (8% HP)');
  eq(o5[1].kind, 'class_atk_pct', 'after_5 opt2 kind'); eq(o5[1].value, 15, 'after_5 opt2 value (15% ATK)');
  eq(o10[0].kind, 'team_atk_speed_pct', 'after_10 opt1 kind'); eq(o10[0].value, 10, 'after_10 opt1 value (10% AS)');
  eq(o10[1].kind, 'class_start_mana_pct', 'after_10 opt2 kind'); eq(o10[1].value, 50, 'after_10 opt2 value (50% mana)');
  for (const o of [...o5, ...o10]) { assert(typeof o.labelTh === 'string' && o.labelTh.length > 0, `${o.id} has a Thai label`); assert(typeof o.descTh === 'string' && o.descTh.length > 0, `${o.id} has a Thai description`); }

  // --- Fail-closed lookup ---
  eq(A.getOfferOptions('augment.map1.after_99'), null, 'unknown offer id -> null');
  eq(A.getOfferOptions(undefined), null, 'undefined offer id -> null');

  // --- Aggregation ---
  eq(A.teamMaxHpPct([{ kind: 'team_max_hp_pct', value: 8 }]), 8, 'teamMaxHpPct');
  eq(A.teamMaxHpPct([]), 0, 'teamMaxHpPct empty -> 0');
  eq(A.teamAtkSpeedPct([{ kind: 'team_atk_speed_pct', value: 10 }]), 10, 'teamAtkSpeedPct');
  const classAtk = [{ kind: 'class_atk_pct', value: 15, classLine: 'fighter' }];
  eq(A.classAtkPct(classAtk, 'fighter'), 15, 'classAtkPct match');
  eq(A.classAtkPct(classAtk, 'archer'), 0, 'classAtkPct non-match -> 0');
  eq(A.classAtkPct(classAtk, undefined), 0, 'classAtkPct undefined class (e.g. ninja) -> 0');
  const classMana = [{ kind: 'class_start_mana_pct', value: 50, classLine: 'mage' }];
  eq(A.classStartManaPct(classMana, 'mage'), 50, 'classStartManaPct match');
  eq(A.classStartManaPct(classMana, 'fighter'), 0, 'classStartManaPct non-match -> 0');

  // --- Deterministic class selection ---
  eq(A.pickClassLine({ fighter: 2, archer: 1 }), 'fighter', 'most-represented class');
  eq(A.pickClassLine({ archer: 3 }), 'archer', 'single dominant class');
  eq(A.pickClassLine({ archer: 1, mage: 1 }), 'archer', 'tie -> canonical order (archer before mage)');
  eq(A.pickClassLine({}), 'fighter', 'no owned units -> deterministic default fighter');
}

if (failures.length > 0) {
  console.error(`Augment runtime tests FAILED (${failures.length}):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exitCode = 1;
} else {
  console.log('Augment runtime tests passed: offers, aggregation, class selection, fail-closed lookup.');
}

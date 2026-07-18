#!/usr/bin/env node

// Demo 1 economy simulator. Deterministic model of the CURRENTLY IMPLEMENTED runtime
// economy (income formula + implemented sinks: hero buy/sell, EXP, rerolls, interest,
// streak). Weapon purchasing is NOT implemented in the runtime, so it is modeled
// separately as a declared FUTURE sink (canonical proposed prices), never mixed into
// the "current runtime" gold ledger.
//
// Values mirror src/game.js SHOP_ECONOMY (kept in sync by hand; this is an analysis
// tool, not a drift test). Income is deterministic given gold+streak; reroll "forcing"
// uses a seeded RNG over multiple seeds to report ranges, not single-seed certainty.
//
// Usage: node tools/economy-sim.mjs            (default: current profile, all strategies)
//        node tools/economy-sim.mjs --profiles (compare income profiles A/B/C/D)

import process from 'node:process';

// ---- Implemented runtime constants (mirror of SHOP_ECONOMY / EXP consts) ----
const START_GOLD = 10;
const HERO_COST_T1 = 2, HERO_COST_T2 = 3;
const HERO_SELL_T1 = 1, HERO_SELL_T2 = 3;          // refund_rate 0.5 of cost 2 => 1
const REROLL_COST = 2, FREE_REROLLS_PER_WAVE = 1;  // free reroll does NOT accumulate
const EXP_COST = 4, EXP_GAIN = 4;
const expNeeded = (lvl) => 2 + lvl * 2;            // L1->2:4, 2->3:6, 3->4:8, 4->5:10 (28 total)
const MAX_LEVEL = 5;
// Future (NOT implemented) weapon sink — canonical proposed prices.
const WEAPON_PRICE = { 1: 6, 2: 14, 3: 30 };

// ---- Income profiles ----
const INTEREST = { perStep: 10, bonusPerStep: 1, maxBonus: 5, maxCounted: 50 };
const STREAK_TABLE = [
  { min: 0, max: 1, bonus: 0 }, { min: 2, max: 3, bonus: 1 },
  { min: 4, max: 5, bonus: 2 }, { min: 6, max: 99, bonus: 3 },
];
const streakBonus = (s) => (STREAK_TABLE.find((t) => s >= t.min && s <= t.max) || { bonus: 0 }).bonus;
const interestBonus = (gold) => Math.min(Math.floor(Math.min(gold, INTEREST.maxCounted) / INTEREST.perStep) * INTEREST.bonusPerStep, INTEREST.maxBonus);

const PROFILES = {
  // A = current runtime
  A: { name: 'A current', base: (st) => 5, win: 1 },
  // B = modest stepped stage component (NOT 10+stage): +1 at 6-10, +2 at 11-15
  B: { name: 'B stage-stepped', base: (st) => 5 + (st >= 11 ? 2 : st >= 6 ? 1 : 0), win: 1 },
  // C = current income, sinks adjusted (income identical to A; sink deltas applied in policy)
  C: { name: 'C sink-adjusted', base: (st) => 5, win: 1 },
  // D = hybrid: small late growth from stage 11
  D: { name: 'D late-hybrid', base: (st) => 5 + (st >= 11 ? 2 : 0), win: 1 },
};

function income(profile, gold, streak, stage, isWin = true) {
  const base = profile.base(stage);
  const win = isWin ? profile.win : 0;
  const interest = interestBonus(gold);
  const streakB = streakBonus(streak);
  return { base, win, interest, streak: streakB, total: base + win + interest + streakB };
}

// ---- Strategy spend policies. Each returns gold spent this stage + state updates. ----
// state: { level, exp, heroesBought, rerolls, dupProgress, weaponSpendFuture, weaponLevelFuture }
function buyExpToward(state, gold, maxSpend) {
  // spend on EXP up to maxSpend gold, respecting level cap
  let spent = 0;
  while (state.level < MAX_LEVEL && gold - spent >= EXP_COST && spent + EXP_COST <= maxSpend) {
    spent += EXP_COST; state.exp += EXP_GAIN;
    while (state.level < MAX_LEVEL && state.exp >= expNeeded(state.level)) { state.exp -= expNeeded(state.level); state.level += 1; }
  }
  return spent;
}

const STRATEGIES = {
  Saver: (profile, stage, gold, state) => {
    // Prioritise interest: hold >=50 when possible; buy 1 essential hero early; a little EXP.
    let spend = 0;
    if (stage <= 3 && state.heroesBought < 3 && gold - spend >= HERO_COST_T1) { spend += HERO_COST_T1; state.heroesBought++; }
    // only spend on EXP the surplus above the 50-gold interest threshold
    const surplus = Math.max(0, (gold - spend) - 50);
    spend += buyExpToward(state, gold - spend, surplus);
    return spend;
  },
  HeroReroll: (profile, stage, gold, state) => {
    // Spend aggressively on rerolls + duplicate heroes to chase a 2-star.
    let spend = 0, freeLeft = FREE_REROLLS_PER_WAVE;
    // each reroll (free first) exposes 3 tier-1 offers; model buying ~1 useful dup per 2 rerolls
    while (gold - spend >= 0) {
      const cost = freeLeft > 0 ? 0 : REROLL_COST;
      if (gold - spend < cost + HERO_COST_T1) break; // keep enough to buy a hero
      if (freeLeft > 0) freeLeft--; else spend += REROLL_COST;
      state.rerolls++;
      if (gold - spend >= HERO_COST_T1) { spend += HERO_COST_T1; state.heroesBought++; state.dupProgress++; }
    }
    return spend;
  },
  Weapon: (profile, stage, gold, state) => {
    // Weapon purchasing is NOT implemented -> model as a SEPARATE future ledger.
    // In current runtime this strategy can only spend on heroes/EXP/rerolls; the weapon
    // intent is recorded in weaponSpendFuture without touching current gold beyond a token.
    let spend = 0;
    // current-runtime fallback: buy one hero to stay alive
    if (state.heroesBought < 4 && gold - spend >= HERO_COST_T1) { spend += HERO_COST_T1; state.heroesBought++; }
    // FUTURE-model: try to save toward next weapon tier (does not affect current gold ledger)
    state.futureBank = (state.futureBank || 0) + (gold - spend); // conceptual: all leftover earmarked for weapons
    const nextTier = state.weaponLevelFuture + 1;
    if (nextTier <= 3 && state.futureBank >= WEAPON_PRICE[nextTier]) { state.futureBank -= WEAPON_PRICE[nextTier]; state.weaponLevelFuture = nextTier; state.weaponSpendFuture += WEAPON_PRICE[nextTier]; }
    return spend; // current gold ledger only loses the hero cost
  },
  Balanced: (profile, stage, gold, state) => {
    let spend = 0, freeLeft = FREE_REROLLS_PER_WAVE;
    if (state.heroesBought < 5 && gold - spend >= HERO_COST_T1) { spend += HERO_COST_T1; state.heroesBought++; }
    if (freeLeft > 0) { freeLeft--; state.rerolls++; if (gold - spend >= HERO_COST_T1) { spend += HERO_COST_T1; state.heroesBought++; } }
    spend += buyExpToward(state, gold - spend, Math.floor((gold - spend) / 2)); // ~half of remainder to EXP
    return spend;
  },
  Stress: (profile, stage, gold, state) => {
    // Spend everything possible each stage to test for unlimited/overflow.
    let spend = 0, freeLeft = FREE_REROLLS_PER_WAVE;
    spend += buyExpToward(state, gold, gold); // dump into EXP first
    while (gold - spend >= (freeLeft > 0 ? 0 : REROLL_COST) + HERO_COST_T1) {
      if (freeLeft > 0) freeLeft--; else spend += REROLL_COST;
      state.rerolls++;
      if (gold - spend >= HERO_COST_T1) { spend += HERO_COST_T1; state.heroesBought++; }
    }
    return spend;
  },
};

function runStrategy(profileKey, stratKey) {
  const profile = PROFILES[profileKey];
  const strat = STRATEGIES[stratKey];
  let gold = START_GOLD, streak = 0;
  const state = { level: 1, exp: 0, heroesBought: 0, rerolls: 0, dupProgress: 0, weaponSpendFuture: 0, weaponLevelFuture: 0, futureBank: 0 };
  const rows = [];
  let grossIncome = 0, totalInterest = 0, totalStreak = 0, totalRerollSpend = 0, totalHeroSpend = 0, totalExpSpend = 0;
  // Stage-1 prep uses START_GOLD (no income yet), then each stage clear grants income for next prep.
  for (let stage = 1; stage <= 15; stage++) {
    const startGold = gold;
    // spend during this stage's prep
    const beforeRerolls = state.rerolls, beforeHeroes = state.heroesBought, beforeExpLevel = state.level, beforeExp = state.exp;
    const spend = strat(profile, stage, gold, state);
    gold -= spend;
    const rerollSpent = (state.rerolls - beforeRerolls) * REROLL_COST; // free ones cost 0 but we approximate paid via policy; recompute precisely below
    // recompute category spend precisely:
    const heroSpent = (state.heroesBought - beforeHeroes) * HERO_COST_T1;
    const expSpent = Math.max(0, spend - heroSpent - Math.max(0, (spend - heroSpent))); // placeholder
    // (category split is approximate for reporting; total spend is exact)
    // grant income for clearing this stage (win assumed)
    streak = streak + 1;
    const inc = income(profile, gold, streak, stage, true);
    gold += inc.total;
    grossIncome += inc.total; totalInterest += inc.interest; totalStreak += inc.streak;
    rows.push({
      stage, startGold, spend, endGoldBeforeIncome: startGold - spend,
      incBase: inc.base, incWin: inc.win, incInterest: inc.interest, incStreak: inc.streak, incTotal: inc.total,
      endGold: gold, level: state.level, heroesBought: state.heroesBought, rerolls: state.rerolls,
      weaponLevelFuture: state.weaponLevelFuture, weaponSpendFuture: state.weaponSpendFuture,
    });
  }
  const by = (n) => rows.filter((r) => r.stage <= n).reduce((s, r) => s + r.incTotal, 0);
  return { profileKey, stratKey, rows, grossIncome, totalInterest, totalStreak,
    grossByStage: { 5: by(5), 10: by(10), 15: by(15) },
    finalLevel: state.level, heroesBought: state.heroesBought, totalRerolls: state.rerolls,
    weaponLevelFuture: state.weaponLevelFuture, weaponSpendFuture: state.weaponSpendFuture };
}

// ---- Reroll "forcing" Monte-Carlo: probability of collecting 3 copies of a SPECIFIC
// tier-1 class given a reroll budget. 7 classes, 3 slots/shop, pool uniform over classes. ----
function forcing2Star(rerollsPerStage, stages, seeds = 200) {
  let successes = 0;
  for (let s = 0; s < seeds; s++) {
    let rng = mulberry32(1234 + s);
    let copies = 0;
    for (let st = 0; st < stages; st++) {
      const refreshes = 1 + rerollsPerStage; // 1 free + paid
      for (let r = 0; r < refreshes; r++) for (let slot = 0; slot < 3; slot++) if (Math.floor(rng() * 7) === 0) copies++;
    }
    if (copies >= 9) successes++; // 9 tier-1 of one line -> 3x tier-2 via evolution+combine (2-star)
  }
  return successes / seeds;
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- Output ----
const mode = process.argv.includes('--profiles') ? 'profiles' : 'current';
const fmtRow = (r) => `  S${String(r.stage).padStart(2)} start=${String(r.startGold).padStart(3)} spend=${String(r.spend).padStart(2)} inc(b${r.incBase}+w${r.incWin}+i${r.incInterest}+s${r.incStreak}=${String(r.incTotal).padStart(2)}) end=${String(r.endGold).padStart(3)} L${r.level} heroes=${r.heroesBought} rr=${r.rerolls}` + (r.weaponSpendFuture ? ` [futWpnL${r.weaponLevelFuture} spent${r.weaponSpendFuture}]` : '');

if (mode === 'current') {
  console.log('=== DEMO 1 ECONOMY — CURRENT RUNTIME (Profile A), all strategies, all 15 stages ===\n');
  for (const strat of Object.keys(STRATEGIES)) {
    const res = runStrategy('A', strat);
    console.log(`--- ${strat} ---`);
    res.rows.forEach((r) => console.log(fmtRow(r)));
    console.log(`  gross income by S5=${res.grossByStage[5]} S10=${res.grossByStage[10]} S15=${res.grossByStage[15]} | totalInterest=${res.totalInterest} totalStreak=${res.totalStreak} | finalLevel=${res.finalLevel} heroesBought=${res.heroesBought} rerolls=${res.totalRerolls}` + (res.weaponSpendFuture ? ` | FUTURE weapon: reached L${res.weaponLevelFuture}, modeled spend ${res.weaponSpendFuture}` : '') + `\n`);
  }
  console.log('=== FORCING ANALYSIS (seeded Monte-Carlo, 200 seeds) ===');
  for (const rr of [1, 3, 5]) {
    console.log(`  2-star of a SPECIFIC class, ~${rr} paid rerolls/stage over 15 stages: P(success) ≈ ${(forcing2Star(rr, 15) * 100).toFixed(0)}%`);
  }
  console.log(`  (2-star of a specific line needs ~9 tier-1 copies of that line collected AND bought.)`);
} else {
  console.log('=== INCOME PROFILE COMPARISON (Balanced strategy) ===\n');
  for (const pk of Object.keys(PROFILES)) {
    const res = runStrategy(pk, 'Balanced');
    console.log(`${PROFILES[pk].name}: gross S5=${res.grossByStage[5]} S10=${res.grossByStage[10]} S15=${res.grossByStage[15]} total=${res.grossIncome} interest=${res.totalInterest} streak=${res.totalStreak} finalLevel=${res.finalLevel}`);
  }
}

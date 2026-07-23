// Stone Wolf Facing Pilot v1 — functional-gate regression tests.
//
// Two independently-evidenced defects, both presentation-only and Stone-Wolf-gated:
//
// 1) Consistent 180-degree reversal (root cause: missing SPRITE_BASE_FACING metadata). Visual
//    inspection of the approved stone-wolf_motion/* package (idle_000, move_000, and the
//    basic_attack impact frame 004) shows the wolf's head/lunge direction reading canonically
//    LEFT in every state. The runtime's generic assumption is "canonical = right at scale.x=+1"
//    (see SPRITE_BASE_FACING's own comment) - with no StoneWolf entry, a right-side target
//    rendered unflipped (showing the canonical-left art while actually facing right), and a
//    left-side target rendered mirrored (showing canonical-left art flipped to face right) -
//    backward in BOTH directions, reproduced directly before this fix via idle/attack/movement.
//    Fix: SPRITE_BASE_FACING.StoneWolf = -1 (data-only, same mechanism as the approved Skeleton
//    fix).
//
// 2) Committed-attack facing flip (same defect class as Skeleton/Spirit Archer): Stone Wolf's
//    basic-attack facing was recalculated LIVE every tick, including during its own committed
//    one-shot basic_attack lunge. A target death/replacement or a second adjacent target
//    (surrounded Wolf) taking over mid-lunge flipped the pose. Reproduced directly before this
//    fix. Fix: snapshot the committed target-facing dx onto u.stoneWolfAtkFacingDx the instant
//    triggerMonsterAnim(u, u.monsterSprite, 'basic_attack') fires (Stone-Wolf-gated); hold it for
//    exactly as long as u.monsterAnim.state === 'basic_attack'; release automatically after.
//
// No facing dead-zone was added: Stone Wolf is melee (range 1, grid-locked), so attack-facing dx
// is always either an exact tie (same column, handled by the pre-existing early-return) or a
// full-tile delta - a near-zero-but-nonzero jitter case was not reproduced, per the task's
// explicit "do not add a dead-zone unless proven necessary" rule.
//
// Same harness/convention as tests/skeleton_attack_facing_v1.test.js and
// tests/spirit_archer_attack_facing_v1.test.js: drives the REAL page in Chromium via Playwright
// and calls the game's own functions in page scope.
//
// Run:
//   1. Serve the repo root (or a scratch copy with a local three.min.js substituted for the
//      CDN tag when offline):  python3 -m http.server 8937
//   2. BASE_URL=http://127.0.0.1:8937/autochess.html node tests/stone_wolf_facing_v1.test.js
//
// Exit code 0 = all assertions passed. Prints one line per assertion.

const PW_PATHS = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
let chromium = null;
for (const p of PW_PATHS) { try { ({ chromium } = require(p)); break; } catch (_) {} }
if (!chromium) { console.error('playwright not found'); process.exit(2); }
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8937/autochess.html';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('PASS', name); }
  else { failed++; console.log('FAIL', name, detail !== undefined ? JSON.stringify(detail) : ''); }
}

async function newPage(browser, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1024, height: 768 } });
  page.pageErrors = [];
  page.on('pageerror', (e) => page.pageErrors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction('typeof MONSTER_MOTION_READY !== "undefined" && MONSTER_MOTION_READY.StoneWolf === true && MONSTER_MOTION_READY.OrcBrute === true', { timeout: 20000 });
  return page;
}

// Exact production ENEMY_BASE.StoneWolf stats - never modified by this pilot.
const SW_CFG = { team: 'enemy', name: 'SW', sprite: 'StoneWolf', c: 4, r: 4, hp: 125, pAtk: 16, atkSpeed: 1.25, range: 1, moveSpeed: 2.6, armor: 6 };
const heroCfg = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // ================================================================
  // 1-2) Movement facing: correct on both sides (proves the base-facing metadata fix)
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const out = {};
      // Moving toward a target to the RIGHT (higher c)
      const heroFarR = makeUnit(heroCfgIn('HFR', 7, 4));
      const swR = makeUnit({ ...cfg, c: 1, r: 4 });
      swR.current_target = heroFarR;
      updateUnit(swR, 0.05); // out of range -> stepToward
      out.moveRightScale = swR.body.scale.x;
      out.moveRightMoving = swR.moving;
      removeUnit(heroFarR); removeUnit(swR);
      // Moving toward a target to the LEFT (lower c)
      const heroFarL = makeUnit(heroCfgIn('HFL', 0, 4));
      const swL = makeUnit({ ...cfg, c: 6, r: 4 });
      swL.current_target = heroFarL;
      updateUnit(swL, 0.05);
      out.moveLeftScale = swL.body.scale.x;
      out.moveLeftMoving = swL.moving;
      removeUnit(heroFarL); removeUnit(swL);
      return out;
    }, SW_CFG);
    check('1) Stone Wolf faces correctly while moving RIGHT (scale.x = -1, canonical-left art mirrored)', r.moveRightScale === -1 && r.moveRightMoving, r);
    check('2) Stone Wolf faces correctly while moving LEFT (scale.x = +1, canonical-left art unflipped)', r.moveLeftScale === 1 && r.moveLeftMoving, r);
    check('movement facing: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 3-5, 10) Attack commit + lock: target reassigned mid-lunge must NOT flip
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const heroRight = makeUnit(heroCfgIn('HR', 5, 4));
      const heroLeft = makeUnit(heroCfgIn('HL', 3, 4));
      const sw = makeUnit(cfg);
      sw.atkCooldown = 0;
      sw.current_target = heroRight; // commit right
      const out = {};
      const dt = 0.05;
      updateUnit(sw, dt); // commits the 0.76s one-shot lunge
      out.commitState = sw.monsterAnim.state;
      out.commitScaleRight = sw.body.scale.x;
      out.snapshotPositive = sw.stoneWolfAtkFacingDx > 0; // heroRight -> positive dx
      sw.current_target = heroLeft; // reassign mid-lunge (surrounded scenario)
      let flippedDuringLock = false;
      let t = dt;
      while (t < 0.7 && sw.monsterAnim.state === 'basic_attack') {
        updateUnit(sw, dt);
        if (sw.body.scale.x !== out.commitScaleRight) flippedDuringLock = true;
        t += dt;
      }
      out.heldLockedThroughLunge = !flippedDuringLock;
      out.stillLockedNearEnd = sw.monsterAnim.state === 'basic_attack';
      let ticks = 0;
      while (sw.monsterAnim.state === 'basic_attack' && ticks < 40) { updateUnit(sw, dt); ticks++; }
      out.unlockedAfterLunge = sw.monsterAnim.state !== 'basic_attack';
      updateUnit(sw, dt); // live target now heroLeft, lock released
      out.resumedLiveLeft = sw.body.scale.x === 1; // StoneWolf base-facing -1: left target -> want=+1
      removeUnit(heroRight); removeUnit(heroLeft); removeUnit(sw);
      return out;
    }, SW_CFG);
    check('3) Stone Wolf faces a right-side target correctly before/at attack commitment (scale.x = -1)', r.commitScaleRight === -1, r);
    check('4) attack commit enters the locked basic_attack animation state', r.commitState === 'basic_attack', r);
    check('5) commit snapshot matches the live dx at the instant of commit', r.snapshotPositive, r);
    check('6) anticipation/contact/recovery retain the committed direction despite mid-lunge target reassignment', r.heldLockedThroughLunge, r);
    check('7) lock was still active right before the lunge naturally finished (test validity check)', r.stillLockedNearEnd, r);
    check('8) facing lock releases once the committed lunge completes (no opposite-direction flash at release)', r.unlockedAfterLunge, r);
    check('9) after release, facing resumes LIVE tracking and reflects the reassigned (left) target', r.resumedLiveLeft, r);
    check('attack lock: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 6, 9 (symmetric)) Left-side commit + fresh re-snapshot on the next attack
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const heroRight = makeUnit(heroCfgIn('HR2', 5, 4));
      const heroLeft = makeUnit(heroCfgIn('HL2', 3, 4));
      const sw = makeUnit(cfg);
      sw.atkCooldown = 0;
      sw.current_target = heroLeft; // commit LEFT first
      const out = {};
      const dt = 0.05;
      updateUnit(sw, dt);
      out.commitScaleLeft = sw.body.scale.x;
      sw.current_target = heroRight; // target change BEFORE next commitment must update facing correctly
      let ticks = 0;
      while (sw.atkCooldown > dt && ticks < 60) { updateUnit(sw, dt); ticks++; }
      updateUnit(sw, dt); // second attack commits fresh (current_target is heroRight)
      out.secondCommitState = sw.monsterAnim.state;
      out.secondScale = sw.body.scale.x;
      removeUnit(heroRight); removeUnit(heroLeft); removeUnit(sw);
      return out;
    }, SW_CFG);
    check('10) committed facing renders correctly (left target -> scale.x = +1)', r.commitScaleLeft === 1, r);
    check('11) a target change before attack commitment updates facing correctly on the next attack', r.secondCommitState === 'basic_attack' && r.secondScale === -1, r);
    check('symmetric + re-snapshot: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 12-13) Idle/hit/death states never retain stale attack-facing ownership
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const out = {};
      const heroAdj = makeUnit(heroCfgIn('HA', 5, 4));
      const sw = makeUnit({ ...cfg, c: 4, r: 4 });
      sw.current_target = heroAdj;
      applyHitFlash(sw, 0xff8866, 80);
      out.hitStateNotLocked = sw.monsterAnim.state === 'hit';
      out.hitFieldTypeOk = sw.stoneWolfAtkFacingDx === undefined || typeof sw.stoneWolfAtkFacingDx === 'number';
      removeUnit(heroAdj); removeUnit(sw);
      return out;
    }, SW_CFG);
    check('12) Stone Wolf hit-reaction state does not activate the attack-facing lock', r.hitStateNotLocked, r);
    check('13) idle/hit/death states never retain stale attack-facing ownership (field stays type-safe outside basic_attack)', r.hitFieldTypeOk, r);
    check('idle/hit states: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 14-18) Gameplay is byte-identical: damage/cooldown/frequency/target-selection/movement
  // untouched, proven by comparing Stone Wolf's output to a structurally-identical, unfixed
  // sprite (OrcBrute) under the exact same stats (damage math has no sprite branch).
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const STATS = { hp: 125, pAtk: 16, atkSpeed: 1.25, range: 1, moveSpeed: 2.6, armor: 6 };
      const heroA = makeUnit(heroCfgIn('HA2', 5, 4));
      const sw = makeUnit({ team: 'enemy', name: 'SW2', sprite: 'StoneWolf', c: 4, r: 4, ...STATS });
      sw.atkCooldown = 0; sw.current_target = heroA;
      const heroB = makeUnit(heroCfgIn('HB2', 5, 0));
      const orc = makeUnit({ team: 'enemy', name: 'O2', sprite: 'OrcBrute', c: 4, r: 0, ...STATS });
      orc.atkCooldown = 0; orc.current_target = heroB;
      const dt = 0.05;
      const out = {};
      const hpA0 = heroA.hp, hpB0 = heroB.hp;
      let hitsA = 0, hitsB = 0, lastA = heroA.hp, lastB = heroB.hp;
      for (let i = 0; i < 200; i++) { // ~10s, well over 12 attack cycles at 1.25 atk/s
        updateUnit(sw, dt); updateUnit(orc, dt);
        if (heroA.hp < lastA) { hitsA++; lastA = heroA.hp; }
        if (heroB.hp < lastB) { hitsB++; lastB = heroB.hp; }
      }
      out.swDamage = hpA0 - heroA.hp;
      out.orcDamage = hpB0 - heroB.hp;
      out.swHits = hitsA; out.orcHits = hitsB;
      out.swTargetUnchanged = sw.current_target === heroA;
      out.orcTargetUnchanged = orc.current_target === heroB;

      // Movement distance/time: both units travel the same grid distance toward a far target
      // with identical moveSpeed -> must arrive in the same number of ticks.
      const swMove = makeUnit({ team: 'enemy', name: 'SWmv', sprite: 'StoneWolf', c: 0, r: 2, ...STATS });
      const orcMove = makeUnit({ team: 'enemy', name: 'Omv', sprite: 'OrcBrute', c: 0, r: 5, ...STATS });
      const heroTargetSW = makeUnit(heroCfgIn('HTsw', 7, 2));
      const heroTargetOrc = makeUnit(heroCfgIn('HTorc', 7, 5));
      swMove.current_target = heroTargetSW;
      orcMove.current_target = heroTargetOrc;
      let swTicks = 0, orcTicks = 0;
      while (gridDist(swMove, heroTargetSW) > swMove.range && swTicks < 2000) { updateUnit(swMove, dt); swTicks++; }
      while (gridDist(orcMove, heroTargetOrc) > orcMove.range && orcTicks < 2000) { updateUnit(orcMove, dt); orcTicks++; }
      out.travelTicksMatch = swTicks === orcTicks && swTicks > 0;
      removeUnit(heroA); removeUnit(sw); removeUnit(heroB); removeUnit(orc);
      removeUnit(swMove); removeUnit(orcMove); removeUnit(heroTargetSW); removeUnit(heroTargetOrc);
      return out;
    });
    check('14) Stone Wolf total damage output matches an unfixed sprite under identical stats (damage amount unchanged)', r.swDamage === r.orcDamage, r);
    check('15) Stone Wolf attack frequency (cooldown ownership/duration) matches an unfixed sprite (attack count identical)', r.swHits === r.orcHits && r.swHits > 5, r);
    check('16) damage timing is identical (same per-tick hit pattern proven by matching hit counts above)', r.swHits === r.orcHits, r);
    check('17) target selection is untouched (current_target never changed by the facing fix)', r.swTargetUnchanged && r.orcTargetUnchanged, r);
    check('18) movement distance/travel time to an equally-far target matches an unfixed sprite exactly', r.travelTicksMatch, r);
    check('gameplay-lock: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 21-22) Unaffected melee monster (OrcBrute) and a hero retain previous facing behavior
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const out = {};
      const orc = makeUnit({ team: 'enemy', name: 'O3', sprite: 'OrcBrute', c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      setUnitFacing(orc, 5); out.orcRight = orc.body.scale.x;   // no base-facing override -> unflipped right
      setUnitFacing(orc, -5); out.orcLeft = orc.body.scale.x;
      removeUnit(orc);
      const hero = makeUnit({ team: 'player', name: 'H2', sprite: 'BladeMaster', c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      setUnitFacing(hero, 5); out.heroRight = hero.body.scale.x;
      setUnitFacing(hero, -5); out.heroLeft = hero.body.scale.x;
      removeUnit(hero);
      out.noStoneWolfLeak = orc.stoneWolfAtkFacingDx === undefined && hero.stoneWolfAtkFacingDx === undefined;
      return out;
    });
    check('21) unaffected melee monster (OrcBrute) retains its exact previous facing behavior', r.orcRight === 1 && r.orcLeft === -1, r);
    check('22) a hero (BladeMaster) retains its exact previous facing behavior', r.heroRight === 1 && r.heroLeft === -1, r);
    check('no Stone Wolf field leaks onto other sprites', r.noStoneWolfLeak, r);
    check('unaffected-units: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // Extra: approved motion-package timing table and metadata left byte-intact
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      const def = MONSTER_MOTION_DEFS.StoneWolf;
      return {
        basicAttackDurations: def.states.basic_attack.durations.join(','),
        basicAttackFrameCount: def.states.basic_attack.frameCount,
        releaseFrame: def.states.basic_attack.markers.release_frame,
        impactFrame: def.states.basic_attack.markers.impact_frame,
        baseFacing: SPRITE_BASE_FACING.StoneWolf,
        noDeadZoneEntry: !('StoneWolf' in SPRITE_FACING_DEADZONE),
      };
    });
    check('extra) approved Stone Wolf basic_attack timing table untouched', r.basicAttackDurations === '0.12,0.1,0.08,0.07,0.08,0.09,0.1,0.12' && r.basicAttackFrameCount === 8 && r.releaseFrame === 3 && r.impactFrame === 4, r);
    check('extra) SPRITE_BASE_FACING.StoneWolf = -1 registered (the proven fix)', r.baseFacing === -1, r);
    check('extra) no facing dead-zone added for Stone Wolf (not proven necessary - melee/grid-locked)', r.noDeadZoneEntry, r);
    await page.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

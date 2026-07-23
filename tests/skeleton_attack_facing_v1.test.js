// Skeleton Motion Feel Pilot v1 (facing follow-up) — functional-gate regression tests.
//
// Defect (found during this pilot's investigation, same class already fixed for Spirit Archer
// in PR #99): Skeleton's basic-attack facing was recalculated LIVE every tick from
// u.current_target, even during the ticks where its own committed one-shot basic_attack pose
// (the 0.72s presentation retiming from the original Skeleton Motion Feel Pilot v1) was already
// playing. If the target died and was replaced, or simply moved to the opposite horizontal side
// mid-swing (e.g. a surrounded Skeleton with two adjacent melee-range targets), the sprite's
// facing flipped mid-pose — the swing visibly pointed away from the target it was actually
// hitting.
//
// Fix (presentation-only, Skeleton-gated):
//   1. At the exact tick triggerSkeletonAnim(u, 'basic_attack') fires, snapshot the committed
//      target-facing dx onto u.skeletonAtkFacingDx.
//   2. The facing call at the bottom of the Basic Attack block uses that snapshot instead of a
//      live recalculation for exactly as long as u.skelAnim.state === 'basic_attack'.
//   3. Every other sprite/state (including Skeleton's own idle/move/hit states) falls through to
//      the exact original live setUnitFacing(u, dx) call, unchanged.
//
// Same harness/convention as tests/skeleton_motion_feel_v1.test.js and
// tests/spirit_archer_attack_facing_v1.test.js: drives the REAL page in Chromium via Playwright
// and calls the game's own functions in page scope.
//
// Run:
//   1. Serve the repo root (or a scratch copy with a local three.min.js substituted for the
//      CDN tag when offline):  python3 -m http.server 8937
//   2. BASE_URL=http://127.0.0.1:8937/autochess.html node tests/skeleton_attack_facing_v1.test.js
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
  await page.waitForFunction('typeof SKELETON_MOTION_READY !== "undefined" && SKELETON_MOTION_READY === true', { timeout: 20000 });
  return page;
}

// Exact production ENEMY_BASE.Skeleton stats — never modified by this pilot.
const SK_CFG = { team: 'enemy', name: 'Sk', sprite: 'Skeleton', c: 4, r: 4, hp: 110, pAtk: 13, atkSpeed: 1.0, range: 1, moveSpeed: 1.8, armor: 5 };
const heroCfg = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // ================================================================
  // 1) Commit + lock: target reassigned mid-swing (a "surrounded" scenario) must NOT flip
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const heroRight = makeUnit(heroCfgIn('HR', 5, 4));
      const heroLeft = makeUnit(heroCfgIn('HL', 3, 4));
      const sk = makeUnit(cfg);
      sk.atkCooldown = 0;
      sk.current_target = heroRight; // commit right
      const out = {};
      const dt = 0.05;
      updateUnit(sk, dt); // commits the 0.72s one-shot swing
      out.commitState = sk.skelAnim.state;
      out.commitScale = sk.body.scale.x;
      out.snapshotMatchesLiveAtCommit = sk.skeletonAtkFacingDx > 0; // heroRight -> positive dx
      sk.current_target = heroLeft; // reassign mid-swing (surrounded: both adjacent, opposite sides)
      let flipped = false, t = dt;
      while (t < 0.65 && sk.skelAnim.state === 'basic_attack') {
        updateUnit(sk, dt);
        if (sk.body.scale.x !== out.commitScale) flipped = true;
        t += dt;
      }
      out.heldLockedThroughSwing = !flipped;
      out.stillLockedNearEnd = sk.skelAnim.state === 'basic_attack';
      let ticks = 0;
      while (sk.skelAnim.state === 'basic_attack' && ticks < 40) { updateUnit(sk, dt); ticks++; }
      out.unlockedAfterSwing = sk.skelAnim.state !== 'basic_attack';
      updateUnit(sk, dt); // live target now heroLeft, lock released
      out.resumedLiveLeft = sk.body.scale.x === 1; // SPRITE_BASE_FACING.Skeleton=-1: left target -> want=+1
      removeUnit(heroRight); removeUnit(heroLeft); removeUnit(sk);
      return out;
    }, SK_CFG);
    check('1) attack commit enters the locked basic_attack animation state', r.commitState === 'basic_attack', r);
    check('2) commit snapshot matches the live dx at the instant of commit', r.snapshotMatchesLiveAtCommit, r);
    check('3) committed facing renders correctly (right target, Skeleton base-facing -1 -> scale.x = -1)', r.commitScale === -1, r);
    check('4) facing HOLDS the committed pose through the whole swing despite mid-animation reassignment', r.heldLockedThroughSwing, r);
    check('5) lock was still active right before the swing naturally finished (test validity check)', r.stillLockedNearEnd, r);
    check('6) lock releases once the committed swing completes', r.unlockedAfterSwing, r);
    check('7) after release, facing resumes LIVE tracking and reflects the reassigned (left) target', r.resumedLiveLeft, r);
    check('facing lock: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 8-10) Symmetric case + fresh re-snapshot on the next attack
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const heroRight = makeUnit(heroCfgIn('HR2', 5, 4));
      const heroLeft = makeUnit(heroCfgIn('HL2', 3, 4));
      const sk = makeUnit(cfg);
      sk.atkCooldown = 0;
      sk.current_target = heroLeft; // commit LEFT first
      const out = {};
      const dt = 0.05;
      updateUnit(sk, dt);
      out.commitScaleLeft = sk.body.scale.x;
      sk.current_target = heroRight; // reassign to the opposite side mid-swing
      let flipped = false, t = dt;
      while (t < 0.65 && sk.skelAnim.state === 'basic_attack') {
        updateUnit(sk, dt);
        if (sk.body.scale.x !== out.commitScaleLeft) flipped = true;
        t += dt;
      }
      out.heldLockedLeftThroughSwing = !flipped;
      // run out the rest of the one-shot + cooldown, then attack again (opposite target) — must re-snapshot fresh
      let ticks = 0;
      while (sk.atkCooldown > dt && ticks < 60) { updateUnit(sk, dt); ticks++; }
      updateUnit(sk, dt); // second attack commits (current_target is heroRight)
      out.secondCommitState = sk.skelAnim.state;
      out.secondScale = sk.body.scale.x;
      removeUnit(heroRight); removeUnit(heroLeft); removeUnit(sk);
      return out;
    }, SK_CFG);
    check('8) committed facing renders correctly (left target -> scale.x = +1)', r.commitScaleLeft === 1, r);
    check('9) symmetric case: facing HOLDS the committed left pose despite mid-animation reassignment to the right', r.heldLockedLeftThroughSwing, r);
    check('10) second attack (fresh commit, opposite target) re-snapshots and renders facing right', r.secondCommitState === 'basic_attack' && r.secondScale === -1, r);
    check('symmetric + re-snapshot: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 11-12) Non-attack states never activate the lock; non-Skeleton sprites unaffected
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const out = {};
      // 11) Hit-reaction state: applyHitFlash triggers 'hit', not 'basic_attack' -> lock inactive.
      const heroAdj = makeUnit(heroCfgIn('HA', 5, 4));
      const sk = makeUnit({ ...cfg, c: 4, r: 4 });
      sk.current_target = heroAdj;
      applyHitFlash(sk, 0xff8866, 80);
      out.hitStateNotLocked = sk.skelAnim.state === 'hit';
      // 12) OrcBrute (a different Remaining-Five sprite, not Skeleton) never receives the
      // Skeleton snapshot field and keeps its exact prior live-recalculation behavior even under
      // the identical reassignment trigger.
      const orcTargetR = makeUnit(heroCfgIn('OTR', 7, 0));
      const orcTargetL = makeUnit(heroCfgIn('OTL', 1, 0));
      const orc = makeUnit({ team: 'enemy', name: 'O', sprite: 'OrcBrute', c: 4, r: 0, hp: 200, pAtk: 20, atkSpeed: 1, range: 4, moveSpeed: 1.6, armor: 5 });
      orc.atkCooldown = 0; orc.current_target = orcTargetR;
      updateUnit(orc, 0.05);
      const orcScaleAfterCommit = orc.body.scale.x;
      orc.current_target = orcTargetL;
      updateUnit(orc, 0.05);
      out.orcNoSkeletonField = orc.skeletonAtkFacingDx === undefined;
      out.orcStillLiveRecalc = orc.body.scale.x !== orcScaleAfterCommit;
      removeUnit(heroAdj); removeUnit(sk); removeUnit(orcTargetR); removeUnit(orcTargetL); removeUnit(orc);
      return out;
    }, SK_CFG);
    check('11) Skeleton hit-reaction state does not activate the attack-facing lock', r.hitStateNotLocked, r);
    check('12) non-Skeleton sprites (OrcBrute) never receive the snapshot field and keep exact prior live-recalculation behavior', r.orcNoSkeletonField && r.orcStillLiveRecalc, r);
    check('unaffected-states: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 13-14) Gameplay is byte-identical: damage/cooldown/frequency/target-selection untouched,
  // proven by comparing Skeleton's output to a structurally-identical, unfixed OrcBrute under
  // the exact same stats (damage math has no sprite-specific branch in src/game.js).
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const heroCfgIn = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const STATS = { hp: 110, pAtk: 13, atkSpeed: 1.0, range: 1, moveSpeed: 1.8, armor: 5 };
      const heroA = makeUnit(heroCfgIn('HA2', 5, 4));
      const sk = makeUnit({ team: 'enemy', name: 'Sk2', sprite: 'Skeleton', c: 4, r: 4, ...STATS });
      sk.atkCooldown = 0; sk.current_target = heroA;
      const heroB = makeUnit(heroCfgIn('HB2', 5, 0));
      const orc = makeUnit({ team: 'enemy', name: 'O2', sprite: 'OrcBrute', c: 4, r: 0, ...STATS });
      orc.atkCooldown = 0; orc.current_target = heroB;
      const dt = 0.05;
      const out = {};
      const hpA0 = heroA.hp, hpB0 = heroB.hp;
      let hitsA = 0, hitsB = 0, lastA = heroA.hp, lastB = heroB.hp;
      for (let i = 0; i < 200; i++) { // ~10s, well over 9 attack cycles at 1.0 atk/s
        updateUnit(sk, dt); updateUnit(orc, dt);
        if (heroA.hp < lastA) { hitsA++; lastA = heroA.hp; }
        if (heroB.hp < lastB) { hitsB++; lastB = heroB.hp; }
      }
      out.skDamage = hpA0 - heroA.hp;
      out.orcDamage = hpB0 - heroB.hp;
      out.skHits = hitsA; out.orcHits = hitsB;
      out.skTargetUnchanged = sk.current_target === heroA;
      out.orcTargetUnchanged = orc.current_target === heroB;
      removeUnit(heroA); removeUnit(sk); removeUnit(heroB); removeUnit(orc);
      return out;
    });
    check('13) Skeleton total damage output and attack frequency exactly match an unfixed sprite under identical stats (presentation-only proof)', r.skDamage === r.orcDamage && r.skHits === r.orcHits && r.skHits > 5, r);
    check('14) target selection is untouched (current_target never changed by the facing fix)', r.skTargetUnchanged && r.orcTargetUnchanged, r);
    check('gameplay-lock: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // Extra: approved presentation/timing tables and base-facing entry left untouched
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => ({
      attackDurations: SKELETON_FEEL.attackDurations.join(','),
      hitDurations: SKELETON_FEEL.hitDurations.join(','),
      baseFacing: SPRITE_BASE_FACING.Skeleton,
      deadzone: SPRITE_FACING_DEADZONE.Skeleton,
    }));
    check('extra) approved Skeleton attack/hit presentation timing untouched', r.attackDurations === '0.05,0.04,0.03,0.03,0.1,0.09,0.1,0.13,0.15' && r.hitDurations === '0.06,0.07,0.08,0.1', r);
    check('extra) SPRITE_BASE_FACING.Skeleton and dead-zone (from the original pilot) unchanged', r.baseFacing === -1 && r.deadzone === 0.05, r);
    await page.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

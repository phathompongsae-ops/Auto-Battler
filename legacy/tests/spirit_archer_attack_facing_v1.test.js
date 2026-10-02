// Spirit Archer Attack Facing Pilot v1 — functional-gate regression tests.
//
// Defect: Spirit Archer's basic-attack facing was recalculated LIVE every tick from
// u.current_target, even during the ticks where its own committed one-shot basic_attack pose
// (anticipation/release/recovery, 0.90s total) was already playing. If the target died and was
// replaced, or simply moved to the opposite horizontal side, mid-animation, the sprite's facing
// flipped mid-pose — reading as "not looking at" or "shooting away from" the unit it was
// attacking, exactly as reported.
//
// Fix (presentation-only, SpiritArcher-gated):
//   1. At the exact tick triggerMonsterAnim(u, u.monsterSprite, 'basic_attack') fires, snapshot
//      the committed target-facing dx onto u.spiritArcherAtkFacingDx.
//   2. The facing call at the bottom of the Basic Attack block uses that snapshot instead of a
//      live recalculation for exactly as long as u.monsterAnim.state === 'basic_attack'.
//   3. Every other sprite/state (including SpiritArcher's own idle/move/hit states) falls
//      through to the exact original live setUnitFacing(u, dx) call, unchanged.
//
// Same harness/convention as tests/skeleton_motion_feel_v1.test.js: drives the REAL page in
// Chromium via Playwright and calls the game's own functions in page scope. No mocking of
// game logic; all assertions run against the actual runtime.
//
// Run:
//   1. Serve the repo root (or a scratch copy with a local three.min.js substituted for the
//      CDN tag when offline):  python3 -m http.server 8937
//   2. BASE_URL=http://127.0.0.1:8937/autochess.html node tests/spirit_archer_attack_facing_v1.test.js
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
  await page.waitForFunction('typeof SKELETON_MOTION_READY !== "undefined" && MONSTER_MOTION_READY.SpiritArcher === true', { timeout: 20000 });
  return page;
}

// Exact production ENEMY_BASE.SpiritArcher stats — never modified by this pilot.
const SA_CFG = { team: 'enemy', name: 'SA', sprite: 'SpiritArcher', c: 4, r: 4, hp: 90, pAtk: 18, atkSpeed: 1.05, range: 4, moveSpeed: 1.7, armor: 2 };

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // ================================================================
  // 1-4) Attack-facing commit + lock: target reassigned mid-animation must NOT flip the pose
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfg = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const heroRight = makeUnit(heroCfg('HR', 7, 4));
      const heroLeft = makeUnit(heroCfg('HL', 1, 4));
      const sa = makeUnit(cfg);
      sa.atkCooldown = 0;
      sa.current_target = heroRight; // commit towards the RIGHT side first
      const out = {};
      const dt = 0.05;
      updateUnit(sa, dt); // attack tick #1 -> commits facing right
      out.commitState = sa.monsterAnim.state;
      out.commitScaleRight = sa.body.scale.x;
      out.commitSnapshotPositive = sa.spiritArcherAtkFacingDx > 0;
      // Mid-animation (well before the 0.90s one-shot completes): reassign the live target to the
      // OPPOSITE side, simulating the reported defect trigger (target death+replacement, or the
      // same target relocating) while the committed pose is still on screen.
      sa.current_target = heroLeft;
      let flippedDuringLock = false;
      let t = dt;
      while (t < 0.85 && sa.monsterAnim.state === 'basic_attack') {
        updateUnit(sa, dt);
        if (sa.body.scale.x !== out.commitScaleRight) flippedDuringLock = true;
        t += dt;
      }
      out.heldLockedRightThroughAnim = !flippedDuringLock;
      out.stillLockedNearEnd = sa.monsterAnim.state === 'basic_attack';
      // Cross past the 0.90s one-shot end -> lock releases -> facing must now reflect the live
      // (reassigned) target, which is on the LEFT.
      let ticks = 0;
      while (sa.monsterAnim.state === 'basic_attack' && ticks < 40) { updateUnit(sa, dt); ticks++; }
      out.unlockedAfterAnim = sa.monsterAnim.state !== 'basic_attack';
      updateUnit(sa, dt); // one more tick with live target on the left, lock already released
      out.facingResumedLiveLeft = sa.body.scale.x === -1; // default SPRITE_BASE_FACING multiplier (no SpiritArcher entry) -> left = -1
      removeUnit(heroRight); removeUnit(heroLeft); removeUnit(sa);
      return out;
    }, SA_CFG);
    check('1) attack commit enters the locked basic_attack animation state', r.commitState === 'basic_attack', r);
    check('2) attack commit snapshots a positive (rightward) dx for a right-side target', r.commitSnapshotPositive, r);
    check('3) committed facing renders correctly (right target -> scale.x = +1)', r.commitScaleRight === 1, r);
    check('4) facing HOLDS the committed pose through the whole one-shot even after target reassignment mid-animation', r.heldLockedRightThroughAnim, r);
    check('5) lock was still active right before the one-shot naturally finished (test validity check)', r.stillLockedNearEnd, r);
    check('6) lock releases once the one-shot basic_attack animation completes', r.unlockedAfterAnim, r);
    check('7) after release, facing resumes LIVE tracking and reflects the reassigned (left) target', r.facingResumedLiveLeft, r);
    check('facing lock: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 8-10) Symmetric case: commit LEFT, live target moves RIGHT mid-animation, must stay locked left
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfg = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const heroRight = makeUnit(heroCfg('HR2', 7, 4));
      const heroLeft = makeUnit(heroCfg('HL2', 1, 4));
      const sa = makeUnit(cfg);
      sa.atkCooldown = 0;
      sa.current_target = heroLeft; // commit towards the LEFT side first
      const out = {};
      const dt = 0.05;
      updateUnit(sa, dt);
      out.commitSnapshotNegative = sa.spiritArcherAtkFacingDx < 0;
      out.commitScaleLeft = sa.body.scale.x;
      sa.current_target = heroRight; // reassign to the opposite side mid-animation
      let flipped = false, t = dt;
      while (t < 0.85 && sa.monsterAnim.state === 'basic_attack') {
        updateUnit(sa, dt);
        if (sa.body.scale.x !== out.commitScaleLeft) flipped = true;
        t += dt;
      }
      out.heldLockedLeftThroughAnim = !flipped;
      removeUnit(heroRight); removeUnit(heroLeft); removeUnit(sa);
      return out;
    }, SA_CFG);
    check('8) attack commit snapshots a negative (leftward) dx for a left-side target', r.commitSnapshotNegative, r);
    check('9) committed facing renders correctly (left target -> scale.x = -1)', r.commitScaleLeft === -1, r);
    check('10) symmetric case: facing HOLDS the committed left pose despite mid-animation reassignment to the right', r.heldLockedLeftThroughAnim, r);
    check('symmetric lock: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 11-13) Consecutive attacks each get a fresh, correct snapshot (no stale carry-over)
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfg = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const heroRight = makeUnit(heroCfg('HR3', 7, 4));
      const heroLeft = makeUnit(heroCfg('HL3', 1, 4));
      const sa = makeUnit(cfg);
      sa.atkCooldown = 0;
      sa.current_target = heroRight;
      const dt = 0.05;
      const out = {};
      updateUnit(sa, dt); // attack #1: commit right
      out.firstScale = sa.body.scale.x;
      // run out the rest of the one-shot + wait for cooldown, then switch target before attack #2 commits
      let ticks = 0;
      while (sa.atkCooldown > dt && ticks < 60) { updateUnit(sa, dt); ticks++; }
      sa.current_target = heroLeft; // by the time attack #2 fires, target is on the opposite side
      updateUnit(sa, dt); // attack #2 should commit: cooldown reaches <=0 this tick
      out.secondCommitState = sa.monsterAnim.state;
      out.secondScale = sa.body.scale.x;
      out.secondSnapshotFresh = sa.spiritArcherAtkFacingDx < 0;
      removeUnit(heroRight); removeUnit(heroLeft); removeUnit(sa);
      return out;
    }, SA_CFG);
    check('11) first attack commits facing right', r.firstScale === 1, r);
    check('12) second attack (fresh commit, opposite target) re-snapshots correctly (fresh dx, not stale)', r.secondSnapshotFresh, r);
    check('13) second attack renders facing left, matching its own fresh commit', r.secondCommitState === 'basic_attack' && r.secondScale === -1, r);
    check('consecutive attacks: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 14-16) Non-attack states and non-SpiritArcher sprites are completely unaffected
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const heroCfg = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      // 14) Movement facing for SpiritArcher: monsterAnim.state is 'move', never 'basic_attack',
      // so the lock condition is false and setUnitFacing gets the live dx exactly as before.
      const heroFar = makeUnit(heroCfg('HF', 0, 4));
      const sa = makeUnit({ ...cfg, c: 7, r: 4 });
      const out = {};
      updateUnit(sa, 0.05); // out of range -> stepToward (movement), not attack
      out.moveNotLocked = !(sa.monsterAnim && sa.monsterAnim.state === 'basic_attack');
      out.moveFacingLive = sa.body.scale.x === -1; // moving towards lower c (leftward) -> want = -1
      // 15) Hit-reaction state: applyHitFlash triggers 'hit', not 'basic_attack' -> lock inactive.
      applyHitFlash(sa, 0xff8866, 80);
      out.hitStateNotLocked = sa.monsterAnim.state === 'hit';
      out.hitFieldUntouched = sa.spiritArcherAtkFacingDx === undefined || typeof sa.spiritArcherAtkFacingDx === 'number';
      // 16) Non-SpiritArcher sprite (OrcBrute) never gets the snapshot field and keeps exact
      // previous live-recalculation behavior every tick, even mid one-shot basic_attack.
      const orcTargetR = makeUnit(heroCfg('OTR', 7, 0));
      const orcTargetL = makeUnit(heroCfg('OTL', 1, 0));
      const orc = makeUnit({ team: 'enemy', name: 'O', sprite: 'OrcBrute', c: 4, r: 0, hp: 200, pAtk: 20, atkSpeed: 1, range: 4, moveSpeed: 1.6, armor: 5 });
      orc.atkCooldown = 0; orc.current_target = orcTargetR;
      updateUnit(orc, 0.05);
      const orcScaleAfterCommit = orc.body.scale.x;
      orc.current_target = orcTargetL; // reassign mid-animation, exactly the trigger scenario
      updateUnit(orc, 0.05);
      out.orcNoSnapshotField = orc.spiritArcherAtkFacingDx === undefined;
      out.orcStillLiveRecalcMidAnim = orc.body.scale.x !== orcScaleAfterCommit; // OrcBrute is NOT fixed -> flips (pre-existing behavior preserved exactly)
      removeUnit(heroFar); removeUnit(sa); removeUnit(orcTargetR); removeUnit(orcTargetL); removeUnit(orc);
      return out;
    }, SA_CFG);
    check('14) SpiritArcher movement facing is untouched by the attack-facing lock', r.moveNotLocked && r.moveFacingLive, r);
    check('15) SpiritArcher hit-reaction state does not activate the attack-facing lock', r.hitStateNotLocked, r);
    check('15b) snapshot field type-safe (number or undefined) outside basic_attack', r.hitFieldUntouched, r);
    check('16) non-SpiritArcher sprites (OrcBrute) never receive the snapshot field and keep exact prior live-recalculation behavior', r.orcNoSnapshotField && r.orcStillLiveRecalcMidAnim, r);
    check('unaffected-states: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 17-18) Dead-zone still guards the LIVE (unlocked, between-shot) tracking window
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const sa = makeUnit(cfg);
      const out = {};
      setUnitFacing(sa, 5); out.right = sa.body.scale.x;
      setUnitFacing(sa, -5); out.left = sa.body.scale.x;
      let flips = 0, last = sa.body.scale.x;
      for (let i = 0; i < 20; i++) { // alternating sub-dead-zone dx must never flip (live tracking window)
        setUnitFacing(sa, (i % 2 ? 0.02 : -0.02));
        if (sa.body.scale.x !== last) { flips++; last = sa.body.scale.x; }
      }
      out.nearZeroFlips = flips;
      setUnitFacing(sa, 1); out.tileDeltaStillWorks = sa.body.scale.x;
      removeUnit(sa);
      return out;
    }, SA_CFG);
    check('17) SpiritArcher live-tracking dead-zone: 20 alternating near-zero dx -> zero flips', r.nearZeroFlips === 0, r);
    check('18) SpiritArcher live-tracking whole-tile deltas still flip normally', r.tileDeltaStillWorks === 1 && r.right === 1 && r.left === -1, r);
    check('dead-zone: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 19-20) Gameplay is byte-identical: damage/cooldown/frequency/target-selection untouched,
  // proven by comparing SpiritArcher's output to a structurally-identical, unfixed OrcBrute
  // under the exact same stats (damage math has no sprite-specific branch in src/game.js).
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const heroCfg = (name, c, r) => ({ team: 'player', name, sprite: 'BladeMaster', c, r, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const STATS = { hp: 90, pAtk: 18, atkSpeed: 1.05, range: 4, moveSpeed: 1.7, armor: 2 };
      const heroA = makeUnit(heroCfg('HA', 0, 4));
      const sa = makeUnit({ team: 'enemy', name: 'SA2', sprite: 'SpiritArcher', c: 4, r: 4, ...STATS });
      sa.atkCooldown = 0; sa.current_target = heroA;
      const heroB = makeUnit(heroCfg('HB', 0, 0));
      const orc = makeUnit({ team: 'enemy', name: 'O2', sprite: 'OrcBrute', c: 4, r: 0, ...STATS });
      orc.atkCooldown = 0; orc.current_target = heroB;
      const dt = 0.05;
      const out = {};
      const hpA0 = heroA.hp, hpB0 = heroB.hp;
      let hitsA = 0, hitsB = 0, lastA = heroA.hp, lastB = heroB.hp;
      for (let i = 0; i < 200; i++) { // ~10s, well over 10 attack cycles at 1.05 atk/s
        updateUnit(sa, dt); updateUnit(orc, dt);
        if (heroA.hp < lastA) { hitsA++; lastA = heroA.hp; }
        if (heroB.hp < lastB) { hitsB++; lastB = heroB.hp; }
      }
      out.saDamage = hpA0 - heroA.hp;
      out.orcDamage = hpB0 - heroB.hp;
      out.saHits = hitsA; out.orcHits = hitsB;
      out.saTargetUnchanged = sa.current_target === heroA;
      out.orcTargetUnchanged = orc.current_target === heroB;
      removeUnit(heroA); removeUnit(sa); removeUnit(heroB); removeUnit(orc);
      return out;
    });
    check('19) SpiritArcher total damage output and attack frequency exactly match an unfixed sprite under identical stats (presentation-only proof)', r.saDamage === r.orcDamage && r.saHits === r.orcHits && r.saHits > 5, r);
    check('20) target selection is untouched (current_target never changed by the facing fix)', r.saTargetUnchanged && r.orcTargetUnchanged, r);
    check('gameplay-lock: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // Extra: approved motion-package timing table left byte-intact (record, not modified)
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      const def = MONSTER_MOTION_DEFS.SpiritArcher;
      return {
        basicAttackDurations: def.states.basic_attack.durations.join(','),
        basicAttackFrameCount: def.states.basic_attack.frameCount,
        releaseFrame: def.states.basic_attack.markers.release_frame,
        noBaseFacingEntry: !('SpiritArcher' in SPRITE_BASE_FACING),
      };
    });
    check('extra) approved SpiritArcher basic_attack timing table untouched', r.basicAttackDurations === '0.13,0.11,0.1,0.09,0.08,0.07,0.08,0.11,0.13' && r.basicAttackFrameCount === 9 && r.releaseFrame === 5, r);
    check('extra) SpiritArcher still has no SPRITE_BASE_FACING override (canonical right-facing art, unchanged)', r.noBaseFacingEntry, r);
    await page.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

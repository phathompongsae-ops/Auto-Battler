// Skeleton Motion Feel Pilot v1 — functional-gate regression tests.
//
// Covers the pilot's presentation-only tuning layer (held idle + subtle bottom-anchored
// breathing, distance-synced walk playback, stop settle, facing dead-zone, attack/hit
// presentation retiming) AND proves the gameplay-owned contracts did NOT move: damage timing,
// cooldown ownership, attack output, facing correctness, and non-Skeleton animation behavior.
//
// Same harness/convention as tests/live_qa_six_fixes.test.js / tests/android_qa_hotfix_v1.test.js:
// drives the REAL page in Chromium via Playwright and calls the game's own functions in page
// scope. All Skeleton frame textures are the real approved package files served from disk.
//
// Run:
//   1. Serve the repo root (or a scratch copy with a local three.min.js substituted for the
//      CDN tag when offline):  python3 -m http.server 8937
//   2. BASE_URL=http://127.0.0.1:8937/autochess.html node tests/skeleton_motion_feel_v1.test.js
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
  // the pilot's held-idle / walk-sync paths only exist once the motion frames are loaded
  // bare identifiers: game.js is a classic script, so its top-level let/const never attach to window
  await page.waitForFunction('typeof SKELETON_MOTION_READY !== "undefined" && SKELETON_MOTION_READY === true && MONSTER_MOTION_READY.OrcBrute === true', { timeout: 20000 });
  return page;
}

const SK_CFG = { team: 'enemy', name: 'Sk', sprite: 'Skeleton', c: 3, r: 3, hp: 110, pAtk: 13, atkSpeed: 1.0, range: 1, moveSpeed: 1.8, armor: 5 };

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // ================================================================
  // 1) Idle stability — held frame, no walk frames, no position/offset/foot/shadow drift
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const sk = makeUnit(cfg); // no player units exist -> selectTarget() is null -> real idle path
      const out = { everWalkFrame: false, everNonIdle0: false, posDrift: 0, bodyXMax: 0 };
      const start = { x: sk.group.position.x, y: sk.group.position.y, z: sk.group.position.z };
      const sh0 = { x: sk.shadow.position.x, y: sk.shadow.position.y, z: sk.shadow.position.z, s: sk.shadow.scale.x };
      const moveTex = new Set(SKELETON_TEXTURES.move);
      let footMin = Infinity, footMax = -Infinity, sMin = Infinity, sMax = -Infinity;
      const dt = 1 / 60;
      for (let i = 0; i < 240; i++) { // 4s of idle
        updateUnit(sk, dt);
        if (moveTex.has(sk.body.material.map)) out.everWalkFrame = true;
        if (sk.body.material.map !== SKELETON_TEXTURES.idle[0]) out.everNonIdle0 = true;
        out.posDrift = Math.max(out.posDrift, Math.hypot(sk.group.position.x - start.x, sk.group.position.y - start.y, sk.group.position.z - start.z));
        out.bodyXMax = Math.max(out.bodyXMax, Math.abs(sk.body.position.x));
        const foot = sk.body.position.y - sk.halfH * sk.body.scale.y; // plane bottom = drawn feet line
        footMin = Math.min(footMin, foot); footMax = Math.max(footMax, foot);
        sMin = Math.min(sMin, sk.body.scale.y); sMax = Math.max(sMax, sk.body.scale.y);
      }
      out.footSpread = footMax - footMin;
      out.scaleRange = [sMin, sMax];
      out.breathAlive = (sMax - sMin) > 0.003; // breathing exists...
      out.breathSubtle = sMin >= 1 - 0.0125 && sMax <= 1 + 0.0125; // ...and stays barely visible
      out.frameIdx = sk.skelAnim.frameIdx;
      out.shadowStable = sk.shadow.position.x === sh0.x && sk.shadow.position.y === sh0.y && sk.shadow.position.z === sh0.z && sk.shadow.scale.x === sh0.s;
      removeUnit(sk);
      return out;
    }, SK_CFG);
    check('idle: walk frames never advance while stationary', !r.everWalkFrame, r);
    check('idle: held neutral frame (idle[0]) the whole time', !r.everNonIdle0 && r.frameIdx === 0, r);
    check('idle: world position unchanged (0 drift)', r.posDrift === 0, r);
    check('idle: no sprite x-offset accumulates', r.bodyXMax === 0, r);
    check('idle: foot anchor stable within 1e-6 world units', r.footSpread < 1e-6, r);
    check('idle: breathing present but subtle (<=1.25% scale)', r.breathAlive && r.breathSubtle, r);
    check('idle: shadow position/scale rock-stable', r.shadowStable, r);
    check('idle: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 2) Walk sync + stop — distance-driven playback, full cycle, no per-step restart, no drift
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const hero = makeUnit({ team: 'player', name: 'H', sprite: 'BladeMaster', c: 0, r: 5, hp: 5000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const sk = makeUnit({ ...cfg, c: 7, r: 5 });
      const out = { framesSeen: new Set(), idleFlashDuringTravel: 0, phaseVsDistanceErr: 0, zeroDtAdvance: false };
      const dt = 1 / 60;
      let D = 0, lastPos = { x: sk.group.position.x, z: sk.group.position.z };
      let ticks = 0;
      while (gridDist(sk, hero) > 1 && ticks < 3000) {
        ticks++;
        const wasMoving = sk.moving;
        updateUnit(sk, dt);
        if (wasMoving || sk.moving) {
          const px = sk.group.position.x, pz = sk.group.position.z;
          D += Math.hypot(px - lastPos.x, pz - lastPos.z);
          lastPos = { x: px, z: pz };
          if (sk.moving) {
            out.framesSeen.add(sk.skelAnim.frameIdx);
            out.phaseVsDistanceErr = Math.max(out.phaseVsDistanceErr, Math.abs(sk.skelAnim.movePhase - (D % 1)));
          }
          if (sk.skelAnim.shownState === 'idle') out.idleFlashDuringTravel++;
        } else {
          lastPos = { x: sk.group.position.x, z: sk.group.position.z };
        }
        // dt=0 mid-journey: playback must not advance without movement
        if (ticks === 60 && sk.moving) {
          const f0 = sk.skelAnim.movePhase;
          updateUnit(sk, 0);
          if (sk.skelAnim.movePhase !== f0) out.zeroDtAdvance = true;
        }
      }
      out.arrived = gridDist(sk, hero) <= 1;
      out.frameCount = out.framesSeen.size;
      out.sawLateFrames = out.framesSeen.has(6) && out.framesSeen.has(7); // pre-pilot restarts capped the cycle at frame ~5
      // let it settle into idle (kill the hero so no attack fires), then check exact stop position
      removeUnit(hero);
      sk.current_target = null;
      for (let i = 0; i < 30; i++) updateUnit(sk, dt); // > stopSettleSec
      const tile = gridToWorld(sk.c, sk.r);
      out.settledToIdle = sk.skelAnim.state === 'idle' && sk.body.material.map === SKELETON_TEXTURES.idle[0];
      out.stopErr = Math.hypot(sk.group.position.x - tile.x, sk.group.position.z - tile.z);
      for (let i = 0; i < 120; i++) updateUnit(sk, dt); // 2 more idle seconds
      out.stopErrLater = Math.hypot(sk.group.position.x - tile.x, sk.group.position.z - tile.z);
      removeUnit(sk);
      return { ...out, framesSeen: [...out.framesSeen] };
    }, SK_CFG);
    check('walk: skeleton actually traveled and arrived', r.arrived, r);
    check('walk: full 8-frame cycle plays (incl. frames 6+7 the old per-step restart never reached)', r.frameCount === 8 && r.sawLateFrames, r);
    check('walk: playback phase tracks actual world distance (err < 1e-6)', r.phaseVsDistanceErr < 1e-6, r);
    check('walk: no idle flash between path steps', r.idleFlashDuringTravel === 0, r);
    check('walk: zero movement -> zero playback advance', !r.zeroDtAdvance, r);
    check('stop: settles onto held idle after settle window', r.settledToIdle, r);
    check('stop: lands exactly on the gameplay tile (no overshoot)', r.stopErr < 1e-9, r);
    check('stop: no drift afterwards', r.stopErrLater < 1e-9, r);
    check('walk: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 3) Facing — approved fix preserved, dead-zone kills near-zero flip jitter, others untouched
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const sk = makeUnit(cfg);
      const orc = makeUnit({ team: 'enemy', name: 'O', sprite: 'OrcBrute', c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      const out = {};
      setUnitFacing(sk, 5); out.right = sk.body.scale.x;        // rightward -> flipped (-1) per approved fix
      setUnitFacing(sk, -5); out.left = sk.body.scale.x;        // leftward -> unflipped (+1)
      setUnitFacing(sk, 0); out.tieKeeps = sk.body.scale.x;
      let flips = 0, last = sk.body.scale.x;
      for (let i = 0; i < 20; i++) { // alternating sub-dead-zone dx must never flip
        setUnitFacing(sk, (i % 2 ? 0.02 : -0.02));
        if (sk.body.scale.x !== last) { flips++; last = sk.body.scale.x; }
      }
      out.nearZeroFlips = flips;
      setUnitFacing(sk, 1); out.tileDeltaStillWorks = sk.body.scale.x; // movement passes ±1 — unaffected by dead-zone
      setUnitFacing(orc, -5); setUnitFacing(orc, 0.01); out.orcTinyDxFlips = orc.body.scale.x; // non-Skeleton keeps EXACT old behavior (no dead-zone)
      removeUnit(sk); removeUnit(orc);
      return out;
    }, SK_CFG);
    check('facing: walking/attacking right renders flipped (approved fix intact)', r.right === -1, r);
    check('facing: walking/attacking left renders unflipped (approved fix intact)', r.left === 1, r);
    check('facing: exact tie preserves last facing', r.tieKeeps === 1, r);
    check('facing: 20 alternating near-zero dx -> zero flips (dead-zone)', r.nearZeroFlips === 0, r);
    check('facing: whole-tile movement deltas unaffected by dead-zone', r.tileDeltaStillWorks === -1, r);
    check('facing: non-Skeleton units keep exact previous behavior (0.01 still flips)', r.orcTinyDxFlips === 1, r);
    check('facing: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 4) Attack — damage timing, cooldown ownership, and output identical; presentation retimed only
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const hero = makeUnit({ team: 'player', name: 'H', sprite: 'BladeMaster', c: 3, r: 3, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
      const sk = makeUnit({ ...cfg, c: 4, r: 3 });
      sk.atkCooldown = 0;
      const out = {};
      const dt = 0.05;
      const hp0 = hero.hp;
      updateUnit(sk, dt); // attack tick
      out.damageSameTickAsTrigger = (hp0 - hero.hp) === 13 && sk.skelAnim.state === 'basic_attack'; // 13 raw vs 0 def -> exactly 13
      out.cooldownOwnedByAttackBlock = sk.atkCooldown === 1.0; // 1/atkSpeed, set in the same untouched gameplay block
      // deterministic frequency over 4.95s: attacks at t=0,1,2,3,4 -> exactly 5 hp drops
      let hits = 1, lastHp = hero.hp, walkFrameWhileStationary = false;
      const moveTex = new Set(SKELETON_TEXTURES.move);
      for (let i = 1; i < 99; i++) {
        updateUnit(sk, dt);
        if (hero.hp < lastHp) { hits++; lastHp = hero.hp; }
        if (!sk.moving && moveTex.has(sk.body.material.map)) walkFrameWhileStationary = true;
      }
      out.attackCount = hits;
      out.noWalkFrameFlash = !walkFrameWhileStationary;
      out.totalDamage = hp0 - hero.hp;
      // presentation-layer facts (visual only)
      const pres = SKELETON_PRESENT_SEQ.basic_attack.durations;
      out.presTotal = pres.reduce((a, b) => a + b, 0);
      out.presFitsCooldown = out.presTotal < 1.0;
      out.contactFrameAt = pres[0] + pres[1] + pres[2] + pres[3]; // when frame 4 (contact) first shows
      out.contactIdxCheck = skeletonFrameIndexForTime(SKELETON_PRESENT_SEQ.basic_attack, out.contactFrameAt + 0.001) === 4;
      // approved package timing record untouched
      const pkg = SKELETON_ANIM_DEF.basic_attack;
      out.packageTableIntact = pkg.durations.join(',') === '0.14,0.12,0.1,0.06,0.08,0.08,0.08,0.12,0.12' && pkg.markers && pkg.markers.impact_frame === 4;
      out.idleAfterRecovery = sk.skelAnim.shownState === 'idle' || sk.skelAnim.state === 'basic_attack';
      removeUnit(hero); removeUnit(sk);
      return out;
    }, SK_CFG);
    check('attack: damage applies on the trigger tick (timing unchanged)', r.damageSameTickAsTrigger, r);
    check('attack: cooldown still set to 1/atkSpeed by the gameplay block (ownership unchanged)', r.cooldownOwnedByAttackBlock, r);
    check('attack: exactly 5 attacks in 4.95s at 1.0 atk/s (frequency unchanged)', r.attackCount === 5, r);
    check('attack: total damage output unchanged (5 x 13)', r.totalDamage === 65, r);
    check('attack: presentation total 0.72s fits inside the 1.0s cooldown', Math.abs(r.presTotal - 0.72) < 1e-9 && r.presFitsCooldown, r);
    check('attack: visual contact frame lands 0.15s after the damage event (was 0.42s)', Math.abs(r.contactFrameAt - 0.15) < 1e-9 && r.contactIdxCheck, r);
    check('attack: recovery returns to held idle with no walk-frame flash', r.noWalkFrameFlash && r.idleAfterRecovery, r);
    check('attack: approved package timing table left intact as record', r.packageTableIntact, r);
    check('attack: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 5) Hit reaction — visual-only, brief, returns cleanly, alters no gameplay state
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate((cfg) => {
      phase = 'battle'; paused = false;
      const hero = makeUnit({ team: 'player', name: 'H', sprite: 'BladeMaster', c: 3, r: 3, hp: 4000, pAtk: 10, atkSpeed: 1, range: 1, moveSpeed: 0, armor: 0 });
      const sk = makeUnit({ ...cfg, c: 4, r: 3, hp: 600 });
      hero.atkCooldown = 0; sk.atkCooldown = 0.4; sk.current_target = hero;
      const skHp0 = sk.hp, skCd0 = sk.atkCooldown;
      const out = {};
      updateUnit(hero, 0.01); // hero strikes: 10 raw vs armor 5 -> 9.5
      out.hpDropExact = Math.abs((skHp0 - sk.hp) - 9.5) < 1e-9;
      out.hitStateEntered = sk.skelAnim.state === 'hit';
      out.scaleCleanDuringHit = sk.body.scale.y === 1;
      out.cooldownUntouchedByHit = sk.atkCooldown === skCd0; // being hit never touches the victim's cooldown
      out.targetUntouched = sk.current_target === hero;
      const hitTotal = SKELETON_PRESENT_SEQ.hit.durations.reduce((a, b) => a + b, 0);
      out.hitTotal = hitTotal; // 0.31s brief recoil
      let t = 0;
      while (t < hitTotal + 0.1) { updateUnit(sk, 1 / 60); t += 1 / 60; if (sk.skelAnim.state === 'basic_attack') break; }
      out.noStateLock = sk.skelAnim.state !== 'hit';
      window.__feelSk = sk; window.__feelHero = hero; // lunge reset is a 90ms real-time setTimeout — check after it fires
      return out;
    }, SK_CFG);
    await page.waitForTimeout(200);
    r.bodyOffsetClean = await page.evaluate(() => {
      const clean = window.__feelSk.body.position.x === 0;
      removeUnit(window.__feelHero); removeUnit(window.__feelSk);
      delete window.__feelSk; delete window.__feelHero;
      return clean;
    });
    check('hit: damage math unchanged (10 raw vs 5% armor -> 9.5)', r.hpDropExact, r);
    check('hit: reaction is immediate (state enters hit on the damage tick)', r.hitStateEntered, r);
    check('hit: idle breathing residue cleared on interrupt', r.scaleCleanDuringHit, r);
    check('hit: victim cooldown/targeting untouched by the reaction', r.cooldownUntouchedByHit && r.targetUntouched, r);
    check('hit: brief (0.31s) and exits cleanly - no state lock, no residual offset', Math.abs(r.hitTotal - 0.31) < 1e-9 && r.noStateLock && r.bodyOffsetClean, r);
    check('hit: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 6) Non-Skeleton units — animation behavior byte-identical in spirit: untouched code paths
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const out = {};
      // OrcBrute (shared five-monster runtime): stationary idle still CYCLES its frames as before
      const orc = makeUnit({ team: 'enemy', name: 'O', sprite: 'OrcBrute', c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      const orcFrames = new Set();
      for (let i = 0; i < 90; i++) { updateUnit(orc, 1 / 60); orcFrames.add(orc.monsterAnim.frameIdx); }
      out.orcIdleStillCycles = orcFrames.size > 1;
      removeUnit(orc);
      // Hero sheet animation (WALK_SEQ wall-clock path): unchanged
      const hero = makeUnit({ team: 'player', name: 'H', sprite: 'BladeMaster', c: 2, r: 5, hp: 100, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 0 });
      hero.moving = true; hero.moveT = 0.2; hero.moveFrom = { c: 2, r: 5 }; hero.moveTo = { c: 3, r: 5 };
      const heroWalkFrames = new Set();
      for (let i = 0; i < 30; i++) { updateAnim(hero, 1 / 60); heroWalkFrames.add(hero.animFrame); }
      out.heroWalkCycles = heroWalkFrames.size > 1 && [...heroWalkFrames].every((f) => [1, 2, 3, 4].includes(f));
      hero.moving = false;
      updateAnim(hero, 1 / 60);
      out.heroIdleFrame0 = hero.animFrame === 0;
      removeUnit(hero);
      return out;
    });
    check('non-skeleton: OrcBrute idle animation still cycles exactly as before', r.orcIdleStillCycles, r);
    check('non-skeleton: hero WALK_SEQ wall-clock cycle unchanged', r.heroWalkCycles, r);
    check('non-skeleton: hero idle frame 0 unchanged', r.heroIdleFrame0, r);
    check('non-skeleton: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // 7) x1 / x4 full-lifecycle scenario (idle -> chase -> turn -> stop -> attack -> hit -> idle
  //    -> death), repeated 3x per speed to catch state leakage
  // ================================================================
  for (const mul of [1, 4]) {
    const page = await newPage(browser);
    const r = await page.evaluate(({ cfg, mul }) => {
      phase = 'battle'; paused = false;
      const dt = 0.05 * mul; // matches animate()'s real-time cap x speed multiplier
      const out = { rounds: [], pageIssues: [] };
      for (let round = 0; round < 3; round++) {
        const R = {};
        const sk = makeUnit({ ...cfg, c: 6, r: 2, hp: 600 });
        // A) pure idle 1s
        let bad = 0;
        for (let t = 0; t < 1; t += dt) { updateUnit(sk, dt); if (sk.body.material.map !== SKELETON_TEXTURES.idle[0]) bad++; }
        R.idleHeld = bad === 0;
        // B) chase left, then flip target to the right -> direction change
        let hero = makeUnit({ team: 'player', name: 'HL', sprite: 'BladeMaster', c: 0, r: 2, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
        let flips = 0, lastScale = sk.body.scale.x, guard = 0;
        while (sk.c > 3 && guard++ < 2000) { updateUnit(sk, dt); if (sk.body.scale.x !== lastScale) { flips++; lastScale = sk.body.scale.x; } }
        removeUnit(hero); sk.current_target = null;
        hero = makeUnit({ team: 'player', name: 'HR', sprite: 'BladeMaster', c: 7, r: 2, hp: 4000, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 0 });
        guard = 0;
        while (gridDist(sk, hero) > 1 && guard++ < 2000) { updateUnit(sk, dt); if (sk.body.scale.x !== lastScale) { flips++; lastScale = sk.body.scale.x; } }
        R.arrived = gridDist(sk, hero) <= 1;
        R.facingFlips = flips; // one flip left, one flip right expected; jitter would inflate this
        R.facingCorrectAtArrival = sk.body.scale.x === (hero.group.position.x > sk.group.position.x ? -1 : 1);
        // C) attacks: 3 hits at exactly 1.0s game-time apart
        sk.atkCooldown = 0;
        let hp = hero.hp, hits = 0, tGame = 0; const hitTimes = [];
        while (hits < 3 && tGame < 5) { updateUnit(sk, dt); tGame += dt; if (hero.hp < hp) { hits++; hitTimes.push(tGame); hp = hero.hp; } }
        R.attacks = hits;
        R.attackSpacingOk = hitTimes.length === 3 && Math.abs((hitTimes[2] - hitTimes[1]) - 1.0) < dt + 1e-9;
        // D) hero hits skeleton 3x -> reaction plays, no lock
        hero.pAtk = 20; hero.atkSpeed = 1; hero.atkCooldown = 0; hero.current_target = sk;
        for (let t = 0; t < 2.5; t += dt) { updateUnit(hero, dt); updateUnit(sk, dt); }
        R.aliveAfterPokes = sk.alive;
        R.noHitLock = sk.skelAnim.state !== 'hit' || sk.skelAnim.timer < 0.4;
        // E) settle back to idle then die
        hero.pAtk = 0;
        for (let t = 0; t < 1.2; t += dt) { updateUnit(sk, dt); updateUnit(hero, dt); }
        R.scaleClean = Math.abs(sk.body.scale.y - 1) <= 0.0125;
        hero.pAtk = 5000; hero.atkCooldown = 0;
        updateUnit(hero, dt);
        R.deathTriggered = !sk.alive && sk.skelAnim.state === 'death';
        let deathSteps = 0;
        while (!sk.skelAnim.deathDone && deathSteps++ < 200) advanceSkeletonDeathAnim(sk, dt);
        R.deathCompletes = sk.skelAnim.deathDone === true;
        removeUnit(hero); removeUnit(sk);
        out.rounds.push(R);
      }
      out.allIdleHeld = out.rounds.every((x) => x.idleHeld);
      out.allArrived = out.rounds.every((x) => x.arrived);
      out.allFacingSane = out.rounds.every((x) => x.facingFlips <= 3 && x.facingCorrectAtArrival);
      out.allAttacksOk = out.rounds.every((x) => x.attacks === 3 && x.attackSpacingOk);
      out.allNoLock = out.rounds.every((x) => x.aliveAfterPokes && x.noHitLock);
      out.allDeathsOk = out.rounds.every((x) => x.deathTriggered && x.deathCompletes);
      out.allScaleClean = out.rounds.every((x) => x.scaleClean);
      return out;
    }, { cfg: SK_CFG, mul });
    check(`x${mul}: idle held stable across all rounds`, r.allIdleHeld, r.rounds);
    check(`x${mul}: chase completes both directions across all rounds`, r.allArrived, r.rounds);
    check(`x${mul}: facing correct with no flip jitter (<=3 flips per round)`, r.allFacingSane, r.rounds);
    check(`x${mul}: 3 attacks per round at unchanged 1.0s spacing`, r.allAttacksOk, r.rounds);
    check(`x${mul}: hit reactions never lock the state machine`, r.allNoLock, r.rounds);
    check(`x${mul}: death triggers and completes normally`, r.allDeathsOk, r.rounds);
    check(`x${mul}: no breathing-scale residue across rounds (state leakage)`, r.allScaleClean, r.rounds);
    check(`x${mul}: no page errors`, page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

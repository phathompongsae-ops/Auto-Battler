// Live Gameplay QA — Six Confirmed Fixes v1: focused regression tests.
//
// This repository has no packaged test runner; combat/UI logic lives in a classic browser
// script (src/game.js), so these tests drive the REAL page in Chromium via Playwright and
// call the game's own functions in page scope (the established validation convention for
// this project — see docs/LIVE_QA_SIX_FIXES_V1.md).
//
// Run:
//   1. Serve the repo root (or a scratch copy with a local three.min.js substituted for the
//      CDN tag when offline):  python3 -m http.server 8937
//   2. BASE_URL=http://127.0.0.1:8937/autochess.html node tests/live_qa_six_fixes.test.js
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1024, height: 768 } });
  page.pageErrors = [];
  page.on('pageerror', (e) => page.pageErrors.push(e.message));
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // ---------- Fix 1: transparent motion planes + untinted restore ----------
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const out = {};
      for (const m of ['Slime', 'OrcBrute', 'StoneWolf', 'SpiritArcher', 'Golem', 'Skeleton']) {
        const u = makeUnit({ team: 'enemy', name: 'T' + m, sprite: m, c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
        out[m] = {
          plane: u.body.geometry.type === 'PlaneGeometry',
          transparent: u.body.material.transparent === true,
          hasMap: !!u.body.material.map,
        };
        removeUnit(u);
      }
      // hit-flash restore on a textured monster must be WHITE, not placeholder tint
      const s = makeUnit({ team: 'enemy', name: 'Tint', sprite: 'Slime', c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      s.body.material.color.set(0xff8866);
      restoreBodyColor(s);
      out.restoredWhite = s.body.material.color.getHex() === 0xffffff;
      removeUnit(s);
      // box fallback must remain when motion is not ready (placeholderColor passed exactly
      // as fillerWave() passes it from ENEMY_BASE)
      const saved = MONSTER_MOTION_READY.Slime;
      MONSTER_MOTION_READY.Slime = false;
      const fb = makeUnit({ team: 'enemy', name: 'FB', sprite: 'Slime', c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5, placeholderColor: 0x6fcf5a });
      out.fallbackBox = fb.body.geometry.type === 'BoxGeometry';
      out.fallbackTint = fb.body.material.color.getHex() === 0x6fcf5a;
      removeUnit(fb);
      MONSTER_MOTION_READY.Slime = saved;
      return out;
    });
    for (const m of ['Slime', 'OrcBrute', 'StoneWolf', 'SpiritArcher', 'Golem', 'Skeleton']) {
      check(`fix1 ${m} renders as transparent textured plane`, r[m].plane && r[m].transparent && r[m].hasMap, r[m]);
    }
    check('fix1 hit-flash restore is white on textured body', r.restoredWhite);
    check('fix1 box fallback (with tint) kept when motion not ready', r.fallbackBox && r.fallbackTint);
    check('fix1 no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ---------- Fix 2: facing contract ----------
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const u = makeUnit({ team: 'enemy', name: 'F', sprite: 'Skeleton', c: 3, r: 3, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      const out = {};
      setUnitFacing(u, -5); out.left = u.body.scale.x;
      setUnitFacing(u, 0); out.tieKeeps = u.body.scale.x;      // tie must PRESERVE, not force +1
      setUnitFacing(u, 5); out.right = u.body.scale.x;
      SPRITE_BASE_FACING.Skeleton = -1;                         // per-sprite canonical facing multiplier
      setUnitFacing(u, 5); out.baseFlipped = u.body.scale.x;
      delete SPRITE_BASE_FACING.Skeleton;
      removeUnit(u);
      return out;
    });
    check('fix2 faces left on negative dirX', r.left === -1, r);
    check('fix2 horizontal tie preserves last facing', r.tieKeeps === -1, r);
    check('fix2 faces right on positive dirX', r.right === 1, r);
    check('fix2 per-sprite base facing multiplier applies', r.baseFlipped === -1, r);
    await page.close();
  }

  // ---------- Fix 3: item shop ----------
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      const out = {};
      phase = 'shop';
      itemShopOffers = ['item_sword', 'item_greatsword'];
      out.baseCost = itemShopCost('item_sword');
      out.combinedCost = itemShopCost('item_greatsword');
      // insufficient gold
      gold = 3;
      out.rejectPoor = buyShopItem(0) === false && gold === 3 && playerState.inventory.itemInstanceIds.length === 0;
      // successful purchase: exactly one deduction, one unique instance in inventory
      gold = 20;
      out.buyOk = buyShopItem(0) === true;
      out.goldAfter = gold; // 20 - 6 = 14
      out.oneInstance = playerState.inventory.itemInstanceIds.length === 1;
      const instId = playerState.inventory.itemInstanceIds[0];
      out.instanceUnique = new Set(Object.keys(playerState.itemInstances)).size === 1;
      // reroll must not consume or duplicate the owned instance
      pickItemShopOffers();
      out.rerollKeepsInstance = playerState.inventory.itemInstanceIds.length === 1
        && playerState.inventory.itemInstanceIds[0] === instId
        && Object.keys(playerState.itemInstances).length === 1;
      // full inventory rejection (no deduction)
      itemShopOffers = ['item_staff'];
      const savedCap = playerState.inventory.capacity;
      playerState.inventory.capacity = 1;
      const goldBefore = gold;
      out.rejectFull = buyShopItem(0) === false && gold === goldBefore;
      playerState.inventory.capacity = savedCap;
      // equip -> combat stats -> unequip via the EXISTING pipeline
      buyHero(shopOffers.findIndex((k) => gold >= HERO_DEFS[k].cost));
      const hero = benchHeroes[0];
      const placedHero = moveUnitTo(hero, 3, 5);
      out.equipOk = equipItem(placedHero, instId, 0) === true;
      out.inventoryEmptied = playerState.inventory.itemInstanceIds.length === 0;
      buildCombatStats(placedHero, ITEM_DEFS_BY_ID);
      out.statApplied = placedHero.combatStats.p_atk === placedHero.baseStats.p_atk + 15; // item_sword +15
      out.unequipOk = unequipItem(placedHero, 0) === true && playerState.inventory.itemInstanceIds.length === 1;
      return out;
    });
    check('fix3 base/combined pricing 6/14', r.baseCost === 6 && r.combinedCost === 14, r);
    check('fix3 insufficient gold rejected without deduction', r.rejectPoor);
    check('fix3 purchase deducts exactly once', r.buyOk && r.goldAfter === 14, r);
    check('fix3 one unique instance created', r.oneInstance && r.instanceUnique);
    check('fix3 reroll keeps owned instance (no dup/loss)', r.rerollKeepsInstance);
    check('fix3 full inventory rejected without deduction', r.rejectFull);
    check('fix3 equip via existing flow', r.equipOk && r.inventoryEmptied);
    check('fix3 combat stats fold item in', r.statApplied, r);
    check('fix3 unequip returns to inventory', r.unequipOk);
    check('fix3 no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ---------- Fix 4: mitigation formula ----------
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      const heroTarget = { combatStats: null, pDef: 30, mDef: 15 }; // flat-stat hero shape
      const out = {};
      out.slimeVsFighter = mitigateDamage(9, { attackType: 'physical' }, heroTarget);   // was 0
      out.golemVsFighter = mitigateDamage(24, { attackType: 'physical' }, heroTarget);  // was 0
      out.magicPath = mitigateDamage(20, { attackType: 'magic' }, heroTarget);          // uses mDef 15
      out.armorPath = mitigateDamage(100, { attackType: 'physical' }, { armor: 20 });   // enemy % path preserved
      out.zeroFloor = mitigateDamage(1, { attackType: 'physical' }, { combatStats: null, pDef: 999, mDef: 0 });
      return out;
    });
    check('fix4 slime 9 atk vs 30 def deals ~6.9 (non-zero)', Math.abs(r.slimeVsFighter - 9 * 100 / 130) < 1e-9, r);
    check('fix4 golem 24 atk vs 30 def deals ~18.5 (non-zero)', Math.abs(r.golemVsFighter - 24 * 100 / 130) < 1e-9, r);
    check('fix4 magic uses m_def', Math.abs(r.magicPath - 20 * 100 / 115) < 1e-9, r);
    check('fix4 enemy armor % path unchanged', r.armorPath === 80, r);
    check('fix4 no positive attack hits zero', r.zeroFloor > 0, r);
    await page.close();
  }

  // ---------- Fix 5: staging / retargeting ----------
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const out = {};
      const mk = (name, sprite, team, c, r2) => makeUnit({ team, name, sprite, c, r: r2, hp: 500, pAtk: 0, atkSpeed: 0.1, range: 1, moveSpeed: 2, armor: 5 });
      // boss with all four adjacent tiles occupied by allies; a fifth melee unit far away
      const boss = mk('Boss', 'Golem', 'enemy', 3, 2);
      const blockers = [mk('B1', 'BladeMaster', 'player', 2, 2), mk('B2', 'BladeMaster', 'player', 4, 2),
                        mk('B3', 'BladeMaster', 'player', 3, 1), mk('B4', 'BladeMaster', 'player', 3, 3)];
      const far = mk('Far', 'BladeMaster', 'player', 0, 5);
      out.attackRingFull = findMeleeApproachTile(far, boss) === null;
      const staging = findMeleeStagingTile(far, boss);
      out.stagingFound = !!staging && (Math.abs(staging.c - 3) + Math.abs(staging.r - 2) === 2) && !occupied.has(key(staging.c, staging.r));
      // ring opens after a blocker dies -> attack tile becomes available again
      blockers[0].alive = false; removeUnit(blockers[0]);
      const opened = findMeleeApproachTile(far, boss);
      out.advanceWhenOpen = !!opened && opened.c === 2 && opened.r === 2;
      // boss at board edge: staging ring must stay in bounds
      const edgeBoss = mk('Edge', 'Golem', 'enemy', 0, 0);
      const st2 = findMeleeStagingTile(far, edgeBoss);
      out.edgeSafe = !st2 || (st2.c >= 0 && st2.r >= 0 && st2.r !== BENCH_ROW);
      // unreachable current target + reachable other enemy -> findBestReachableEnemy picks the other
      const reachable = mk('Reach', 'Skeleton', 'enemy', 6, 5);
      units.filter((u) => u.name && ['B2','B3','B4'].includes(u.name)).forEach(() => {}); // blockers still box the boss partly
      const best = findBestReachableEnemy(far);
      out.retargetFindsReachable = !!best;
      return out;
    });
    check('fix5 full attack ring returns null (pre-fix hold state)', r.attackRingFull);
    check('fix5 staging tile found on ring-2, free + in bounds', r.stagingFound, r);
    check('fix5 attack tile reclaimed after blocker death', r.advanceWhenOpen, r);
    check('fix5 edge boss staging stays in bounds', r.edgeSafe);
    check('fix5 reachable-enemy retarget finds a target', r.retargetFindsReachable);
    check('fix5 no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ---------- Fix 6: drag target alignment across viewports ----------
  for (const vp of [{ width: 360, height: 800 }, { width: 800, height: 360 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    const page = await newPage(browser, vp);
    const r = await page.evaluate(async (vpw) => {
      const out = {};
      // buy + keep on bench, then drag bench -> field with touch pointer events
      buyHero(shopOffers.findIndex((k) => gold >= HERO_DEFS[k].cost));
      const u = benchHeroes[0];
      if (!u) return { skip: 'no hero affordable' };
      // screen positions: tiles project at ground level (y=0); a unit projects at its body's
      // ACTUAL world position (the billboarded body is offset along the camera's up axis, so
      // "tile center + 0.5" does not land on the plane under a steep camera).
      const rect = renderer.domElement.getBoundingClientRect();
      const ndcToScreen = (v) => ({ x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height });
      const tileScreen = (c, r2) => ndcToScreen(gridToWorld(c, r2).project(camera));
      const unitScreen = (unit) => { unit.group.updateMatrixWorld(true); const wp = new THREE.Vector3(); unit.body.getWorldPosition(wp); return ndcToScreen(wp.project(camera)); };
      const from = unitScreen(u);
      const destTile = { c: 4, r: 5 };
      const dest = tileScreen(destTile.c, destTile.r);
      const fire = (type, x, y) => {
        const ev = new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', bubbles: true });
        (type === 'pointerdown' ? renderer.domElement : document).dispatchEvent(ev);
      };
      fire('pointerdown', from.x, from.y);
      fire('pointermove', from.x + 10, from.y - 10);
      // aim so that the SHARED target point (clientY - GHOST_Y_OFFSET) lands on the dest tile
      fire('pointermove', dest.x, dest.y + GHOST_Y_OFFSET);
      const highlighted = unitDrag && unitDrag.hoverTile ? { ...unitDrag.hoverTile } : null;
      // ghost feet anchored at the shared point: style.top equals dest.y (translate -100% lifts the img above it)
      const ghostTopMatches = unitDrag && unitDrag.ghostEl ? Math.abs(parseFloat(unitDrag.ghostEl.style.top) - dest.y) < 1 : false;
      fire('pointerup', dest.x, dest.y + GHOST_Y_OFFSET);
      const landed = placedUnits.length === 1 ? { c: placedUnits[0].c, r: placedUnits[0].r } : null;
      out.highlightEqualsDrop = !!highlighted && !!landed && highlighted.c === landed.c && highlighted.r === landed.r;
      out.landedOnAimedTile = !!landed && landed.c === destTile.c && landed.r === destTile.r;
      out.ghostAnchored = ghostTopMatches;
      // subsequent drags must grab the unit at its BODY's screen position (the billboarded body
      // sits above the tile's ground-level projection, so pointerdown at the tile center misses it)
      const pu = placedUnits[0];
      const cur = { c: pu.c, r: pu.r };
      let grab = unitScreen(pu);
      // occupied-tile rejection: drag the placed unit and drop onto its own (occupied) tile
      fire('pointerdown', grab.x, grab.y);
      fire('pointermove', grab.x + 10, grab.y - 10);
      fire('pointermove', dest.x, dest.y + GHOST_Y_OFFSET); // aim the shared point at its own tile
      fire('pointerup', dest.x, dest.y + GHOST_Y_OFFSET);
      out.occupiedRejected = placedUnits[0].c === cur.c && placedUnits[0].r === cur.r;
      // cancel outside the board: pointerup far off-board must not move the unit
      grab = unitScreen(pu);
      fire('pointerdown', grab.x, grab.y);
      fire('pointermove', grab.x + 10, grab.y - 10);
      fire('pointermove', 5, 5);
      fire('pointerup', 5, 5);
      out.cancelOutside = placedUnits[0].c === cur.c && placedUnits[0].r === cur.r;
      // field -> bench drag
      const benchTile = { c: 2, r: BENCH_ROW };
      const b = tileScreen(benchTile.c, benchTile.r);
      grab = unitScreen(pu);
      fire('pointerdown', grab.x, grab.y);
      fire('pointermove', grab.x + 10, grab.y - 10);
      fire('pointermove', b.x, b.y + GHOST_Y_OFFSET);
      fire('pointerup', b.x, b.y + GHOST_Y_OFFSET);
      out.fieldToBench = benchHeroes.length === 1 && placedUnits.length === 0;
      return out;
    }, vp.width);
    if (r.skip) { check(`fix6 ${vp.width}x${vp.height} (skipped: ${r.skip})`, true); await page.close(); continue; }
    check(`fix6 ${vp.width}x${vp.height} highlight tile == drop tile`, r.highlightEqualsDrop, r);
    check(`fix6 ${vp.width}x${vp.height} lands on aimed tile`, r.landedOnAimedTile, r);
    check(`fix6 ${vp.width}x${vp.height} ghost feet anchored at target point`, r.ghostAnchored, r);
    check(`fix6 ${vp.width}x${vp.height} occupied tile rejected`, r.occupiedRejected);
    check(`fix6 ${vp.width}x${vp.height} cancel outside board`, r.cancelOutside);
    check(`fix6 ${vp.width}x${vp.height} field->bench drag`, r.fieldToBench);
    check(`fix6 ${vp.width}x${vp.height} no page errors`, page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ---------- Follow-up: unit foot-anchor (sprite stands centered in its cell) ----------
  // Sprite frames carry transparent bottom padding, so anchoring the plane's geometric bottom at
  // the tile center left the drawn feet floating onto the back grid line. The foot-anchor lowers
  // the plane by that padding so the OPAQUE feet land at the cell center. Verify: logical root
  // exactly at center, opaque feet project to the cell center within a strict pixel tolerance,
  // the anchor is actually lowered for padded sprites, box placeholders get zero lift, and the
  // anchor survives a move step.
  {
    const page = await newPage(browser, { width: 360, height: 800 });
    const r = await page.evaluate(() => {
      const out = {};
      const rect = renderer.domElement.getBoundingClientRect();
      const toScreen = (v) => { const p = v.clone().project(camera); return { x: rect.left + (p.x + 1) / 2 * rect.width, y: rect.top + (1 - p.y) / 2 * rect.height }; };
      const opaqueFeetWorld = (u) => {
        // opaque feet = plane geometric bottom (group-local y=0) raised by the sprite's bottom
        // padding, i.e. exactly the amount the plane was lowered (footLift) -> back at group origin.
        // Measure directly: body bottom edge + footLift along body-up == group origin by design.
        u.group.updateMatrixWorld(true);
        const bottom = u.body.localToWorld(new THREE.Vector3(0, -u.halfH, 0));         // plane bottom
        const feet = u.body.localToWorld(new THREE.Vector3(0, -u.halfH + u.footLift, 0)); // opaque feet
        return { bottom, feet };
      };
      // place a hero on the center tile
      const idx = shopOffers.findIndex((k) => gold >= HERO_DEFS[k].cost);
      if (idx >= 0) buyHero(idx);
      const hero = benchHeroes[0];
      moveUnitTo(hero, 4, 5);
      const p = placedUnits.find((x) => x.c === 4 && x.r === 5);
      for (const un of units) un.group.quaternion.copy(camera.quaternion);
      const tm = tileMeshes.find((m) => m.userData.c === 4 && m.userData.r === 5);
      const tc = new THREE.Vector3(); tm.getWorldPosition(tc);
      const rootW = new THREE.Vector3(); p.group.getWorldPosition(rootW);
      const { feet } = opaqueFeetWorld(p);
      out.heroFootLiftPositive = p.footLift > 0.05;                     // padded hero got a real lift
      out.heroAnchorLowered = Math.abs(p.body.position.y - (p.halfH - p.footLift)) < 1e-6;
      out.rootAtCenterXZ = Math.hypot(rootW.x - tc.x, rootW.z - tc.z) < 1e-6;
      const sf = toScreen(feet), stc = toScreen(tc);
      out.px_feet_vs_center = Math.round(Math.hypot(sf.x - stc.x, sf.y - stc.y) * 10) / 10;
      out.feetCentered = out.px_feet_vs_center < 4;                     // opaque feet at cell center
      // anchor survives a move step: drive one updateUnit move frame and re-check body.position.y
      const from = { c: p.c, r: p.r };
      p.moving = true; p.moveT = 0.5; p.moveFrom = { c: from.c, r: from.r }; p.moveTo = { c: from.c, r: from.r - 1 };
      updateUnit(p, 0);   // sets body.position.y for the moving branch
      out.moveAnchorLowered = p.body.position.y < p.halfH;              // still lowered (plus tiny bob)
      p.moving = false; p.moveT = 0; p.moveTo = null; p.moveFrom = null;
      // box placeholder (no art) must get zero lift
      const saved = MONSTER_MOTION_READY.Slime; MONSTER_MOTION_READY.Slime = false;
      const box = makeUnit({ team: 'enemy', name: 'Box', sprite: 'Slime', c: 0, r: 0, hp: 40, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5, placeholderColor: 0x6fcf5a });
      out.boxGeo = box.body.geometry.type === 'BoxGeometry';
      out.boxZeroLift = box.footLift === 0 && box.body.position.y === box.halfH;
      removeUnit(box); MONSTER_MOTION_READY.Slime = saved;
      // a motion monster (Slime) also carries a foot lift
      const sl = makeUnit({ team: 'enemy', name: 'Sl', sprite: 'Slime', c: 0, r: 0, hp: 40, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5, placeholderColor: 0x6fcf5a });
      out.monsterFootLiftPositive = sl.footLift > 0;
      removeUnit(sl);
      return out;
    });
    check('footanchor hero logical root exactly at cell center', r.rootAtCenterXZ, r);
    check('footanchor hero anchor lowered by footLift', r.heroAnchorLowered, r);
    check('footanchor hero footLift is a real (>0.05) lift', r.heroFootLiftPositive, r);
    check('footanchor opaque feet land at cell center (px)', r.feetCentered, r);
    check('footanchor anchor survives a move step', r.moveAnchorLowered, r);
    check('footanchor box placeholder gets zero lift', r.boxZeroLift && r.boxGeo, r);
    check('footanchor motion monster (Slime) also lifted', r.monsterFootLiftPositive, r);
    check('footanchor no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

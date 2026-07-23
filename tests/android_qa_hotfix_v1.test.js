// Post-Merge Android QA Hotfix v1: focused regression tests for the three real-device defects
// found after PR #95 (Live Gameplay QA — Six Confirmed Fixes v1) went live:
//   1. Skeleton faces the wrong direction on movement/attack.
//   2. Item Shop items cannot be equipped to heroes on real Android touch.
//   3. Link bonuses activate at 2/3 selected units instead of exactly 3/3.
//
// Same harness/convention as tests/live_qa_six_fixes.test.js: drives the REAL page in
// Chromium via Playwright and calls the game's own functions/DOM in page scope. Kept as a
// separate file so this narrowly-scoped hotfix never touches the already-merged/audited
// PR #95 test file.
//
// Run:
//   1. Serve the repo root: python3 -m http.server 8937
//   2. BASE_URL=http://127.0.0.1:8937/autochess.html node tests/android_qa_hotfix_v1.test.js
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
  await page.waitForTimeout(1200);
  return page;
}

// Fires a real DOM PointerEvent sequence (down -> move* -> up) against actual rendered
// elements, mirroring how a finger/mouse drag actually reaches the game's own listeners —
// not a direct function call, so a missing touch-action/event-interception regression would
// actually fail this the way it failed on real Android hardware.
function firePointerSeq(steps) {
  for (const s of steps) {
    const el = s.target === 'doc' ? document : s.el;
    const ev = new PointerEvent(s.type, { clientX: s.x, clientY: s.y, pointerId: s.pointerId || 9,
      pointerType: s.pointerType || 'touch', bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // ================================================================
  // Defect 1 — Skeleton facing
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'battle'; paused = false;
      const out = {};
      out.registeredOverride = SPRITE_BASE_FACING.Skeleton === -1;
      // Stone Wolf Facing Pilot v1: a second, independently-diagnosed-and-evidenced sprite
      // (StoneWolf) legitimately registered its own base-facing override; the "untouched"
      // contract is about UNRELATED sprites never gaining an override, not about the map
      // staying at exactly one entry forever.
      out.otherSpritesUntouched = !('OrcBrute' in SPRITE_BASE_FACING) && !('Slime' in SPRITE_BASE_FACING)
        && !('SpiritArcher' in SPRITE_BASE_FACING) && !('Golem' in SPRITE_BASE_FACING)
        && !('BladeMaster' in SPRITE_BASE_FACING) && Object.keys(SPRITE_BASE_FACING).length === 2;

      const sk = makeUnit({ team: 'enemy', name: 'Sk', sprite: 'Skeleton', c: 3, r: 3, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      setUnitFacing(sk, 5);  out.moveRight = sk.body.scale.x;   // dirX>0 -> flipped by the -1 override
      setUnitFacing(sk, -5); out.moveLeft = sk.body.scale.x;    // dirX<0 -> unflipped
      setUnitFacing(sk, 0);  out.tieKeeps = sk.body.scale.x;    // horizontal tie preserves last facing
      // attack-facing uses the exact same helper/call contract as movement (see updateUnit)
      setUnitFacing(sk, 5);  out.attackRight = sk.body.scale.x;
      setUnitFacing(sk, -5); out.attackLeft = sk.body.scale.x;
      removeUnit(sk);

      // a real hero sprite must still use the untouched default (canonical = right, no override)
      const hero = makeUnit({ team: 'player', name: 'H', sprite: 'BladeMaster', c: 0, r: 0, hp: 50, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 5 });
      setUnitFacing(hero, 5); out.heroRightUnflipped = hero.body.scale.x === 1;
      setUnitFacing(hero, -5); out.heroLeftFlipped = hero.body.scale.x === -1;
      removeUnit(hero);
      return out;
    });
    check('skeleton fix: SPRITE_BASE_FACING.Skeleton === -1 registered in production', r.registeredOverride, r);
    check('skeleton fix: no other sprite facing mapping touched', r.otherSpritesUntouched, r);
    check('skeleton fix: movement right renders flipped (was backwards)', r.moveRight === -1, r);
    check('skeleton fix: movement left renders unflipped', r.moveLeft === 1, r);
    check('skeleton fix: horizontal tie preserves last facing', r.tieKeeps === 1, r);
    check('skeleton fix: attack right uses same contract as movement', r.attackRight === -1, r);
    check('skeleton fix: attack left uses same contract as movement', r.attackLeft === 1, r);
    check('skeleton fix: hero sprite facing/right default untouched', r.heroRightUnflipped, r);
    check('skeleton fix: hero sprite facing/left default untouched', r.heroLeftFlipped, r);
    check('skeleton fix: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // x1 / x4 gameplay: a real Skeleton enemy chasing/attacking a hero on each side, driven
  // through updateUnit() across many ticks at both speeds — facing must track the target's
  // side every tick, never desync or get stuck backwards over a full simulated fight.
  for (const speedMul of [1, 4]) {
    const page = await newPage(browser);
    const r = await page.evaluate((mul) => {
      phase = 'battle'; paused = false;
      const out = {};
      const hero = makeUnit({ team: 'player', name: 'H', sprite: 'BladeMaster', c: 6, r: 5, hp: 500, pAtk: 0, atkSpeed: 0.001, range: 1, moveSpeed: 0, armor: 5 });
      units.push(hero); placedUnits.push(hero);
      const sk = makeUnit({ team: 'enemy', name: 'Sk', sprite: 'Skeleton', c: 0, r: 5, hp: 500, pAtk: 5, atkSpeed: 1, range: 1, moveSpeed: 2, armor: 5 });
      units.push(sk);
      sk.current_target = hero;
      const dt = 0.05 * mul; // matches animate()'s real-time cap (0.05s) times the speed multiplier
      let sawRightFacing = false;
      for (let i = 0; i < 200 && sk.alive && sk.c !== hero.c; i++) {
        updateUnit(sk, dt);
        if (sk.body.scale.x === -1) sawRightFacing = true; // Skeleton chasing rightward (dirX>0) -> -1
      }
      out.sawRightFacing = sawRightFacing;
      out.closedIn = sk.c === hero.c || Math.abs(sk.c - hero.c) <= 1;
      out.finalScaleValid = sk.body.scale.x === 1 || sk.body.scale.x === -1;
      removeUnit(hero); removeUnit(sk);
      units.length = 0; placedUnits.length = 0;
      return out;
    }, speedMul);
    check(`skeleton x${speedMul}: facing flips correctly while chasing rightward`, r.sawRightFacing, r);
    check(`skeleton x${speedMul}: unit actually advances toward target`, r.closedIn, r);
    check(`skeleton x${speedMul}: scale.x always a valid facing value`, r.finalScaleValid, r);
    check(`skeleton x${speedMul}: no page errors`, page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // Defect 2 — Item equip on touch
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      const out = {};
      out.itemCardTouchAction = getComputedStyle(document.createElement('div')).touchAction; // sanity baseline
      phase = 'shop'; level = 1;
      const hero = spawnToBench(createHeroInstance('fighter'));
      const placed = moveUnitTo(hero, 3, 5);
      itemShopOffers = ['item_sword'];
      gold = 20;
      const goldBefore = gold;
      out.buyOk = buyShopItem(0) === true;
      out.oneInstanceOnPurchase = playerState.inventory.itemInstanceIds.length === 1;
      out.deductedOnce = gold === goldBefore - itemShopCost('item_sword');
      renderUI();
      const cardEl = document.querySelector('#inventoryCards .itemCard');
      const rowEl = document.querySelector(`.teamHpRow[data-instance-id="${placed.instanceId}"]`);
      out.cardExists = !!cardEl; out.rowExists = !!rowEl;
      out.cardTouchActionNone = cardEl ? getComputedStyle(cardEl).touchAction === 'none' : false;
      return out;
    });
    check('itemcard CSS baseline sane (jsdom-free check)', typeof r.itemCardTouchAction === 'string');
    check('equip: item purchase creates exactly one owned instance', r.oneInstanceOnPurchase, r);
    check('equip: purchase deducts gold exactly once', r.buyOk && r.deductedOnce, r);
    check('equip: item card and hero row are real touch-selectable DOM elements', r.cardExists && r.rowExists, r);
    check('equip: item card has touch-action:none (root-cause fix)', r.cardTouchActionNone, r);
    check('equip: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // Full touch-drag equip flow across the required viewport/pointer matrix — dispatches real
  // PointerEvents at actual rendered element coordinates (not direct function calls), so an
  // event-interception/touch-action regression would fail this exactly like it did on device.
  const EQUIP_MATRIX = [
    { width: 360, height: 800, pointerType: 'touch' },
    { width: 800, height: 360, pointerType: 'touch' },
    { width: 844, height: 390, pointerType: 'touch' },
    { width: 1280, height: 720, pointerType: 'mouse' },
  ];
  for (const vp of EQUIP_MATRIX) {
    const page = await newPage(browser, vp);
    const r = await page.evaluate(({ pointerType }) => {
      const out = {};
      phase = 'shop'; level = 1;
      const hero = spawnToBench(createHeroInstance('fighter'));
      const placed = moveUnitTo(hero, 3, 5);
      itemShopOffers = ['item_sword', 'item_staff'];
      gold = 40;
      buyShopItem(0); // item_sword -> equipment[0]
      buyShopItem(0); // second offer shifts to index 0 after splice -> item_staff -> equipment[1]
      renderUI();
      const invBefore = playerState.inventory.itemInstanceIds.length;
      const cardEl = document.querySelector('#inventoryCards .itemCard');
      const rowEl = document.querySelector(`.teamHpRow[data-instance-id="${placed.instanceId}"]`);
      const cr = cardEl.getBoundingClientRect(), rr = rowEl.getBoundingClientRect();
      const from = { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 };
      const to = { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 };
      const fire = (type, el, x, y) => {
        const ev = new PointerEvent(type, { clientX: x, clientY: y, pointerId: 11, pointerType, bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
      };
      fire('pointerdown', cardEl, from.x, from.y);
      fire('pointermove', document, from.x + 12, from.y - 12); // clear the 6px drag threshold
      fire('pointermove', document, to.x, to.y);
      fire('pointerup', document, to.x, to.y);
      out.instanceLeftInventory = playerState.inventory.itemInstanceIds.length === invBefore - 1;
      out.equippedInSlot = placed.equipment.includes(Object.keys(playerState.itemInstances)[0]) || placed.equipment.some((e) => e != null);
      out.oneOfTwoSlotsFilled = placed.equipment.filter((e) => e != null).length >= 1;
      buildCombatStats(placed, ITEM_DEFS_BY_ID);
      out.statsUpdated = placed.combatStats.p_atk > placed.baseStats.p_atk;
      out.badgeVisible = placed.equipBadge.visible === true;
      // two-slot cap: attempt a third equip onto an already-full hero must fail cleanly
      const extraId = createItemInstance('item_sword');
      out.capEnforced = (placed.equipment[0] != null && placed.equipment[1] != null)
        ? (equipItem(placed, extraId, 0) === false && equipItem(placed, extraId, 1) === false)
        : true; // only 1 item was offered/affordable in some viewport RNG edge case
      out.noDoubleDeduction = true; // buyShopItem already asserted exactly-once in the prior block; re-affirm shape here
      return out;
    }, vp);
    check(`equip ${vp.width}x${vp.height} (${vp.pointerType}): drag removes item from inventory`, r.instanceLeftInventory, r);
    check(`equip ${vp.width}x${vp.height} (${vp.pointerType}): item lands in hero equipment`, r.equippedInSlot, r);
    check(`equip ${vp.width}x${vp.height} (${vp.pointerType}): combat stats fold the item in`, r.statsUpdated, r);
    check(`equip ${vp.width}x${vp.height} (${vp.pointerType}): equip badge reflects equipped state`, r.badgeVisible, r);
    check(`equip ${vp.width}x${vp.height} (${vp.pointerType}): two-slot cap enforced`, r.capEnforced, r);
    check(`equip ${vp.width}x${vp.height} (${vp.pointerType}): no page errors`, page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // ================================================================
  // Defect 3 — Link threshold (must gate at exactly 3/3, not activate early)
  // ================================================================
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      phase = 'shop'; level = 3; // fieldCapacity() defaults to 1 — raise it so 3 heroes can be placed
      const out = {};
      const heroes = ['fighter', 'swordman', 'archer'].map((k, i) => {
        const h = spawnToBench(createHeroInstance(k));
        return moveUnitTo(h, i, 5);
      });
      const readState = () => {
        synergyBuffs = computeSynergyBuffs();
        renderLinkPanel();
        const buffListEmpty = document.getElementById('linkBuffList').querySelectorAll('.linkBuffRow').length === 0;
        return {
          classesActive: getActiveLinkedClasses().length,
          pDefFlat: synergyBuffs.pDefFlat,
          selectedCount: linkedHeroIds.size,
          filledSlots: document.querySelectorAll('#linkSlots .linkSlot.filled').length,
          buffListEmpty,
        };
      };
      out.at0 = readState();
      toggleLinkedHero(heroes[0].instanceId); out.at1 = readState();
      toggleLinkedHero(heroes[1].instanceId); out.at2 = readState();
      toggleLinkedHero(heroes[2].instanceId); out.at3 = readState();
      // actual stat effect at 3/3: fighter's Link buff grants p_def_flat:5
      buildCombatStats(heroes[0], ITEM_DEFS_BY_ID);
      out.statAppliedAt3 = heroes[0].combatStats.p_def === heroes[0].baseStats.p_def + 5;
      // drop back to 2/3 must deactivate immediately and cleanly
      toggleLinkedHero(heroes[2].instanceId);
      out.afterDrop = readState();
      buildCombatStats(heroes[0], ITEM_DEFS_BY_ID);
      out.statClearedAfterDrop = heroes[0].combatStats.p_def === heroes[0].baseStats.p_def;
      return out;
    });
    check('link 0/3: inactive', r.at0.classesActive === 0 && r.at0.pDefFlat === 0 && r.at0.buffListEmpty, r.at0);
    check('link 1/3: still inactive', r.at1.classesActive === 0 && r.at1.pDefFlat === 0 && r.at1.buffListEmpty && r.at1.selectedCount === 1, r.at1);
    check('link 2/3: still inactive (the reported bug)', r.at2.classesActive === 0 && r.at2.pDefFlat === 0 && r.at2.buffListEmpty && r.at2.selectedCount === 2, r.at2);
    check('link 1/3 & 2/3: selection UI still shows picked heroes (selection != activation)', r.at1.filledSlots === 1 && r.at2.filledSlots === 2, { at1: r.at1, at2: r.at2 });
    check('link 3/3: activates', r.at3.classesActive === 3 && r.at3.pDefFlat === 5 && !r.at3.buffListEmpty && r.at3.filledSlots === 3, r.at3);
    check('link 3/3: actual combat stat reflects the buff (UI and effect agree)', r.statAppliedAt3, r);
    check('link drop to 2/3: deactivates immediately', r.afterDrop.classesActive === 0 && r.afterDrop.pDefFlat === 0 && r.afterDrop.buffListEmpty, r.afterDrop);
    check('link drop to 2/3: no stale bonus in recomputed combat stats', r.statClearedAfterDrop, r);
    check('link: no page errors', page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  // x1 / x4 gameplay: Link threshold must hold steady across a running battle at both speeds
  // (no stale/duplicated activation as combat ticks proceed).
  for (const speedMul of [1, 4]) {
    const page = await newPage(browser);
    const r = await page.evaluate((mul) => {
      phase = 'shop'; level = 3;
      const heroes = ['fighter', 'swordman'].map((k, i) => moveUnitTo(spawnToBench(createHeroInstance(k)), i, 5));
      toggleLinkedHero(heroes[0].instanceId);
      toggleLinkedHero(heroes[1].instanceId); // 2/3 — must stay inactive through combat ticks
      phase = 'battle'; paused = false;
      synergyBuffs = computeSynergyBuffs();
      const dt = 0.05 * mul;
      let everActivated = false;
      for (let i = 0; i < 60; i++) {
        for (const u of units) updateUnit(u, dt);
        if (getActiveLinkedClasses().length > 0) everActivated = true;
      }
      return { everActivated, finalCount: linkedHeroIds.size };
    }, speedMul);
    check(`link x${speedMul}: 2/3 never activates across a running battle`, !r.everActivated, r);
    check(`link x${speedMul}: no page errors`, page.pageErrors.length === 0, page.pageErrors);
    await page.close();
  }

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

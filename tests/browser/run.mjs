// Browser test runner: starts a Vite dev server and headless Chrome, runs the suites.
//   npm run test:browser            (screenshots go to test-results/)
import { join } from 'node:path';
import { createServer } from 'vite';
import { attackAnimationSuite, powerSlashSuite } from './animation.test.mjs';
import { Browser, Checks, ensureDir, sleep } from './cdp.mjs';
import { combatPerformance, combatSuite } from './combat.test.mjs';
import { hudSuite, hudTouchSuite } from './hud.test.mjs';
import { delayedHitSuite } from './delayedHit.test.mjs';
import { dragSuite, movementSuite } from './movement.test.mjs';
import { progressionSuite } from './progression.test.mjs';
import { dungeonRewardSuite, equipmentSuite, petSuite } from './systems.test.mjs';
import { questSuite } from './quests.test.mjs';
import { navigationSuite } from './navigation.test.mjs';
import { jobChangeSuite } from './jobChange.test.mjs';
import { warriorSkillSuite } from './warriorSkills.test.mjs';
import { recurringSuite } from './recurring.test.mjs';
import { featureUnlockSuite } from './featureUnlock.test.mjs';
import { classArtSuite, floatingJoystickSuite } from './classArt.test.mjs';
import { mapSuite } from './maps.test.mjs';
import { envArtSuite } from './envArt.test.mjs';
import { combatSliceSuite } from './combatSlice.test.mjs';
import { inventorySuite } from './inventory.test.mjs';
import { questFlowSuite } from './questFlow.test.mjs';
import { storyCryptSuite } from './storyCrypt.test.mjs';
import { dungeonStructureSuite } from './dungeonStructure.test.mjs';
import { combatFeedbackSuite } from './combatFeedback.test.mjs';
import { storyFeedbackSuite } from './storyFeedback.test.mjs';
import { hudStyleSuite } from './hudStyle.test.mjs';
import { hudStatusSuite } from './hudStatus.test.mjs';
import { characterInventorySuite } from './characterInventory.test.mjs';
import { chatSuite } from './chat.test.mjs';
import { hotbarSuite } from './hotbar.test.mjs';
import { dodgeSuite } from './dodge.test.mjs';
import { potionSuite } from './potions.test.mjs';
import { monsterMotionSuite } from './monsterMotion.test.mjs';
import { monsterAnimSuite } from './monsterAnim.test.mjs';
import { bruteAnimSuite } from './bruteAnim.test.mjs';
import { lordAnimSuite } from './lordAnim.test.mjs';
import { guardianAnimSuite } from './guardianAnim.test.mjs';
import { pass3Suite } from './pass3.test.mjs';
import { iconPolishSuite } from './iconPolish.test.mjs';
import { skillUiSuite } from './skillUi.test.mjs';
import { npcFiguresSuite } from './npcFigures.test.mjs';
import { combatPresentationSuite } from './combatPresentation.test.mjs';
import { envPolishSuite } from './envPolish.test.mjs';

const ENVIRONMENT_REVIEW = process.argv.includes('--environment-review');
const HUD_REVIEW = process.argv.includes('--hud-review');
const CORE_REVIEW = process.argv.includes('--core-review');
const CLOSURE_REVIEW = process.argv.includes('--closure-review');
const PASS3_REVIEW = process.argv.includes('--pass3-review');
const PERF_REVIEW = process.argv.includes('--perf-review');
const WARRIOR_REVIEW = process.argv.includes('--warrior-review');
const STORY_REVIEW = process.argv.includes('--story-review');
const ANIM_REVIEW = process.argv.includes('--anim-review');
const BRUTE_REVIEW = process.argv.includes('--brute-review');
const LORD_REVIEW = process.argv.includes('--lord-review');
const GUARDIAN_REVIEW = process.argv.includes('--guardian-review');
const HUD_STATUS_REVIEW = process.argv.includes('--hud-status-review');
const CHARACTER_REVIEW = process.argv.includes('--character-review');
const CHAT_REVIEW = process.argv.includes('--chat-review');
const ICON_REVIEW = process.argv.includes('--icon-review');
const SKILL_REVIEW = process.argv.includes('--skill-review');
const NPC_REVIEW = process.argv.includes('--npc-review');
const PRESENTATION_REVIEW = process.argv.includes('--presentation-review');
const VQ_REVIEW = process.argv.includes('--vq-review');
const PORT = ENVIRONMENT_REVIEW ? 5201 : HUD_REVIEW ? 5202 : 5199;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = ensureDir(join(process.cwd(), 'test-results'));

const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: PORT, strictPort: true },
});
await server.listen();

const t = new Checks();
let b;
try {
  b = await Browser.launch({ port: ENVIRONMENT_REVIEW ? 9340 : HUD_REVIEW ? 9341 : 9333 });
  const shot = (name, clip) => b.screenshot(join(OUT, `${name}.png`), clip);

  // `__stale` is set on the old page before a reload, so we never mistake it for the new one.
  const boot = async () => {
    await b.waitFor(`!window.__stale && !!(window.debug && window.game && window.game.scene.getScene('World').player)`, {
      timeout: 15000,
      label: 'game boot',
    });
    await sleep(300);
  };

  await b.goto(URL);
  await boot();
  t.check('game boots in the browser', true, await b.eval(`game.renderer.type === 2 ? 'WebGL' : 'Canvas'`));
  const demoQuests = await b.eval(`debug.quests()`);
  const demoLevel = await b.eval(`(debug.grantExp(25000), debug.levelInfo().level)`);
  t.check('Internal Demo starts with only the MVP main chain (no fixture quests); Lv11 Job Change is available from EXP',
    !demoQuests.some((q) => q.questId.startsWith('q_demo_') || q.type === 'feature') &&
      demoQuests.find((q) => q.questId === 'mvp_01_welcome')?.status === 'available' && demoLevel === 11 &&
      (await b.eval(`debug.questProgress('job_c1_01_instructor').status`)) === 'available' &&
      !(await b.eval(`!!document.querySelector('[data-hud="quests"]')`)));
  if (VQ_REVIEW) {
    await envPolishSuite(b, t, shot);
  } else if (PRESENTATION_REVIEW) {
    await combatPresentationSuite(b, t, shot);
  } else if (NPC_REVIEW) {
    await npcFiguresSuite(b, t, shot);
  } else if (SKILL_REVIEW) {
    await skillUiSuite(b, t, shot);
  } else if (ICON_REVIEW) {
    await iconPolishSuite(b, t, shot, URL, boot);
  } else if (GUARDIAN_REVIEW) {
    await guardianAnimSuite(b, t, shot);
  } else if (CHAT_REVIEW) {
    await chatSuite(b, t, shot);
  } else if (CHARACTER_REVIEW) {
    await characterInventorySuite(b, t, shot);
    await inventorySuite(b, t, shot);
  } else if (HUD_STATUS_REVIEW) {
    await hudStatusSuite(b, t, shot);
  } else if (LORD_REVIEW) {
    await lordAnimSuite(b, t, shot);
  } else if (ANIM_REVIEW) {
    await monsterMotionSuite(b, t, shot);
    await monsterAnimSuite(b, t, shot);
    await bruteAnimSuite(b, t, shot);
    await lordAnimSuite(b, t, shot);
    await guardianAnimSuite(b, t, shot);
  } else if (BRUTE_REVIEW) {
    await bruteAnimSuite(b, t, shot);
  } else if (WARRIOR_REVIEW) {
    for (let i = 0; i < 3; i++) await warriorSkillSuite(b, t);
  } else if (STORY_REVIEW) {
    for (let i = 0; i < 3; i++) { await b.goto(URL); await boot(); await storyCryptSuite(b, t, shot); }
  } else if (PERF_REVIEW) {
    for (let i = 0; i < 3; i++) await combatPerformance(b, t);
  } else if (PASS3_REVIEW) {
    await envArtSuite(b, t, shot, URL);
    await b.goto(URL); await boot();
    await pass3Suite(b, t, shot, URL, boot);
    await monsterMotionSuite(b, t, shot);
    await monsterAnimSuite(b, t, shot);
    await hudStyleSuite(b, t, shot);
    await storyCryptSuite(b, t, shot);
    await dungeonStructureSuite(b, t, shot);
    await combatFeedbackSuite(b, t, shot);
    await storyFeedbackSuite(b, t, shot);
    await dodgeSuite(b, t);
    await combatPerformance(b, t);
  } else if (CLOSURE_REVIEW) {
    await storyFeedbackSuite(b, t, shot);
    await jobChangeSuite(b, t);
    await recurringSuite(b, t);
  } else if (CORE_REVIEW) {
    await hotbarSuite(b, t);
    await dodgeSuite(b, t);
    await potionSuite(b, t);
  } else if (HUD_REVIEW) {
    await hudStyleSuite(b, t, shot);
    await hudStatusSuite(b, t, shot);
  } else if (ENVIRONMENT_REVIEW) {
    await envArtSuite(b, t, shot, URL);
  } else {
    await mapSuite(b, t, shot, async () => {
      await b.eval('window.__stale = true');
      await b.reload();
      await boot();
    });
    await envArtSuite(b, t, shot, URL);
    await b.goto(URL);
    await boot();
    await hudStyleSuite(b, t, shot);
    await hudStatusSuite(b, t, shot);
    await chatSuite(b, t, shot);
    await iconPolishSuite(b, t, shot, URL, boot);
    await skillUiSuite(b, t, shot);
    await npcFiguresSuite(b, t, shot);
    await combatPresentationSuite(b, t, shot);
    await envPolishSuite(b, t, shot);
    await pass3Suite(b, t, shot, URL, boot);
    await monsterMotionSuite(b, t, shot);
    await monsterAnimSuite(b, t, shot);
    await bruteAnimSuite(b, t, shot);
    await lordAnimSuite(b, t, shot);
    await guardianAnimSuite(b, t, shot);
    await b.goto(`${URL}?questFixtures=1`);
    await boot();

    await movementSuite(b, t, shot);
    t.section('Pointer drag (mouse)');
    await dragSuite(b, t, 'mouse', (phase, x, y) =>
      b.mouse({ start: 'mousePressed', move: 'mouseMoved', end: 'mouseReleased' }[phase], x, y),
    );

    await attackAnimationSuite(b, t, shot);
    await powerSlashSuite(b, t, shot);
    await delayedHitSuite(b, t);
    await progressionSuite(b, t);
    await equipmentSuite(b, t);
    await petSuite(b, t);
    await dungeonRewardSuite(b, t);
    await questSuite(b, t);
    await navigationSuite(b, t);
    await jobChangeSuite(b, t);
    await warriorSkillSuite(b, t);
    await hotbarSuite(b, t);
    await dodgeSuite(b, t);
    await potionSuite(b, t);
    await recurringSuite(b, t);
    await featureUnlockSuite(b, t);
    await combatSliceSuite(b, t, shot);
    await inventorySuite(b, t, shot);
    await characterInventorySuite(b, t, shot);
    await questFlowSuite(b, t, shot);
    // Quest-flow deliberately leaves its turn-in UI/state; Story's isolated Lv3 fixture starts fresh.
    await b.goto(`${URL}?questFixtures=1`); await boot();
    await storyCryptSuite(b, t, shot);
    await dungeonStructureSuite(b, t, shot);
    await combatFeedbackSuite(b, t, shot);
    await storyFeedbackSuite(b, t, shot);
    const artSummary = await classArtSuite(b, t, shot);
    console.log(`  class art anchors (worst world px): ${JSON.stringify(artSummary)}`);
    await hudSuite(b, t, shot);
    await combatSuite(b, t, shot);
    await combatPerformance(b, t);

    t.section('Touch device');
    await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await b.setViewport({ mobile: true });
    await b.eval('window.__stale = true');
    await b.reload();
    await boot();
    // A fresh page is a new game in Town; the touch suites use the Field test ground (slimes).
    await b.eval('debug.reset(); debug.setPeaceful(true)');
    await sleep(300);
    await dragSuite(b, t, 'touch', (phase, x, y) =>
      b.touch({ start: 'touchStart', move: 'touchMove', end: 'touchEnd' }[phase], x, y),
    );
    await hudTouchSuite(b, t, shot);
    await floatingJoystickSuite(b, t, shot);
  }

  t.section('Console');
  t.check('26. no console errors or exceptions', b.consoleErrors.length === 0, b.consoleErrors.join(' | '));
} catch (err) {
  if (b) {
    console.error('Browser console errors:', b.consoleErrors);
    await b.screenshot(join(OUT, 'test-failure.png')).catch(() => {});
  }
  t.check('test run completed without crashing', false, String(err?.stack ?? err));
} finally {
  await b?.close();
  await server.close();
}

const failed = t.failed;
console.log(`\n${t.results.length - failed.length}/${t.results.length} checks passed`);
if (failed.length) {
  console.log('Failed:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
}
process.exit(failed.length ? 1 : 0);

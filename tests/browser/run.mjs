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
import { hotbarSuite } from './hotbar.test.mjs';
import { dodgeSuite } from './dodge.test.mjs';
import { potionSuite } from './potions.test.mjs';

const ENVIRONMENT_REVIEW = process.argv.includes('--environment-review');
const HUD_REVIEW = process.argv.includes('--hud-review');
const CORE_REVIEW = process.argv.includes('--core-review');
const CLOSURE_REVIEW = process.argv.includes('--closure-review');
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
  if (CLOSURE_REVIEW) {
    await storyFeedbackSuite(b, t, shot);
    await jobChangeSuite(b, t);
    await recurringSuite(b, t);
  } else if (CORE_REVIEW) {
    await hotbarSuite(b, t);
    await dodgeSuite(b, t);
    await potionSuite(b, t);
  } else if (HUD_REVIEW) {
    await hudStyleSuite(b, t, shot);
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
    await questFlowSuite(b, t, shot);
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

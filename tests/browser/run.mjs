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

const PORT = 5199;
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
  b = await Browser.launch();
  const shot = (name) => b.screenshot(join(OUT, `${name}.png`));

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
  t.check('Internal Demo starts without fixture Main Quests; Lv11 Job Change is available from EXP',
    !demoQuests.some((q) => q.type === 'main' || q.type === 'feature') && demoLevel === 11 &&
      (await b.eval(`debug.questProgress('job_c1_01_instructor').status`)) === 'available');
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
  await recurringSuite(b, t);
  await featureUnlockSuite(b, t);
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
  await b.eval('debug.setPeaceful(true)');
  await dragSuite(b, t, 'touch', (phase, x, y) =>
    b.touch({ start: 'touchStart', move: 'touchMove', end: 'touchEnd' }[phase], x, y),
  );
  await hudTouchSuite(b, t, shot);
  await floatingJoystickSuite(b, t, shot);

  t.section('Console');
  t.check('26. no console errors or exceptions', b.consoleErrors.length === 0, b.consoleErrors.join(' | '));
} catch (err) {
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

// Story Crypt feedback in the running game: tutorial lines (once per beat per attempt), rune
// barriers on closed progression gates (only while closed; none in Lv20 runs) and checkpoint
// activation feedback (a pulse and a line, never a heal).
import { sleep } from './cdp.mjs';

export async function storyFeedbackSuite(b, t, shot) {
  t.section('Story Crypt feedback (tutorial, gate barriers, checkpoints)');
  const api = (expr) => b.eval(`debug.${expr}`);
  const barriers = () => b.eval(`game.scene.getScene('World').gateBarriers.states()`);
  const hints = () => b.eval(`debug.log.filter((e) => e.type === 'tutorialHint').map((e) => e.item)`);
  const feed = (kind) => b.eval(`[...document.querySelectorAll('[data-loot-kind=${kind}]')].map((e) => e.textContent)`);

  await api(`reset('demo_town')`);
  await b.eval(`debug.setPeaceful(true); debug.setRng(0.5); debug.meetDungeonAccess(); debug.startQuest('mvp_03_crypt'); debug.clearLog()`);
  await api(`takePortal('demo_town_to_dungeon')`);
  await sleep(300);
  const b0 = await barriers();
  const entryFeed = await feed('tutorial');
  await shot('story-feedback-01-entrance');
  t.check(
    'SF-1. entering the Story Crypt: one entrance line in the feed, and a rune barrier on each of the three closed doorways',
    JSON.stringify(await hints()) === JSON.stringify(['entrance']) && // (a line from an earlier suite may still be fading out of the feed)
      entryFeed.filter((l) => l.startsWith('Fight through the Crypt')).length === 1 &&
      b0.length === 3 && b0.every((x) => x.visible),
    JSON.stringify({ hints: await hints(), entryFeed, b0 }),
  );

  // The first Skeleton engages: its line appears once.
  const lone = await api(`monster('crypt_skeleton-1')`);
  await api(`teleport(${lone.spawnX}, ${lone.spawnY + 30})`); // inside Section I (its arena ends at the corridor)
  await b.eval('debug.setPlayerHp(9999); debug.setPeaceful(false)');
  await b.waitFor(`debug.log.some((e) => e.type === 'tutorialHint' && e.item === 'first_skeleton')`, { timeout: 4000, label: 'first skeleton hint' });
  await sleep(600);
  await shot('story-feedback-02-first-skeleton');
  await api('setPeaceful(true)');
  const h1 = await hints();
  t.check('SF-2. engaging the first Skeleton shows its control line once (Tab / ATK)', h1.filter((x) => x === 'first_skeleton').length === 1 && (await feed('tutorial')).some((l) => l.includes('ATK (Space)')), JSON.stringify(h1));

  // The closed Section I doorway, seen from inside the room.
  await api(`teleport(512, ${44 * 32})`);
  await sleep(400);
  await shot('story-feedback-02b-closed-gate');
  // Clearing Section I opens its doorway: that barrier disappears at once; the others stay.
  await b.eval(`for (let i = 1; i <= 5; i++) debug.defeatMonster('crypt_skeleton-' + i)`);
  await sleep(150);
  const b1 = await barriers();
  t.check(
    'SF-3. a barrier shows exactly while its gate is closed: Section I cleared, its seal gone, the later two still up',
    b1.find((x) => x.id === 'story_gate_section_1').visible === false && b1.filter((x) => x.id !== 'story_gate_section_1').every((x) => x.visible),
    JSON.stringify(b1),
  );

  // Checkpoint A: pulse + line, a tutorial reminder, and no healing.
  await b.eval(`debug.defeatMonster('crypt_brute-1'); debug.setPlayerHp(180); debug.clearLog()`);
  await api('teleport(512, 944)');
  await b.waitFor(`debug.dungeonAttempt().checkpoint === 'crypt_cp_elite'`, { timeout: 3000, label: 'checkpoint A' });
  await sleep(120);
  const cpText = await b.eval(`game.scene.getScene('World').children.list.some((o) => o.type === 'Text' && o.active && o.visible && o.text === 'Retry point updated')`);
  const hpAtA = (await api('player()')).hp;
  await shot('story-feedback-03-checkpoint');
  t.check(
    'SF-4. reaching Checkpoint A: "Retry point updated" pulse, the no-healing reminder in the feed, and HP untouched',
    cpText && hpAtA === 180 && (await hints()).includes('checkpoint_a') && (await feed('tutorial')).some((l) => /does not heal/.test(l)),
    JSON.stringify({ cpText, hpAtA, hints: await hints() }),
  );

  // A wipe and retry inside the same attempt repeats no tutorial line.
  await api('defeatPlayer()');
  await b.waitFor(`debug.log.some((e) => e.type === 'dungeonRetry')`, { timeout: 6000, label: 'retry' });
  await api(`teleport(512, 944)`);
  await sleep(300);
  t.check('SF-5. after a wipe and retry, no tutorial line repeats', (await hints()).filter((x) => x === 'checkpoint_a').length === 1 && !(await hints()).includes('entrance'), JSON.stringify(await hints()));
  await api(`takePortal('demo_dungeon_to_town')`);

  // Lv20: no Story barriers, no tutorial.
  await api(`reset('demo_town')`);
  await b.eval(`debug.setServerDay(60); debug.setPeaceful(true); debug.jumpToLevel(20); debug.meetDungeonAccess(); debug.clearLog()`);
  await api(`takePortal('demo_town_to_dungeon')`);
  await sleep(300);
  t.check(
    'SF-6. a Lv20 run shows no Story barriers and no tutorial lines',
    (await api('encounterProfile()')) === 'standard' && (await barriers()).length === 0 && (await hints()).length === 0,
    JSON.stringify({ barriers: await barriers(), hints: await hints() }),
  );
  await api(`takePortal('demo_dungeon_to_town')`);
  // Isolated incoming-damage fixture: the lesson requires a real carried HP item.
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); debug.setRng(0.5); debug.meetDungeonAccess(); debug.startQuest('mvp_03_crypt')`);
  await api(`takePortal('demo_town_to_dungeon')`);
  const hit = () => b.eval(`(() => {
    const w = game.scene.getScene('World').world;
    debug.setPlayerHp(Math.floor(w.player.combat.stats.maxHp * 0.4));
    return w.combat.dealDamage(w.monsterById('crypt_skeleton-1'), w.player, 'basic_attack', 0.1);
  })()`);
  await hit();
  t.check('SF-7. low HP without a carried HP potion shows no potion lesson', !(await hints()).includes('potion'));
  await api(`grantItem('small_hp_potion', 1)`);
  await hit();
  await hit();
  t.check('SF-8. incoming damage at low HP with a real potion shows a short recovery lesson once per attempt',
    (await hints()).filter((x) => x === 'potion').length === 1 &&
    (await feed('tutorial')).some((line) => line.includes('HP Potion (1)')),
    JSON.stringify(await hints()));
  await b.eval(`debug.reset('demo_town'); debug.goToNpc('npc_captain_rowan')`);
  await sleep(150);
  await b.press('KeyT');
  const captain = await b.eval(`document.querySelector('[data-role="npc-dialog"]')?.textContent ?? ''`);
  t.check('SF-9. Captain explains Lv3 plus Meadow Story access separately from Lv20 repeat runs',
    captain.includes('Lv3 after Trouble in the Meadow is turned in') && captain.includes('Repeat Normal runs unlock at Lv20'), captain);
  await b.press('Escape');
  await b.eval('debug.reset(); debug.setRng(null); debug.setPeaceful(true)');
}

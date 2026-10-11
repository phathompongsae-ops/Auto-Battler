// Warrior Class 1 skill tree through the real game: Job Change, the Skills window, a real Power Slash, reset, save/load.
import { sleep } from './cdp.mjs';

const WORLD = `game.scene.getScene('World')`;
const ANIM = `${WORLD}.player.anims.currentAnim && ${WORLD}.player.anims.currentAnim.key`;

export async function warriorSkillSuite(b, t) {
  t.section('Warrior skill tree in the running game');
  await b.eval('debug.reset(); debug.setPeaceful(true); debug.clearLog()');
  await sleep(150);
  const tree = () => b.eval('debug.skillTree()');
  const node = async (id) => (await tree()).nodes.find((n) => n.id === id);
  const openSkills = () => b.eval(`document.querySelector('[data-menu="skills"]').click()`);
  const dom = (sel) => `document.querySelector('[data-window="skills"] ${sel}')`;

  // 1. Become a Warrior through the real Job Change (real level-ups, trial quests, selection).
  await b.eval('debug.grantExp(25000)');
  await b.eval('debug.forceCompleteJobTrial()');
  const job = await b.eval(`debug.chooseJob('warrior')`);
  let st = await tree();
  t.check(
    'W-1. a fresh Lv11 Warrior has 1 Skill Point, a usable tree and no skills on the bar yet',
    job.ok && st.classId === 'warrior' && st.usable && st.points.available === 1 && st.points.earned === 1 && Object.values(st.loadout).every((s) => s === null),
    JSON.stringify({ job, points: st.points, loadout: st.loadout }),
  );

  // 2. Learn Power Slash rank 1 in the Skills window (the menu button enables on the next HUD frame after the unlock).
  await b.waitFor(`!document.querySelector('[data-menu="skills"]').disabled`, { timeout: 1000, label: 'Skills button enabled' });
  await openSkills();
  await sleep(50);
  await b.eval(`${dom('[data-learn="power_slash"]')}.click()`);
  const ui = await b.eval(`({
    rank: ${dom('[data-node="power_slash"]')}.dataset.rank,
    points: ${dom('[data-role="points"]')}.textContent,
    learnDisabled: ${dom('[data-learn="power_slash"]')}.disabled,
    provokeDisabled: ${dom('[data-learn="provoke"]')}.disabled,
  })`);
  st = await tree();
  t.check(
    'W-2. the Skills window learns Power Slash rank 1 through the real path and updates at once',
    ui.rank === '1' && ui.points.startsWith('Skill Points: 0 available') && ui.learnDisabled && ui.provokeDisabled && st.loadout.skill1 === 'power_strike',
    JSON.stringify(ui),
  );
  await b.press('Escape');

  // 3. Cast it in the game with Q.
  await b.eval(`(() => {
    const p = ${WORLD}.player;
    debug.setRng(0.5); // hit, no crit
    debug.placeMonster('slime-1', p.x, p.y + 28);
    debug.setMonsterHp('slime-1', 100000);
    debug.selectTarget('slime-1');
    debug.resetCooldowns();
    debug.clearLog();
  })()`);
  const atk = (await b.eval('debug.player()')).stats.attack;
  const def = await b.eval(`${WORLD}.world.monsterById('slime-1').combat.stats.defense`);
  // MP regenerates continuously (stats.mpRegen per second of game time) before and after the cast, so MP and
  // the remaining cooldown are checked against game time (world.now), not wall-clock sleeps: the cost is
  // exactly 8 if MP = 50 - 8 + regen x (game time since it was set to 50), and the cooldown is ~4 s if
  // remaining + (game time since the cast) is. A fixed 42 <= MP < 43 window flaked under load (MP ≈ 43.05).
  const setAt = await b.eval(`(debug.setPlayerMp(50), ${WORLD}.world.now)`);
  await b.press('KeyQ');
  await b.waitFor(`debug.log.some((e) => e.type === 'skillUsed' && e.skill === 'power_strike')`, { timeout: 2000, label: 'Power Slash cast' }).catch(() => {});
  const anim = await b.eval(ANIM);
  await b.waitFor(`debug.log.some((e) => e.type === 'damage' && e.skill === 'power_strike')`, { timeout: 2000, label: 'Power Slash hit' }).catch(() => {});
  const r = await b.eval(`(() => { const w = ${WORLD}.world, p = w.player.combat, cast = debug.log.find((e) => e.type === 'skillUsed' && e.skill === 'power_strike');
    return { now: w.now, mp: p.mp, regen: p.stats.mpRegen, castAt: cast?.t ?? null, cd: debug.player().cooldowns.power_strike }; })()`);
  const hits = await b.eval(`debug.log.filter((e) => e.type === 'damage' && e.skill === 'power_strike').map((e) => e.amount)`);
  const expected = Math.max(1, Math.round((atk * 1.25 * 100) / (100 + def)));
  const expectedMp = 50 - 8 + (r.regen * (r.now - setAt)) / 1000;
  const cdTotal = r.castAt === null ? null : r.cd + (r.now - r.castAt);
  t.check(
    'W-3. Power Slash rank 1: 8 MP, ~4 s cooldown, 125% damage, the existing Power Slash animation',
    Math.abs(r.mp - expectedMp) < 0.1 && cdTotal !== null && cdTotal > 3300 && cdTotal <= 4000 + 1 && JSON.stringify(hits) === JSON.stringify([expected]) && anim === 'player-powerSlash-down',
    JSON.stringify({ mp: r.mp, expectedMp, cdTotal, hits, expected, anim }),
  );

  // 4. A gate opens at exactly 5 Tank SP.
  await b.eval('debug.jumpToLevel(20)');
  for (let i = 0; i < 4; i++) await b.eval(`debug.learnSkill('heavy_armor_mastery')`);
  const locked = await node('provoke');
  await b.eval(`debug.learnSkill('heavy_armor_mastery')`);
  const open = await node('provoke');
  const provoke = await b.eval(`debug.learnSkill('provoke')`);
  t.check(
    'W-4. Provoke stays locked at 4 Tank SP and unlocks at 5',
    locked.blockedBy === 'branch_requirement' && open.blockedBy === null && provoke.ok,
    JSON.stringify({ locked: locked.blockedBy, open: open.blockedBy, provoke }),
  );

  // 5. Save -> reset -> load keeps the ranks; passives are not doubled.
  const before = await b.eval(`({ stats: debug.player().stats, tree: debug.skillTree() })`);
  const saved = await b.eval('debug.save()');
  await b.eval('debug.reset()');
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  const again = await b.eval(`debug.load(debug.save())`);
  const after = await b.eval(`({ stats: debug.player().stats, tree: debug.skillTree() })`);
  t.check(
    'W-5. save/load keeps every rank and the same stats (passives applied once)',
    loaded.ok && again.ok && JSON.stringify(after.tree.nodes) === JSON.stringify(before.tree.nodes) &&
      JSON.stringify(after.stats) === JSON.stringify(before.stats) && after.tree.points.available === before.tree.points.available,
    JSON.stringify({ points: after.tree.points, hp: [before.stats.maxHp, after.stats.maxHp], def: [before.stats.defense, after.stats.defense] }),
  );

  // 6. Reset in the window: everything back, Power Slash unavailable again.
  await openSkills();
  await sleep(50);
  await b.eval(`${dom('[data-action="reset"]')}.click()`);
  st = await tree();
  const slashAfter = await b.eval(`debug.skillDef('power_strike')`);
  await b.press('Escape');
  t.check(
    'W-6. reset returns every point, ranks go to 0 and Power Slash can no longer be cast',
    st.points.spent === 0 && st.points.available === 10 && st.nodes.every((n) => n.rank === 0) && slashAfter === null && st.loadout.skill1 === null,
    JSON.stringify({ points: st.points, slash: slashAfter }),
  );

  // 7. Another Class 1 job gets no fake Warrior tree.
  await b.eval(`debug.resetJobChange(); debug.forceChangeJob('archer')`);
  await openSkills();
  await sleep(50);
  const archer = await b.eval(`({
    state: ${dom('[data-skill-tree-state]')}?.dataset.skillTreeState,
    learnButtons: document.querySelectorAll('[data-window="skills"] [data-learn]').length,
  })`);
  const learn = await b.eval(`debug.learnSkill('power_slash')`);
  await b.press('Escape');
  t.check(
    'W-7. an Archer sees "not implemented yet" and cannot learn Warrior skills',
    archer.state === 'not-implemented' && archer.learnButtons === 0 && !learn.ok && learn.reason === 'no_skill_tree',
    JSON.stringify({ archer, learn }),
  );

  await b.eval('debug.reset(); debug.setRng(null)');
}

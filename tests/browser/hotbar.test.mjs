export async function hotbarSuite(b, t) {
  t.section('Persistent hotbar assignment');
  await b.eval(`debug.reset(); debug.setPeaceful(true); debug.jumpToLevel(20); debug.forceCompleteJobTrial(); debug.chooseJob('warrior'); debug.learnSkill('power_slash'); debug.learnSkill('charge')`);
  await b.waitFor(`!document.querySelector('[data-menu=skills]').disabled`);
  await b.eval(`document.querySelector('[data-menu=skills]').click()`);
  await b.eval(`document.querySelector('[data-assign-skill=power_strike]').click(); document.querySelector('[data-assign-slot=skill2]').click()`);
  t.check('HB-1. click selection swaps slots without duplicates', await b.eval(`debug.skillTree().loadout.skill1 === 'charge' && debug.skillTree().loadout.skill2 === 'power_strike'`));
  await b.press('Escape');
  await b.waitFor(`document.querySelector('[data-slot=skill2]').getAttribute('aria-label') === 'Power Slash'`);
  const saved = await b.eval('debug.save()');
  await b.eval(`debug.load(${JSON.stringify(saved)})`);
  t.check('HB-2. slot arrangement persists through reload', await b.eval(`debug.skillTree().loadout.skill2 === 'power_strike'`));
  await b.eval('debug.reset()');
}

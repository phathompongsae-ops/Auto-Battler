// The MVP quest loop in the running game, through the real UI where practical:
// Town (talk prompt, dialogue Accept / Complete, quest markers, tracker Go = Auto Move) -> Field objectives ->
// Elite -> back to Town -> Dungeon -> Boss -> back to Town and the final reward. Plus save/load mid-chain.
import { sleep } from './cdp.mjs';

export async function questFlowSuite(b, t, shot) {
  t.section('MVP quest flow (Town NPCs, quests, services)');
  const api = (expr) => b.eval(`debug.${expr}`);
  const phase = (id) => api(`questPhase('${id}')`);
  const marker = async (npcId) => (await api('npcs()')).find((n) => n.id === npcId).marker;
  const prompt = () => b.eval(`(() => { const el = document.querySelector('[data-hud="interact"]'); return el.hidden ? null : { npc: el.dataset.npc, text: el.textContent }; })()`);
  const dialog = () =>
    b.eval(`(() => { const d = document.querySelector('[data-window="npc"] [data-role="npc-dialog"]'); if (!d) return null;
      return { npc: d.dataset.npc, quests: [...d.querySelectorAll('[data-quest]')].map((q) => ({ id: q.dataset.quest, phase: q.dataset.phase, action: q.querySelector('[data-action]')?.dataset.action })),
        services: [...d.querySelectorAll('[data-service]')].map((s) => s.dataset.service), result: d.querySelector('[data-role="result"]')?.textContent ?? '' }; })()`);
  const tracker = () =>
    b.eval(`[...document.querySelectorAll('[data-hud="quest-tracker"] [data-quest]')].map((q) => ({ id: q.dataset.quest, phase: q.dataset.phase, text: q.textContent }))`);
  const clickIn = (selector) => b.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  /** Press the tracker's Go for a quest and wait until Auto Move finishes. */
  const go = async (questId, label, timeout = 30000) => {
    await clickIn(`[data-hud="quest-tracker"] [data-quest="${questId}"] [data-action="quest-go"]`);
    await sleep(100);
    return b.waitFor(`debug.navState().status !== 'moving' && debug.navState()`, { timeout, label });
  };
  /** Talk with T to the NPC in range and return the dialogue. */
  const talk = async () => {
    await b.press('KeyT');
    await sleep(120);
    return dialog();
  };
  const kill = async (id) => {
    const p = await api('player()');
    await b.eval(`debug.placeMonster('${id}', ${p.x}, ${p.y - 40}); debug.resetCooldowns(); debug.selectTarget('${id}'); debug.setMonsterHp('${id}', 1)`);
    await b.press('Space');
    await b.waitFor(`debug.monster('${id}').dead`, { timeout: 2500, label: `${id} dies` });
    await sleep(120);
  };

  await api(`reset('demo_town')`);
  await b.eval(`debug.setPeaceful(true); debug.setRng(0.5); debug.clearLog()`);
  await sleep(200);

  // 1. Town: the Captain offers the first quest ("!"); the talk prompt and the dialogue's Accept.
  const startMarker = await marker('npc_captain_rowan');
  const hint = await tracker();
  await api(`goToNpc('npc_captain_rowan')`);
  await sleep(150);
  const near = await prompt();
  let d = await talk();
  await shot('quests-01-captain-dialogue');
  await clickIn('[data-window="npc"] [data-quest="mvp_01_welcome"] [data-action="accept"]');
  await sleep(80);
  const accepted = await phase('mvp_01_welcome');
  await b.press('Escape');
  await sleep(80);
  const tracked = await tracker();
  t.check(
    'QF-1. Town: the Captain shows "!", the talk prompt appears in range, T opens the dialogue, Accept starts the quest and the tracker shows "Meet Smith Brann 0 / 1"',
    startMarker === '!' && hint[0]?.id === 'mvp_01_welcome' && hint[0].phase === 'available' && near?.npc === 'npc_captain_rowan' && near.text.includes('Captain Rowan') &&
      d?.npc === 'npc_captain_rowan' && d.quests[0]?.action === 'accept' && d.services.includes('dungeon') && accepted === 'accepted' &&
      tracked[0]?.id === 'mvp_01_welcome' && tracked[0].text.includes('Meet Smith Brann 0 / 1') && (await marker('npc_captain_rowan')) === null,
    JSON.stringify({ startMarker, hint, near, d, accepted, tracked }),
  );

  // 2. Tracker Go -> Auto Move to the smith; talking completes the objective; Complete pays once; the smith offers the next quest.
  const nav1 = await go('mvp_01_welcome', 'walk to the smith');
  const smithMarker = await marker('npc_smith_brann');
  d = await talk();
  const gold0 = (await api('equipment()')).gold;
  await clickIn('[data-window="npc"] [data-quest="mvp_01_welcome"] [data-action="complete"]');
  await sleep(80);
  const gold1 = (await api('equipment()')).gold;
  d = await dialog();
  const offered = d?.quests.find((q) => q.id === 'mvp_02_meadow');
  await clickIn('[data-window="npc"] [data-quest="mvp_02_meadow"] [data-action="accept"]');
  await sleep(80);
  const twice = await api(`turnInQuest('mvp_01_welcome', 'npc_smith_brann')`);
  await b.press('Escape');
  t.check(
    'QF-2. Go walks to Smith Brann ("?" not shown until talked to); talking readies the quest; Complete pays 50 Gold once; the smith offers and starts the next quest',
    nav1.status === 'arrived' && smithMarker === null && gold1 === gold0 + 50 && offered?.action === 'accept' && (await phase('mvp_01_welcome')) === 'completed' &&
      (await phase('mvp_02_meadow')) === 'accepted' && twice.ok === false && twice.reason === 'already_claimed' && d.services.includes('enhancement'),
    JSON.stringify({ nav1: nav1.status, smithMarker, gold0, gold1, offered, twice }),
  );

  // 3. Field: Go walks through the gate (reach the Field), wolves + their fangs, the Elite Boar.
  const nav2 = await go('mvp_02_meadow', 'walk to the Field', 30000);
  const reached = await api(`questProgress('mvp_02_meadow')`);
  await b.eval('debug.setRng(0)'); // fangs always drop
  for (const id of ['wolf-1', 'wolf-2', 'wolf-3']) await kill(id);
  const mid = await tracker();
  await b.eval('debug.setRng(0.5)');
  await kill('elite_boar-1');
  const ready = await phase('mvp_02_meadow');
  const readyTracker = await tracker();
  t.check(
    'QF-3. Field: reaching it, 3 Wolves and 3 Wolf Fangs (auto-looted) and the Elite Boar complete the quest; the tracker shows "Turn in to Captain Rowan"',
    nav2.mapId === 'demo_field' && reached.objectives[0].current === 1 && mid[0]?.text.includes('Wolves 3 / 3') && mid[0].text.includes('Wolf Fangs 3 / 3') &&
      ready === 'ready' && readyTracker[0]?.text.includes('Turn in to Captain Rowan') && (await marker('npc_captain_rowan')) === '?',
    JSON.stringify({ nav2: nav2.mapId, reached, mid, ready, readyTracker }),
  );
  await shot('quests-02-ready');

  // Save mid-chain, reset, load: the same state comes back.
  const saved = await api('save()');
  await api(`reset('demo_field')`);
  const loaded = await b.eval(`debug.load(${JSON.stringify(saved)})`);
  t.check('QF-4. quest progress survives save -> reset -> load', loaded.ok && (await phase('mvp_01_welcome')) === 'completed' && (await phase('mvp_02_meadow')) === 'ready', JSON.stringify(loaded));
  await b.eval('debug.setPeaceful(true); debug.setRng(0.5)');

  // 4. Back to Town: Go walks to the Captain across maps; Complete; accept the Crypt quest.
  const nav3 = await go('mvp_02_meadow', 'return to the Captain', 40000);
  d = await talk();
  const goldA = (await api('equipment()')).gold;
  const stonesA = (await api('player()')).inventory.enhancement_stone ?? 0;
  await clickIn('[data-window="npc"] [data-quest="mvp_02_meadow"] [data-action="complete"]');
  await sleep(80);
  const goldB = (await api('equipment()')).gold;
  const stonesB = (await api('player()')).inventory.enhancement_stone ?? 0;
  await clickIn('[data-window="npc"] [data-quest="mvp_03_crypt"] [data-action="accept"]');
  await sleep(80);
  await b.press('Escape');
  const feed = await b.eval(`[...document.querySelectorAll('[data-hud="loot-feed"] [data-loot-kind="quest"]')].map((e) => e.textContent)`);
  t.check(
    'QF-5. Go returns to Town and the Captain; Complete grants 150 Gold and 3 Enhancement Stones once (reward feedback shown); the Crypt quest is accepted',
    nav3.status === 'arrived' && nav3.mapId === 'demo_town' && goldB === goldA + 150 && stonesB === stonesA + 3 && (await phase('mvp_03_crypt')) === 'accepted' &&
      feed.some((l) => l.startsWith('Quest complete: Trouble in the Meadow')),
    JSON.stringify({ nav3: [nav3.status, nav3.mapId], goldA, goldB, stonesA, stonesB, feed }),
  );

  // 5. Dungeon: Go walks through the Dungeon Gate (reach it), defeat the Crypt Lord.
  const nav4 = await go('mvp_03_crypt', 'walk into the Crypt', 30000);
  const inCrypt = await api(`questProgress('mvp_03_crypt')`);
  await kill('crypt_lord-1');
  const bossDone = await phase('mvp_03_crypt');
  t.check(
    'QF-6. Dungeon: Go walks through the gate into the Crypt (entrance reached); defeating the Crypt Lord readies the quest',
    nav4.mapId === 'demo_crypt' && inCrypt.objectives[0].current === 1 && bossDone === 'ready',
    JSON.stringify({ nav4: nav4.mapId, inCrypt, bossDone }),
  );

  // 6. Return to the Captain and claim the final MVP reward.
  const nav5 = await go('mvp_03_crypt', 'return from the Crypt', 40000);
  await talk();
  const before = { gold: (await api('equipment()')).gold, inv: (await api('player()')).inventory };
  await clickIn('[data-window="npc"] [data-quest="mvp_03_crypt"] [data-action="complete"]');
  await sleep(80);
  const after = { gold: (await api('equipment()')).gold, inv: (await api('player()')).inventory };
  await b.press('Escape');
  const again = await api(`turnInQuest('mvp_03_crypt', 'npc_captain_rowan')`);
  const markers = (await api('npcs()')).filter((n) => n.marker).map((n) => n.id);
  await shot('quests-03-complete');
  t.check(
    'QF-7. back in Town the Crypt quest is turned in: 600 Gold, 2 Enchant Stones and a Protection Stone, once; the whole chain is complete and no NPC shows a marker',
    nav5.mapId === 'demo_town' && after.gold === before.gold + 600 && (after.inv.enchant_stone ?? 0) === (before.inv.enchant_stone ?? 0) + 2 &&
      (after.inv.protection_stone ?? 0) === (before.inv.protection_stone ?? 0) + 1 && again.reason === 'already_claimed' &&
      (await phase('mvp_03_crypt')) === 'completed' && markers.length === 0 && (await tracker()).length === 0,
    JSON.stringify({ nav5: nav5.mapId, before: before.gold, after: after.gold, again, markers }),
  );

  // 7. Services: the other Town NPCs are interactable; locked services explain why; the Pet Stable is "coming later".
  // The chain's EXP may have levelled past some unlocks: lock these two so the locked path is what's shown.
  await b.eval("debug.forceLockFeature('enchant'); debug.forceLockFeature('crafting')");
  const services = {};
  for (const npcId of ['npc_enchanter_lyra', 'npc_crafter_odo', 'npc_stablekeeper_mira', 'npc_smith_brann']) {
    await api(`goToNpc('${npcId}')`);
    await sleep(100);
    const dd = await talk();
    const service = dd?.services[0];
    await clickIn(`[data-window="npc"] [data-service="${service}"]`);
    await sleep(80);
    services[npcId] = { service, opened: await b.eval(`[...document.querySelectorAll('[data-window]')].map((w) => w.dataset.window)`), result: (await dialog())?.result ?? null };
    await b.press('Escape');
    await sleep(50);
  }
  t.check(
    'QF-8. Enchant / Craft / Pet / Enhancement NPCs open their services (locked ones explain the unlock level; the Pet Stable says it comes later)',
    services.npc_enchanter_lyra.service === 'enchant' && /Lv18/.test(services.npc_enchanter_lyra.result ?? '') &&
      services.npc_crafter_odo.service === 'craft' && /Lv20/.test(services.npc_crafter_odo.result ?? '') &&
      services.npc_stablekeeper_mira.service === 'pet' && /Coming later/.test(services.npc_stablekeeper_mira.result ?? '') &&
      services.npc_smith_brann.service === 'enhancement',
    JSON.stringify(services),
  );
  // With the features unlocked, the smith and the enchanter open their real screens.
  await b.eval(`debug.forceUnlockFeature('enhancement'); debug.forceUnlockFeature('enchant')`);
  await api(`goToNpc('npc_smith_brann')`);
  await sleep(100);
  await talk();
  await clickIn('[data-window="npc"] [data-service="enhancement"]');
  await sleep(80);
  const enhanceOpen = await b.eval(`!!document.querySelector('[data-window="enhancement"]')`);
  await b.press('Escape');
  t.check('QF-9. once unlocked, the smith opens the Enhancement screen', enhanceOpen);

  await api('reset()');
  await b.eval('debug.setRng(null)');
}

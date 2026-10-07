// Floating combat numbers in the running game: fixed pools (no leaks under a burst), bounded
// target-local slotting (rapid hits never stack on one point), and the normal / critical
// hierarchy as rendered. Synthetic combat events drive only the presentation layer.
import { sleep } from './cdp.mjs';

export async function combatFeedbackSuite(b, t, shot) {
  t.section('Floating combat numbers');
  await b.eval(`debug.reset(); debug.setPeaceful(true); debug.teleport(528, 464); debug.placeMonster('elite_boar-1', 528, 400)`);
  await sleep(300);
  const sceneCounts = `(() => { const l = game.scene.getScene('World').children.list;
    return { text: l.filter((o) => o.type === 'Text').length, graphics: l.filter((o) => o.type === 'Graphics').length, total: l.length }; })()`;
  const before = await b.eval(sceneCounts);
  // 120 hits in a burst: normal, heavy, crit, damage taken, heal and miss.
  const peak = await b.eval(`(() => {
    const w = game.scene.getScene('World').world; const ev = w.events; let peak = 0;
    const count = () => game.scene.getScene('World').children.list.filter((o) => o.type === 'Text' && o.depth === 1000000 && o.active && o.visible).length;
    for (let i = 0; i < 120; i++) {
      const toPlayer = i % 7 === 0;
      ev.emit('damage', { sourceId: toPlayer ? 'elite_boar-1' : w.player.id, targetId: toPlayer ? w.player.id : 'elite_boar-1', skillId: 'basic_attack', amount: 10 + i, crit: i % 4 === 0, heavy: i % 5 === 0 });
      if (i % 11 === 0) ev.emit('heal', { targetId: w.player.id, amount: 25 });
      if (i % 13 === 0) ev.emit('miss', { sourceId: w.player.id, targetId: 'elite_boar-1', skillId: 'basic_attack' });
      peak = Math.max(peak, count());
    }
    return peak;
  })()`);
  await sleep(1200);
  const after = await b.eval(sceneCounts);
  t.check(
    'FX-1. a 120-hit burst stays inside the fixed pools (≤ 32 live numbers) and leaves no text / graphics behind',
    peak <= 32 && after.text === before.text && after.graphics === before.graphics && after.total === before.total,
    JSON.stringify({ before, after, peak }),
  );

  // Five rapid hits on one target: five different start spots, all close to the target.
  const spots = await b.eval(`(() => {
    const s = game.scene.getScene('World'); const w = s.world;
    const boar = w.getEntity('elite_boar-1');
    for (let i = 0; i < 5; i++) w.events.emit('damage', { sourceId: w.player.id, targetId: 'elite_boar-1', skillId: 'basic_attack', amount: 40 + i, crit: false, heavy: false });
    return s.children.list.filter((o) => o.type === 'Text' && o.active && o.visible && /^4[0-4]$/.test(o.text)).map((o) => ({ dx: Math.round(o.x - boar.x), text: o.text, y: o.y }));
  })()`);
  const distinct = new Set(spots.map((p) => `${p.dx},${Math.round(p.y)}`)).size;
  t.check(
    'FX-2. rapid hits on one target fan out in a small pattern (no exact overlap, all within ±14 px of the target)',
    spots.length === 5 && distinct === 5 && spots.every((p) => Math.abs(p.dx) <= 14),
    JSON.stringify(spots),
  );
  await sleep(900);

  // Hierarchy as rendered: a critical is ~1.5x a normal hit, in a different colour, with a spark.
  const looks = await b.eval(`(() => {
    const s = game.scene.getScene('World'); const w = s.world;
    w.events.emit('damage', { sourceId: w.player.id, targetId: 'elite_boar-1', skillId: 'basic_attack', amount: 37, crit: false, heavy: false });
    w.events.emit('damage', { sourceId: w.player.id, targetId: 'elite_boar-1', skillId: 'basic_attack', amount: 88, crit: true, heavy: false });
    const find = (t) => s.children.list.find((o) => o.type === 'Text' && o.active && o.text === t);
    const style = (o) => ({ size: parseFloat(o.style.fontSize), color: o.style.color, stroke: o.style.strokeThickness });
    return { normal: style(find('37')), crit: style(find('88!')), sparks: s.children.list.filter((o) => o.type === 'Graphics' && o.active && o.visible && o.depth === 999999).length };
  })()`);
  await sleep(160);
  await shot('combat-numbers-01-normal-crit');
  t.check(
    'FX-3. a critical reads first: ~1.5x the normal size, its own colour, a heavier outline and a spark',
    looks.crit.size / looks.normal.size >= 1.4 && looks.crit.size / looks.normal.size <= 1.6 && looks.crit.color !== looks.normal.color &&
      looks.crit.stroke > looks.normal.stroke && looks.sparks >= 1,
    JSON.stringify(looks),
  );
  await sleep(900);
  await b.eval('debug.reset(); debug.setPeaceful(true)');
}

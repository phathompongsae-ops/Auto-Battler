// NPC figures: every Town NPC stands on its feet line with its name plate above; the production-master path
// (data/npcArt.ts, verified with a contract-shaped fixture until art is delivered) anchors the body on the
// character contract with a breathing idle; interaction and talk are unchanged. Viewport captures for review.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;

export async function npcFiguresSuite(b, t, shot) {
  t.section('NPC figures');
  const figures = () => b.eval(`(() => { const s = ${S};
    return s.children.list
      .filter((o) => o.texture && (o.texture.key === 'npc-base' || o.texture.key.startsWith('npc-art-')))
      .map((o) => ({ key: o.texture.key, x: o.x, y: o.y, scaleY: o.scaleY, top: o.getBounds().top, bottom: o.getBounds().bottom, originY: o.originY, art: o.getData && o.getData('npcArt') })); })()`);
  const npcs = await b.eval(`debug.npcs()`);
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true); true`);
  await sleep(300);
  const town = npcs.filter((n) => n.mapId === 'demo_town');
  const placed = await figures();
  const plates = await b.eval(`${S}.children.list.filter((o) => o.type === 'Text' && ${JSON.stringify(town.map((n) => n.name))}.includes(o.text)).map((o) => ({ name: o.text, x: o.x, y: o.y }))`);
  t.check('NPC-1. all six Town NPCs are drawn from their production master on their stand point (feet 6 px below it), each with its name plate above the figure',
    town.length === 6 && town.every((n) => placed.some((f) => f.key === `npc-art-${n.id}` && Math.abs(f.x - n.x) < 0.5 && Math.abs(f.y - (n.y + 6)) < 0.5)) &&
      town.every((n) => plates.some((p) => p.name === n.name && p.y < n.y + 6 - 44)),
    JSON.stringify({ town: town.map((n) => n.id), placed: placed.length, plates: plates.length }));

  // Every role plate clears its figure's real top (hat brim, staff tip, hair) by >= 4 px, breathing included.
  const clearance = await b.eval(`(async () => { const m = await import('/src/graphics/npcArt.ts'), { NPCS } = await import('/src/data/npcData.ts'), s = ${S};
    return ${JSON.stringify(town.map((n) => ({ id: n.id, y: n.y })))}.map((n) => {
      const key = 'npc-art-' + n.id, top = m.npcArtTopRow(s, key), feet = n.y + 6, head = feet - (154 - top) * (40 / 125) * 1.014;
      const role = s.children.list.find((o) => o.type === 'Text' && o.text === NPCS[n.id].title);
      return { id: n.id, topRow: top, gap: role ? Math.round((head - role.y) * 10) / 10 : null };
    }); })()`);
  t.check('NPC-4. each role plate clears its own figure (hat, staff, hair) by at least 4 px, breathing included',
    clearance.length === 6 && clearance.every((c) => c.gap !== null && c.gap >= 4), JSON.stringify(clearance));

  // Production path on the Captain (the delivered master; the contract-shaped fixture only stands in when no master is listed).
  const captain = town.find((n) => n.id === 'npc_captain_rowan');
  await b.eval(`debug.installNpcArtFixture('npc_captain_rowan'); debug.reset('demo_town'); debug.setPeaceful(true); true`);
  await sleep(300);
  const art = await b.eval(`(() => { const s = ${S}, o = s.children.list.find((x) => x.getData && x.getData('npcArt') === 'npc_captain_rowan');
    if (!o) return null; const tw = s.tweens.getTweensOf(o); const f = o.frame;
    return { x: o.x, y: o.y, scale: o.scaleX, scaleY: o.scaleY, originX: o.originX, originY: o.originY, w: f.width, h: f.height, tweens: tw.length, depth: o.depth,
      shadow: s.children.list.some((x) => x.type === 'Ellipse' && Math.abs(x.x - o.x) < 0.5 && Math.abs(x.y - (o.y - 1)) < 0.5),
      role: s.children.list.find((x) => x.type === 'Text' && x.text === "Adventurers' Guild")?.y ?? null }; })()`);
  await b.eval(`debug.teleport(${captain.x}, ${captain.y + 44}); true`);
  await sleep(500);
  const near = await b.eval(`debug.nearbyNpc()`);
  for (const [w, h] of [[960, 540], [844, 390], [640, 360]]) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 });
    await sleep(250);
    await shot(`npc-captain-${w}x${h}`);
  }
  await b.setViewport({ mobile: false });
  const s = 40 / 125;
  // Body: 121 source px above the feet row → ~38.7 world px; its feet sit exactly on the stand point's feet line.
  const bodyTop = art && art.y - 121 * art.scale;
  t.check('NPC-2. a production master is drawn on the character contract: feet row and axis on the stand point, 0.32 scale (~39 world px body), soft shadow, breathing idle anchored at the feet; name plates clear the head',
    !!art && Math.abs(art.x - captain.x) < 0.5 && Math.abs(art.y - (captain.y + 6)) < 0.5 && Math.abs(art.scale - s) < 1e-6 &&
      Math.abs(art.originX - 95 / 192) < 1e-6 && Math.abs(art.originY - 154 / 192) < 1e-6 && art.w === 192 && art.h === 192 &&
      art.tweens === 1 && art.scaleY >= s - 1e-6 && art.scaleY <= s * 1.015 && art.shadow && Math.abs(art.y - bodyTop - 38.72) < 0.1 && art.role !== null && art.role <= bodyTop - 4,
    JSON.stringify(art));
  t.check('NPC-3. interaction is unchanged: standing near the NPC finds it to talk to', near === 'npc_captain_rowan', String(near));
  await b.eval(`debug.removeNpcArtFixture('npc_captain_rowan'); debug.reset(); true`);
  await sleep(200);
}

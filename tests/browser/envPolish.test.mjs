// Visual Quality Pass 1: Crypt portal stairwells over their real portal areas (no purple placeholder cells), iron
// portcullis seals on closed Story gates, pond depth shading, soft contact shadows, landmark labels stepping back
// under the player. Visual only: portals still trigger where they did, gates still block, collision unchanged.
import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;

export async function envPolishSuite(b, t, shot) {
  t.section('Environment polish (Visual Quality Pass 1)');
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(400);
  const crypt = await b.eval(`(() => { const s = ${S};
    const arts = s.children.list.filter((o) => o.texture?.key === 'env-crypt-portal').map((o) => { const r = o.getBounds(); return { x: o.x, top: r.top, bottom: r.bottom, left: r.left, right: r.right, flip: o.flipY }; });
    const portals = s.world.maps.map.portals.map((p) => ({ id: p.id, x: (p.area.x + p.area.w / 2) * 32, y0: p.area.y * 32, y1: (p.area.y + p.area.h) * 32 }));
    const skin = s.groundVisualLayers.find((l) => l.tilemap.tileWidth === 64);
    const portalCellsSkinned = s.world.maps.map.portals.every((p) => { const tile = skin.layer.data[p.area.y][p.area.x]; return tile && tile.index >= 0; });
    const seals = s.gateBarriers.states(), sealImgs = s.children.list.filter((o) => o.texture?.key === 'env-gate-seal').length;
    return { arts, portals, portalCellsSkinned, seals, sealImgs }; })()`);
  t.check('VQ-1. each Crypt portal shows a stone stairwell exactly over its portal area (opening toward its room), its cells skinned as floor (no purple placeholder)',
    crypt.arts.length === crypt.portals.length && crypt.portals.every((p) => crypt.arts.some((a) => Math.abs(a.x - p.x) < 0.5 && a.top <= p.y0 && a.bottom >= p.y1)) && crypt.portalCellsSkinned,
    JSON.stringify(crypt));
  t.check('VQ-2. every closed Story gate is drawn as an iron portcullis seal (image art), still one per closed gate',
    crypt.seals.length === 3 && crypt.seals.every((x) => x.visible) && crypt.sealImgs === 3, JSON.stringify({ seals: crypt.seals, imgs: crypt.sealImgs }));

  // Portal still triggers: walking onto the entrance exit leaves the Crypt as before.
  await b.eval(`debug.teleport(16 * 32, 61 * 32); true`);
  await b.keyDown('ArrowDown');
  await b.waitFor(`debug.mapInfo().mapId === 'demo_town'`, { timeout: 4000, label: 'crypt exit' }).catch(() => {});
  await b.keyUp('ArrowDown');
  const leftTo = await b.eval(`debug.mapInfo().mapId`);
  t.check('VQ-3. the Crypt entrance exit still takes the player to Town (portal trigger unchanged under the art)', leftTo === 'demo_town', leftTo);

  // Landmark label steps back while the player stands under it, and returns.
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true); true`);
  await sleep(300);
  await b.eval(`debug.teleport(16 * 32, 42 * 32 + 30); true`);
  await sleep(250);
  const under = await b.eval(`${S}.children.list.find((o) => o.type === 'Text' && o.text === 'SECTION I').alpha`);
  await b.eval(`debug.teleport(16 * 32, 47 * 32); true`);
  await sleep(250);
  const away = await b.eval(`${S}.children.list.find((o) => o.type === 'Text' && o.text === 'SECTION I').alpha`);
  t.check('VQ-4. a landmark name fades while the player stands under it (the hero stays readable) and returns when they move on', under < 0.3 && away > 0.8, JSON.stringify({ under, away }));

  // Pond depth and soft shadows in the Field.
  await b.eval(`debug.reset('demo_field'); debug.setPeaceful(true); true`);
  await sleep(400);
  const field = await b.eval(`(() => { const s = ${S};
    const shadows = s.children.list.filter((o) => o.texture?.key === 'env-soft-shadow' && o.visible);
    const graphics = s.children.list.filter((o) => o.type === 'Graphics' && o.depth > -0.84 && o.depth < -0.81);
    return { softShadows: shadows.length, monsters: s.world.monsters.filter((m) => !m.combat.dead && m.visible).length, waterLayers: graphics.length }; })()`);
  await b.eval(`debug.teleport(31 * 32, 11 * 32); true`);
  await sleep(500);
  await shot('vq-field-pond');
  t.check('VQ-5. the pond gets its depth shading and glint layers; the player and every visible monster stand on a soft (feathered) contact shadow',
    field.waterLayers === 2 && field.softShadows === field.monsters + 1, JSON.stringify(field));
  await b.eval(`debug.reset(); true`);
}

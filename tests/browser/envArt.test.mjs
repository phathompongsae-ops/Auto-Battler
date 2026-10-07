// Environment rendering spike (2x art) in the running game: PNG preferred over code-drawn placeholders,
// half-scale drawing, linear filtering, a visual-only ground layer, the Forge facade, collision unchanged,
// tall props fading over the player, and the ?envArt=off fallback.
import { sleep } from './cdp.mjs';

const LINEAR = 0; // Phaser.Textures.FilterMode.LINEAR
const NEAREST = 1;

const SCENE = `game.scene.getScene('World')`;
const tex = (key) =>
  `(() => { const t = game.textures.get('${key}'); const s = t.source[0]; return { key: t.key, canvas: s.image instanceof HTMLCanvasElement, w: s.width, h: s.height, filter: s.scaleMode }; })()`;

export async function envArtSuite(b, t, shot, url) {
  t.section('Environment rendering spike (2x Town validation art)');
  await b.eval(`debug.reset('demo_town'); debug.setPeaceful(true)`);
  await sleep(200);

  // 1. PNG wins over the placeholder (same key), linear filtering; other keys keep the code-drawn fallback.
  const monument = await b.eval(tex('prop-monument'));
  // Field trees keep the fallback; Town lawn decals now have matching 2x PNGs.
  const placeholder = await b.eval(tex('prop-tree'));
  const ground = await b.eval(tex('env-ground-town'));
  t.check(
    'ENV-1. a 2x PNG replaces the placeholder under the same texture key with linear filtering; keys without a PNG keep the code-drawn placeholder',
    !monument.canvas && monument.w === 256 && monument.filter === LINEAR && !ground.canvas && ground.filter === LINEAR && placeholder.canvas && placeholder.filter === NEAREST,
    JSON.stringify({ monument, placeholder, ground }),
  );

  // 2. Half-scale drawing on the same footprint: the monument is 128 world px wide, bottom on its footprint.
  const placed = await b.eval(`(() => {
    const s = ${SCENE};
    const m = s.children.list.find((o) => o.texture?.key === 'prop-monument');
    const decal = s.children.list.find((o) => o.texture?.key === 'prop-grass_tuft');
    return { scale: m.scaleX, w: m.displayWidth, bottom: m.y, originY: m.originY, decalScale: decal.scaleX };
  })()`);
  t.check(
    'ENV-2. monument and lawn decals use half-scale 2x art, bottom-centred on their footprints',
    placed.scale === 0.5 && placed.w === 128 && placed.bottom === (5 + 2) * 32 && placed.originY === 1 && placed.decalScale === 0.5,
    JSON.stringify(placed),
  );

  // 3. Visual ground: corner (Wang) ground on the half-tile dual grid (grass, dirt, cobble, plaza) + non-ground tiles, every layer on the 32 px world grid,
  //    above the code-drawn layer, never colliding; the code-drawn layer is hidden but stays the collision source.
  const layers = await b.eval(`(() => {
    const s = ${SCENE};
    const collides = (layer) => layer.layer.data.some((row) => row.some((tile) => tile && tile.collides));
    const inColliders = (layer) => s.physics.world.colliders.getActive().some((c) => c.object1 === layer || c.object2 === layer);
    return {
      count: s.groundVisualLayers.length,
      scales: s.groundVisualLayers.map((l) => l.scaleX),
      worldTile: s.groundVisualLayers.map((l) => l.tilemap.tileWidth * l.scaleX),
      dualOffset: [s.groundVisualLayers[0]?.x, s.groundVisualLayers[0]?.y],
      baseVisible: s.groundLayer.visible,
      depths: s.groundVisualLayers.map((l) => l.depth),
      visualCollide: s.groundVisualLayers.some(collides),
      visualInColliders: s.groundVisualLayers.some(inColliders),
      baseCollides: collides(s.groundLayer),
      baseInColliders: inColliders(s.groundLayer),
      baseDepth: s.groundLayer.depth,
    };
  })()`);
  t.check(
    'ENV-3. the visual ground layers (dual-grid corner ground incl. the plaza, non-ground tiles) sit on the 32 px world grid above the code-drawn layer and never collide; the hidden code-drawn layer stays the collision source',
    layers.count === 2 && layers.worldTile.every((x) => x === 32) && layers.scales.every((x) => x === 0.5) && layers.dualOffset[0] === -16 && layers.dualOffset[1] === -16 &&
      !layers.baseVisible && layers.depths.every((d) => d > layers.baseDepth && d < -0.6) &&
      !layers.visualCollide && !layers.visualInColliders && layers.baseCollides && layers.baseInColliders,
    JSON.stringify(layers),
  );

  // 4. Forge facade over its Roof footprint; the footprint still blocks; banners on it are hidden.
  const forge = await b.eval(`(() => {
    const s = ${SCENE};
    const f = s.children.list.find((o) => o.texture?.key === 'building-forge');
    const banners = s.children.list.filter((o) => o.texture?.key === 'prop-banner').map((o) => [o.x, o.y]);
    return { found: !!f, w: f?.displayWidth, bottom: f?.y, scale: f?.scaleX, bannersOnForge: banners.filter(([x, y]) => x > 34 * 32 && x < 42 * 32 && y <= 7 * 32).length };
  })()`);
  await b.eval(`debug.teleport(${38 * 32}, ${7 * 32 + 20})`);
  await sleep(80);
  await b.keyDown('ArrowUp');
  await sleep(600);
  await b.keyUp('ArrowUp');
  const blocked = await b.eval('debug.player()');
  t.check(
    'ENV-4. the Forge facade covers its Roof footprint (256 world px wide, half scale); the footprint still blocks the player; its banner props are hidden',
    forge.found && forge.w === 256 && forge.bottom === 7 * 32 && forge.scale === 0.5 && forge.bannersOnForge === 0 && blocked.y >= 7 * 32 - 4, // body top (y + 4) stops at the footprint edge
    JSON.stringify({ forge, y: blocked.y }),
  );

  // 5. A tall prop fades while the player stands behind it, and is opaque again in front of it.
  const alphaOf = `${SCENE}.children.list.find((o) => o.texture?.key === 'prop-cherry_tree' && o.x === 14 * 32 + 16 && o.y === 6 * 32).alpha`;
  await b.eval(`debug.teleport(${14 * 32 + 16}, ${5 * 32 - 4})`);
  await sleep(120);
  const behind = await b.eval(alphaOf);
  await shot('env-01-behind-tree');
  await b.eval(`debug.teleport(${14 * 32 + 16}, ${6 * 32 + 12})`);
  await sleep(120);
  const front = await b.eval(alphaOf);
  t.check('ENV-5. a tall prop fades while it covers the player and is opaque when the player is in front', behind < 1 && front === 1, JSON.stringify({ behind, front }));

  await b.eval(`debug.teleport(704, 656)`);
  await sleep(500);
  await shot('env-02-plaza');

  // Review the completed Town at gameplay scale and as a whole. Camera changes
  // are test-only and restored before the remaining interaction suites.
  const wallLayer = await b.eval(`(() => {
    const s = ${SCENE};
    const wall = s.groundVisualLayers.find((l) => l !== s.groundVisualLayers[0] && l.texture?.key === 'env-ground-town-wang');
    const layers = s.groundVisualLayers.filter((l) => l.tilemap.tileWidth === 64);
    const frames = layers.at(-1).layer.data.flat().filter((tile) => tile && tile.index >= 0).map((tile) => tile.index);
    return { frames: [...new Set(frames)], scale: layers.at(-1).scaleX };
  })()`);
  t.check('ENV-7. Town walls use the production atlas at half scale', wallLayer.scale === 0.5 && wallLayer.frames.length === 1 && wallLayer.frames[0] === 69, JSON.stringify(wallLayer));
  try {
    await b.eval(`${SCENE}.cameras.main.stopFollow(); ${SCENE}.cameras.main.useBounds = false; document.querySelector('[data-ui-root]').style.visibility = 'hidden'; ${SCENE}.cameras.main.setZoom(0.5).centerOn(704, 512); true`);
    await sleep(150);
    await shot('town-01-overview');
    await b.eval(`${SCENE}.cameras.main.useBounds = true`);
    for (const [name, x, y] of [
      ['town-02-wall', 90, 480], ['town-03-plaza', 704, 590],
      ['town-04-hall-of-legends', 704, 190], ['town-05-forge', 1216, 205],
      ['town-06-market', 255, 495], ['town-07-gate', 1320, 515],
    ]) {
      await b.eval(`${SCENE}.cameras.main.setZoom(1.35).centerOn(${x}, ${y}); true`);
      await sleep(120);
      await shot(name);
    }
  } finally {
    await b.eval(`document.querySelector('[data-ui-root]').style.visibility = ''; ${SCENE}.cameras.main.setZoom(1.35).startFollow(${SCENE}.player, true, 0.15, 0.15); true`);
  }

  // 6. Fallback: ?envArt=off keeps every environment texture code-drawn and adds no visual ground layer.
  await b.eval('window.__stale = true');
  await b.goto(`${url}?envArt=off`);
  await b.waitFor(`!window.__stale && !!(window.debug && window.game && window.game.scene.getScene('World').player)`, { timeout: 15000, label: 'boot (envArt=off)' });
  await sleep(300);
  const off = { monument: await b.eval(tex('prop-monument')), layers: await b.eval(`${SCENE}.groundVisualLayers.length`), baseVisible: await b.eval(`${SCENE}.groundLayer.visible`), forge: await b.eval(`game.textures.exists('building-forge')`) };
  const offScale = await b.eval(`${SCENE}.children.list.find((o) => o.texture?.key === 'prop-monument').scaleX`);
  t.check(
    'ENV-6. without the PNGs (?envArt=off) the code-drawn placeholders render at 1x and no visual ground layer or facade is added',
    off.monument.canvas && off.monument.filter === NEAREST && offScale === 1 && off.layers === 0 && off.baseVisible && !off.forge,
    JSON.stringify({ off, offScale }),
  );
}

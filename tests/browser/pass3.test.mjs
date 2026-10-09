import { sleep } from './cdp.mjs';

const S = `game.scene.getScene('World')`;
export async function pass3Suite(b, t, shot, url, boot) {
  t.section('Pass 3 environment / geometry lock');
  const snapshot = async (map) => {
    await b.eval(`debug.reset('${map}'); debug.setPeaceful(true)`);
    await sleep(160);
    return b.eval(`(() => {
      const s = ${S};
      return { tiles: s.groundLayer.layer.data.map(row => row.map(tile => [tile.index, tile.collides])),
        props: Array.from(s.physics.world.staticBodies).map(body => [body.x, body.y, body.width, body.height]),
        monsters: s.world.monsters.map(m => [m.id, m.spawnX, m.spawnY, m.hitRadius, m.body.x-m.x, m.body.y-m.y, m.body.width, m.body.height]),
        player: [s.player.body.x-s.player.x,s.player.body.y-s.player.y,s.player.body.width,s.player.body.height] };
    })()`);
  };
  const on = {};
  for (const map of ['demo_town', 'demo_field', 'demo_crypt']) on[map] = await snapshot(map);
  await b.eval(`debug.reset(); debug.setPeaceful(true)`);
  const field = await b.eval(`(() => {
    const s = ${S}, layers = s.groundVisualLayers;
    const water = s.groundLayer.layer.data.flat().filter(tile => tile.index === 4);
    return { key: layers[0].tileset[0].name, scale: layers[0].scaleX, offset: [layers[0].x,layers[0].y],
      visualCollision: layers.some(l => l.layer.data.some(row => row.some(tile => tile.collides))),
      water: water.length, blockedWater: water.every(tile => tile.collides), hiddenBase: !s.groundLayer.visible,
      props: ['bush','rock','big_rock','signpost','tent','campfire','stump'].map(kind => {
        const tex = s.textures.get('prop-'+kind), img = tex.source[0].image;
        return {kind, png: !(img instanceof HTMLCanvasElement), size: [img.width/2,img.height/2],
          placed: s.children.list.filter(o=>o.texture?.key==='prop-'+kind).map(o=>({origin:[o.originX,o.originY],scale:o.scaleX,depth:o.depth,y:o.y}))};
      }) };
  })()`);
  t.check('P3-1. Field Wang art uses half-scale dual grid; visual layers never collide; every water cell stays solid',
    field.key === 'env-ground-field-wang' && field.scale === .5 && field.offset.every(v=>v===-16) && !field.visualCollision && field.hiddenBase && field.water > 0 && field.blockedWater, JSON.stringify(field));
  t.check('P3-2. accepted Field props load as PNGs, bottom-centred at half scale on their existing depth anchors',
    field.props.every(p=>p.png && p.placed.every(o=>o.origin[0]===.5 && o.origin[1]===1 && o.scale===.5 && o.depth<=o.y)), JSON.stringify(field.props));
  const points = await b.eval(`(() => {
    const s=${S}, tiles=s.groundLayer.layer.data.flat(), out=[];
    for(const [name,index] of [['pond',4],['darkgrass',10],['moss',9],['dirt-den',8]]) {
      const cells=tiles.filter(t=>t.index===index);
      out.push([name,cells.reduce((n,t)=>n+t.pixelX,0)/cells.length+16,cells.reduce((n,t)=>n+t.pixelY,0)/cells.length+16]);
    }
    const camp=s.children.list.find(o=>o.texture?.key==='prop-tent'); if(camp)out.push(['camp',camp.x,camp.y]);
    return out;
  })()`);
  for(const [name,x,y] of points) { await b.eval(`debug.teleport(${x},${y})`); await sleep(420); await shot('pass3-field-'+name); }
  const guardian=await b.eval(`debug.monster('grove_guardian-1')`);
  await b.eval(`debug.teleport(${guardian.spawnX-70},${guardian.spawnY-40})`); await sleep(420); await shot('pass3-field-guardian');
  await b.eval(`debug.reset('demo_crypt'); debug.setPeaceful(true)`);
  for(const [name,id] of [['brute','crypt_brute-1'],['knight','crypt_knight-1'],['lord','crypt_lord-1']]) {
    const at=await b.eval(`debug.monster('${id}')`);
    await b.eval(`debug.teleport(${at.spawnX},${at.spawnY+55})`); await sleep(420); await shot('pass3-crypt-'+name);
  }
  // The top-aligned utility row must never cover the boss frame (its "Winding up!" warning) on narrow screens.
  await b.eval(`debug.selectTarget('crypt_lord-1'); true`);
  const band = [];
  for (const [width, height] of [[960, 540], [844, 390], [640, 360]]) {
    await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 }); await sleep(250);
    band.push(await b.eval(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(), f = r('[data-hud="target"]'), u = r('.hud-utilities'), p = r('.hud__top-left');
      return { size: '${width}x${height}', shown: f.width > 0, clearRight: f.right <= u.left, clearLeft: f.left >= p.right, frame: [f.left, f.right].map(Math.round), gap: [p.right, u.left].map(Math.round) }; })()`));
  }
  await b.setViewport({ mobile: false }); await sleep(150);
  t.check('P3-6. the boss target frame stays clear of the utility row and player frame at 960x540, 844x390 and 640x360',
    band.every((g) => g.shown && g.clearRight && g.clearLeft), JSON.stringify(band));
  const resources = await b.eval(`(() => { const s=${S}, textures=Object.values(game.textures.list);
    return { objects:s.children.list.length, textures:textures.length, rgbaMiB:textures.reduce((n,t)=>n+t.source.reduce((sum,src)=>sum+src.width*src.height*4,0),0)/1048576, zoom:s.cameras.main.zoom };
  })()`);
  t.check('P3-3. runtime camera zoom remains 1.65', resources.zoom===1.65, JSON.stringify(resources));
  console.log('  Pass 3 texture/object sample: '+JSON.stringify(resources));
  await sleep(1000);
  const stability=await b.eval(`({objects:${S}.children.list.length, motionStates:${S}.monsterMotion.states.size, monsters:${S}.world.monsters.length})`);
  t.check('P3-5. procedural idle updates add no display objects and retain at most one motion state per live actor',
    stability.objects===resources.objects && stability.motionStates<=stability.monsters, JSON.stringify(stability));
  await b.goto(`${url}?envArt=off&monsterArt=off`); await boot();
  for(const map of Object.keys(on)) {
    const off=await snapshot(map);
    const a=JSON.stringify(on[map]), z=JSON.stringify(off);
    // Float arithmetic expressing the same world body in different source frames may differ below a nanometre.
    const near=(x,y)=> typeof x==='number' && typeof y==='number' ? Math.abs(x-y)<1e-7 :
      Array.isArray(x) && Array.isArray(y) ? x.length===y.length && x.every((v,i)=>near(v,y[i])) : x===y;
    t.check('P3-4. art-on/off geometry is identical in '+map,
      JSON.stringify(on[map].tiles)===JSON.stringify(off.tiles) && near(on[map].props,off.props) && near(on[map].monsters,off.monsters) && near(on[map].player,off.player), a===z ? 'exact' : JSON.stringify({on:on[map].monsters,off:off.monsters}));
  }
  await b.goto(url); await boot();
}

# SOURCES — ไฟล์โค้ดทั้งหมดของโปรเจกต์ (แพ็ครวมเพื่ออัปโหลดผ่าน iPad)

> **คำสั่งสำหรับ Claude Code:** งานแรกสุดก่อนทำอะไรทั้งนั้น — แตกไฟล์ทั้ง 4 ด้านล่างออกเป็นไฟล์จริงตาม path ที่ระบุในหัวข้อ (เนื้อหาคือทั้งหมดใน code block ของแต่ละหัวข้อ) จากนั้นลบ SOURCES.md ทิ้งได้ แล้วทำตาม CLAUDE.md ต่อ

---

## FILE: isometric-scaffold.html

````
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Isometric Tactical Auto-Battler - Scaffold</title>
<style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: #1a1612; }
  canvas { display: block; }
  #hud {
    position: fixed; top: 8px; left: 8px; color: #d7c9a7;
    font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.5);
    padding: 6px 10px; border-radius: 4px; pointer-events: none;
  }
</style>
</head>
<body>
<div id="hud">Isometric grid scaffold — click a tile to test grid→world conversion</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
// ============================================================
// CONFIG
// ============================================================
const GRID_COLS = 10;
const GRID_ROWS = 10;
const TILE_SIZE = 1;        // world units per grid cell
// --- Auto chess style camera (แทน isometric แท้ 35.264°) ---
// เหตุผล: มุมสูงขึ้น (55°) ทำให้เห็นสนามชัดแบบ TFT/Auto Chess
// และ yaw ต่ำลง (15° แทน 45°) ทำให้กล้องมองเกือบตรงหน้ากระดาน
// → สไปรท์ตัวละครสัดส่วนปกติแบบ FF จะโชว์หน้า/ลำตัวชัด ไม่โดนมุมเอียงบัง
const CAMERA_ANGLE_DEG = 55;  // pitch: มุมกดลงจากแนวราบ (auto chess ≈ 50-60°)
const CAMERA_YAW_DEG = 15;    // yaw: หมุนรอบแกนตั้งเล็กน้อยให้ฉากมีมิติ ไม่แบนเป็น top-down
const CAMERA_ZOOM = 6;      // orthographic zoom (world units visible vertically / 2)

// ============================================================
// RENDERER
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1); // keep 1:1 for crisp pixel art, scale via CSS if needed
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ============================================================
// SCENE
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b2420); // earthy dark backdrop

// ============================================================
// ORTHOGRAPHIC ISOMETRIC CAMERA
// ============================================================
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -CAMERA_ZOOM * aspect, CAMERA_ZOOM * aspect,
  CAMERA_ZOOM, -CAMERA_ZOOM,
  0.1, 1000
);

// Position camera at a 45° horizontal rotation + isometric tilt looking at origin
const camDistance = 20;
const angleRad = THREE.MathUtils.degToRad(CAMERA_ANGLE_DEG);
const yawRad = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);
camera.position.set(
  camDistance * Math.cos(angleRad) * Math.cos(yawRad),
  camDistance * Math.sin(angleRad),
  camDistance * Math.cos(angleRad) * Math.sin(yawRad)
);
camera.lookAt(0, 0, 0);

// ============================================================
// LIGHTING (simple — mostly for prototyping, sprites won't need much)
// ============================================================
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dirLight = new THREE.DirectionalLight(0xffe8c2, 0.6);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// ============================================================
// GRID <-> WORLD CONVERSION
// ============================================================
// Grid coords (col, row) are integers, origin at back-left corner of the board.
// World coords are centered on the board so the camera looks at its middle.
function gridToWorld(col, row) {
  const x = (col - GRID_COLS / 2) * TILE_SIZE + TILE_SIZE / 2;
  const z = (row - GRID_ROWS / 2) * TILE_SIZE + TILE_SIZE / 2;
  return new THREE.Vector3(x, 0, z);
}

function worldToGrid(worldPos) {
  const col = Math.floor(worldPos.x / TILE_SIZE + GRID_COLS / 2);
  const row = Math.floor(worldPos.z / TILE_SIZE + GRID_ROWS / 2);
  return { col, row };
}

// Depth/Z-sort key: characters further "back" (higher col+row) should draw
// on top of tiles behind them. Use this to set renderOrder per unit.
function depthSortKey(col, row) {
  return col + row;
}

// ============================================================
// BUILD GRID (placeholder tiles — swap for pixel-art tile sprites later)
// ============================================================
const tileGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.96, TILE_SIZE * 0.96);
const tiles = [];
for (let row = 0; row < GRID_ROWS; row++) {
  for (let col = 0; col < GRID_COLS; col++) {
    const isAlt = (col + row) % 2 === 0;
    const mat = new THREE.MeshBasicMaterial({
      color: isAlt ? 0x5a5142 : 0x6b6252,
      side: THREE.DoubleSide
    });
    const tile = new THREE.Mesh(tileGeo, mat);
    tile.rotation.x = -Math.PI / 2; // lay flat on XZ plane
    const worldPos = gridToWorld(col, row);
    tile.position.set(worldPos.x, 0, worldPos.z);
    tile.userData = { col, row };
    scene.add(tile);
    tiles.push(tile);
  }
}

// ============================================================
// PLACEHOLDER UNIT (stand-in for a 16-bit sprite billboard)
// A real unit would use THREE.Sprite or a plane facing the camera
// with a pixel-art texture (NearestFilter, see loadPixelTexture below).
// ============================================================
// สัดส่วนตัวละครแบบ FF ปกติ (ไม่ chibi): สูงประมาณ 1.6 หน่วย ต่อ tile 1 หน่วย
// กว้าง 0.7 → สัดส่วนใกล้เคียงคน 1:4-1:5 หัวต่อตัว เมื่อใส่สไปรท์จริง
function createPlaceholderUnit(col, row, color) {
  const geo = new THREE.PlaneGeometry(0.7, 1.6);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  const worldPos = gridToWorld(col, row);
  mesh.position.set(worldPos.x, 0.8, worldPos.z); // ครึ่งความสูง → เท้าติดพื้น
  mesh.renderOrder = depthSortKey(col, row);
  scene.add(mesh);
  return mesh;
}

// วางสองตัวคนละแถวเพื่อเช็คว่า Z-sort และการบังกันถูกต้องในมุมกล้องใหม่
const unit = createPlaceholderUnit(3, 4, 0xc9986a);
const unit2 = createPlaceholderUnit(3, 6, 0x8a6d9c);

// Billboard: keep the sprite plane facing the camera every frame
// (this is what you'd do for real pixel-art character sprites)
function billboard(mesh) {
  mesh.quaternion.copy(camera.quaternion);
}

// ============================================================
// LOADING A PIXEL-ART TEXTURE (reference — uncomment when you have assets)
// ============================================================
// const loader = new THREE.TextureLoader();
// loader.load('character_idle.png', (texture) => {
//   texture.magFilter = THREE.NearestFilter; // keep pixels crisp, no blur
//   texture.minFilter = THREE.NearestFilter;
//   const mat = new THREE.SpriteMaterial({ map: texture });
//   const sprite = new THREE.Sprite(mat);
//   sprite.scale.set(1, 1.5, 1);
//   scene.add(sprite);
// });

// ============================================================
// CLICK TO TEST GRID CONVERSION
// ============================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const hud = document.getElementById('hud');

renderer.domElement.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(tiles);
  if (hits.length > 0) {
    const { col, row } = hits[0].object.userData;
    hud.textContent = `Clicked tile → col: ${col}, row: ${row} (depth key: ${depthSortKey(col, row)})`;
  }
});

// ============================================================
// RENDER LOOP
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  billboard(unit);
  billboard(unit2);
  renderer.render(scene, camera);
}
animate();

// ============================================================
// RESIZE HANDLING
// ============================================================
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -CAMERA_ZOOM * aspect;
  camera.right = CAMERA_ZOOM * aspect;
  camera.top = CAMERA_ZOOM;
  camera.bottom = -CAMERA_ZOOM;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
</script>
</body>
</html>

````

---

## FILE: demo-phase1-themed.html

````
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Auto Battler — เดโมเฟส 1 (ธีมซากอารีน่าหิน)</title>
<style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: #14100c; }
  canvas { display: block; }
  #hud {
    position: fixed; top: 8px; left: 8px; color: #d7c9a7;
    font-family: monospace; font-size: 14px; background: rgba(20,14,8,0.65);
    padding: 8px 12px; border-radius: 4px; border: 1px solid #5a4a32;
    pointer-events: none; line-height: 1.6;
  }
  #banner {
    position: fixed; top: 40%; left: 50%; transform: translate(-50%,-50%);
    color: #f0e6c8; font-family: monospace; font-size: 32px; font-weight: bold;
    background: rgba(24,17,10,0.9); padding: 20px 40px; border-radius: 8px;
    border: 2px solid #8a7a5a; display: none; text-align: center;
  }
  #restart {
    position: fixed; top: 58%; left: 50%; transform: translateX(-50%);
    font-family: monospace; font-size: 16px; padding: 10px 24px;
    background: #6b5d42; color: #f0e6c8; border: 1px solid #a89468;
    border-radius: 6px; cursor: pointer; display: none;
  }
</style>
</head>
<body>
<div id="hud"></div>
<div id="banner"></div>
<button id="restart" onclick="location.reload()">สู้อีกครั้ง</button>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
// ============================================================
// CONFIG (ตาม GDD)
// ============================================================
const GRID = 8;
const TILE = 1;
const STAGE_TIME = 60;
const CAMERA_ANGLE_DEG = 55;
const CAMERA_YAW_DEG = 15;
const CAMERA_ZOOM = 5.8;

// ============================================================
// RENDERER / SCENE / CAMERA
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1510);          // ค่ำมืดแบบซากโบราณ
scene.fog = new THREE.Fog(0x1c1510, 18, 34);           // หมอกไกลๆ ให้ขอบสนามจมมืด

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -CAMERA_ZOOM * aspect, CAMERA_ZOOM * aspect, CAMERA_ZOOM, -CAMERA_ZOOM, 0.1, 1000);
const camDist = 20;
const aR = THREE.MathUtils.degToRad(CAMERA_ANGLE_DEG);
const yR = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);
camera.position.set(camDist*Math.cos(aR)*Math.cos(yR), camDist*Math.sin(aR), camDist*Math.cos(aR)*Math.sin(yR));
camera.lookAt(0, 0, 0);

// แสงโทนคบเพลิง: อุ่นจากมุมหนึ่ง เย็นจางๆ ทั้งฉาก
scene.add(new THREE.AmbientLight(0x8a7a68, 0.9));
const torch = new THREE.DirectionalLight(0xffb060, 0.7);
torch.position.set(6, 10, 3);
scene.add(torch);

function gridToWorld(c, r) {
  return new THREE.Vector3((c - GRID/2)*TILE + TILE/2, 0, (r - GRID/2)*TILE + TILE/2);
}

// ============================================================
// PROCEDURAL TEXTURES (วาดด้วย canvas — ไม่ใช้ไฟล์ภาพ)
// ============================================================
function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}
function toTexture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

// --- พื้นหินแตกร้าว 2 แบบ (สลับตารางหมากรุกจางๆ) ---
function stoneTileTexture(base, seed) {
  const cv = makeCanvas(32, 32), g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 32, 32);
  // จุดเม็ดหิน
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const v = rnd();
    g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,240,210,0.06)';
    g.fillRect((rnd()*32)|0, (rnd()*32)|0, 1 + (rnd()*2|0), 1 + (rnd()*2|0));
  }
  // รอยแตก
  g.strokeStyle = 'rgba(10,6,2,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    g.beginPath();
    let x = rnd()*32, y = rnd()*32;
    g.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += rnd()*12-6; y += rnd()*12-6; g.lineTo(x, y); }
    g.stroke();
  }
  // ขอบบล็อกหิน
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.strokeRect(0.5, 0.5, 31, 31);
  return toTexture(cv);
}
const texA = stoneTileTexture('#6e6552', 41);   // หินเทาอุ่น
const texB = stoneTileTexture('#5d5645', 977);  // หินเข้มสลับ

// --- สไปรท์ตัวละครพิกเซล (16x24 → ขยายคมๆ) ---
// spec: { skin, cloth, weapon:'sword'|'shield'|'bow'|'none', bone:boolean }
function characterSprite(spec) {
  const cv = makeCanvas(16, 24), g = cv.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const skin = spec.bone ? '#d8d2c0' : spec.skin;
  const dark = 'rgba(0,0,0,0.85)';

  // หัว (สัดส่วน FF ปกติ: หัว ~5px จากตัว 24px)
  P(6, 1, 5, 5, skin);
  if (spec.bone) { P(7, 3, 1, 1, dark); P(9, 3, 1, 1, dark); P(7, 5, 3, 1, dark); } // ตาโหว่+ปากโครง
  else { P(7, 3, 1, 1, dark); P(9, 3, 1, 1, dark); }
  if (spec.helm) { P(5, 0, 7, 2, spec.helm); P(5, 0, 1, 4, spec.helm); P(11, 0, 1, 4, spec.helm); }

  // ลำตัว
  P(5, 6, 7, 8, spec.cloth);
  P(5, 6, 7, 1, 'rgba(255,255,255,0.12)'); // ไฮไลท์ไหล่
  // แขน
  P(4, 7, 1, 5, skin); P(12, 7, 1, 5, skin);
  // ขา
  P(6, 14, 2, 7, spec.pants || '#3a3226');
  P(9, 14, 2, 7, spec.pants || '#3a3226');
  // เท้า
  P(5, 21, 3, 2, '#241c12'); P(9, 21, 3, 2, '#241c12');

  // อาวุธ
  if (spec.weapon === 'sword') { P(13, 3, 1, 10, '#c8c8d2'); P(12, 12, 3, 1, '#7a5c30'); }
  if (spec.weapon === 'shield') { P(1, 6, 3, 7, '#8a7444'); P(2, 7, 1, 5, '#c2a860'); }
  if (spec.weapon === 'bow') {
    g.strokeStyle = '#7a5c30'; g.lineWidth = 1;
    g.beginPath(); g.arc(14, 9, 4, -Math.PI/2, Math.PI/2); g.stroke();
    g.strokeStyle = '#d8d2c0';
    g.beginPath(); g.moveTo(14, 5); g.lineTo(14, 13); g.stroke();
  }
  if (spec.weapon === 'club') { P(13, 4, 2, 8, '#6a5236'); P(12, 3, 4, 3, '#7d6242'); }
  return toTexture(cv);
}

const SPRITES = {
  Fighter:  characterSprite({ skin:'#d9a878', cloth:'#4a5a8a', helm:'#8a92a8', weapon:'shield', pants:'#33405e' }),
  Swordman: characterSprite({ skin:'#d9a878', cloth:'#3e6e60', weapon:'sword', pants:'#2e4a40' }),
  Archer:   characterSprite({ skin:'#c98f62', cloth:'#7a5c34', weapon:'bow',  pants:'#4a3a22' }),
  Skeleton: characterSprite({ bone:true, cloth:'#5a544a', weapon:'club', pants:'#46413a' }),
  SkeletonBig: characterSprite({ bone:true, cloth:'#6a4a3a', helm:'#5a5a62', weapon:'sword', pants:'#46413a' }),
};

// ============================================================
// BOARD — พื้นหิน + ขอบสนามจม
// ============================================================
const tileGeo = new THREE.PlaneGeometry(TILE*0.98, TILE*0.98);
for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
  const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({
    map: (c+r)%2===0 ? texA : texB, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI/2;
  const p = gridToWorld(c, r);
  m.position.set(p.x, 0, p.z);
  scene.add(m);
}
// พื้นดินรอบสนาม (มืดกว่า ให้อารีน่าลอยเด่น)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
  new THREE.MeshBasicMaterial({ color: 0x241c14 }));
ground.rotation.x = -Math.PI/2;
ground.position.y = -0.02;
scene.add(ground);

// ============================================================
// PROPS — เสาหัก เศษหิน รอบสนาม (ธีมซากอารีน่า)
// ============================================================
function brokenPillar(x, z, h, tilt) {
  const geo = new THREE.CylinderGeometry(0.28, 0.34, h, 6);
  const mat = new THREE.MeshLambertMaterial({ color: 0x7a7060 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, h/2 - 0.02, z);
  m.rotation.z = tilt;
  scene.add(m);
  // ฐานเสา
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x685e4e }));
  base.position.set(x, 0.1, z);
  scene.add(base);
}
function rubble(x, z, s) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0),
    new THREE.MeshLambertMaterial({ color: 0x6a6152 }));
  m.position.set(x, s*0.5, z);
  m.rotation.set(Math.random()*3, Math.random()*3, 0);
  scene.add(m);
}
// เสารอบมุม (สูงต่ำสลับ = ผุพังไม่เท่ากัน)
brokenPillar(-5.2, -5.0, 2.6,  0.05);
brokenPillar( 5.0, -5.2, 1.4, -0.12);
brokenPillar(-5.4,  5.1, 0.9,  0.18);
brokenPillar( 5.3,  5.0, 2.2, -0.04);
brokenPillar( 0.2, -5.6, 1.8,  0.08);
brokenPillar(-5.8,  0.3, 1.1, -0.15);
// เศษหินกระจาย
rubble(-4.6, -3.2, 0.22); rubble(4.8, -2.4, 0.18); rubble(4.5, 3.6, 0.26);
rubble(-4.9, 2.8, 0.16); rubble(2.2, 5.2, 0.2); rubble(-1.8, -5.4, 0.19);
rubble(5.6, 0.8, 0.15);

// ============================================================
// UNITS
// ============================================================
const units = [];
const occupied = new Set();
function key(c, r) { return c + ',' + r; }

function makeUnit(cfg) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.6),
    new THREE.MeshBasicMaterial({ map: SPRITES[cfg.sprite], side: THREE.DoubleSide, transparent: true }));
  body.position.y = 0.8;
  group.add(body);
  // เงาใต้เท้า
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI/2;
  shadow.position.y = 0.01;
  group.add(shadow);
  // หลอด HP
  const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x2a1410, side: THREE.DoubleSide }));
  hpBg.position.y = 1.78;
  group.add(hpBg);
  const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.09),
    new THREE.MeshBasicMaterial({ color: cfg.team === 'player' ? 0x66c25a : 0xc25a44, side: THREE.DoubleSide }));
  hpBar.position.y = 1.78; hpBar.position.z = 0.001;
  group.add(hpBar);

  const p = gridToWorld(cfg.c, cfg.r);
  group.position.set(p.x, 0, p.z);
  scene.add(group);
  occupied.add(key(cfg.c, cfg.r));

  const u = { ...cfg, group, body, hpBar, shadow,
    maxHp: cfg.hp, alive: true, atkCooldown: 0,
    moving: false, moveFrom: null, moveTo: null, moveT: 0 };
  units.push(u);
  return u;
}

// ทีมผู้เล่น (3 แถวล่าง)
makeUnit({ team:'player', name:'Fighter',  sprite:'Fighter',  c:3, r:5, hp:180, pAtk:12, atkSpeed:0.8, range:1, moveSpeed:2.0 });
makeUnit({ team:'player', name:'Swordman', sprite:'Swordman', c:4, r:5, hp:130, pAtk:18, atkSpeed:1.0, range:1, moveSpeed:2.4 });
makeUnit({ team:'player', name:'Archer',   sprite:'Archer',   c:3, r:7, hp:80,  pAtk:14, atkSpeed:1.6, range:3, moveSpeed:2.2 });

// โครงกระดูกนักสู้ (ด่าน 1 ธีมอารีน่า)
makeUnit({ team:'enemy', name:'Skeleton A', sprite:'Skeleton',    c:2, r:0, hp:90,  pAtk:10, atkSpeed:0.9, range:1, moveSpeed:1.8 });
makeUnit({ team:'enemy', name:'Skeleton B', sprite:'Skeleton',    c:4, r:0, hp:90,  pAtk:10, atkSpeed:0.9, range:1, moveSpeed:1.8 });
makeUnit({ team:'enemy', name:'Skeleton C', sprite:'Skeleton',    c:5, r:1, hp:90,  pAtk:10, atkSpeed:0.9, range:1, moveSpeed:1.8 });
makeUnit({ team:'enemy', name:'Skeleton D', sprite:'SkeletonBig', c:3, r:1, hp:110, pAtk:11, atkSpeed:0.8, range:1, moveSpeed:1.6 });

// ============================================================
// A* PATHFINDING
// ============================================================
function astar(sc, sr, tc, tr, ignoreKey) {
  const open = [{ c:sc, r:sr, g:0, f:0, parent:null }];
  const closed = new Set();
  const h = (c, r) => Math.abs(c-tc) + Math.abs(r-tr);
  open[0].f = h(sc, sr);
  while (open.length) {
    open.sort((a,b) => a.f - b.f);
    const cur = open.shift();
    if (cur.c === tc && cur.r === tr) {
      const path = [];
      let n = cur;
      while (n.parent) { path.unshift({ c:n.c, r:n.r }); n = n.parent; }
      return path;
    }
    closed.add(key(cur.c, cur.r));
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (nc < 0 || nr < 0 || nc >= GRID || nr >= GRID) continue;
      const k = key(nc, nr);
      if (closed.has(k)) continue;
      if (occupied.has(k) && k !== ignoreKey && !(nc===tc && nr===tr)) continue;
      const g = cur.g + 1;
      const exist = open.find(o => o.c===nc && o.r===nr);
      if (exist && exist.g <= g) continue;
      if (exist) { exist.g = g; exist.f = g + h(nc,nr); exist.parent = cur; }
      else open.push({ c:nc, r:nr, g, f: g + h(nc,nr), parent: cur });
    }
  }
  return null;
}

function gridDist(a, b) { return Math.abs(a.c-b.c) + Math.abs(a.r-b.r); }

function selectTarget(u) {
  let best = null, bd = Infinity;
  for (const o of units) {
    if (!o.alive || o.team === u.team) continue;
    const d = gridDist(u, o);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// ============================================================
// GAME LOOP
// ============================================================
let timeLeft = STAGE_TIME;
let gameOver = false;
const hud = document.getElementById('hud');
const banner = document.getElementById('banner');
const restartBtn = document.getElementById('restart');

function endGame(msg) {
  gameOver = true;
  banner.textContent = msg;
  banner.style.display = 'block';
  restartBtn.style.display = 'block';
}

function updateUnit(u, dt) {
  if (!u.alive) return;

  if (u.moving) {
    u.moveT += dt * u.moveSpeed;
    if (u.moveT >= 1) {
      u.moveT = 1; u.moving = false;
      u.c = u.moveTo.c; u.r = u.moveTo.r;
    }
    const a = gridToWorld(u.moveFrom.c, u.moveFrom.r);
    const b = gridToWorld(u.moveTo.c, u.moveTo.r);
    u.group.position.lerpVectors(a, b, u.moveT);
    // เด้งเบาๆ ตอนเดิน (แทนแอนิเมชัน walk)
    u.body.position.y = 0.8 + Math.abs(Math.sin(u.moveT * Math.PI * 2)) * 0.06;
    return;
  }
  u.body.position.y = 0.8;

  const target = selectTarget(u);
  if (!target) return;

  const d = gridDist(u, target);
  if (d <= u.range) {
    u.atkCooldown -= dt;
    if (u.atkCooldown <= 0) {
      u.atkCooldown = 1 / u.atkSpeed;
      target.hp -= u.pAtk;
      // ท่าตี: พุ่งตัวสั้นๆ (แทนแอนิเมชัน attack)
      const dir = gridToWorld(target.c, target.r).sub(u.group.position).normalize().multiplyScalar(0.12);
      u.body.position.x += dir.x;
      setTimeout(() => { if (u.alive) u.body.position.x = 0; }, 90);
      // โดนตี: แดงวาบ
      target.body.material.color.set(0xff8866);
      setTimeout(() => target.alive && target.body.material.color.set(0xffffff), 80);
      target.hpBar.scale.x = Math.max(0, target.hp / target.maxHp);
      target.hpBar.position.x = -0.4 * (1 - target.hpBar.scale.x);
      if (target.hp <= 0) {
        target.alive = false;
        occupied.delete(key(target.c, target.r));
        // ตาย: ล้มจางหาย (แทนแอนิเมชัน death)
        target.deathT = 0;
      }
    }
    u.body.scale.x = (gridToWorld(target.c,target.r).x < u.group.position.x) ? -1 : 1;
  } else {
    const path = astar(u.c, u.r, target.c, target.r, key(u.c, u.r));
    if (path && path.length > 0) {
      const next = path[0];
      const nk = key(next.c, next.r);
      if (!occupied.has(nk)) {
        occupied.delete(key(u.c, u.r));
        occupied.add(nk);
        u.moving = true; u.moveT = 0;
        u.moveFrom = { c:u.c, r:u.r };
        u.moveTo = next;
        u.body.scale.x = (next.c < u.c) ? -1 : (next.c > u.c ? 1 : u.body.scale.x);
      }
    }
  }
}

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (!gameOver) {
    timeLeft -= dt;
    for (const u of units) updateUnit(u, dt);

    const pAlive = units.filter(u => u.alive && u.team==='player').length;
    const eAlive = units.filter(u => u.alive && u.team==='enemy').length;
    hud.innerHTML = `🏛 ซากอารีน่าหิน — ด่าน 1<br>⏱ ${Math.max(0,timeLeft).toFixed(1)} วิ<br>🟩 ทีมผู้เล่น: ${pAlive} | 🟥 โครงกระดูก: ${eAlive}`;

    if (eAlive === 0) endGame('🏆 ชนะด่าน 1!');
    else if (pAlive === 0) endGame('💀 ทีมถูกกวาดล้าง');
    else if (timeLeft <= 0) endGame('⏱ หมดเวลา — แพ้ทันที');
  }

  // แอนิเมชันตาย: ล้มลง + จางหาย
  for (const u of units) {
    if (!u.alive && u.deathT !== undefined && u.deathT < 1) {
      u.deathT = Math.min(1, u.deathT + dt * 2);
      u.body.rotation.z = -u.deathT * Math.PI / 2;
      u.body.material.opacity = 1 - u.deathT;
      u.hpBar.visible = false;
      u.group.children[2].visible = false; // hpBg
      u.shadow.material.opacity = 0.35 * (1 - u.deathT);
      if (u.deathT >= 1) u.group.visible = false;
    }
  }

  for (const u of units) u.group.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  const asp = window.innerWidth / window.innerHeight;
  camera.left = -CAMERA_ZOOM*asp; camera.right = CAMERA_ZOOM*asp;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
</script>
</body>
</html>

````

---

## FILE: tools/gen_sprites.py

````
"""
Sprite generator — PvE Auto Battler (แมพ 1)
วาดพิกเซลอาร์ต 24x32 ต่อตัว แล้วขยาย 6 เท่า (nearest) เป็น PNG 144x192
สัดส่วนแบบ FF ปกติ: หัว ~7px จากสูง 30px (ประมาณ 1:4.3)
"""
from PIL import Image, ImageDraw
import os

W, H = 24, 32
SCALE = 6
OUT = "assets"
os.makedirs(OUT, exist_ok=True)

def new_canvas():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def px(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

# ---------- โครงร่างมนุษย์มาตรฐาน ----------
def humanoid(d, skin, cloth, pants, boots, cloth_hi=None,
             robe=False, arms=True):
    # หัว (7px) — วางช่วง y 2-8
    px(d, 9, 2, 6, 6, skin)
    # ตา
    px(d, 10, 4, 1, 1, (20, 14, 10, 255))
    px(d, 13, 4, 1, 1, (20, 14, 10, 255))
    # คอ
    px(d, 11, 8, 2, 1, skin)
    if robe:
        # เสื้อคลุมยาวคลุมขา
        px(d, 8, 9, 8, 14, cloth)
        px(d, 7, 20, 10, 3, cloth)
        if cloth_hi: px(d, 8, 9, 8, 1, cloth_hi)
        # ปลายเท้าโผล่
        px(d, 9, 23, 2, 2, boots)
        px(d, 13, 23, 2, 2, boots)
    else:
        # เสื้อ
        px(d, 8, 9, 8, 8, cloth)
        if cloth_hi: px(d, 8, 9, 8, 1, cloth_hi)
        # ขา
        px(d, 9, 17, 2, 6, pants)
        px(d, 13, 17, 2, 6, pants)
        # รองเท้า
        px(d, 8, 23, 3, 2, boots)
        px(d, 13, 23, 3, 2, boots)
    if arms:
        px(d, 6, 10, 2, 6, skin)
        px(d, 16, 10, 2, 6, skin)

SKIN = (217, 168, 120, 255)
SKIN_D = (201, 143, 98, 255)
DARK = (26, 20, 14, 255)

def save(img, name):
    big = img.resize((W * SCALE, H * SCALE), Image.NEAREST)
    big.save(f"{OUT}/{name}.png")
    return big

sprites = {}

# ================= ฝั่งผู้เล่น =================

# --- Novice ---
img, d = new_canvas()
humanoid(d, SKIN, (176, 158, 128, 255), (110, 96, 74, 255), (60, 48, 34, 255),
         cloth_hi=(200, 184, 156, 255))
px(d, 9, 1, 6, 2, (94, 70, 46, 255))  # ผมน้ำตาล
sprites["novice"] = save(img, "novice")

# --- Fighter (แท้งค์ โล่+หมวก) ---
img, d = new_canvas()
humanoid(d, SKIN, (74, 90, 138, 255), (51, 64, 94, 255), (40, 34, 26, 255),
         cloth_hi=(120, 138, 190, 255))
px(d, 8, 1, 8, 3, (138, 146, 168, 255))   # หมวกเหล็ก
px(d, 8, 1, 1, 6, (138, 146, 168, 255))
px(d, 15, 1, 1, 6, (138, 146, 168, 255))
px(d, 3, 9, 4, 9, (138, 116, 68, 255))    # โล่ไม้ขอบทอง
px(d, 4, 10, 2, 7, (194, 168, 96, 255))
px(d, 17, 10, 2, 7, (150, 150, 158, 255)) # ดาบสั้นข้างตัว
sprites["fighter"] = save(img, "fighter")

# --- Swordman (ดาบยาว ผ้าคาดหัว) ---
img, d = new_canvas()
humanoid(d, SKIN, (62, 110, 96, 255), (46, 74, 64, 255), (44, 36, 26, 255),
         cloth_hi=(96, 150, 132, 255))
px(d, 9, 1, 6, 2, (40, 32, 24, 255))      # ผมดำ
px(d, 9, 3, 6, 1, (170, 60, 50, 255))     # ผ้าคาดหัวแดง
px(d, 18, 3, 2, 13, (200, 200, 212, 255)) # ดาบยาว
px(d, 17, 16, 4, 1, (122, 92, 48, 255))   # การ์ดดาบ
sprites["swordman"] = save(img, "swordman")

# --- Archer (ฮู้ด ธนู) ---
img, d = new_canvas()
humanoid(d, SKIN_D, (122, 92, 52, 255), (74, 58, 34, 255), (48, 38, 24, 255),
         cloth_hi=(158, 124, 76, 255))
px(d, 8, 1, 8, 3, (94, 116, 74, 255))     # ฮู้ดเขียว
px(d, 8, 3, 2, 4, (94, 116, 74, 255))
px(d, 14, 3, 2, 4, (94, 116, 74, 255))
for i in range(10):                        # คันธนูโค้ง
    d.point((19 + (1 if 2 < i < 8 else 0), 5 + i), fill=(110, 82, 44, 255))
for i in range(10):
    d.point((19, 5 + i), fill=(216, 210, 192, 200))
sprites["archer"] = save(img, "archer")

# --- Mage (เสื้อคลุมม่วง หมวกแหลม ไม้เท้า) ---
img, d = new_canvas()
humanoid(d, SKIN, (92, 66, 128, 255), None, (46, 36, 60, 255),
         cloth_hi=(134, 104, 172, 255), robe=True)
px(d, 8, 2, 8, 1, (70, 48, 100, 255))     # ปีกหมวก
px(d, 10, 0, 4, 2, (70, 48, 100, 255))    # ยอดหมวกแหลม
px(d, 19, 4, 1, 18, (110, 82, 44, 255))   # ไม้เท้า
px(d, 18, 2, 3, 3, (140, 190, 230, 255))  # ลูกแก้วฟ้า
sprites["mage"] = save(img, "mage")

# --- Summoner (เสื้อคลุมเขียวน้ำทะเล + วิญญาณภูต) ---
img, d = new_canvas()
humanoid(d, SKIN, (56, 110, 116, 255), None, (36, 62, 66, 255),
         cloth_hi=(96, 158, 164, 255), robe=True)
px(d, 9, 1, 6, 1, (210, 190, 120, 255))   # มงกุฎเส้นทอง
px(d, 19, 4, 1, 18, (92, 74, 52, 255))    # คทา
px(d, 18, 2, 3, 3, (120, 230, 170, 255))  # ลูกแก้วเขียว
px(d, 2, 5, 3, 3, (140, 240, 190, 160))   # ภูตวิญญาณลอยข้างตัว
px(d, 3, 8, 1, 2, (140, 240, 190, 110))
sprites["summoner"] = save(img, "summoner")

# --- Acolyte (เสื้อคลุมขาว ขอบทอง คทากางเขน) ---
img, d = new_canvas()
humanoid(d, SKIN, (232, 224, 204, 255), None, (150, 138, 112, 255),
         cloth_hi=(255, 250, 236, 255), robe=True)
px(d, 8, 20, 8, 1, (208, 176, 96, 255))   # แถบทองชายเสื้อ
px(d, 9, 1, 6, 2, (150, 110, 60, 255))    # ผมน้ำตาลอ่อน
px(d, 19, 4, 1, 16, (208, 176, 96, 255))  # คทาทอง
px(d, 18, 2, 3, 1, (208, 176, 96, 255))   # กางเขนบน
px(d, 19, 1, 1, 3, (208, 176, 96, 255))
sprites["acolyte"] = save(img, "acolyte")

# --- Merchant (เสื้อกั๊กทอง หมวก ถุงเงิน) ---
img, d = new_canvas()
humanoid(d, SKIN, (168, 130, 58, 255), (92, 70, 40, 255), (52, 40, 26, 255),
         cloth_hi=(214, 176, 92, 255))
px(d, 8, 1, 8, 2, (120, 44, 40, 255))     # หมวกแดงเข้ม
px(d, 7, 3, 10, 1, (120, 44, 40, 255))
px(d, 17, 12, 4, 5, (150, 118, 62, 255))  # ถุงเงิน
px(d, 18, 11, 2, 1, (90, 68, 36, 255))    # ปากถุง
px(d, 18, 14, 1, 1, (240, 210, 110, 255)) # เหรียญแวว
sprites["merchant"] = save(img, "merchant")

# ================= มอนสเตอร์แมพ 1 (ซากอารีน่าหิน) =================
BONE = (216, 210, 192, 255)
BONE_D = (180, 172, 152, 255)

# --- โครงกระดูกนักสู้ ---
img, d = new_canvas()
humanoid(d, BONE, (90, 84, 74, 255), (70, 65, 58, 255), (40, 36, 30, 255))
px(d, 10, 4, 1, 2, DARK)                  # ตาโหว่ลึก
px(d, 13, 4, 1, 2, DARK)
px(d, 10, 7, 4, 1, BONE_D)                # ฟันโครง
px(d, 9, 10, 6, 1, BONE_D)                # ซี่โครงโผล่
px(d, 9, 12, 6, 1, BONE_D)
px(d, 18, 5, 2, 9, (106, 82, 54, 255))    # กระบอง
px(d, 17, 3, 4, 3, (125, 98, 66, 255))
sprites["mon_skeleton"] = save(img, "mon_skeleton")

# --- หมาป่าหิน (สี่ขา คนละโครง) ---
img, d = new_canvas()
G1, G2 = (122, 116, 104, 255), (96, 90, 80, 255)
px(d, 4, 14, 15, 6, G1)                   # ลำตัว
px(d, 4, 14, 15, 1, (150, 144, 132, 255)) # หลังไฮไลท์
px(d, 16, 10, 6, 5, G1)                   # หัว
px(d, 20, 8, 2, 3, G2)                    # หูตั้ง
px(d, 17, 12, 1, 1, (230, 120, 60, 255))  # ตาส้มเรือง
px(d, 21, 13, 2, 2, G2)                   # จมูก/ปาก
px(d, 5, 20, 2, 5, G2)                    # ขา 4 ข้าง
px(d, 9, 20, 2, 5, G2)
px(d, 13, 20, 2, 5, G2)
px(d, 16, 20, 2, 5, G2)
px(d, 1, 12, 4, 2, G2)                    # หาง
px(d, 8, 15, 2, 1, (70, 64, 56, 255))     # รอยแตกหิน
px(d, 12, 17, 2, 1, (70, 64, 56, 255))
sprites["mon_stonewolf"] = save(img, "mon_stonewolf")

# --- พลธนูวิญญาณ (โปร่งแสงฟ้าซีด) ---
img, d = new_canvas()
GHOST = (150, 190, 210, 190)
GHOST_D = (110, 150, 175, 170)
humanoid(d, GHOST, GHOST_D, GHOST_D, GHOST_D)
px(d, 10, 4, 1, 1, (230, 250, 255, 255))  # ตาเรืองขาว
px(d, 13, 4, 1, 1, (230, 250, 255, 255))
px(d, 9, 23, 6, 2, (150, 190, 210, 90))   # ปลายตัวจางเป็นหมอก
for i in range(10):                        # ธนูวิญญาณ
    d.point((19 + (1 if 2 < i < 8 else 0), 5 + i), fill=(190, 225, 240, 200))
sprites["mon_spiritarcher"] = save(img, "mon_spiritarcher")

# --- เงานักฆ่า (ดำม่วง ตาแดง มีด) ---
img, d = new_canvas()
SHADOW = (44, 34, 56, 255)
SHADOW_D = (30, 22, 40, 255)
humanoid(d, SHADOW, SHADOW_D, SHADOW_D, SHADOW_D)
px(d, 8, 1, 8, 3, SHADOW_D)               # ฮู้ดคลุม
px(d, 10, 4, 1, 1, (240, 70, 60, 255))    # ตาแดงเรือง
px(d, 13, 4, 1, 1, (240, 70, 60, 255))
px(d, 18, 9, 1, 5, (170, 170, 185, 255))  # มีดสั้น
px(d, 17, 14, 3, 1, (90, 70, 100, 255))
px(d, 6, 24, 12, 1, (44, 34, 56, 120))    # เงาพร่าใต้ตัว
sprites["mon_shadowassassin"] = save(img, "mon_shadowassassin")

# --- โกเลมหินอารีน่า (มินิบอสด่าน 10 — ตัวใหญ่กว้าง) ---
img, d = new_canvas()
R1, R2 = (128, 118, 102, 255), (98, 90, 78, 255)
px(d, 7, 3, 10, 6, R1)                    # หัวเหลี่ยมใหญ่
px(d, 9, 5, 2, 2, (255, 176, 70, 255))    # ตาเรืองส้ม
px(d, 14, 5, 2, 2, (255, 176, 70, 255))
px(d, 5, 9, 14, 11, R1)                   # ลำตัวมหึมา
px(d, 5, 9, 14, 1, (158, 148, 130, 255))
px(d, 2, 9, 3, 10, R2)                    # แขนหินหนา
px(d, 19, 9, 3, 10, R2)
px(d, 7, 20, 4, 5, R2)                    # ขาสั้นหนา
px(d, 13, 20, 4, 5, R2)
px(d, 8, 12, 3, 1, (66, 60, 52, 255))     # รอยแตก
px(d, 13, 15, 4, 1, (66, 60, 52, 255))
px(d, 10, 17, 2, 1, (66, 60, 52, 255))
px(d, 11, 11, 2, 2, (140, 220, 190, 255)) # แกนพลังเรืองกลางอก
sprites["mon_golem"] = save(img, "mon_golem")

# --- แชมเปี้ยนอมตะ (บอสด่าน 15 — เกราะผุ พู่แดง ดาบใหญ่) ---
img, d = new_canvas()
ARM = (110, 104, 112, 255)
ARM_D = (82, 78, 86, 255)
RUST = (124, 84, 58, 255)
humanoid(d, BONE, ARM, ARM_D, (46, 42, 38, 255), cloth_hi=(146, 140, 150, 255))
px(d, 8, 1, 8, 3, ARM)                    # หมวกเกราะเต็มใบ
px(d, 8, 4, 1, 4, ARM)
px(d, 15, 4, 1, 4, ARM)
px(d, 10, 4, 1, 2, (240, 70, 60, 255))    # ตาแดงเรืองในเกราะ
px(d, 13, 4, 1, 2, (240, 70, 60, 255))
px(d, 11, 0, 2, 1, (170, 50, 44, 255))    # พู่แดงบนหมวก
px(d, 12, -0 + 0, 1, 1, (170, 50, 44, 255))
px(d, 9, 11, 2, 1, RUST)                  # สนิมกัดเกราะ
px(d, 13, 14, 2, 1, RUST)
px(d, 18, 2, 3, 14, (176, 176, 190, 255)) # ดาบใหญ่สองมือ
px(d, 19, 2, 1, 14, (210, 210, 222, 255))
px(d, 17, 16, 5, 1, (122, 92, 48, 255))
px(d, 4, 9, 3, 10, (90, 40, 36, 255))     # ผ้าคลุมแดงเข้มขาด
px(d, 4, 18, 2, 2, (70, 30, 28, 255))
sprites["boss_champion"] = save(img, "boss_champion")

# ================= Contact sheet =================
names = list(sprites.keys())
cols = 7
rows = (len(names) + cols - 1) // cols
CELL_W, CELL_H = W * SCALE + 20, H * SCALE + 34
sheet = Image.new("RGBA", (cols * CELL_W, rows * CELL_H), (36, 28, 20, 255))
ds = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    cx, cy = (i % cols) * CELL_W, (i // cols) * CELL_H
    ds.rectangle([cx + 4, cy + 4, cx + CELL_W - 5, cy + CELL_H - 5],
                 fill=(52, 42, 32, 255), outline=(110, 92, 66, 255))
    sheet.paste(sprites[n], (cx + 10, cy + 8), sprites[n])
    ds.text((cx + 10, cy + CELL_H - 22), n, fill=(224, 210, 180, 255))
sheet.save(f"{OUT}/contact_sheet.png")
print("done:", len(names), "sprites")

````

---

## FILE: tools/gen_bosses.py

````
"""
Sprite generator ชุดปิดท้ายแมพ 1:
1. หัวหน้าผู้คุมสังเวียน (มินิบอสด่าน 5) — 24x32
2. มังกรกระดูก (ศัตรูเด่นด่าน 13) — 40x32 (ตัวกว้าง)
3. แชมเปี้ยนอมตะ ตัวใหญ่ (บอสด่าน 15) — 40x56 (ราว 2 เท่ายูนิตปกติ)
"""
from PIL import Image, ImageDraw
import os

SCALE = 6
OUT = "assets"
os.makedirs(OUT, exist_ok=True)

def canvas(w, h):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def px(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

def save(img, name):
    big = img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)
    big.save(f"{OUT}/{name}.png")
    return big

BONE = (216, 210, 192, 255)
BONE_D = (180, 172, 152, 255)
BONE_DD = (140, 132, 116, 255)
DARK = (26, 20, 14, 255)
RED = (240, 70, 60, 255)

out = {}

# ============================================================
# 1. หัวหน้าผู้คุมสังเวียน (มินิบอสด่าน 5)
# โครงกระดูกยศสูง: เกราะไหล่ หอกยาว ผ้าคลุมสีเลือดหมูซีด
# ============================================================
img, d = canvas(24, 32)
ARM = (104, 96, 88, 255)
CAPE = (110, 52, 48, 255)
# ผ้าคลุมด้านหลัง
px(d, 5, 9, 3, 12, CAPE)
px(d, 5, 20, 2, 2, (86, 40, 36, 255))
# หัวโครง
px(d, 9, 2, 6, 6, BONE)
px(d, 10, 4, 1, 2, DARK)
px(d, 13, 4, 1, 2, DARK)
px(d, 10, 7, 4, 1, BONE_D)
# มงกุฎเหล็กบุบ
px(d, 9, 1, 6, 1, (140, 134, 120, 255))
px(d, 9, 0, 1, 1, (140, 134, 120, 255))
px(d, 12, 0, 1, 1, (140, 134, 120, 255))
px(d, 14, 0, 1, 1, (140, 134, 120, 255))
# ตัว + เกราะไหล่
px(d, 8, 9, 8, 8, (78, 72, 66, 255))
px(d, 7, 9, 3, 2, ARM)
px(d, 14, 9, 3, 2, ARM)
px(d, 9, 11, 6, 1, BONE_D)   # ซี่โครงโผล่จากเกราะขาด
px(d, 9, 13, 6, 1, BONE_D)
# แขน/ขาโครง
px(d, 6, 11, 1, 5, BONE)
px(d, 17, 11, 1, 5, BONE)
px(d, 9, 17, 2, 6, BONE_D)
px(d, 13, 17, 2, 6, BONE_D)
px(d, 8, 23, 3, 2, (46, 42, 38, 255))
px(d, 13, 23, 3, 2, (46, 42, 38, 255))
# หอกยาว (สัญลักษณ์ผู้คุม)
px(d, 20, 0, 1, 22, (110, 88, 58, 255))
px(d, 19, 0, 3, 3, (176, 176, 190, 255))
px(d, 20, 3, 1, 2, (210, 210, 222, 255))
out["miniboss_warden"] = save(img, "miniboss_warden")

# ============================================================
# 2. มังกรกระดูก (ด่าน 13 — ศัตรูเด่นก่อนบอส)
# ซากมังกรโบราณที่ตายในอารีน่า ปีกโครง หางยาว ไฟวิญญาณเขียวในอก
# ============================================================
img, d = canvas(40, 32)
# หาง (ซ้าย → ปลายแหลม)
px(d, 1, 16, 6, 2, BONE_D)
px(d, 3, 15, 4, 1, BONE_D)
px(d, 0, 17, 2, 1, BONE_DD)
# ลำตัว (ซี่โครงโค้ง)
px(d, 7, 12, 16, 9, BONE)
for i in range(4):
    px(d, 9 + i * 4, 13, 1, 7, BONE_DD)   # ช่องว่างระหว่างซี่โครง
px(d, 7, 12, 16, 1, (236, 230, 212, 255))
# ไฟวิญญาณเขียวเรืองในอก
px(d, 14, 15, 3, 3, (120, 240, 170, 255))
px(d, 15, 14, 1, 1, (180, 255, 210, 255))
# ปีกโครง (กางขึ้นสองข้าง)
px(d, 8, 4, 1, 8, BONE_D)     # ก้านปีกซ้าย
px(d, 5, 2, 4, 2, BONE_D)
px(d, 4, 4, 2, 5, (200, 194, 176, 90))   # พังผืดขาดโปร่ง
px(d, 20, 3, 1, 9, BONE_D)    # ก้านปีกขวา
px(d, 21, 1, 5, 2, BONE_D)
px(d, 22, 3, 3, 6, (200, 194, 176, 90))
# คอ + หัว (ขวา)
px(d, 23, 9, 4, 5, BONE)
px(d, 26, 6, 9, 6, BONE)      # กะโหลกยาว
px(d, 33, 9, 6, 3, BONE_D)    # ปากยื่น
px(d, 34, 12, 4, 1, BONE)     # ขากรรไกรล่าง
px(d, 35, 10, 1, 1, BONE_DD)  # ฟัน
px(d, 37, 10, 1, 1, BONE_DD)
px(d, 29, 7, 2, 2, (120, 240, 170, 255))  # ตาไฟเขียวเรือง
px(d, 27, 4, 1, 2, BONE_D)    # เขา
px(d, 30, 3, 1, 3, BONE_D)
# ขา 4 ข้าง + กรงเล็บ
for lx in (9, 14, 19, 23):
    px(d, lx, 21, 2, 6, BONE_D)
    px(d, lx - 1, 27, 4, 1, BONE_DD)
out["mon_bonedragon"] = save(img, "mon_bonedragon")

# ============================================================
# 3. แชมเปี้ยนอมตะ — ตัวใหญ่ (บอสด่าน 15, ~2 เท่ายูนิตปกติ)
# เกราะเต็มยศผุพัง พู่แดง ดาบมหึมา ผ้าคลุมขาดวิ่น ตาแดงเรือง
# ============================================================
img, d = canvas(40, 56)
ARM = (112, 106, 114, 255)
ARM_HI = (150, 144, 154, 255)
ARM_D = (84, 80, 88, 255)
RUST = (124, 84, 58, 255)
CAPE = (96, 42, 38, 255)
CAPE_D = (70, 30, 28, 255)
# ผ้าคลุมหลังใหญ่ ขาดวิ่น
px(d, 6, 16, 7, 26, CAPE)
px(d, 6, 40, 2, 4, CAPE_D)
px(d, 10, 40, 3, 3, CAPE_D)
px(d, 8, 44, 2, 2, CAPE_D)
# หมวกเกราะเต็มใบ + พู่แดง
px(d, 15, 4, 12, 6, ARM)
px(d, 15, 10, 2, 6, ARM)
px(d, 25, 10, 2, 6, ARM)
px(d, 15, 4, 12, 1, ARM_HI)
px(d, 18, 1, 6, 3, (176, 52, 46, 255))    # พู่
px(d, 20, 0, 2, 1, (176, 52, 46, 255))
px(d, 18, 7, 2, 3, RED)                    # ตาแดงเรืองสองข้าง
px(d, 23, 7, 2, 3, RED)
px(d, 19, 8, 1, 1, (255, 150, 130, 255))   # แววตา
px(d, 17, 12, 8, 1, ARM_D)                 # ช่องหายใจหมวก
px(d, 17, 14, 8, 1, ARM_D)
# ลำตัวเกราะมหึมา
px(d, 13, 16, 16, 16, ARM)
px(d, 13, 16, 16, 1, ARM_HI)
px(d, 12, 16, 4, 4, ARM_HI)                # ไหล่ซ้ายใหญ่
px(d, 26, 16, 4, 4, ARM_HI)                # ไหล่ขวาใหญ่
px(d, 11, 15, 2, 2, ARM_D)                 # หนามไหล่
px(d, 29, 15, 2, 2, ARM_D)
px(d, 16, 20, 10, 1, ARM_D)                # เส้นเกราะอก
px(d, 19, 22, 4, 4, (60, 26, 24, 255))     # ตราสังเวียนกลางอก
px(d, 20, 23, 2, 2, RED)
# สนิม/รอยผุ
px(d, 14, 19, 2, 1, RUST)
px(d, 26, 24, 3, 1, RUST)
px(d, 16, 29, 2, 1, RUST)
px(d, 24, 30, 2, 1, RUST)
# แขนเกราะ
px(d, 10, 20, 3, 10, ARM_D)
px(d, 29, 20, 3, 10, ARM_D)
px(d, 10, 30, 3, 2, BONE)                  # มือโครงโผล่จากเกราะ
# ขาเกราะหนา
px(d, 15, 32, 4, 12, ARM_D)
px(d, 23, 32, 4, 12, ARM_D)
px(d, 15, 36, 4, 1, RUST)
px(d, 13, 44, 6, 3, (48, 44, 40, 255))     # รองเท้าเหล็ก
px(d, 23, 44, 6, 3, (48, 44, 40, 255))
# ดาบมหึมาสองมือ (ขวา สูงเท่าตัว)
px(d, 33, 2, 4, 30, (182, 182, 196, 255))
px(d, 34, 2, 1, 30, (222, 222, 234, 255))  # คมดาบเงา
px(d, 33, 0, 4, 2, (222, 222, 234, 255))   # ปลายดาบ
px(d, 31, 32, 8, 2, (122, 92, 48, 255))    # การ์ดดาบ
px(d, 34, 34, 2, 6, (94, 70, 40, 255))     # ด้ามจับ
px(d, 33, 40, 4, 2, (150, 122, 66, 255))   # หัวด้าม
# รอยแตกบนดาบ (อาวุธเก่าแก่)
px(d, 35, 10, 1, 3, (130, 130, 145, 255))
px(d, 34, 20, 1, 2, (130, 130, 145, 255))
out["boss_champion_big"] = save(img, "boss_champion_big")

# ---------- contact sheet เฉพาะ 3 ตัวใหม่ ----------
pad = 14
cw = max(i.width for i in out.values()) + pad * 2
ch = max(i.height for i in out.values()) + pad * 2 + 18
sheet = Image.new("RGBA", (cw * 3, ch), (36, 28, 20, 255))
ds = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(out.items()):
    cx = i * cw
    ds.rectangle([cx + 4, 4, cx + cw - 5, ch - 5],
                 fill=(52, 42, 32, 255), outline=(110, 92, 66, 255))
    sheet.paste(im, (cx + (cw - im.width) // 2, pad + (ch - 18 - pad * 2 - im.height) // 2 + pad), im)
    ds.text((cx + 10, ch - 20), n, fill=(224, 210, 180, 255))
sheet.save(f"{OUT}/contact_sheet_bosses.png")
print("done")

````

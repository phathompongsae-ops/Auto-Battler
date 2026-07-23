// หาก Three.js โหลดไม่สำเร็จ (network/CDN ล่ม) ให้ขึ้นข้อความแจ้งเตือนชัดเจนแทนจอมืดเงียบๆ
if (typeof THREE === 'undefined') {
  document.getElementById('loading').textContent = 'โหลดไลบรารีกราฟิก (Three.js) ไม่สำเร็จ — เช็คการเชื่อมต่ออินเทอร์เน็ต/Ad-blocker แล้วรีเฟรชหน้านี้ใหม่';
  throw new Error('THREE.js failed to load — aborting game init');
}
// เผื่อ error อื่นระหว่าง init (ก่อน loadAllSprites ซ่อนจอโหลด) ให้ขึ้นข้อความชัดเจนแทนจอมืดเงียบๆ
window.addEventListener('error', (ev) => {
  const loadingEl = document.getElementById('loading');
  if (loadingEl && loadingEl.style.display !== 'none') {
    loadingEl.textContent = 'เกิดข้อผิดพลาดระหว่างโหลดเกม: ' + (ev.message || 'unknown error') + ' — รีเฟรชหน้านี้ใหม่';
    loadingEl.style.display = 'flex';
  }
});
// ============================================================
// CONFIG
// ============================================================
// กระดาน 8 คอลัมน์ x 7 แถว (ไม่ใช่จัตุรัสอีกต่อไป) — แถวล่างสุด (BENCH_ROW) รวมเป็นม้านั่งสำรองเข้ากับ
// กระดานเนื้อเดียวกัน แทนที่แผง UI ม้านั่งลอยทับแบบเดิม
const GRID_COLS = 8;
const GRID_ROWS = 7;
const TILE = 1;
const PLAYER_ROWS = [3, 4, 5];       // แถวที่วางฮีโร่ลงสู้ได้
const BENCH_ROW = 6;                 // แถวล่างสุด (ชิดจอผู้เล่นที่สุด) = ม้านั่งสำรอง ไม่ร่วมรบ
const MAX_FIELD = 5;                 // ลงสนามพร้อมกันได้สูงสุด 5 ตัว ที่เหลือรอในม้านั่งสำรอง
const MAX_BENCH = 5;                 // ม้านั่งสำรอง = 5 ช่อง (ล็อกตามกฎ Demo 1) — แยกจาก GRID_COLS โดยตั้งใจ
                                      // เพราะแถวม้านั่งยังกว้าง 8 คอลัมน์เท่าเดิม (ไม่แตะขนาดกระดาน)
                                      // ใช้แค่ 5 คอลัมน์แรก (c=0..4) เป็นช่องม้านั่งที่วางได้จริง
const WAVE_TOTAL = 15;
const MAX_LOSSES = 3;                // แพ้ได้สูงสุด 3 ครั้งต่อรัน ก่อนที่จะจบเกมจริง (นับต่อแมพตาม GDD)

// ============================================================
// SHOP ECONOMY — ข้อมูลตั้งต้นระบบเศรษฐกิจ (ร้านค้า/รายได้) ตามสเปกฉบับสมบูรณ์
// ============================================================
const SHOP_ECONOMY = {
  hero_shop: {
    slots: 3,
    available_tier: 1,
    available_star: 1,
    hero_pool: 'tier_1_only',
    purchase_cost: { tier_1_star_1: 2 },
  },
  hero_sell: {
    tier_1_star_1: { sell_value: 1, purchase_value: 2, refund_rate: 0.5 },
    tier_2_star_1: { sell_value: 3 },
  },
  income: {
    base_income_per_wave: 5,
    win_bonus: 1,
    interest: { gold_per_step: 10, bonus_per_step: 1, max_bonus: 5, max_gold_counted: 50 },
    streak_bonus: [
      { min_streak: 0, max_streak: 1, bonus_gold: 0 },
      { min_streak: 2, max_streak: 3, bonus_gold: 1 },
      { min_streak: 4, max_streak: 5, bonus_gold: 2 },
      { min_streak: 6, max_streak: 99, bonus_gold: 3 },
    ],
  },
  reroll: {
    cost: 2,
    slots: 3,
    free_rerolls_per_wave: 1,
    free_reroll_on_wave_start: true,
    consume_free_reroll_first: true,
  },
};
// มุมกล้องหน้าตรงสมส่วนแบบ threejs-2_5d-clean-v5.html เดิม (position (0,11,11) = angle 45°)
// แทนที่มุม 55°/yaw 15° เดิม เพื่อความรู้สึกหน้าตรง-สมส่วนกว่า — CAMERA_YAW_DEG=90 (ไม่ใช่ 0!) คือค่าที่
// ตรงกับ x=0 ของ Clean V5 จริงๆ: สูตร position ด้านล่างใช้ cos(yaw) กับแกน X และ sin(yaw) กับแกน Z
// ดังนั้น yaw=90° (cos=0, sin=1) จึงวางกล้องไว้บนแกน Z ล้วน (x=0) แบบเดียวกับ (0,11,11) เป๊ะ — ถ้าใช้
// yaw=0 ผิดแบบที่เคยลองมา แถวคอลัมน์ (c/r) จะสลับแกนซ้าย-ขวา/ลึกกันหมด (บั๊กที่เพิ่งเจอตอนกระดานไม่
// เป็นจัตุรัส 8x7 — ตอนยังเป็น 8x8 จัตุรัสสลับแล้วดูไม่ออกเพราะมันสมมาตร)
const CAMERA_ANGLE_DEG = 45, CAMERA_YAW_DEG = 90;
// เลื่อนจุดที่กล้องมองไปทาง "แถวผู้เล่น" เล็กน้อยให้อยู่กลางพื้นที่ 3D ที่เหลือพอดี
const LOOK_TARGET = new THREE.Vector3(0, 0, 1.3);
// #boardContainer เป็นพื้นหลังเต็มจอ (100vw/100vh) เสมอ — UI ทั้งหมดลอยทับด้านบนแทน
const boardContainerEl = document.getElementById('boardContainer');
// ----- Contain-fit frustum (เทคนิคเดียวกับ Clean V5 เดิม) -----
// แทนที่จะเดา CAMERA_ZOOM คงที่ ให้ project มุมกระดานจริง (world space) เข้าไปใน camera-local
// space ด้วย camera.worldToLocal() เพื่อรู้ขนาดกระดานบนจอจริงตามมุมกล้องปัจจุบัน แล้วค่อยตั้ง
// frustum ให้กระดานกิน BOARD_FILL_RATIO ของความสูงจอ และเลื่อนกึ่งกลางจอลงด้วย BOARD_DOWN_BIAS
// ให้กระดานไปอยู่โซนล่างเกือบชิดขอบจอ (เว้นด้านบนให้ topbar ใช้งานได้)
// หมายเหตุ: FILL_RATIO สูงเกินไปแทบไม่เหลือพื้นที่ว่าง (slack) ให้ดันลงล่างได้เลย — ต้องเผื่อ slack
// ไว้พอสมควรก่อน ถึงจะมีที่ให้ดันกระดานลงไปชิดขอบล่างได้จริงตามที่ต้องการ
// งานรอบนี้ (ขยาย Arena ~15-20%): เดิม 0.84 → 0.97 (0.97/0.84 ≈ 1.155 เท่า ตรงช่วง 15-20% ที่ขอ) —
// FILL_RATIO เป็น "สัดส่วนความสูงจอ" ล้วนๆ แต่เพราะ halfW คำนวณจาก halfH*aspect เสมอ (สัดส่วน
// เดียวกันทุกแกน ไม่บิดภาพ) การเพิ่มค่านี้ค่าเดียวจึงขยายกระดานขึ้นเท่ากันทั้งแนวกว้าง-สูงโดยอัตโนมัติ
// (ยืนยันด้วยการวัด pixel จริงที่ desktop/มือถือแนวนอน/tablet ว่าโตขึ้น ~15% สม่ำเสมอทั้ง 3 ขนาดจอ) —
// ทดลองทำ "contain-fit หักความกว้างแผงจริงจาก DOM" มาก่อน แต่พบว่าขัดกับพฤติกรรมเดิมที่แผงลอยทับขอบ
// กระดานอยู่แล้วโดยตั้งใจ (ดูคอมเมนต์ CSS `.floatPanel` เดิม) และทำให้กระดานที่ tablet เล็กลงกว่าเดิม
// จึงตัดออก ใช้ FILL_RATIO เดี่ยวเหมือนเดิมแต่ปรับค่าขึ้น ง่ายกว่าและตรงกับ baseline ที่ทดสอบจริง
const BOARD_FILL_RATIO = 0.97;
const BOARD_DOWN_BIAS = 0.97;  // 0 = ชิดขอบบน, 0.5 = กึ่งกลางจอ, 1 = ชิดขอบล่างสุด
const TOPBAR_CLEAR_PAD = 6;    // px เว้นระหว่างขอบบนกระดานกับขอบล่าง topbar จริง
const boardHalfW = GRID_COLS / 2 * TILE + 0.25;
const boardHalfD = GRID_ROWS / 2 * TILE + 0.25;
const boardCorners = [
  new THREE.Vector3(-boardHalfW, 0, -boardHalfD), new THREE.Vector3(boardHalfW, 0, -boardHalfD),
  new THREE.Vector3(-boardHalfW, 0, boardHalfD), new THREE.Vector3(boardHalfW, 0, boardHalfD),
];
function layoutBoard() {
  // เผื่อกรณี window.innerHeight เป็น 0 ชั่วขณะ (เช่น browser chrome กำลัง animate ตอน rotate จอ) —
  // ป้องกัน aspect กลายเป็น Infinity/NaN ซึ่งจะทำให้ camera frustum พัง จอมืดสนิท
  const w = window.innerWidth || 1, h = window.innerHeight || 1;
  renderer.setSize(w, h);
  const aspect = w / h;

  camera.updateMatrixWorld(true); // worldToLocal ต้องใช้ matrixWorld ล่าสุดของกล้อง
  let contentHalfW = 0, contentHalfH = 0;
  boardCorners.forEach((p) => {
    const local = camera.worldToLocal(p.clone());
    contentHalfW = Math.max(contentHalfW, Math.abs(local.x));
    contentHalfH = Math.max(contentHalfH, Math.abs(local.y));
  });

  let halfH = contentHalfH / BOARD_FILL_RATIO;
  let halfW = halfH * aspect;
  if (halfW < contentHalfW * 1.02) { // จอแคบมาก (เช่นแนวตั้ง): fit ตามความกว้างแทนกันกระดานล้นซ้าย-ขวา
    halfW = contentHalfW * 1.02;
    halfH = halfW / aspect;
  }
  // BOARD_DOWN_BIAS แปลงเป็นตำแหน่งกึ่งกลาง frustum จริง: slack ทั้งหมด (halfH-contentHalfH)
  // ถูกแบ่งเป็นขอบบน/ขอบล่างตามสัดส่วน BIAS (BIAS=1 → slack ทั้งหมดอยู่ขอบบน, กระดานชิดขอบล่างสนิท)
  const slack = halfH - contentHalfH;
  let cY = slack * (2 * BOARD_DOWN_BIAS - 1);
  // กันแถวบนสุดของกระดานมุดใต้ topbar (ผู้ใช้รายงานจากมือถือจริงหลังขยาย FILL_RATIO เป็น 0.97):
  // วัดความสูง topbar จริงจาก DOM (ไม่ hardcode — topbar สูงไม่เท่ากันในแต่ละ breakpoint) แล้วเลื่อน
  // frustum ลงเท่าที่ขาดพอดี — กิน margin ล่างซึ่งเหลือเยอะทุกขนาดจอ (~97-200px ที่วัดจริง เพราะ
  // กระดานเอียง 45° ทำให้ขอบหน้า project ไม่ถึงขอบล่างจอ) — เลื่อนเฉพาะเมื่อขาดจริง (deficit > 0)
  // จอที่โล่งอยู่แล้วไม่ขยับเลย
  const topbarEl = document.getElementById('topbar');
  if (topbarEl) {
    const topGapPx = ((cY + halfH - contentHalfH) / (2 * halfH)) * h;
    const deficit = (topbarEl.getBoundingClientRect().bottom + TOPBAR_CLEAR_PAD) - topGapPx;
    if (deficit > 0) cY += deficit * (2 * halfH) / h;
  }
  camera.left = -halfW; camera.right = halfW;
  camera.top = cY + halfH; camera.bottom = cY - halfH;
  camera.updateProjectionMatrix();
}

// ============================================================
// RENDERER / SCENE / CAMERA
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth || 1, window.innerHeight || 1);
boardContainerEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1510);
scene.fog = new THREE.Fog(0x1c1510, 18, 34);

// กรอบ frustum ชั่วคราว — layoutBoard() (เรียกด้านล่างหลังตั้งตำแหน่งกล้อง) จะคำนวณค่าจริงทับให้ทันที
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
const camDist = 20;
const aR = THREE.MathUtils.degToRad(CAMERA_ANGLE_DEG), yR = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);
camera.position.set(camDist*Math.cos(aR)*Math.cos(yR), camDist*Math.sin(aR), camDist*Math.cos(aR)*Math.sin(yR));
camera.position.add(LOOK_TARGET);
camera.lookAt(LOOK_TARGET);
layoutBoard(); // ตั้ง frustum จริงตามเทคนิค contain-fit (ต้องเรียกหลัง position/lookAt เสมอ)

scene.add(new THREE.AmbientLight(0x8a7a68, 0.9));
const torch = new THREE.DirectionalLight(0xffb060, 0.7);
torch.position.set(6, 10, 3);
scene.add(torch);

function gridToWorld(c, r) { return new THREE.Vector3((c - GRID_COLS/2)*TILE + TILE/2, 0, (r - GRID_ROWS/2)*TILE + TILE/2); }

// ============================================================
// พื้น + เสาหัก (ธีมซากอารีน่าหิน) — ไทล์ผู้เล่นเรืองเขียวจางบอกโซนวาง
// ============================================================
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function toTexture(cv){const t=new THREE.CanvasTexture(cv);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;return t;}
function stoneTileTexture(base, seed) {
  const cv = makeCanvas(32,32), g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0,0,32,32);
  let s = seed; const rnd = () => (s=(s*16807)%2147483647)/2147483647;
  for (let i=0;i<90;i++){const v=rnd();g.fillStyle=v<0.5?'rgba(0,0,0,0.10)':'rgba(255,240,210,0.06)';g.fillRect((rnd()*32)|0,(rnd()*32)|0,1+(rnd()*2|0),1+(rnd()*2|0));}
  g.strokeStyle='rgba(0,0,0,0.28)'; g.lineWidth=1; g.strokeRect(0.5,0.5,31,31);
  return toTexture(cv);
}
const texA = stoneTileTexture('#6e6552', 41);
const texB = stoneTileTexture('#5d5645', 977);
const tileGeo = new THREE.PlaneGeometry(TILE*0.98, TILE*0.98);
const tileMeshes = [];
for (let r=0;r<GRID_ROWS;r++) for (let c=0;c<GRID_COLS;c++) {
  const isPlayerZone = PLAYER_ROWS.includes(r);
  const isBench = r === BENCH_ROW; // แถวล่างสุด: โซนม้านั่งสำรอง — เข้มกว่าโซนอื่นให้แยกออก
  // โทนปกติจางลงมากจากเดิม (เส้น/โซนแทบกลืนเป็นพื้นเวทีเดียว) — สีเขียว/แดงชัดๆ ใช้เฉพาะตอน
  // เลือก/ลากวางผ่าน updateTileHighlights() เท่านั้น
  const baseTint = isBench ? 0x7d6f58 : (isPlayerZone ? 0xb7c9b4 : 0xbfc4cf);
  // MeshStandardMaterial (แทน MeshBasicMaterial เดิม) ให้ไทล์รับแสง/เงาจาก DirectionalLight จริง —
  // ดูเป็นพื้นเวที ไม่ใช่กริด UI แบนๆ — ยังคง .color/.opacity ที่ updateTileHighlights() แก้ได้เหมือนเดิม
  const mat = new THREE.MeshStandardMaterial({ map: (c+r)%2===0?texA:texB, color: baseTint, side: THREE.DoubleSide, transparent: true, roughness: 1, metalness: 0 });
  const m = new THREE.Mesh(tileGeo, mat);
  m.rotation.x = -Math.PI/2;
  const p = gridToWorld(c,r);
  m.position.set(p.x, 0, p.z);
  const isUsableBench = isBench && c < MAX_BENCH; // คอลัมน์ 5-7 ของแถวม้านั่งเกินโควตา 5 ช่อง — วางไม่ได้
  m.userData = { isTile: true, c, r, playerZone: isPlayerZone || isUsableBench, isBench, baseTint };
  scene.add(m);
  tileMeshes.push(m);
}
// ไฮไลต์ช่องวางตัว: ทำงานเฉพาะตอนกำลังเลือก (selectedUnit) หรือกำลังลาก (unitDrag.moved) —
// ช่องผู้เล่นที่ว่าง = เขียวอ่อน (แถวม้านั่ง = ฟ้าอ่อน), ช่องที่ใช้งานอยู่/วางไม่ได้ = แดงโปร่งใส,
// เวลาปกติทุกช่องกลับเป็นสีพื้นจางๆ (baseTint) — แตะแค่ material color/opacity ไม่แตะพิกัด/กติกาวางตัว
// ระหว่างลากจริง (dragging) ไฮไลต์เฉพาะ "ช่องเดียวใต้ pointer ตอนนี้" (unitDrag.hoverTile ซึ่งอัปเดต
// แบบ real-time ใน pointermove) ไม่ใช่โชว์ทุกช่องที่วางได้พร้อมกัน — ต่างจากโหมด tap-select
// (selectedUnit ไม่มีการลาก) ซึ่งยังคงพฤติกรรมเดิม (โชว์ปลายทางที่วางได้ทั้งหมดพร้อมกัน)
function updateTileHighlights() {
  const dragging = !!(unitDrag && unitDrag.moved);
  const placing = !!selectedUnit || dragging;
  tileMeshes.forEach((m) => {
    const ud = m.userData;
    const show = dragging
      ? (!!unitDrag.hoverTile && unitDrag.hoverTile.c === ud.c && unitDrag.hoverTile.r === ud.r)
      : (placing && ud.playerZone);
    if (!show) {
      m.material.color.set(ud.baseTint);
      m.material.opacity = 1;
      return;
    }
    if (occupied.has(key(ud.c, ud.r))) {
      m.material.color.set(0xe07a70);
      m.material.opacity = 0.72;
    } else {
      m.material.color.set(ud.isBench ? 0x9fd8e8 : 0x8fe6a8);
      m.material.opacity = 1;
    }
  });
}
// พื้นเวทีรอบนอก (arena floor): แทนที่พื้นสีล้วนเดิมด้วยลายหินโมเสกแบบ procedural (ตาม asset
// policy — วาดด้วย canvas ล้วน ไม่ใช้ asset ภายนอก) ปูซ้ำ (RepeatWrapping) ให้ดูเป็นลานหินจริง
function arenaFloorTexture() {
  const cv = makeCanvas(128,128), g = cv.getContext('2d');
  g.fillStyle = '#23283a'; g.fillRect(0,0,128,128);
  let s = 731; const rnd = () => (s=(s*16807)%2147483647)/2147483647;
  for (let gy=0; gy<128; gy+=16) for (let gx=0; gx<128; gx+=16) {
    g.strokeStyle = 'rgba(10,12,20,0.55)'; g.lineWidth = 1;
    g.strokeRect(gx+0.5, gy+0.5, 16-1, 16-1);
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(gx+2, gy+2, 12, 12);
  }
  for (let i=0;i<200;i++){ g.fillStyle = rnd()<0.5?'rgba(0,0,0,0.12)':'rgba(216,173,77,0.05)'; g.fillRect((rnd()*128)|0,(rnd()*128)|0,1,1); }
  return toTexture(cv);
}
const arenaFloorTex = arenaFloorTexture();
arenaFloorTex.wrapS = arenaFloorTex.wrapT = THREE.RepeatWrapping;
arenaFloorTex.repeat.set(10, 10);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60,60),
  new THREE.MeshStandardMaterial({ map: arenaFloorTex, color: 0x9aa0b8, roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI/2; ground.position.y = -0.02; scene.add(ground);

// ----- กรอบเวทีแฟนตาซี (stage frame) รอบกระดาน 8x7: ขอบหินโทนน้ำเงินเทา + เสาหัวมุมยอดทอง +
// ธงมุมเวที + คบเพลิงฝั่งม้านั่ง — geometry/canvas-texture ล้วนตาม asset policy (ไม่มี asset ใหม่)
// อยู่นอกพื้นที่ไทล์ ไม่ถูกรวมใน raycast ใดๆ (ไม่อยู่ใน tileMeshes/units) จึงไม่กระทบการคลิก/วางตัว
// และไม่บังตัวละคร/หลอด HP (เสา/ธง/คบเพลิงทั้งหมดอยู่นอกขอบ halfW/halfD ของกระดาน)
function clothBannerTexture(colorA, colorB) {
  const cv = makeCanvas(32,64), g = cv.getContext('2d');
  g.fillStyle = colorA; g.fillRect(0,0,32,64);
  g.fillStyle = colorB; g.fillRect(0,0,32,10); g.fillRect(0,54,32,10);
  g.fillStyle = 'rgba(216,173,77,0.9)';
  g.beginPath(); g.moveTo(16,22); g.lineTo(24,32); g.lineTo(16,42); g.lineTo(8,32); g.closePath(); g.fill();
  return toTexture(cv);
}
const bannerTex = clothBannerTexture('#2c3448', '#1b3a63');
function glowFlareTexture() {
  const cv = makeCanvas(32,32), g = cv.getContext('2d');
  const grd = g.createRadialGradient(16,16,0,16,16,16);
  grd.addColorStop(0, 'rgba(255,200,120,0.95)');
  grd.addColorStop(0.5, 'rgba(255,140,50,0.45)');
  grd.addColorStop(1, 'rgba(255,140,50,0)');
  g.fillStyle = grd; g.fillRect(0,0,32,32);
  return toTexture(cv);
}
const flareTex = glowFlareTexture();
{
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2c3448, roughness: 0.95, metalness: 0.05 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd8ad4d, roughness: 0.6, metalness: 0.3 });
  const rimH = 0.1, rimT = 0.24;
  const halfW = GRID_COLS / 2 * TILE, halfD = GRID_ROWS / 2 * TILE;
  const addRim = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, rimH, d), rimMat);
    m.position.set(x, rimH / 2 - 0.01, z);
    scene.add(m);
  };
  addRim(GRID_COLS * TILE + rimT * 2, rimT, 0, -(halfD + rimT / 2)); // ขอบหลัง (ฝั่งศัตรู)
  addRim(GRID_COLS * TILE + rimT * 2, rimT, 0, halfD + rimT / 2);   // ขอบหน้า (ฝั่งม้านั่ง)
  addRim(rimT, GRID_ROWS * TILE, -(halfW + rimT / 2), 0);           // ขอบซ้าย
  addRim(rimT, GRID_ROWS * TILE, halfW + rimT / 2, 0);              // ขอบขวา
  // เสามุมเวที: สูงขึ้นจากเดิม (เสาหัวมุมเตี้ย -> เสาเวทีจริง) + ธงทุกมุม + คบเพลิงเฉพาะฝั่งม้านั่ง (sz=1,
  // ใกล้กล้อง/ผู้เล่นมากสุด) — จำกัดจำนวนแสง/เอฟเฟกต์ตาม art direction (ไม่เพิ่ม PointLight จริง ใช้
  // Sprite เรืองแสง additive แทนเพื่อคุม cost การเรนเดอร์ให้เท่าเดิม)
  const postH = 0.9;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const px = sx * (halfW + rimT / 2), pz = sz * (halfD + rimT / 2);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, postH, 0.3), rimMat);
    post.position.set(px, postH / 2 - 0.01, pz); scene.add(post);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.36), trimMat);
    cap.position.set(px, postH - 0.01 + 0.045, pz); scene.add(cap);

    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.68),
      new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, roughness: 1, metalness: 0 }));
    banner.position.set(px - sx * 0.24, postH - 0.42, pz);
    banner.rotation.y = sx * 0.5;
    scene.add(banner);

    if (sz === 1) { // คบเพลิง 2 อันฝั่งม้านั่ง (ใกล้กล้องสุด) — แกนไม้ + เปลวไฟเรืองแสงเบาๆ ไม่มีไฟจริงเพิ่ม
      const torchPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 }));
      torchPole.position.set(px, postH + 0.2, pz); scene.add(torchPole);
      const flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8),
        new THREE.MeshBasicMaterial({ color: 0xffb347 }));
      flameCore.position.set(px, postH + 0.5, pz); scene.add(flameCore);
      const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flare.scale.set(0.7, 0.7, 1);
      flare.position.set(px, postH + 0.52, pz); scene.add(flare);
    }
  });
}

function brokenPillar(x,z,h,tilt){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,h,6), new THREE.MeshStandardMaterial({color:0x7a7060, roughness:1}));
  m.position.set(x,h/2-0.02,z); m.rotation.z=tilt; scene.add(m);
  const base=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.25,0.7), new THREE.MeshStandardMaterial({color:0x685e4e, roughness:1}));
  base.position.set(x,0.1,z); scene.add(base);
}
function rubble(x,z,s){
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), new THREE.MeshStandardMaterial({color:0x6a6152, roughness:1}));
  m.position.set(x,s*0.5,z); m.rotation.set(Math.random()*3,Math.random()*3,0); scene.add(m);
}
brokenPillar(-5.2,-5.0,2.6,0.05); brokenPillar(5.0,-5.2,1.4,-0.12);
brokenPillar(-5.4,5.1,0.9,0.18); brokenPillar(5.3,5.0,2.2,-0.04);
rubble(-4.6,-3.2,0.22); rubble(4.8,-2.4,0.18); rubble(4.5,3.6,0.26); rubble(-4.9,2.8,0.16);

// ============================================================
// SPRITES
// ============================================================
const ASSET_META = {
  BladeMaster:  { path: 'assets/heroes/blademaster_sheet.png',  frames: 8 },
  BeastLord:    { path: 'assets/heroes/beastlord_sheet.png',    frames: 8 },
  Trickster:    { path: 'assets/heroes/trickster_sheet.png',    frames: 8 },
  Duelist:      { path: 'assets/heroes/duelist_sheet.png',      frames: 8 },
  Archmage:     { path: 'assets/heroes/archmage_sheet.png',     frames: 8 },
  FrostWeaver:  { path: 'assets/heroes/frostweaver_sheet.png',  frames: 8 },
  Summoner:     { path: 'assets/heroes/summoner_sheet.png',     frames: 8 },
  Sniper:       { path: 'assets/heroes/sniper_sheet.png',       frames: 8 },
  Skeleton:       { path: 'assets/mon_skeleton.png',       frames: 1 },
  StoneWolf:      { path: 'assets/mon_stonewolf.png',      frames: 1 },
  SpiritArcher:   { path: 'assets/mon_spiritarcher.png',   frames: 1 },
  ShadowAssassin: { path: 'assets/mon_shadowassassin.png', frames: 1 },
  Warden:         { path: 'assets/miniboss_warden.png',    frames: 1 }, // obsolete (ดู STAGE5_MINIBOSS_POOL) เก็บไว้อ้างอิงเท่านั้น
  Golem:          { path: 'assets/mon_golem.png',          frames: 1 },
  OrcWarlord:     { path: 'assets/orc_warlord.png',        frames: 1 },
  BoneDragon:     { path: 'assets/mon_bonedragon.png',     frames: 1 },
  LichKing:       { path: 'assets/lich_king.png',          frames: 1 },
  ArenaOverlord:  { path: 'assets/arena_overlord.png',     frames: 1 },
  ChampionBig:    { path: 'assets/boss_champion_big.png',  frames: 1 }, // obsolete (ดู STAGE15_FINAL_BOSS) เก็บไว้อ้างอิงเท่านั้น
};
const SPRITES = {};
// sprite key ที่โหลด texture ไม่สำเร็จ (ไฟล์หาย/พิมพ์ผิด/case ไม่ตรงบน GitHub Pages) — makeUnit()
// เช็คชุดนี้เพื่อตกไปใช้ placeholder box แทน ไม่ใช่ปล่อยให้ map:undefined หลุดเข้า material
const failedSpriteKeys = new Set();

// ============================================================
// Skeleton Runtime Integration Pilot v1 — PRESENTATION ONLY.
// Adds a 5-state (idle/move/attack/hit/death) frame-swap animation for Skeleton units only.
// Every frame is a byte-identical copy of the Exact-Motion-Package-Approved production frame
// (see docs/assets/review/monster-production/skeleton-motion-pilot-v1/). Nothing here reads or
// writes combat/damage/cooldown state — it only decides which already-approved texture is
// currently shown on an existing unit's existing sprite plane. If these textures fail to load,
// SKELETON_MOTION_READY stays false and Skeleton silently falls back to its original static
// ASSET_META.Skeleton sprite (assets/mon_skeleton.png) — the pre-existing behavior, untouched.
//
// Durations below are copied unmodified (cs -> seconds) from the approved package's
// data/timing-overview.json. basic_attack_markers are carried only as documentation of the
// approved presentational timing contract; they are never read by any combat/damage code path.
const SKELETON_ANIM_DEF = {
  idle:   { frameCount: 6, durations: [0.17,0.16,0.17,0.17,0.16,0.17], loop: true },
  move:   { frameCount: 8, durations: [0.10,0.10,0.10,0.10,0.10,0.10,0.10,0.10], loop: true },
  basic_attack: { frameCount: 9, durations: [0.14,0.12,0.10,0.06,0.08,0.08,0.08,0.12,0.12], loop: false,
    // presentational only — NOT wired to damage timing; Combat/cooldown remain Runtime-owned.
    markers: { release_frame: 3, release_time_cs: 36, impact_frame: 4, impact_time_cs: 42 } },
  hit:    { frameCount: 4, durations: [0.10,0.10,0.10,0.14], loop: false },
  death:  { frameCount: 9, durations: [0.10,0.10,0.10,0.10,0.12,0.12,0.14,0.15,0.15], loop: false },
};
function skeletonFramePath(state, idx) {
  const n = String(idx).padStart(3, '0');
  return `assets/monsters/skeleton_motion/${state}/skeleton_${state}_${n}.png`;
}
const SKELETON_TEXTURES = {}; // { idle: THREE.Texture[], move: [...], ... }
const SKELETON_TEXTURE_SET = new Set(); // membership check for isSharedUnitTexture()
let SKELETON_MOTION_READY = false;
function loadSkeletonMotionSprites() {
  const loader = new THREE.TextureLoader();
  const states = Object.keys(SKELETON_ANIM_DEF);
  let total = 0, settled = 0, anyFailed = false;
  states.forEach((s) => { SKELETON_TEXTURES[s] = new Array(SKELETON_ANIM_DEF[s].frameCount); total += SKELETON_ANIM_DEF[s].frameCount; });
  states.forEach((state) => {
    const count = SKELETON_ANIM_DEF[state].frameCount;
    for (let i = 0; i < count; i++) {
      loader.load(skeletonFramePath(state, i), (tex) => {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        SKELETON_TEXTURES[state][i] = tex; SKELETON_TEXTURE_SET.add(tex);
        settled++;
        if (settled === total && !anyFailed) SKELETON_MOTION_READY = true;
      }, undefined, (err) => {
        anyFailed = true; settled++;
        console.error('Skeleton motion frame load failed (falling back to static sprite):', state, i, err);
      });
    }
  });
}
// ============================================================
// Monster Demo Batch 1 — Remaining Five Runtime Integration v1 — PRESENTATION ONLY.
// Shared, data-driven extension of the Skeleton Runtime Pilot's contract to Slime, OrcBrute,
// StoneWolf, SpiritArcher, and Golem. Reuses the exact same generic functions below
// (setMonsterFrame/triggerMonsterAnim/updateMonsterMotionAnim/advanceMonsterDeathAnim/
// monsterFramePath) across all five monsters via one shared MONSTER_MOTION_DEFS table,
// instead of five bespoke per-monster systems. Skeleton's own SKELETON_ANIM_DEF/
// SKELETON_TEXTURES/etc. above are untouched — this is an additive sibling data source
// feeding a second, equally generic, set of functions (skeletonFrameIndexForTime is reused
// as-is below since it was already fully generic).
//
// Every frame is a byte-identical copy of the Exact-Motion-Package-Approved v1.1 production
// frame (see docs/assets/review/monster-production/monster-demo-batch-1-remaining-five-runtime-v1/).
// Durations below are copied unmodified (cs -> seconds) from each monster's approved metadata
// sidecar. basic_attack markers are carried only as inert documentation of the approved
// presentational timing contract; they are never read by any combat/damage code path.
// RuntimeFlipX is recommended by every one of these monsters' metadata (identical text to
// Skeleton's own package) but, matching the Skeleton Runtime Pilot's own decision, is not
// applied — this Runtime has no flip logic anywhere (units are camera-facing billboards),
// so this is a recommendation-only note, not a regression.
const MONSTER_MOTION_DEFS = {
  Slime: { packageDir: 'slime', filePrefix: 'slime', states: {
    idle: { frameCount: 6, durations: [0.18, 0.16, 0.16, 0.18, 0.16, 0.16], loop: true },
    move: { frameCount: 8, durations: [0.1, 0.09, 0.09, 0.1, 0.1, 0.09, 0.09, 0.1], loop: true },
    basic_attack: { frameCount: 8, durations: [0.14, 0.12, 0.1, 0.07, 0.08, 0.09, 0.1, 0.14], loop: false,
      markers: { release_frame: 3, release_time_cs: 36, impact_frame: 4, impact_time_cs: 43 } },
    hit: { frameCount: 4, durations: [0.09, 0.09, 0.1, 0.14], loop: false },
    death: { frameCount: 8, durations: [0.1, 0.1, 0.11, 0.12, 0.13, 0.14, 0.16, 0.18], loop: false },
  } },
  OrcBrute: { packageDir: 'orc', filePrefix: 'orc', states: {
    idle: { frameCount: 6, durations: [0.18, 0.17, 0.18, 0.18, 0.17, 0.18], loop: true },
    move: { frameCount: 8, durations: [0.12, 0.11, 0.12, 0.11, 0.12, 0.11, 0.12, 0.11], loop: true },
    basic_attack: { frameCount: 9, durations: [0.14, 0.12, 0.12, 0.08, 0.07, 0.09, 0.1, 0.12, 0.14], loop: false,
      markers: { release_frame: 3, release_time_cs: 38, impact_frame: 4, impact_time_cs: 46 } },
    hit: { frameCount: 4, durations: [0.1, 0.1, 0.12, 0.15], loop: false },
    death: { frameCount: 9, durations: [0.11, 0.11, 0.12, 0.12, 0.13, 0.14, 0.15, 0.16, 0.18], loop: false },
  } },
  StoneWolf: { packageDir: 'stone-wolf', filePrefix: 'stone_wolf', states: {
    idle: { frameCount: 6, durations: [0.17, 0.16, 0.17, 0.17, 0.16, 0.17], loop: true },
    move: { frameCount: 8, durations: [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08], loop: true },
    basic_attack: { frameCount: 8, durations: [0.12, 0.1, 0.08, 0.07, 0.08, 0.09, 0.1, 0.12], loop: false,
      markers: { release_frame: 3, release_time_cs: 30, impact_frame: 4, impact_time_cs: 37 } },
    hit: { frameCount: 4, durations: [0.08, 0.08, 0.09, 0.12], loop: false },
    death: { frameCount: 8, durations: [0.1, 0.1, 0.11, 0.12, 0.13, 0.14, 0.16, 0.18], loop: false },
  } },
  SpiritArcher: { packageDir: 'spirit-archer', filePrefix: 'spirit_archer', states: {
    idle: { frameCount: 6, durations: [0.18, 0.17, 0.18, 0.18, 0.17, 0.18], loop: true },
    move: { frameCount: 8, durations: [0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09], loop: true },
    // impact is intentionally absent: Spirit Archer's basic attack is ranged (range:4 in
    // ENEMY_BASE), so its own sprite never shows an "impact" pose - impact happens at the
    // target, off-screen from the attacker. This is not a projectile (none is created here);
    // release is the only marker this state carries, matching the approved metadata exactly.
    basic_attack: { frameCount: 9, durations: [0.13, 0.11, 0.1, 0.09, 0.08, 0.07, 0.08, 0.11, 0.13], loop: false,
      markers: { release_frame: 5, release_time_cs: 51 } },
    hit: { frameCount: 4, durations: [0.09, 0.09, 0.1, 0.13], loop: false },
    death: { frameCount: 9, durations: [0.1, 0.1, 0.11, 0.12, 0.12, 0.13, 0.14, 0.15, 0.16], loop: false },
  } },
  Golem: { packageDir: 'golem', filePrefix: 'golem', states: {
    idle: { frameCount: 6, durations: [0.2, 0.19, 0.2, 0.2, 0.19, 0.2], loop: true },
    move: { frameCount: 8, durations: [0.14, 0.13, 0.14, 0.13, 0.14, 0.13, 0.14, 0.13], loop: true },
    basic_attack: { frameCount: 9, durations: [0.16, 0.14, 0.12, 0.09, 0.08, 0.1, 0.12, 0.14, 0.16], loop: false,
      markers: { release_frame: 3, release_time_cs: 42, impact_frame: 4, impact_time_cs: 51 } },
    hit: { frameCount: 4, durations: [0.11, 0.11, 0.12, 0.16], loop: false },
    death: { frameCount: 9, durations: [0.12, 0.12, 0.13, 0.13, 0.14, 0.15, 0.16, 0.18, 0.2], loop: false },
  } },
};
function monsterFramePath(spriteKey, state, idx) {
  const def = MONSTER_MOTION_DEFS[spriteKey];
  const n = String(idx).padStart(3, '0');
  return `assets/monsters/${def.filePrefix}_motion/${state}/${def.filePrefix}_${state}_${n}.png`;
}
const MONSTER_TEXTURES = {}; // { Slime: { idle: THREE.Texture[], ... }, OrcBrute: {...}, ... }
const MONSTER_TEXTURE_SET = new Set(); // membership check for isSharedUnitTexture(), shared across all five
const MONSTER_MOTION_READY = {}; // { Slime: false, OrcBrute: false, ... }
function loadMonsterMotionSprites(spriteKey) {
  const def = MONSTER_MOTION_DEFS[spriteKey];
  const loader = new THREE.TextureLoader();
  const states = Object.keys(def.states);
  let total = 0, settled = 0, anyFailed = false;
  MONSTER_TEXTURES[spriteKey] = {};
  MONSTER_MOTION_READY[spriteKey] = false;
  states.forEach((s) => { MONSTER_TEXTURES[spriteKey][s] = new Array(def.states[s].frameCount); total += def.states[s].frameCount; });
  states.forEach((state) => {
    const count = def.states[state].frameCount;
    for (let i = 0; i < count; i++) {
      loader.load(monsterFramePath(spriteKey, state, i), (tex) => {
        tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
        MONSTER_TEXTURES[spriteKey][state][i] = tex; MONSTER_TEXTURE_SET.add(tex);
        settled++;
        if (settled === total && !anyFailed) MONSTER_MOTION_READY[spriteKey] = true;
      }, undefined, (err) => {
        anyFailed = true; settled++;
        console.error('Monster motion frame load failed (falling back to static sprite):', spriteKey, state, i, err);
      });
    }
  });
}
function loadAllSprites(onDone) {
  const loader = new THREE.TextureLoader();
  const names = Object.keys(ASSET_META);
  let settled = 0;
  let done = false; // กัน onDone() ถูกเรียกซ้ำ (เผื่อ settle() มาถึงพร้อมกันหลายรายการในเฟรมเดียว)
  function settle() {
    settled++;
    if (settled === names.length && !done) { done = true; onDone(); }
  }
  names.forEach((name) => {
    loader.load(ASSET_META[name].path, (tex) => {
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      if (ASSET_META[name].frames > 1) tex.repeat.set(1/ASSET_META[name].frames, 1);
      SPRITES[name] = tex; settle();
    }, undefined, (err) => {
      console.error('โหลดสไปรท์ไม่สำเร็จ:', name, ASSET_META[name].path, err);
      failedSpriteKeys.add(name); settle(); // นับว่า "จบแล้ว" (ล้มเหลว) เพื่อให้ loader ไปต่อได้ ไม่ค้าง
    });
  });
}

// ============================================================
// ข้อมูลฮีโร่ (ร้านค้า) + คลื่นศัตรู
// ============================================================
// Hero roster + tier-1 -> tier-2 evolution data (replaces the old flat roster below).
// `sprite` is NOT part of the design data — it's added here purely to pick which existing
// ASSET_META entry each hero renders with, since only 8 of these 21 heroes have real art
// (assets/heroes/*_sheet.png + assets/portraits/*.png): blade_master, beast_lord, trickster,
// duelist, archmage, frost_weaver, summoner, sniper. Every other hero below (fighter, knight,
// berserker, swordman, archer, ranger, mage, acolyte, priest, inquisitor, merchant, tycoon,
// spirit_blade) has NO dedicated art yet, so it's mapped to the closest existing sprite by
// role/attack_type as a placeholder — swap these once real art lands.
// Manual Link Selection: each hero's buff class is its tier-1 lineage root — `evolves_from`
// for tier-2 heroes, or the hero's own key for tier-1 — see getRootClass()/LINK_CLASS_BUFFS
// below. No extra per-hero tagging field is needed for this.
const HERO_DEFS = {
  fighter:      { name:'Fighter',      class_tier:1, cost:2, sprite:'BladeMaster', synergy:['Warrior'], attack_type:'physical',
    stats:{ hp:500, p_atk:25, m_atk:0, p_def:30, m_def:15, move_speed:2.5, attack_speed:1.1, attack_range:1 },
    active_skill:{ name:'Power Strike', description:'โจมตีเป้าหมายสร้างความเสียหายกายภาพ 160% ของ P.Atk และลด P.Def ของเป้าหมาย 10% เป็นเวลา 4 วินาที' } },
  knight:       { name:'Knight',       class_tier:2, evolves_from:'fighter', cost:3, sprite:'BeastLord', synergy:['Warrior','Guardian','Knight'], attack_type:'physical',
    stats:{ hp:850, p_atk:38, m_atk:0, p_def:55, m_def:32, move_speed:2.2, attack_speed:1.0, attack_range:1 },
    active_skill:{ name:"Guardian's Challenge", description:'ยั่วยุศัตรูในระยะ 2 ช่องเป็นเวลา 3 วินาที พร้อมได้รับโล่เท่ากับ 20% ของ Max HP และลดดาเมจที่ได้รับ 20% ระหว่างยั่วยุ' } },
  berserker:    { name:'Berserker',    class_tier:2, evolves_from:'fighter', cost:3, sprite:'Duelist', synergy:['Warrior','Berserker','Bloodrage'], attack_type:'physical',
    stats:{ hp:720, p_atk:55, m_atk:0, p_def:32, m_def:20, move_speed:2.8, attack_speed:1.25, attack_range:1 },
    active_skill:{ name:'Blood Frenzy', description:'เพิ่ม Attack Speed 45% และ P.Atk 25% เป็นเวลา 6 วินาที หาก HP ต่ำกว่า 50% โบนัสทั้งสองเพิ่มเป็น 60%' } },
  swordman:     { name:'Swordman',     class_tier:1, cost:2, sprite:'BladeMaster', synergy:['Swordsman'], attack_type:'physical',
    stats:{ hp:430, p_atk:32, m_atk:0, p_def:22, m_def:14, move_speed:2.7, attack_speed:1.25, attack_range:1 },
    active_skill:{ name:'Blade Arc', description:'ฟันกวาดศัตรูด้านหน้า สร้างความเสียหายกายภาพ 130% ของ P.Atk แก่ศัตรูสูงสุด 3 ตัว' } },
  blade_master: { name:'Blade Master', class_tier:2, evolves_from:'swordman', cost:3, sprite:'BladeMaster', synergy:['Swordsman','Blade Master','Cleave'], attack_type:'physical', // per legacy_roster_migration.blademaster
    stats:{ hp:680, p_atk:58, m_atk:0, p_def:34, m_def:22, move_speed:2.7, attack_speed:1.35, attack_range:1 },
    active_skill:{ name:'Three-Tile Crescent', description:'ฟันกวาดเป็นแนวโค้งกว้าง 3 ช่องด้านหน้า สร้างความเสียหายกายภาพ 175% ของ P.Atk แก่ศัตรูทุกตัวในพื้นที่' } },
  duelist:      { name:'Duelist',      class_tier:2, evolves_from:'swordman', cost:3, sprite:'Duelist', synergy:['Swordsman','Duelist','Executioner'], attack_type:'physical',
    stats:{ hp:610, p_atk:62, m_atk:0, p_def:27, m_def:24, move_speed:3.0, attack_speed:1.55, attack_range:1 },
    active_skill:{ name:"Duelist's Verdict", description:'โจมตีศัตรูที่มี Max HP สูงที่สุด สร้างความเสียหายกายภาพ 190% ของ P.Atk และเพิ่มอีก 30% หากเป้าหมายมี HP มากกว่าผู้ใช้' } },
  archer:       { name:'Archer',       class_tier:1, cost:2, sprite:'Sniper', synergy:['Archer'], attack_type:'physical',
    stats:{ hp:330, p_atk:29, m_atk:0, p_def:12, m_def:15, move_speed:2.6, attack_speed:1.4, attack_range:4 },
    active_skill:{ name:'Piercing Arrow', description:'ยิงลูกธนูเป็นเส้นตรง สร้างความเสียหายกายภาพ 145% ของ P.Atk แก่ศัตรูทุกตัวในแนว โดยดาเมจลดลง 15% ต่อเป้าหมายที่ทะลุผ่าน' } },
  sniper:       { name:'Sniper',       class_tier:2, evolves_from:'archer', cost:3, sprite:'Sniper', synergy:['Archer','Sniper','Longshot'], attack_type:'physical',
    stats:{ hp:480, p_atk:68, m_atk:0, p_def:17, m_def:24, move_speed:2.3, attack_speed:1.0, attack_range:6 },
    active_skill:{ name:'Deadeye Shot', description:'ยิงเป้าหมายที่อยู่ไกลที่สุด สร้างความเสียหายกายภาพ 220% ของ P.Atk และเจาะ P.Def เพิ่ม 8% ต่อระยะห่าง 1 ช่อง สูงสุด 40%' } },
  ranger:       { name:'Ranger',       class_tier:2, evolves_from:'archer', cost:3, sprite:'Sniper', synergy:['Archer','Ranger','Multishot'], attack_type:'physical',
    stats:{ hp:540, p_atk:48, m_atk:0, p_def:22, m_def:26, move_speed:3.0, attack_speed:1.65, attack_range:5 },
    active_skill:{ name:'Triple Volley', description:'ยิงลูกธนูใส่ศัตรูสูงสุด 3 ตัว แต่ละดอกสร้างความเสียหายกายภาพ 90% ของ P.Atk หากมีเป้าหมายเดียว ลูกธนูทั้งสามจะโจมตีเป้าหมายเดียวโดยดอกที่สองและสามลดดาเมจลง' } },
  mage:         { name:'Mage',         class_tier:1, cost:2, sprite:'Archmage', synergy:['Mage'], attack_type:'magic',
    stats:{ hp:300, p_atk:0, m_atk:36, p_def:9, m_def:24, move_speed:2.1, attack_speed:0.9, attack_range:4 },
    active_skill:{ name:'Arcane Burst', description:'ระเบิดพลังเวทรอบเป้าหมาย สร้างความเสียหายเวท 150% ของ M.Atk แก่ศัตรูในระยะ 1 ช่อง' } },
  archmage:     { name:'Archmage',     class_tier:2, evolves_from:'mage', cost:3, sprite:'Archmage', synergy:['Mage','Archmage','Arcane'], attack_type:'magic',
    stats:{ hp:470, p_atk:0, m_atk:78, p_def:14, m_def:42, move_speed:2.0, attack_speed:0.85, attack_range:5 },
    active_skill:{ name:'Grand Arcane Inferno', description:'สร้างระเบิดเวทขนาดใหญ่รอบเป้าหมาย สร้างความเสียหายเวท 185% ของ M.Atk และเผาไหม้ต่ออีก 4 วินาที รวมความเสียหาย 60% ของ M.Atk' } },
  frost_weaver: { name:'Frost Weaver', class_tier:2, evolves_from:'mage', cost:3, sprite:'FrostWeaver', synergy:['Mage','Frost','Controller'], attack_type:'magic',
    stats:{ hp:520, p_atk:0, m_atk:62, p_def:18, m_def:48, move_speed:2.0, attack_speed:1.0, attack_range:5 },
    active_skill:{ name:'Frozen Domain', description:'สร้างความเสียหายเวท 135% ของ M.Atk แก่ศัตรูรอบเป้าหมาย ลด Move Speed และ Attack Speed 30% เป็นเวลา 4 วินาที ศัตรูที่ติด Slow อยู่แล้วจะถูก Freeze 1.5 วินาที' } },
  summoner:     { name:'Summoner',     class_tier:1, cost:2, sprite:'Summoner', synergy:['Summoner'], attack_type:'magic',
    stats:{ hp:350, p_atk:0, m_atk:28, p_def:12, m_def:22, move_speed:2.2, attack_speed:1.0, attack_range:3 },
    active_skill:{ name:'Spirit Familiar', description:'อัญเชิญวิญญาณในช่องว่างข้างตัว วิญญาณมี HP เท่ากับ 35% ของผู้เรียก และโจมตีเวทด้วยพลัง 50% ของ M.Atk ของผู้เรียก' } },
  beast_lord:   { name:'Beast Lord',   class_tier:2, evolves_from:'summoner', cost:3, sprite:'BeastLord', synergy:['Summoner','Beast','Dragon'], attack_type:'magic',
    stats:{ hp:650, p_atk:0, m_atk:52, p_def:28, m_def:36, move_speed:2.3, attack_speed:1.0, attack_range:3 },
    active_skill:{ name:'Call Spirit Dragon', description:'อัญเชิญมังกรวิญญาณในช่องว่างข้างตัว มังกรมี HP เท่ากับ 60% ของ Beast Lord และทุกการโจมตีครั้งที่ 3 จะพ่นลมหายใจเวทเป็นแนว 2 ช่อง หากมังกรมีชีวิตอยู่แล้ว สกิลจะฟื้นฟู HP มังกร 40%' } },
  spirit_blade: { name:'Spirit Blade', class_tier:2, evolves_from:'summoner', cost:3, sprite:'Duelist', synergy:['Summoner','Spirit','Duelist'], attack_type:'physical', // melee duelist-style unit despite the Summoner lineage — no pet of its own, plays like striker
    stats:{ hp:670, p_atk:57, m_atk:34, p_def:33, m_def:31, move_speed:2.9, attack_speed:1.45, attack_range:1 },
    active_skill:{ name:'Spirit Merge', description:'รวมร่างกับวิญญาณเป็นเวลา 7 วินาที เพิ่ม P.Atk 30% และ Attack Speed 35% พร้อมทำให้การโจมตีปกติสร้างดาเมจเวทเพิ่มเติม 20% ของ M.Atk' } },
  acolyte:      { name:'Acolyte',      class_tier:1, cost:2, sprite:'FrostWeaver', synergy:['Support'], attack_type:'magic',
    stats:{ hp:360, p_atk:0, m_atk:24, p_def:13, m_def:30, move_speed:2.2, attack_speed:0.95, attack_range:3 },
    active_skill:{ name:'Healing Light', description:'ฟื้นฟู HP ให้พันธมิตรที่มีเปอร์เซ็นต์ HP ต่ำที่สุดเท่ากับ 120% ของ M.Atk และเพิ่ม M.Def 10 เป็นเวลา 4 วินาที' } },
  priest:       { name:'Priest',       class_tier:2, evolves_from:'acolyte', cost:3, sprite:'FrostWeaver', synergy:['Support','Priest','Healer'], attack_type:'magic',
    stats:{ hp:590, p_atk:0, m_atk:58, p_def:22, m_def:55, move_speed:2.1, attack_speed:1.0, attack_range:4 },
    active_skill:{ name:'Divine Restoration', description:'ฟื้นฟู HP ให้พันธมิตรที่มีเปอร์เซ็นต์ HP ต่ำที่สุดเท่ากับ 220% ของ M.Atk และชำระล้างสถานะผิดปกติ 1 อย่าง หากมีพันธมิตรตาย Priest สามารถชุบชีวิตได้ 1 ครั้งต่อด่านด้วย HP 35%' } },
  inquisitor:   { name:'Inquisitor',   class_tier:2, evolves_from:'acolyte', cost:3, sprite:'Archmage', synergy:['Support','Inquisitor','Judgment'], attack_type:'magic', // keeps its acolyte lineage's Support tag despite dealing decent magic damage
    stats:{ hp:610, p_atk:0, m_atk:66, p_def:28, m_def:44, move_speed:2.4, attack_speed:1.15, attack_range:4 },
    active_skill:{ name:'Holy Judgment', description:'โจมตีศัตรูที่มี HP ต่ำที่สุด สร้างความเสียหายเวท 175% ของ M.Atk และฟื้นฟู HP ให้พันธมิตรทั้งหมดรวมเท่ากับ 30% ของดาเมจที่สร้างได้' } },
  merchant:     { name:'Merchant',     class_tier:1, cost:2, sprite:'Trickster', synergy:['Merchant'], attack_type:'physical',
    stats:{ hp:390, p_atk:21, m_atk:0, p_def:18, m_def:18, move_speed:2.4, attack_speed:1.15, attack_range:3 },
    active_skill:{ name:'Golden Opportunity', description:'ขว้างถุงเหรียญใส่ศัตรู สร้างความเสียหายกายภาพ 120% ของ P.Atk หากเป้าหมายตายภายใน 4 วินาที ได้รับทองโบนัส 1 เหรียญ สูงสุด 2 ครั้งต่อด่าน' } },
  tycoon:       { name:'Tycoon',       class_tier:2, evolves_from:'merchant', cost:3, sprite:'Trickster', synergy:['Merchant','Tycoon','Economy'], attack_type:'physical',
    stats:{ hp:650, p_atk:44, m_atk:0, p_def:34, m_def:36, move_speed:2.3, attack_speed:1.2, attack_range:4 },
    active_skill:{ name:'Profitable Contract', description:'ทำเครื่องหมายศัตรูที่มี HP ต่ำที่สุดเป็นเวลา 5 วินาที สร้างความเสียหายกายภาพ 140% ของ P.Atk หากเป้าหมายตายระหว่างติดเครื่องหมาย ได้รับทองโบนัส 2 เหรียญ และเพิ่มรายได้ดอกเบี้ยสูงสุดอีก 1 เหรียญในด่านถัดไป' } },
  trickster:    { name:'Trickster',    class_tier:2, evolves_from:'merchant', cost:3, sprite:'Trickster', synergy:['Merchant','Trickster','Disruptor'], attack_type:'magic', // per legacy_roster_migration.trickster
    stats:{ hp:570, p_atk:0, m_atk:60, p_def:25, m_def:38, move_speed:2.8, attack_speed:1.35, attack_range:4 },
    active_skill:{ name:'Loaded Dice', description:'โยนลูกเต๋าเวทใส่พื้นที่เป้าหมาย สร้างความเสียหายเวท 140% ของ M.Atk และทำให้ศัตรูติด Stun 1.5 วินาที พร้อมขโมยบัฟเชิงบวก 1 อย่างจากศัตรูที่แข็งแกร่งที่สุดในพื้นที่' } },
};
// ============================================================
// EVOLUTION_TREE — derived from HERO_DEFS.evolves_from (never hand-duplicated, so it can't
// drift from the roster) — shape matches the evolution_tree spec given for the Merge & Evolution
// System. tier/required_star/required_count are always 1/1/3 in this game, merge_location is
// always 'bench_only' since bench composition is where tier-1 matching heroes are grouped/counted
// (the separate tier-2 Star System below DOES count both bench+board — see scanForStarCombine()).
// ============================================================
const EVOLUTION_TREE = {};
Object.keys(HERO_DEFS).forEach((key) => {
  if (HERO_DEFS[key].class_tier !== 1) return;
  const evolutions = Object.keys(HERO_DEFS).filter((k) => HERO_DEFS[k].evolves_from === key);
  if (evolutions.length) EVOLUTION_TREE[key] = { tier: 1, required_star: 1, required_count: 3, merge_location: 'bench_only', evolutions };
});
// ============================================================
// HERO STAR SYSTEM (from Codex's spec, adapted to this engine) — tier-2 heroes only, max 2★.
// 3x tier-1 same class still opens the existing Evolution modal above (unchanged) and produces
// a 1★ tier-2 hero; 3x tier-2 SAME class+star instantly auto-combines into 1 higher-star copy —
// no player choice needed since the class doesn't change, just its power. Multipliers apply to
// each hero's OWN existing HERO_DEFS[key].stats (not a separate 7-class-only base-stat table —
// this roster already has distinct stats per tier-2 hero, e.g. Knight != Berserker, so a shared
// per-root-class table would be wrong for most of them anyway).
// ============================================================
const HERO_STAR_MAX = 2;
const HERO_STAR_MULTIPLIERS = {
  1: { hp:1,   p_atk:1,   m_atk:1,   p_def:1,   m_def:1,   attack_speed:1,    skill_power:1,   status_duration:1,    summon_power:1 },
  2: { hp:1.8, p_atk:1.8, m_atk:1.8, p_def:1.5, m_def:1.5, attack_speed:1.12, skill_power:1.5, status_duration:1.15, summon_power:1.5 },
  // attack_range and move_speed are deliberately never scaled by star level (per spec) — a 2★
  // Archer/Mage keeps the exact same positioning/kiting range as its 1★ self.
};
function normalizeStarLevel(star) { return Math.min(HERO_STAR_MAX, Math.max(1, Math.floor(Number(star) || 1))); }
function getStarMultiplier(star) { return HERO_STAR_MULTIPLIERS[normalizeStarLevel(star)]; }
// Applies the star multiplier to a hero's own base stats (HERO_DEFS[key].stats) — used at
// placement time to build the placed unit's initial/base stats (see createUnitFromInstance()).
function getScaledHeroStats(heroKey, starLevel) {
  const s = HERO_DEFS[heroKey].stats;
  const m = getStarMultiplier(starLevel);
  return {
    hp: Math.round(s.hp * m.hp), p_atk: Math.round(s.p_atk * m.p_atk), m_atk: Math.round(s.m_atk * m.m_atk),
    p_def: Math.round(s.p_def * m.p_def), m_def: Math.round(s.m_def * m.m_def),
    attack_speed: Number((s.attack_speed * m.attack_speed).toFixed(2)),
    attack_range: s.attack_range, move_speed: s.move_speed,
  };
}
// Scales an active skill's damage/heal/shield/summon power and status durations for a 2★ caster
// — returns a shallow-scaled COPY (SKILL_DEFS is a single shared definition object reused by
// every instance of that hero regardless of star, so it can never be mutated in place).
function getScaledSkillDef(caster, skillDef) {
  const star = normalizeStarLevel(caster.starLevel || 1);
  if (star <= 1 || !skillDef) return skillDef;
  const m = getStarMultiplier(star);
  const scaled = { ...skillDef };
  if (skillDef.damage_payload) {
    scaled.damage_payload = { ...skillDef.damage_payload };
    ['p_atk_multiplier', 'm_atk_multiplier', 'base_damage'].forEach((k) => {
      if (scaled.damage_payload[k] != null) scaled.damage_payload[k] *= m.skill_power;
    });
  }
  if (skillDef.heal_payload) {
    scaled.heal_payload = { ...skillDef.heal_payload };
    ['m_atk_multiplier', 'base_heal', 'heal_pct_of_damage'].forEach((k) => {
      if (scaled.heal_payload[k] != null) scaled.heal_payload[k] *= m.skill_power;
    });
  }
  if (skillDef.shield_payload) {
    scaled.shield_payload = { ...skillDef.shield_payload };
    ['max_hp_multiplier', 'base_shield'].forEach((k) => {
      if (scaled.shield_payload[k] != null) scaled.shield_payload[k] *= m.skill_power;
    });
    if (scaled.shield_payload.duration != null) scaled.shield_payload.duration *= m.status_duration;
  }
  if (skillDef.summon_payload) {
    scaled.summon_payload = { ...skillDef.summon_payload };
    ['hp_multiplier', 'attack_stat_multiplier'].forEach((k) => {
      if (scaled.summon_payload[k] != null) scaled.summon_payload[k] *= m.summon_power;
    });
  }
  if (skillDef.status_effects) {
    scaled.status_effects = skillDef.status_effects.map((se) => (
      se.duration != null ? { ...se, duration: se.duration * m.status_duration } : se
    ));
  }
  return scaled;
}
// ============================================================
// SKILL_DEFS — mechanical active-skill data for the 7 tier-1 heroes (kept separate from
// HERO_DEFS.active_skill, which stays as display-only name/description text — these numbers
// are what the Skill Execution Engine in the SKILL/MANA/STATUS section below actually reads).
// Tier-2 heroes have no entry here yet — hitting max mana with no SKILL_DEFS match falls back
// to the old stub (spend the bar, no effect), unchanged from the previous mana/state-machine task.
// ============================================================
const SKILL_DEFS = {
  fighter: {
    skill_id:'power_strike', skill_name:'Power Strike', mana_cost:100, max_mana:100, cast_time:0.45,
    target_type:'current_target',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:1.6, m_atk_multiplier:0, base_damage:0, max_targets:1 },
    status_effects:[
      { status_id:'p_def_down', duration:4, chance:1, modifiers:{ p_def_pct:-10 }, stack_rule:'refresh' },
    ],
  },
  swordman: {
    skill_id:'blade_arc', skill_name:'Blade Arc', mana_cost:100, max_mana:100, cast_time:0.5,
    target_type:'current_target_front_arc',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:1.3, m_atk_multiplier:0, base_damage:0, max_targets:3,
      area_shape:'front_arc', area_range:1 },
    status_effects:[],
  },
  archer: {
    skill_id:'piercing_arrow', skill_name:'Piercing Arrow', mana_cost:100, max_mana:100, cast_time:0.6,
    target_type:'farthest_enemy',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:1.45, m_atk_multiplier:0, base_damage:0, max_targets:4,
      area_shape:'line', line_length:6, pierces_targets:true, damage_falloff_per_target_pct:15, minimum_damage_multiplier:0.7 },
    status_effects:[],
  },
  mage: {
    skill_id:'arcane_burst', skill_name:'Arcane Burst', mana_cost:100, max_mana:100, cast_time:0.75,
    target_type:'largest_enemy_cluster',
    damage_payload:{ damage_type:'magic', p_atk_multiplier:0, m_atk_multiplier:1.5, base_damage:0, max_targets:9,
      area_shape:'circle', area_radius:1 },
    status_effects:[
      { status_id:'burn', duration:3, chance:1, tick_interval:1,
        damage_per_tick:{ damage_type:'magic', m_atk_multiplier:0.15, base_damage:0 }, grants_mana:false, stack_rule:'refresh' },
    ],
  },
  summoner: {
    skill_id:'spirit_familiar', skill_name:'Spirit Familiar', mana_cost:100, max_mana:100, cast_time:0.9,
    target_type:'adjacent_empty_tile',
    damage_payload:{ damage_type:'none', p_atk_multiplier:0, m_atk_multiplier:0, base_damage:0, max_targets:0 },
    summon_payload:{
      summon_def_id:'spirit_familiar', summon_limit:1, replace_existing:false, if_summon_exists:'heal_existing_summon',
      existing_summon_heal_pct_max_hp:40, hp_source:'caster_max_hp', hp_multiplier:0.35,
      attack_type:'magic', attack_stat_source:'caster_m_atk', attack_stat_multiplier:0.5,
      attack_range:1, attack_speed:1.1, move_speed:2.5, occupies_grid_tile:true,
      counts_toward_field_limit:false, despawn_on_wave_end:true,
    },
    status_effects:[],
  },
  acolyte: {
    skill_id:'healing_light', skill_name:'Healing Light', mana_cost:100, max_mana:100, cast_time:0.7,
    target_type:'lowest_hp_ally',
    damage_payload:{ damage_type:'none', p_atk_multiplier:0, m_atk_multiplier:0, base_damage:0, max_targets:0 },
    heal_payload:{ m_atk_multiplier:1.2, base_heal:0, max_targets:1, can_target_self:true, exclude_full_hp_targets:true },
    status_effects:[
      { status_id:'m_def_up', duration:4, chance:1, modifiers:{ m_def_flat:10 }, stack_rule:'refresh' },
    ],
  },
  merchant: {
    skill_id:'golden_opportunity', skill_name:'Golden Opportunity', mana_cost:100, max_mana:100, cast_time:0.55,
    target_type:'lowest_hp_enemy',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:1.2, m_atk_multiplier:0, base_damage:0, max_targets:1 },
    reward_payload:{ mark_duration:4, gold_on_marked_target_death:1, max_gold_triggers_per_wave:2,
      reward_owner:'player', requires_caster_alive:false },
    status_effects:[
      { status_id:'slow', duration:3, chance:1, modifiers:{ move_speed_pct:-20 }, stack_rule:'strongest' },
    ],
  },
  // ---- Tier-2 (14 heroes) — dynamic max_mana per hero, richer targeting/payloads/conditions ----
  knight: {
    skill_id:'guardians_challenge', skill_name:"Guardian's Challenge", mana_cost:120, max_mana:120, cast_time:0.45,
    target_type:'self_aoe_radius_3',
    damage_payload:{ damage_type:'none', p_atk_multiplier:0, m_atk_multiplier:0, base_damage:0, max_targets:0 },
    shield_payload:{ target_type:'self', max_hp_multiplier:0.22, base_shield:0, duration:4 },
    status_effects:[
      { status_id:'taunt', target_scope:'enemies_in_radius', duration:3, chance:1, area_radius:3, stack_rule:'refresh' },
      { status_id:'p_def_up', target_scope:'self', duration:4, chance:1, modifiers:{ p_def_pct:25 }, stack_rule:'refresh' },
      { status_id:'m_def_up', target_scope:'self', duration:4, chance:1, modifiers:{ m_def_pct:25 }, stack_rule:'refresh' },
    ],
  },
  berserker: {
    skill_id:'blood_frenzy', skill_name:'Blood Frenzy', mana_cost:80, max_mana:80, cast_time:0.25,
    target_type:'self',
    damage_payload:{ damage_type:'none', p_atk_multiplier:0, m_atk_multiplier:0, base_damage:0, max_targets:0 },
    status_effects:[
      { status_id:'p_atk_up', target_scope:'self', duration:6, chance:1, stack_rule:'refresh',
        conditional_modifiers:[
          { condition:'hp_pct_above_or_equal_50', modifiers:{ p_atk_pct:25 } },
          { condition:'hp_pct_below_50', modifiers:{ p_atk_pct:50 } },
        ] },
      { status_id:'attack_speed_up', target_scope:'self', duration:6, chance:1, stack_rule:'refresh',
        conditional_modifiers:[
          { condition:'hp_pct_above_or_equal_50', modifiers:{ attack_speed_pct:40 } },
          { condition:'hp_pct_below_50', modifiers:{ attack_speed_pct:70 } },
        ] },
      { status_id:'lifesteal_up', target_scope:'self', duration:6, chance:1, modifiers:{ physical_lifesteal_pct:20 }, stack_rule:'refresh' },
    ],
  },
  blade_master: {
    skill_id:'three_tile_crescent', skill_name:'Three-Tile Crescent', mana_cost:110, max_mana:110, cast_time:0.75,
    target_type:'current_target_front_arc',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:1.85, m_atk_multiplier:0, base_damage:0, max_targets:6,
      area_shape:'front_arc', area_range:3, armor_penetration_pct:20 },
    status_effects:[
      { status_id:'bleed', target_scope:'damaged_targets', duration:4, chance:1, tick_interval:1,
        damage_per_tick:{ damage_type:'physical', p_atk_multiplier:0.2, base_damage:0 }, grants_mana:false, stack_rule:'refresh' },
    ],
  },
  duelist: {
    skill_id:'duelists_verdict', skill_name:"Duelist's Verdict", mana_cost:90, max_mana:90, cast_time:0.35,
    target_type:'highest_max_hp_enemy',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:2.05, m_atk_multiplier:0, base_damage:0, max_targets:1,
      conditional_multiplier:{ condition:'target_current_hp_greater_than_caster_current_hp', bonus_multiplier:0.35 },
      execute_threshold_pct:12 },
    status_effects:[
      { status_id:'p_def_down', target_scope:'primary_target', duration:5, chance:1, modifiers:{ p_def_pct:-25 }, stack_rule:'refresh' },
      { status_id:'attack_speed_up', target_scope:'self', duration:4, chance:1, modifiers:{ attack_speed_pct:30 }, stack_rule:'refresh' },
    ],
  },
  sniper: {
    skill_id:'deadeye_shot', skill_name:'Deadeye Shot', mana_cost:150, max_mana:150, cast_time:1.3,
    target_type:'farthest_enemy',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:2.75, m_atk_multiplier:0, base_damage:0, max_targets:1,
      distance_scaling:{ bonus_damage_pct_per_tile:8, max_bonus_damage_pct:48 },
      armor_penetration:{ base_pct:25, bonus_pct_per_tile:5, max_total_pct:60 } },
    status_effects:[
      { status_id:'bleed', target_scope:'primary_target', duration:5, chance:1, tick_interval:1,
        damage_per_tick:{ damage_type:'physical', p_atk_multiplier:0.18, base_damage:0 }, grants_mana:false, stack_rule:'refresh' },
    ],
  },
  ranger: {
    skill_id:'triple_volley', skill_name:'Triple Volley', mana_cost:60, max_mana:60, cast_time:0.3,
    target_type:'three_nearest_enemies_in_range',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:0.9, m_atk_multiplier:0, base_damage:0,
      projectile_count:3, max_targets:3, allow_repeat_target:true, repeat_target_multipliers:[1, 0.75, 0.55] },
    status_effects:[
      { status_id:'slow', target_scope:'damaged_targets', duration:3, chance:0.4, modifiers:{ move_speed_pct:-25 }, stack_rule:'strongest' },
    ],
  },
  archmage: {
    skill_id:'grand_arcane_inferno', skill_name:'Grand Arcane Inferno', mana_cost:180, max_mana:180, cast_time:1.4,
    target_type:'largest_enemy_cluster',
    damage_payload:{ damage_type:'magic', p_atk_multiplier:0, m_atk_multiplier:2, base_damage:0, max_targets:12,
      area_shape:'circle', area_radius:2 },
    status_effects:[
      { status_id:'burn', target_scope:'damaged_targets', duration:5, chance:1, tick_interval:1,
        damage_per_tick:{ damage_type:'magic', m_atk_multiplier:0.22, base_damage:0 }, grants_mana:false, stack_rule:'refresh' },
      { status_id:'m_def_down', target_scope:'damaged_targets', duration:5, chance:1, modifiers:{ m_def_pct:-20 }, stack_rule:'refresh' },
    ],
  },
  frost_weaver: {
    skill_id:'frozen_domain', skill_name:'Frozen Domain', mana_cost:120, max_mana:120, cast_time:1,
    target_type:'largest_enemy_cluster',
    damage_payload:{ damage_type:'magic', p_atk_multiplier:0, m_atk_multiplier:1.35, base_damage:0, max_targets:12,
      area_shape:'circle', area_radius:2 },
    status_effects:[
      { status_id:'slow', target_scope:'damaged_targets', duration:5, chance:1,
        modifiers:{ move_speed_pct:-35, attack_speed_pct:-30 }, stack_rule:'strongest' },
      { status_id:'freeze', target_scope:'targets_already_slowed', duration:1.75, chance:1, kind:'freeze', stack_rule:'refresh' },
    ],
  },
  beast_lord: {
    skill_id:'call_spirit_dragon', skill_name:'Call Spirit Dragon', mana_cost:150, max_mana:150, cast_time:1.2,
    target_type:'adjacent_empty_tile',
    damage_payload:{ damage_type:'none', p_atk_multiplier:0, m_atk_multiplier:0, base_damage:0, max_targets:0 },
    summon_payload:{
      summon_def_id:'spirit_dragon', summon_limit:1, replace_existing:false, if_summon_exists:'heal_existing_summon',
      existing_summon_heal_pct_max_hp:40, hp_source:'caster_max_hp', hp_multiplier:0.6,
      attack_type:'magic', attack_stat_source:'caster_m_atk', attack_stat_multiplier:0.7,
      attack_range:1, attack_speed:1.15, move_speed:2.3, occupies_grid_tile:true,
      counts_toward_field_limit:false, despawn_on_wave_end:true,
      special_attack:{ trigger:'every_3_basic_attacks', area_shape:'line', line_length:2, damage_type:'magic', m_atk_multiplier:0.85 },
    },
    status_effects:[
      { status_id:'attack_speed_up', target_scope:'all_allies_while_summon_alive', duration:-1, chance:1,
        modifiers:{ attack_speed_pct:10 }, remove_condition:'summon_dead', stack_rule:'unique' },
    ],
  },
  spirit_blade: {
    skill_id:'spirit_merge', skill_name:'Spirit Merge', mana_cost:100, max_mana:100, cast_time:0.55,
    target_type:'self',
    damage_payload:{ damage_type:'none', p_atk_multiplier:0, m_atk_multiplier:0, base_damage:0, max_targets:0 },
    status_effects:[
      { status_id:'p_atk_up', target_scope:'self', duration:7, chance:1, modifiers:{ p_atk_pct:35 }, stack_rule:'refresh' },
      { status_id:'attack_speed_up', target_scope:'self', duration:7, chance:1, modifiers:{ attack_speed_pct:40 }, stack_rule:'refresh' },
      { status_id:'spirit_edge', target_scope:'self', duration:7, chance:1, stack_rule:'refresh',
        on_basic_attack_payload:{ damage_type:'magic', m_atk_multiplier:0.3, base_damage:0 } },
    ],
  },
  priest: {
    skill_id:'divine_restoration', skill_name:'Divine Restoration', mana_cost:160, max_mana:160, cast_time:1.25,
    target_type:'lowest_hp_ally',
    damage_payload:{ damage_type:'none', p_atk_multiplier:0, m_atk_multiplier:0, base_damage:0, max_targets:0 },
    heal_payload:{ m_atk_multiplier:2.2, base_heal:0, max_targets:1, can_target_self:true, exclude_full_hp_targets:true,
      overflow_heal_to_shield_pct:50, cleanse_negative_status_count:1 },
    revive_payload:{ enabled:true, uses_per_wave:1, trigger_condition:'no_valid_injured_ally_and_dead_ally_exists',
      target_type:'most_recent_dead_ally', revive_hp_pct:35, revive_mana_pct:0, invulnerability_duration:1 },
    status_effects:[
      { status_id:'m_def_up', target_scope:'healed_target', duration:5, chance:1, modifiers:{ m_def_pct:25 }, stack_rule:'refresh' },
    ],
  },
  inquisitor: {
    skill_id:'holy_judgment', skill_name:'Holy Judgment', mana_cost:100, max_mana:100, cast_time:0.7,
    target_type:'lowest_hp_enemy',
    damage_payload:{ damage_type:'magic', p_atk_multiplier:0, m_atk_multiplier:1.8, base_damage:0, max_targets:1, execute_threshold_pct:10 },
    heal_payload:{ source:'damage_dealt', heal_pct_of_damage:35, target_type:'all_allies', distribution:'even', max_targets:99 },
    status_effects:[
      { status_id:'m_def_down', target_scope:'primary_target', duration:5, chance:1, modifiers:{ m_def_pct:-25 }, stack_rule:'refresh' },
      { status_id:'silence', target_scope:'primary_target', duration:2, chance:0.5, stack_rule:'refresh' },
    ],
  },
  tycoon: {
    skill_id:'profitable_contract', skill_name:'Profitable Contract', mana_cost:70, max_mana:70, cast_time:0.35,
    target_type:'lowest_hp_enemy',
    damage_payload:{ damage_type:'physical', p_atk_multiplier:1.45, m_atk_multiplier:0, base_damage:0, max_targets:1 },
    reward_payload:{ mark_duration:6, gold_on_marked_target_death:2, max_gold_triggers_per_wave:3,
      reward_owner:'player', requires_caster_alive:false, next_wave_interest_bonus:1, next_wave_interest_bonus_cap:1 },
    status_effects:[
      { status_id:'p_def_down', target_scope:'primary_target', duration:6, chance:1, modifiers:{ p_def_pct:-15 }, stack_rule:'refresh' },
      { status_id:'m_def_down', target_scope:'primary_target', duration:6, chance:1, modifiers:{ m_def_pct:-15 }, stack_rule:'refresh' },
    ],
  },
  trickster: {
    skill_id:'loaded_dice', skill_name:'Loaded Dice', mana_cost:50, max_mana:50, cast_time:0.25,
    target_type:'largest_enemy_cluster',
    damage_payload:{ damage_type:'magic', p_atk_multiplier:0, m_atk_multiplier:1.15, base_damage:0, max_targets:6,
      area_shape:'circle', area_radius:1 },
    buff_steal_payload:{ enabled:true, target_selection:'strongest_buffed_enemy_in_area', max_buffs_stolen:1,
      copy_duration_mode:'remaining_duration', remove_from_target:true, apply_to_caster:true,
      excluded_status_tags:['unique','boss_only','revive'] },
    status_effects:[
      { status_id:'stun', target_scope:'damaged_targets', duration:1.25, chance:0.65, kind:'stun', stack_rule:'refresh' },
      { status_id:'attack_speed_down', target_scope:'damaged_targets', duration:4, chance:1, modifiers:{ attack_speed_pct:-20 }, stack_rule:'strongest' },
    ],
  },
};
// Synergy tags now live directly on each HERO_DEFS entry (def.synergy) instead of a separate
// HERO_TAGS map, so they can't go stale relative to the roster. NOTE: the old SYNERGIES combo
// list below (trade_route/arcane_duo/warband) was written for the old tag vocabulary
// (mage/merchant/archer/physical) and no longer matches these new tags — it's left in place
// but is effectively inert until new combos are designed for this tag set (out of scope here).
function tagLabel(heroKey) { return (HERO_DEFS[heroKey]?.synergy || []).join(' · '); }
// portrait/img path derived from the same sprite mapping used for the 3D battle sprite
// (see HERO_DEFS comment above) so every hero — real art or placeholder — resolves to an
// existing file instead of a broken image / 404
function heroPortraitSrc(heroKey) { return `assets/portraits/${HERO_DEFS[heroKey].sprite.toLowerCase()}.png`; }

// ============================================================
// Priority 4 (Equipment Core) — item data scaffold only. Not wired into buy/equip
// UI, stat application, or combat yet; base_items/combined_items and the recipe
// pairs are declared so the equip/merge system has real data to build against.
// ============================================================
const ITEM_BASE = {
  base_items: [
    { id: "item_sword", name: "ดาบเหล็ก", stats: { p_atk: 15 } },
    { id: "item_staff", name: "คทาเวท", stats: { m_atk: 15 } },
    { id: "item_armor", name: "เกราะเหล็ก", stats: { p_def: 15 } },
    { id: "item_cloak", name: "ผ้าคลุมเวท", stats: { m_def: 15 } }
  ],
  combined_items: [
    {
      id: "item_greatsword",
      recipe: ["item_sword", "item_sword"],
      name: "ดาบพิฆาต",
      stats: { p_atk: 38 },
      passive: "การโจมตีปกติใส่เป้าหมายเดิมครบ 3 ครั้ง การโจมตีครั้งถัดไปสร้างดาเมจกายภาพเพิ่ม 40% ของ P.Atk"
    },
    {
      id: "item_spellblade",
      recipe: ["item_sword", "item_staff"],
      name: "ดาบเวทมนตร์",
      stats: { p_atk: 20, m_atk: 20 },
      passive: "การโจมตีปกติสร้างโบนัสดาเมจเวทเพิ่ม 20% ของ M.Atk ของผู้ใช้"
    },
    {
      id: "item_vanguard_blade",
      recipe: ["item_sword", "item_armor"],
      name: "ดาบแนวหน้า",
      stats: { p_atk: 22, p_def: 22 },
      passive: "เมื่อได้รับดาเมจกายภาพ มีโอกาส 20% เพิ่ม P.Def อีก 15 เป็นเวลา 4 วินาที"
    },
    {
      id: "item_spectral_edge",
      recipe: ["item_sword", "item_cloak"],
      name: "คมดาบวิญญาณ",
      stats: { p_atk: 22, m_def: 22 },
      passive: "หลังได้รับดาเมจเวท การโจมตีปกติครั้งถัดไปสร้างดาเมจกายภาพเพิ่ม 30% และลด M.Atk ของเป้าหมาย 10% เป็นเวลา 4 วินาที"
    },
    {
      id: "item_archmage_staff",
      recipe: ["item_staff", "item_staff"],
      name: "คทาจอมเวท",
      stats: { m_atk: 38 },
      passive: "เมื่อใช้สกิล จะเพิ่ม M.Atk ของผู้ใช้ 15% เป็นเวลา 5 วินาที เอฟเฟกต์นี้ไม่ซ้อนทับ"
    },
    {
      id: "item_battlemage_core",
      recipe: ["item_staff", "item_armor"],
      name: "แก่นนักรบเวท",
      stats: { m_atk: 22, p_def: 22 },
      passive: "เมื่อได้รับดาเมจกายภาพครบ 4 ครั้ง จะสร้างโล่เวทเท่ากับ 25% ของ M.Atk เป็นเวลา 4 วินาที"
    },
    {
      id: "item_arcane_cloak",
      recipe: ["item_staff", "item_cloak"],
      name: "ผ้าคลุมอาร์เคน",
      stats: { m_atk: 22, m_def: 22 },
      passive: "เมื่อได้รับดาเมจเวท จะสะสมพลังอาร์เคน 1 ครั้ง สูงสุด 3 ครั้ง แต่ละครั้งเพิ่มดาเมจเวทของสกิลถัดไป 8%"
    },
    {
      id: "item_fortress_plate",
      recipe: ["item_armor", "item_armor"],
      name: "เกราะป้อมปราการ",
      stats: { p_def: 38 },
      passive: "เมื่อ HP ต่ำกว่า 50% จะได้รับดาเมจกายภาพลดลง 18%"
    },
    {
      id: "item_magic_armor",
      recipe: ["item_armor", "item_cloak"],
      name: "เกราะสะท้อนเวท",
      stats: { p_def: 25, m_def: 25 },
      passive: "เมื่อได้รับดาเมจเวท จะสะท้อนดาเมจกลับไปยังผู้โจมตีเท่ากับ 15% ของดาเมจที่ได้รับ"
    },
    {
      id: "item_void_mantle",
      recipe: ["item_cloak", "item_cloak"],
      name: "ผ้าคลุมแห่งความว่างเปล่า",
      stats: { m_def: 38 },
      passive: "เมื่อ HP ต่ำกว่า 50% จะได้รับดาเมจเวทลดลง 18%"
    }
  ]
};
// ----- Item shop (Demo-1 schedule) — deterministic constants; no repository pricing spec
// exists (docs checked), so this is the minimal documented schedule: base items cost 6,
// combined items cost 14; waves 1–5 offer base only, 6–10 mostly base with a 25% combined
// chance per slot, 11–15 a 50% combined chance. Offers are item DEF IDs only — an item
// INSTANCE is created exclusively at purchase (buyShopItem -> createItemInstance), so
// rerolling/refreshing offers can never consume or duplicate owned instances. -----
const ITEM_SHOP = {
  slots: 2,
  base_cost: 6,
  combined_cost: 14,
  bands: [
    { min_wave: 1,  max_wave: 5,  combined_chance: 0 },
    { min_wave: 6,  max_wave: 10, combined_chance: 0.25 },
    { min_wave: 11, max_wave: 15, combined_chance: 0.5 },
  ],
};
// flat id -> item def lookup across base_items + combined_items, for equip/buildCombatStats
const ITEM_DEFS_BY_ID = {};
[...ITEM_BASE.base_items, ...ITEM_BASE.combined_items].forEach((def) => { ITEM_DEFS_BY_ID[def.id] = def; });
// no item art yet — pick a representative emoji from which stat(s) the item def carries
function itemIcon(itemDefId) {
  const def = ITEM_DEFS_BY_ID[itemDefId];
  const s = (def && def.stats) || {};
  const hasP = 'p_atk' in s, hasM = 'm_atk' in s, hasPD = 'p_def' in s, hasMD = 'm_def' in s;
  if (hasP && hasM) return '💠';
  if (hasP && hasPD) return '🗡️';
  if (hasP && hasMD) return '⚔️';
  if (hasM && hasPD) return '🪄';
  if (hasM && hasMD) return '🔮';
  if (hasPD && hasMD) return '🛡️';
  if (hasP) return '⚔️';
  if (hasM) return '🔮';
  if (hasPD) return '🛡️';
  if (hasMD) return '🧥';
  return '❔';
}

// ============================================================
// EQUIPMENT CORE — inventory/item-instance data model, equip/unequip, and the stat
// pipeline that folds equipped items into a hero's live combatStats. Data + logic only —
// no shop/drag UI yet, so item instances currently only come from createItemInstance()
// (a minimal factory needed to have anything to equip/test with until a shop exists).
// ============================================================
const playerState = {
  inventory: { capacity: 20, itemInstanceIds: [] },
  itemInstances: {}, // instanceId -> { instanceId, itemDefId, location:'inventory'|'equipped', ownerHeroId }
};
let nextItemInstanceSeq = 1;
function createItemInstance(itemDefId) {
  const instanceId = 'item_inst_' + (nextItemInstanceSeq++);
  playerState.itemInstances[instanceId] = { instanceId, itemDefId, location: 'inventory', ownerHeroId: null };
  playerState.inventory.itemInstanceIds.push(instanceId);
  return instanceId;
}
function equipItem(hero, itemInstanceId, slotIndex) {
  if (slotIndex !== 0 && slotIndex !== 1) return false;
  if (hero.equipment[slotIndex] != null) return false;
  const inst = playerState.itemInstances[itemInstanceId];
  if (!inst || inst.location !== 'inventory') return false;
  const invIdx = playerState.inventory.itemInstanceIds.indexOf(itemInstanceId);
  if (invIdx < 0) return false;
  playerState.inventory.itemInstanceIds.splice(invIdx, 1);
  inst.location = 'equipped';
  inst.ownerHeroId = hero.instanceId;
  hero.equipment[slotIndex] = itemInstanceId;
  return true;
}
function unequipItem(hero, slotIndex) {
  if (slotIndex !== 0 && slotIndex !== 1) return false;
  const itemInstanceId = hero.equipment[slotIndex];
  if (!itemInstanceId) return false;
  if (playerState.inventory.itemInstanceIds.length >= playerState.inventory.capacity) return false;
  const inst = playerState.itemInstances[itemInstanceId];
  hero.equipment[slotIndex] = null;
  if (inst) { inst.location = 'inventory'; inst.ownerHeroId = null; }
  playerState.inventory.itemInstanceIds.push(itemInstanceId);
  return true;
}
// ขายฮีโร่ (bench หรือ field) ต้องไม่ทำลายไอเทมที่สวมอยู่ — คืนกลับ inventory เสมอ ไม่เช็ค capacity
// (เหมือน equipment_transfer_policy.never_destroy_overflow_items ที่ใช้ตอนรวมร่าง)
function returnHeroEquipmentToInventory(inst) {
  inst.equipment.forEach((itemInstanceId, slotIndex) => {
    if (!itemInstanceId) return;
    const item = playerState.itemInstances[itemInstanceId];
    if (item) { item.location = 'inventory'; item.ownerHeroId = null; }
    playerState.inventory.itemInstanceIds.push(itemInstanceId);
    inst.equipment[slotIndex] = null;
  });
}
function getSellValue(heroKey) {
  const cfg = HERO_DEFS[heroKey].class_tier === 1 ? SHOP_ECONOMY.hero_sell.tier_1_star_1 : SHOP_ECONOMY.hero_sell.tier_2_star_1;
  return cfg.sell_value;
}
// UI text suffix showing star level — tier-2 heroes only (Hero Star System doesn't apply to tier-1)
function starLabel(heroKey, starLevel) {
  if (HERO_DEFS[heroKey].class_tier !== 2) return '';
  return ' ' + '⭐'.repeat(normalizeStarLevel(starLevel || 1));
}
// ขายฮีโร่ตัวเดียวกันได้ไม่ว่าจะอยู่ม้านั่งสำรองหรือลงสนามรบอยู่ (ทั้งคู่เป็นยูนิต 3D จริงบนกระดาน
// เนื้อเดียวกันแล้ว) แทนที่ sellBenchHero/sellFieldHero เดิม
function sellUnit(u) {
  if (phase !== 'shop' || pendingEvolution) return;
  const battleIdx = placedUnits.indexOf(u);
  const benchIdx = benchHeroes.indexOf(u);
  if (battleIdx < 0 && benchIdx < 0) return;
  returnHeroEquipmentToInventory(u);
  if (inspectingHero === u) closeEquipModal();
  if (selectedUnit === u) selectedUnit = null;
  if (battleIdx >= 0) placedUnits.splice(battleIdx, 1);
  else benchHeroes.splice(benchIdx, 1);
  removeUnit(u);
  gold += getSellValue(u.heroKey);
  renderUI();
}
const ATTACK_SPEED_MIN = 0.2, ATTACK_SPEED_MAX = 3.0;
const RATE_STAT_KEYS = new Set(['physical_lifesteal']); // see the _pct handling note in buildCombatStats
// Builds hero.combatStats from hero.baseStats (never mutated) + equipped item stats:
// flat `stats` add first, then `percent_stats` multiply (if an item defines any), then
// clamp attack_speed to [0.2, 3.0] and floor hp/p_atk/m_atk/p_def/m_def at 0.
function buildCombatStats(hero, itemDefs) {
  const stats = structuredClone(hero.baseStats);
  hero.equipment.forEach((itemInstanceId) => {
    if (!itemInstanceId) return;
    const inst = playerState.itemInstances[itemInstanceId];
    const def = inst && itemDefs[inst.itemDefId];
    if (!def || !def.stats) return;
    for (const statKey in def.stats) {
      if (stats[statKey] == null) continue;
      stats[statKey] += def.stats[statKey];
    }
  });
  hero.equipment.forEach((itemInstanceId) => {
    if (!itemInstanceId) return;
    const inst = playerState.itemInstances[itemInstanceId];
    const def = inst && itemDefs[inst.itemDefId];
    if (!def || !def.percent_stats) return;
    for (const statKey in def.percent_stats) {
      if (stats[statKey] == null) continue;
      stats[statKey] *= (1 + def.percent_stats[statKey] / 100);
    }
  });
  // Team-wide Synergy System buffs (fighter/swordman/archer/mage active-class bonuses) — this
  // function only ever runs for player heroes, so it's safe to fold these in unconditionally.
  if (synergyBuffs) {
    if (synergyBuffs.pDefFlat) stats.p_def += synergyBuffs.pDefFlat;
    if (synergyBuffs.pAtkPct) stats.p_atk *= (1 + synergyBuffs.pAtkPct / 100);
    if (synergyBuffs.mAtkPct) stats.m_atk *= (1 + synergyBuffs.mAtkPct / 100);
    if (synergyBuffs.attackSpeedPct) stats.attack_speed *= (1 + synergyBuffs.attackSpeedPct / 100);
  }
  // status_effects (buffs/debuffs) layer on top of the equipment-adjusted stats, before the
  // clamp. Each status's `modifiers` uses a `<stat>_flat` / `<stat>_pct` key convention (e.g.
  // p_def_pct, m_def_flat) — flat modifiers across all active statuses apply first, then percent.
  // `conditional_modifiers` (e.g. Berserker's Blood Frenzy) resolve to whichever branch's
  // `modifiers` matches the hero's CURRENT hp% every time this runs, so it stays live as hp changes.
  // move_speed is intentionally skipped here — getEffectiveMoveSpeed() is the single source of
  // truth for it (folding it in here too would double-apply move_speed_pct for heroes).
  const effectiveModifiers = (status) => {
    if (status.modifiers) return status.modifiers;
    if (status.conditional_modifiers) {
      const match = status.conditional_modifiers.find((cm) => evaluateStatusCondition(hero, cm.condition));
      return match ? match.modifiers : null;
    }
    return null;
  };
  (hero.statuses || []).forEach((status) => {
    const mods = effectiveModifiers(status);
    if (!mods) return;
    for (const modKey in mods) {
      if (!modKey.endsWith('_flat')) continue;
      const statKey = modKey.slice(0, -5);
      if (statKey !== 'move_speed' && stats[statKey] != null) stats[statKey] += mods[modKey];
    }
  });
  (hero.statuses || []).forEach((status) => {
    const mods = effectiveModifiers(status);
    if (!mods) return;
    for (const modKey in mods) {
      if (!modKey.endsWith('_pct')) continue;
      const statKey = modKey.slice(0, -4);
      if (statKey === 'move_speed' || stats[statKey] == null) continue;
      // rate-type stats (e.g. lifesteal) start at 0 and ARE a percentage themselves — a "_pct"
      // modifier on them means "grant this much", not "multiply the existing value by it"
      // (multiplying a base of 0 would always stay 0), unlike p_atk_pct/m_def_pct/etc.
      if (RATE_STAT_KEYS.has(statKey)) stats[statKey] += mods[modKey];
      else stats[statKey] *= (1 + mods[modKey] / 100);
    }
  });
  stats.attack_speed = Math.min(ATTACK_SPEED_MAX, Math.max(ATTACK_SPEED_MIN, stats.attack_speed));
  ['hp', 'p_atk', 'm_atk', 'p_def', 'm_def'].forEach((k) => { stats[k] = Math.max(0, stats[k]); });
  hero.combatStats = stats;
  return stats;
}
function evaluateStatusCondition(unit, condition) {
  const hpPct = unit.maxHp ? unit.hp / unit.maxHp : 1;
  if (condition === 'hp_pct_above_or_equal_50') return hpPct >= 0.5;
  if (condition === 'hp_pct_below_50') return hpPct < 0.5;
  return false;
}

// ============================================================
// MANUAL LINK SELECTION — แทนที่ Auto Class Synergy (นับอาชีพซ้ำ 3 ตัว) และ Team Combo Buff
// (ครบ 3 ตัวพอดีอัตโนมัติ) เดิมทั้งคู่: ผู้เล่น "เลือกเอง" ว่าฮีโร่บนสนามรบตัวไหนเข้าทีม Link
// สูงสุด 3 ตัว (ฮีโร่ม้านั่งเลือกไม่ได้) — แต่ละตัวที่เลือกเปิดบัฟของ root class ตัวเองทันที
// อาชีพซ้ำกันนับครั้งเดียว (ไม่ stack) — ระบุตัวด้วย instanceId เสมอ ห้ามใช้ heroKey เพราะผู้เล่น
// มีฮีโร่ตัวเดียวกันซ้ำหลายตัวได้ — effect key ใช้ชุดเดียวกับ pipeline เดิมเป๊ะ เพื่อให้
// computeSynergyBuffs() ป้อนทุก integration point เดิม (buildCombatStats/gold/healing ฯลฯ) ต่อได้เลย
// ============================================================
const MAX_LINKED_HEROES = 3;
const linkedHeroIds = new Set(); // instanceId ของฮีโร่สนามรบที่เลือกเข้า Link (สูงสุด MAX_LINKED_HEROES)
const CLASS_ICON_MAP = {
  fighter: '🛡️', swordman: '⚔️', archer: '🏹', mage: '🔮',
  summoner: '👻', acolyte: '✨', merchant: '💰',
};
const LINK_CLASS_BUFFS = {
  fighter:  { name:'Fighter',  effects:{ max_hp_pct:15, p_def_flat:5 } },
  swordman: { name:'Swordman', effects:{ p_atk_pct:15, physical_reflect_pct:8 } },
  archer:   { name:'Archer',   effects:{ p_atk_pct:12, p_def_penetration_pct:10 } },
  mage:     { name:'Mage',     effects:{ m_atk_pct:15, m_def_penetration_pct:10 } },
  summoner: { name:'Summoner', effects:{ mana_on_basic_attack_bonus:5, summon_max_hp_pct:20, summon_damage_pct:20 } },
  acolyte:  { name:'Acolyte',  effects:{ healing_received_pct:15, start_battle_shield_pct_max_hp:10 } },
  merchant: { name:'Merchant', effects:{ bonus_gold_on_wave_win:1, shop_reroll_discount_gold:1, minimum_reroll_cost:1 } },
};
// ฮีโร่ที่ Link อยู่จริงตอนนี้ ในลำดับเดียวกับ placedUnits (ข้าม id ที่ตายค้างใน Set — sanitize เก็บกวาดทีหลัง)
function getLinkedHeroes() {
  return placedUnits.filter((u) => linkedHeroIds.has(u.instanceId));
}
// root class ที่ไม่ซ้ำกันจากฮีโร่ที่เลือก — อาชีพเดียวกันซ้ำหลายตัวให้บัฟครั้งเดียว (ห้าม stack)
// Post-merge Android QA hotfix v1: Link bonuses must stay inactive below a full 3/3 selection —
// this was the only read of the selection used by both the buff computation (computeLinkedBuffs)
// and the buff-list UI (renderLinkPanel), so gating it here fixes both surfaces at once without
// touching selection display itself (getLinkedHeroes/the 3 portrait slots still show 1/3, 2/3 as
// picked — only activation is gated) or the locked MAX_LINKED_HEROES of 3.
function getActiveLinkedClasses() {
  if (linkedHeroIds.size < MAX_LINKED_HEROES) return [];
  return [...new Set(getLinkedHeroes().map((u) => getRootClass(u.heroKey)).filter(Boolean))];
}
// ล้าง id ที่ไม่ได้อยู่บนสนามรบแล้วออกจาก Link อัตโนมัติ (ถูกถอนกลับม้านั่ง/ขาย/รวมร่าง/รวมดาว —
// ทุกเส้นทางจบที่ renderUI ซึ่งเรียกฟังก์ชันนี้เสมอ จึงไม่ต้องไปดัก hook ทีละจุด)
function sanitizeLinkedHeroes() {
  const fieldIds = new Set(placedUnits.map((u) => u.instanceId));
  [...linkedHeroIds].forEach((id) => { if (!fieldIds.has(id)) linkedHeroIds.delete(id); });
}
// แตะฮีโร่บนสนามรบเพื่อเปิด/ปิด Link — เลือกได้เฉพาะช่วงเตรียมทีม (phase 'shop') เท่านั้น
// ระหว่างต่อสู้สมาชิก Link ถูกล็อกไว้ตาม snapshot ที่ applyPreCombatSynergyBuffs ตรึงตอนเริ่มด่าน
function toggleLinkedHero(instanceId) {
  if (phase !== 'shop') return;
  const unit = placedUnits.find((u) => u.instanceId === instanceId);
  if (!unit) return;
  if (linkedHeroIds.has(instanceId)) {
    linkedHeroIds.delete(instanceId);
  } else {
    if (linkedHeroIds.size >= MAX_LINKED_HEROES) {
      spawnFloatingText(unit, `เลือก Link ได้สูงสุด ${MAX_LINKED_HEROES} ตัว`, '#ff8855');
      return;
    }
    linkedHeroIds.add(instanceId);
  }
  renderUI();
}
// รวมบัฟจาก root class ที่เลือก (ไม่ซ้ำ) — คืน object ฟิลด์เดียวกับ computeSynergyBuffs เดิม
function computeLinkedBuffs() {
  const buffs = {
    maxHpPct:0, pDefFlat:0, pAtkPct:0, physicalReflectPct:0, attackSpeedPct:0, pDefPenetrationPct:0,
    mAtkPct:0, mDefPenetrationPct:0, manaOnBasicAttackBonus:0, summonMaxHpPct:0, summonDamagePct:0,
    healingReceivedPct:0, startBattleShieldPctMaxHp:0, bonusGoldOnWaveWin:0, shopRerollDiscountGold:0,
    minimumRerollCost:0, activeClassKeys:[],
  };
  getActiveLinkedClasses().forEach((cls) => {
    const def = LINK_CLASS_BUFFS[cls];
    if (!def) return;
    const e = def.effects;
    buffs.activeClassKeys.push(cls);
    if (e.max_hp_pct) buffs.maxHpPct += e.max_hp_pct;
    if (e.p_def_flat) buffs.pDefFlat += e.p_def_flat;
    if (e.p_atk_pct) buffs.pAtkPct += e.p_atk_pct;
    if (e.physical_reflect_pct) buffs.physicalReflectPct += e.physical_reflect_pct;
    if (e.attack_speed_pct) buffs.attackSpeedPct += e.attack_speed_pct;
    if (e.p_def_penetration_pct) buffs.pDefPenetrationPct += e.p_def_penetration_pct;
    if (e.m_atk_pct) buffs.mAtkPct += e.m_atk_pct;
    if (e.m_def_penetration_pct) buffs.mDefPenetrationPct += e.m_def_penetration_pct;
    if (e.mana_on_basic_attack_bonus) buffs.manaOnBasicAttackBonus += e.mana_on_basic_attack_bonus;
    if (e.summon_max_hp_pct) buffs.summonMaxHpPct += e.summon_max_hp_pct;
    if (e.summon_damage_pct) buffs.summonDamagePct += e.summon_damage_pct;
    if (e.healing_received_pct) buffs.healingReceivedPct += e.healing_received_pct;
    if (e.start_battle_shield_pct_max_hp) buffs.startBattleShieldPctMaxHp += e.start_battle_shield_pct_max_hp;
    if (e.bonus_gold_on_wave_win) buffs.bonusGoldOnWaveWin += e.bonus_gold_on_wave_win;
    if (e.shop_reroll_discount_gold) buffs.shopRerollDiscountGold += e.shop_reroll_discount_gold;
    if (e.minimum_reroll_cost) buffs.minimumRerollCost = Math.max(buffs.minimumRerollCost, e.minimum_reroll_cost);
  });
  return buffs;
}

// ---- hero instance identity ----
let nextInstanceSeq = 1;
function createHeroInstance(heroKey, starLevel = 1) {
  return { instanceId: 'inst_' + (nextInstanceSeq++), heroKey, equipment: [null, null], starLevel: normalizeStarLevel(starLevel) };
}

// A tier-2 hero's synergy class is its tier-1 root (evolves_from); a tier-1 hero is its own root.
function getRootClass(heroKey) {
  const def = HERO_DEFS[heroKey];
  if (!def) return null;
  return def.class_tier === 1 ? heroKey : def.evolves_from;
}
// Pipeline entry point every combat/economy hook reads from — the NAME stays (so no call site
// changes), but the SOURCE is now the manual Link selection above instead of class counting.
function computeSynergyBuffs() {
  return computeLinkedBuffs();
}
// Recomputed on every renderUI() (shop-phase display + reroll discount always reflect the
// current field) and re-frozen at battle start via applyPreCombatSynergyBuffs() below. Starts
// null (not computeSynergyBuffs()) because placedUnits isn't declared until the GAME STATE
// section further down the file — every read site below already guards for a null/falsy value.
let synergyBuffs = null;
// Applied once at battle start: recomputes maxHp from the immutable baseMaxHp every time
// (never compounds across waves) and grants acolyte's start-of-battle shield. A very long
// shieldTimer (999s) is used since the spec gives no explicit duration — it's meant to last
// the whole battle, only depleting when it actually absorbs damage.
function applyPreCombatSynergyBuffs() {
  synergyBuffs = computeSynergyBuffs();
  placedUnits.forEach((u) => {
    u.maxHp = Math.round(u.baseMaxHp * (1 + synergyBuffs.maxHpPct / 100));
    u.hp = u.maxHp;
    if (synergyBuffs.startBattleShieldPctMaxHp) {
      u.shield = (u.shield || 0) + u.maxHp * (synergyBuffs.startBattleShieldPctMaxHp / 100);
      u.shieldTimer = Math.max(u.shieldTimer || 0, 999);
    }
  });
}
// Applied per-attack during combat: archer/mage synergies grant the ATTACKING player team a
// flat def-penetration bonus (physical or magic, matching the attack's own damage type) on top
// of any per-skill armorPenPct the caster already had.
function applySynergyDamageModifiers(rawDmg, attacker, target, bonusArmorPen) {
  let pen = bonusArmorPen || 0;
  if (attacker.team === 'player' && synergyBuffs) {
    pen += attacker.attackType === 'magic' ? synergyBuffs.mDefPenetrationPct : synergyBuffs.pDefPenetrationPct;
  }
  return mitigateDamage(rawDmg, attacker, target, pen);
}
// Swordman synergy: allied units reflect a % of physical damage taken back at whoever hit them.
// Needs a live attacker unit reference (not just a team/attackType pair) so it can only fire at
// the two combat call sites that have one (basic attacks, and skill damage via casterRef).
function applyReflectDamage(target, dmg, attackerUnit, damageType) {
  if (damageType === 'magic' || dmg <= 0) return;
  if (target.team !== 'player' || !synergyBuffs || !synergyBuffs.physicalReflectPct) return;
  if (!attackerUnit || !attackerUnit.alive) return;
  const reflected = dmg * (synergyBuffs.physicalReflectPct / 100);
  attackerUnit.hp -= reflected;
  if (attackerUnit.hpBar) {
    attackerUnit.hpBar.scale.x = Math.max(0, attackerUnit.hp / attackerUnit.maxHp);
    attackerUnit.hpBar.position.x = -0.36 * (1 - attackerUnit.hpBar.scale.x);
  }
  onHpChanged(attackerUnit);
  if (attackerUnit.hp <= 0) handleUnitDeath(attackerUnit, target);
}
// สถิติพื้นฐานของศัตรูทั่วไป — มอนสเตอร์/บอสฐานข้อมูลจากทีม Backend (Codex): แปลง row/col ของต้นฉบับ
// เป็น c/r ให้ตรงกับเอนจินนี้, atk -> pAtk, p_def -> armor (% ลดดาเมจ, เอนจินนี้มีค่าเกราะสถิติเดียว
// ไม่แยกกายภาพ/เวทเหมือนต้นฉบับที่มีทั้ง p_def/m_def จึงตัด m_def ทิ้งและใช้ p_def แทนค่าเกราะ %
// เดิม — ทุกมอนสเตอร์ในเกมนี้โจมตีกายภาพเหมือนกันหมดอยู่แล้ว ไม่กระทบ) — ตัดสูตร "+12%/ด่าน" เดิมออก
// เพราะ wave schedule ของ Codex มีเส้นโค้งความยากอยู่แล้วจากการเลือกชนิด/จำนวนมอนสเตอร์ต่อเวฟ ถ้าคง
// สูตรสเกลเดิมไว้ด้วยจะยากเกินจริง (สเกลซ้อนสเกล)
const ENEMY_BASE = {
  Slime:          { hp:85,  pAtk:9,  atkSpeed:0.8,  range:1, moveSpeed:1.6, armor:2,
    placeholderColor:0x6fcf5a }, // ไม่มีภาพจริง — ใช้กล่องสีเขียวพื้นฐานแทนไปก่อน (game_assets policy)
  Skeleton:       { hp:110, pAtk:13, atkSpeed:1.0,  range:1, moveSpeed:1.8, armor:5 },
  StoneWolf:      { hp:125, pAtk:16, atkSpeed:1.25, range:1, moveSpeed:2.6, armor:6,
    specialBehavior:{ type:'hunter' } }, // เล็งศัตรูที่ HP% เหลือน้อยที่สุด
  SpiritArcher:   { hp:90,  pAtk:18, atkSpeed:1.05, range:4, moveSpeed:1.7, armor:2,
    specialBehavior:{ type:'ranged' } }, // รักษาระยะ+เล็งใกล้สุดในระยะ — ระบบเดิม (d<=atkRange + nearest) ทำแบบนี้อยู่แล้วโดยไม่ต้องแยกเคส
  ShadowAssassin: { hp:105, pAtk:22, atkSpeed:1.4,  range:1, moveSpeed:3.0, armor:3,
    specialBehavior:{ type:'backline' } }, // พุ่งเล็งแนวหลังผู้เล่น (แถว r มากสุด)
  OrcBrute:       { hp:185, pAtk:20, atkSpeed:0.75, range:1, moveSpeed:1.5, armor:10,
    placeholderColor:0xa0522d, // ไม่มีภาพจริง — กล่องสีน้ำตาลแทนไปก่อน
    specialBehavior:{ type:'frontline' } }, // เล็งแนวหน้าผู้เล่นที่ใกล้สุด (แถว r น้อยสุด)
  Golem:          { hp:280, pAtk:24, atkSpeed:0.6,  range:1, moveSpeed:1.1, armor:16, frameSize:{ w:1.3, h:1.5 },
    specialBehavior:{ type:'stun_attack', triggerEveryHits:4, stunDuration:1.2 } }, // ทุกการโจมตีครั้งที่ 4 ทำให้เป้าหมายสตัน
};
// ช่องวางศัตรูฝั่งบนกระดาน (แถว 0-1) — วนใช้ซ้ำถ้าจำนวนตัวเกินจำนวนช่อง
const ENEMY_SLOTS = [ [3,0],[1,1],[6,1],[0,0],[7,0],[2,1],[5,1],[4,0] ];
function fillerWave(stage, comp) {
  const units = []; let slot = 0;
  comp.forEach(({ type, count }) => {
    const base = ENEMY_BASE[type];
    for (let i = 0; i < count; i++) {
      const [c, r] = ENEMY_SLOTS[slot++ % ENEMY_SLOTS.length];
      units.push({
        name: `${type} ${i+1}`, sprite: type, c, r,
        hp: base.hp, pAtk: base.pAtk, atkSpeed: base.atkSpeed, range: base.range, moveSpeed: base.moveSpeed,
        armor: base.armor, frameSize: base.frameSize, placeholderColor: base.placeholderColor,
        specialBehavior: base.specialBehavior ? { ...base.specialBehavior } : null,
      });
    }
  });
  return units;
}
// Wave schedule 1-15 จากทีม Backend (Codex) — คอมโพสิชันมอนสเตอร์ต่อเวฟตรงตามที่ส่งมา
// (ทองรางวัลต่อเวฟยังคงใช้สูตร SHOP_ECONOMY.income เดิม ไม่ใช้ goldReward ของ Codex ตรงๆ
// เพราะจะซ้อนทับ/ขัดกับระบบเศรษฐกิจที่ทำเสร็จและเทสแล้วก่อนหน้านี้)
const STAGE_PLAN = {
  1:  [{ type:'Slime', count:3 }],
  2:  [{ type:'Slime', count:2 }, { type:'Skeleton', count:2 }],
  3:  [{ type:'Skeleton', count:3 }, { type:'SpiritArcher', count:1 }],
  4:  [{ type:'StoneWolf', count:2 }, { type:'SpiritArcher', count:2 }, { type:'ShadowAssassin', count:1 }],
  6:  [{ type:'OrcBrute', count:2 }, { type:'SpiritArcher', count:2 }],
  7:  [{ type:'StoneWolf', count:3 }, { type:'ShadowAssassin', count:2 }],
  8:  [{ type:'OrcBrute', count:2 }, { type:'Golem', count:1 }, { type:'SpiritArcher', count:2 }],
  9:  [{ type:'Golem', count:2 }, { type:'ShadowAssassin', count:2 }, { type:'SpiritArcher', count:2 }],
  11: [{ type:'OrcBrute', count:3 }, { type:'ShadowAssassin', count:2 }, { type:'SpiritArcher', count:2 }],
  12: [{ type:'Golem', count:2 }, { type:'StoneWolf', count:3 }, { type:'ShadowAssassin', count:2 }],
  13: [{ type:'OrcBrute', count:3 }, { type:'Golem', count:2 }, { type:'SpiritArcher', count:3 }],
  14: [{ type:'Golem', count:3 }, { type:'ShadowAssassin', count:3 }, { type:'SpiritArcher', count:3 }],
};
// Miniboss Pool ล็อกตาม docs/DEMO1_DATA_POLICY.md — ด่าน 5/10 สุ่มเลือก 1 ตัวจาก pool ของด่านนั้น
// แบบไม่ซ้ำกันภายในรันเดียว (เลือกครั้งแรกที่ถึงด่านนั้น แล้วจำไว้ใช้ซ้ำตอน retry ด่านเดิม — ไม่มีฟังก์ชัน
// reset ระหว่างรันอื่นอยู่แล้วเพราะจบรัน/แพ้ครบโควตาจะ location.reload() ทั้งหน้าเสมอ ดู onWaveFailed/
// resultBtn) — สถิติของสมาชิก pool ใหม่ (orc_warlord/lich_king) ก็อปสถิติ+bossSkillId ของสมาชิกเดิมใน
// pool เดียวกันมาตรง ๆ (Warden/Bone Dragon) ไม่ได้คิดค่าความยากใหม่ จึงไม่แตะ Combat/skill ใด ๆ เพิ่ม
// Warden/Immortal Champion (ChampionBig) เป็นข้อมูล obsolete แล้ว เก็บไว้ในตารางสไปรท์ด้านบนเพื่ออ้างอิง
// ประวัติเท่านั้น ไม่ถูกเรียกใช้จาก bossWave() อีกต่อไป
const STAGE5_MINIBOSS_POOL = [
  { name:'Golem', sprite:'Golem', hp:650, pAtk:32, atkSpeed:0.85, range:1, moveSpeed:1.4, armor:22, unitType:'boss', bossSkillId:'area_taunt' },
  { name:'Orc Warlord', sprite:'OrcWarlord', hp:650, pAtk:32, atkSpeed:0.85, range:1, moveSpeed:1.4, armor:22, unitType:'boss', bossSkillId:'area_taunt' },
];
const STAGE10_MINIBOSS_POOL = [
  { name:'Bone Dragon', sprite:'BoneDragon', hp:980, pAtk:40, atkSpeed:0.9, range:3, moveSpeed:1.6, frameSize:{ w:2.0, h:1.6 }, armor:18, unitType:'boss', bossSkillId:'cone_breath' },
  { name:'Lich King', sprite:'LichKing', hp:980, pAtk:40, atkSpeed:0.9, range:3, moveSpeed:1.6, frameSize:{ w:2.0, h:1.6 }, armor:18, unitType:'boss', bossSkillId:'cone_breath' },
];
// ตัวเลือกที่สุ่มได้ของแต่ละรัน — null จนกว่าจะถึงด่านนั้นครั้งแรก; หน้าเทสสามารถ inject ผลลัพธ์ที่
// ต้องการล่วงหน้าได้ตรง ๆ ผ่านตัวแปรนี้ (เช่น `stage5MinibossChoice = 1;` ก่อนกดเริ่มด่าน) โดยไม่ต้อง
// แก้ RNG ของทั้งเกม
let stage5MinibossChoice = null;
let stage10MinibossChoice = null;
function pickMinibossIndex() { return Math.random() < 0.5 ? 0 : 1; }
const STAGE_LABEL = {
  5:  '⚠ มินิบอส: Miniboss Pool (Golem / Orc Warlord)',
  10: '⚠ มินิบอส: Miniboss Pool (Bone Dragon / Lich King)',
  15: '💀 บอสใหญ่: Arena Overlord',
};
function bossWave(stage) {
  if (stage === 5) {
    if (stage5MinibossChoice === null) stage5MinibossChoice = pickMinibossIndex();
    const boss = STAGE5_MINIBOSS_POOL[stage5MinibossChoice];
    return [
      { ...boss, c:3, r:0 },
      { name:'Skeleton Guard A', sprite:'Skeleton', c:1, r:1, hp:110, pAtk:13, atkSpeed:1.0, range:1, moveSpeed:1.8, armor:5 },
      { name:'Skeleton Guard B', sprite:'Skeleton', c:5, r:1, hp:110, pAtk:13, atkSpeed:1.0, range:1, moveSpeed:1.8, armor:5 },
    ];
  }
  if (stage === 10) {
    if (stage10MinibossChoice === null) stage10MinibossChoice = pickMinibossIndex();
    const boss = STAGE10_MINIBOSS_POOL[stage10MinibossChoice];
    return [
      { ...boss, c:3, r:0 },
      { name:'Golem', sprite:'Golem', c:3, r:1, hp:280, pAtk:24, atkSpeed:0.6, range:1, moveSpeed:1.1, frameSize:{ w:1.3, h:1.5 }, armor:16 },
      { name:'Spirit Archer A', sprite:'SpiritArcher', c:1, r:1, hp:90, pAtk:18, atkSpeed:1.05, range:4, moveSpeed:1.7, armor:2 },
      { name:'Spirit Archer B', sprite:'SpiritArcher', c:6, r:1, hp:90, pAtk:18, atkSpeed:1.05, range:4, moveSpeed:1.7, armor:2 },
    ];
  }
  if (stage === 15) return [
    { name:'Arena Overlord', sprite:'ArenaOverlord', c:3, r:0, hp:1450, pAtk:48, atkSpeed:1.0, range:2, moveSpeed:1.8, frameSize:{ w:1.9, h:2.6 }, armor:28, unitType:'boss', bossSkillId:'arena_curse' },
    { name:'Golem A', sprite:'Golem', c:1, r:1, hp:280, pAtk:24, atkSpeed:0.6, range:1, moveSpeed:1.1, frameSize:{ w:1.3, h:1.5 }, armor:16 },
    { name:'Golem B', sprite:'Golem', c:6, r:1, hp:280, pAtk:24, atkSpeed:0.6, range:1, moveSpeed:1.1, frameSize:{ w:1.3, h:1.5 }, armor:16 },
    { name:'Shadow Assassin A', sprite:'ShadowAssassin', c:2, r:1, hp:105, pAtk:22, atkSpeed:1.4, range:1, moveSpeed:3.0, armor:3 },
    { name:'Shadow Assassin B', sprite:'ShadowAssassin', c:5, r:1, hp:105, pAtk:22, atkSpeed:1.4, range:1, moveSpeed:3.0, armor:3 },
    { name:'Spirit Archer A', sprite:'SpiritArcher', c:0, r:1, hp:90, pAtk:18, atkSpeed:1.05, range:4, moveSpeed:1.7, armor:2 },
    { name:'Spirit Archer B', sprite:'SpiritArcher', c:7, r:1, hp:90, pAtk:18, atkSpeed:1.05, range:4, moveSpeed:1.7, armor:2 },
  ];
  return null;
}
function buildWave(stage) {
  return bossWave(stage) || fillerWave(stage, STAGE_PLAN[stage] || [{ type:'Skeleton', count:2 + Math.floor(stage/3) }]);
}
// จำนวนสำเนาของฮีโร่ tier-1 แต่ละตัวที่หมุนเวียนอยู่ในถุงสุ่มของร้านค้า (ต้องมีมากกว่า 1
// ไม่งั้นผู้เล่นจะซื้อฮีโร่ตัวเดียวกันซ้ำไม่ได้เกิน 1 ตัวตลอดทั้งเกม ทำให้ระบบรวมร่าง (ต้องการ 3 ตัวซ้ำ) เป็นไปไม่ได้จริงผ่านร้านค้า)
const HERO_POOL_COPIES_PER_TIER1 = 15;
// Hero Star System: ตั้งแต่เวฟ 6 เป็นต้นไป ร้านค้าเปิดขายฮีโร่ tier-2 (1★) ตรงๆ ได้ด้วย (เดิมได้จาก
// evolution อย่างเดียว) เพื่อให้ผู้เล่นมีโอกาสสะสมครบ 3 ตัวไปรวมเป็น 2★ ทันภายในลิมิต 15 เวฟ —
// สำเนาน้อยกว่า tier-1 เพราะต้องการแค่ 3 ตัวครั้งเดียวต่อการรวมดาว ไม่ต้องหมุนเวียนบ่อยเท่า
const HERO_POOL_COPIES_PER_TIER2 = 6;
const TIER2_SHOP_UNLOCK_WAVE = 6;
let tier2ShopUnlocked = false;
function ensureTier2ShopUnlocked() {
  if (tier2ShopUnlocked || wave < TIER2_SHOP_UNLOCK_WAVE) return;
  tier2ShopUnlocked = true;
  Object.keys(HERO_DEFS).filter((k) => HERO_DEFS[k].class_tier === 2)
    .forEach((k) => ownedPool.push(...Array(HERO_POOL_COPIES_PER_TIER2).fill(k)));
}

// คำนวณรายได้ต่อด่านจาก SHOP_ECONOMY.income: base + win_bonus (ถ้าชนะ) + ดอกเบี้ยจากทองที่ถืออยู่ + โบนัสสตรีค
function computeWaveIncome(isWin) {
  const cfg = SHOP_ECONOMY.income;
  const base = cfg.base_income_per_wave;
  const winBonus = isWin ? cfg.win_bonus : 0;
  const goldForInterest = Math.min(gold, cfg.interest.max_gold_counted);
  const interestBonus = Math.min(Math.floor(goldForInterest / cfg.interest.gold_per_step) * cfg.interest.bonus_per_step, cfg.interest.max_bonus);
  const tier = cfg.streak_bonus.find(t => currentStreak >= t.min_streak && currentStreak <= t.max_streak);
  const streakBonus = tier ? tier.bonus_gold : 0;
  return { base, winBonus, interestBonus, streakBonus, total: base + winBonus + interestBonus + streakBonus };
}
// อัปเดตตัวนับสตรีค (ชนะติด/แพ้ติด สองทิศทาง) หลังจบด่านแต่ละครั้ง
function updateStreak(isWin) {
  const type = isWin ? 'win' : 'loss';
  if (streakType === type) currentStreak += 1;
  else { streakType = type; currentStreak = 1; }
}
// มอบรายได้ประจำด่าน แล้วคืนรายละเอียดไว้ใช้แสดงผลลัพธ์
function grantWaveIncome(isWin) {
  updateStreak(isWin);
  const income = computeWaveIncome(isWin);
  gold += income.total;
  return income;
}

// ============================================================
// GAME STATE
// ============================================================
let gold = 10;
let wave = 1;
let losses = 0;               // จำนวนครั้งที่แพ้ไปแล้วในรันนี้ (0-MAX_LOSSES)
let phase = 'shop';           // 'shop' | 'battle' | 'result' | 'gameover'
let speedMul = 1;
let paused = false;
let currentStreak = 0;                     // จำนวนครั้งติดต่อกันของผลลัพธ์ล่าสุด (ชนะติดหรือแพ้ติด)
let streakType = null;                     // 'win' | 'loss' | null (ยังไม่เคยจบด่าน)
// EXP/Level — "ซื้อ EXP" spends gold for a level counter. Deliberately NOT wired to shop
// tier/pool unlocks — SHOP_ECONOMY.hero_shop.hero_pool is "tier_1_only" by design. Level's only
// gameplay effect is battlefield capacity (see fieldCapacity()). Level 5 (=MAX_FIELD) is the
// absolute cap — Level 6 is never created (buyExpBtn handler + renderUI both gate on this).
const BUY_EXP_COST = 4;
const BUY_EXP_GAIN = 4;
function expNeededForLevel(lvl) { return 2 + lvl * 2; }
let level = 1;
let exp = 0;
// จำนวนฮีโร่ลงสนามได้พร้อมกัน = level ปัจจุบัน แต่ไม่เกิน MAX_FIELD (เพดานสัมบูรณ์ = level สูงสุดด้วย) —
// จุดเดียวที่คำนวณค่านี้ ใช้ร่วมกันทุกที่ที่เช็ก/แสดงความจุสนาม (moveUnitTo, fieldCount, ข้อความสนามเต็ม)
function fieldCapacity() { return Math.min(level, MAX_FIELD); }
let freeRerollsRemaining = SHOP_ECONOMY.reroll.free_rerolls_per_wave; // รีเซ็ตเป็น 1 ทุกครั้งที่เข้าเฟส shop ใหม่
// ร้านค้าขายเฉพาะ tier-1 — tier-2 ได้จากการรวมร่าง (scanForMergeCandidate/chooseEvolution) เท่านั้น
// มีหลายสำเนาต่อฮีโร่ 1 ตัว (ไม่ใช่แค่ 1) เพื่อให้ซื้อซ้ำจนครบ 3 ตัวสำหรับรวมร่างได้จริงผ่านร้านค้า
let ownedPool = Object.keys(HERO_DEFS).filter(k => HERO_DEFS[k].class_tier === 1)
  .flatMap(k => Array(HERO_POOL_COPIES_PER_TIER1).fill(k));
// ม้านั่งสำรองรวมเป็นเนื้อเดียวกับกระดานแล้ว (แถว BENCH_ROW) — benchHeroes เก็บ "ยูนิต 3D จริง"
// (alive:false, ไม่ร่วมรบ) ไม่ใช่ข้อมูลเบาๆ แบบเดิมอีกต่อไป ดู createUnitFromInstance/spawnToBench
let benchHeroes = [];
let placedUnits = [];                      // unit[] ฝั่งผู้เล่นที่วางลงรบแล้ว (อ้างอิงตัวยูนิตตรงๆ ไม่ใช่ตำแหน่ง
                                            // เพราะยูนิตขยับระหว่างต่อสู้ได้ ผูกกับพิกัดจะหลุดการติดตาม)
let shopOffers = [];
let itemShopOffers = []; // item DEF ids on offer (instances exist only after purchase — see ITEM_SHOP note)
let selectedUnit = null;                   // ฮีโร่ (ม้านั่งหรือสนามรบ) ที่แตะเลือกไว้ — รอแตะช่องปลายทางเพื่อย้าย

const units = [];
const occupied = new Set();
function key(c, r) { return c + ',' + r; }

// ============================================================
// UNIT FACTORY / ANIMATION / TRAITS (เหมือน heroes.html)
// ============================================================
// shared 1x texture for the Equipment Core "has item" badge sprite (see makeUnit/updateEquipBadge)
const EQUIP_BADGE_TEX = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⚙️', 16, 17);
  return new THREE.CanvasTexture(c);
})();
// shared 1x texture for the Link System chain badge sprite (see makeUnit/updateLinkedHeroVisuals)
const LINK_BADGE_TEX = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🔗', 16, 17);
  return new THREE.CanvasTexture(c);
})();
// Foot-anchor correction: sprite frames carry transparent padding below the character (heroes
// ~20% of frame height, Slime/Orc ~11%). The body plane is anchored with its geometric bottom at
// the tile center (ground), so that padding lifts the *visible* feet up onto the back grid line —
// the reported "unit not standing centered in its cell" defect. We sample each sprite's opaque
// bottom padding ONCE (frame 0, cached per sprite key) and lower the plane by that fraction of its
// height so the drawn feet meet the tile center. Purely a visual anchor: board, tiles, camera,
// occupied/logic and the group root (still exactly at the cell center) are untouched. Box
// placeholders have no art and get zero lift.
const SPRITE_FOOT_LIFT_FRAC = {};
function spriteFootLift(key, image, framesInImage, h) {
  if (key in SPRITE_FOOT_LIFT_FRAC) return SPRITE_FOOT_LIFT_FRAC[key] * h;
  if (!image || !image.width || !image.height) return 0; // texture not decoded yet — retry next spawn
  try {
    const fw = Math.max(1, Math.floor(image.width / (framesInImage || 1)));
    const cv = document.createElement('canvas'); cv.width = fw; cv.height = image.height;
    const g = cv.getContext('2d'); g.drawImage(image, 0, 0, fw, image.height, 0, 0, fw, image.height);
    const d = g.getImageData(0, 0, fw, image.height).data;
    let bot = -1;
    for (let y = image.height - 1; y >= 0; y--) {
      let any = false;
      for (let x = 0; x < fw; x++) { if (d[(y * fw + x) * 4 + 3] > 16) { any = true; break; } }
      if (any) { bot = y; break; }
    }
    const frac = bot < 0 ? 0 : (image.height - 1 - bot) / image.height;
    SPRITE_FOOT_LIFT_FRAC[key] = frac;
    return frac * h;
  } catch (e) { return 0; } // tainted canvas / no context — no lift, safe fallback
}
function makeUnit(cfg) {
  const group = new THREE.Group();
  const meta = ASSET_META[cfg.sprite];
  let frames = 1, tex = null, w, h, body, shadowRefW = 1.1;
  if (meta && !failedSpriteKeys.has(cfg.sprite)) {
    frames = meta.frames;
    tex = SPRITES[cfg.sprite];
    if (frames > 1) { tex = tex.clone(); tex.needsUpdate = true; tex.repeat.set(1/frames, 1); tex.offset.set(0, 0); }
    const defaultW = frames > 1 ? 0.8 : 1.1, defaultH = frames > 1 ? 1.4 : 1.6;
    w = cfg.frameSize ? cfg.frameSize.w : defaultW;
    h = cfg.frameSize ? cfg.frameSize.h : defaultH;
    shadowRefW = defaultW;
    body = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
  } else if (MONSTER_MOTION_DEFS[cfg.sprite] && MONSTER_MOTION_READY[cfg.sprite]) {
    // Motion-enabled monster with no static ASSET_META entry (Slime/OrcBrute): same transparent
    // billboard plane as the textured branch, seeded with idle frame 0. Without this branch the
    // opaque box below became the body and setMonsterFrame() mapped transparent motion PNGs onto
    // that placeholder-tinted BoxGeometry — the black-rectangle/tinted-sprite defect. The box
    // stays as the fallback only when this monster's motion frames genuinely failed to load.
    w = cfg.frameSize ? cfg.frameSize.w : 1.1;
    h = cfg.frameSize ? cfg.frameSize.h : 1.6;
    tex = MONSTER_TEXTURES[cfg.sprite].idle[0];
    body = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
  } else {
    // Geometric placeholder (no sprite art yet — per game_assets policy, a plain colored box
    // stands in until real art lands, instead of spending time generating character art).
    w = cfg.frameSize ? cfg.frameSize.w : 0.9;
    h = cfg.frameSize ? cfg.frameSize.h : 1.3;
    body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.6),
      new THREE.MeshBasicMaterial({ color: cfg.placeholderColor || 0x888888 }));
  }
  // Lower the plane by its sprite's opaque bottom padding so the drawn feet sit at the tile center
  // (the shadow, below, stays at ground / cell center — feet and shadow now coincide). tex is null
  // for the box placeholder branch, so footLift is 0 there.
  const footLift = spriteFootLift(cfg.sprite, tex && tex.image, frames, h);
  body.position.y = h/2 - footLift;
  body.userData = { isUnit: true };
  group.add(body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.26 * (w/shadowRefW), 12), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.35 }));
  shadow.rotation.x = -Math.PI/2; shadow.position.y = 0.01; group.add(shadow);
  // HP/mana/badge stack rides with the lowered sprite (same gap above the head as before).
  const barY = h + 0.14 - footLift;
  const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.08), new THREE.MeshBasicMaterial({ color:0x2a1410, side:THREE.DoubleSide }));
  hpBg.position.y = barY; group.add(hpBg);
  const hpBar = new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.08), new THREE.MeshBasicMaterial({ color: cfg.team==='player'?0x66c25a:0xc25a44, side:THREE.DoubleSide }));
  hpBar.position.y = barY; hpBar.position.z = 0.001; group.add(hpBar);
  // Mana bar (blue) — hero units only (real heroes, not player-side summons which never carry
  // current_mana/max_mana at all) — sits just under the HP bar, refreshed by updateManaBar()
  // (called from grantMana() and every other direct current_mana assignment site).
  let manaBar = null;
  if (cfg.team === 'player' && !cfg.isSummon) {
    const manaY = barY - 0.11;
    const manaBg = new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.06), new THREE.MeshBasicMaterial({ color:0x142230, side:THREE.DoubleSide }));
    manaBg.position.y = manaY; group.add(manaBg);
    manaBar = new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.06), new THREE.MeshBasicMaterial({ color:0x3aa0e8, side:THREE.DoubleSide }));
    manaBar.position.y = manaY; manaBar.position.z = 0.001; manaBar.scale.x = 0; group.add(manaBar);
  }
  // Hero Star System: small ⭐/⭐⭐ badge under the mana bar — tier-2 heroes only (tier-1 heroes
  // never carry a meaningful star level). Set once at creation — a star-combine always removes
  // the old unit and spawns a brand-new one at the new star, so this never needs live updating.
  let starBadge = null;
  const heroDefForBadge = HERO_DEFS[cfg.heroKey];
  if (cfg.team === 'player' && !cfg.isSummon && heroDefForBadge && heroDefForBadge.class_tier === 2) {
    const starTex = makeStarBadgeTexture(cfg.starLevel || 1);
    starBadge = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthTest: false }));
    starBadge.scale.set(0.5, 0.16, 1);
    starBadge.position.set(0, barY - 0.24, 0.01);
    group.add(starBadge);
  }
  // Equipment Core visual feedback: small floating badge above the HP bar, shown only while
  // the hero has at least 1 item equipped (toggled by updateEquipBadge, never created per-hero —
  // one shared canvas texture (EQUIP_BADGE_TEX) reused across every unit's own Sprite instance).
  const equipBadge = new THREE.Sprite(new THREE.SpriteMaterial({ map: EQUIP_BADGE_TEX, transparent: true, depthTest: false }));
  equipBadge.scale.set(0.3, 0.3, 1);
  equipBadge.position.set(0.34, barY + 0.2, 0.01);
  equipBadge.visible = false;
  group.add(equipBadge);
  // Link System visuals: gold ring on the ground + small chain badge above-left of the HP bar
  // (mirroring equipBadge's above-right spot so neither covers the HP/mana bars) — hidden until
  // the hero is actually linked, toggled by updateLinkedHeroVisuals() on every renderUI()
  let linkRing = null, linkBadge = null;
  if (cfg.team === 'player' && !cfg.isSummon) {
    linkRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 24),
      new THREE.MeshBasicMaterial({ color: 0xd8ad4d, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    linkRing.rotation.x = -Math.PI/2; linkRing.position.y = 0.02; linkRing.visible = false;
    group.add(linkRing);
    linkBadge = new THREE.Sprite(new THREE.SpriteMaterial({ map: LINK_BADGE_TEX, transparent: true, depthTest: false }));
    linkBadge.scale.set(0.3, 0.3, 1);
    linkBadge.position.set(-0.34, barY + 0.2, 0.01);
    linkBadge.visible = false;
    group.add(linkBadge);
  }
  const p = gridToWorld(cfg.c, cfg.r);
  group.position.set(p.x, 0, p.z);
  scene.add(group);
  occupied.add(key(cfg.c, cfg.r));
  const u = { ...cfg, group, body, hpBar, manaBar, starBadge, shadow, tex, frames, halfH: h/2, footLift, equipBadge,
    linkRing, linkBadge,
    maxHp: cfg.hp, alive: true, atkCooldown: 0,
    moving: false, moveFrom: null, moveTo: null, moveT: 0,
    animState: 'idle', animTimer: 0, animFrame: 0 };
  // Skeleton Runtime Integration Pilot v1: presentation-only per-unit state, added only for
  // Skeleton and only once its motion frames have finished loading; every other unit (every
  // hero, every other monster) never gets this field and runs the exact pre-existing code path.
  if (cfg.sprite === 'Skeleton' && SKELETON_MOTION_READY) {
    u.skelAnim = { state: 'idle', timer: 0, frameIdx: 0, deathDone: false };
    setSkeletonFrame(u, 'idle', 0);
  }
  // Monster Demo Batch 1 — Remaining Five Runtime Integration v1: same additive, opt-in
  // pattern as Skeleton above, generalized via MONSTER_MOTION_DEFS/MONSTER_MOTION_READY.
  // Only Slime/OrcBrute/StoneWolf/SpiritArcher/Golem units ever get u.monsterAnim, and only
  // once that specific monster's motion frames have finished loading.
  if (MONSTER_MOTION_DEFS[cfg.sprite] && MONSTER_MOTION_READY[cfg.sprite]) {
    u.monsterAnim = { state: 'idle', timer: 0, frameIdx: 0, deathDone: false };
    u.monsterSprite = cfg.sprite;
    setMonsterFrame(u, cfg.sprite, 'idle', 0);
  }
  body.userData.unit = u;
  units.push(u);
  return u;
}
function updateManaBar(u) {
  if (!u.manaBar) return;
  const pct = u.max_mana ? Math.max(0, Math.min(1, u.current_mana / u.max_mana)) : 0;
  u.manaBar.scale.x = pct;
  u.manaBar.position.x = -0.36 * (1 - pct);
}
function makeStarBadgeTexture(starLevel) {
  const c = makeCanvas(140, 32);
  const ctx = c.getContext('2d');
  ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe066';
  ctx.fillText('⭐'.repeat(normalizeStarLevel(starLevel)), 70, 16);
  return new THREE.CanvasTexture(c);
}
// ============================================================
// FLOATING TEXT — short callouts above a unit's head (skill name on cast, "Stun!" on stun) —
// a canvas-texture sprite that rises + fades over floatingTexts' `duration`, then self-removes.
// No new art: reuses the same THREE.CanvasTexture pattern as EQUIP_BADGE_TEX above.
// ============================================================
const floatingTexts = [];
function makeFloatingTextTexture(text, color) {
  const c = makeCanvas(200, 44);
  const ctx = c.getContext('2d');
  ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,7,4,0.85)'; ctx.strokeText(text, 100, 22);
  ctx.fillStyle = color; ctx.fillText(text, 100, 22);
  return new THREE.CanvasTexture(c);
}
function spawnFloatingText(unit, text, color) {
  if (!unit || !unit.group) return;
  const tex = makeFloatingTextTexture(text, color);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.5, 0.33, 1);
  sprite.position.set(0, (unit.halfH || 0.8) * 2 + 0.45, 0.03);
  unit.group.add(sprite);
  floatingTexts.push({ sprite, tex, t: 0, duration: 1.1 });
}
function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.t += dt;
    ft.sprite.position.y += dt * 0.5;
    ft.sprite.material.opacity = Math.max(0, 1 - ft.t / ft.duration);
    if (ft.t >= ft.duration) {
      if (ft.sprite.parent) ft.sprite.parent.remove(ft.sprite);
      ft.tex.dispose(); ft.sprite.material.dispose();
      floatingTexts.splice(i, 1);
    }
  }
}
function updateEquipBadge(u) {
  if (u.equipBadge) u.equipBadge.visible = !!(u.equipment && u.equipment.some((e) => e));
}

// ============================================================
// VFX FRAMEWORK — เลเยอร์ภาพล้วน อ่านผลจาก Combat/Skill ที่เกิดขึ้นแล้วเท่านั้น (ไม่คำนวณดาเมจ/ฮีล/
// สถานะเองเด็ดขาด) ปิดด้วย VFX_ENABLED=false แล้วเกมเล่นได้เหมือนเดิม 100% เพราะทุก hook เป็น
// fire-and-forget ข้างเดียว — ทุกชิ้นส่วน 3D อยู่ใน vfxRoot (Group แยก) ไม่เคยเข้า tileMeshes/units
// จึงไม่โดน raycast — particle/mesh ทุกชนิดใช้ object pool สร้าง geometry/material/texture ครั้งเดียว
// ตอนโหลด ไม่สร้างใหม่ระหว่างเล่นเลย (acquire = โชว์+รีเซ็ต, release = ซ่อนคืน pool)
// ============================================================
let VFX_ENABLED = true;          // ปิดเพื่อเล่นแบบไม่มีเอฟเฟกต์ (ลอจิกเกมไม่เปลี่ยนแม้แต่นิดเดียว)
let CAMERA_SHAKE_ENABLED = true; // ปิดเฉพาะการสั่นกล้อง (setting แยกตามสเปก)
const VFX_MAX_SHAKE_PX = 10;     // เพดานแรงสั่นกล้ายภาพ (px) — กันสั่นแรงจนเวียนหัว

const vfxRoot = new THREE.Group();
scene.add(vfxRoot);
const activeVFX = [];

// ----- runtime canvas textures (สร้างครั้งเดียว ไม่มีไฟล์ภาพใหม่ตาม asset policy) -----
function vfxRadialGlowTex(inner, outer) {
  const cv = makeCanvas(64, 64), g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, inner); grd.addColorStop(0.3, outer); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); return t;
}
const VFX_TEX = {
  glow: vfxRadialGlowTex('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.28)'),
  spark: (() => { // จุดสว่างเล็กมีแฉก 4 ทิศ
    const cv = makeCanvas(32, 32), g = cv.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 1, 16, 16, 14);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(16, 2); g.lineTo(16, 30); g.moveTo(2, 16); g.lineTo(30, 16); g.stroke();
    return new THREE.CanvasTexture(cv);
  })(),
  smoke: (() => { // ก้อนควันฟุ้งขาว (tint ผ่าน material.color)
    const cv = makeCanvas(64, 64), g = cv.getContext('2d');
    let s = 4242; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 22; i++) {
      const x = 14 + rnd() * 36, y = 14 + rnd() * 36, r = 6 + rnd() * 12;
      const grd = g.createRadialGradient(x, y, 1, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.16)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return new THREE.CanvasTexture(cv);
  })(),
  magicCircle: (() => { // วงเวท: วงแหวนซ้อน + ขีดเรเดียล + สโตรกรูนสุ่ม (ขาวล้วน tint สีทีหลัง)
    const cv = makeCanvas(256, 256), g = cv.getContext('2d');
    g.translate(128, 128); g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 118, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 104, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, 64, 0, Math.PI * 2); g.stroke();
    let s = 777; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 24; i++) { // ขีดเรเดียล
      const a = (i / 24) * Math.PI * 2;
      g.beginPath(); g.moveTo(Math.cos(a) * 104, Math.sin(a) * 104); g.lineTo(Math.cos(a) * 118, Math.sin(a) * 118); g.stroke();
    }
    for (let i = 0; i < 8; i++) { // "รูน" สุ่มแบบสโตรกหักมุมสั้นๆ ระหว่างวงกลาง
      const a = (i / 8) * Math.PI * 2 + 0.3;
      g.save(); g.rotate(a); g.translate(84, 0); g.rotate(rnd() * 6);
      g.beginPath(); g.moveTo(-6, -6);
      for (let k = 0; k < 4; k++) g.lineTo(-6 + rnd() * 12, -6 + rnd() * 12);
      g.stroke(); g.restore();
    }
    g.lineWidth = 2; // สามเหลี่ยมกลับหัวกลางวง
    g.beginPath(); g.moveTo(0, -52); g.lineTo(45, 26); g.lineTo(-45, 26); g.closePath(); g.stroke();
    return new THREE.CanvasTexture(cv);
  })(),
  cracks: [41, 977, 5309].map((seed) => { // รอยแตกรัศมี 3 แบบ (สุ่มเลือกตอนใช้)
    const cv = makeCanvas(128, 128), g = cv.getContext('2d');
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.translate(64, 64); g.strokeStyle = 'rgba(12,8,4,0.9)'; g.lineCap = 'round';
    const arms = 6 + (seed % 3);
    for (let i = 0; i < arms; i++) {
      let a = (i / arms) * Math.PI * 2 + rnd() * 0.6, x = 0, y = 0, len = 22 + rnd() * 34;
      g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(0, 0);
      for (let seg = 0; seg < 4; seg++) {
        x += Math.cos(a) * (len / 4); y += Math.sin(a) * (len / 4);
        a += (rnd() - 0.5) * 0.9; g.lineTo(x, y); g.lineWidth *= 0.7;
      }
      g.stroke();
      if (rnd() < 0.6) { // แขนงย่อย
        g.lineWidth = 1.4; g.beginPath(); g.moveTo(x * 0.55, y * 0.55);
        g.lineTo(x * 0.55 + (rnd() - 0.5) * 26, y * 0.55 + (rnd() - 0.5) * 26); g.stroke();
      }
    }
    return new THREE.CanvasTexture(cv);
  }),
  curseMark: (() => { // สัญลักษณ์คำสาป: ดวงตาในสามเหลี่ยมกลับหัว (วาดเอง ไม่ได้ลอกจากภาพอ้างอิง)
    const cv = makeCanvas(64, 64), g = cv.getContext('2d');
    g.strokeStyle = 'rgba(235,170,255,0.95)'; g.lineWidth = 3.4; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(32, 56); g.lineTo(8, 14); g.lineTo(56, 14); g.closePath(); g.stroke();
    g.lineWidth = 2.4;
    g.beginPath(); g.ellipse(32, 27, 12, 7, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(235,170,255,0.95)';
    g.beginPath(); g.arc(32, 27, 3.4, 0, Math.PI * 2); g.fill();
    return new THREE.CanvasTexture(cv);
  })(),
};

// ----- object pools -----
function makeVFXPool(count, create) {
  const items = [];
  for (let i = 0; i < count; i++) { const o = create(); o.visible = false; vfxRoot.add(o); items.push(o); }
  return {
    items, // เผื่อเทสต์นับ object
    acquire() { const o = items.find((it) => !it.visible); if (o) o.visible = true; return o || null; }, // pool หมด = ข้ามชิ้นนั้น (งดสร้างเพิ่ม)
    release(o) { if (o) o.visible = false; },
  };
}
const additiveSprite = (tex) => new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
const VFX_POOLS = {
  spark: makeVFXPool(48, () => additiveSprite(VFX_TEX.spark)),
  glow: makeVFXPool(8, () => additiveSprite(VFX_TEX.glow)),
  smoke: makeVFXPool(20, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX_TEX.smoke, transparent: true, depthWrite: false }))),
  ring: makeVFXPool(10, () => { // วงแหวน (วงเวทซ้อน/คลื่นกระแทก) — นอนราบกับพื้นเป็นค่าเริ่มต้น
    const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; return m;
  }),
  circle: makeVFXPool(6, () => { // วงเวท/วงคำสาปแบบมีลาย (magicCircle texture)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: VFX_TEX.magicCircle, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; return m;
  }),
  crack: makeVFXPool(4, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: VFX_TEX.cracks[0], transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; return m;
  }),
  rock: makeVFXPool(16, () => new THREE.Mesh(new THREE.DodecahedronGeometry(0.055, 0), new THREE.MeshLambertMaterial({ color: 0x8a6f4d, transparent: true }))),
  curseMark: makeVFXPool(6, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: VFX_TEX.curseMark, transparent: true, depthTest: false }))),
};

// ----- screen flash (DOM overlay สร้างครั้งเดียว อัปเดตแค่ style.opacity ไม่ rebuild DOM) -----
const vfxFlashEl = document.createElement('div');
vfxFlashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;opacity:0;';
document.body.appendChild(vfxFlashEl);
let flashState = null; // {t, duration, maxOpacity}
function triggerScreenFlash(opts) {
  if (!VFX_ENABLED) return;
  const maxOpacity = Math.min(opts.maxOpacity || 0.2, 0.35); // เพดานกันจอขาวมองไม่เห็น
  vfxFlashEl.style.background = opts.color || '#ffffff';
  flashState = { t: 0, duration: opts.duration || 0.2, maxOpacity };
}
// ----- camera shake (จำกัดเพดาน + decay แบบ quadratic ให้จางลง smooth) -----
let shakeState = null; // {t, duration, magnitude}
function triggerCameraShake(opts) {
  if (!VFX_ENABLED || !CAMERA_SHAKE_ENABLED) return;
  const magnitude = Math.min(opts.magnitude || 5, VFX_MAX_SHAKE_PX);
  // สั่นใหม่ระหว่างสั่นเดิม: เก็บค่าที่แรง/นานกว่า ไม่บวกซ้อนกันจนเกินเพดาน
  if (shakeState) shakeState = { t: 0, duration: Math.max(opts.duration || 0.25, shakeState.duration - shakeState.t), magnitude: Math.max(magnitude, shakeState.magnitude) };
  else shakeState = { t: 0, duration: opts.duration || 0.25, magnitude };
}
function updateShakeAndFlash(dt) {
  if (flashState) {
    flashState.t += dt;
    const k = flashState.t / flashState.duration;
    vfxFlashEl.style.opacity = k >= 1 ? 0 : (flashState.maxOpacity * (k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75)).toFixed(3);
    if (k >= 1) flashState = null;
  }
  if (shakeState) {
    shakeState.t += dt;
    const k = shakeState.t / shakeState.duration;
    if (k >= 1) { shakeState = null; camera.clearViewOffset(); }
    else {
      const decay = (1 - k) * (1 - k);
      const px = Math.sin(shakeState.t * 71) * shakeState.magnitude * decay;
      const py = Math.cos(shakeState.t * 89) * shakeState.magnitude * decay;
      const w = window.innerWidth || 1, h = window.innerHeight || 1;
      camera.setViewOffset(w, h, px, py, w, h); // เลื่อนภาพระดับ px ล้วน ไม่แตะ position/frustum ที่ layoutBoard คุม
    }
  }
}

// ----- บรรยากาศสนามชั่วคราว (Arena Curse) — refcount เผื่อคำสาปซ้อนกัน คืนสีเดิมเมื่อตัวสุดท้ายจบ -----
const VFX_BASE_BG = scene.background.clone(), VFX_BASE_FOG = scene.fog.color.clone();
const VFX_CURSE_TINT = new THREE.Color(0x2a1038);
let curseAtmosphereCount = 0, curseAtmosphereK = 0; // K = 0..1 ระดับการย้อมสีปัจจุบัน
function updateCurseAtmosphere(dt) {
  const target = curseAtmosphereCount > 0 ? 1 : 0;
  if (curseAtmosphereK === target) return;
  curseAtmosphereK += Math.sign(target - curseAtmosphereK) * Math.min(dt / 0.35, Math.abs(target - curseAtmosphereK));
  scene.background.copy(VFX_BASE_BG).lerp(VFX_CURSE_TINT, curseAtmosphereK);
  scene.fog.color.copy(VFX_BASE_FOG).lerp(VFX_CURSE_TINT, curseAtmosphereK);
}

// ----- effect core -----
function disposeVFX(fx) {
  fx.parts.forEach((p) => p.pool.release(p.obj));
  if (fx.onDispose) fx.onDispose();
  const i = activeVFX.indexOf(fx);
  if (i >= 0) activeVFX.splice(i, 1);
}
function clearAllVFX() {
  while (activeVFX.length) disposeVFX(activeVFX[0]);
  flashState = null; vfxFlashEl.style.opacity = 0;
  if (shakeState) { shakeState = null; camera.clearViewOffset(); }
  curseAtmosphereCount = 0; // updateCurseAtmosphere จะไล่สีกลับเองแบบ smooth
}
function updateVFX(dt) {
  updateShakeAndFlash(dt);
  updateCurseAtmosphere(dt);
  for (let i = activeVFX.length - 1; i >= 0; i--) {
    const fx = activeVFX[i];
    fx.t += dt;
    if (fx.t >= fx.duration) disposeVFX(fx);
    else fx.update(fx, fx.t / fx.duration, dt);
  }
}
// helper: ยืมชิ้นส่วนจาก pool เข้า record ของเอฟเฟกต์ (คืนอัตโนมัติตอน dispose)
function vfxAcquire(fx, poolName) {
  const obj = VFX_POOLS[poolName].acquire();
  if (obj) fx.parts.push({ obj, pool: VFX_POOLS[poolName] });
  return obj;
}
function vfxTargetPos(target, fallbackUnit) {
  const u = Array.isArray(target) ? target.find((t) => t && t.group) : target;
  const src = (u && u.group) ? u : fallbackUnit;
  return src && src.group ? src.group.position : new THREE.Vector3();
}

// ----- effect builders -----
const VFX_BUILDERS = {
  // Mage cast: วงเวทหมุนใต้เท้า + แสงรวมตัว + ประกายวิ่งเข้าหาตัว (duration = cast time จริงของสกิล)
  arcane_cast(opts) {
    const fx = { t: 0, duration: Math.max(opts.castTime || 0.6, 0.25), parts: [], update: null };
    const pos = opts.caster.group.position;
    const circle = vfxAcquire(fx, 'circle');
    if (circle) { circle.material.color.setHex(0x7d8cff); circle.position.set(pos.x, 0.03, pos.z); circle.scale.set(0.1, 0.1, 1); circle.material.opacity = 0; }
    const glow = vfxAcquire(fx, 'glow');
    if (glow) { glow.material.color.setHex(0x9d7dff); glow.material.opacity = 0; glow.position.set(pos.x, 0.55, pos.z); glow.scale.set(0.2, 0.2, 1); }
    const sparks = [];
    for (let i = 0; i < 8; i++) {
      const s = vfxAcquire(fx, 'spark');
      if (!s) break;
      const a = (i / 8) * Math.PI * 2;
      s.userData.vfxA = a; s.material.color.setHex(i % 2 ? 0x66aaff : 0xbb77ff);
      s.scale.set(0.16, 0.16, 1); sparks.push(s);
    }
    fx.update = (f, k) => {
      const p = opts.caster.group.position; // ตามตัวแคสเตอร์เผื่อขยับ
      if (circle) { circle.position.set(p.x, 0.03, p.z); const sc = 1.15 * Math.min(1, k * 2.4); circle.scale.set(sc, sc, 1); circle.rotation.z = k * 4; circle.material.opacity = Math.min(1, k * 3) * 0.85; }
      if (glow) { glow.position.set(p.x, 0.55, p.z); const gs = 0.2 + k * 0.85; glow.scale.set(gs, gs, 1); glow.material.opacity = 0.25 + k * 0.6; }
      sparks.forEach((s, i) => { // วนเข้าหาแกนกลางแบบ spiral
        const r = 1.05 * (1 - k), a = s.userData.vfxA + k * 5;
        s.position.set(p.x + Math.cos(a) * r, 0.25 + k * 0.5 + i * 0.02, p.z + Math.sin(a) * r);
        s.material.opacity = 0.4 + k * 0.6;
      });
    };
    return fx;
  },
  // Mage impact: วงเวทซ้อน 2-3 ชั้น + คลื่นขยาย + ประกายกระจาย + flash ม่วงอ่อนสั้นๆ
  arcane_burst(opts) {
    const fx = { t: 0, duration: 0.85, parts: [], update: null };
    const pos = vfxTargetPos(opts.target, opts.caster).clone();
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = vfxAcquire(fx, 'ring');
      if (!r) break;
      r.material.color.setHex(i === 1 ? 0xbb77ff : 0x66aaff);
      r.position.set(pos.x, 0.05 + i * 0.3, pos.z);
      rings.push(r);
    }
    const wave = vfxAcquire(fx, 'ring');
    if (wave) { wave.material.color.setHex(0x9db4ff); wave.position.set(pos.x, 0.03, pos.z); }
    const circle = vfxAcquire(fx, 'circle');
    if (circle) { circle.material.color.setHex(0xbb77ff); circle.position.set(pos.x, 0.04, pos.z); }
    const glow = vfxAcquire(fx, 'glow');
    if (glow) { glow.material.color.setHex(0xcaa8ff); glow.position.set(pos.x, 0.6, pos.z); }
    const sparks = [];
    for (let i = 0; i < 16; i++) {
      const s = vfxAcquire(fx, 'spark');
      if (!s) break;
      const a = Math.random() * Math.PI * 2;
      s.userData.vfxV = { x: Math.cos(a) * (1.2 + Math.random() * 1.6), y: 1.2 + Math.random() * 2.2, z: Math.sin(a) * (1.2 + Math.random() * 1.6) };
      s.position.set(pos.x, 0.4, pos.z);
      s.material.color.setHex(i % 2 ? 0x66aaff : 0xd0a8ff);
      s.scale.set(0.2, 0.2, 1);
      sparks.push(s);
    }
    triggerScreenFlash({ color: '#8f78ff', maxOpacity: 0.22, duration: 0.2 });
    fx.update = (f, k, dt) => {
      rings.forEach((r, i) => {
        const sc = 0.7 + k * (1.5 + i * 0.35);
        r.scale.set(sc, sc, 1); r.rotation.z += (i % 2 ? -1 : 1) * dt * 5;
        r.material.opacity = (1 - k) * 0.95;
      });
      if (wave) { const ws = 0.4 + k * 4.6; wave.scale.set(ws, ws, 1); wave.material.opacity = (1 - k) * 0.7; }
      if (circle) { const cs = 1.3 + k * 1.2; circle.scale.set(cs, cs, 1); circle.rotation.z -= dt * 2.2; circle.material.opacity = (1 - k) * 0.9; }
      if (glow) { const gs = 1.15 * (k < 0.18 ? k / 0.18 : 1 - (k - 0.18) / 0.82); glow.scale.set(gs + 0.01, gs + 0.01, 1); glow.material.opacity = Math.max(0, 0.7 * (1 - k)); }
      sparks.forEach((s) => {
        const v = s.userData.vfxV;
        s.position.x += v.x * dt; s.position.z += v.z * dt;
        s.position.y += v.y * dt; v.y -= 6.5 * dt;
        s.material.opacity = (1 - k);
      });
    };
    return fx;
  },
  // Fighter cast: ประจุแสงส้มสั้นๆ ใต้เท้า (คู่กับ Ground Slam ตอน impact)
  slam_cast(opts) {
    const fx = { t: 0, duration: Math.max(opts.castTime || 0.5, 0.25), parts: [], update: null };
    const glow = vfxAcquire(fx, 'glow');
    if (glow) { glow.material.color.setHex(0xffb347); glow.material.opacity = 0; }
    fx.update = (f, k) => {
      if (!glow) return;
      const p = opts.caster.group.position;
      glow.position.set(p.x, 0.28, p.z);
      const gs = 0.3 + k * 0.7; glow.scale.set(gs, gs, 1);
      glow.material.opacity = 0.2 + k * 0.55;
    };
    return fx;
  },
  // Fighter impact: วงกระแทก + รอยแตก procedural + หินกระเด็น + ฝุ่น + สั่นกล้องเบาๆ —
  // "hit stop เฉพาะภาพ": คลื่นกระแทกค้างที่สเกลแรกเริ่ม ~60ms ก่อนขยาย (ลอจิกเกมเดินต่อปกติ)
  ground_slam(opts) {
    const fx = { t: 0, duration: 0.8, parts: [], update: null };
    const pos = vfxTargetPos(opts.target, opts.caster).clone();
    const HOLD = 0.075; // สัดส่วนของ duration (~60ms) ที่คลื่น "ค้างภาพ" ตอนกระทบ
    const wave = vfxAcquire(fx, 'ring');
    if (wave) { wave.material.color.setHex(0xffc966); wave.position.set(pos.x, 0.04, pos.z); }
    const crack = vfxAcquire(fx, 'crack');
    if (crack) {
      crack.material.map = VFX_TEX.cracks[(Math.random() * VFX_TEX.cracks.length) | 0];
      crack.position.set(pos.x, 0.025, pos.z); crack.rotation.z = Math.random() * Math.PI * 2;
      crack.scale.set(1.5, 1.5, 1);
    }
    const glow = vfxAcquire(fx, 'glow');
    if (glow) { glow.material.color.setHex(0xff9d3c); glow.position.set(pos.x, 0.3, pos.z); }
    const rocks = [];
    for (let i = 0; i < 9; i++) {
      const r = vfxAcquire(fx, 'rock');
      if (!r) break;
      const a = Math.random() * Math.PI * 2;
      r.userData.vfxV = { x: Math.cos(a) * (0.7 + Math.random() * 1.3), y: 2.2 + Math.random() * 2.4, z: Math.sin(a) * (0.7 + Math.random() * 1.3) };
      r.position.set(pos.x, 0.1, pos.z);
      r.material.opacity = 1;
      r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      rocks.push(r);
    }
    const dusts = [];
    for (let i = 0; i < 6; i++) {
      const d = vfxAcquire(fx, 'smoke');
      if (!d) break;
      const a = (i / 6) * Math.PI * 2;
      d.material.color.setHex(0xb9a184);
      d.position.set(pos.x + Math.cos(a) * 0.5, 0.18, pos.z + Math.sin(a) * 0.5);
      d.userData.vfxA = a;
      dusts.push(d);
    }
    triggerCameraShake({ magnitude: 6, duration: 0.3 });
    triggerScreenFlash({ color: '#ffb347', maxOpacity: 0.12, duration: 0.14 });
    fx.update = (f, k, dt) => {
      const kk = Math.max(0, (k - HOLD) / (1 - HOLD)); // ค้างภาพช่วง HOLD แรก
      if (wave) { const ws = 0.5 + kk * 3.4; wave.scale.set(ws, ws, 1); wave.material.opacity = (1 - kk) * 0.95; }
      if (crack) crack.material.opacity = k < 0.45 ? 0.9 : 0.9 * (1 - (k - 0.45) / 0.55);
      if (glow) { const gs = 1.1 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); glow.scale.set(gs + 0.01, gs + 0.01, 1); glow.material.opacity = Math.max(0, 1 - kk * 1.3); }
      rocks.forEach((r) => {
        const v = r.userData.vfxV;
        r.position.x += v.x * dt; r.position.z += v.z * dt;
        r.position.y += v.y * dt; v.y -= 10.5 * dt;
        r.rotation.x += dt * 7; r.rotation.y += dt * 5;
        if (r.position.y <= 0.03) r.visible = false; // ตกถึงพื้นแล้วหาย (release ตอน dispose อยู่ดี)
        r.material.opacity = Math.min(1, (1 - k) * 2);
      });
      dusts.forEach((d) => {
        d.position.y += dt * 0.55;
        d.position.x += Math.cos(d.userData.vfxA) * dt * 0.4;
        d.position.z += Math.sin(d.userData.vfxA) * dt * 0.4;
        const ds = 0.5 + k * 1.3; d.scale.set(ds, ds, 1);
        d.material.opacity = (1 - k) * 0.55;
      });
    };
    return fx;
  },
  // Boss Arena Curse: ย้อมบรรยากาศทั้งสนามม่วงเข้ม + วงคำสาปใหญ่ใต้เป้าหมาย + ควันดำลอย +
  // สัญลักษณ์คำสาปเหนือหัวยูนิตที่โดน — duration ตาม status จริง และตัดจอทันทีที่สถานะหลุด/ตาย
  arena_curse(opts) {
    const fx = { t: 0, duration: opts.duration || 5, parts: [], update: null };
    curseAtmosphereCount += 1;
    fx.onDispose = () => { curseAtmosphereCount = Math.max(0, curseAtmosphereCount - 1); };
    const entries = (opts.targets || []).map((u) => {
      const circle = vfxAcquire(fx, 'circle');
      if (circle) { circle.material.color.setHex(0xa050e0); circle.scale.set(0.1, 0.1, 1); }
      const mark = vfxAcquire(fx, 'curseMark');
      if (mark) mark.scale.set(0.42, 0.42, 1);
      const smokes = [];
      for (let i = 0; i < 4; i++) {
        const s = vfxAcquire(fx, 'smoke');
        if (!s) break;
        s.material.color.setHex(0x51246e);
        s.userData.vfxSeed = Math.random() * 10;
        smokes.push(s);
      }
      return { u, circle, mark, smokes };
    });
    triggerScreenFlash({ color: '#5e2a8a', maxOpacity: 0.18, duration: 0.3 });
    triggerCameraShake({ magnitude: 4, duration: 0.25 });
    const stillCursed = (u) => u.alive && (u.statuses || []).some((s) => s.status_id === 'arena_curse');
    fx.update = (f, k, dt) => {
      entries.forEach((e) => {
        const active = stillCursed(e.u); // สถานะหลุดก่อนเวลา (เช่นตาย) → ซ่อนทันที ไม่รอ duration
        const p = e.u.group.position;
        if (e.circle) {
          e.circle.visible = active;
          e.circle.position.set(p.x, 0.035, p.z);
          const cs = Math.min(1, f.t / 0.4) * 2.6;
          e.circle.scale.set(cs, cs, 1);
          e.circle.rotation.z += dt * 0.9;
          e.circle.material.opacity = (0.55 + Math.sin(f.t * 5) * 0.2) * (k > 0.9 ? (1 - k) * 10 : 1);
        }
        if (e.mark) {
          e.mark.visible = active;
          e.mark.position.set(p.x, (e.u.halfH || 0.8) * 2 + 0.62 + Math.sin(f.t * 3) * 0.05, p.z);
          e.mark.material.opacity = k > 0.9 ? (1 - k) * 10 : 0.95;
        }
        e.smokes.forEach((s, i) => {
          s.visible = active;
          const cyc = (f.t * 0.5 + s.userData.vfxSeed + i * 0.7) % 1; // วนลอยขึ้นซ้ำ
          const a = s.userData.vfxSeed + i * 2.1;
          s.position.set(p.x + Math.cos(a) * 0.45, 0.15 + cyc * 1.5, p.z + Math.sin(a) * 0.45);
          const ss = 0.45 + cyc * 0.8; s.scale.set(ss, ss, 1);
          s.material.opacity = (1 - cyc) * 0.5 * (k > 0.9 ? (1 - k) * 10 : 1);
        });
      });
    };
    return fx;
  },
};
function spawnVFX(type, opts) {
  if (!VFX_ENABLED) return null;
  const builder = VFX_BUILDERS[type];
  if (!builder) return null;
  const fx = builder(opts || {});
  if (fx) { fx.type = type; activeVFX.push(fx); }
  return fx;
}
// ตารางจับคู่ heroKey -> เอฟเฟกต์ (รอบนี้ทดลอง 3 เอฟเฟกต์ตัวแทน: mage/fighter/บอส arena_curse —
// ฮีโร่ตัวอื่นยังไม่มีเอฟเฟกต์ = spawnVFX คืน null เงียบๆ ไม่กระทบอะไร)
const VFX_SKILL_CAST = { mage: 'arcane_cast', fighter: 'slam_cast' };
const VFX_SKILL_IMPACT = { mage: 'arcane_burst', fighter: 'ground_slam' };
// ============================================================
// UNIT RESOURCE CLEANUP — อุดรอยรั่ว geometry/material/texture ของยูนิต (root cause ของ
// renderer.info.memory.geometries ที่โตสะสมข้ามเวฟที่เจอตอนเทส VFX): เดิม removeUnit แค่
// scene.remove() โดยไม่ dispose อะไรเลย ทั้งที่ makeUnit สร้างของใหม่ต่อยูนิตทุกครั้ง
// (body/เงา/หลอด HP/หลอดมานา/linkRing = geometry+material ต่อชิ้น, sprite sheet ฮีโร่ =
// texture.clone() ต่อยูนิต, star badge = CanvasTexture ต่อยูนิต)
// ============================================================
// Shared resources ที่ "ห้าม dispose ตอนลบยูนิตตัวเดียว": SPRITES[*] (มอนสเตอร์ 1 เฟรมใช้ texture
// ต้นฉบับตรงๆ หลายยูนิตพร้อมกัน), EQUIP_BADGE_TEX/LINK_BADGE_TEX (badge ทุกยูนิตชี้ texture เดียว)
// — ส่วน texture ที่ยูนิตเป็นเจ้าของจริง (sheet clone / star badge / floating text) dispose ได้
function isSharedUnitTexture(t) {
  if (!t) return true;
  if (t === EQUIP_BADGE_TEX || t === LINK_BADGE_TEX) return true;
  for (const k in SPRITES) if (SPRITES[k] === t) return true;
  if (SKELETON_TEXTURE_SET.has(t)) return true; // Skeleton motion frames are shared across all live Skeleton units
  if (MONSTER_TEXTURE_SET.has(t)) return true; // Remaining-five motion frames, same shared-cache safety as Skeleton
  return false;
}
function disposeObjectTree(root) {
  root.traverse((o) => {
    // THREE.Sprite (r128) ใช้ BufferGeometry static ตัวเดียวร่วมกันทุก sprite ทั้งเอนจิน
    // (badge/floating text/VFX pool) — dispose ของ sprite ตัวเดียว = พังของทุกตัว จึงข้ามเสมอ
    if (o.geometry && !o.isSprite) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    mats.forEach((m) => {
      if (m.map && !isSharedUnitTexture(m.map)) m.map.dispose();
      m.dispose(); // material.dispose() ไม่แตะ texture เอง — shared map จึงปลอดภัยเสมอ
    });
  });
}
function disposeUnitVisual(u) {
  // ยกเลิก hit-flash timer ค้าง — ไม่ให้ callback restore สีไปแตะ material ที่กำลังจะถูก dispose
  if (u.hitFlashTimer) { clearTimeout(u.hitFlashTimer); u.hitFlashTimer = null; }
  disposeObjectTree(u.group);
  // floating text ที่ยังลอยค้างเหนือหัวยูนิตนี้: resource ถูก dispose ไปกับ traverse ด้านบนแล้ว
  // เหลือแค่ถอด entry ออกจาก registry ไม่ให้ updateFloatingTexts ถือ reference ของยูนิตที่ลบแล้ว
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let p = floatingTexts[i].sprite.parent, inTree = false;
    while (p) { if (p === u.group) { inTree = true; break; } p = p.parent; }
    if (inTree) floatingTexts.splice(i, 1);
  }
}
function removeUnit(u) {
  scene.remove(u.group);
  disposeUnitVisual(u); // ทุกเส้นทางลบยูนิต (ขาย/ย้าย/จบเวฟ/summon หมดอายุ/รวมร่าง) ผ่านจุดนี้จุดเดียว
  occupied.delete(key(u.c, u.r));
  const idx = units.indexOf(u);
  if (idx >= 0) units.splice(idx, 1);
}
function resetForWave(u) {
  // สแนปกลับไทล์ที่วางไว้ตอนแรกเสมอ — ระหว่างต่อสู้ยูนิตอาจไล่ล่าศัตรูจนขยับออกจากไทล์เดิม
  occupied.delete(key(u.c, u.r));
  u.c = u.origC; u.r = u.origR;
  const p = gridToWorld(u.c, u.r);
  u.group.position.set(p.x, 0, p.z);
  u.moving = false; u.moveT = 0; u.body.position.x = 0;
  u.alive = true; u.hp = u.maxHp; u.atkCooldown = 0;
  u.body.rotation.z = 0; u.body.material.opacity = 1; u.body.material.color.set(u.placeholderColor || 0xffffff);
  u.hpBar.visible = true; u.hpBar.scale.x = 1; u.hpBar.position.x = 0;
  u.group.children[2].visible = true;
  u.shadow.material.opacity = 0.35;
  u.group.visible = true;
  u.deathT = undefined;
  u.animState = 'idle'; u.animFrame = 0;
  // Skill/Mana/Status reset between waves (equipment + Link/synergy state are untouched)
  u.current_mana = 0; u.statuses = []; u.action_state = 'idle'; u.current_target = null;
  u.castTimer = 0; u.castTarget = null; u.castTargetList = null; u.skillGoldTriggers = 0;
  u.reviveUsesThisWave = 0; u.shield = 0; u.shieldTimer = 0;
  updateManaBar(u);
  if (u.baseStats) buildCombatStats(u, ITEM_DEFS_BY_ID); // statuses cleared -> combatStats must drop any lingering modifier
  occupied.add(key(u.c, u.r));
}

// --- Skeleton Runtime Integration Pilot v1 — presentation-only state machine (see block above
// SPRITES/ASSET_META for asset/loading notes). Kept fully separate from WALK_SEQ/ATTACK_SEQ below
// (the existing hero animation, untouched) — gated entirely on u.skelAnim, which only Skeleton
// units ever have, so no other unit's rendering path is affected.
// Returns the frame index active at time t within `seq`, or null once a non-looping sequence
// has finished playing (the caller then decides what state to transition to).
function skeletonFrameIndexForTime(seq, t) {
  let acc = 0;
  for (let i = 0; i < seq.durations.length; i++) {
    acc += seq.durations[i];
    if (t < acc) return i;
  }
  return seq.loop ? seq.durations.length - 1 : null;
}
function setSkeletonFrame(u, state, idx) {
  const tex = SKELETON_TEXTURES[state] && SKELETON_TEXTURES[state][idx];
  if (!tex) return; // missing-frame fallback: keep showing the last valid frame, never blank/crash
  u.body.material.map = tex;
  u.body.material.needsUpdate = true;
}
// --- Skeleton Motion Feel Pilot v1 — presentation-only tuning layer over the approved motion
// package. It only changes WHICH already-approved frame is shown WHEN (state selection, playback
// timing, idle hold, distance-synced walk, stop settle, subtle breathing) for Skeleton units.
// It never touches combat state, damage application, cooldowns, movement speed, pathfinding,
// any frame PNG, or the SKELETON_ANIM_DEF table above (kept intact as the approved-package
// timing record — hit/attack playback now reads the presentation overrides below instead).
const SKELETON_FEEL = {
  // World units traveled per full 8-frame walk cycle. TILE=1, so one tile step = exactly one
  // cycle, and the movement bob in updateUnit (|sin(moveT*2π)| = two footfall arcs per step)
  // lines up with the cycle's two strides. Playback phase advances with ACTUAL distance moved —
  // frames can never advance while stationary, and foot contact stays in step with travel.
  strideWorldUnits: 1.0,
  // Hold the last walk pose this long after `moving` goes false before settling into the held
  // idle. A real stop reads as a settle instead of a hard snap; the 1-tick moving=false gap
  // between consecutive path steps never reaches it, which kills the restart-every-tile flicker.
  stopSettleSec: 0.12,
  // Idle is a HELD neutral frame (cycling the package's 6 independently-rendered idle poses at
  // ~6fps is exactly what read as "dancing") plus a barely-visible breathing scale. The scale is
  // bottom-anchored in updateSkeletonMotionAnim so the drawn feet and the shadow never move.
  idleBreathAmpl: 0.012,
  idleBreathPeriodSec: 3.2,
  // Attack presentation retiming (visual only). Damage applies the instant an attack triggers
  // (updateUnit), but the package timing put the contact pose (frame 4) 0.42s later — the swing
  // landed almost half a second after the damage number/flash, reading as weightless. Compressed
  // anticipation (0.15s to contact) + longer follow-through; total 0.72s, safely inside the 1.0s
  // attack cooldown. The damage event itself is byte-untouched.
  attackDurations: [0.05, 0.04, 0.03, 0.03, 0.10, 0.09, 0.10, 0.13, 0.15],
  // Brief readable recoil (0.31s vs the package's 0.42s) so sustained incoming fire doesn't
  // visually pin the unit in hit frames for most of the fight.
  hitDurations: [0.06, 0.07, 0.08, 0.10],
};
const SKELETON_PRESENT_SEQ = {
  basic_attack: { durations: SKELETON_FEEL.attackDurations, loop: false },
  hit: { durations: SKELETON_FEEL.hitDurations, loop: false },
};
// Breathing only ever writes body.scale.y; body.position.y is re-asserted by updateUnit every
// tick outside idle (walk bob / base), so clearing the scale is the whole cleanup.
function skeletonClearIdleBreath(u) {
  if (u.body && u.body.scale.y !== 1) u.body.scale.y = 1;
}
// Starts (or restarts) a one-shot/looping state immediately from frame 0. Once death has been
// triggered the unit is locked into it — no further hit/attack can play over a dying unit.
function triggerSkeletonAnim(u, state) {
  if (!u.skelAnim || u.skelAnim.state === 'death') return;
  skeletonClearIdleBreath(u); // a one-shot may interrupt idle mid-breath — drop the scale residue
  u.skelAnim.state = state; u.skelAnim.timer = 0; u.skelAnim.frameIdx = 0; u.skelAnim.shownState = state;
  setSkeletonFrame(u, state, 0);
}
function updateSkeletonMotionAnim(u, dt) {
  const sa = u.skelAnim;
  if (sa.state === 'hit' || sa.state === 'basic_attack') {
    sa.timer += dt;
    // keep the walk distance tracker fresh so a hit taken mid-step doesn't phase-jump on resume
    sa.lastX = u.group.position.x; sa.lastZ = u.group.position.z;
    const seq = SKELETON_PRESENT_SEQ[sa.state];
    const idx = skeletonFrameIndexForTime(seq, sa.timer);
    if (idx === null) { // one-shot finished -> resume what the unit is actually doing
      if (u.moving) { // continue the walk cycle from its preserved phase — no restart, no idle flash
        sa.state = 'move'; sa.shownState = 'move'; sa.settleT = 0;
        sa.frameIdx = Math.min(7, Math.floor((sa.movePhase || 0) * 8));
        setSkeletonFrame(u, 'move', sa.frameIdx);
      } else { // settle straight onto the held neutral — never flashes through walk frames
        sa.state = 'idle'; sa.shownState = 'idle'; sa.timer = 0; sa.frameIdx = 0; sa.breathT = 0;
        setSkeletonFrame(u, 'idle', 0);
      }
      return;
    }
    if (idx !== sa.frameIdx) { sa.frameIdx = idx; setSkeletonFrame(u, sa.state, idx); }
    return;
  }
  if (sa.state === 'death') return; // advanced separately in animate() since dead units skip updateUnit()

  if (u.moving) {
    // Walk: playback phase advances with ACTUAL world distance, not wall-clock time. The phase
    // persists across path steps and through interrupting one-shots, so the cycle no longer
    // restarts at frame 0 every tile; slow/immobilizing statuses slow playback automatically.
    if (sa.state !== 'move') { sa.state = 'move'; sa.timer = 0; }
    sa.settleT = 0;
    skeletonClearIdleBreath(u);
    const px = u.group.position.x, pz = u.group.position.z;
    if (sa.lastX === undefined) { sa.lastX = px; sa.lastZ = pz; }
    const d = Math.hypot(px - sa.lastX, pz - sa.lastZ);
    sa.lastX = px; sa.lastZ = pz;
    sa.movePhase = ((sa.movePhase || 0) + d / SKELETON_FEEL.strideWorldUnits) % 1;
    const idx = Math.min(7, Math.floor(sa.movePhase * 8));
    if (sa.frameIdx !== idx || sa.shownState !== 'move') { sa.frameIdx = idx; sa.shownState = 'move'; setSkeletonFrame(u, 'move', idx); }
    return;
  }

  if (sa.state === 'move') {
    // Just stopped (or in the 1-tick gap between consecutive path steps): hold the current walk
    // pose briefly. A real stop settles into the held idle after stopSettleSec; a between-steps
    // gap resumes moving first and never gets here — the per-step restart flicker is gone.
    // World position is already exact (updateUnit lerp hits t=1 on the final tick): no drift.
    sa.settleT = (sa.settleT || 0) + dt;
    // the step-completion tick still lerped a final distance fragment before flipping `moving`
    // off — fold it into the cycle phase so playback tracks travel exactly, with no per-tile hiccup
    const spx = u.group.position.x, spz = u.group.position.z;
    const sd = Math.hypot(spx - (sa.lastX === undefined ? spx : sa.lastX), spz - (sa.lastZ === undefined ? spz : sa.lastZ));
    sa.lastX = spx; sa.lastZ = spz;
    if (sd > 0) {
      sa.movePhase = ((sa.movePhase || 0) + sd / SKELETON_FEEL.strideWorldUnits) % 1;
      const si = Math.min(7, Math.floor(sa.movePhase * 8));
      if (sa.frameIdx !== si) { sa.frameIdx = si; setSkeletonFrame(u, 'move', si); }
    }
    if (sa.settleT < SKELETON_FEEL.stopSettleSec) return;
    sa.state = 'idle'; sa.shownState = 'idle'; sa.timer = 0; sa.frameIdx = 0; sa.movePhase = 0; sa.breathT = 0;
    setSkeletonFrame(u, 'idle', 0);
    return;
  }

  // Idle: one stable neutral frame (idle frame 0) + barely-visible bottom-anchored breathing.
  if (sa.shownState !== 'idle' || sa.frameIdx !== 0) { sa.frameIdx = 0; sa.shownState = 'idle'; setSkeletonFrame(u, 'idle', 0); }
  sa.breathT = (sa.breathT || 0) + dt;
  const s = 1 + SKELETON_FEEL.idleBreathAmpl * Math.sin((sa.breathT / SKELETON_FEEL.idleBreathPeriodSec) * Math.PI * 2);
  u.body.scale.y = s;
  // Pin the plane's bottom edge (the drawn feet) exactly where the un-scaled pose puts it:
  // scaling happens about the plane center, so shifting the center up by halfH*(s-1) keeps
  // bottom = baseY - halfH constant. Feet and shadow are rock-stable by construction.
  u.body.position.y = (u.halfH - (u.footLift || 0)) + u.halfH * (s - 1);
}
// Called only from the main animate() loop for dead Skeleton units (updateUnit() returns early
// for !u.alive, so death playback can't ride the normal per-unit update path). Sets
// sa.deathDone once the Death sequence's real duration has fully played; the pre-existing
// deathT rotate/fade-out block only starts after that (see animate()), so the approved 108cs
// Death animation is never cut short by the old ~0.5s generic fade.
function advanceSkeletonDeathAnim(u, dt) {
  const sa = u.skelAnim;
  sa.timer += dt;
  const seq = SKELETON_ANIM_DEF.death;
  const idx = skeletonFrameIndexForTime(seq, sa.timer);
  if (idx === null) { sa.deathDone = true; return; }
  if (idx !== sa.frameIdx) { sa.frameIdx = idx; setSkeletonFrame(u, 'death', idx); }
}

// --- Monster Demo Batch 1 — Remaining Five Runtime Integration v1 — shared, data-driven
// presentation-only state machine (see MONSTER_MOTION_DEFS above). One set of generic
// functions serves all five monsters via u.monsterAnim + u.monsterSprite, instead of five
// bespoke copies of the Skeleton pattern above. skeletonFrameIndexForTime is reused as-is
// (it takes only a generic `seq` with .durations/.loop, no Skeleton-specific reference).
function setMonsterFrame(u, spriteKey, state, idx) {
  const tex = MONSTER_TEXTURES[spriteKey] && MONSTER_TEXTURES[spriteKey][state] && MONSTER_TEXTURES[spriteKey][state][idx];
  if (!tex) return; // missing-frame fallback: keep showing the last valid frame, never blank/crash
  u.body.material.map = tex;
  u.body.material.needsUpdate = true;
}
// Starts (or restarts) a one-shot/looping state immediately from frame 0. Once death has been
// triggered the unit is locked into it — no further hit/attack can play over a dying unit.
function triggerMonsterAnim(u, spriteKey, state) {
  if (!u.monsterAnim || u.monsterAnim.state === 'death') return;
  u.monsterAnim.state = state; u.monsterAnim.timer = 0; u.monsterAnim.frameIdx = 0;
  setMonsterFrame(u, spriteKey, state, 0);
}
function updateMonsterMotionAnim(u, dt) {
  const ma = u.monsterAnim;
  const spriteKey = u.monsterSprite;
  const def = MONSTER_MOTION_DEFS[spriteKey];
  if (ma.state === 'hit' || ma.state === 'basic_attack') {
    ma.timer += dt;
    const seq = def.states[ma.state];
    const idx = skeletonFrameIndexForTime(seq, ma.timer);
    if (idx === null) { // one-shot finished -> resume whatever the unit is currently doing
      const next = u.moving ? 'move' : 'idle';
      ma.state = next; ma.timer = 0; ma.frameIdx = 0;
      setMonsterFrame(u, spriteKey, next, 0);
      return;
    }
    if (idx !== ma.frameIdx) { ma.frameIdx = idx; setMonsterFrame(u, spriteKey, ma.state, idx); }
    return;
  }
  if (ma.state === 'death') return; // advanced separately in animate() since dead units skip updateUnit()
  // idle/move: continuously follow the unit's existing (unmodified) `moving` flag, looping.
  const wantState = u.moving ? 'move' : 'idle';
  if (ma.state !== wantState) { ma.state = wantState; ma.timer = 0; ma.frameIdx = 0; }
  const seq = def.states[ma.state];
  const total = seq.durations.reduce((a, b) => a + b, 0);
  ma.timer = (ma.timer + dt) % total;
  const idx = skeletonFrameIndexForTime(seq, ma.timer);
  if (idx !== ma.frameIdx) { ma.frameIdx = idx; setMonsterFrame(u, spriteKey, ma.state, idx); }
}
// Called only from the main animate() loop for dead monster units (updateUnit() returns early
// for !u.alive, so death playback can't ride the normal per-unit update path). Sets
// ma.deathDone once the Death sequence's real duration has fully played; the pre-existing
// deathT rotate/fade-out block only starts after that (see animate()), so the approved
// Death animation is never cut short by the old ~0.5s generic fade.
function advanceMonsterDeathAnim(u, dt) {
  const ma = u.monsterAnim;
  const def = MONSTER_MOTION_DEFS[u.monsterSprite];
  ma.timer += dt;
  const seq = def.states.death;
  const idx = skeletonFrameIndexForTime(seq, ma.timer);
  if (idx === null) { ma.deathDone = true; return; }
  if (idx !== ma.frameIdx) { ma.frameIdx = idx; setMonsterFrame(u, u.monsterSprite, 'death', idx); }
}

const WALK_SEQ = [1,2,3,4], ATTACK_SEQ = [5,6,7], ATTACK_FRAME_DUR = 0.12;
function updateAnim(u, dt) {
  if (u.skelAnim) { updateSkeletonMotionAnim(u, dt); return; } // Skeleton pilot: fully separate path
  if (u.monsterAnim) { updateMonsterMotionAnim(u, dt); return; } // Remaining-five Runtime integration: fully separate path
  if (u.frames <= 1) return;
  if (u.animState === 'attack') {
    u.animTimer += dt;
    const idx = Math.min(ATTACK_SEQ.length-1, Math.floor(u.animTimer/ATTACK_FRAME_DUR));
    u.animFrame = ATTACK_SEQ[idx];
    if (u.animTimer >= ATTACK_FRAME_DUR*ATTACK_SEQ.length) { u.animState = u.moving?'walk':'idle'; u.animTimer = 0; }
  } else if (u.moving) {
    u.animState = 'walk'; u.animTimer += dt*6;
    u.animFrame = WALK_SEQ[Math.floor(u.animTimer)%WALK_SEQ.length];
  } else { u.animState = 'idle'; u.animFrame = 0; }
  u.tex.offset.x = u.animFrame / u.frames;
}
// Physical/Magic damage split (HERO_DEFS attack_type): picks the attacker's raw attack value
// by attack_type, then mitigates it against the target's matching defense stat. Monsters/bosses
// (ENEMY_BASE/bossWave) only ever have `armor` (a %-reduction stat, no attack_type/p_def/m_def
// at all) — that legacy path is preserved unchanged for any target that defines `armor`. Heroes
// (HERO_DEFS.stats.p_def/m_def) use the new flat subtraction instead.
function attackerRawAtk(attacker) {
  // heroes: read the equipment-adjusted combatStats snapshot built at battle start.
  // enemies/bosses never have combatStats (no equipment) — fall back to their flat stat.
  const s = attacker.combatStats;
  if (s) return attacker.attackType === 'magic' ? (s.m_atk || 0) : (s.p_atk || 0);
  return attacker.attackType === 'magic' ? (attacker.mAtk || 0) : (attacker.pAtk || 0);
}
function mitigateDamage(rawDmg, attacker, target, armorPenPct) {
  if (target.armor != null) {
    const effArmor = Math.max(0, getEffectiveArmor(target) - (armorPenPct || 0));
    return rawDmg * (1 - effArmor / 100);
  }
  const isMagic = attacker.attackType === 'magic';
  const ts = target.combatStats;
  const def = ts ? (isMagic ? (ts.m_def || 0) : (ts.p_def || 0)) : (isMagic ? (target.mDef || 0) : (target.pDef || 0));
  // Diminishing-return mitigation: def 30 blocks ~23%, def 100 blocks 50%, def can never
  // reduce a positive attack to zero. The old flat `max(0, raw - def)` made every early
  // monster (Slime 9, Skeleton 13, OrcBrute 20, Golem 24 P.ATK) deal literally 0 to any
  // hero with equal-or-higher defense, which is most of the roster. Enemy `armor` keeps its
  // separate percentage path above — heroes attacking monsters are unaffected by this line.
  return rawDmg * 100 / (100 + Math.max(0, def));
}
// ----- hit-flash กลาง: เก็บ timer handle ไว้บนยูนิต เพื่อคืนสี/ยกเลิกได้จากทุกจุดใน lifecycle -----
// แก้บั๊กศพค้างสี flash: เดิม callback restore เช็ค `target.alive` → ยูนิตที่ตายกลาง flash ไม่ถูกคืนสี
// ศพเลย fade ทั้งที่ยังติดสีส้มแดง — ตอนนี้ (1) ตายเมื่อไหร่ handleUnitDeath คืนสีทันทีก่อนเริ่ม fade
// (2) removeUnit ยกเลิก timer ค้าง ไม่ให้ callback เก่าไปแตะ material ที่ dispose แล้ว
function restoreBodyColor(u) {
  if (u.hitFlashTimer) { clearTimeout(u.hitFlashTimer); u.hitFlashTimer = null; }
  // A textured body must return to WHITE (no tint) — placeholderColor only applies to the
  // untextured box fallback. Slime/OrcBrute carry a placeholderColor AND (normally) a motion
  // texture, so keying on the material's map, not the config, picks the right base per unit.
  if (u.body) u.body.material.color.set(u.body.material.map ? 0xffffff : (u.placeholderColor || 0xffffff));
}
function applyHitFlash(u, colorHex, durationMs) {
  if (!u.body) return;
  if (u.skelAnim && u.alive) triggerSkeletonAnim(u, 'hit'); // Skeleton pilot: presentational only, same trigger as the existing flash
  if (u.monsterAnim && u.alive) triggerMonsterAnim(u, u.monsterSprite, 'hit'); // Remaining-five: presentational only, same trigger
  if (u.hitFlashTimer) clearTimeout(u.hitFlashTimer); // flash ซ้อน: ตัวใหม่ทับตัวเก่า ไม่มี timer หลุดมือ
  u.body.material.color.set(colorHex);
  u.hitFlashTimer = setTimeout(() => { u.hitFlashTimer = null; restoreBodyColor(u); }, durationMs);
}
function applyTrait(u, target, dmg) {
  if (u.trait === 'crit' && Math.random() < 0.2) {
    dmg *= 1.8; applyHitFlash(target, 0xffe066, 100);
  } else if (u.trait === 'longshot' && gridDist(u, target) >= 4) { dmg *= 1.3; }
  else if (u.trait === 'slow') {
    target._baseSpeed = target._baseSpeed || target.moveSpeed;
    target.moveSpeed = target._baseSpeed * 0.6;
    clearTimeout(target._slowTimer);
    target._slowTimer = setTimeout(() => { target.moveSpeed = target._baseSpeed; }, 1500);
  } else if (u.trait === 'weaken' && Math.random() < 0.3) {
    target._baseAtk = target._baseAtk || target.pAtk;
    target.pAtk = target._baseAtk * 0.8;
    clearTimeout(target._weakenTimer);
    target._weakenTimer = setTimeout(() => { target.pAtk = target._baseAtk; }, 2000);
  }
  return dmg;
}

// ============================================================
// A* + targeting (เหมือนเดิม)
// ============================================================
function astar(sc, sr, tc, tr, ignoreKey) {
  const open = [{ c:sc, r:sr, g:0, f:0, parent:null }];
  const closed = new Set();
  const h = (c,r) => Math.abs(c-tc)+Math.abs(r-tr);
  open[0].f = h(sc,sr);
  while (open.length) {
    open.sort((a,b)=>a.f-b.f);
    const cur = open.shift();
    if (cur.c===tc && cur.r===tr) { const path=[]; let n=cur; while(n.parent){path.unshift({c:n.c,r:n.r});n=n.parent;} return path; }
    closed.add(key(cur.c,cur.r));
    for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc=cur.c+dc, nr=cur.r+dr;
      if (nc<0||nr<0||nc>=GRID_COLS||nr>=GRID_ROWS||nr===BENCH_ROW) continue; // ห้ามเดินทัพผ่าน/เข้าแถวม้านั่งสำรองเด็ดขาด
      const k = key(nc,nr);
      if (closed.has(k)) continue;
      if (occupied.has(k) && k!==ignoreKey && !(nc===tc&&nr===tr)) continue;
      const g = cur.g+1;
      const exist = open.find(o=>o.c===nc&&o.r===nr);
      if (exist && exist.g<=g) continue;
      if (exist) { exist.g=g; exist.f=g+h(nc,nr); exist.parent=cur; }
      else open.push({ c:nc, r:nr, g, f:g+h(nc,nr), parent:cur });
    }
  }
  return null;
}
function gridDist(a,b) { return Math.abs(a.c-b.c)+Math.abs(a.r-b.r); }
// specialBehavior targeting (monsterPool/bossPool ต้นฉบับจาก Codex) — ผูกไว้เฉพาะมอนสเตอร์ที่มี
// u.specialBehavior เท่านั้น (ฮีโร่ผู้เล่นไม่มีฟิลด์นี้เลย จึงตกลงไปใช้ nearest-target เดิมเสมอ)
// 'ranged' ไม่ต้องแยกเคส เพราะพฤติกรรม "รักษาระยะ+เล็งใกล้สุดในระยะ" ก็คือ nearest-target เดิม
// ผสมกับ d<=atkRange ที่ updateUnit เช็กอยู่แล้ว
function selectTarget(u) {
  const enemies = units.filter((o) => o.alive && o.team !== u.team);
  if (enemies.length === 0) return null;
  const behaviorType = u.specialBehavior && u.specialBehavior.type;
  if (behaviorType === 'hunter') { // Stone Wolf: เล็งศัตรูที่ HP% เหลือน้อยที่สุด
    let best = null, bestRatio = Infinity;
    enemies.forEach((o) => {
      const ratio = o.maxHp ? o.hp / o.maxHp : 0;
      if (ratio < bestRatio) { bestRatio = ratio; best = o; }
    });
    return best;
  }
  if (behaviorType === 'backline' || behaviorType === 'frontline') {
    // แถวศัตรูอยู่บน (r น้อย) แถวผู้เล่นอยู่ล่าง (r มาก) — แนวหน้า = r น้อยสุดในกลุ่มเป้าหมาย,
    // แนวหลัง = r มากสุด (Shadow Assassin พุ่งเจาะแนวหลัง / Orc Brute เข้าปะทะแนวหน้า)
    const rows = enemies.map((o) => o.r);
    const targetRow = behaviorType === 'backline' ? Math.max(...rows) : Math.min(...rows);
    const rowCandidates = enemies.filter((o) => o.r === targetRow);
    let best = null, bd = Infinity;
    rowCandidates.forEach((o) => { const d = gridDist(u, o); if (d < bd) { bd = d; best = o; } });
    return best;
  }
  let best=null, bd=Infinity;
  for (const o of enemies) { const d=gridDist(u,o); if (d<bd){bd=d;best=o;} }
  return best;
}
// ----- Facing: single helper for every horizontal-flip decision (movement + basic attack). -----
// Canonical facing multiplier per motion sprite: 1 = the source art reads as facing right at
// scale.x=+1 (true for every current hero sheet and monster motion set). If a future art set is
// authored facing left, register it here as -1 and it flips in data, not scattered code.
// Post-merge Android QA hotfix v1: real-device testing showed Skeleton facing the wrong way on
// movement/attack — Skeleton's own motion package (skeleton_motion/*) reads canonically left at
// scale.x=+1, opposite the assumption every other current sprite matched. Registering it here
// flips the mapping in data only; setUnitFacing, every other sprite's facing, and movement/attack
// logic are untouched.
const SPRITE_BASE_FACING = { Skeleton: -1 };
// Skeleton Motion Feel Pilot v1: per-sprite near-zero dead-zone (world units). Attack facing
// passes a raw float dx every frame (see updateUnit), so a target sitting almost exactly on the
// unit's own column could alternate the sign by fractions of a pixel and rapid-flip the sprite.
// Movement facing always passes whole-tile deltas (|dirX| >= 1), so it can never be affected.
// Only Skeleton registers a dead-zone — every other unit keeps the exact previous behavior.
// Spirit Archer Attack Facing Pilot v1: same near-zero dead-zone mechanism as Skeleton, applied
// here to kill facing jitter on the (unlocked, between-shot) live target tracking below.
const SPRITE_FACING_DEADZONE = { Skeleton: 0.05, SpiritArcher: 0.05 };
function setUnitFacing(u, dirX) {
  if (!dirX || !u.body) return; // horizontal tie / pure-vertical: keep the last valid facing
  const dz = SPRITE_FACING_DEADZONE[u.sprite];
  if (dz && Math.abs(dirX) < dz) return; // near-tie: keep the last valid facing (no flip jitter)
  const want = (dirX > 0 ? 1 : -1) * (SPRITE_BASE_FACING[u.sprite] || 1);
  if (u.body.scale.x !== want) u.body.scale.x = want; // only flips on a real side change — never churns per frame
}
// The target's pending destination (not its live tile) when it's already mid-step — two mutually-
// chasing melee units both reading each other's live position would each arrive to find the other
// has just relocated, forever "just missing" in a stable back-and-forth loop. Aiming at the
// committed destination instead converges, since that value only changes once per completed step.
function meleeApproachRef(target) {
  return (target.moving && target.moveTo) ? target.moveTo : { c: target.c, r: target.r };
}
// Melee approach-tile picker: enumerates the tiles orthogonally adjacent to the target's approach
// reference (the only tiles where gridDist(.,target)<=1 — matches the Manhattan-distance range
// check in updateUnit exactly, so this never grants diagonal melee range that d<=atkRange didn't
// already allow), keeps ones that are in-bounds/not-bench-row/currently free, then returns
// whichever is reachable via the SAME astar() used for movement with the shortest path (first
// found wins on a tie).
function findMeleeApproachTile(u, target) {
  const ref = meleeApproachRef(target);
  let best = null, bestLen = Infinity;
  for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const c = ref.c+dc, r = ref.r+dr;
    if (c<0||r<0||c>=GRID_COLS||r>=GRID_ROWS||r===BENCH_ROW) continue;
    if (occupied.has(key(c,r))) continue;
    const path = astar(u.c, u.r, c, r, key(u.c,u.r));
    if (path && path.length < bestLen) { bestLen = path.length; best = { c, r }; }
  }
  return best;
}
// Ring-2 staging picker: every free, reachable tile at Manhattan distance exactly 2 from the
// target's approach reference. When all four attack tiles are taken (typical around a lone boss),
// a melee unit queues here — close enough to slide into an attack tile the moment one opens —
// instead of holding position across the board. Grants no attack range (d==2 never satisfies the
// d<=1 range check); shares astar() and first-found-wins-on-tie with findMeleeApproachTile, so
// tie-breaking stays deterministic. Fixed enumeration order: dc from -2..2, negative dr first.
function findMeleeStagingTile(u, target) {
  const ref = meleeApproachRef(target);
  let best = null, bestLen = Infinity;
  for (let dc = -2; dc <= 2; dc++) {
    const adr = 2 - Math.abs(dc);
    for (const dr of (adr === 0 ? [0] : [-adr, adr])) {
      const c = ref.c+dc, r = ref.r+dr;
      if (c<0||r<0||c>=GRID_COLS||r>=GRID_ROWS||r===BENCH_ROW) continue;
      if (c === u.c && r === u.r) return { c, r }; // already staged on a ring tile (own tile reads as occupied) — stay put
      if (occupied.has(key(c,r))) continue;
      const path = astar(u.c, u.r, c, r, key(u.c,u.r));
      if (path && path.length < bestLen) { bestLen = path.length; best = { c, r }; }
    }
  }
  return best;
}
// Retarget fallback when the current melee target is fully unreachable (no free attack tile AND
// no free staging tile): nearest living enemy that IS reachable by either ring. Stable sort keeps
// insertion order on equal distances, so the pick is deterministic.
function findBestReachableEnemy(u) {
  const foes = units.filter((o) => o.alive && o.team !== u.team).sort((a, b) => gridDist(u, a) - gridDist(u, b));
  for (const foe of foes) {
    if (findMeleeApproachTile(u, foe) || findMeleeStagingTile(u, foe)) return foe;
  }
  return null;
}
function stepToward(u, target) {
  // A unit already mid-step must finish that step before picking a new destination.
  if (u.moving) return;
  // Melee units (atkRange<=1) must never path straight at the target's own occupied tile — that's
  // what let two opposing melee units cross/swap/oscillate near each other. Aim for a free
  // adjacent attack-position tile instead. Ranged units are unaffected (they already stop
  // advancing the moment d<=atkRange, so they never need to reach the target's tile).
  const atkRange = u.combatStats ? u.combatStats.attack_range : u.range;
  let goalC = target.c, goalR = target.r;
  if (atkRange <= 1) {
    // Commit to the chosen approach tile and keep pursuing it instead of recomputing every step —
    // recomputing against the target's live position each frame let two melee units closing on
    // each other repeatedly retarget away from and back toward the same tiles (a moving target's
    // own in-flight destination briefly looks "occupied" to findMeleeApproachTile, so the picker
    // would flip to a farther tile, then flip back once the target settled). Only re-pick when the
    // target changed or the cached tile is no longer within melee range of the target.
    let goal = u.approachGoal;
    if (!goal || u.approachGoalFor !== target || gridDist(goal, meleeApproachRef(target)) > 1) goal = findMeleeApproachTile(u, target);
    // All four attack tiles taken/unreachable -> queue on the ring-2 staging band instead of
    // holding position far away. A staging goal is never cached past this call: its gridDist to
    // the ref is 2, so the re-pick condition above re-runs findMeleeApproachTile next time and
    // the staged unit advances into a real attack tile the moment one opens (e.g. a unit died).
    if (!goal) goal = findMeleeStagingTile(u, target);
    if (!goal) {
      u.approachGoal = null; u.approachGoalFor = null;
      // Target fully unreachable (boxed in) — if some other living enemy IS reachable, switch to
      // it rather than idling forever against a wall; the lock in updateUnit keeps the new target.
      const alt = findBestReachableEnemy(u);
      if (alt && alt !== target) u.current_target = alt;
      return;
    }
    u.approachGoal = goal; u.approachGoalFor = target;
    goalC = goal.c; goalR = goal.r;
  } else {
    u.approachGoal = null; u.approachGoalFor = null;
  }
  const path = astar(u.c, u.r, goalC, goalR, key(u.c,u.r));
  if (path && path.length>0) {
    const next = path[0], nk = key(next.c,next.r);
    if (!occupied.has(nk)) {
      occupied.delete(key(u.c,u.r)); occupied.add(nk);
      u.moving=true; u.moveT=0; u.moveFrom={c:u.c,r:u.r}; u.moveTo=next;
      setUnitFacing(u, next.c - u.c); // vertical step (dirX 0) keeps the last valid facing
    }
  }
}
// ============================================================
// SKILL / MANA / STATUS EFFECTS — mana economy, the priority state machine, and the Skill
// Execution Engine that reads SKILL_DEFS (tier-1 heroes only; tier-2 falls back to the old
// spend-mana-no-effect stub below). Data + logic only — no skill UI/VFX.
// ============================================================
const MANA_PER_ATTACK = 10;
const MANA_PER_DAMAGE_TAKEN = 5; // "damage taken" mana gain — DoT ticks opt out via status.grants_mana
const MANA_PER_KILL = 10;
const SKILL_CAST_DURATION = 0.6; // fallback cast time for any hero with no SKILL_DEFS entry (tier-2)
// Only units created via placeHeroAt carry the mana/skill fields (u.current_mana !== undefined) —
// enemies/bosses never do, so they fall through untouched, same convention as combatStats.
function grantMana(u, amount) {
  if (u.current_mana === undefined) return;
  u.current_mana = Math.max(0, Math.min(u.max_mana, u.current_mana + amount));
  updateManaBar(u);
}
function hasHardCC(u) {
  return !!(u.statuses && u.statuses.some((s) => s.kind === 'stun' || s.kind === 'freeze'));
}
// Silence (Inquisitor) is a soft CC: it only blocks starting a NEW cast, unlike hard CC which
// also interrupts attack/movement — an in-progress cast is not interrupted by silence landing.
function hasSilence(u) {
  return !!(u.statuses && u.statuses.some((s) => s.status_id === 'silence'));
}
// Enemies/bosses use the legacy `armor` (%) stat instead of combatStats.p_def — a `p_def_pct`
// status modifier (e.g. Fighter's Power Strike) is applied here as the closest equivalent so
// hero debuffs still do something against monsters without touching their base data.
function getEffectiveArmor(target) {
  if (target.armor == null) return null;
  let armor = target.armor;
  (target.statuses || []).forEach((st) => {
    if (st.modifiers && st.modifiers.p_def_pct != null) armor *= (1 + st.modifiers.p_def_pct / 100);
  });
  return Math.max(0, armor);
}
// move_speed slows/hastes apply to ANY unit (hero or enemy) since both data shapes carry a
// move-speed value. buildCombatStats() deliberately EXCLUDES move_speed_pct from its own fold
// (see the statKey !== 'move_speed' guards there) so this stays the single source of truth and
// never double-applies for heroes.
function getEffectiveMoveSpeed(u) {
  let speed = u.combatStats ? u.combatStats.move_speed : u.moveSpeed;
  (u.statuses || []).forEach((st) => {
    if (st.modifiers && st.modifiers.move_speed_pct != null) speed *= (1 + st.modifiers.move_speed_pct / 100);
  });
  return Math.max(0, speed);
}
// attack_speed, unlike move_speed, IS folded into combatStats by buildCombatStats (heroes only
// — that's already the single source of truth there), so this only needs its own live status
// scan for enemies/summons, which never get a combatStats object built for them at all.
function getEffectiveAttackSpeed(u) {
  if (u.combatStats) return u.combatStats.attack_speed;
  let speed = u.atkSpeed;
  (u.statuses || []).forEach((st) => {
    if (st.modifiers && st.modifiers.attack_speed_pct != null) speed *= (1 + st.modifiers.attack_speed_pct / 100);
  });
  return Math.max(0.1, speed);
}
// Recompute a hero's combatStats immediately after its statuses change (equipment never
// changes mid-battle, but status durations do) — no-op for units without baseStats (enemies).
function refreshCombatStats(u) {
  if (u.baseStats) buildCombatStats(u, ITEM_DEFS_BY_ID);
}
// Re-run buildCombatStats after an hp change ONLY if the unit actually has a conditional_modifiers
// status active (e.g. Berserker's Blood Frenzy) — otherwise hp changes have no bearing on stats.
function onHpChanged(u) {
  if (u.baseStats && (u.statuses || []).some((s) => s.conditional_modifiers)) refreshCombatStats(u);
}
// tracks player-team deaths for the CURRENT wave/battle only (Priest's most_recent_dead_ally) —
// reset in startBattleBtn.onclick, entries removed again once a unit is revived.
let deadAlliesThisWave = [];
// Centralizes what happens when any unit's HP reaches 0, regardless of the damage source
// (basic attack / skill / DoT tick) — kill-mana for the killer, and Merchant's mark payout.
function handleUnitDeath(target, killer) {
  if (!target.alive) return;
  target.alive = false;
  occupied.delete(key(target.c, target.r));
  restoreBodyColor(target); // ตายกลาง hit-flash: คืนสีฐานก่อนเริ่ม death fade ไม่ให้ศพค้างสีส้มแดง
  target.deathT = 0;
  if (target.skelAnim) triggerSkeletonAnim(target, 'death'); // Skeleton pilot: play Death frames; existing deathT fade is delayed until it finishes (see animate())
  if (target.monsterAnim) triggerMonsterAnim(target, target.monsterSprite, 'death'); // Remaining-five: same Death-before-fade contract
  if (target.team === 'player' && target.baseStats) deadAlliesThisWave.push(target); // real heroes only, not summons
  if (killer) grantMana(killer, MANA_PER_KILL);
  const mark = (target.statuses || []).find((s) => s.rewardOnDeath);
  if (mark) {
    const r = mark.rewardOnDeath;
    const casterOk = !r.requiresCasterAlive || (r.casterRef && r.casterRef.alive);
    if (casterOk && (r.casterRef.skillGoldTriggers || 0) < r.maxTriggers) {
      gold += r.gold;
      r.casterRef.skillGoldTriggers = (r.casterRef.skillGoldTriggers || 0) + 1;
    }
  }
}
// A unit's shield (Knight's Guardian's Challenge, Priest's heal overflow) absorbs damage before
// HP — call this on every damage source (skills/DoT already route through dealSkillDamage below;
// basic attacks apply it inline since they have their own hit-flash/knockback flourish).
function absorbWithShield(target, dmg) {
  if (target.shield > 0 && dmg > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }
  return dmg;
}
// Shared damage-resolution path for skill damage_payload hits and DoT ticks (Synergy System
// penetration/reflect + shield absorption + invulnerability + hp-bar update + death handling) —
// kept separate from the basic-attack block, which has its own hit-flash/knockback flourish.
function dealSkillDamage(casterTeam, damageType, rawDmg, target, casterRef, grantsMana, armorPenPct) {
  if (!target.alive) return 0;
  if ((target.statuses || []).some((s) => s.invulnerable)) return 0; // Priest's revive grace period
  let dmg = applySynergyDamageModifiers(rawDmg, { team: casterTeam, attackType: damageType }, target, armorPenPct);
  dmg = absorbWithShield(target, dmg);
  target.hp -= dmg;
  target.hpBar.scale.x = Math.max(0, target.hp/target.maxHp);
  target.hpBar.position.x = -0.36*(1-target.hpBar.scale.x);
  if (grantsMana) grantMana(target, MANA_PER_DAMAGE_TAKEN);
  onHpChanged(target);
  applyReflectDamage(target, dmg, casterRef, damageType);
  if (target.hp <= 0) handleUnitDeath(target, casterRef);
  return dmg;
}

// ---- status effect application + DoT ticking ----
function statusMagnitude(status) {
  return Object.values(status.modifiers || {}).reduce((sum, v) => sum + Math.abs(v), 0);
}
function applyStatusEffectToUnit(target, se, caster) {
  target.statuses = target.statuses || [];
  const isDot = !!se.tick_interval;
  const newStatus = {
    status_id: se.status_id,
    kind: se.kind || (isDot ? 'dot' : (Object.values(se.modifiers || {}).some((v) => v < 0) ? 'debuff' : 'buff')),
    modifiers: se.modifiers ? { ...se.modifiers } : undefined,
    conditional_modifiers: se.conditional_modifiers ? se.conditional_modifiers.map((cm) => ({ ...cm })) : undefined,
    on_basic_attack_payload: se.on_basic_attack_payload || undefined,
    remaining: se.duration,
    casterRef: caster, // also doubles as "who applied this" for taunt's forced-target lookup
  };
  if (isDot) {
    newStatus.tick_interval = se.tick_interval;
    newStatus.tickTimer = se.tick_interval;
    newStatus.grants_mana = !!se.grants_mana;
    newStatus.casterTeam = caster.team;
    newStatus.tickDamageType = se.damage_per_tick.damage_type;
    const cs = caster.combatStats || {};
    newStatus.tickDamageAmount = (se.damage_per_tick.p_atk_multiplier || 0) * (cs.p_atk || 0)
      + (se.damage_per_tick.m_atk_multiplier || 0) * (cs.m_atk || 0) + (se.damage_per_tick.base_damage || 0);
  }
  const idx = target.statuses.findIndex((s) => s.status_id === se.status_id);
  if (idx < 0) {
    target.statuses.push(newStatus);
  } else if (se.stack_rule === 'strongest') {
    if (statusMagnitude(newStatus) >= statusMagnitude(target.statuses[idx])) target.statuses[idx] = newStatus;
  } else { // 'refresh'/'unique' (default) — replace with the fresh instance
    target.statuses[idx] = newStatus;
  }
  refreshCombatStats(target);
  if (newStatus.kind === 'stun' || newStatus.kind === 'freeze') spawnFloatingText(target, 'Stun!', '#ff5555');
}
function applyDamageTick(target, st) {
  if (!target.alive) return;
  dealSkillDamage(st.casterTeam, st.tickDamageType, st.tickDamageAmount, target, st.casterRef, st.grants_mana);
}
// Runs every frame for every living unit: advances DoT ticks, status durations (a `remaining`
// of exactly -1 marks a persistent/aura-driven status with no timer, e.g. Beast Lord's "while
// summon alive" buff — that one is removed by updateSummonAuras(), not a countdown here), and
// the shield timer — dropping expired statuses/shield and refreshing combatStats when they change.
function tickStatuses(u, dt) {
  if (u.shieldTimer > 0) { u.shieldTimer -= dt; if (u.shieldTimer <= 0) { u.shield = 0; u.shieldTimer = 0; } }
  if (!u.statuses || u.statuses.length === 0) return;
  let expired = false;
  for (let i = u.statuses.length - 1; i >= 0; i--) {
    const st = u.statuses[i];
    if (st.tick_interval) {
      st.tickTimer -= dt;
      if (st.tickTimer <= 0) { st.tickTimer += st.tick_interval; applyDamageTick(u, st); }
    }
    if (st.remaining < 0) continue; // persistent (aura-linked) status — no timer expiry
    st.remaining -= dt;
    if (st.remaining <= 0) { u.statuses.splice(i, 1); expired = true; }
  }
  if (expired) refreshCombatStats(u);
}

// ---- targeting resolvers (per skill target_type) ----
function findFarthestEnemy(caster) {
  let best = null, bd = -1;
  units.forEach((o) => { if (!o.alive || o.team === caster.team) return; const d = gridDist(caster, o); if (d > bd) { bd = d; best = o; } });
  return best;
}
// Steps grid tiles from the caster toward `aim` (Bresenham-ish, rounded) up to lineLength,
// collecting living enemies it passes through — the "pierce" line for Archer's Piercing Arrow
// (and Beast Lord's dragon special attack, and Blade Master-style line AoEs).
function collectLineTargets(caster, aim, lineLength, maxTargets) {
  const dx = aim.c - caster.c, dy = aim.r - caster.r;
  const dist = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const stepC = dx / dist, stepR = dy / dist;
  const seen = new Set(), hits = [];
  for (let step = 1; step <= lineLength && hits.length < maxTargets; step++) {
    const c = Math.round(caster.c + stepC*step), r = Math.round(caster.r + stepR*step);
    const k = c + ',' + r;
    if (seen.has(k)) continue;
    seen.add(k);
    const found = units.find((o) => o.alive && o.team !== caster.team && o.c === c && o.r === r);
    if (found) hits.push(found);
  }
  return hits;
}
function findClusterCenter(caster) {
  const enemies = units.filter((o) => o.alive && o.team !== caster.team);
  let best = null, bestCount = -1;
  enemies.forEach((e) => {
    const count = enemies.reduce((n, o) => n + ((o !== e && gridDist(e, o) <= 1) ? 1 : 0), 0);
    if (count > bestCount) { bestCount = count; best = e; }
  });
  return best;
}
function findHighestMaxHpEnemy(caster) {
  const enemies = units.filter((o) => o.alive && o.team !== caster.team);
  if (!enemies.length) return null;
  return enemies.reduce((best, o) => (o.maxHp > best.maxHp ? o : best));
}
// Returns an ARRAY (unlike every other resolver here) sorted nearest-first — Ranger's Triple
// Volley fires `projectile_count` shots at this list, repeating targets if allow_repeat_target
// and fewer than that many distinct enemies are actually in range.
function findThreeNearestEnemiesInRange(caster) {
  const atkRange = caster.combatStats ? caster.combatStats.attack_range : caster.range;
  const inRange = units.filter((o) => o.alive && o.team !== caster.team && gridDist(o, caster) <= atkRange)
    .sort((a, b) => gridDist(a, caster) - gridDist(b, caster));
  return inRange.length ? inRange : null;
}
function findAdjacentEmptyTile(caster) {
  const dirs = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
  for (const [dc,dr] of dirs) {
    const c = caster.c+dc, r = caster.r+dr;
    if (c<0||r<0||c>=GRID_COLS||r>=GRID_ROWS||r===BENCH_ROW) continue; // ห้าม summon ลงแถวม้านั่งสำรอง
    if (!occupied.has(key(c,r))) return { c, r };
  }
  return null;
}
function findLowestHpAlly(caster, healPayload) {
  const pool = units.filter((o) => o.alive && o.team === caster.team
    && (healPayload.can_target_self !== false || o !== caster)
    && !(healPayload.exclude_full_hp_targets && o.hp >= o.maxHp));
  if (pool.length === 0) return null;
  return pool.reduce((low, o) => (o.hp/o.maxHp < low.hp/low.maxHp ? o : low));
}
function findLowestHpEnemy(caster) {
  const enemies = units.filter((o) => o.alive && o.team !== caster.team);
  if (enemies.length === 0) return null;
  return enemies.reduce((low, o) => (o.hp/o.maxHp < low.hp/low.maxHp ? o : low));
}
// most_recent_dead_ally (Priest's revive redirect) — last player-team death this wave, or null.
function findMostRecentDeadAlly(caster) {
  for (let i = deadAlliesThisWave.length - 1; i >= 0; i--) {
    if (deadAlliesThisWave[i].team === caster.team) return deadAlliesThisWave[i];
  }
  return null;
}
function resolveSkillTarget(caster, skillDef) {
  switch (skillDef.target_type) {
    case 'current_target':
    case 'current_target_front_arc':
      return (caster.current_target && caster.current_target.alive) ? caster.current_target : selectTarget(caster);
    case 'self':
    case 'self_aoe_radius_3':
      return caster;
    case 'farthest_enemy': return findFarthestEnemy(caster);
    case 'largest_enemy_cluster': return findClusterCenter(caster);
    case 'highest_max_hp_enemy': return findHighestMaxHpEnemy(caster);
    case 'three_nearest_enemies_in_range': return findThreeNearestEnemiesInRange(caster);
    case 'adjacent_empty_tile': return findAdjacentEmptyTile(caster);
    case 'most_recent_dead_ally': return findMostRecentDeadAlly(caster);
    case 'lowest_hp_ally': {
      // Priest: normally heals the lowest-% ally, but redirects to reviving the most recently
      // dead ally when trigger_condition (no valid injured ally + a dead ally exists) is met.
      const healTarget = findLowestHpAlly(caster, skillDef.heal_payload || {});
      if (healTarget) return healTarget;
      if (skillDef.revive_payload && skillDef.revive_payload.enabled) {
        const dead = findMostRecentDeadAlly(caster);
        if (dead && (caster.reviveUsesThisWave || 0) < skillDef.revive_payload.uses_per_wave) return dead;
      }
      return null;
    }
    case 'lowest_hp_enemy': return findLowestHpEnemy(caster);
    default: return (caster.current_target && caster.current_target.alive) ? caster.current_target : selectTarget(caster);
  }
}

// ---- payload execution ----
function computeArmorPenPct(payload, distance) {
  if (payload.armor_penetration_pct != null) return payload.armor_penetration_pct;
  if (payload.armor_penetration) {
    const ap = payload.armor_penetration;
    const total = (ap.base_pct || 0) + (ap.bonus_pct_per_tile || 0) * distance;
    return ap.max_total_pct != null ? Math.min(ap.max_total_pct, total) : total;
  }
  return 0;
}
function computeDistanceScalingMult(payload, distance) {
  if (!payload.distance_scaling) return 1;
  const ds = payload.distance_scaling;
  const bonusPct = (ds.bonus_damage_pct_per_tile || 0) * distance;
  return 1 + (ds.max_bonus_damage_pct != null ? Math.min(ds.max_bonus_damage_pct, bonusPct) : bonusPct) / 100;
}
function evaluateDamageCondition(condition, caster, target) {
  if (condition === 'target_current_hp_greater_than_caster_current_hp') return target.hp > caster.hp;
  return false;
}
function resolveDamageTargets(caster, skillDef, primary) {
  const payload = skillDef.damage_payload;
  const maxT = payload.max_targets || 1;
  if (!primary) return [];
  if (payload.area_shape === 'line' && payload.pierces_targets) {
    const hits = collectLineTargets(caster, primary, payload.line_length || maxT, maxT);
    return hits.map((unit, idx) => ({ unit, mult: Math.max(payload.minimum_damage_multiplier ?? 0,
      1 - (payload.damage_falloff_per_target_pct || 0)/100 * idx) }));
  }
  if (payload.area_shape === 'circle') {
    return units.filter((o) => o.alive && o.team !== caster.team && gridDist(o, primary) <= (payload.area_radius || 1))
      .slice(0, maxT).map((unit) => ({ unit, mult: 1 }));
  }
  if (payload.area_shape === 'front_arc') {
    return units.filter((o) => o.alive && o.team !== caster.team && gridDist(o, primary) <= (payload.area_range || 1))
      .sort((a,b) => gridDist(a,primary) - gridDist(b,primary)).slice(0, maxT).map((unit) => ({ unit, mult: 1 }));
  }
  return [{ unit: primary, mult: 1 }];
}
// Returns { units: [unique units hit], totalDamage } — totalDamage feeds Inquisitor's
// damage-dealt-sourced team heal, which needs to know how much this cast actually dealt.
function applyDamagePayload(caster, skillDef, primary) {
  const payload = skillDef.damage_payload;
  const cs = caster.combatStats || {};
  const baseRaw = (payload.p_atk_multiplier || 0) * (cs.p_atk || 0) + (payload.m_atk_multiplier || 0) * (cs.m_atk || 0) + (payload.base_damage || 0);
  const affected = [];
  let totalDamage = 0;
  const resolveOneHit = (unit, mult) => {
    if (!unit || !unit.alive) return;
    const distance = gridDist(caster, unit);
    let raw = baseRaw * (mult != null ? mult : 1);
    raw *= computeDistanceScalingMult(payload, distance);
    if (payload.conditional_multiplier && evaluateDamageCondition(payload.conditional_multiplier.condition, caster, unit)) {
      raw *= (1 + payload.conditional_multiplier.bonus_multiplier);
    }
    const armorPenPct = computeArmorPenPct(payload, distance);
    totalDamage += dealSkillDamage(caster.team, payload.damage_type, raw, unit, caster, true, armorPenPct);
    if (payload.execute_threshold_pct != null && unit.alive && (unit.hp / unit.maxHp) * 100 <= payload.execute_threshold_pct) {
      unit.hp = 0;
      handleUnitDeath(unit, caster);
    }
    if (!affected.includes(unit)) affected.push(unit);
  };
  if (Array.isArray(primary)) { // three_nearest_enemies_in_range (Ranger) — repeat-target volley
    const shots = payload.projectile_count || primary.length;
    const mults = payload.repeat_target_multipliers || [];
    for (let i = 0; i < shots; i++) resolveOneHit(primary[i % primary.length], mults[i] != null ? mults[i] : 1);
    return { units: affected, totalDamage };
  }
  resolveDamageTargets(caster, skillDef, primary).forEach(({ unit, mult }) => resolveOneHit(unit, mult));
  return { units: affected, totalDamage };
}
function applyHealPayload(caster, skillDef, target) {
  if (!target || !target.alive) return;
  const payload = skillDef.heal_payload;
  const cs = caster.combatStats || {};
  let healAmt = (payload.m_atk_multiplier || 0) * (cs.m_atk || 0) + (payload.base_heal || 0);
  if (target.team === 'player' && synergyBuffs && synergyBuffs.healingReceivedPct) {
    healAmt *= (1 + synergyBuffs.healingReceivedPct / 100); // acolyte synergy: healing_received_pct
  }
  const missing = target.maxHp - target.hp;
  const applied = Math.min(missing, healAmt);
  target.hp += applied;
  target.hpBar.scale.x = Math.max(0, target.hp/target.maxHp);
  target.hpBar.position.x = -0.36*(1-target.hpBar.scale.x);
  const overflow = healAmt - applied;
  if (overflow > 0 && payload.overflow_heal_to_shield_pct) {
    target.shield = (target.shield || 0) + overflow * (payload.overflow_heal_to_shield_pct / 100);
    target.shieldTimer = Math.max(target.shieldTimer || 0, 4); // no explicit duration in the data — reuses the other tier-2 shield's 4s
  }
  if (payload.cleanse_negative_status_count) {
    let toCleanse = payload.cleanse_negative_status_count;
    target.statuses = (target.statuses || []).filter((s) => {
      if (toCleanse > 0 && (s.kind === 'debuff' || s.kind === 'dot')) { toCleanse--; return false; }
      return true;
    });
    refreshCombatStats(target);
  }
  onHpChanged(target);
}
// Inquisitor's Holy Judgment: heals the WHOLE team for a % of the damage this cast just dealt,
// split evenly — a completely different mechanic from the target-based heal_payload above.
function applyDamageBasedHeal(caster, skillDef, damageDealt) {
  const payload = skillDef.heal_payload;
  let totalHeal = damageDealt * ((payload.heal_pct_of_damage || 0) / 100);
  if (caster.team === 'player' && synergyBuffs && synergyBuffs.healingReceivedPct) {
    totalHeal *= (1 + synergyBuffs.healingReceivedPct / 100); // acolyte synergy: healing_received_pct
  }
  const allies = units.filter((o) => o.alive && o.team === caster.team);
  if (!allies.length || totalHeal <= 0) return;
  const share = totalHeal / allies.length;
  allies.forEach((a) => {
    a.hp = Math.min(a.maxHp, a.hp + share);
    a.hpBar.scale.x = Math.max(0, a.hp/a.maxHp);
    a.hpBar.position.x = -0.36*(1-a.hpBar.scale.x);
    onHpChanged(a);
  });
}
function applyShieldPayload(caster, skillDef, target) {
  const payload = skillDef.shield_payload;
  const shieldTarget = payload.target_type === 'self' ? caster : target;
  if (!shieldTarget || !shieldTarget.alive) return;
  const amount = (payload.max_hp_multiplier || 0) * (shieldTarget.maxHp || 0) + (payload.base_shield || 0);
  shieldTarget.shield = (shieldTarget.shield || 0) + amount;
  shieldTarget.shieldTimer = Math.max(shieldTarget.shieldTimer || 0, payload.duration || 0);
}
// Priest's emergency revive: only reachable via the lowest_hp_ally -> dead-ally redirect above.
function applyRevivePayload(caster, skillDef, deadUnit) {
  const payload = skillDef.revive_payload;
  deadUnit.alive = true;
  deadUnit.hp = Math.max(1, Math.round(deadUnit.maxHp * (payload.revive_hp_pct / 100)));
  if (deadUnit.current_mana !== undefined) deadUnit.current_mana = Math.round((deadUnit.max_mana || 100) * ((payload.revive_mana_pct || 0) / 100));
  updateManaBar(deadUnit);
  deadUnit.hpBar.visible = true;
  deadUnit.hpBar.scale.x = Math.max(0, deadUnit.hp/deadUnit.maxHp);
  deadUnit.hpBar.position.x = -0.36*(1-deadUnit.hpBar.scale.x);
  deadUnit.body.material.opacity = 1; deadUnit.body.rotation.z = 0;
  deadUnit.group.visible = true; deadUnit.group.children[2].visible = true;
  deadUnit.shadow.material.opacity = 0.35;
  deadUnit.deathT = undefined;
  occupied.add(key(deadUnit.c, deadUnit.r));
  deadUnit.statuses = deadUnit.statuses || [];
  deadUnit.statuses.push({ status_id: 'revive_invulnerability', kind: 'buff', remaining: payload.invulnerability_duration || 0, invulnerable: true });
  caster.reviveUsesThisWave = (caster.reviveUsesThisWave || 0) + 1;
  const idx = deadAlliesThisWave.indexOf(deadUnit);
  if (idx >= 0) deadAlliesThisWave.splice(idx, 1);
}
// Trickster's Loaded Dice: steals the strongest positive buff from a hit enemy onto itself.
function applyBuffStealPayload(caster, skillDef, hitEnemies) {
  const payload = skillDef.buff_steal_payload;
  if (!payload || !payload.enabled) return;
  let bestEnemy = null, bestStatus = null, bestMag = -1;
  hitEnemies.forEach((e) => {
    (e.statuses || []).forEach((s) => {
      if (s.kind !== 'buff') return;
      if ((payload.excluded_status_tags || []).includes(s.status_id)) return;
      const mag = statusMagnitude(s);
      if (mag > bestMag) { bestMag = mag; bestEnemy = e; bestStatus = s; }
    });
  });
  if (!bestStatus) return;
  if (payload.remove_from_target) {
    bestEnemy.statuses = bestEnemy.statuses.filter((s) => s !== bestStatus);
    refreshCombatStats(bestEnemy);
  }
  if (payload.apply_to_caster) {
    caster.statuses = caster.statuses || [];
    caster.statuses.push({ ...bestStatus, modifiers: bestStatus.modifiers ? { ...bestStatus.modifiers } : undefined });
    refreshCombatStats(caster);
  }
}
function applySummonPayload(caster, skillDef, tile) {
  const payload = skillDef.summon_payload;
  const existing = units.find((o) => o.alive && o.summonerId === caster.instanceId);
  if (existing) {
    if (payload.if_summon_exists === 'heal_existing_summon') {
      existing.hp = Math.min(existing.maxHp, existing.hp + existing.maxHp * (payload.existing_summon_heal_pct_max_hp/100));
      existing.hpBar.scale.x = Math.max(0, existing.hp/existing.maxHp);
      existing.hpBar.position.x = -0.36*(1-existing.hpBar.scale.x);
    }
    return;
  }
  if (!tile) return; // no room around the caster — skip this cast's summon, mana is still spent
  const cs = caster.combatStats || {};
  let hp = Math.max(1, Math.round((cs.hp || caster.maxHp || 0) * (payload.hp_multiplier || 1)));
  let atk = Math.round((cs.m_atk || 0) * (payload.attack_stat_multiplier || 1));
  if (caster.team === 'player' && synergyBuffs) { // summoner synergy: summon_max_hp_pct/summon_damage_pct
    if (synergyBuffs.summonMaxHpPct) hp = Math.round(hp * (1 + synergyBuffs.summonMaxHpPct / 100));
    if (synergyBuffs.summonDamagePct) atk = Math.round(atk * (1 + synergyBuffs.summonDamagePct / 100));
  }
  const isMagic = payload.attack_type === 'magic';
  const u = makeUnit({
    team: caster.team, name: 'Spirit Familiar', sprite: caster.sprite, c: tile.c, r: tile.r,
    hp, pAtk: isMagic ? 0 : atk, mAtk: isMagic ? atk : 0, pDef: 0, mDef: 0,
    attackType: payload.attack_type || 'magic', atkSpeed: payload.attack_speed || 1,
    range: payload.attack_range || 1, moveSpeed: payload.move_speed || 2,
    summonerId: caster.instanceId, isSummon: true,
  });
  u.baseMaxHp = hp;
  if (payload.special_attack) { u.specialAttack = payload.special_attack; u.specialAttackCounter = 0; } // Beast Lord's dragon
}
function applyRewardPayload(caster, skillDef, target) {
  if (!target) return;
  const payload = skillDef.reward_payload;
  target.statuses = target.statuses || [];
  target.statuses.push({ status_id: 'merchant_mark', kind: 'debuff', remaining: payload.mark_duration,
    rewardOnDeath: { casterRef: caster, gold: payload.gold_on_marked_target_death,
      maxTriggers: payload.max_gold_triggers_per_wave, requiresCasterAlive: payload.requires_caster_alive } });
}
// Aura statuses that persist "while a specific summon is alive" (Beast Lord) don't apply through
// the normal per-target status loop — they're registered once per caster and (de)applied to every
// living ally whenever the summon's alive/dead state flips, via updateSummonAuras() each frame.
let summonAuras = [];
function registerSummonAuraIfNeeded(caster, se) {
  if (summonAuras.some((a) => a.caster === caster && a.se.status_id === se.status_id)) return;
  summonAuras.push({ caster, se, active: false });
}
function updateSummonAuras() {
  summonAuras.forEach((entry) => {
    const summon = units.find((u) => u.isSummon && u.summonerId === entry.caster.instanceId && u.alive);
    const shouldBeActive = !!summon;
    if (shouldBeActive === entry.active) return;
    entry.active = shouldBeActive;
    const allies = placedUnits.filter((u) => u.alive);
    if (shouldBeActive) {
      allies.forEach((a) => applyStatusEffectToUnit(a, entry.se, entry.caster));
    } else {
      allies.forEach((a) => {
        a.statuses = (a.statuses || []).filter((s) => s.status_id !== entry.se.status_id);
        refreshCombatStats(a);
      });
    }
  });
}
// ============================================================
// BOSS COOLDOWN SKILLS (from Codex's Skill & Status Effect Engine spec, converted to run on
// this game's existing status/damage pipeline — bossSkillId is set per-boss in bossWave()).
// Reuses applyStatusEffectToUnit/statuses/dealSkillDamage/hasHardCC exactly like hero skills do,
// instead of Codex's separate unit.runtime state model, so bosses interact correctly with
// everything already built on top of the existing pipeline (Synergy System reflect/penetration,
// shields, taunt-forces-target, etc).
// ============================================================
const BOSS_SKILLS = {
  // Stage 5 miniboss pool (Golem/Orc Warlord — see STAGE5_MINIBOSS_POOL): yanks aggro from
  // everyone in range, then tanks better for a few seconds — "damage reduction" is approximated
  // via a temporary armor-% boost (this engine's enemy defense is a single %-mitigation stat,
  // not a separate flat "incoming damage reduction").
  area_taunt:  { name:"Miniboss Challenge", cooldown:8, castTime:0.6, range:3, tauntDuration:2.5, armorPctBonus:60, armorBonusDuration:2.5 },
  // Stage 10 miniboss pool (Bone Dragon/Lich King — see STAGE10_MINIBOSS_POOL): cone-shaped
  // magic breath in front of whichever hero it's nearest to.
  cone_breath: { name:'Miniboss Breath', cooldown:7, castTime:0.8, range:3, coneWidth:0.65, damageMultiplier:1.5, attackType:'magic' },
  // Stage 15 fixed boss (Arena Overlord): curses a random hero's defenses for several seconds.
  arena_curse: { name:'Arena Curse', cooldown:9, castTime:0.7, targetCount:1, defensePct:-30, duration:5 },
};
function getNearestPlayerUnit(source, candidates) {
  let best = null, bd = Infinity;
  candidates.forEach((h) => { const d = gridDist(source, h); if (d < bd) { bd = d; best = h; } });
  return best;
}
// Cone check in this engine's own c/r grid space (Codex's version used row/col — same math).
function getUnitsInCone(caster, aimTarget, candidates, range, coneWidth) {
  if (!aimTarget) return [];
  const dr = aimTarget.r - caster.r, dc = aimTarget.c - caster.c;
  const len = Math.hypot(dr, dc);
  if (len === 0) return [];
  const ndr = dr / len, ndc = dc / len;
  return candidates.filter((u) => {
    if (!u.alive) return false;
    const or_ = u.r - caster.r, oc = u.c - caster.c;
    const dist = Math.hypot(or_, oc);
    if (dist <= 0 || dist > range) return false;
    const dot = ndr * (or_ / dist) + ndc * (oc / dist);
    return dot >= 1 - coneWidth;
  });
}
// เรียกทุกเฟรมสำหรับบอสทุกตัวที่มี bossSkillId (Arena Warden/Bone Dragon/Immortal Champion เท่านั้น
// — มินิบอสคุ้มกันธรรมดา (Skeleton Guard/Golem/Spirit Archer) ไม่มีฟิลด์นี้ จึงข้ามไปเงียบๆ)
function updateBossSkills(bosses, heroes, dt) {
  bosses.forEach((boss) => {
    if (!boss.alive) return;
    const skill = BOSS_SKILLS[boss.bossSkillId];
    if (!skill) return;
    if (!boss.bossSkillState) boss.bossSkillState = { cooldownRemaining: skill.cooldown * 0.5, casting: false, castRemaining: 0 };
    const state = boss.bossSkillState;
    if (hasHardCC(boss)) return; // stunned bosses can't cast either, consistent with heroes
    if (state.casting) {
      state.castRemaining -= dt;
      if (state.castRemaining <= 0) {
        state.casting = false;
        executeBossSkill(boss, boss.bossSkillId, skill, heroes.filter((h) => h.alive));
        state.cooldownRemaining = skill.cooldown;
      }
      return;
    }
    state.cooldownRemaining -= dt;
    if (state.cooldownRemaining > 0) return;
    if (heroes.filter((h) => h.alive).length === 0) return;
    state.casting = true;
    state.castRemaining = skill.castTime;
    spawnFloatingText(boss, skill.name + '!', '#ff8866');
  });
}
function executeBossSkill(boss, skillId, skill, livingHeroes) {
  if (skillId === 'area_taunt') {
    const targets = livingHeroes.filter((h) => gridDist(boss, h) <= skill.range);
    targets.forEach((h) => applyStatusEffectToUnit(h, { status_id:'taunt', kind:'debuff', duration: skill.tauntDuration }, boss));
    applyStatusEffectToUnit(boss, { status_id:'warden_resolve', kind:'buff', duration: skill.armorBonusDuration, modifiers:{ p_def_pct: skill.armorPctBonus } }, boss);
  } else if (skillId === 'cone_breath') {
    const aimTarget = getNearestPlayerUnit(boss, livingHeroes);
    const targets = getUnitsInCone(boss, aimTarget, livingHeroes, skill.range, skill.coneWidth);
    targets.forEach((h) => dealSkillDamage(boss.team, skill.attackType, (boss.pAtk || 0) * skill.damageMultiplier, h, boss, true));
  } else if (skillId === 'arena_curse') {
    const pool = [...livingHeroes];
    const targets = [];
    while (targets.length < skill.targetCount && pool.length > 0) targets.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    targets.forEach((h) => {
      applyStatusEffectToUnit(h, { status_id:'arena_curse', kind:'debuff', duration: skill.duration, modifiers:{ p_def_pct: skill.defensePct, m_def_pct: skill.defensePct } }, boss);
      spawnFloatingText(h, 'Cursed!', '#b060ff');
    });
    // VFX hook: อ่านรายชื่อเป้าหมาย+duration ของสถานะที่ apply ไปแล้ว — ภาพล้วน ไม่แตะ debuff จริง
    spawnVFX('arena_curse', { boss, targets, duration: skill.duration });
  }
}
// Dispatches a skill's status_effects to the right unit(s) per `target_scope` — tier-1 skills
// have no target_scope at all, so the default falls back to the old "every damaged/healed unit"
// behavior for full backward compatibility.
function resolveStatusTargets(se, ctx) {
  switch (se.target_scope) {
    case 'self': return [ctx.caster];
    case 'primary_target': return ctx.primaryTarget && !Array.isArray(ctx.primaryTarget) ? [ctx.primaryTarget] : [];
    case 'damaged_targets': return ctx.damagedUnits || [];
    case 'healed_target': return ctx.healedTarget ? [ctx.healedTarget] : [];
    case 'enemies_in_radius': return units.filter((o) => o.alive && o.team !== ctx.caster.team && gridDist(o, ctx.caster) <= (se.area_radius || 1));
    case 'targets_already_slowed': return (ctx.damagedUnits || []).filter((u) => (u.statuses || []).some((s) => s.status_id === 'slow'));
    default: return ctx.damagedUnits || (ctx.primaryTarget && !Array.isArray(ctx.primaryTarget) ? [ctx.primaryTarget] : []);
  }
}
function executeSkill(caster, skillDef, target) {
  // Priest's revive only ever gets reached via the lowest_hp_ally -> dead-ally redirect —
  // it fully replaces this cast's normal payloads.
  if (skillDef.revive_payload && target && !Array.isArray(target) && !target.alive) {
    applyRevivePayload(caster, skillDef, target);
    return;
  }
  // reward_payload (the "mark") must land BEFORE damage_payload resolves — a killing blow must
  // still count as a death-while-marked, not slip past the reward one step too early.
  if (skillDef.reward_payload && target && !Array.isArray(target)) applyRewardPayload(caster, skillDef, target);
  let affected = [];
  let damageDealt = 0;
  if (skillDef.damage_payload && skillDef.damage_payload.damage_type !== 'none') {
    const res = applyDamagePayload(caster, skillDef, target);
    affected = res.units; damageDealt = res.totalDamage;
  }
  let healTargetRef = null;
  if (skillDef.heal_payload) {
    if (skillDef.heal_payload.source === 'damage_dealt') {
      applyDamageBasedHeal(caster, skillDef, damageDealt);
    } else if (target && !Array.isArray(target)) {
      applyHealPayload(caster, skillDef, target);
      if (target.alive) { healTargetRef = target; if (!affected.includes(target)) affected.push(target); }
    }
  }
  if (skillDef.shield_payload) applyShieldPayload(caster, skillDef, target && !Array.isArray(target) ? target : null);
  if (skillDef.summon_payload) applySummonPayload(caster, skillDef, target);
  if (skillDef.reward_payload && target && !Array.isArray(target) && !affected.includes(target)) affected.push(target);
  if (skillDef.buff_steal_payload) applyBuffStealPayload(caster, skillDef, affected.filter((u2) => u2.team !== caster.team));
  (skillDef.status_effects || []).forEach((se) => {
    if (se.target_scope === 'all_allies_while_summon_alive') { registerSummonAuraIfNeeded(caster, se); return; }
    const targets = resolveStatusTargets(se, { caster, primaryTarget: target, damagedUnits: affected, healedTarget: healTargetRef });
    targets.forEach((u2) => { if (u2 && u2.alive && Math.random() <= (se.chance != null ? se.chance : 1)) applyStatusEffectToUnit(u2, se, caster); });
  });
}
function despawnSummons() {
  units.filter((u) => u.isSummon).forEach(removeUnit);
}
// Spirit Blade's Spirit Edge (on_basic_attack_payload): tag-along bonus damage whenever the
// status owner's basic attack lands — doesn't grant its own "damage taken" mana (the main
// attack already did) to avoid double-counting a single attack event.
function applyOnBasicAttackBonus(attacker, target) {
  (attacker.statuses || []).forEach((st) => {
    if (!st.on_basic_attack_payload || !target.alive) return;
    const p = st.on_basic_attack_payload;
    const cs = attacker.combatStats || {};
    const raw = (p.p_atk_multiplier || 0) * (cs.p_atk || 0) + (p.m_atk_multiplier || 0) * (cs.m_atk || 0) + (p.base_damage || 0);
    dealSkillDamage(attacker.team, p.damage_type, raw, target, attacker, false);
  });
}
// Beast Lord's Spirit Dragon: every 3rd basic attack fires a bonus line AoE instead of/on top
// of the normal hit. The dragon has no combatStats (it's a simplified flat-stat summon like
// Priority 6's Spirit Familiar), so it reads its own camelCase pAtk/mAtk directly.
function triggerSpecialAttack(caster, aimTarget) {
  const sp = caster.specialAttack;
  const hits = sp.area_shape === 'line' ? collectLineTargets(caster, aimTarget, sp.line_length || 2, 99) : [aimTarget];
  const raw = (sp.p_atk_multiplier || 0) * (caster.pAtk || 0) + (sp.m_atk_multiplier || 0) * (caster.mAtk || 0);
  hits.forEach((t) => dealSkillDamage(caster.team, sp.damage_type, raw, t, caster, true));
}

function updateUnit(u, dt) {
  if (!u.alive) return; // 1) Dead Check
  tickStatuses(u, dt); // DoT ticks + status/shield expiry run regardless of what else happens this frame
  if (!u.alive) return; // a DoT tick may have just killed this unit
  if (u.moving) {
    u.moveT += dt*getEffectiveMoveSpeed(u);
    if (u.moveT>=1) { u.moveT=1; u.moving=false; u.c=u.moveTo.c; u.r=u.moveTo.r; }
    const a=gridToWorld(u.moveFrom.c,u.moveFrom.r), b=gridToWorld(u.moveTo.c,u.moveTo.r);
    u.group.position.lerpVectors(a,b,u.moveT);
    u.body.position.y = u.halfH - (u.footLift||0) + Math.abs(Math.sin(u.moveT*Math.PI*2))*0.06;
    updateAnim(u,dt); return;
  }
  u.body.position.y = u.halfH - (u.footLift||0);

  // 2) Hard CC Check (Stun/Freeze)
  if (hasHardCC(u)) {
    if (u.action_state === 'casting') { u.action_state = 'idle'; u.castTimer = 0; u.castTarget = null; } // interrupted — mana untouched, retry once CC clears
    updateAnim(u, dt);
    return;
  }

  // 3) Mana Check -> Skill Cast — resolved independent of whether an enemy attack-target
  // currently exists, since support skills (heal/summon) don't need an enemy at all.
  if (u.current_mana !== undefined) {
    const skillDef = SKILL_DEFS[u.heroKey];
    if (u.action_state === 'casting') {
      // if the target(s) died mid-cast, pick a replacement so the cast doesn't resolve on a corpse
      if (skillDef && u.castTarget) {
        if (Array.isArray(u.castTarget)) {
          if (!u.castTarget.some((t) => t && t.alive)) u.castTarget = resolveSkillTarget(u, skillDef);
        } else if ('alive' in u.castTarget && !u.castTarget.alive) {
          u.castTarget = resolveSkillTarget(u, skillDef);
        }
      }
      u.castTimer -= dt;
      if (u.castTimer <= 0) {
        if (skillDef) {
          executeSkill(u, getScaledSkillDef(u, skillDef), u.castTarget); // Hero Star System: 2★ hits harder/heals more/lasts longer
          // VFX hook (impact): อ่านผลหลัง executeSkill เสร็จแล้วเท่านั้น — ภาพล้วน ไม่แตะผลสกิล
          if (VFX_SKILL_IMPACT[u.heroKey]) spawnVFX(VFX_SKILL_IMPACT[u.heroKey], { caster: u, target: u.castTarget });
          u.current_mana = Math.max(0, u.current_mana - (skillDef.mana_cost || u.max_mana));
        } else {
          u.current_mana = Math.max(0, u.current_mana - u.max_mana); // no skill data yet — spend, no effect
        }
        u.action_state = 'idle';
        u.castTarget = null;
      }
      updateAnim(u, dt);
      return; // casting locks out basic attack + movement for its whole duration
    }
    if (u.current_mana >= u.max_mana && !hasSilence(u)) {
      u.action_state = 'casting';
      u.castTimer = skillDef ? skillDef.cast_time : SKILL_CAST_DURATION;
      u.castTarget = skillDef ? resolveSkillTarget(u, skillDef) : null;
      u.animState = 'attack'; u.animTimer = 0;
      if (skillDef) spawnFloatingText(u, skillDef.skill_name + '!', '#ffe066');
      // VFX hook (cast start): เอฟเฟกต์รวมพลังระหว่างร่าย ยาวเท่า cast time จริง — ภาพล้วน
      if (VFX_SKILL_CAST[u.heroKey]) spawnVFX(VFX_SKILL_CAST[u.heroKey], { caster: u, castTime: u.castTimer });
      updateAnim(u, dt);
      return;
    }
  }

  // Taunt (Knight) forces the taunted unit to keep attacking whoever taunted it, overriding the
  // normal nearest-enemy lock, for as long as the taunt status and its caster remain alive.
  const activeTaunt = (u.statuses || []).find((s) => s.status_id === 'taunt' && s.casterRef && s.casterRef.alive);
  if (activeTaunt) {
    u.current_target = activeTaunt.casterRef;
  } else if (!u.current_target || !u.current_target.alive) {
    u.current_target = selectTarget(u);
  }
  const target = u.current_target;
  if (!target) { updateAnim(u,dt); return; }
  const atkRange = u.combatStats ? u.combatStats.attack_range : u.range;
  const d = gridDist(u,target);

  // 4) Basic Attack
  if (d<=atkRange) {
    u.atkCooldown -= dt;
    if (u.atkCooldown<=0) {
      // archer synergy's attack_speed_pct is already folded into combatStats.attack_speed via
      // buildCombatStats() (heroes only) — getEffectiveAttackSpeed() covers enemies/summons too.
      const baseAtkSpeed = getEffectiveAttackSpeed(u);
      u.atkCooldown = 1/baseAtkSpeed;
      u.animState='attack'; u.animTimer=0;
      if (u.skelAnim) triggerSkeletonAnim(u, 'basic_attack'); // Skeleton pilot: presentational only, fires alongside the existing trigger above, does not change atkCooldown/damage timing
      if (u.monsterAnim) triggerMonsterAnim(u, u.monsterSprite, 'basic_attack'); // Remaining-five: presentational only, does not change atkCooldown/damage timing
      // Spirit Archer Attack Facing Pilot v1: snapshot the target-facing direction at the exact
      // tick the attack commits, so the one-shot basic_attack pose (anticipation/release/
      // recovery) can't flip mid-play if the target dies/is replaced or moves to the opposite
      // side while that pose is still on screen. Presentation-only: does not touch target
      // selection, damage, cooldown, or any other sprite's facing.
      if (u.sprite === 'SpiritArcher' && u.monsterAnim) {
        u.spiritArcherAtkFacingDx = gridToWorld(target.c,target.r).x - u.group.position.x;
      }
      let dmg = applyTrait(u, target, attackerRawAtk(u));
      dmg = applySynergyDamageModifiers(dmg, u, target);
      dmg = (target.statuses || []).some((s) => s.invulnerable) ? 0 : absorbWithShield(target, dmg);
      target.hp -= dmg;
      grantMana(u, MANA_PER_ATTACK);
      if (u.team === 'player' && synergyBuffs && synergyBuffs.manaOnBasicAttackBonus) grantMana(u, synergyBuffs.manaOnBasicAttackBonus);
      grantMana(target, MANA_PER_DAMAGE_TAKEN);
      onHpChanged(target);
      const lifestealPct = u.combatStats ? (u.combatStats.physical_lifesteal || 0) : 0;
      if (lifestealPct > 0 && dmg > 0 && u.attackType !== 'magic') {
        u.hp = Math.min(u.maxHp, u.hp + dmg * (lifestealPct / 100));
        onHpChanged(u);
      }
      const dir = gridToWorld(target.c,target.r).sub(u.group.position).normalize().multiplyScalar(0.12);
      u.body.position.x += dir.x;
      setTimeout(()=>{ if (u.alive) u.body.position.x=0; }, 90);
      applyHitFlash(target, 0xff8866, 80); // คืนสีฐาน (placeholderColor) อัตโนมัติ — รวมกรณีตายกลาง flash
      target.hpBar.scale.x = Math.max(0, target.hp/target.maxHp);
      target.hpBar.position.x = -0.36*(1-target.hpBar.scale.x);
      applyReflectDamage(target, dmg, u, u.attackType);
      if (target.hp<=0) handleUnitDeath(target, u);
      if (target.alive) applyOnBasicAttackBonus(u, target);
      if (u.specialAttack) {
        u.specialAttackCounter = (u.specialAttackCounter || 0) + 1;
        if (u.specialAttackCounter >= 3) { u.specialAttackCounter = 0; triggerSpecialAttack(u, target); }
      }
      // Stone Golem's stun_attack specialBehavior: every Nth basic attack stuns the target
      // (reuses the existing hard-CC status pipeline — hasHardCC() already blocks move+attack).
      if (target.alive && u.specialBehavior && u.specialBehavior.type === 'stun_attack') {
        u.hitCount = (u.hitCount || 0) + 1;
        if (u.hitCount >= (u.specialBehavior.triggerEveryHits || 4)) {
          u.hitCount = 0;
          applyStatusEffectToUnit(target, { status_id:'stun_attack', kind:'stun',
            duration: u.specialBehavior.stunDuration || 1.2, stack_rule:'refresh' }, u);
        }
      }
    }
    // Same facing contract as movement: face the target's horizontal side; on a same-column tie
    // keep the last valid facing (the old ternary forced +1, snapping units to an arbitrary side).
    // Spirit Archer Attack Facing Pilot v1: while the committed basic_attack one-shot pose is
    // still playing, hold the facing snapshot taken at the moment the attack fired instead of
    // recalculating live — this is what prevents a mid-shot facing flip. Every other sprite/state
    // falls through to the exact original live calculation, unchanged.
    const spiritArcherAtkLock = u.sprite === 'SpiritArcher' && u.monsterAnim && u.monsterAnim.state === 'basic_attack';
    setUnitFacing(u, spiritArcherAtkLock ? u.spiritArcherAtkFacingDx : gridToWorld(target.c,target.r).x - u.group.position.x);
  } else stepToward(u, target); // 5) Movement
  updateAnim(u, dt);
}

// ============================================================
// UI — ร้านค้า / ม้านั่ง / ท็อปบาร์
// ============================================================
const goldLabel = document.getElementById('goldLabel');
const waveLabel = document.getElementById('waveLabel');
const levelLabel = document.getElementById('levelLabel');
const expLabel = document.getElementById('expLabel');
const phaseLabel = document.getElementById('phaseLabel');
const shopCardsEl = document.getElementById('shopCards');
const rerollBtn = document.getElementById('rerollBtn');
const startBattleBtn = document.getElementById('startBattleBtn');
document.getElementById('waveTotal').textContent = WAVE_TOTAL;

// ----- Selected-unit action bar: equip/sell/cancel for whichever hero (bench or field) is tapped -----
document.getElementById('selectedUnitEquipBtn').onclick = () => { if (selectedUnit) openEquipModal(selectedUnit); };
document.getElementById('selectedUnitSellBtn').onclick = () => { if (selectedUnit) sellUnit(selectedUnit); };
document.getElementById('selectedUnitCancelBtn').onclick = () => { selectedUnit = null; renderUI(); };

// ----- Shop drawer: hidden by default, slides up over the bench only when toggled -----
const shopDrawerEl = document.getElementById('shopDrawer');
const shopToggleBtn = document.getElementById('shopToggleBtn');
function setShopOpen(open) {
  shopOpen = open;
  shopDrawerEl.classList.toggle('open', open);
  shopToggleBtn.classList.toggle('active', open);
}
let shopOpen = false;
shopToggleBtn.onclick = () => setShopOpen(!shopOpen);
document.getElementById('shopCloseBtn').onclick = () => setShopOpen(false);

// ----- Item bag: collapsible side drawer, hidden by default -----
const inventoryPanelEl = document.getElementById('inventoryPanel');
const bagToggleBtn = document.getElementById('bagToggleBtn');
let bagOpen = false;
bagToggleBtn.onclick = () => {
  bagOpen = !bagOpen;
  inventoryPanelEl.classList.toggle('collapsed', !bagOpen);
  bagToggleBtn.classList.toggle('active', bagOpen);
};

function pickShopOffers() {
  ensureTier2ShopUnlocked();
  const pool = [...ownedPool];
  const offers = [];
  while (offers.length < Math.min(SHOP_ECONOMY.hero_shop.slots, pool.length)) {
    const i = Math.floor(Math.random()*pool.length);
    offers.push(pool.splice(i,1)[0]);
  }
  shopOffers = offers;
  pickItemShopOffers(); // item offers refresh with the hero offers (new wave + reroll) — def ids only, never instances
}
function itemShopCost(itemDefId) {
  return ITEM_DEFS_BY_ID[itemDefId].recipe ? ITEM_SHOP.combined_cost : ITEM_SHOP.base_cost;
}
function pickItemShopOffers() {
  const band = ITEM_SHOP.bands.find((b) => wave >= b.min_wave && wave <= b.max_wave)
    || ITEM_SHOP.bands[ITEM_SHOP.bands.length - 1]; // waves past the table keep the last band's odds
  itemShopOffers = [];
  for (let i = 0; i < ITEM_SHOP.slots; i++) {
    const pool = Math.random() < band.combined_chance ? ITEM_BASE.combined_items : ITEM_BASE.base_items;
    itemShopOffers.push(pool[Math.floor(Math.random() * pool.length)].id);
  }
}
function buyShopItem(offerIdx) {
  if (phase !== 'shop') return false;
  const itemDefId = itemShopOffers[offerIdx];
  if (!itemDefId) return false;
  const cost = itemShopCost(itemDefId);
  if (gold < cost) return false;
  if (playerState.inventory.itemInstanceIds.length >= playerState.inventory.capacity) return false;
  gold -= cost;
  itemShopOffers.splice(offerIdx, 1); // sold-out slot — the single gold deduction above is the only one
  createItemInstance(itemDefId); // existing factory: instance lands in inventory, equippable via the existing flow
  renderUI();
  return true;
}

// ไทยชื่อย่อของ effect key แต่ละตัว ใช้แสดงผลในกล่อง Synergy panel เท่านั้น (ไม่กระทบ logic)
const SYNERGY_EFFECT_LABEL_TH = {
  max_hp_pct:'HP รวม', p_def_flat:'P.Def', p_atk_pct:'P.Atk', physical_reflect_pct:'สะท้อนดาเมจกายภาพ',
  attack_speed_pct:'Attack Speed', p_def_penetration_pct:'เจาะ P.Def', m_atk_pct:'M.Atk',
  m_def_penetration_pct:'เจาะ M.Def', mana_on_basic_attack_bonus:'มานาต่อการโจมตี',
  summon_max_hp_pct:'HP หมัน (Summon)', summon_damage_pct:'ดาเมจหมัน (Summon)',
  healing_received_pct:'การรักษาที่ได้รับ', start_battle_shield_pct_max_hp:'โล่เริ่มด่าน',
  bonus_gold_on_wave_win:'ทองโบนัสเมื่อชนะ', shop_reroll_discount_gold:'ส่วนลดรีโรล', minimum_reroll_cost:'รีโรลขั้นต่ำ',
};
// แผงซ้าย "ทีม Link": ช่อง Portrait 3 ช่อง (ว่าง = "+") + สรุปเฉพาะบัฟที่ทำงานจริง —
// แทนที่รายการอาชีพ 7 แถว 0/3 ของ Auto Synergy เดิมทั้งหมด
function renderLinkPanel() {
  document.getElementById('linkCount').textContent = `(${linkedHeroIds.size}/${MAX_LINKED_HEROES})`;
  const slotsEl = document.getElementById('linkSlots');
  slotsEl.innerHTML = '';
  const linked = getLinkedHeroes();
  for (let i = 0; i < MAX_LINKED_HEROES; i++) {
    const u = linked[i];
    const div = document.createElement('div');
    if (u) {
      const def = HERO_DEFS[u.heroKey];
      const root = getRootClass(u.heroKey);
      div.className = 'linkSlot filled';
      div.innerHTML = `<img src="${heroPortraitSrc(u.heroKey)}">` +
        `<span class="linkClassIcon">${CLASS_ICON_MAP[root] || ''}</span>` +
        (def.class_tier === 2 ? `<span class="linkStar">${'⭐'.repeat(normalizeStarLevel(u.starLevel || 1))}</span>` : '') +
        `<span class="linkName">${def.name}</span>`;
      div.title = `${def.name} — แตะเพื่อถอดออกจาก Link`;
      div.onclick = () => toggleLinkedHero(u.instanceId);
    } else {
      div.className = 'linkSlot';
      div.textContent = '+';
      div.title = 'แตะฮีโร่บนสนามรบเพื่อเพิ่มเข้า Link';
    }
    slotsEl.appendChild(div);
  }
  const buffListEl = document.getElementById('linkBuffList');
  buffListEl.innerHTML = '';
  const classes = getActiveLinkedClasses();
  if (classes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'linkBuffEmpty';
    empty.textContent = `แตะฮีโร่บนสนามรบเพื่อเลือกเข้า Link (สูงสุด ${MAX_LINKED_HEROES} ตัว)`;
    buffListEl.appendChild(empty);
    return;
  }
  classes.forEach((cls) => {
    const def = LINK_CLASS_BUFFS[cls];
    if (!def) return;
    const parts = Object.entries(def.effects).map(([k, v]) => `${SYNERGY_EFFECT_LABEL_TH[k] || k} +${v}${k.endsWith('_pct') ? '%' : ''}`);
    const row = document.createElement('div');
    row.className = 'linkBuffRow';
    row.textContent = `${CLASS_ICON_MAP[cls] || ''} ${def.name}: ${parts.join(', ')}`;
    buffListEl.appendChild(row);
  });
}
// เปิด/ปิดวงแหวนทอง + ป้ายโซ่ 🔗 บนยูนิต 3D ตามสถานะ Link ปัจจุบัน — เรียกทุก renderUI() จึง
// ครอบคลุมทั้ง toggle ปกติ, การย้ายตำแหน่ง (moveUnitTo สร้างยูนิตใหม่แต่ instanceId เดิม), และ
// การหลุดจาก Link อัตโนมัติผ่าน sanitizeLinkedHeroes()
function updateLinkedHeroVisuals() {
  units.forEach((u) => {
    if (!u.linkRing) return;
    const on = linkedHeroIds.has(u.instanceId);
    u.linkRing.visible = on;
    u.linkBadge.visible = on;
  });
}
function renderTeamHpPanel() {
  const listEl = document.getElementById('teamHpList');
  listEl.innerHTML = '';
  placedUnits.forEach((u) => {
    const def = HERO_DEFS[u.heroKey];
    const hpPct = u.maxHp ? Math.max(0, u.hp / u.maxHp) : 0;
    const equipped = u.equipment.some((e) => e);
    const div = document.createElement('div');
    div.className = 'teamHpRow' + (u.alive === false ? ' dead' : '');
    div.innerHTML = `<img src="${heroPortraitSrc(u.heroKey)}">` +
      `<div class="teamHpInfo"><div class="teamHpName">${def.name}${starLabel(u.heroKey, u.starLevel)}</div>` +
      `<div class="teamHpBarTrack"><div class="teamHpBarFill" style="width:${Math.round(hpPct*100)}%"></div></div></div>` +
      `<button class="equipBtn" title="ไอเทม">⚙${equipped ? ' •' : ''}</button>` +
      `<button class="sellBtn" title="ขาย">💰${getSellValue(u.heroKey)}</button>`;
    div.dataset.instanceId = u.instanceId; // read by the item-drag drop-target lookup below
    div.querySelector('.equipBtn').onclick = (e) => { e.stopPropagation(); openEquipModal(u); };
    div.querySelector('.sellBtn').onclick = (e) => { e.stopPropagation(); sellUnit(u); };
    listEl.appendChild(div);
  });
}
// ============================================================
// MONSTER PANEL (ขวาบน) — ศัตรูของ "เวฟปัจจุบัน" จัดกลุ่มตามชนิด (sprite): portrait + ชื่อ + จำนวน
// รอด x/N + หลอด HP รวมของชนิดนั้นพร้อมเลข current/max ทับบนหลอด + badge ประเภท/specialBehavior —
// บอสแยกเป็นส่วนพิเศษ #bossSection (กรอบทอง, portrait ใหญ่กว่า, ชื่อสกิลพิเศษจาก BOSS_SKILLS) —
// ช่วง shop เป็นพรีวิวจาก buildWave(wave) (ยังไม่ spawn), ช่วง battle อ่านจากยูนิตศัตรูจริง — อ่าน
// ข้อมูลอย่างเดียว ไม่แตะ stats/AI/wave schedule/boss skill เลย
// ============================================================
// badge สั้นบอกประเภทการเล็งเป้า (specialBehavior) ของมอนสเตอร์แต่ละแถว — ใช้ emoji ล้วนตาม asset
// policy (ไม่มี asset ภาพใหม่) เหมือนแนวทาง CLASS_ICON_MAP ของแผง Link เดิม
const MONSTER_BEHAVIOR_ICON = {
  hunter: '🎯',       // StoneWolf: เล็ง HP% เหลือน้อยสุด
  ranged: '🏹',       // SpiritArcher: รักษาระยะ
  backline: '🗡️',     // ShadowAssassin: พุ่งเล็งแนวหลัง
  frontline: '🛡️',    // OrcBrute: เล็งแนวหน้า
  stun_attack: '💫',  // Golem: สตันทุกโจมตีที่ 4
};
function monsterGroupsForCurrentWave() {
  const enemies = units.filter((u) => u.team === 'enemy');
  const source = enemies.length ? enemies : (buildWave(wave) || []);
  const groups = new Map();
  source.forEach((m) => {
    const g = groups.get(m.sprite) || {
      sprite: m.sprite, boss: false, total: 0, alive: 0, hp: 0, maxHp: 0, color: m.placeholderColor,
      label: (m.name || m.sprite).replace(/\s+(\d+|[A-Z])$/, ''), // "Slime 1"/"Golem A" -> ชื่อชนิด
      behaviorType: (m.specialBehavior && m.specialBehavior.type) || null, bossSkillId: null,
    };
    const isAlive = m.alive !== false; // cfg พรีวิว (ยังไม่ spawn) ไม่มีฟิลด์ alive = ถือว่ารอดทุกตัว
    g.total += 1;
    if (isAlive) { g.alive += 1; g.hp += m.hp || 0; }
    g.maxHp += m.maxHp || m.hp || 0;
    if (m.unitType === 'boss') { g.boss = true; g.bossSkillId = m.bossSkillId || g.bossSkillId; }
    groups.set(m.sprite, g);
  });
  return [...groups.values()];
}
function buildMonRowEl(g) {
  const row = document.createElement('div');
  row.className = 'monRow' + (g.boss ? ' boss' : '') + (g.alive === 0 ? ' wiped' : '');
  row.dataset.sprite = g.sprite;
  const meta = ASSET_META[g.sprite];
  const icon = meta
    ? `<img src="${meta.path}" alt="">`
    : `<span class="monSwatch" style="background:#${(g.color || 0x888888).toString(16).padStart(6, '0')}"></span>`;
  const badge = g.boss ? '👑' : (MONSTER_BEHAVIOR_ICON[g.behaviorType] || '');
  const hpPct = g.maxHp ? Math.round((g.hp / g.maxHp) * 100) : 100;
  const hpCur = Math.max(0, Math.round(g.hp)), hpMax = Math.round(g.maxHp);
  const skillName = g.boss && g.bossSkillId && BOSS_SKILLS[g.bossSkillId] ? BOSS_SKILLS[g.bossSkillId].name : '';
  row.innerHTML =
    `<div class="monPortraitWrap">${icon}${badge ? `<span class="monTypeBadge">${badge}</span>` : ''}</div>` +
    `<div class="monInfo">` +
      `<div class="monNameRow"><span class="monName">${g.label}</span><span class="monCount">${g.alive}/${g.total}</span></div>` +
      `<div class="monBarTrack"><div class="monBarFill" style="width:${hpPct}%"></div><span class="monHpText">${hpCur}/${hpMax}</span></div>` +
      (skillName ? `<div class="monSkillName">${skillName}</div>` : '') +
    `</div>`;
  return row;
}
// rebuild DOM เฉพาะ event ใหญ่ (renderUI) — ระหว่างต่อสู้ใช้ updateMonsterPanelBars() ด้านล่างแทน
function renderMonsterPanel() {
  const groups = monsterGroupsForCurrentWave();
  const regularGroups = groups.filter((g) => !g.boss);
  const bossGroups = groups.filter((g) => g.boss);
  document.getElementById('monsterCount').textContent = `(${groups.reduce((s, g) => s + g.alive, 0)} ตัว)`;
  const listEl = document.getElementById('monsterList');
  listEl.innerHTML = '';
  if (regularGroups.length === 0 && bossGroups.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'monEmpty';
    empty.textContent = 'ไม่มีข้อมูลศัตรูของเวฟนี้';
    listEl.appendChild(empty);
  } else {
    regularGroups.forEach((g) => listEl.appendChild(buildMonRowEl(g)));
  }
  const bossSectionEl = document.getElementById('bossSection');
  const bossListEl = document.getElementById('bossList');
  bossListEl.innerHTML = '';
  if (bossGroups.length === 0) {
    bossSectionEl.style.display = 'none';
  } else {
    bossSectionEl.style.display = '';
    bossGroups.forEach((g) => bossListEl.appendChild(buildMonRowEl(g)));
  }
}
// per-frame ระหว่างต่อสู้: อัปเดตเฉพาะ width หลอด + เลข HP + ตัวนับของแถวเดิม ไม่ rebuild DOM ทั้งแผง
// (querySelector บน #monsterPanel ทั้งก้อนครอบคลุมทั้ง #monsterList ปกติและ #bossList แยกในทีเดียว)
function updateMonsterPanelBars() {
  const panelEl = document.getElementById('monsterPanel');
  monsterGroupsForCurrentWave().forEach((g) => {
    const row = panelEl.querySelector(`[data-sprite="${g.sprite}"]`);
    if (!row) return;
    const hpPct = g.maxHp ? Math.round((g.hp / g.maxHp) * 100) : 0;
    row.querySelector('.monBarFill').style.width = hpPct + '%';
    row.querySelector('.monHpText').textContent = `${Math.max(0, Math.round(g.hp))}/${Math.round(g.maxHp)}`;
    row.querySelector('.monCount').textContent = `${g.alive}/${g.total}`;
    row.classList.toggle('wiped', g.alive === 0);
  });
}

// Cheap per-frame HP refresh during combat — only touches the bar width/dead class of existing
// rows (no rebuild/re-listen), unlike renderTeamHpPanel() which is for discrete UI events only.
function updateTeamHpBars() {
  const listEl = document.getElementById('teamHpList');
  placedUnits.forEach((u) => {
    const row = listEl.querySelector(`[data-instance-id="${u.instanceId}"]`);
    if (!row) return;
    const hpPct = u.maxHp ? Math.max(0, u.hp / u.maxHp) : 0;
    const fill = row.querySelector('.teamHpBarFill');
    if (fill) fill.style.width = Math.round(hpPct * 100) + '%';
    row.classList.toggle('dead', u.alive === false);
  });
}
function renderUI() {
  goldLabel.textContent = gold;
  waveLabel.textContent = wave;
  levelLabel.textContent = level;
  const levelMaxed = level >= MAX_FIELD;
  expLabel.textContent = levelMaxed ? 'MAX' : `(${exp}/${expNeededForLevel(level)})`;
  document.getElementById('buyExpBtn').disabled = phase !== 'shop' || gold < BUY_EXP_COST || levelMaxed;
  // HP ผู้เล่นบนแถบบน: แปลงโควตาแพ้เดิม (MAX_LOSSES-losses) เป็นหลอด 100/100 — การแสดงผลล้วนๆ
  // ลอจิกแพ้/จบเกมยังอิง losses/MAX_LOSSES เดิมทุกจุด ไม่มีระบบ HP ใหม่
  const playerHp = Math.round(((MAX_LOSSES - losses) / MAX_LOSSES) * 100);
  document.getElementById('playerHpFill').style.width = playerHp + '%';
  document.getElementById('playerHpLabel').textContent = `${playerHp}/100`;
  phaseLabel.textContent = phase==='shop' ? 'เตรียมทีม' : phase==='battle' ? 'กำลังต่อสู้' : '';
  const stageLabelEl = document.getElementById('stageLabel');
  if (STAGE_LABEL[wave]) { stageLabelEl.textContent = STAGE_LABEL[wave]; stageLabelEl.style.display = ''; }
  else { stageLabelEl.style.display = 'none'; }
  sanitizeLinkedHeroes(); // ฮีโร่ที่หลุดจากสนามรบ (ถอน/ขาย/รวมร่าง/รวมดาว) ต้องหลุดจาก Link ก่อนคำนวณบัฟเสมอ
  synergyBuffs = computeSynergyBuffs(); // recompute live so the Link panel/reroll discount always reflect the current selection
  renderLinkPanel();
  updateLinkedHeroVisuals();
  updateTileHighlights(); // ไฮไลต์ช่องวางตัวตามสถานะเลือกปัจจุบัน (เลือกอยู่ = โชว์, ไม่เลือก = สีพื้นจาง)
  const shopPhase = phase === 'shop';
  document.getElementById('bottomRight').style.display = shopPhase ? 'flex' : 'none';
  bagToggleBtn.style.display = shopPhase ? '' : 'none';
  if (!shopPhase) { setShopOpen(false); inventoryPanelEl.style.display = 'none'; }
  else inventoryPanelEl.style.display = '';
  if (phase !== 'shop' && inspectingHero) closeEquipModal(); // Equipment UI only makes sense during shop phase
  if (!shopPhase) selectedUnit = null;
  startBattleBtn.disabled = placedUnits.length === 0 || !!pendingEvolution;
  const fieldFull = placedUnits.length >= fieldCapacity();
  const benchFull = benchHeroes.length >= MAX_BENCH;
  document.getElementById('fieldCount').textContent = `(${placedUnits.length}/${fieldCapacity()})`;

  shopCardsEl.innerHTML = '';
  shopOffers.forEach((hkey, idx) => {
    const def = HERO_DEFS[hkey];
    const div = document.createElement('div');
    div.className = 'card' + (gold < def.cost || benchFull ? ' disabled' : '');
    div.innerHTML = `<img src="${heroPortraitSrc(hkey)}"><div class="name">${def.name}</div><div class="tags">${tagLabel(hkey)}</div><div class="cost">💰${def.cost}</div>`;
    div.onclick = () => buyHero(idx);
    shopCardsEl.appendChild(div);
  });
  const rerollCost = getRerollCost();
  rerollBtn.disabled = gold < rerollCost || ownedPool.length === 0 || !!pendingEvolution;
  rerollBtn.textContent = freeRerollsRemaining > 0 ? `รีโรล (ฟรี)` : `รีโรล 💰${rerollCost}`;

  // Item/weapon shop section — separate offer list under the hero cards (see ITEM_SHOP note)
  const itemShopCardsEl = document.getElementById('itemShopCards');
  const invFull = playerState.inventory.itemInstanceIds.length >= playerState.inventory.capacity;
  itemShopCardsEl.innerHTML = '';
  itemShopOffers.forEach((itemDefId, idx) => {
    const idef = ITEM_DEFS_BY_ID[itemDefId];
    const cost = itemShopCost(itemDefId);
    const div = document.createElement('div');
    div.className = 'card itemShopCard' + (gold < cost || invFull ? ' disabled' : '');
    div.innerHTML = `<div class="itemIcon">${itemIcon(itemDefId)}</div><div class="name">${idef.name}</div><div class="cost">💰${cost}</div>`;
    div.title = idef.passive || '';
    div.onclick = () => buyShopItem(idx);
    itemShopCardsEl.appendChild(div);
  });
  document.getElementById('itemShopHeader').style.display = itemShopOffers.length ? '' : 'none';

  // ม้านั่งสำรองอยู่บนกระดาน 3D เนื้อเดียวกันแล้ว (แถวสีเข้มล่างสุด) ไม่มีการ์ด DOM ให้ render อีกต่อไป —
  // เหลือแค่แถบ hint/selectedUnit ลอยอยู่กึ่งกลางล่างจอบอกสถานะ/ปุ่มไอเทม-ขาย ของฮีโร่ที่เลือกอยู่
  const selectedUnitBarEl = document.getElementById('selectedUnitBar');
  const hintTextEl = document.getElementById('hintText');
  if (selectedUnit) {
    selectedUnitBarEl.style.display = 'flex';
    const def = HERO_DEFS[selectedUnit.heroKey];
    document.getElementById('selectedUnitName').textContent = `${def.name}${starLabel(selectedUnit.heroKey, selectedUnit.starLevel)} — แตะช่องปลายทางเพื่อย้าย`;
    document.getElementById('selectedUnitSellBtn').textContent = `💰 ขาย (${getSellValue(selectedUnit.heroKey)})`;
  } else {
    selectedUnitBarEl.style.display = 'none';
    hintTextEl.textContent = fieldFull
      ? `สนามเต็มแล้ว (${fieldCapacity()}/${fieldCapacity()}) — แตะฮีโร่บนกระดานเพื่อย้ายกลับม้านั่งก่อนวางตัวใหม่`
      : (placedUnits.length===0 ? 'ยังไม่ได้วางฮีโร่ลงกระดาน — แตะฮีโร่ในแถวม้านั่ง (ล่างสุด) แล้วแตะช่องรบ' : benchFull ? 'ม้านั่งสำรองเต็มแล้ว — ซื้อฮีโร่เพิ่มไม่ได้จนกว่าจะวางลงกระดาน' : '');
    document.getElementById('hintBar').style.display = hintTextEl.textContent ? 'flex' : 'none';
  }

  renderTeamHpPanel(); // right-side panel: replaces the old bottom-row fieldCards list entirely
  renderMonsterPanel(); // right-side top panel: current wave's enemies (preview in shop, live in battle)

  placedUnits.forEach(updateEquipBadge); // Equipment Core: floating badge on any hero with an item equipped
  renderInventory();
  if (inspectingHero) renderEquipModal();
  if (pendingEvolution) renderEvolutionModal();
}

// ============================================================
// EVOLUTION SYSTEM — player-choice merge (replaces the old auto-merge-to-random-evolution).
// scanForMergeCandidate() is called on every "bench changed" event (buyHero, unplaceUnit — this
// game has no drag-hero-into-a-specific-bench-slot UI, bench composition only ever changes at
// those two points) and enters `pendingEvolution` when 3 matching tier-1 heroes are found.
// Only one merge can be pending at a time (block_additional_merge_while_pending).
// ============================================================
let pendingEvolution = null; // { sourceHeroDefId, sourceInstanceIds, availableEvolutionIds, collectedItemInstanceIds, status }
function scanForMergeCandidate() {
  if (pendingEvolution) return;
  const counts = {};
  benchHeroes.forEach((inst) => { counts[inst.heroKey] = (counts[inst.heroKey] || 0) + 1; });
  for (const heroKey in counts) {
    if (counts[heroKey] >= 3 && EVOLUTION_TREE[heroKey]) { lockMergeSources(heroKey); return; }
  }
}
// Removes exactly 3 matching source heroes from the bench, pools their equipment (in
// source1-slot1/slot2, source2-slot1/slot2, source3-slot1/slot2 order — the priority order
// restoreEquipment reads from later), and opens the evolution choice modal.
// Locks in WHICH 3 bench instances are the fusion source (by instanceId only) and opens the
// choice modal — does NOT touch benchHeroes/equipment yet. The 3 source units stay exactly as
// they were (still real bench units, still sellable in principle) until the player actually
// presses Confirm in chooseEvolution(); the modal overlay already blocks board/bench interaction
// while open (same as every other modal in this file), so nothing else can touch them meanwhile.
function lockMergeSources(heroKey) {
  const sourceIdx = [];
  for (let i = 0; i < benchHeroes.length && sourceIdx.length < 3; i++) {
    if (benchHeroes[i].heroKey === heroKey) sourceIdx.push(i);
  }
  if (sourceIdx.length < 3) return;
  const sourceInstanceIds = sourceIdx.map((i) => benchHeroes[i].instanceId);
  pendingEvolution = {
    sourceHeroDefId: heroKey,
    sourceInstanceIds,
    availableEvolutionIds: EVOLUTION_TREE[heroKey].evolutions,
    status: 'waiting_for_choice',
  };
  openEvolutionModal();
  renderUI();
}
// Player closed the modal without choosing — the 3 source units were never touched, so this is
// a pure no-op on game state; scanForMergeCandidate() will naturally re-offer the same trio (or
// whichever trio still matches) the next time a bench-changing action runs.
function cancelEvolution() {
  if (!pendingEvolution) return;
  pendingEvolution = null;
  closeEvolutionModal();
  renderUI();
}
// Creates the chosen tier-2 hero on the bench, auto-equips the first 2 pooled items (in
// collection-priority order), and returns any overflow to the player's inventory — items are
// never destroyed, matching equipment_transfer_policy.never_destroy_overflow_items. The 3
// source units and their equipment are only consumed here, at confirm time.
function chooseEvolution(evolutionId) {
  if (!pendingEvolution) return;
  if (!pendingEvolution.availableEvolutionIds.includes(evolutionId)) return;
  if (HERO_DEFS[evolutionId].evolves_from !== pendingEvolution.sourceHeroDefId) return;
  const sourceIdx = pendingEvolution.sourceInstanceIds
    .map((id) => benchHeroes.findIndex((u) => u.instanceId === id))
    .filter((i) => i >= 0);
  if (sourceIdx.length !== pendingEvolution.sourceInstanceIds.length) { cancelEvolution(); return; } // defensive: a source left the bench somehow — abort, consume nothing
  const sourceInstances = sourceIdx.map((i) => benchHeroes[i]);
  const collectedItemInstanceIds = [];
  sourceInstances.forEach((inst) => {
    inst.equipment.forEach((itemInstanceId, slotIndex) => {
      if (!itemInstanceId) return;
      const item = playerState.itemInstances[itemInstanceId];
      if (item) { item.location = 'merge_pool'; item.ownerHeroId = null; } // held in escrow — not equippable, not in the inventory bar
      collectedItemInstanceIds.push(itemInstanceId);
      inst.equipment[slotIndex] = null;
    });
  });
  // highest index first so earlier indices stay valid; each source is a real 3D bench unit now,
  // so removeUnit() must run before splicing it out of the tracking array (else a "ghost" body
  // would stay in the scene forever — orphaned, never rendered-over, never cleaned up)
  [...sourceIdx].sort((a, b) => b - a).forEach((i) => { removeUnit(benchHeroes[i]); benchHeroes.splice(i, 1); });
  const newInst = spawnToBench(createHeroInstance(evolutionId));
  if (!newInst) { pendingEvolution = null; closeEvolutionModal(); renderUI(); return; } // practically unreachable (3 slots were just freed for 1 new hero), defensive only
  let equipped = 0;
  for (let i = 0; i < collectedItemInstanceIds.length && equipped < 2; i++) {
    const item = playerState.itemInstances[collectedItemInstanceIds[i]];
    if (!item) continue;
    newInst.equipment[equipped] = collectedItemInstanceIds[i];
    item.location = 'equipped';
    item.ownerHeroId = newInst.instanceId;
    equipped++;
  }
  for (let i = equipped; i < collectedItemInstanceIds.length; i++) {
    const item = playerState.itemInstances[collectedItemInstanceIds[i]];
    if (!item) continue;
    item.location = 'inventory';
    item.ownerHeroId = null;
    playerState.inventory.itemInstanceIds.push(collectedItemInstanceIds[i]);
  }
  pendingEvolution = null;
  closeEvolutionModal();
  renderUI();
  scanForMergeCandidate(); // a second group may have completed while this one was pending
  scanForStarCombine(); // the freshly-created tier-2 hero might complete a star-combine triple too
}
// Hero Star System: 3x tier-2 SAME class+star instantly combine into 1 copy at the next star
// level — no player choice needed (unlike tier-1's Evolution modal) since the class never
// changes, just its power. Counts across BOTH benchHeroes and placedUnits (unlike the tier-1
// scan above, which is bench-only) since the player explicitly wants board copies to count too.
function scanForStarCombine() {
  if (pendingEvolution) return;
  const buckets = {};
  [...benchHeroes, ...placedUnits].forEach((inst) => {
    const def = HERO_DEFS[inst.heroKey];
    if (!def || def.class_tier !== 2) return;
    const star = normalizeStarLevel(inst.starLevel || 1);
    if (star >= HERO_STAR_MAX) return;
    const bucketKey = inst.heroKey + '@' + star;
    (buckets[bucketKey] = buckets[bucketKey] || []).push(inst);
  });
  for (const bucketKey in buckets) {
    if (buckets[bucketKey].length >= 3) { performStarCombine(buckets[bucketKey].slice(0, 3)); return; }
  }
}
// Removes the 3 source instances from wherever they currently live (bench array splice, or
// removeUnit()+placedUnits splice for board units), pools their equipment (never destroyed,
// same overflow policy as chooseEvolution above), and pushes 1 new higher-star bench instance.
function performStarCombine(sources) {
  const heroKey = sources[0].heroKey;
  const newStar = normalizeStarLevel((sources[0].starLevel || 1) + 1);
  const collectedItemInstanceIds = [];
  sources.forEach((inst) => {
    inst.equipment.forEach((itemInstanceId, slotIndex) => {
      if (!itemInstanceId) return;
      const item = playerState.itemInstances[itemInstanceId];
      if (item) { item.location = 'merge_pool'; item.ownerHeroId = null; }
      collectedItemInstanceIds.push(itemInstanceId);
      inst.equipment[slotIndex] = null;
    });
    const benchIdx = benchHeroes.indexOf(inst);
    if (benchIdx >= 0) { removeUnit(inst); benchHeroes.splice(benchIdx, 1); return; }
    const placedIdx = placedUnits.indexOf(inst);
    if (placedIdx >= 0) { removeUnit(inst); placedUnits.splice(placedIdx, 1); }
  });
  const newInst = spawnToBench(createHeroInstance(heroKey, newStar));
  if (!newInst) return; // practically unreachable — up to 3 slots were just freed for 1 new hero, defensive only
  let equipped = 0;
  for (let i = 0; i < collectedItemInstanceIds.length && equipped < 2; i++) {
    const item = playerState.itemInstances[collectedItemInstanceIds[i]];
    if (!item) continue;
    newInst.equipment[equipped] = collectedItemInstanceIds[i];
    item.location = 'equipped';
    item.ownerHeroId = newInst.instanceId;
    equipped++;
  }
  for (let i = equipped; i < collectedItemInstanceIds.length; i++) {
    const item = playerState.itemInstances[collectedItemInstanceIds[i]];
    if (!item) continue;
    item.location = 'inventory';
    item.ownerHeroId = null;
    playerState.inventory.itemInstanceIds.push(collectedItemInstanceIds[i]);
  }
  renderUI();
}

function buyHero(offerIdx) {
  const hkey = shopOffers[offerIdx];
  if (!hkey) return;
  const def = HERO_DEFS[hkey];
  if (gold < def.cost) return;
  if (benchHeroes.length >= MAX_BENCH) return; // ม้านั่งสำรองเต็ม ต้องวางลงกระดานหรือรอก่อน
  gold -= def.cost;
  const poolIdx = ownedPool.indexOf(hkey); // เอาออกแค่สำเนาเดียว ไม่ใช่ทั้งหมด (ไม่งั้นซื้อฮีโร่ตัวเดิมซ้ำเพื่อรวมร่างไม่ได้)
  if (poolIdx !== -1) ownedPool.splice(poolIdx, 1);
  shopOffers.splice(offerIdx, 1);
  spawnToBench(createHeroInstance(hkey));
  scanForMergeCandidate();
  scanForStarCombine(); // shop can sell tier-2 heroes directly from wave 6+ — a 3rd bought copy can complete a star-combine too
  renderUI();
}
// merchant synergy: shop_reroll_discount_gold reduces the paid reroll cost, floored at
// minimum_reroll_cost (never applies while a free reroll is still available — that's still free).
function getRerollCost() {
  if (freeRerollsRemaining > 0) return 0;
  const discount = synergyBuffs ? synergyBuffs.shopRerollDiscountGold : 0;
  const floor = (synergyBuffs && synergyBuffs.minimumRerollCost) || 1;
  return Math.max(floor, SHOP_ECONOMY.reroll.cost - discount);
}
rerollBtn.onclick = () => {
  const cost = getRerollCost();
  if (gold < cost || ownedPool.length===0 || pendingEvolution) return;
  if (freeRerollsRemaining > 0) freeRerollsRemaining -= 1;
  else gold -= cost;
  ownedPool.push(...shopOffers); // คืนตัวเลือกเดิมกลับพูล แล้วสุ่มใหม่
  shopOffers = [];
  pickShopOffers();
  renderUI();
};
document.getElementById('buyExpBtn').onclick = () => {
  if (phase !== 'shop' || gold < BUY_EXP_COST || level >= MAX_FIELD) return; // Level 5 is the cap — no gold spent, no EXP gained, Level 6 never created
  gold -= BUY_EXP_COST;
  exp += BUY_EXP_GAIN;
  while (level < MAX_FIELD && exp >= expNeededForLevel(level)) { exp -= expNeededForLevel(level); level += 1; }
  renderUI();
};

// สร้างยูนิตต่อสู้เต็มรูปแบบที่ (c,r) จากข้อมูลฮีโร่ (heroKey/instanceId/equipment/starLevel) — ใช้ร่วมกัน
// ทั้งตอนวางลงแถวรบ (alive) และตอนสร้างลงแถวม้านั่งสำรอง (alive:false, ดูใน spawnToBench/moveUnitTo)
function createUnitFromInstance(instData, c, r) {
  const def = HERO_DEFS[instData.heroKey];
  const starLevel = normalizeStarLevel(instData.starLevel || 1);
  const s = getScaledHeroStats(instData.heroKey, starLevel); // Hero Star System: tier-2 heroes may be 1★ or 2★
  const u = makeUnit({ team:'player', name:def.name, sprite:def.sprite, c, r,
    hp:s.hp, pAtk:s.p_atk, mAtk:s.m_atk, pDef:s.p_def, mDef:s.m_def, attackType:def.attack_type,
    atkSpeed:s.attack_speed, range:s.attack_range, moveSpeed:s.move_speed, heroKey:instData.heroKey,
    instanceId: instData.instanceId, // identity carries across every bench<->field transition
    equipment: instData.equipment, starLevel, combatStats: null }); // carry the SAME equipment array through
  u.baseMaxHp = s.hp; // immutable — Link maxHpPct is always recomputed from this, never compounded
  // immutable snapshot buildCombatStats() clones from — never overwritten by equipment/Link math
  // physical_lifesteal: baseline 0 so status modifiers (e.g. Berserker's physical_lifesteal_pct)
  // have a real stats-object slot to fold into via buildCombatStats' generic modifier pipeline
  u.baseStats = { hp:s.hp, p_atk:s.p_atk, m_atk:s.m_atk, p_def:s.p_def, m_def:s.m_def,
    move_speed:s.move_speed, attack_speed:s.attack_speed, attack_range:s.attack_range, physical_lifesteal:0 };
  u.origC = c; u.origR = r;   // ไทล์ที่วางไว้ตอนแรก — ใช้สแนปกลับระหว่างด่าน (ดู resetForWave)
  // Skill/Mana/Status runtime state — max_mana comes from the hero's own skill data (dynamic per
  // hero, e.g. Sniper 150 / Archmage 180), falling back to 100 for any hero with no SKILL_DEFS entry
  const skillDef = SKILL_DEFS[instData.heroKey];
  u.current_mana = 0; u.max_mana = (skillDef && skillDef.max_mana) || 100; u.statuses = []; u.action_state = 'idle';
  u.current_target = null; u.castTimer = 0; u.castTarget = null; u.castTargetList = null;
  u.skillGoldTriggers = 0; u.reviveUsesThisWave = 0; u.shield = 0; u.shieldTimer = 0;
  updateEquipBadge(u);
  return u;
}
// หาคอลัมน์ว่างช่องแรกในแถวม้านั่งสำรอง (BENCH_ROW) — ใช้แค่ 5 คอลัมน์แรกตาม MAX_BENCH, คืน -1 ถ้าเต็ม
function findFreeBenchCol() {
  for (let c = 0; c < MAX_BENCH; c++) if (!occupied.has(key(c, BENCH_ROW))) return c;
  return -1;
}
// สร้างฮีโร่ใหม่ (จากร้านค้า/evolution/star-combine) ลงม้านั่งสำรองโดยตรงเป็นยูนิต 3D จริงบนกระดาน
// (alive:false — ไม่ร่วมรบ, ไม่ถูกเล็ง, ไม่เดิน — ดูเหตุผลที่ handleUnitDeath/selectTarget/updateUnit
// เช็ก u.alive ทุกจุดอยู่แล้วใน Gemini.md) คืน null ถ้าม้านั่งเต็ม (8/8)
function spawnToBench(instData) {
  const c = findFreeBenchCol();
  if (c < 0) return null;
  const u = createUnitFromInstance(instData, c, BENCH_ROW);
  u.alive = false;
  u.isBench = true;
  benchHeroes.push(u);
  return u;
}
// ย้ายฮีโร่ (ไม่ว่าจะอยู่ม้านั่งหรือสนามรบตอนนี้) ไปช่อง (c,r) ใดก็ได้บนกระดานเนื้อเดียวกัน — ปลายทางเป็น
// BENCH_ROW แปลว่าพัก (alive:false), ปลายทางแถวอื่นแปลว่าลงรบ (alive:true) รวมทุกทิศทาง (ม้านั่ง<->สนาม,
// ม้านั่ง<->ม้านั่งสลับช่อง, สนาม<->สนามขยับตำแหน่ง) ไว้ในฟังก์ชันเดียว แทนที่ placeHeroAt/unplaceUnit เดิม
function moveUnitTo(u, c, r) {
  if (phase !== 'shop') return null;
  if (r === BENCH_ROW && c >= MAX_BENCH) return null; // เกินโควตาม้านั่ง 5 ช่อง — กันไว้อีกชั้นแม้ผู้เรียกกรองมาแล้ว
  if (occupied.has(key(c, r))) return null;
  const wasBattle = placedUnits.includes(u);
  const goingToBattle = r !== BENCH_ROW;
  if (goingToBattle && !wasBattle && placedUnits.length >= fieldCapacity()) return null; // สนามเต็มตามความจุปัจจุบัน
  if (wasBattle) placedUnits.splice(placedUnits.indexOf(u), 1);
  else benchHeroes.splice(benchHeroes.indexOf(u), 1);
  removeUnit(u);
  const instData = { instanceId: u.instanceId, heroKey: u.heroKey, equipment: u.equipment, starLevel: u.starLevel };
  const newUnit = createUnitFromInstance(instData, c, r);
  if (goingToBattle) placedUnits.push(newUnit);
  else { newUnit.alive = false; newUnit.isBench = true; benchHeroes.push(newUnit); }
  if (inspectingHero === u) inspectingHero = newUnit; // keep an open equip modal pointed at the same hero
  selectedUnit = null;
  scanForMergeCandidate();
  scanForStarCombine(); // moving may complete a bench+board mixed star-combine triple
  renderUI();
  return newUnit;
}

// ============================================================
// RAYCAST — คลิกกระดานเพื่อวาง/ถอนฮีโร่ (เฉพาะช่วง shop)
// ============================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
// #boardContainer is a full-viewport fixed layer again (inset:0 — the old "centered ~60%
// square" note was stale), but normalizing against the CANVAS's own bounding rect stays
// correct for any layout — this is the single source every raycast call site below uses.
function setMouseFromClient(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}
// tile-only raycast at a screen point — used by tap-to-move and drag-to-move below
function pickTileAtScreenPoint(clientX, clientY) {
  setMouseFromClient(clientX, clientY);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(tileMeshes, false);
  return hits.length ? hits[0].object.userData : null;
}
// unit-only raycast (player units only — bench row included, since it's the same 3D board now)
function pickPlayerUnitAtScreenPoint(clientX, clientY) {
  setMouseFromClient(clientX, clientY);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(units.filter((u) => u.team === 'player').map((u) => u.body), false);
  return hits.length ? hits[0].object.userData.unit : null;
}

// ============================================================
// UNIT SELECT / DRAG-TO-MOVE — ม้านั่งสำรองรวมเป็นแถวเดียวกับกระดานแล้ว จึงเลิกใช้การ์ด DOM แยก
// ต่างหาก แตะยูนิตของผู้เล่น (ม้านั่งหรือสนามรบก็ได้) เพื่อเลือก แล้วแตะช่องปลายทางเพื่อย้าย — หรือ
// ลากตรงๆ ด้วยผี sprite ลอยเหนือนิ้ว (GHOST_Y_OFFSET) แบบเดียวกับระบบม้านั่งเดิม
// ============================================================
const GHOST_Y_OFFSET = 56; // px the drag TARGET POINT is lifted above a finger (0 for mouse — no occlusion)
let unitDrag = null; // {unit, startX, startY, moved, pointerId, ghostEl, hoverTile, liftY}

document.addEventListener('dragstart', (e) => e.preventDefault()); // native drag/selection can fire mid-gesture on some browsers

// ONE shared drag target point drives everything: ghost anchor, tile raycast, tile highlight,
// and (via hoverTile) the pointer-up drop. dragTargetPoint lifts the point above a finger so the
// destination tile is never hidden under the touch; the ghost's FEET are anchored exactly at
// this same point (CSS translate(-50%,-100%)), so the tile the ghost stands on, the highlighted
// tile, and the drop tile are always the same tile. Previously the ghost floated at
// clientY-56 while the raycast used the unshifted clientY — one tile visually under the ghost,
// a different tile highlighted and receiving the unit.
function dragTargetPoint(ds, e) { return { x: e.clientX, y: e.clientY - ds.liftY }; }
function startBenchGhost(ds, x, y) {
  const ghost = document.createElement('div');
  ghost.className = 'benchGhost';
  ghost.innerHTML = `<img src="${heroPortraitSrc(ds.unit.heroKey)}">`;
  document.body.appendChild(ghost);
  ghost.style.left = x + 'px';
  ghost.style.top = y + 'px';
  ds.ghostEl = ghost;
}
function moveBenchGhost(ds, x, y) {
  if (ds.ghostEl) { ds.ghostEl.style.left = x + 'px'; ds.ghostEl.style.top = y + 'px'; }
}
function endBenchGhost(ds) {
  if (ds.ghostEl && ds.ghostEl.parentNode) ds.ghostEl.parentNode.removeChild(ds.ghostEl);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (phase !== 'shop') return;
  const u = pickPlayerUnitAtScreenPoint(e.clientX, e.clientY);
  if (!u) return; // ปล่อยให้ pointerup ด้านล่างจัดการ "แตะช่องว่างเพื่อย้าย" กรณีนี้แทน
  e.preventDefault();
  unitDrag = { unit: u, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId, ghostEl: null, hoverTile: null,
    liftY: e.pointerType === 'mouse' ? 0 : GHOST_Y_OFFSET };
});
document.addEventListener('pointermove', (e) => {
  if (!unitDrag || e.pointerId !== unitDrag.pointerId) return;
  const dx = e.clientX - unitDrag.startX, dy = e.clientY - unitDrag.startY;
  const pt = dragTargetPoint(unitDrag, e); // shared point: ghost anchor == raycast == highlight == drop
  if (!unitDrag.moved && Math.hypot(dx, dy) > 6) {
    unitDrag.moved = true;
    startBenchGhost(unitDrag, pt.x, pt.y);
  }
  if (unitDrag.moved) {
    moveBenchGhost(unitDrag, pt.x, pt.y);
    // ตรวจช่องที่จุดเป้าหมายเดียวกับผี (pt) ด้วย raycast เดิม (pickTileAtScreenPoint) แบบ real-time —
    // อัปเดตไฮไลต์เฉพาะตอนช่องที่ชี้อยู่เปลี่ยนจริง (ไม่ใช่ทุก pixel) ประหยัด repaint โดยยังใช้
    // material/mesh เดิมของ tileMeshes ซ้ำเสมอ ไม่สร้าง/ลบอะไรใหม่
    const tile = pickTileAtScreenPoint(pt.x, pt.y);
    const next = (tile && tile.isTile && tile.playerZone) ? { c: tile.c, r: tile.r } : null;
    const prev = unitDrag.hoverTile;
    if ((next?.c !== prev?.c) || (next?.r !== prev?.r)) {
      unitDrag.hoverTile = next;
      updateTileHighlights();
    }
  }
});
document.addEventListener('pointerup', (e) => {
  if (unitDrag && e.pointerId === unitDrag.pointerId) {
    const ud = unitDrag; unitDrag = null;
    if (ud.moved) {
      endBenchGhost(ud);
      // ปล่อยลงตรงช่องที่กำลัง highlight เสมอ (ud.hoverTile ตัวเดียวกับที่ pointermove ใช้วาดไฮไลต์
      // ล่าสุด) แทนที่จะ raycast ใหม่ที่พิกัดปล่อย ให้ตำแหน่งวางตรงกับสิ่งที่ผู้เล่นเห็นจริงเสมอ
      if (ud.hoverTile && !occupied.has(key(ud.hoverTile.c, ud.hoverTile.r))) {
        moveUnitTo(ud.unit, ud.hoverTile.c, ud.hoverTile.r);
      }
      updateTileHighlights(); // จบการลาก (สำเร็จหรือไม่ก็ตาม) -> เคลียร์/รีเฟรชไฮไลต์เสมอ
    } else {
      // tap (no drag) — ฮีโร่บนสนามรบ: เปิด/ปิดสถานะ Link (ระบบ Manual Link Selection)
      // ฮีโร่บนม้านั่ง: toggle-select สำหรับย้าย/ไอเทม/ขาย เหมือนเดิม (ม้านั่งห้ามเข้า Link)
      // การย้ายตำแหน่งฮีโร่สนามรบยังทำได้ตามปกติผ่านการลาก (drag) ด้านบน
      if (placedUnits.includes(ud.unit)) {
        toggleLinkedHero(ud.unit.instanceId);
      } else {
        selectedUnit = (selectedUnit === ud.unit) ? null : ud.unit;
        renderUI();
      }
    }
    return;
  }
  // no unit was grabbed on pointerdown — a tap on an empty tile while a unit is already
  // selected moves it there (mirrors the old tap-bench-card-then-tap-tile flow)
  if (phase !== 'shop' || !selectedUnit) return;
  const tile = pickTileAtScreenPoint(e.clientX, e.clientY);
  if (tile && tile.isTile && tile.playerZone && !occupied.has(key(tile.c, tile.r))) {
    moveUnitTo(selectedUnit, tile.c, tile.r);
  }
});
document.addEventListener('pointercancel', () => {
  if (unitDrag) { endBenchGhost(unitDrag); unitDrag = null; updateTileHighlights(); }
});

// ============================================================
// EQUIPMENT UI — inventory bar, per-hero equip modal (2 slots), and item drag-and-drop.
// Two equip entry points, deliberately kept separate to avoid a z-index/hit-test conflict:
//   - drag straight from the background inventory bar onto ANY bench/field card -> equips
//     into that hero's first empty slot (quick-equip, works whenever no modal is open)
//   - open a hero's equip modal (⚙ button on its card) for the precise per-slot view; the
//     modal has its own copy of the inventory list so dragging still works while the
//     full-screen modal backdrop is blocking the cards behind it
// ============================================================
let inspectingHero = null; // bench instance object OR field unit object currently shown in the modal
const inventoryCardsEl = document.getElementById('inventoryCards');
const equipModalEl = document.getElementById('equipModal');
const equipSlotsEl = document.getElementById('equipSlots');
const equipModalInventoryEl = document.getElementById('equipModalInventory');

function renderItemCard(itemInstanceId) {
  const inst = playerState.itemInstances[itemInstanceId];
  const def = ITEM_DEFS_BY_ID[inst.itemDefId];
  const div = document.createElement('div');
  div.className = 'itemCard';
  div.dataset.itemInstanceId = itemInstanceId;
  div.innerHTML = `<div class="itemIcon">${itemIcon(inst.itemDefId)}</div><div class="itemName">${def.name}</div>`;
  div.title = def.passive || def.name;
  return div;
}
function renderInventory() {
  document.getElementById('invCount').textContent = `(${playerState.inventory.itemInstanceIds.length}/${playerState.inventory.capacity})`;
  inventoryCardsEl.innerHTML = '';
  playerState.inventory.itemInstanceIds.forEach((id) => inventoryCardsEl.appendChild(renderItemCard(id)));
}

function openEquipModal(heroRef) {
  if (phase !== 'shop') return;
  inspectingHero = heroRef;
  renderEquipModal();
  equipModalEl.style.display = 'flex';
}
function closeEquipModal() {
  inspectingHero = null;
  equipModalEl.style.display = 'none';
}
function renderEquipModal() {
  if (!inspectingHero) return;
  document.getElementById('equipHeroName').textContent = HERO_DEFS[inspectingHero.heroKey].name;
  equipSlotsEl.innerHTML = '';
  inspectingHero.equipment.forEach((itemInstanceId, slotIndex) => {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'equipSlot' + (itemInstanceId ? ' filled' : '');
    slotDiv.dataset.slot = slotIndex;
    if (itemInstanceId) {
      const inst = playerState.itemInstances[itemInstanceId];
      const idef = ITEM_DEFS_BY_ID[inst.itemDefId];
      slotDiv.dataset.itemInstanceId = itemInstanceId;
      slotDiv.innerHTML = `<div class="itemIcon">${itemIcon(inst.itemDefId)}</div><div class="itemName">${idef.name}</div>`;
      slotDiv.title = idef.passive || idef.name;
    } else {
      slotDiv.innerHTML = `<div class="itemIcon">➕</div><div class="itemName">ว่าง</div>`;
    }
    equipSlotsEl.appendChild(slotDiv);
  });
  equipModalInventoryEl.innerHTML = '';
  playerState.inventory.itemInstanceIds.forEach((id) => equipModalInventoryEl.appendChild(renderItemCard(id)));
}
document.getElementById('equipCloseBtn').onclick = () => { closeEquipModal(); renderUI(); };

// ---- Evolution modal (player-choice merge — Cancel closes without consuming anything; the 3
// source units are only actually consumed inside chooseEvolution() at confirm time) ----
const evolutionModalEl = document.getElementById('evolutionModal');
document.getElementById('evolutionCancelBtn').onclick = cancelEvolution;
function openEvolutionModal() {
  renderEvolutionModal();
  evolutionModalEl.style.display = 'flex';
}
function closeEvolutionModal() {
  evolutionModalEl.style.display = 'none';
}
function renderEvolutionModal() {
  if (!pendingEvolution) return;
  document.getElementById('evolutionSourceName').textContent = HERO_DEFS[pendingEvolution.sourceHeroDefId].name;
  // preview only — reads current equipment on the (still untouched) source bench units without
  // collecting/mutating anything; the real collection happens in chooseEvolution() on confirm
  const previewItemCount = pendingEvolution.sourceInstanceIds
    .map((id) => benchHeroes.find((u) => u.instanceId === id))
    .filter(Boolean)
    .reduce((sum, u) => sum + u.equipment.filter(Boolean).length, 0);
  document.getElementById('evolutionItemCount').textContent = previewItemCount;
  const optionsEl = document.getElementById('evolutionOptions');
  optionsEl.innerHTML = '';
  pendingEvolution.availableEvolutionIds.forEach((evoId) => {
    const def = HERO_DEFS[evoId];
    const div = document.createElement('div');
    div.className = 'evoOption';
    div.innerHTML = `<img src="${heroPortraitSrc(evoId)}"><div class="name">${def.name}</div><div class="tags">${tagLabel(evoId)}</div>`;
    div.onclick = () => chooseEvolution(evoId);
    optionsEl.appendChild(div);
  });
}

// ---- item drag: same ghost-follows-pointer pattern as benchDrag, offset above the finger ----
const ITEM_GHOST_Y_OFFSET = 40;
let itemDrag = null; // { itemInstanceId, source:'inventory'|'equipped', heroRef, slotIndex, startX, startY, moved, pointerId, ghostEl, originX, originY }

function startItemGhost(x, y, itemInstanceId) {
  const inst = playerState.itemInstances[itemInstanceId];
  const ghost = document.createElement('div');
  ghost.className = 'itemGhost';
  ghost.innerHTML = `<div>${itemIcon(inst.itemDefId)}</div>`;
  document.body.appendChild(ghost);
  ghost.style.left = x + 'px';
  ghost.style.top = (y - ITEM_GHOST_Y_OFFSET) + 'px';
  return ghost;
}
function moveItemGhost(ghost, x, y) {
  ghost.style.left = x + 'px';
  ghost.style.top = (y - ITEM_GHOST_Y_OFFSET) + 'px';
}
function bounceBackItemGhost(ghost, originX, originY) {
  if (!ghost) return;
  ghost.classList.add('returning');
  // one frame so the browser registers the starting position before the transitioned move
  requestAnimationFrame(() => { ghost.style.left = originX + 'px'; ghost.style.top = originY + 'px'; });
  setTimeout(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 260);
}
function beginInventoryItemDrag(e, card) {
  if (phase !== 'shop') return;
  e.preventDefault();
  const rect = card.getBoundingClientRect();
  itemDrag = { itemInstanceId: card.dataset.itemInstanceId, source: 'inventory', heroRef: null, slotIndex: null,
    startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId,
    ghostEl: null, originX: rect.left + rect.width/2, originY: rect.top + rect.height/2 };
}
inventoryCardsEl.addEventListener('pointerdown', (e) => {
  const card = e.target.closest('.itemCard');
  if (card) beginInventoryItemDrag(e, card);
});
equipModalInventoryEl.addEventListener('pointerdown', (e) => {
  const card = e.target.closest('.itemCard');
  if (card) beginInventoryItemDrag(e, card);
});
equipSlotsEl.addEventListener('pointerdown', (e) => {
  if (phase !== 'shop') return;
  const slotEl = e.target.closest('.equipSlot');
  if (!slotEl || !slotEl.classList.contains('filled')) return;
  e.preventDefault();
  const rect = slotEl.getBoundingClientRect();
  itemDrag = { itemInstanceId: slotEl.dataset.itemInstanceId, source: 'equipped', heroRef: inspectingHero,
    slotIndex: parseInt(slotEl.dataset.slot, 10), startX: e.clientX, startY: e.clientY, moved: false,
    pointerId: e.pointerId, ghostEl: null, originX: rect.left + rect.width/2, originY: rect.top + rect.height/2 };
});
document.addEventListener('pointermove', (e) => {
  if (!itemDrag || e.pointerId !== itemDrag.pointerId) return;
  const dx = e.clientX - itemDrag.startX, dy = e.clientY - itemDrag.startY;
  if (!itemDrag.moved && Math.hypot(dx, dy) > 6) {
    itemDrag.moved = true;
    itemDrag.ghostEl = startItemGhost(e.clientX, e.clientY, itemDrag.itemInstanceId);
  }
  if (itemDrag.moved) moveItemGhost(itemDrag.ghostEl, e.clientX, e.clientY);
});
// dropping an item (from inventory OR from another equip slot) onto a hero card equips it
// into that hero's first empty slot; returns false (caller bounces the ghost back) if none free
function dropItemOnHeroCard(id, heroRef) {
  const freeSlot = heroRef.equipment.findIndex((e) => e == null);
  if (id.source === 'equipped') {
    if (heroRef === id.heroRef) return true; // dropped back on the same hero's own card — no-op success
    if (freeSlot < 0) return false;
    if (!unequipItem(id.heroRef, id.slotIndex)) return false;
    return equipItem(heroRef, id.itemInstanceId, freeSlot);
  }
  if (freeSlot < 0) return false;
  return equipItem(heroRef, id.itemInstanceId, freeSlot);
}
document.addEventListener('pointerup', (e) => {
  if (!itemDrag || e.pointerId !== itemDrag.pointerId) return;
  const id = itemDrag; itemDrag = null;
  if (!id.moved) return; // plain tap on an item — no action, unlike hero cards there's no tap-select mode
  const dropEl = document.elementFromPoint(e.clientX, e.clientY);
  let success = false;
  const equipSlot = dropEl && dropEl.closest('#equipSlots .equipSlot');
  // ม้านั่งสำรองอยู่บน 3D canvas แล้ว (ไม่ใช่การ์ด DOM) จึงไม่มีเป้าหมาย drop-quick-equip สำหรับม้านั่ง
  // อีกต่อไป — เหลือแค่แผง "ทีมในสนาม" (.teamHpRow) ที่ยังเป็น DOM การ์ดสำหรับฮีโร่ที่ลงรบแล้ว
  const teamRow = dropEl && dropEl.closest('.teamHpRow');
  if (equipSlot && inspectingHero) {
    const slotIndex = parseInt(equipSlot.dataset.slot, 10);
    if (id.source === 'equipped') {
      if (slotIndex === id.slotIndex) success = true; // dropped back on its own slot — no-op success
      else if (!inspectingHero.equipment[slotIndex] && unequipItem(id.heroRef, id.slotIndex)) {
        success = equipItem(inspectingHero, id.itemInstanceId, slotIndex);
      }
    } else if (!inspectingHero.equipment[slotIndex]) {
      success = equipItem(inspectingHero, id.itemInstanceId, slotIndex);
    }
  } else if (teamRow) {
    const heroRef = placedUnits.find((u) => u.instanceId === teamRow.dataset.instanceId);
    if (heroRef) success = dropItemOnHeroCard(id, heroRef);
  } else if (id.source === 'equipped') {
    // dropped somewhere outside any valid target (e.g. the modal's dark backdrop) -> unequip
    success = unequipItem(id.heroRef, id.slotIndex);
  }
  if (success) {
    if (id.ghostEl && id.ghostEl.parentNode) id.ghostEl.parentNode.removeChild(id.ghostEl);
    renderUI();
  } else {
    bounceBackItemGhost(id.ghostEl, id.originX, id.originY);
  }
});
document.addEventListener('pointercancel', (e) => {
  if (itemDrag && e.pointerId === itemDrag.pointerId) {
    bounceBackItemGhost(itemDrag.ghostEl, itemDrag.originX, itemDrag.originY);
    itemDrag = null;
  }
});

// ============================================================
// คลื่นศัตรู / เริ่มการต่อสู้ / จบด่าน
// ============================================================
const resultModal = document.getElementById('resultModal');
const resultTitle = document.getElementById('resultTitle');
const resultBody = document.getElementById('resultBody');
const resultBtn = document.getElementById('resultBtn');
let waveTimer = 0;
const WAVE_TIMEOUT = 150;

// ----- Measured per-stage enemy scaling (Live Gameplay QA balance pass) -----
// Enemy base stats never grow across the run while the player stacks heroes, levels, Links,
// and (now) purchasable equipment; after the diminishing-return mitigation fix, three scripted
// x4 playthroughs still cleared all 15 waves at 58–96% surviving team HP. This fixed lookup
// table (applied exactly once, at spawn — no compounding, unlike the removed +12%/wave double
// scaling) restores pressure per stage band. Boss/miniboss identity, skills, and compositions
// are unchanged — only spawn-time hp/pAtk are multiplied, escorts and bosses alike, so the
// difficulty rise is systemic rather than a lone inflated final boss. Stages 1–2 are untouched
// so the opening never depends on lucky shop RNG.
const STAGE_ENEMY_SCALE = {
  1:{hp:1.0,atk:1.0}, 2:{hp:1.0,atk:1.0}, 3:{hp:1.05,atk:1.05},
  4:{hp:1.15,atk:1.1}, 5:{hp:1.2,atk:1.15},
  6:{hp:1.35,atk:1.2}, 7:{hp:1.45,atk:1.25}, 8:{hp:1.55,atk:1.3},
  9:{hp:1.65,atk:1.35}, 10:{hp:1.7,atk:1.4},
  11:{hp:1.9,atk:1.5}, 12:{hp:2.0,atk:1.55}, 13:{hp:2.15,atk:1.6},
  14:{hp:2.3,atk:1.65}, 15:{hp:2.45,atk:1.7},
};
function spawnWave(n) {
  const scale = STAGE_ENEMY_SCALE[n] || STAGE_ENEMY_SCALE[15];
  buildWave(n).forEach((cfg) => makeUnit({ team:'enemy', ...cfg,
    hp: Math.round(cfg.hp * scale.hp), pAtk: Math.round(cfg.pAtk * scale.atk) }));
}
function clearEnemies() {
  units.filter(u => u.team==='enemy').forEach(removeUnit);
}
function healPlayerTeam() {
  placedUnits.forEach(resetForWave);
}

startBattleBtn.onclick = () => {
  if (placedUnits.length === 0 || pendingEvolution) return; // block_combat_start_while_pending
  phase = 'battle';
  waveTimer = 0;
  deadAlliesThisWave = []; // most_recent_dead_ally (Priest's revive) only ever looks at this wave
  applyPreCombatSynergyBuffs(); // recompute+freeze synergyBuffs BEFORE buildCombatStats reads it
  placedUnits.forEach((u) => buildCombatStats(u, ITEM_DEFS_BY_ID)); // Board Initialization — equipment pipeline
  spawnWave(wave);
  renderUI();
};

function showResult(title, body, onContinue) {
  phase = 'result';
  resultTitle.textContent = title;
  resultBody.textContent = body;
  resultModal.style.display = 'flex';
  resultBtn.onclick = () => { resultModal.style.display = 'none'; onContinue(); };
}

function onWaveCleared() {
  const income = grantWaveIncome(true); // base + win_bonus + interest + streak (ตาม SHOP_ECONOMY.income.total_income_formula)
  const merchantBonus = synergyBuffs ? synergyBuffs.bonusGoldOnWaveWin : 0;
  gold += merchantBonus;
  const reward = income.total + merchantBonus;
  clearEnemies();
  despawnSummons(); // summon_payload.despawn_on_wave_end
  clearAllVFX(); // จบเวฟ: ล้างเอฟเฟกต์ค้างทั้งหมด (รวม flash/shake/บรรยากาศคำสาป) คืน pool ครบ
  if (wave >= WAVE_TOTAL) {
    showResult('🏆 พิชิตซากอารีน่าหินสำเร็จ!', `ทำครบ ${WAVE_TOTAL} ด่าน ได้ทอง +${reward} — ขอบคุณที่เล่น!`, () => {
      phase = 'gameover';
      phaseLabel.textContent = 'จบเกม';
    });
  } else {
    const label = STAGE_LABEL[wave] ? ` (${STAGE_LABEL[wave]})` : '';
    showResult(`🏆 ชนะด่าน ${wave}!${label}`, `ได้ทอง +${reward} — จัดทัพแล้วลุยด่านถัดไป`, () => {
      wave += 1;
      healPlayerTeam();
      freeRerollsRemaining = SHOP_ECONOMY.reroll.free_rerolls_per_wave;
      pickShopOffers();
      phase = 'shop';
      renderUI();
    });
  }
}
function onWaveFailed(reason) {
  clearEnemies();
  despawnSummons(); // summon_payload.despawn_on_wave_end
  clearAllVFX(); // เช่นเดียวกับตอนชนะ: ไม่ให้เอฟเฟกต์/บรรยากาศคำสาปค้างข้ามไปหน้า shop
  losses += 1;
  const income = grantWaveIncome(false); // แพ้ก็ยังได้ base + interest + streak (แค่ไม่มี win_bonus) ตามสูตรรายได้
  if (losses >= MAX_LOSSES) {
    showResult('💀 พ่ายแพ้', `${reason} — ใช้โควตาแพ้ครบ ${MAX_LOSSES} ครั้งแล้ว กดเริ่มใหม่เพื่อลองรันใหม่ทั้งหมด`, () => {
      location.reload();
    });
  } else {
    const left = MAX_LOSSES - losses;
    showResult(`💀 แพ้ด่าน ${wave}`, `${reason} — เสียโควตาแพ้ไป 1 ครั้ง (เหลืออีก ${left} ครั้ง) ได้ทอง +${income.total} จัดทัพใหม่แล้วลองด่านนี้อีกที`, () => {
      healPlayerTeam();
      freeRerollsRemaining = SHOP_ECONOMY.reroll.free_rerolls_per_wave;
      pickShopOffers();
      phase = 'shop';
      renderUI();
    });
  }
}

// ============================================================
// GAME LOOP
// ============================================================
document.getElementById('speedBtn').onclick = (ev) => {
  // x1 -> x2 -> x4 -> x1. Safe at x4: dt (already capped at 50ms real time, see animate())
  // just represents more simulated seconds per frame — attack range is a grid-distance
  // check unrelated to dt, damage is applied instantly on cooldown (no travelling
  // projectile that could overshoot), and move/waveTimer progress is dt-proportional
  // either way, so higher speed can't skip a check or the stage-transition timing.
  speedMul = speedMul === 1 ? 2 : (speedMul === 2 ? 4 : 1);
  ev.target.textContent = 'x' + speedMul;
  ev.target.classList.toggle('active', speedMul>1);
};
document.getElementById('pauseBtn').onclick = (ev) => {
  paused = !paused;
  ev.target.textContent = paused ? '▶ เล่นต่อ' : '⏸ หยุด';
  ev.target.classList.toggle('active', paused);
};

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  let dt = Math.min((now - last)/1000, 0.05);
  last = now;

  if (phase === 'battle' && !paused) {
    dt *= speedMul;
    waveTimer += dt;
    for (const u of units) updateUnit(u, dt);
    updateSummonAuras(); // Beast Lord: sync "while summon alive" aura onto/off all allies
    updateBossSkills(units.filter((u) => u.team==='enemy' && u.unitType==='boss'), units.filter((u) => u.team==='player'), dt);
    updateFloatingTexts(dt);
    const pAlive = units.filter(u=>u.alive && u.team==='player').length;
    const eAlive = units.filter(u=>u.alive && u.team==='enemy').length;
    if (eAlive === 0) onWaveCleared();
    else if (pAlive === 0) onWaveFailed('ทีมฮีโร่ถูกกวาดล้าง');
    else if (waveTimer > WAVE_TIMEOUT) onWaveFailed('หมดเวลาด่านนี้');
    else {
      updateTeamHpBars(); // keep the right-side HP panel live during combat (renderUI() itself only fires on discrete UI events)
      updateMonsterPanelBars(); // same for the monster panel — bar widths/counts only, no DOM rebuild
    }
  }

  // VFX เดินด้วย dt เดียวกับ combat (คูณ speedMul แล้วตอน battle) ให้จังหวะภาพตรงกับเกมทุกความเร็ว —
  // ตอน pause ระหว่าง battle หยุดตาม ไม่ให้เอฟเฟกต์เล่นต่อทั้งที่เกมหยุด
  if (!(phase === 'battle' && paused)) updateVFX(dt);

  for (const u of units) {
    // Skeleton pilot: updateUnit() (and therefore updateAnim()) never runs for a dead unit, so the
    // approved Death sequence is advanced here instead, presentation-only. The existing rotate/fade
    // below is unchanged but now waits for deathDone (added to its condition) so the ~0.5s generic
    // fade never cuts off the longer (108cs) approved Death animation partway through.
    if (!u.alive && u.skelAnim && u.skelAnim.state === 'death' && !u.skelAnim.deathDone) {
      advanceSkeletonDeathAnim(u, dt);
    }
    // Remaining-five Runtime integration: same dead-unit death-frame-advance need as Skeleton
    // (updateUnit() returns early for !u.alive, so death playback can't ride the normal path).
    if (!u.alive && u.monsterAnim && u.monsterAnim.state === 'death' && !u.monsterAnim.deathDone) {
      advanceMonsterDeathAnim(u, dt);
    }
    if (!u.alive && u.deathT !== undefined && u.deathT < 1 && (!u.skelAnim || u.skelAnim.deathDone) && (!u.monsterAnim || u.monsterAnim.deathDone)) {
      u.deathT = Math.min(1, u.deathT + dt*2);
      u.body.rotation.z = -u.deathT*Math.PI/2;
      u.body.material.opacity = 1 - u.deathT;
      u.hpBar.visible = false;
      u.group.children[2].visible = false;
      u.shadow.material.opacity = 0.35*(1-u.deathT);
      if (u.deathT >= 1) u.group.visible = false;
    }
  }
  for (const u of units) u.group.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
}

// ============================================================
// START
// ============================================================
// Skeleton motion frames load in the background, in parallel with the main sprite loader below —
// deliberately NOT gating game start on them, so a slow/failed load never delays or blocks the
// Runtime (Skeleton simply renders with its original static sprite until/unless they finish).
loadSkeletonMotionSprites();
// Remaining-five monster motion frames: same background, non-blocking load pattern.
Object.keys(MONSTER_MOTION_DEFS).forEach(loadMonsterMotionSprites);
loadAllSprites(() => {
  document.getElementById('loading').style.display = 'none';
  pickShopOffers();
  renderUI();
  requestAnimationFrame(animate);
});

window.addEventListener('resize', layoutBoard);

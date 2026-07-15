# Auto-Battler — Three.js Project Status for Gemini

> อัปเดตจากการตรวจโค้ดบน branch `main` ณ วันที่ 2026-07-15
>
> จุดประสงค์: ให้ Gemini ใช้เป็นข้อมูลตั้งต้นสำหรับวางแผนและร่าง Prompt สั่ง Claude Code รอบถัดไป
>
> ข้อจำกัดของรายงานนี้: เป็นการตรวจแบบ static inspection จากไฟล์ใน GitHub ยังไม่ได้เปิดเกมจริงเพื่อดู Console/Network บนอุปกรณ์ Android หรือ iPad

## Project Structure

โปรเจกต์ปัจจุบันเป็นเว็บเกม Three.js แบบหลายหน้า โดย logic ส่วนใหญ่เขียนรวมอยู่ในไฟล์ HTML แต่ละหน้า ไม่ได้ใช้โครงสร้าง build แบบ npm/Vite/Webpack และยังไม่พบไฟล์ `.ts` หรือโมดูล `.js` แยกเป็นระบบหลัก

### ไฟล์เริ่มต้นและหน้าทดสอบ

- `index.html`
  - หน้าเมนูรวมลิงก์ไปยังโหมดทดสอบต่าง ๆ
  - เส้นทางหลักที่แสดงในเมนู:
    - `autochess-next.html` — Combat Next รุ่นทดลอง
    - `autochess.html` — Auto Chess รุ่นหลักเดิม
    - `game.html` — เฟส 1 ทีมเริ่มต้น 4 คน
    - `heroes.html` — หน้าแสดงฮีโร่/สไปรท์
    - `forest-clearing.html` — ฉากลานรบป่า

- `autochess.html`
  - ไฟล์เกมหลักที่รวม CSS, HTML UI, Three.js scene, ข้อมูลฮีโร่/ศัตรู, ร้านค้า, Bench, ระบบ Link, Wave และ Combat ไว้ในไฟล์เดียว
  - ใช้ Three.js r128 จาก CDN
  - ใช้ `OrthographicCamera`
  - กำหนดเกมหลักไว้ 15 ด่าน (`WAVE_TOTAL = 15`)

- `autochess-next.html`
  - ไม่ใช่เกมหลักที่แยก logic อิสระ
  - โหลดข้อความจาก `autochess.html` ผ่าน `fetch()` แล้วใช้ regular expression แทนโค้ดบางส่วนก่อนเขียนเอกสารเกมใหม่เข้า iframe/document
  - ใช้เพิ่ม Target Lock, Threat, Taunt, Assassin opening warp, projectile และปรับ Beast Lord เป็นระยะกลาง
  - โครงสร้างนี้สะดวกสำหรับทดลอง แต่เปราะเมื่อ `autochess.html` เปลี่ยนข้อความหรือรูปแบบโค้ด

### เอกสารออกแบบและสถานะ

- `CLAUDE_HANDOFF.md` — ข้อมูลส่งต่องานและข้อกำหนด UI/Asset รุ่นก่อน
- `ART_BRIEF.md` — แนวทาง Asset และสถานะภาพบางชุด
- `COMBAT_DECISIONS.md` — กติกา Combat ที่ตัดสินใจแล้วและหัวข้อที่ยังค้าง
- `gemini_status.md` — ไฟล์สถานะฉบับนี้

### Asset / Sprite

โค้ดปัจจุบันโหลด Asset ด้วย `THREE.TextureLoader()` และอ้าง path ผ่าน object `ASSET_META`

โครงสร้างที่อ้างอิงจากโค้ด:

- `assets/heroes/`
  - Sprite sheet ของฮีโร่ เช่น
    - `blademaster_sheet.png`
    - `beastlord_sheet.png`
    - `trickster_sheet.png`
    - `duelist_sheet.png`
    - `archmage_sheet.png`
    - `frostweaver_sheet.png`
    - `summoner_sheet.png`
    - `sniper_sheet.png`

- `assets/`
  - Sprite ศัตรูและบอสแบบไฟล์เดี่ยว เช่น
    - `mon_skeleton.png`
    - `mon_stonewolf.png`
    - `mon_spiritarcher.png`
    - `mon_shadowassassin.png`
    - `miniboss_warden.png`
    - `mon_golem.png`
    - `mon_bonedragon.png`
    - `boss_champion_big.png`

- `assets/portraits/`
  - มี contact sheet สำหรับดูภาพตัวละครจากหน้าเมนู

ยังไม่พบการใช้โมเดล 3D เช่น `.glb`, `.gltf`, `.fbx` ใน flow หลักที่ตรวจครั้งนี้ ตัวละครและศัตรูใช้ภาพ sprite / sprite sheet เป็นหลัก ส่วนพื้น กระดาน เสา และเศษหินสร้างด้วย geometry และ CanvasTexture จากโค้ด

## Data Schemas

ยังไม่พบการแยกข้อมูลเกมออกเป็นไฟล์ JSON ภายนอก ข้อมูลส่วนใหญ่เขียนเป็น JavaScript object ภายใน `autochess.html`

ตัวอย่าง schema ที่ใช้อยู่จริงในรูปแบบ JavaScript object:

```js
const HERO_DEFS = {
  blademaster: {
    title: 'Blade Master',
    sprite: 'BladeMaster',
    cost: 3,
    hp: 170,
    pAtk: 23,
    atkSpeed: 1.3,
    range: 1,
    moveSpeed: 2.4,
    trait: 'none'
  }
};
```

ถ้าจะแปลงเป็น JSON ภายนอกในอนาคต โครงสร้างเทียบเท่าจะเป็น:

```json
{
  "blademaster": {
    "title": "Blade Master",
    "sprite": "BladeMaster",
    "cost": 3,
    "hp": 170,
    "pAtk": 23,
    "atkSpeed": 1.3,
    "range": 1,
    "moveSpeed": 2.4,
    "trait": "none"
  }
}
```

ข้อมูลสำคัญอื่นที่ยังอยู่ในโค้ด:

- `HERO_TAGS` — แท็กอาชีพ/บทบาทสำหรับระบบ Link
- `SYNERGIES` — เงื่อนไขและบัฟของทีม
- `ENEMY_BASE` — ค่าสเตตัสศัตรูพื้นฐาน
- `STAGE_PLAN` — รายชื่อและจำนวนศัตรูแต่ละด่าน
- `ASSET_META` — path และจำนวนเฟรมของ sprite

ข้อเสนอแนะเชิงสถาปัตยกรรม: เมื่อระบบเริ่มนิ่ง ควรแยกข้อมูลเหล่านี้เป็นไฟล์ JSON หรือ `.js` config เพื่อลดความเสี่ยงจากการแก้ไฟล์ HTML ขนาดใหญ่และช่วยให้ AI แก้บาลานซ์โดยไม่แตะ combat logic

## Core Architecture (Three.js)

### 1. Scene / Renderer / Camera

- สร้าง renderer ด้วย `new THREE.WebGLRenderer()`
- จำกัด canvas ไม่ให้ทับ UI ด้านล่างด้วย `canvasHeight()` และค่าคงที่ `UI_HEIGHT`
- ใช้ `THREE.Scene()` พร้อมสีพื้นหลังและ Fog
- ใช้ `THREE.OrthographicCamera()` วางกล้องเอียงจากด้านบน
- ใช้ AmbientLight และ DirectionalLight
- ยังไม่มี scene manager แยกเป็น class ทุกอย่างอยู่ใน global scope ของไฟล์

### 2. Board / Grid

- กระดานใช้ `GRID = 8` และ `TILE = 1`
- แปลงพิกัดช่องเป็นโลก 3D ด้วย:

```js
function gridToWorld(c, r) {
  return new THREE.Vector3(
    (c - GRID / 2) * TILE + TILE / 2,
    0,
    (r - GRID / 2) * TILE + TILE / 2
  );
}
```

- สร้าง tile 8x8 ด้วย `PlaneGeometry`
- บันทึกข้อมูลช่องใน `mesh.userData` เช่น `c`, `r`, `playerZone`
- แถวที่ผู้เล่นวางตัวได้คือ `[5, 6, 7]`
- มีระบบเช็กตำแหน่งว่างและใช้ key ของ grid สำหรับ occupancy

### 3. Asset Loading / Sprite Animation

- ใช้ `THREE.TextureLoader()` โหลดทุก path ใน `ASSET_META`
- Sprite sheet ฮีโร่กำหนด 8 เฟรมและปรับ texture repeat
- ศัตรูหลายตัวใช้ภาพ 1 เฟรม
- เมื่อโหลดผิดพลาด โค้ดใช้ `console.error()` แต่ยังไม่เห็นระบบ fallback texture หรือหน้าจอสรุป Asset ที่หาย

### 4. Shop / Bench / Field

- ร้านค้า, Bench และทีมในสนามใช้ DOM card ด้านล่างจอ
- ร้านค้า reroll มีค่าใช้จ่าย
- Bench จำกัด 6 ตัว
- สนามจำกัด 5 ตัว
- มี flow เลือกฮีโร่และวางลงโซนผู้เล่น
- ตัวละครในสนามถูกใช้ทั้งสำหรับระบบ Combat และระบบ Link

### 5. Synergy / Link

- ผู้เล่นเลือกฮีโร่ในสนามเข้า Link ได้สูงสุด 3 ตัว
- `getActiveSynergies()` นับ tag ของตัวที่ถูกเลือก
- `getTeamBuffs()` รวมบัฟ เช่น damage, armor penetration, attack speed และ gold per wave
- ระบบนี้มี logic บัฟทีมอยู่แล้ว แต่ไม่ใช่ระบบ “ฮีโร่ซ้ำ 3 ตัวรวมดาว”

### 6. Combat

รุ่นเดิมใน `autochess.html` มีระบบต่อสู้พื้นฐาน ส่วน `autochess-next.html` patch เพิ่ม logic ขั้นสูง ได้แก่:

- Chebyshev distance สำหรับระยะต่อสู้
- A* เดิน 4 ทิศ
- เลือกช่องยืนโจมตีแทนการเดินเข้าไทล์ศัตรู
- Target Lock และตรวจเป้าหมายใหม่เป็นช่วง
- Threat สำหรับแนวหน้า
- Taunt พร้อม Damage Reduction ชั่วคราว
- Assassin วาร์ปเปิดไฟต์ไปหาแนวหลัง
- Projectile แบบตามเป้าหมาย
- การรีเซ็ต combat state ระหว่างด่าน

### 7. Game Loop / Animation

- ใช้ `requestAnimationFrame()` สำหรับ render และอัปเดตเกม
- ยูนิตเก็บ state เช่น cooldown, movement interpolation, animation state, target และสถานะตาย
- การทำ damage ผูกกับจังหวะโจมตี/Projectile ตาม logic ของแต่ละรุ่น
- ยังไม่มี fixed timestep หรือ deterministic simulation เต็มรูปแบบ

### 8. Stage / Run Flow

- `autochess.html` ตั้งเป้า 15 ด่าน
- มีชีวิตรวม 3 ครั้งต่อ run
- มี result modal และปุ่มไปต่อ
- มี STAGE_PLAN, miniboss/boss และการ scale ศัตรูตามด่าน
- หน้าเมนูระบุว่ารุ่นเดิมมีร้านค้า, Link, โควตาแพ้ 3 ครั้ง และบอสครบ 15 ด่าน

## Completed Features

สถานะต่อไปนี้พบโค้ดและโครงสร้างเชื่อมอยู่แล้ว แต่บางรายการยังต้องเปิดทดสอบจริงเพื่อยืนยันบนทุกอุปกรณ์

### Implemented in code

- หน้าเมนูเลือกโหมดทดสอบ
- Scene, camera, fog, light และ renderer ของ Three.js
- กระดาน 8x8 และพิกัด grid-to-world
- พื้น/เสาหัก/เศษหินแบบ procedural geometry
- โหลดฮีโร่และศัตรูจาก PNG sprite / sprite sheet
- ร้านค้าฮีโร่และปุ่ม reroll
- Bench สูงสุด 6 ตัว
- ทีมในสนามสูงสุด 5 ตัว
- เลือก/ย้ายตัวจาก Bench ไปสนาม
- โซนวางตัว 3 แถวล่าง
- ระบบ Link สูงสุด 3 ตัว
- Synergy และบัฟพื้นฐาน
- Combat พื้นฐาน: เดิน, หาเป้าหมาย, โจมตี, HP, ตาย
- ระบบศัตรูหลายประเภทและ wave plan
- ระบบ 15 ด่านและโควตาแพ้ 3 ครั้งในรุ่นหลัก
- Result modal และ flow ไปด่านถัดไป
- Combat Next: Target Lock, Threat, Taunt, Assassin warp และ Projectile
- จำกัด Shadow Assassin สูงสุดหนึ่งตัวต่อด่านใน Combat Next
- Beast Lord ระยะกลาง 3 ช่องใน Combat Next
- ปรับความเร็วเกมและหยุด/เล่น

### Implemented but not fully verified in this inspection

- การจบ run ครบ 15 ด่านโดยไม่มี state ค้าง
- การเล่นต่อหลังแพ้และหักชีวิตครบทุกกรณี
- การทำงานบน Android/iPad landscape ทุกขนาด
- ความถูกต้องของ sprite path ทุกไฟล์
- การทำงานของ Combat Next หลัง `autochess.html` เปลี่ยนรูปแบบโค้ด
- ความสมดุลของ Target Lock / Threat / Taunt / Assassin

## Work In Progress & Bugs

### 1. Combat Next ใช้ regex patch กับ HTML ทั้งไฟล์

นี่เป็นความเสี่ยงหลักของโครงสร้างปัจจุบัน เพราะหากต้นฉบับมีการเว้นวรรค เปลี่ยนตัวเลข หรือ refactor เพียงเล็กน้อย `replaceRequired()` จะ throw และเกมจะเปิดไม่ได้

ตัวอย่าง:

```js
function replaceRequired(label, pattern, replacement) {
  const before = source;
  source = source.replace(pattern, replacement);
  if (source === before) {
    throw new Error('หาโค้ดสำหรับแพตช์ไม่พบ: ' + label);
  }
}
```

คำแนะนำ: ย้าย Combat Next เข้า module/function จริง หรือรวมเข้ากับไฟล์หลักหลังผ่านการทดสอบ แทนการ patch ข้อความ HTML ตอน runtime

### 2. Error เมื่อ Asset โหลดไม่สำเร็จไม่มี fallback

```js
loader.load(path, onLoad, undefined, (err) => {
  console.error('โหลดสไปรท์ไม่สำเร็จ:', path, err);
});
```

ผลกระทบ:
- ผู้เล่นอาจเห็นตัวละครหายหรือขั้นตอนโหลดไม่จบ
- ไม่มี placeholder และไม่มีรายการไฟล์ที่โหลดพลาดใน UI

ควรเพิ่ม:
- fallback texture
- timeout
- ตัวนับ successful/failed assets
- ปุ่มเข้าสู่เกมแม้บาง Asset หาย พร้อมรายงานใน Console

### 3. Logic และข้อมูลรวมใน HTML ไฟล์ใหญ่

- ไม่มี class/module แยกสำหรับ `GameState`, `Board`, `CombatSystem`, `ShopSystem`, `AssetManager`
- แก้ระบบหนึ่งมีโอกาสกระทบระบบอื่น
- AI ต้องอ่านไฟล์ยาวทุกครั้ง ทำให้ใช้เครดิตสูง

ควรแยกอย่างน้อย:

- `src/config/heroes.js`
- `src/config/enemies.js`
- `src/config/stages.js`
- `src/core/game-state.js`
- `src/core/board.js`
- `src/core/combat.js`
- `src/ui/shop.js`
- `src/render/scene.js`

อย่างไรก็ตาม ควร refactor หลังล็อก behavior ด้วย test checklist เพื่อไม่ให้ flow ที่ทำงานอยู่พัง

### 4. ไม่มีระบบอาวุธตามแผนล่าสุด

ยังไม่พบโครงสร้างต่อไปนี้ในเกมหลัก:

- ตัวละครใส่อาวุธได้ 2 ชิ้น
- อาวุธใช้ได้ทุกอาชีพ
- อาวุธเพิ่ม stat ตามชนิด
- รวมอาวุธ 2 ชิ้นเป็นระดับถัดไป
- ร้านอาวุธ popup สุ่ม 3 ตัวเลือก
- อัตราสุ่มระดับอาวุธตามช่วงด่าน

ระบบนี้ควรถูกออกแบบเป็น data-driven และไม่ผูกกับ sprite ของฮีโร่

### 5. ไม่มีระบบรวมฮีโร่ซ้ำ 3 ตัวเป็นดาวถัดไป

ระบบ Link ปัจจุบันคือการเลือกฮีโร่สูงสุด 3 ตัวเพื่อเปิด Synergy ไม่ใช่การ merge ตัวซ้ำ

ยังต้องเพิ่ม:

- unique instance id
- hero star level
- สูตร merge 3 copies
- stat multiplier ตามดาว
- การ merge จาก Shop/Bench/Field โดยไม่ทำ state หาย
- UI แสดงดาวและ feedback ตอน merge

### 6. Skill / Mana / Status Effect ยังไม่ครบ

ตาม `COMBAT_DECISIONS.md` ยังต้องกำหนด:

- Mana gain
- Skill targeting
- AoE shape
- Heal/Buff/Debuff target rules
- Summon occupancy
- Slow, Stun, Silence, Burn, Poison, Shield stacking
- Boss resistance

### 7. Determinism / Replay

- ยังมี logic ที่ใช้ `Math.random()`
- ผลการต่อสู้และการวางเศษหินอาจต่างกันทุกครั้ง
- ยังไม่มี seeded RNG, combat log และ replay/debug seed

### 8. Console status

ยังไม่สามารถยืนยันว่า Console ปัจจุบันไม่มี error เพราะไม่ได้เปิดหน้าเกมจริงใน browser รอบนี้

จุดที่ควรตรวจทันทีเมื่อรัน:

- 404 ของ PNG ทุก path ใน `ASSET_META`
- CORS/fetch error ของ `autochess-next.html`
- ข้อความ `หาโค้ดสำหรับแพตช์ไม่พบ`
- Texture loader ที่โหลดไม่ครบแล้วไม่เรียก callback จบ
- Pointer/raycast บนอุปกรณ์สัมผัส
- State ค้างหลังชนะหรือแพ้แล้วกด “ไปต่อ”

## Recommended Next Steps

### Priority 1 — Stabilize current 15-stage run

1. เปิดทดสอบ `autochess.html` และ `autochess-next.html` ตั้งแต่ด่าน 1 ถึงด่าน 15
2. เก็บ Console log และ Network 404
3. ทดสอบชนะ, แพ้, retry, หักชีวิต และ Game Over
4. ยืนยันว่า Shop/Bench/Field ไม่ค้างระหว่างด่าน
5. ทำ checklist แบบ deterministic สำหรับ regression

Acceptance criteria:
- เล่นตั้งแต่ด่าน 1 ถึง 15 ได้
- ชนะ/แพ้เปลี่ยน phase ถูกต้อง
- ไม่มี uncaught exception
- Asset ทุกไฟล์ตอบ 200 หรือมี fallback

### Priority 2 — Remove runtime regex patch

- รวม Combat Next เข้ากับระบบหลักหรือแยกเป็น module
- รักษา behavior เดิมด้วย test scenario
- ลดความเสี่ยงที่หน้า Combat Next เปิดไม่ได้เมื่อไฟล์ฐานเปลี่ยน

### Priority 3 — Hero Merge / Star Upgrade

- ออกแบบ schema ของ hero instance และ star level
- ทำ merge 3 copies
- เพิ่ม stat multiplier
- ทดสอบ merge ข้าม Shop, Bench และ Field

### Priority 4 — Equipment Core

- inventory ของผู้เล่น
- equipment slots 2 ช่องต่อฮีโร่
- stat modifier pipeline
- ใส่/ถอด/ย้ายอาวุธโดยไม่ล็อกอาชีพ

### Priority 5 — Equipment Merge and Shop

- merge ของชนิดและระดับที่กำหนด
- popup สุ่ม 3 ชิ้น
- ราคาและ drop-rate table ตามช่วงด่าน
- แยก icon/path ออกจาก logic เพื่อให้ GPT จัดหา Asset ฟรีภายหลัง

### Priority 6 — Skill / Mana / Status Effects

- ตัดสินกติกาจาก `COMBAT_DECISIONS.md`
- เพิ่มระบบทีละประเภทพร้อม automated scenario หรือ debug controls

### Priority 7 — Modularization

หลัง behavior หลักนิ่งแล้ว ค่อยแยกไฟล์เพื่อลดค่าใช้จ่ายของ AI ในรอบถัดไป โดยเริ่มจาก config/data ก่อน logic

## Prompt Guidance for Gemini

เมื่อร่าง Prompt ให้ Claude Code ควร:

- สั่งอ่านเฉพาะไฟล์ที่เกี่ยวข้องกับงานรอบนั้น
- ห้าม refactor ระบบอื่นโดยไม่ได้รับอนุญาต
- แบ่งงานเป็นหนึ่งระบบต่อหนึ่ง commit
- ให้ Claude ระบุไฟล์และ function ที่จะเปลี่ยนก่อนแก้
- ให้ทดสอบ flow ที่ชัดเจนหลังแก้
- งาน Asset ให้ GPT หา Asset ฟรีและเตรียมไฟล์ ส่วน Claude Code ทำเฉพาะ path/config/integration

## Verification Metadata

- Repository: `phathompongsae-ops/Auto-Battler`
- Branch: `main`
- Files inspected directly:
  - `index.html`
  - `autochess.html`
  - `autochess-next.html`
  - `CLAUDE_HANDOFF.md`
  - `COMBAT_DECISIONS.md`
- Inspection type: static source inspection
- Runtime browser test: not performed
- Console/Network capture: not performed

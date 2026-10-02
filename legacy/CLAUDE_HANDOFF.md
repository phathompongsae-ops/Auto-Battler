# Auto-Battler — Claude Code Handoff

## ✅ สถานะล่าสุด: V5 ใช้งานได้แล้ว (อัปเดต 2026-07-14)

### ไฟล์หลักปัจจุบัน
`threejs-2_5d-clean-v5.html` — branch `claude/threejs-2-5d-clean-v5-e80mbk`

Commit สำคัญ (เรียงเวลา):
- `296042b` โครง V5: CSS Grid 4 แถวจริง (HUD / battle / bench / shop) ไม่มี overlay ทับ Canvas,
  กล้อง orthographic + contain-fit, ลาก-วาง + แตะเลือก-แตะวาง, portrait วาดด้วย canvas แทน emoji
- `97872ce` ระบบต่อสู้เต็มลูปตามกติกา `COMBAT_DECISIONS.md` (wave, targeting, projectile,
  HP bar, damage number, แพ้/ชนะได้ทอง, ปุ่ม speed ×1/×2/×4 คุมจริง)
- `d624092` เดินสายภาพจริงตัวแรก (Swordman) + ระบบโหลด asset แบบ per-hero มี fallback
- `cef8a79`, `87ce88e`, `e55bb2f` แก้ภาพยืด/กระดานโดนเบียดบนจอแนวนอน — บทเรียนสำคัญ:
  **ห้ามใช้ media query อิงความสูงจอ** (เบราว์เซอร์มือถือใน embedded viewer รายงานความสูง
  ไม่ตรงจริง) ให้ใช้ `clamp(min, Xvh, max)` กับทุกขนาดของ bench/shop และล็อกแถว battle
  ขั้นต่ำ `34vh` ใน grid-template-rows แทน

### Acceptance Criteria (จากรอบก่อน) — สถานะ
- [x] เปิดแล้วเห็นกระดาน 8×8 + ฉากป่า + Shop 5 ใบ + Bench 6 ช่อง ทันที
- [x] UI ไม่บังกระดาน (แยกพื้นที่จริงด้วย Grid, เทสกระดานได้ 53–69% ของจอ 5 ขนาด)
- [x] เริ่ม 3 ทอง → ซื้อฮีโร่ 2 ทอง → เข้า Bench → ลาก/แตะวาง 3 แถวล่าง → 1/1 → เริ่มต่อสู้
- [x] ต่อสู้จบมีแพ้/ชนะ ได้ทอง (+5 ชนะ / +2 แพ้) ขึ้น Wave ถัดไป ฮีโร่กลับตำแหน่งเดิม
- [ ] ทดสอบบนอุปกรณ์จริงครบ (ผ่าน headless หลายขนาดจอ + ผู้ใช้ทดสอบมือถือแนวนอนแล้ว)

### ลิงก์ทดลองเล่น (Claude Artifact — แพ็ก Three.js + asset ในไฟล์เดียว)
https://claude.ai/code/artifact/1c025f52-9740-4bae-b45d-52b0b509476c
(อัปเดตโดย publish ซ้ำจากเซสชัน Claude Code เดิม — URL คงที่)

### ระบบ asset ภาพจริง (ทำงานร่วมกับ GPT)
- Workflow ที่ตกลงกับผู้ใช้: GPT เจนภาพ → ผู้ใช้ตรวจ → แนบไฟล์ให้ Claude ในแชท →
  Claude ตัดพื้นหลัง/ครอป/เดินสายเข้าเกม/commit เอง (GPT ห้ามแตะไฟล์โค้ด)
- ทะเบียนภาพอยู่ในตัวแปร `HERO_ASSETS` ใน v5 — ฮีโร่ที่ไม่มีไฟล์ใช้ placeholder อัตโนมัติ
- สเปกไฟล์และบทเรียนการครอป ดู `ART_BRIEF.md` (อัปเดตแล้ว)
- ตัวแรกที่เข้าเกมแล้ว: Swordman (`assets/v5/body_swordman.png`, `face_swordman.png`)

### สถานะ asset (2026-07-15)
- ฮีโร่ครบ 4/4: Swordman, Archer, Acolyte, Priestess (`assets/v5/body_*.png` + `face_*.png`)
- มอนสเตอร์ 2/4: Slime ✓ Wolf ✓ — **ยังขาด Imp, Orc** (`assets/v5/mon_*.png`)
- การ์ดร้านค้า redesign ตามภาพอ้างอิงแล้ว: แถบชื่อบน, พื้นเข้มอมสีคลาส, ภาพครึ่งตัวชิบิ
  (`bustPortrait` ครอปหัว+อกจาก body 56%), แท็กจุดสี, แถบราคาเหรียญ CSS
- กล้องเอียง ~45° (0,11,11) ให้กระดาน foreshorten เต็มจอแนวนอน + แท่น Bench
  ผูกขนาดกับช่องกระดานบนจอจริง (คำนวณใน resize())

### งานถัดไปของ V5
1. ภาพมอนสเตอร์ 2 ตัวสุดท้าย: Imp, Orc (พรอมป์อยู่ในแชท/ART_BRIEF — Orc ให้ตัวใหญ่กว่าปกติ)
2. ระบบ merge 3 ตัวเป็นดาว, สกิล/มานา (รอตัดสินใจตาม `COMBAT_DECISIONS.md` ข้อ A)
3. seeded RNG + combat log สำหรับ replay/บาลานซ์
4. อาชีพ/ฮีโร่เพิ่มเติมในอนาคต (ยังไม่มี concept): Tank/Guardian, Assassin, Support/Healer แยกจาก Mage

---

## เป้าหมายของโปรเจกต์
สร้างเกม Auto Battler สำหรับเว็บ/มือถือ โดยใช้ Three.js ในรูปแบบ 2.5D และต้องสามารถต่อยอดไปเล่นบน Android/iPad ได้

ภาพหน้าจอเป้าหมายคือแนว Auto Chess / Carano Chess:
- กระดานเป็นพื้นที่หลักกลางจอ
- มุมกล้องเอียงจากด้านบน
- UI บาง ชิดขอบจอ
- Synergy ด้านซ้าย
- Team/HP ด้านขวา
- Bench 6 ช่องอยู่ใต้กระดาน
- Shop 5 ใบอยู่ล่างสุด
- BUY EXP ซ้ายล่าง
- REFRESH ขวาล่าง
- ห้ามมี Panel โปร่งใสหรือ hit-area บังกระดาน

## กติกาเริ่มต้นที่ผู้ใช้ยืนยันแล้ว
- เริ่มเกมโดยไม่มีฮีโร่
- เริ่มด้วยทอง 3
- ฮีโร่ Class 1 ราคา 2 ทอง
- Board Level 1 ลงสนามได้สูงสุด 1 ตัว
- ซื้อ EXP ราคา 4 ทอง ได้ 4 EXP
- เลเวลกระดานสูงสุด 5 และลงได้สูงสุด 5 ตัว
- Bench มี 6 ช่อง
- Shop มี 5 ช่อง
- Refresh ราคา 2 ทอง
- ตัดระบบเพชรหรือข้อมูลที่เกมยังไม่มีออก
- ต้องลากฮีโร่จาก Bench ไปวางใน 3 แถวล่างของกระดานได้
- ต้องมีวิธีสำรอง: แตะฮีโร่ใน Bench แล้วแตะช่องกระดาน

## แนวทางเทคนิคที่ตกลงแล้ว
ใช้ Three.js ต่อ และทำเป็น 2.5D:
- กระดาน/ฉาก/ยูนิต/เงา/VFX อยู่ใน Three.js Canvas
- ตัวละครใช้ Sprite หรือ Sprite Sheet หันเข้ากล้อง
- UI HTML อยู่รอบขอบจอเท่านั้น
- Raycasting ใช้ลาก/แตะวางตัวลงช่อง
- รองรับ safe area ของ iPhone/iPad ด้วย env(safe-area-inset-*)

## สไตล์ภาพที่ผู้ใช้ต้องการ
- การ์ตูนแฟนตาซีแบบ chibi / anime-inspired
- ไม่เอาตัวเหลี่ยม หรือวงกลม placeholder
- Shop และ Bench ใช้ portrait ใบหน้าตัวละครขนาดเล็กที่ดูออกทันที
- ในสนามใช้ตัวเต็ม
- มอนสเตอร์ต้องเข้าธีมของด่าน
- ฉากต้องเป็นแมพป่าแฟนตาซีสวย ๆ ไม่ใช่พื้นสีเขียวโล่ง

## ไฟล์/เวอร์ชันสำคัญ
### เวอร์ชันที่กระดาน Three.js แสดงบนอุปกรณ์ได้
`threejs-2_5d-playtest-v2.html`

Commit:
`710bf2193f2347eb156a7227ff23daefb752e190`

ข้อดี:
- Three.js/กระดานแสดงบนมือถือและ iPad ได้
- มี CDN fallback

ข้อเสีย:
- Bench/Shop ซ้อนบน Canvas
- ระบบวางตัวยังไม่สมบูรณ์
- Shop เดิมใช้ emoji แทน portrait

### เวอร์ชัน V3 สำหรับ iPad
`threejs-2_5d-playtest-v3-ipad.html`

Commit:
`d5be81bc851ca6894da684827483170cdc4fa6c1`

ปัญหา:
- Shop และ Bench บังกระดาน
- การลากวางไม่ได้
- Portrait ยังกลับไปเป็น emoji บางส่วน

### เวอร์ชัน V4 แยก Layout
`threejs-2_5d-clean-v4.html`

Commit:
`874797cdfa796907d87158825258386a44714f78`

ปัญหา:
- Canvas/Three.js ไม่แสดง
- ร้านค้าและ Bench ว่าง
- ใช้งานไม่ได้

## คำแนะนำสำหรับ Claude Code
อย่าต่อยอดจาก V4
ให้เริ่มจาก `threejs-2_5d-playtest-v2.html` เพราะเป็นเวอร์ชันที่ Three.js แสดงจริงบนอุปกรณ์แล้ว

จากนั้น refactor layout โดย:
1. แยกหน้าเป็น 4 แถวจริงด้วย CSS Grid
   - Top HUD
   - Main battle area
   - Bench row
   - Shop row
2. วาง Canvas เฉพาะใน battle area เท่านั้น
3. Synergy/Team อยู่ซ้ายและขวาของ battle area
4. Bench/Shop ห้ามใช้ absolute overlay ทับ Canvas
5. ใช้ ResizeObserver ปรับ renderer ตามขนาด container ของ Canvas
6. Raycasting ต้องคำนวณจาก canvas.getBoundingClientRect()
7. เพิ่ม pointerdown/pointermove/pointerup สำหรับ drag บนมือถือ
8. เพิ่ม tap-select + tap-cell เป็น fallback
9. Shop และ Bench ใช้ portrait canvas หรือ image asset ไม่ใช้ emoji ดาบ/ธนู/ลูกแก้ว
10. ทดสอบ landscape ทั้ง Android และ iPad

## Acceptance Criteria รอบถัดไป
หน้าเปิดแล้วต้องเห็นทันที:
- กระดาน 8x8
- ฉากป่า
- Shop 5 ใบพร้อมปุ่มซื้อครบทุกใบ
- Bench 6 ช่อง
- UI ไม่บังกระดาน

Flow ที่ต้องผ่าน:
1. เริ่ม 3 ทอง
2. ซื้อฮีโร่ 1 ตัว ราคา 2
3. ฮีโร่เข้าช่อง Bench
4. ลากหรือแตะวางลง 3 แถวล่างได้
5. จำนวนบนสนามเปลี่ยนเป็น 1/1
6. กดเริ่มต่อสู้ได้
7. บน iPad ปุ่มซื้อไม่ถูก browser toolbar บัง

## หมายเหตุเรื่อง Asset
ตอนนี้ asset ในเกมส่วนใหญ่ยังเป็น placeholder ที่วาดด้วย Canvas/SVG
ภาพคอนเซปต์ที่สร้างไว้ยังไม่ได้ถูกนำเข้า GitHub เป็น production sprite จริง
ถ้าจะเพิ่ม asset จริง ควร:
- ตัดเป็นไฟล์ PNG/WebP โปร่งใส
- ทำ portrait แยก
- ทำ sprite sheet สำหรับ idle/walk/attack/hit/death
- เก็บไว้ใน `assets/heroes`, `assets/enemies`, `assets/maps`, `assets/vfx`

## Prompt ที่แนะนำให้ใช้ใน Claude Code
อ่านไฟล์ `CLAUDE_HANDOFF.md` ทั้งหมด แล้วตรวจ `threejs-2_5d-playtest-v2.html` เป็นฐาน
สร้างไฟล์ใหม่ชื่อ `threejs-2_5d-clean-v5.html`
ห้ามแก้ด้วย overlay แบบ absolute ที่บังกระดาน
ต้องแยก Canvas, Bench และ Shop เป็นคนละพื้นที่จริง
ทำให้ซื้อฮีโร่แล้วลากหรือแตะวางลง 3 แถวล่างได้บน Android/iPad
ใช้ portrait ใบหน้าตัวละครแทน emoji
หลังแก้ ให้เปิดตรวจ syntax, ตรวจ event flow และสรุปไฟล์/บรรทัดที่เปลี่ยน

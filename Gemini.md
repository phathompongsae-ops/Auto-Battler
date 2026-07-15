# Auto-Battler — Project Notes (Gemini)

บันทึกโปรเจกต์สำหรับผู้ช่วย AI อื่น (Gemini) ที่อาจเข้ามาต่องานบนโปรเจกต์นี้ทีหลัง
ไฟล์เกมหลักคือ `threejs-2_5d-clean-v5.html` (Three.js + vanilla JS, ไฟล์เดียวจบ)
บน branch `claude/threejs-2-5d-clean-v5-e80mbk` — ดูภาพรวมโปรเจกต์เต็มที่ `GDD.md`,
ประวัติงานของ Claude ที่ `CLAUDE_HANDOFF.md`, และแผนงาน Priority 1-7 ที่ `gemini_status.md`

## Boss spawn scaffold: stage 5/10/15 (placeholder — เสร็จแล้ว)

**ขอบเขต**: วางโครง Logic ให้สุ่ม/ล็อก ID บอสก่อนเริ่มด่าน 5, 10, 15 เท่านั้น —
**ยังไม่มีสเตตัส/สไปรท์บอสจริง** เป็นแค่โครงเผื่อไว้ให้ใส่ค่าทีหลัง ไม่แตะระบบ spawn
มอนสเตอร์ทั่วไป (`spawnWave()`) ที่ทำงานอยู่แล้ว

**เพิ่มอะไรบ้าง** (ทั้งหมดอยู่ใน `threejs-2_5d-clean-v5.html`):
- `BOSS_STAGE_POOL = {5:['boss_ph_5a','boss_ph_5b'], 10:['boss_ph_10a','boss_ph_10b'], 15:['boss_champion_big']}`
- `pickBossId(wave)` — สุ่ม 1 จาก pool ของ wave นั้น, คืน `null` ถ้า wave ไม่ใช่ 5/10/15
  (wave 15 มีตัวเลือกเดียวจึงเท่ากับ "ล็อกตาย" ที่ `boss_champion_big`)
- `state.currentBossId` — เก็บผลที่สุ่มได้ล่าสุด, `startBattleFn()` เรียก `pickBossId(state.wave)`
  ก่อน `spawnWave()` ทุกครั้งที่กดเริ่มต่อสู้
- toast + `console.info('[Boss placeholder] ...')` โชว์ ID ที่สุ่มได้ตอนเริ่มด่าน 5/10/15
  เพื่อให้เทสผ่านหน้าจอจริงได้โดยไม่ต้องเปิด devtools (ไม่ใช่ UI ถาวร เอาออกได้ตอนใส่บอสจริง)

**ทดสอบแล้ว**: unit-check แบบสุ่ม 2000 ครั้ง (wave 5/10 ได้สัดส่วนใกล้ 50/50, wave 15 ได้
`boss_champion_big` ทุกครั้ง) + เล่นจริงผ่าน Playwright จนถึง wave 16 เห็น toast ถูกต้องที่
wave 5 (`boss_ph_5b`), 10 (`boss_ph_10a`), 15 (`boss_champion_big`) ไม่มี console error/
request 404 เลยตลอดการเล่น

**Preview link (สำหรับเทสด้วยตัวเอง)**: https://claude.ai/code/artifact/b3630336-15c7-4e49-b789-eadc98d8e8e7
— แพ็กจาก `threejs-2_5d-clean-v5.html` โดยฝัง Three.js + asset ภาพทั้งหมดเป็นไฟล์เดียว
(สคริปต์แพ็ก `pack_artifact.py` อยู่นอกรีโป ไม่ได้ commit เพราะเป็นเครื่องมือช่วยพับลิชเท่านั้น
ไม่ใช่ส่วนของเกม) ระหว่างแพ็กเจอบั๊กเฉพาะจุด: การฝัง three.js ตรงๆ แล้วเรียก `boot()` ทันที
แบบ synchronous ทำให้ชน TDZ ของ `combatRunning` (error เพราะ `anim()`/`requestAnimationFrame`
ถูกเรียกก่อน `boot()` executes จบ) แก้ด้วยการห่อ `boot()` ด้วย `setTimeout(fn,0)` เพื่อคืน
macrotask boundary เหมือนตอนโหลดผ่าน `<script>` onload จริง — เป็นบั๊กเฉพาะไฟล์แพ็กสำหรับ
preview เท่านั้น **ไม่กระทบไฟล์เกมหลักที่ commit ไว้** (ไฟล์หลักยังโหลด Three.js ผ่าน CDN
`loadScript()` แบบเดิมซึ่งมี async boundary ตามธรรมชาติอยู่แล้ว)

## Priority 1 (gemini_status.md): Stabilize 15-stage run — เสร็จแล้ว

**ขอบเขต**: ทดสอบ flow เกมจริงตั้งแต่ wave 1 ถึง 15 หา error/404 ใน console แล้วแก้ให้หมด
ไม่แตะ logic ระบบอื่นที่ยังไม่ถึงคิว (merge/equipment/skill/modularization รอ Priority 3-7)

**บั๊กที่เจอและแก้** (ทั้งหมดอยู่ใน `threejs-2_5d-clean-v5.html`):
1. `loadWeaponAtlas()` ถูกเรียกตอน boot ทุกครั้ง แต่ `assets/icons/weapons/weapon_icons.webp`
   และ `.json` ยังไม่มีไฟล์จริงในโปรเจกต์ → 404 ทุกครั้งที่เปิดเกม แก้โดยเอาการเรียกใช้ตอน boot
   ออกก่อน (เก็บฟังก์ชันไว้เฉยๆ) จนกว่าไฟล์ atlas จริงจะมา — ไอคอนอาวุธยังทำงานปกติผ่าน
   fallback วาดด้วย canvas เดิม (`weaponIconCanvas()`)
2. ไม่มี `<link rel="icon">` → เบราว์เซอร์ยิง request `favicon.ico` อัตโนมัติแล้ว 404 ขึ้น
   console เป็น error เสมอ แก้โดยเพิ่ม favicon แบบ inline SVG data-URI (ไม่มี asset ไฟล์เพิ่ม)

**ทดสอบแล้ว**: รัน flow จริงผ่าน Playwright (ซื้อฮีโร่/อัปเลเวล/วางกระดาน/ต่อสู้/ซื้ออาวุธ
วนอัตโนมัติ) ตั้งแต่ wave 1 ถึง wave 15 ครบ (ชนะ wave 15 → ขึ้น wave 16) โดยไม่มี console error
และไม่มี request ที่ 404/failed เลยตลอดการรัน — ระบบ HP/multiplier ตามด่าน (×1/×3/×5),
ร้านฮีโร่ (การันตี Swordman wave 1, รีโรลฟรีตอนชนะ), และร้านอาวุธ popup ทำงานถูกต้องทุกจุด
ที่ทดสอบ

## อัปเดตก่อนหน้า: ลดร้านค้าฮีโร่จาก 5 ช่อง เหลือ 3 ช่อง

**ทำไม**: ปรับสมดุลจังหวะเกม/พื้นที่หน้าจอให้ร้านฮีโร่ (แถวล่างสุด) กระชับขึ้น
โดยไม่แตะพฤติกรรมอื่นของร้านค้า

**เปลี่ยนอะไรบ้าง** (ทั้งหมดอยู่ใน `threejs-2_5d-clean-v5.html`):
- `SHOP_SLOTS = 3` (เดิม hardcode 5 ช่องใน `refillOffers()`)
- `refillOffers()` สุ่มฮีโร่ตามจำนวน `SHOP_SLOTS` แทนอาร์เรย์ `[0,1,2,3,4]` เดิม
- CSS `.shop{grid-template-columns:repeat(3,minmax(0,1fr))}` (เดิม `repeat(5,...)`)
  และลดความกว้างสูงสุดของแถบร้านจาก `min(100%,45vw,620px)` → `min(100%,30vw,380px)`
  เพื่อให้การ์ด 3 ใบยังคงสัดส่วน/ระยะห่างสวยงามเท่าของเดิม ไม่ยืดกว้างเกินไป
- ปุ่ม REFRESH (2 ทอง) และการซื้อฮีโร่ (2 ทอง/ตัว) — **ไม่เปลี่ยน** ตามที่ผู้ใช้ยืนยัน

**ผูกกับฟีเจอร์ที่เพิ่มพร้อมกันในรอบเดียวกัน** (ดูรายละเอียดเต็มใน git log):
- Wave 1 การันตี Swordman ในช่องแรกของร้านฮีโร่เสมอ (คงอยู่แม้กด REFRESH ระหว่าง wave 1)
- ร้านฮีโร่รีโรลฟรีอัตโนมัติทุกครั้งที่ชนะด่าน (เรียก `refillOffers()` ใน `endBattle(true)`)
- ระบบ Player HP กลาง (`state.playerHP`, เริ่ม 100) แทนระบบ "แพ้ทันทีถ้าเคลียร์ไม่หมด" เดิม —
  เคลียร์ไม่หมด = โดนความเสียหายตามสูตร `monstersLeft * waveDamageMultiplier(wave)`
  (Wave 1-5 ×1, 6-10 ×3, 11+ ×5) แล้วเดินหน้า wave ถัดไปเสมอ (แบบ TFT) จนกว่า HP จะหมด
- ร้านอาวุธ (`ShowWeaponShopPopup()`) เป็น modal กลางจอ สุ่ม 3-4 ชิ้นจาก `WEAPON_POOL`
  มีระบบ rarity สี (Common เทา / Rare น้ำเงิน / Epic ม่วง) ตาม `level`

**ทดสอบแล้ว** ผ่าน Playwright headless (Chromium): จำนวนช่องร้าน, การันตี Swordman,
เลย์เอาต์ 3 ขนาดจอ (851×393 / 1024×768 / 1194×834), และ flow ซื้อ-วาง-ต่อสู้-ชนะ/แพ้เต็มรอบ
ไม่พบ error ใน console

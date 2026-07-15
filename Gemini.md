# Auto-Battler — Project Notes (Gemini)

บันทึกโปรเจกต์สำหรับผู้ช่วย AI อื่น (Gemini) ที่อาจเข้ามาต่องานบนโปรเจกต์นี้ทีหลัง

## ไฟล์หลักไฟล์เดียว: `autochess.html`

โปรเจกต์นี้เคยมีเกม 2 ไฟล์แยกกัน (`threejs-2_5d-clean-v5.html` และ `autochess.html`)
ซึ่งทำให้สับสนว่าจะแก้ไฟล์ไหน — **ยุบรวมเสร็จแล้ว: `autochess.html` คือไฟล์เดียวที่ใช้
พัฒนาต่อจากนี้** บน branch `claude/threejs-2-5d-clean-v5-e80mbk`

`threejs-2_5d-clean-v5.html` ถูกย้ายไปเก็บที่ `archive_backup/threejs-2_5d-clean-v5.html`
เป็นข้อมูลอ้างอิงเท่านั้น (มี git history เต็มถ้าต้องย้อนดูของเดิม) **ไม่ใช่ไฟล์ที่ใช้งานอีกต่อไป**
ฟีเจอร์ที่ดีที่สุดของมัน (ระบบลากวาง + Camera Zoom) ถูกดึงมาสร้างใหม่ใน `autochess.html`
เรียบร้อยแล้วก่อนลบ (ดูหัวข้อด้านล่าง)

ดูภาพรวมโปรเจกต์เต็มที่ `GDD.md`, ประวัติงานของ Claude ที่ `CLAUDE_HANDOFF.md`, และแผนงาน
Priority 1-7 ที่ `gemini_status.md`

## สถานะฟีเจอร์ปัจจุบันใน `autochess.html` (ล่าสุด)

**Roster / Hero data**
- `HERO_DEFS`: 21 ฮีโร่ (7 tier-1 + 14 tier-2 ผ่าน `evolves_from`) โครงสร้าง
  `stats:{hp,p_atk,m_atk,p_def,m_def,move_speed,attack_speed,attack_range}`, `attack_type`,
  `synergy[]`, `active_skill` (ข้อมูลอธิบายเท่านั้น ยังไม่ implement เป็น combat logic จริง)
- มีภาพจริงแค่ 8/21 ตัว (blade_master, beast_lord, trickster, duelist, archmage,
  frost_weaver, summoner, sniper) — อีก 13 ตัว map ไปใช้ภาพใกล้เคียงตาม role/attack_type
  เป็น placeholder ชั่วคราว (ดูคอมเมนต์เหนือ `HERO_DEFS` ในโค้ด, สลับเป็นภาพจริงทีหลังได้)

**Shop / Auto-Merge**
- ร้านค้าขายเฉพาะ tier-1 (`ownedPool` filter `class_tier===1`) — tier-2 ได้จากการเมิร์จเท่านั้น
- `checkAndMergeUnits()`: เรียกหลัง `buyHero`/`unplaceUnit` ทุกครั้ง — ครบ 3 ตัว tier-1 เดียวกัน
  บนม้านั่งสำรอง → ลบทิ้งแล้วสุ่ม 1 ใน 2 สาย tier-2 มาแทน วนซ้ำได้ถ้าเมิร์จได้หลายชุดพร้อมกัน

**Combat**
- `attackerRawAtk()`/`mitigateDamage()`: เลือก p_atk/m_atk ตาม `attack_type` แล้วหักด้วย
  `p_def`/`m_def` แบบลบตรงๆ (ฮีโร่ใหม่) — มอนสเตอร์/บอสเดิมที่มีแค่ `armor` (%) ยังใช้สูตรเดิม
  ไม่เปลี่ยน (แยกพาธตาม target ที่มี `armor` หรือไม่ กันบาลานซ์มอนสเตอร์เดิมพัง)
- **ระบบ Link bonus เดิม (`SYNERGIES`: trade_route/arcane_duo/warband) เป็น inert แล้ว** —
  synergy tag ย้ายไปอยู่ใน `def.synergy` ของแต่ละฮีโร่ (แทน `HERO_TAGS` เดิม) แต่ tag vocabulary
  ใหม่ (Warrior/Guardian/Swordsman ฯลฯ) ไม่ตรงกับคอมโบเดิมเลย ยังไม่ได้ออกแบบคอมโบใหม่ให้
  (เป็นการตัดสินใจ balance ที่ต้องถามก่อน ไม่ได้ทำเอง)

**Camera / UX**
- `CAMERA_ZOOM = 5.0` (เดิม 7.2) — กระดาน 8x8 เต็มจอมากขึ้น ตรวจสอบแล้วไม่โดนขอบ HUD
  บนตัดทั้ง desktop/tablet/phone-landscape
- ระบบลากวางฮีโร่จริง (`benchDrag`, เดิมมีแค่คลิกเลือก-แล้วคลิกวาง): ghost sprite ลอยเยื้อง
  ขึ้นเหนือนิ้ว/เมาส์ 56px (`GHOST_Y_OFFSET`) ระหว่างลาก ไม่บังช่องกระดานที่กำลังจะวาง —
  แตะเฉยๆ (ไม่ลาก) ยัง fallback ไปที่ระบบเลือก-แล้วแตะกระดานเดิมได้
- Speed multiplier x1→x2→x4 (ปุ่ม `#speedBtn`) สำหรับเทสเร็ว — ปลอดภัยที่ x4 (ตรวจสอบแล้ว):
  `dt` cap 50ms ก่อนคูณ, attack range เช็คจาก grid distance ไม่เกี่ยวกับ dt, ดาเมจคำนวณทันที
  ตอน cooldown หมด (ไม่มี projectile ที่ travel แล้วอาจ overshoot)

**Equipment scaffold (Priority 4 — ยังไม่ wire เข้า combat)**
- `ITEM_BASE`: 4 base items + 10 combined items (recipe จาก 2 base items) พร้อม stats/passive
  description — ยังเป็นแค่ data, ไม่มี logic ซื้อ/สวมใส่/คำนวณสเตตัสจริง
- ฮีโร่ที่วางบนกระดานมี `equipment: []` เป็นค่าเริ่มต้น (สูงสุด 2 ชิ้น/ตัวในอนาคต)

**อื่นๆ ที่มีอยู่แล้วก่อนรอบนี้** (ยังทำงานอยู่ ไม่ได้แตะ): ระบบ wave 1-15 พร้อมด่านบอสจริงที่
stage 5/10/13/15 (`bossWave()`), quota แพ้ได้ 3 ครั้งต่อรัน, bench คนละ 6 ช่อง, field สูงสุด 5 ตัว

**ทดสอบแล้วทั้งหมดรวมกันในไฟล์เดียว**: HERO_DEFS/ownedPool/damage-fn/merge-fn มีครบ, ghost
offset 56px ถูกต้อง, ลากวางสำเร็จ, merge test (เช่น 3x mage → archmage), เล่นจริงซื้อ-ลากวาง-
x4-ต่อสู้จบ ไม่มี console/page error ใหม่เลย

## บทเรียนสำคัญ

ก่อนหน้านี้เคยสับสนไฟล์หลายรอบเพราะชื่อ/ศัพท์คล้ายกันมาก (`HERO_DEFS` vs `HEROES`,
"ม้านั่งสำรอง/Bench" มีทั้งคู่) — ตอนนี้เหลือไฟล์เดียวแล้วปัญหานี้หมดไป แต่ถ้ามีคนอ้างถึง
`threejs-2_5d-clean-v5.html` อีกในอนาคต ให้เข้าใจว่านั่นคือไฟล์ที่ถูก archive แล้ว
ไม่ใช่ไฟล์ที่ควรแก้ไข — ยืนยันกับผู้ใช้ก่อนเสมอถ้าไม่แน่ใจ

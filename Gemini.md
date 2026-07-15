# Auto-Battler — Project Notes (Gemini)

บันทึกโปรเจกต์สำหรับผู้ช่วย AI อื่น (Gemini) ที่อาจเข้ามาต่องานบนโปรเจกต์นี้ทีหลัง
โปรเจกต์นี้มี **เกม 2 ไฟล์แยกกัน** บน branch `claude/threejs-2-5d-clean-v5-e80mbk`:
- `threejs-2_5d-clean-v5.html` — Three.js + vanilla JS ไฟล์เดียวจบ, ใช้ `state`/`HEROES`/
  `CONFIG` (จาก `game_config.json`), มีระบบบอส stage 5/10/15 แบบ scaffold (`BOSS_POOL`)
- `autochess.html` — เกมคนละตัว คนละ schema กันโดยสิ้นเชิง (`HERO_DEFS`/`benchHeroes`/
  `placedUnits`, ระบบ tier-1→tier-2 evolution + merge) — **เช็กก่อนแก้เสมอว่า user
  หมายถึงไฟล์ไหน** เพราะชื่อ/ศัพท์คล้ายกันมาก (เคยสับสนมาแล้วหลายรอบในเซสชันนี้)

ดูภาพรวมโปรเจกต์เต็มที่ `GDD.md`, ประวัติงานของ Claude ที่ `CLAUDE_HANDOFF.md`, และแผนงาน
Priority 1-7 ที่ `gemini_status.md`

## autochess.html: Hero roster ใหม่ + Physical/Magic damage + Auto-merge + Tier-1 shop — เสร็จแล้ว

**เปลี่ยนอะไรบ้าง** (ทั้งหมดอยู่ใน `autochess.html`):
- แทนที่ `HERO_DEFS` ทั้งหมดด้วยข้อมูลใหม่ 21 ตัว (7 tier-1 + 14 tier-2 ผ่าน `evolves_from`)
  โครงสร้างใหม่: `stats:{hp,p_atk,m_atk,p_def,m_def,move_speed,attack_speed,attack_range}`,
  `attack_type`, `synergy[]`, `active_skill` (data อธิบายเท่านั้น ยังไม่ implement เป็น
  combat logic) — มีแค่ 8/21 ตัวที่มีภาพจริง (blade_master, beast_lord, trickster, duelist,
  archmage, frost_weaver, summoner, sniper) อีก 13 ตัว map ไปใช้ภาพที่ใกล้เคียงที่สุดตาม
  role/attack_type ไปพลางก่อน (คอมเมนต์ไว้ในโค้ดตรง `HERO_DEFS` — สลับเป็นภาพจริงทีหลังได้)
- ย้าย synergy tag จาก `HERO_TAGS` แยกมาอยู่ใน `def.synergy` ของแต่ละฮีโร่แทน — **ระบบ Link
  bonus เดิม (`SYNERGIES`: trade_route/arcane_duo/warband) ใช้ tag คนละชุดกับของใหม่ ตอนนี้
  จึงเป็น inert (ไม่ error แค่ไม่ trigger)** ยังไม่ได้ออกแบบคอมโบใหม่ให้ (ไม่ใช่การตัดสินใจ
  balance ที่ควรทำเองโดยไม่ถาม)
- Combat: `attackerRawAtk()`/`mitigateDamage()` — เลือก p_atk/m_atk ตาม `attack_type` แล้วหัก
  ด้วย `p_def`/`m_def` แบบลบตรงๆ (ฮีโร่) ส่วนมอนสเตอร์/บอสเดิมที่มีแค่ `armor` (%) ยังใช้สูตร
  เดิมไม่เปลี่ยน (กันบาลานซ์ monster เดิมพัง)
- `checkAndMergeUnits()` — เรียกหลัง `buyHero`/`unplaceUnit` ทุกครั้ง ครบ 3 ตัว tier-1
  เดียวกันบนม้านั่งสำรอง → ลบทิ้งแล้วสุ่ม 1 ใน 2 สาย tier-2 มาแทน วนซ้ำได้ถ้าเมิร์จได้
  หลายชุดพร้อมกัน
- `ownedPool` filter เหลือแค่ `class_tier===1` — ร้านค้า/รีโรลจะไม่มีทางสุ่มเจอ tier-2 เลย
  (tier-2 ได้จากการเมิร์จเท่านั้น)

**ทดสอบแล้ว**: สูตรดาเมจ unit test (physical/magic/armor เดิม/เกราะเกิน), กระจายสุ่มเมิร์จ
200 รอบ (~50/50), multi-merge + double-merge-in-one-call, shop คงเหลือ tier-1 ตลอด 15 รีโรล,
เล่นจริงซื้อ-ลากวาง-x4-ต่อสู้จบ ไม่มี console/page error ใหม่เลย

## autochess.html: Camera Zoom + Drag-to-place ghost sprite — เสร็จแล้ว

- `CAMERA_ZOOM` 7.2 → 5.0 ให้กระดาน 8x8 เต็มจอมากขึ้น (เช็ก desktop/tablet/phone-landscape
  ไม่โดนขอบ HUD บนตัด)
- เพิ่มระบบลากวางจริง (เดิมมีแค่คลิกเลือก-แล้วคลิกวาง) — ghost sprite ลอยเยื้องขึ้นเหนือ
  นิ้ว/เมาส์ 56px (`GHOST_Y_OFFSET`) ระหว่างลาก เพื่อไม่ให้บังช่องกระดาน แตะเฉยๆ (ไม่ลาก)
  ยัง fallback ไปที่ระบบเดิมได้
- ไม่แตะ Grid width/จำนวนช่อง และ Combat Logic — click-to-unplace ยังทำงานถูกต้องเหมือนเดิม

## threejs-2_5d-clean-v5.html: Game Speed Multiplier (Fast Forward) x1-x4 — เสร็จแล้ว

**หมายเหตุ**: `state.speedMul` (ปุ่ม ×1/×2/×4 มุมขวาบน HUD) มีอยู่แล้วในไฟล์ก่อนหน้านี้ — คูณเข้ากับ
`dt` ก่อนส่งเข้า `updateCombat()` ใน `anim()` loop รอบนี้แค่เติม x3 เข้าไปในวงจรปุ่ม และเพิ่มปุ่มลัด

**เปลี่ยนอะไรบ้าง** (ทั้งหมดอยู่ใน `threejs-2_5d-clean-v5.html`):
- `setSpeedMul(mul)` (ใหม่) — set `state.speedMul` + อัปเดตข้อความปุ่ม `#speed`
- ปุ่ม `#speed` คลิกวนครบ x1→x2→x3→x4→x1 (เดิมข้าม x3)
- คีย์ลัดตัวเลข 1/2/3/4 บนคีย์บอร์ด (global `keydown` listener) เซตความเร็วได้ real-time
  ระหว่างเทส ไม่ต้องกดปุ่มไล่ทีละสเต็ป

**ความปลอดภัยที่ x4** (ตรวจสอบแล้ว ไม่ใช่แค่ทฤษฎี): `dt` ถูก cap ที่ 50ms ของเวลาจริงต่อเฟรม
ก่อนคูณด้วย `speedMul` (`Math.min(.05,...)`) ดังนั้น x4 แค่จำลอง "เวลาเกม" ต่อเฟรมมากขึ้น
ไม่ใช่ physics step ที่ใหญ่ผิดปกติ — ระยะโจมตีเช็คจาก tile distance (Chebyshev) ไม่เกี่ยวกับ dt
เลย และการชนของ projectile เช็ค "ระยะที่เหลือ <= ระยะที่เดินได้ในเฟรมนี้" เป็นการชนแทนที่จะปล่อย
ให้ overshoot ข้ามเป้าไปเฉยๆ จึงชนไม่พลาดแม้ dt ใหญ่ที่ x4

**ทดสอบแล้ว**: กดคีย์ 1-4 และคลิกปุ่ม `#speed` วนครบ 5 รอบ ได้ label/ค่าใน state ถูกต้องทุกครั้ง
+ รันแบบเทลจริงที่ x4 ทั้งด่านจบใน ~5 วินาที (เทียบ x1 ใช้ ~15-20 วินาที) ไม่มี console/page error

**Preview link อัปเดตแล้ว (URL เดิม)**: https://claude.ai/code/artifact/b3630336-15c7-4e49-b789-eadc98d8e8e7

## Physical/Magic damage split ในระบบ Combat — เสร็จแล้ว

**ขอบเขต**: เพิ่มการคำนวณดาเมจ 2 ประเภท (Physical/Magic) ในระบบต่อสู้จริง และอัปเดต
`BOSS_POOL` ให้มี `p_atk/m_atk/p_def/m_def` แทนฟิลด์ `atk` เดิม

**เปลี่ยนอะไรบ้าง** (ทั้งหมดอยู่ใน `threejs-2_5d-clean-v5.html`):
- `computeDamage(attacker, target)` (ใหม่) — `Physical = max(0, attacker.pAtk - target.pDef)`,
  `Magic = max(0, attacker.mAtk - target.mDef)`, บวกกันเป็นดาเมจสุทธิ (ไม่มีเกราะเกินจน "รักษา")
- `makeUnit()` แตกค่า `pAtk/mAtk/pDef/mDef` ต่อยูนิต — `BOSS_POOL` ใช้ค่าจริงตรงๆ
  ส่วนฮีโร่ (`STATS`) และมอนสเตอร์ (`MONSTERS`) เดิมที่มีแค่ `atk` เดี่ยวไม่มีเกราะเลย
  ถูก map เป็น pure-physical + เกราะ 0 ทั้งสองด้าน (`max(0, atk-0) === atk`) **บาลานซ์เดิม
  ไม่เปลี่ยนแปลง**
- จุดคำนวณดาเมจทั้ง 2 จุด (ประชิด `applyDamage` และระยะไกล `spawnProjectile`) เปลี่ยนจาก
  `u.atk` คงที่ → เรียก `computeDamage(u, target)` แทน เพราะดาเมจขึ้นกับเกราะของเป้าหมายด้วย
- `BOSS_POOL` อัปเดตเป็นชุดข้อมูลใหม่ (p_atk/m_atk/p_def/m_def แทน `atk` เดิม) — mechanics/theme
  ยังเป็น comment เท่านั้นตามเดิม ไม่มี push/stun/warp/target-switch หรือ spawn บอสจริงลงกระดาน

**ทดสอบแล้ว**: unit-check สูตรคำนวณแยก (ยูนิตเดิมได้ดาเมจเท่าเดิมเป๊ะ, บอสใหม่หักเกราะถูกต้อง,
เกราะเกินไม่ทำให้ "ติดลบกลายเป็นบวก") + เล่นจริงผ่าน Playwright ถึง wave 16 ไม่มี console error/
request ล้มเหลวเลย toast บอส wave 15 โชว่ P.ATK/M.ATK ถูกต้อง

## Boss data wired: real BOSS_POOL (name/hp/atk) — เสร็จแล้ว

**ขอบเขต**: แทนที่ ID-only placeholder ด้วยข้อมูลบอสจริงที่ทีมออกแบบส่งมา (name/hp/atk)
ยังคงเป็น data-resolution เท่านั้น — **ยังไม่ spawn บอสจริงลงกระดาน ไม่มี combat AI**

**เปลี่ยนอะไรบ้าง** (ทั้งหมดอยู่ใน `threejs-2_5d-clean-v5.html`):
- `BOSS_STAGE_POOL` เดิม → เปลี่ยนชื่อเป็น `STAGE_PLAN` (โครงสร้าง stage→boss-ID list เดิมทุกอย่าง)
- เพิ่ม `BOSS_POOL` (array ข้อมูลจริง 5 ตัว: `boss_ph_5a/5b`, `boss_ph_10a/10b`, `boss_champion_big`)
  แต่ละตัวมี `{id, name, hp, atk}` — ค่า mechanics/theme (Shield Slam, Bone Breath, Seismic Line,
  mark-and-warp, King's Judgment ฯลฯ) ใส่เป็น **comment เหนือแต่ละ entry เท่านั้น** ตามที่ขอ
  ยังไม่ implement เป็น combat logic (ไม่มี push/stun/warp/target-switch จริง)
- `BOSS_POOL_BY_ID` + `getBossData(id)` — lookup จาก id ไปเป็น object ข้อมูลเต็ม
- `state.currentBoss` (ใหม่) — เก็บผลลัพธ์ `getBossData(pickBossId(state.wave))` เต็ม object,
  คู่กับ `state.currentBossId` เดิม; toast ตอนเริ่มด่าน 5/10/15 โชว์ชื่อ+HP+ATK จริงแล้ว
  (เช่น "สุ่มได้: Bone Dragon Whelp (HP 760 / ATK 28)")

**ทดสอบแล้ว**: เล่นจริงผ่าน Playwright ถึง wave 16 — wave 5 ได้ Bone Dragon Whelp (HP 760/ATK 28),
wave 10 ได้ Shadow Huntress (HP 1150/ATK 36), wave 15 ได้ Immortal Champion (HP 3200/ATK 48,
ล็อกทุกครั้ง) — ไม่มี console error/request ล้มเหลวเลยตลอดการเล่น

## Boss spawn scaffold: stage 5/10/15 (placeholder — เสร็จแล้ว, ดูข้อมูลจริงในหัวข้อด้านบน)

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

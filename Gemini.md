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

**Link System V2 (data-driven, instance-based — เสร็จแล้ว แทนที่ระบบเดิมทั้งหมด)**
- ฮีโร่แต่ละตัวมี `primaryLinkTag` (vanguard/striker/ranger/caster/support/summoner/merchant)
  เป็น tag เดียวที่นับเข้า Link — `def.synergy[]` เดิมเป็นแค่ label โชว์ผล ไม่ถูกนับ
- Bench เก็บเป็น hero instance `{instanceId, heroKey}` (`createHeroInstance`) แทน heyKey ตรงๆ
  ทำให้แยกฮีโร่ซ้ำกันบน bench/field ออกจากกันได้ (`placeHeroAt` รับ bench index แทน heroKey)
- `linkedInstanceIds` (Set) คือ source of truth เดียวว่าฮีโร่ตัวไหนถูกเลือกเข้า Link —
  `toggleLinkByInstanceId`/`sanitizeLinkSelection` (ล้าง id ที่ตัวลงจากสนามไปแล้วอัตโนมัติ)/
  `showLinkFullWarning` (แจ้งเตือนกระพริบเองเมื่อกดตัวที่ 4 ตอน Link เต็ม 3/3)
- `LINK_SYNERGIES`: 7 สาย ตาม tag, แต่ละสายมี tier2/tier3 — เปิดแค่ tier สูงสุดที่ถึงเกณฑ์เท่านั้น
  (ไม่ stack tier ซ้อนกันในสายเดียวกัน) แต่ **สายที่ต่างกันได้ stack กัน** แล้ว cap รวมต่อสเตต
  (dmgPct/atkSpeedPct สูงสุด 25%, armorPen/damageReduction สูงสุด 20%, goldPerVictory สูงสุด 2/wave)
- Buff freeze ต่อไฟต์: `applyPreCombatLinkBuffs()` (เรียกตอนกด "เริ่มการต่อสู้" ก่อน spawnWave)
  ล็อค `combatLinkBuffs` ทั้งไฟต์ และคำนวณ maxHp ใหม่จาก `baseMaxHp` (ค่าคงที่) ทุกครั้ง —
  กัน maxHpPct ทบไปเรื่อยๆ ข้ามด่าน — `applyCombatLinkModifiers()` ใช้ snapshot นี้ตอนคำนวณดาเมจ
  แต่ละครั้งแทนการเรียก `getTeamBuffs()` สดๆ ระหว่างไฟต์
- ทดสอบผ่าน Playwright ครบทั้ง 9 acceptance scenarios ของ spec (highest-tier-only, ไม่ double-count
  ข้าม tag, fallback 'unassigned' ตอนฮีโร่ไม่มี primaryLinkTag, ลิงก์หลุดอัตโนมัติเมื่อถอนฮีโร่
  ออกจากสนาม, HP ไม่ทบเมื่อเรียก applyPreCombatLinkBuffs ซ้ำ, merchant gold cap ที่ 2/wave,
  บล็อกตัวที่ 4 พร้อมข้อความเตือน, เล่นจริงหลายด่านรวมด่านบอสที่ speed x4 ไม่มี NaN/error)

**Camera / UX**
- `CAMERA_ZOOM = 5.0` (เดิม 7.2) — กระดาน 8x8 เต็มจอมากขึ้น ตรวจสอบแล้วไม่โดนขอบ HUD
  บนตัดทั้ง desktop/tablet/phone-landscape
- ระบบลากวางฮีโร่จริง (`benchDrag`, เดิมมีแค่คลิกเลือก-แล้วคลิกวาง): ghost sprite ลอยเยื้อง
  ขึ้นเหนือนิ้ว/เมาส์ 56px (`GHOST_Y_OFFSET`) ระหว่างลาก ไม่บังช่องกระดานที่กำลังจะวาง —
  แตะเฉยๆ (ไม่ลาก) ยัง fallback ไปที่ระบบเลือก-แล้วแตะกระดานเดิมได้
- Speed multiplier x1→x2→x4 (ปุ่ม `#speedBtn`) สำหรับเทสเร็ว — ปลอดภัยที่ x4 (ตรวจสอบแล้ว):
  `dt` cap 50ms ก่อนคูณ, attack range เช็คจาก grid distance ไม่เกี่ยวกับ dt, ดาเมจคำนวณทันที
  ตอน cooldown หมด (ไม่มี projectile ที่ travel แล้วอาจ overshoot)

**Equipment Core Data & Stat Pipeline (เสร็จแล้ว — ยังไม่มี UI ลากวางไอเทม)**
- `ITEM_BASE`: 4 base items + 10 combined items (recipe จาก 2 base items) พร้อม stats/passive
  description — `ITEM_DEFS_BY_ID` รวมทั้งสองกลุ่มเป็น lookup เดียวด้วย id
- `playerState.inventory` (`capacity:20, itemInstanceIds:[]`) + `playerState.itemInstances`
  (instanceId → `{instanceId, itemDefId, location:'inventory'|'equipped', ownerHeroId}`) —
  `createItemInstance(itemDefId)` สร้าง item instance ใหม่ลงกระเป๋า (ยังไม่มีร้านขายไอเทมจริง
  ฟังก์ชันนี้เป็นแค่ factory ขั้นต่ำให้มีของทดสอบ equip/unequip ได้)
- ฮีโร่ที่วางบนกระดานมี `equipment: [null, null]` (2 ช่องตายตัวเสมอ), `combatStats: null`,
  และ `baseStats` (สแนปช็อตค่าดิบจาก `HERO_DEFS.stats` ตอนวาง — ห้ามแก้ไขทับ, `buildCombatStats`
  clone จากตัวนี้เสมอ)
- `equipItem(hero, itemInstanceId, slotIndex)`/`unequipItem(hero, slotIndex)`: ตรวจช่อง (0/1),
  ตรวจว่าช่องว่าง/ของอยู่ใน inventory จริง, ตรวจ inventory เต็มก่อน unequip — ย้าย item ระหว่าง
  `hero.equipment[]` กับ `playerState.inventory.itemInstanceIds` พร้อมอัปเดต `location`/`ownerHeroId`
  ของ item instance ให้ตรงกันเสมอ
- `buildCombatStats(hero, itemDefs)`: clone `hero.baseStats` → บวก item `stats` (flat) ทุกชิ้นก่อน
  แล้วค่อยคูณ `percent_stats` (ถ้ามี item ไหนนิยามไว้ — ชุดข้อมูลปัจจุบันยังไม่มี item ไหนใช้ percent
  เลย) → clamp `attack_speed` ที่ [0.2, 3.0] และ floor `hp/p_atk/m_atk/p_def/m_def` ที่ 0 → เซ็ตผลลัพธ์
  ไว้ที่ `hero.combatStats`
- Integration: เรียก `buildCombatStats` ให้ฮีโร่ทุกตัวบนกระดานตอนกด "เริ่มการต่อสู้"
  (ก่อน `applyPreCombatLinkBuffs()`/`spawnWave()`) — `attackerRawAtk()`/`mitigateDamage()`/
  attack-range และ attack-speed ใน `updateUnit()` เปลี่ยนไปอ่านจาก `u.combatStats` แทนค่า
  camelCase เดิม (`pAtk`/`mAtk`/`pDef`/`mDef`/`atkSpeed`/`range`) เมื่อมีค่านี้ — มอนสเตอร์/บอส
  ไม่มี `combatStats` เลย จึง fallback ไปใช้พาธเดิมอัตโนมัติ ไม่กระทบบาลานซ์มอนสเตอร์
- ทดสอบผ่าน Playwright ครบ: equip/unequip สำเร็จ+ถูกบล็อกถูกกรณี (ช่องเต็ม/inventory เต็ม),
  `baseStats` ไม่ถูกแก้ไขทับหลัง `buildCombatStats`, ค่า stats รวมถูกต้อง (เช่น ดาบพิฆาต +38 p_atk),
  clamp ทำงานถูกทั้งขอบบน (attack_speed) และขอบล่าง (p_def ติดลบ), รบจริงที่ดาเมจคำนวณจาก
  `combatStats` แล้ว ไม่มี NaN
- ยังไม่มี: ร้านขายไอเทมจริง (ยังไม่มีจุดซื้อไอเทมในเกม มีแค่ `createItemInstance()` เป็น factory
  ขั้นต่ำ), `percent_stats` field ในข้อมูล item จริง (โครงสร้างรองรับแล้วแต่ยังไม่มี item ไหนใช้)

**Equipment UI & Drag-and-Drop (เสร็จแล้ว)**
- `#inventoryPanel`: แถบกระเป๋าไอเทมลอยมุมซ้ายล่าง (เหนือ `#bottomUI`) แสดงไอเทมทั้งหมดใน
  `playerState.inventory` — ไอคอนเลือกอัตโนมัติจากชนิดสเตตัสของไอเทม (`itemIcon()`, ยังไม่มีภาพจริง)
- `#equipModal`: เปิดจากปุ่ม ⚙ บนการ์ดฮีโร่ (ทั้งม้านั่งและสนาม) — โชว์ชื่อฮีโร่ + 2 ช่องไอเทม
  (`equipSlot`, ว่าง/มีของ) + สำเนารายการกระเป๋าไอเทมของตัวเองในหน้าต่างเดียวกัน (ตั้งใจให้ลาก
  จากในหน้าต่างเดียวกันได้เลย เพราะพื้นหลังโมดัลบังการ์ดข้างหลังจากลากไม่ถึง)
- ระบบลากไอเทม (`itemDrag`) ใช้แพทเทิร์นเดียวกับการลากฮีโร่ (`benchDrag`) คือ ghost ลอยเยื้อง
  ขึ้นเหนือนิ้ว 40px: ลากจากแถบกระเป๋าพื้นหลังไปวางบนการ์ดฮีโร่ตัวไหนก็ได้ (ม้านั่ง/สนาม) →
  `equipItem` เข้าช่องว่างช่องแรกอัตโนมัติ; ลากไอเทมที่สวมอยู่ในโมดัลออกไปนอกช่อง → `unequipItem`
  กลับเข้ากระเป๋า; ลากจากกระเป๋าในโมดัลไปตรงช่องที่ต้องการ → `equipItem` เข้าช่องนั้นเป๊ะๆ
- Visual feedback: ฮีโร่ที่มีไอเทมสวมอยู่ ≥1 ชิ้น มีสัญลักษณ์ ⚙ ลอยเหนือหัว (THREE.Sprite,
  `updateEquipBadge()`) บนกระดานจริง และจุด "•" ต่อท้ายปุ่ม ⚙ บนการ์ด 2D ด้วย
- ลากพลาด/วางช่องเต็ม → ไอเทมเด้งกลับตำแหน่งเดิมด้วย CSS transition (`bounceBackItemGhost`)
  ไม่มีการทำลายไอเทมทิ้งในทุกกรณี
- แก้ไขเพิ่มเพื่อความถูกต้อง (ไม่ได้ระบุในสเปกเดิมแต่จำเป็น): `unplaceUnit` ตอนนี้ย้าย
  `equipment` ของฮีโร่ไปกับ instance ใหม่ตอนถอนกลับม้านั่ง (ไม่ทิ้งของ), และ `checkAndMergeUnits`
  คืนไอเทมที่สวมอยู่บนฮีโร่ tier-1 ที่ถูกเมิร์จทิ้งกลับเข้ากระเป๋าก่อนเสมอ (ไม่งั้นของจะหายตอนออโต้เมิร์จ)
- ทดสอบผ่าน Playwright ครบ: ลากจากกระเป๋า→การ์ดม้านั่ง/สนามสำเร็จ, เปิดโมดัลลากเข้าช่องเจาะจง
  สำเร็จ, ลากออกจากช่อง unequip สำเร็จ, ลากพลาดเด้งกลับ (ไอเทมไม่หายไปจากกระเป๋า), ช่องเต็ม
  บล็อกถูกต้อง, ถอนฮีโร่ที่สวมไอเทมแล้วของยังติดไปด้วย, ออโต้เมิร์จฮีโร่ที่สวมไอเทมไม่ทำของหาย,
  สู้จริงหลัง equip แล้ว `combatStats` สะท้อนโบนัสถูกต้อง ไม่มี NaN

**Mana System & Skill Cast Backend (เสร็จแล้ว)**
- ฮีโร่ทุกตัวที่วางลงกระดาน (`placeHeroAt`) มี state: `current_mana:0`, `max_mana:100`,
  `statuses:[]`, `action_state:'idle'`, `current_target:null`, `castTimer:0`, `castTarget:null`,
  `skillGoldTriggers:0` — ศัตรู/บอสไม่มี field พวกนี้เลย (เหมือน `combatStats`) จึงไม่กระทบมอนสเตอร์เดิม
- `grantMana(u, amount)`: clamp [0, max_mana] เสมอ, no-op ถ้า unit ไม่มี field `current_mana` —
  เรียกจากทั้ง basic attack (โจมตีสำเร็จ +10, โดนดาเมจ +5, ฆ่าได้ +10) และดาเมจจากสกิล/DoT (ผ่าน
  `dealSkillDamage`) — DoT tick แต่ละอันเลือกเองได้ว่าจะให้มานาหรือไม่ผ่าน `status.grants_mana`
- State Machine ใน `updateUnit()`: 1) Dead Check → tick statuses (DoT+หมดอายุ) → 2) Hard CC Check
  → **3) Mana Check ทำงานอิสระจากการมีเป้าหมายศัตรู** (แก้บั๊กที่พบระหว่างเทส: เดิม gate ไว้หลัง
  target-lock ทำให้สกิลซัพพอร์ตอย่าง heal/summon ร่ายไม่ได้เลยถ้าไม่มีศัตรูบนกระดาน) → 4) Basic
  Attack → 5) Movement (`getEffectiveMoveSpeed()` รวม slow status ด้วย) — โดน Hard CC ขณะร่ายจะ
  ยกเลิกทันที คืนมานา ไม่หัก

**Skill Execution Engine — 7 ฮีโร่ tier-1 (เสร็จแล้ว, ข้อมูลจาก `SKILL_DEFS`)**
- `SKILL_DEFS[heroKey]`: ข้อมูลกลไกเต็มของ fighter/swordman/archer/mage/summoner/acolyte/merchant
  (mana_cost, cast_time, target_type, damage/heal/summon/reward_payload, status_effects) — แยก
  จาก `HERO_DEFS.active_skill` (ยังเป็นแค่ name/description) โดยตั้งใจ ฮีโร่ tier-2 ยังไม่มี entry
  ที่นี่ ตอนมานาเต็มจะ fallback เป็นพฤติกรรมเดิม (หักมานา ไม่มีผล)
- Targeting resolvers ครบ 7 แบบ: `current_target`/`current_target_front_arc` (ล้อมรอบเป้าหมาย
  ปัจจุบันในรัศมี 1), `farthest_enemy` (+ `collectLineTargets` เดินเส้นทะลวงจริงบนกริดแบบ
  Bresenham), `largest_enemy_cluster` (นับเพื่อนบ้านในรัศมี 1 หาความหนาแน่นสูงสุด),
  `adjacent_empty_tile`, `lowest_hp_ally`/`lowest_hp_enemy` (เทียบ % HP)
- Payload ครบ 4 แบบ: `damage_payload` (คูณ p_atk/m_atk จาก `combatStats` ของผู้ร่าย, รองรับ AoE
  shape line/circle/front_arc + falloff ต่อเป้าหมายที่ทะลวงสำหรับ Archer), `heal_payload`
  (เช็ก exclude_full_hp_targets/can_target_self), `summon_payload` (สร้าง Spirit Familiar จริง
  ไม่นับ field limit เพราะไม่ผ่าน `placeHeroAt`, ฮีลตัวเดิมถ้ามีอยู่แล้วแทนสร้างซ้ำ, สลายตอนจบ wave
  ผ่าน `despawnSummons()`), `reward_payload` (ปัก mark ให้ **ก่อน** damage เสมอ — บั๊กที่พบระหว่าง
  เทส: เดิมปัก mark หลังดาเมจ ทำให้ดาบฟันตายในจังหวะเดียวไม่ได้ทองเพราะ mark ยังไม่ทันติด, จำกัด
  `skillGoldTriggers` ต่อผู้ร่ายต่อ wave)
- Status Effects: `applyStatusEffectToUnit()` รองรับ `modifiers` แบบ `<stat>_flat`/`<stat>_pct`
  (เช่น `p_def_pct`, `m_def_flat`, `move_speed_pct`) ผสมเข้า `buildCombatStats()` (flat ก่อน
  percent ทีหลัง เหมือน equipment) ก่อนเข้า clamp — สำหรับมอนสเตอร์ (ใช้ `armor`% ไม่ใช่ p_def)
  ใช้ `getEffectiveArmor()`/`getEffectiveMoveSpeed()` แทนเพื่อให้ debuff ยังมีผลจริงโดยไม่ต้องแก้
  data model มอนสเตอร์ — DoT (`burn`) มี `tickStatuses()` ยิงดาเมจตาม `tick_interval` จริง ไม่ให้
  มานาตาม `grants_mana:false`
- `stack_rule`: `refresh` (แทนที่ของเดิม) และ `strongest` (เทียบขนาด modifier รวม เก็บตัวแรงกว่า)
- ทดสอบผ่าน Playwright ครบทุกฮีโร่แยกฟังก์ชัน (ตัวเลขดาเมจ/ฮีล/มานาตรงตามสูตรเป๊ะทุกกรณี),
  แก้ 2 บั๊กที่พบระหว่างเทส (mana-check ต้องไม่ผูกกับเป้าหมายศัตรู, mark ต้องปักก่อนดาเมจ), และ
  **เล่นจริงที่บังคับ speed x4 หลายเวฟ** เห็นสกิลร่ายจริง (summoner/archer/mage), summon ปรากฏจริง,
  status effects ทำงานจริง ไม่มี NaN/console error ใหม่ — `baseStats` ไม่ถูกแก้ทับที่จุดใดเลย
  (ตรวจสอบด้วย grep ทั้งไฟล์)

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

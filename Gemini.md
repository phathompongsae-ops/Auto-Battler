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

**Shop / Merge & Evolution System (player-choice — แทนที่ระบบสุ่มเดิมแล้ว)**
- ร้านค้าขายเฉพาะ tier-1 (`ownedPool` filter `class_tier===1`) — tier-2 ได้จากการรวมร่างเท่านั้น
- `EVOLUTION_TREE`: derive จาก `HERO_DEFS.evolves_from` อัตโนมัติ (ไม่ hardcode ซ้ำ กันข้อมูลเพี้ยน)
  ทั้ง 7 สาย tier-1 → 2 ตัวเลือก tier-2 ต่อสาย
- `scanForMergeCandidate()`: เรียกหลัง `buyHero`/`unplaceUnit` ทุกครั้ง (จุดเดียวที่ม้านั่งเปลี่ยนแปลง
  ในเกมนี้) ครบ 3 ตัว tier-1 เดียวกัน → `lockMergeSources()`: ถอดไอเทมทั้ง 3 ตัว (เก็บลำดับ
  source1-slot1/2, source2-slot1/2, source3-slot1/2), ลบฮีโร่ทั้ง 3 ออกจากม้านั่งทันที, เข้าสถานะ
  `pendingEvolution` — ล็อกปุ่ม "เริ่มการต่อสู้"/"รีโรล" (ทั้งจาก disabled check และจาก modal overlay
  เต็มจอที่บังการคลิกพื้นหลังทั้งหมดอยู่แล้ว ไม่มีปุ่มปิด ต้องเลือกคลาสก่อนเท่านั้น) — ระหว่างรอ
  merge ใหม่จะไม่ trigger ซ้อน (`if (pendingEvolution) return;`) แต่ถ้ามีกลุ่มที่ 2 ครบพอดีระหว่างรอ
  จะถูกตรวจจับอัตโนมัติทันทีที่กลุ่มแรกเลือกเสร็จ
- UI: `#evolutionModal` แสดงชื่อฮีโร่ต้นทาง + จำนวนไอเทมที่เก็บมา + ปุ่ม 2 ตัวเลือกคลาส tier-2
  (`chooseEvolution(evolutionId)` เช็ก evolutionId ต้องอยู่ใน `availableEvolutionIds` และ
  `evolves_from` ตรงกับฮีโร่ต้นทางก่อนเสมอ)
- Item Transfer: สวมให้ฮีโร่ใหม่อัตโนมัติ 2 ชิ้นแรกตามลำดับที่เก็บมา ที่เหลือ (ถ้ามี) โอนกลับ
  `playerState.inventory` ทันที (ไม่มีทางหายหรือค้าง — ทดสอบแล้วว่ายังลากไปใส่ฮีโร่ตัวอื่นต่อได้ปกติ)

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
  `equipment` ของฮีโร่ไปกับ instance ใหม่ตอนถอนกลับม้านั่ง (ไม่ทิ้งของ) — เดิม auto-merge
  ระบบสุ่มก็คืนไอเทมเข้ากระเป๋าก่อนเมิร์จทิ้งเช่นกัน แต่ตอนนี้ถูกแทนที่ด้วยระบบรวมร่างแบบเลือกเอง
  ที่จัดการไอเทมอย่างละเอียดกว่าเดิมแล้ว (ดูหัวข้อ Merge & Evolution System ด้านบน)
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

**Skill Execution Engine — ขยายครบ 14 ฮีโร่ tier-2 (เสร็จแล้ว)**
- `max_mana` เปลี่ยนจากล็อก 100 ตายตัว เป็นดึงจาก `SKILL_DEFS[heroKey].max_mana` ต่อฮีโร่ (fallback
  100 ถ้าไม่มี entry) — ตรวจแล้วจริง เช่น Sniper ต้องสะสมถึง 150, Archmage ถึง 180 ถึงจะร่ายได้
  (เพิ่ม `max_mana:100` ให้ 7 ตัว tier-1 เดิมด้วยเพื่อความชัดเจน แม้ fallback ครอบคลุมอยู่แล้ว)
- Targeting resolvers ใหม่ 4 แบบตามสเปก: `self`/`self_aoe_radius_3` (คืนค่าผู้ร่ายเอง เป็นศูนย์กลาง
  AoE), `highest_max_hp_enemy`, `three_nearest_enemies_in_range` (คืนค่าเป็น **array** แบบเดียวใน
  ระบบ — ใช้กับ Ranger's Triple Volley ที่ยิงซ้ำเป้าหมายเดิมได้ถ้าศัตรูในระยะไม่ครบ 3), `most_recent_
  dead_ally` (เก็บ `deadAlliesThisWave[]` รีเซ็ตทุกครั้งกด "เริ่มการต่อสู้")
- Payload ใหม่ 3 แบบ: `shield_payload` (ดูดซับดาเมจก่อน HP จริงผ่าน `absorbWithShield()`, มี
  duration หมดอายุใน `tickStatuses()`), `revive_payload` (Priest — ร่ายผ่าน `lowest_hp_ally` ปกติ
  แต่ redirect ไปชุบชีวิตถ้าไม่มีเป้าหมายฮีลที่ถูกต้องและมีฝั่งเดียวกันตายอยู่ในเวฟนี้ จำกัดจำนวนครั้ง/เวฟ
  ต่อผู้ร่าย, ได้ HP%/Mana% ตามกำหนด พร้อม invulnerability ชั่วคราว), `buff_steal_payload`
  (Trickster — ขโมยบัฟที่แรงที่สุดจากศัตรูในพื้นที่มาใส่ตัวเอง ลบออกจากเป้าหมายเดิม)
- `damage_payload` เงื่อนไขพิเศษ: `armor_penetration_pct`/`armor_penetration` (object แบบ
  base+bonus ต่อระยะ capped, Sniper), `distance_scaling` (ดาเมจเพิ่มตามระยะ capped),
  `conditional_multiplier` (Duelist — โบนัสถ้าเป้าหมาย HP มากกว่าผู้ร่าย), `execute_threshold_pct`
  (ถ้า HP% หลังโดนดาเมจต่ำกว่าเกณฑ์ ตายทันที — Duelist/Inquisitor), `projectile_count`+
  `repeat_target_multipliers` (Ranger ยิงซ้ำเป้าหมายเดิมได้)
- `conditional_modifiers` ใน `buildCombatStats()`: ประเมินเงื่อนไข (เช่น `hp_pct_below_50`) ใหม่
  ทุกครั้งที่ฟังก์ชันรัน ไม่ใช่ค่าตายตัวตอน apply — Berserker's Blood Frenzy จึงปรับโบนัสสดตาม HP%
  ปัจจุบันของตัวเอง (`onHpChanged()` เรียก `refreshCombatStats()` ทุกครั้ง HP เปลี่ยนถ้ามี status
  ประเภทนี้ติดอยู่)
- `on_basic_attack_payload` (Spirit Blade's Spirit Edge): ดาเมจเวทแถมท้ายทุกครั้งที่โจมตีปกติติด
  ไม่ให้มานา "โดนดาเมจ" ซ้ำอีกรอบ (การโจมตีหลักให้ไปแล้ว)
- `physical_lifesteal_pct` (Berserker): แก้บั๊กที่พบระหว่างเทส — สเตตัสเรตแบบนี้ base เป็น 0 เสมอ
  คูณเปอร์เซ็นต์แล้วได้ 0 ตลอด จึงแยกกลุ่ม `RATE_STAT_KEYS` ให้บวกตรงแทนคูณ ตอนนี้ lifesteal ฮีล
  จริงตอนโจมตีปกติ (ถือเป็น physical เท่านั้น)
- Taunt (Knight): บังคับเป้าหมายที่ติดสถานะให้ตี caster เท่านั้นจนกว่าจะหมดเวลาหรือ caster ตาย
  (override การล็อกเป้าหมายปกติใน `updateUnit()`) — Silence (Inquisitor): บล็อกแค่การ "เริ่ม" ร่าย
  สกิลใหม่ (มานาสะสมได้ปกติ ถือค้างไว้รอ) ไม่ขัดจังหวะสกิลที่ร่ายอยู่แล้วเหมือน Hard CC
- Beast Lord's Spirit Dragon: มี `special_attack` (โจมตีพิเศษเป็นเส้นทุก 3 ครั้งที่ตีปกติ, นับผ่าน
  `specialAttackCounter`) และสถานะ "ทั้งทีมได้ attack_speed เพิ่มตราบใดที่มังกรยังไม่ตาย" ซึ่งไม่ใช่
  timer ปกติ (`remaining:-1`) แต่ผูกกับ `updateSummonAuras()` เช็กทุกเฟรมว่ามังกรยังอยู่ไหม แล้ว
  ใส่/ถอดบัฟให้ทุกฮีโร่ในสนามอัตโนมัติ (เรียกจาก `animate()` loop หลัก)
- แก้บั๊ก move_speed/attack_speed คู่มือ: `buildCombatStats()` เจตนาไม่ fold `move_speed_pct` เข้า
  combatStats (กัน double-apply กับ `getEffectiveMoveSpeed()`) แต่ `attack_speed_pct` fold ได้ปกติ
  (เป็น single source of truth สำหรับฮีโร่อยู่แล้ว) — เพิ่ม `getEffectiveAttackSpeed()` ให้มอนสเตอร์
  ที่ไม่มี `combatStats` เลยก็ยังโดน attack_speed debuff (เช่น Frost Weaver's slow) ได้จริง
- ทดสอบผ่าน Playwright ครบทุกฮีโร่ tier-2 แยกฟังก์ชัน ตัวเลขดาเมจ/ชิลด์/ฮีล/มานาตรงสูตรเป๊ะทุกกรณี
  (เช่น Sniper's distance_scaling+armor_penetration ผสมกันตรงเป๊ะ, Beast Lord's dragon special
  attack ตรงเป๊ะ), แก้ 2 บั๊กที่พบระหว่างเทส (physical_lifesteal_pct ต้องบวกไม่ใช่คูณ, freeze
  ต้องมี `kind:'freeze'` ชัดเจนถึงจะนับเป็น Hard CC), และ**เล่นจริงบังคับ speed x4 หลายเวฟ**ด้วย
  roster ผสม (Knight/Archmage/Beast Lord/Priest/Sniper) ไม่มี NaN/console error ใหม่ เลย —
  `baseStats` ไม่ถูกแก้ทับที่จุดใดเลย (grep ทั้งไฟล์ยืนยัน)

**Merge & Evolution System — เลือกคลาสเองแทนสุ่ม (เสร็จแล้ว)**
- แทนที่ระบบ auto-merge สุ่มเดิม (`checkAndMergeUnits`) ทั้งหมดด้วย state machine ให้ผู้เล่นเลือก
  คลาส tier-2 เอง ตาม flow ที่กำหนด (detect → lock+collect items → modal → create → restore
  equipment → overflow → complete) โดยปรับให้เข้ากับสถาปัตยกรรม bench-instance-array ของเกมนี้
- `EVOLUTION_TREE` derive จาก `HERO_DEFS.evolves_from` อัตโนมัติ (ไม่ hardcode ซ้ำ) — 7 สาย tier-1
  ครบทุกสาย ตรงกับ evolution_tree ที่กำหนดมาเป๊ะ
- `scanForMergeCandidate()` เรียกหลัง `buyHero()`/`unplaceUnit()` (จุดเดียวที่ม้านั่งเปลี่ยนแปลงในเกม
  นี้ — ไม่มี drag-hero-ลงช่องม้านั่งเจาะจงให้ผูก event ตรงๆ ตามสเปก) — เจอครบ 3 ตัว tier-1 เดียวกัน
  → `lockMergeSources()`: ถอดไอเทมทั้ง 3 ตัว (`location:'merge_pool'`, เก็บลำดับ source1-slot1/2,
  source2-slot1/2, source3-slot1/2), ลบฮีโร่ทั้ง 3 ออกจากม้านั่งทันที (ทำให้ "ล็อกไม่ให้ย้าย" ฟรีๆ
  เพราะไม่มีการ์ดให้ลากอีกแล้ว), เข้าสถานะ `pendingEvolution`
- `#evolutionModal`: overlay เต็มจอ ไม่มีปุ่มปิด (ต้องเลือกคลาสก่อนเท่านั้น) — บังการคลิกพื้นหลัง
  ทั้งหมดโดยธรรมชาติ (z-index สูงกว่า equipModal) จึงบล็อก "เริ่มต่อสู้"/"รีโรล"/ซื้อของ/เปิดเมิร์จ
  ซ้อนได้ครบตามสเปกโดยไม่ต้องเช็กทีละปุ่ม (แต่ก็ยังใส่ disabled check ไว้เป็น defense-in-depth ด้วย)
- `chooseEvolution(evolutionId)`: validate evolutionId ต้องอยู่ใน `availableEvolutionIds` และ
  `evolves_from` ตรงกับฮีโร่ต้นทางก่อนเสมอ → สร้างฮีโร่ tier-2 ใหม่ลงม้านั่ง → สวมไอเทม 2 ชิ้นแรก
  ตามลำดับที่เก็บมาให้อัตโนมัติ → ที่เหลือ (overflow) โอนกลับ `playerState.inventory` ทันที
  (`location:'inventory'`, `ownerHeroId:null` — ไม่มีทางหายหรือค้างเป็น `merge_pool` ตลอดกาล)
- หลังเลือกคลาสเสร็จ เรียก `scanForMergeCandidate()` อีกครั้งทันที เผื่อมีกลุ่มที่ 2 ครบพอดีระหว่าง
  ที่กลุ่มแรกกำลังรอผู้เล่นเลือกอยู่ (ทดสอบแล้วว่า auto-detect ได้จริง)
- ทดสอบผ่าน Playwright ครบ: `EVOLUTION_TREE` ตรงสเปก, ซื้อ 3 ตัวเดียวกันจริงผ่านคลิก UI จริงเปิด
  modal ถูกต้อง, กดเลือกคลาสจริงผ่านคลิกจริงได้ฮีโร่ใหม่ถูกต้อง, **ทดสอบใส่ไอเทมแบบล้น 2+2+1 ชิ้น
  ตามที่ขอ** — ยืนยันว่า 2 ชิ้นแรกไปอยู่กับฮีโร่ใหม่ถูกต้อง อีก 3 ชิ้นกลับกระเป๋าครบไม่มีซ้ำ/หาย
  และยังลากไปใส่ฮีโร่ตัวอื่นต่อได้จริง (equipItem สำเร็จ), ปฏิเสธการเลือกคลาสที่ไม่ถูกต้อง/ไม่มีอยู่จริง,
  merge ซ้อนกันบล็อกถูกต้องและ auto-detect กลุ่มที่ 2 หลังเลือกกลุ่มแรกเสร็จ, และ**เล่นจริงบังคับ
  speed x4** วางฮีโร่ที่เพิ่งเปลี่ยนคลาสลงสนามแล้วสู้จบไม่มี NaN/console error ใหม่

**อื่นๆ ที่มีอยู่แล้วก่อนรอบนี้** (ยังทำงานอยู่ ไม่ได้แตะ): ระบบ wave 1-15 พร้อมด่านบอสจริงที่
stage 5/10/13/15 (`bossWave()`), quota แพ้ได้ 3 ครั้งต่อรัน, bench คนละ 6 ช่อง, field สูงสุด 5 ตัว

**ทดสอบแล้วทั้งหมดรวมกันในไฟล์เดียว**: HERO_DEFS/ownedPool/damage-fn/merge-fn มีครบ, ghost
offset 56px ถูกต้อง, ลากวางสำเร็จ, merge test (เช่น 3x mage → archmage), เล่นจริงซื้อ-ลากวาง-
x4-ต่อสู้จบ ไม่มี console/page error ใหม่เลย

**Shop Economy — ระบบร้านค้า/รายได้ ตามโครงสร้าง JSON ฉบับสมบูรณ์ (เสร็จแล้ว)**
- เพิ่ม `SHOP_ECONOMY` (ค่าคงที่, ใกล้ `MAX_LOSSES`) เก็บ `hero_shop`/`hero_sell`/`income`/`reroll`
  ตรงตาม JSON ที่ผู้ใช้ส่งมาทุกตัวเลข — ใช้เป็น single source of truth ให้ทุกฟังก์ชันด้านล่างอ่านค่า
  จากตรงนี้แทนเลขฝังตรงในโค้ด (`hero_shop.slots`, `reroll.cost` ฯลฯ)
- ราคาซื้อฮีโร่ tier-1 เปลี่ยนจาก 1 → 2 ทองทุกตัว (`purchase_cost.tier_1_star_1`), ร้านค้าเหลือ 3 ช่อง
  (`pickShopOffers()` เดิมสุ่ม 4 ช่อง)
- **บั๊กที่พบและแก้ระหว่างงานนี้**: `ownedPool` เดิม init มาแค่ 1 สำเนาต่อฮีโร่ tier-1 หนึ่งตัว และ
  `buyHero()` เดิม filter เอาคีย์ออก "ทั้งหมด" ทุกครั้งที่ซื้อ (`ownedPool.filter(k => k !== hkey)`)
  — แปลว่าฮีโร่ tier-1 แต่ละตัวซื้อผ่านร้านค้าจริงได้แค่ครั้งเดียวตลอดทั้งเกม ทำให้ระบบรวมร่าง
  (ต้องการ 3 ตัวซ้ำ) เป็นไปไม่ได้เลยผ่านการเล่นจริง (เทสก่อนหน้านี้รอดมาเพราะสร้างฮีโร่ผ่าน
  `createHeroInstance()` ตรงๆ ข้ามร้านค้าไปเลย) แก้โดย: (1) `ownedPool` init ด้วย
  `HERO_POOL_COPIES_PER_TIER1 = 15` สำเนาต่อฮีโร่ 1 ตัว (2) เปลี่ยนร้านค้าให้ทำงานแบบ index-based
  (`buyHero(offerIdx)` แทน `buyHero(hkey)`) แล้วเอาออกจาก `ownedPool`/`shopOffers` แค่ "1 สำเนา"
  ต่อการซื้อ 1 ครั้ง (`indexOf` + `splice`) — ยืนยันด้วยเทสจริงว่าคลิกซื้อฮีโร่ตัวเดียวกัน 3 ครั้งผ่าน
  UI จริงเปิด merge modal ได้แล้ว
- **Free reroll ต่อเวฟ**: `freeRerollsRemaining` เริ่มที่ 1 (`reroll.free_rerolls_per_wave`) รีเซ็ต
  ทุกครั้งที่เข้าเฟส shop ใหม่ (ทั้งใน `onWaveCleared`/`onWaveFailed` continuation) —
  `rerollBtn.onclick` หักฟรีก่อนเสมอ (`consume_free_reroll_first`) แล้วค่อยหักทอง 2 ตามปกติเมื่อฟรีหมด
  ปุ่มโชว์ข้อความ "รีโรล (ฟรี)" หรือ "รีโรล 💰2" ตามสถานะ
- **สูตรรายได้ใหม่** (`computeWaveIncome(isWin)` แทน `waveReward()` เดิมที่ hardcode ตายตัวรายด่าน):
  `base_income_per_wave(5) + win_bonus(1, เฉพาะชนะ) + interest(min(floor(gold/10)*1, 5), gold
  ถูก cap ที่ 50 ก่อนคิด) + streak_bonus` (ตามตาราง 4 ช่วงใน spec) — ตีความว่า "แพ้ก็ยังได้ทองพื้นฐาน
  +ดอกเบี้ย+สตรีค แค่ไม่ได้ win_bonus" (อ่านสูตรตามตัวอักษร ไม่ใช่ gate ทั้งก้อนไว้เฉพาะตอนชนะ) —
  เรียกจากทั้ง `onWaveCleared()` (บวก Merchant Link's `goldPerVictory` ทับเพิ่มด้วย) และ
  `onWaveFailed()`
- **Streak สองทิศทาง**: `currentStreak`/`streakType` ('win'|'loss') อัปเดตทุกจบด่านผ่าน
  `updateStreak(isWin)` — ชนะ/แพ้ติดกันนับต่อเนื่อง พอผลลัพธ์สลับด้านจะรีเซ็ตกลับมาเริ่มที่ 1 ใหม่
  ทันที (ไม่ใช่ win-streak อย่างเดียวที่ทำให้ streak_bonus ไร้ความหมายตอนแพ้ติด)
- **ระบบขายฮีโร่** (ของใหม่ทั้งหมด ไม่เคยมีมาก่อน): `getSellValue(heroKey)` อ่านจาก `hero_sell`
  (tier-1 = 1, tier-2 = 3) — `sellBenchHero(idx)` / `sellFieldHero(u)` ทั้งคู่ block ตอน
  `phase !== 'shop'` และตอน `pendingEvolution` ค้างอยู่ (เหมือน `unplaceUnit`/`buyHero`) และเรียก
  `returnHeroEquipmentToInventory()` ก่อนเสมอ — คืนไอเทมที่สวมอยู่กลับ `playerState.inventory`
  ตรงๆ แบบไม่เช็ค capacity (เหมือน overflow policy ตอนรวมร่าง) เพื่อไม่ให้ไอเทมหายเด็ดขาด — เพิ่ม
  ปุ่ม `.sellBtn` (มุมซ้ายบนของการ์ด, คู่กับ `.equipBtn` มุมขวาบนที่มีอยู่แล้ว) ทั้งใน bench card
  และ field card ของ `renderUI()`, มี `stopPropagation()` กันชนกับ drag-to-place/toggle-link/เดิม
- ทดสอบผ่าน Playwright ครบ: ค่าคอนฟิกตรงสเปกทุกตัว (cost=2, slots=3, pool 15 สำเนา/ตัว), ซื้อฮีโร่
  ตัวเดิมซ้ำ 3 ครั้งผ่านคลิก UI จริงจนเปิด merge modal ได้ (ยืนยันบั๊กพูลถูกแก้แล้วจริง), reroll ฟรี
  ครั้งแรกไม่หักทอง-ครั้งที่สองหัก 2 ตรง, ขายฮีโร่ทั้ง bench/field ได้ทองตรง+ไอเทมคืนกระเป๋าไม่หาย,
  ขายถูกบล็อกตอนไม่ใช่เฟส shop และตอน pendingEvolution ค้าง, สูตรรายได้ตรงทุกกรณี (รวมกรณี clamp
  ที่ gold เกิน 50 และ streak หลายช่วง), ตัวนับ streak สลับทิศถูกต้อง, และ**เล่นจริงบังคับ speed x4
  หลายเวฟติดต่อกัน** ยืนยันทองสะสมตรงสูตรทุกเวฟ (17→25→34→45→57) ไม่มี NaN/console error ใหม่เลย

**Class Synergy System — โบนัสอาชีพอัตโนมัติ (แทนที่ Link System V2 ทั้งระบบ) + Dark UI Layout Overhaul (เสร็จแล้ว)**
- นำ JSON `synergy_system` (fighter/swordman/archer/mage/summoner/acolyte/merchant, ต้องการ 3 ตัวขึ้นไป
  ต่อคลาส, `activation_mode:"at_least"`, `more_than_required:"same_bonus_as_3"`) มาฝังเป็น
  `SYNERGY_DEFS` — **แทนที่ Link System V2 (การเลือก Link ด้วยมือ) ทั้งระบบ** ไม่ใช่ระบบคู่ขนาน
  เพราะสเปกใหม่นับจาก "ครบ 3 ตัวอัตโนมัติ" ไม่ใช่ผู้เล่นเลือกเอง และ UI ผังใหม่ที่ขอมาก็ระบุพื้นที่
  ซ้ายเป็น "กล่องแสดงสถานะ Synergies" โดยตรง ไม่มีปุ่มเลือก Link เหลืออยู่เลย — ลบ `LINK_TAGS`/
  `LINK_SYNERGIES`/`linkedInstanceIds`/`toggleLinkByInstanceId`/`combatLinkBuffs`/
  `applyCombatLinkModifiers` ทั้งหมด และเอา `primaryLinkTag` ออกจาก `HERO_DEFS` ทุกตัว (21 ฮีโร่)
- **หลักการนับ**: อาชีพของฮีโร่แต่ละตัว = ต้นสาย tier-1 ของมัน (`getRootClass()` อ่านจาก
  `evolves_from`, ไม่ใช่ตัวเองถ้าเป็น tier-1) — เช่น Fighter/Knight/Berserker ทั้ง 3 ตัว (ต่างเทียร์กัน)
  นับรวมเป็นอาชีพ "fighter" เดียวกันหมด นับจากฮีโร่ที่ **วางอยู่บนสนามเท่านั้น** (`placedUnits`,
  ไม่นับม้านั่งสำรอง) เหมือน Link System เดิม
- `computeSynergyBuffs()` รวมเอฟเฟกต์จากทุกอาชีพที่ครบ 3+ เป็นก้อนเดียว — ทดสอบยืนยันว่ามี 3 ตัว
  (ต่างเทียร์กัน) เปิดโบนัสถูกต้อง และมี 4 ตัวขึ้นไป **ไม่เพิ่มโบนัสทับ** ตรงตาม `same_bonus_as_3`
- ผูกเอฟเฟกต์เข้าจุดที่เหมาะสมที่สุดในเอนจินเดิมแต่ละอย่าง (ไม่ใช้ mechanism เดียวทื่อๆ ทั้งหมด):
  - `max_hp_pct`/`p_def_flat`/`p_atk_pct`/`attack_speed_pct`/`m_atk_pct` → fold เข้า
    `buildCombatStats()` โดยตรง (maxHpPct ยังคงต้องคำนวณแยกที่ `applyPreCombatSynergyBuffs()`
    เหมือนเดิม เพราะ `combatStats.hp` ไม่เคยถูกอ่านไปคำนวณ `u.maxHp` จริงอยู่แล้วในสถาปัตยกรรมเดิม)
  - `p_def_penetration_pct`/`m_def_penetration_pct` (archer/mage) → `applySynergyDamageModifiers()`
    เลือกใช้ตาม `attackType` ของผู้โจมตีจริง (กายภาพ/เวท แยกกัน ไม่ปนกัน) ทดสอบแล้วว่า mage synergy
    ไม่ไปเพิ่มเจาะเกราะให้การโจมตีกายภาพ และกลับกัน
  - `physical_reflect_pct` (swordman) → `applyReflectDamage()` กลไกใหม่ทั้งหมด (ไม่เคยมีมาก่อน)
    สะท้อนดาเมจกายภาพกลับผู้โจมตีจริง (ใช้ `casterRef`/attacker unit ตรงๆ) เฉพาะดาเมจกายภาพเท่านั้น
  - `mana_on_basic_attack_bonus` (summoner) → เพิ่มใน basic attack tick ต่อจาก `MANA_PER_ATTACK` ปกติ
  - `summon_max_hp_pct`/`summon_damage_pct` (summoner) → คูณตอนสร้างวิญญาณใน `applySummonPayload()`
  - `healing_received_pct` (acolyte) → คูณ heal amount ทั้งใน `applyHealPayload()` และ
    `applyDamageBasedHeal()` (Inquisitor's Holy Judgment) เฉพาะเป้าหมายฝั่งผู้เล่น
  - `start_battle_shield_pct_max_hp` (acolyte) → ให้โล่ทุกตัวตอนเริ่มด่านใน
    `applyPreCombatSynergyBuffs()` — ใช้ `shieldTimer:999` เพราะสเปกไม่ระบุ duration ชัดเจน
    (ตั้งใจให้อยู่ได้ตลอดด่าน หมดก็ต่อเมื่อโดนดูดซับดาเมจจริง)
  - `bonus_gold_on_wave_win`/`shop_reroll_discount_gold`/`minimum_reroll_cost` (merchant) →
    บวกเข้า `onWaveCleared()`'s reward และ `getRerollCost()` (ส่วนลด reroll มีพื้นตามสเปก)
- **EXP/Level (flavor bar ตามที่ผู้ใช้เลือกหลังถาม)**: ไม่มีสเปก JSON รองรับปุ่ม "ซื้อ EXP" ที่ขอมาใน
  ผังบนสุด เลยถามผู้ใช้ก่อนว่าจะเอาแบบไหน — เลือก "flavor bar เฉยๆ" ตามคำแนะนำ: `level`/`exp` เพิ่ม
  เมื่อกด "ซื้อ EXP" (4 ทอง ได้ 4 EXP, ต้องการ `2+level*2` ต่อเลเวล) **ไม่ผูกกับการปลดล็อกเทียร์ร้านค้า
  ใดๆ** เพราะ `SHOP_ECONOMY.hero_shop.hero_pool` ยังเป็น `"tier_1_only"` ตายตัวตามสเปกเศรษฐกิจเดิม
- **UI Layout ใหม่ทั้งหมด (Dark Mode Minimalist)**: เปลี่ยนจาก parchment theme (สีครีม/น้ำตาล) เป็น
  โทนมืดล้วน (`--bg:#0c0d10`, `--panel-bg:#1a1c22`, การ์ด `--card-bg:#20232b`) ทั่วทั้งเกม (ร้านค้า/
  ม้านั่ง/โมดัลอุปกรณ์/โมดัลรวมร่าง/โมดัลผลลัพธ์) — จัดผังด้วย `#gameGrid` (flex: ซ้าย
  `#synergyPanel` / กลาง `#centerCol > #boardContainer` / ขวา `#hpPanel`), กระดาน 3D เป็นสี่เหลี่ยม
  จัตุรัสจริง (`layoutBoard()` คำนวณด้าน = 60% ของ `min(vw,vh)` แล้ว clamp ไม่ให้ล้นพื้นที่ที่เหลือ
  จาก topbar/bottomUI/side panels) แทนที่ canvas เดิมที่เต็มความกว้างจอเสมอ
- **ผลกระทบสำคัญต่อ raycast**: เดิม mouse coords คำนวณจาก `window.innerWidth`/`canvasHeight()`
  ตรงๆ เพราะ canvas เต็มจอ — ตอนนี้ canvas เป็นแค่สี่เหลี่ยมตรงกลางเท่านั้น ต้องคำนวณ mouse coords
  เทียบกับ **bounding rect ของ canvas เอง** แทน (`setMouseFromClient()` ฟังก์ชันใหม่ใช้ร่วมกันทั้ง
  click-to-place และ drag-to-place) — ทดสอบแล้วว่าคลิกวาง/ลากวางฮีโร่ยังทำงานถูกต้อง 100%
  (โปรเจกต์พิกัดโลก 3D ผ่านกล้องจริงเพื่อยืนยัน แทนการเดาพิกัดหน้าจอเปล่าๆ ซึ่งพลาดได้ง่ายเพราะกล้อง
  เป็นมุมเอียง isometric ไม่ใช่ top-down)
- **Team HP panel (ขวา)**: แทนที่ `#fieldCards` เดิมทั้งหมด — แสดงภาพ+ชื่อ+หลอด HP จริงของฮีโร่ที่วาง
  แต่ละตัว พร้อมปุ่ม equip/sell เดิม (ย้ายมาจาก field card) หลอด HP อัปเดตสดระหว่างต่อสู้ผ่าน
  `updateTeamHpBars()` (เบา, แก้แค่ width/class ของ element เดิม) เรียกทุกเฟรมใน `animate()` loop
  แยกจาก `renderTeamHpPanel()` (rebuild เต็ม, เรียกเฉพาะตอน event เช่นซื้อ/ขาย/วาง เพื่อไม่ให้เปลือง)
- **บั๊กที่พบและแก้ระหว่างงานนี้**: ตอนแรกฝัง `let synergyBuffs = computeSynergyBuffs();` ไว้ในโซน
  Synergy System (ก่อนโซน GAME STATE ที่ประกาศ `placedUnits`) ทำให้หน้าเว็บพังทันทีตั้งแต่โหลด
  (`ReferenceError: Cannot access 'placedUnits' before initialization`) เพราะฟังก์ชันไปอ่าน
  `placedUnits` ก่อนที่ตัวแปรจะถูกประกาศจริงในไฟล์ — แก้โดยเปลี่ยนค่าเริ่มต้นเป็น `null` แทน (จุดอ่าน
  `synergyBuffs` ทุกจุดมี guard `if (synergyBuffs)` อยู่แล้ว จึงปลอดภัย) เหมือนที่ `combatLinkBuffs`
  เดิมก็เริ่มที่ `null` เช่นกัน
- ทดสอบผ่าน Playwright ครบ: layout เป็นสี่เหลี่ยมจัตุรัสจริง (0.6 เท่าของ `min(vw,vh)` เป๊ะ), นับอาชีพ
  ข้ามเทียร์ถูกต้อง, เปิด/ไม่เกินโบนัสที่ 3/4 ตัวถูกต้อง, ปิดที่ต่ำกว่า 3 ถูกต้อง, stat fold (p_atk_pct)
  ตรงเป๊ะ, penetration แยกชนิดดาเมจถูกต้อง, reflect เฉพาะดาเมจกายภาพถูกต้อง, heal amplify ถูกต้อง,
  start-battle shield ถูกต้อง, summon buff ถูกต้อง, merchant reroll discount+floor+bonus gold ถูกต้อง,
  mana bonus ถูกต้อง, EXP/Level ถูกต้อง, click-to-place และ drag-to-place ยังทำงานได้ 100% กับกระดาน
  สี่เหลี่ยมใหม่, **เล่นจริงบังคับ speed x4 ครบทั้ง 15 เวฟรวด** (ทีม 3x Archer + 2x Acolyte เปิด
  synergy ผสม) ทองสะสมตรงสูตรทุกเวฟ ไม่มี NaN/console error ใหม่เลย, และรีเกรสชันครบ (evolution/
  merge, equipment equip/sell, shop economy) ยังทำงานถูกต้องหลังปรับ UI/CSS ใหม่ทั้งหมด

**Monster/Wave Merge จากทีม Backend (Codex) — ฐานข้อมูลมอนสเตอร์ + Wave Schedule + specialBehavior (เสร็จแล้ว)**
- ทีม Backend (Codex) ส่งโค้ดชุดใหม่มาเป็น "ระบบต่อสู้แยกต่างหาก" (`spawnWave`/`findTarget`/
  `calculateDamage`/`checkWaveCondition`, โมเดลข้อมูล `row/col` + ระยะ Chebyshev + สเตตัส `atk`/
  `p_def`/`m_def`) — ชื่อฟังก์ชัน `spawnWave` ชนกับของเดิมเป๊ะ และถ้าใช้เอนจินนั้นแทนที่ทั้งหมดจะ
  ทำลายระบบสกิล/มานา/ไอเทม/Synergy/ภาพ chibi ที่ทำและเทสไว้ก่อนหน้านี้ทั้งหมด จึงถามผู้ใช้ก่อนว่าจะ
  รวมโค้ดแบบไหน — เลือกทางที่ 1: **ดึงแค่ข้อมูล/ดีไซน์มาแปลงใส่เอนจินเดิม เก็บเอนจินต่อสู้เดิมไว้ทั้งหมด**
  (สกิล/มานา/ไอเทม/synergy/ภาพ chibi ไม่แตะเลย)
- **ฐานข้อมูลมอนสเตอร์**: แปลง Codex's 7 มอนสเตอร์ทั่วไป + 3 บอส เข้า `ENEMY_BASE`/`bossWave()` เดิม
  — แปลง `atk`→`pAtk`, `row/col`→`c/r`, ตัด `m_def` ทิ้ง (เอนจินนี้มีค่าเกราะ % สถิติเดียวไม่แยก
  กายภาพ/เวท ทุกมอนสเตอร์ก็โจมตีกายภาพอยู่แล้ว) ใช้ `p_def` เป็นค่า armor % แทน — **ตัดสูตร
  "+12%/ด่าน" เดิมทิ้งไปเลย** เพราะ wave schedule ของ Codex มีเส้นโค้งความยากจากการเลือกชนิด/จำนวน
  มอนสเตอร์ต่อเวฟอยู่แล้ว ถ้าคงสูตรสเกลเดิมไว้ด้วยจะกลายเป็นสเกลซ้อนสเกล (ยากเกินจริง)
- **Wave Schedule 1-15**: แทนที่ `STAGE_PLAN`/`bossWave()`/`STAGE_LABEL` ด้วยคอมโพสิชันของ Codex
  ตรงทุกเวฟ (ตรวจสอบด้วย Playwright ว่าตรงทุกตัวทั้ง 15 เวฟ) — บอสย้ายจากด่าน 5/10/13/15 (เดิม) เป็น
  5/10/15 (ใหม่ ไม่มีบอสที่ด่าน 13 อีกต่อไป) **ทองรางวัลต่อเวฟยังใช้สูตร `SHOP_ECONOMY.income` เดิม
  ไม่ใช้ `goldReward` ของ Codex ตรงๆ** เพราะจะซ้อนทับกับระบบเศรษฐกิจที่ทำและเทสเสร็จไปก่อนหน้านี้แล้ว
  — บอสทั้ง 3 ตัวใช้แค่สถิติพื้นฐานจาก Codex เท่านั้น **ยังไม่ implement ท่าพิเศษเฉพาะบอส**
  (area_taunt/cone_breath/arena_curse) เพราะเป็นระบบสกิลใหม่ทั้งหมดที่ยังไม่ได้ระบุรายละเอียดพอ
  (cooldown/AOE/debuff เต็มรูปแบบ) และอยู่นอกขอบเขตที่ขอมา (แค่ specialBehavior หลัก 4 แบบ)
- **specialBehavior**: เพิ่มเข้า `selectTarget()` — `hunter` (Stone Wolf: เล็ง HP% เหลือน้อยสุด),
  `frontline`/`backline` (Orc Brute/Shadow Assassin: เล็งแถวใกล้สุด/ไกลสุดจากศัตรู แล้วเลือกตัวใกล้
  สุดในแถวนั้น) — `ranged` (Spirit Archer) ไม่ต้องแยกเคสเพราะพฤติกรรม "รักษาระยะ+เล็งใกล้สุดในระยะ"
  ตรงกับ nearest-target เดิมที่ผสมกับเช็ก `d<=atkRange` อยู่แล้ว — `stun_attack` (Stone Golem: ทุก
  โจมตีครั้งที่ 4 ทำให้เป้าหมายสตัน) เพิ่มเป็น hit-counter ในบล็อกโจมตีปกติ เรียก
  `applyStatusEffectToUnit()` เดิม (ใช้ `hasHardCC()` ที่มีอยู่แล้วบล็อกการเดิน+โจมตี) — ฮีโร่ผู้เล่น
  ไม่มีฟิลด์ `specialBehavior` เลย จึงตกไปใช้ nearest-target เดิมเสมอ ไม่กระทบฝั่งผู้เล่น
- **Game Assets**: Slime กับ Orc Brute ไม่มีภาพจริง — เพิ่ม fallback ใน `makeUnit()` ให้ mesh เป็น
  กล่องสี่เหลี่ยม (BoxGeometry) พื้นสีล้วนแทน texture เมื่อ `ASSET_META[sprite]` ไม่มีจริง (ตาม
  game_assets policy ที่ขอมา — ไม่เสียเวลาสร้างกราฟิกตัวละครเอง) มอนสเตอร์/บอสที่มีภาพจริงอยู่แล้ว
  (Skeleton/StoneWolf/SpiritArcher/ShadowAssassin/Warden/Golem/BoneDragon/ChampionBig) ไม่แตะเลย
- **บั๊กที่พบระหว่างทดสอบ (ไม่ใช่บั๊กจริงในเกม)**: รอบแรกๆ ที่รัน Playwright เทสหลายตัวพร้อมกัน
  (background process ทับซ้อนกันหลายตัว) เจอปรากฏการณ์ทีมค้างกลางด่าน 6 (HP ทั้งสองฝั่งหยุดนิ่ง
  ไม่มีใครขยับ/โจมตีเลยนานหลายวินาที) — ตรวจสอบแล้วว่า**ไม่ใช่บั๊กในโค้ดที่ merge เข้าไป** แต่เป็น
  ผลจาก CPU contention ระหว่าง Playwright/Chromium หลายโปรเซสรันพร้อมกันทำให้ `requestAnimationFrame`
  ของเบราว์เซอร์กระตุกในเทสนั้นๆ — รันเทสเดี่ยว (ไม่มีโปรเซสอื่นแข่ง CPU) ผ่านครบทั้ง 15 เวฟทุกครั้ง
  ทองสะสมตรงสูตรทุกเวฟ ไม่มี NaN/error เลย
- ทดสอบผ่าน Playwright ครบ: wave composition ตรงสเปก Codex ทั้ง 15 เวฟ, สถิติมอนสเตอร์/บอสถูกต้อง,
  placeholder box render ให้ Slime/OrcBrute ถูกต้อง (Skeleton ยังใช้ภาพจริงตามปกติ), hunter targeting
  เล็ง HP% ต่ำสุดถูกต้อง, frontline/backline เล็งแถวถูกต้อง, stun_attack ทริกเกอร์ที่ hit ที่ 4 พอดี
  ถูกต้อง, และ**เล่นจริงบังคับ speed x4 ครบทั้ง 15 เวฟรวด** (รันเดี่ยวไม่มี process อื่นแข่ง) ทองสะสม
  ตรงสูตรทุกเวฟ ไม่มี NaN/console error ใหม่เลย

**Skill & Status Effect Engine จากทีม Backend (Codex) — Boss Cooldown Skills + Mana Bar UI + Floating Text (เสร็จแล้ว)**
- ทีม Backend (Codex) ส่งโค้ดชุดใหม่มาอีกครั้งเป็น "ระบบสกิล/สเตตัสแยกต่างหาก" (`unit.runtime.mana`/
  `unit.runtime.statusEffects`, `heroSkills` 1 สกิลต่อ 7 อาชีพหลัก, `applyStatusEffect`/
  `updateHeroSkillEngine` ของตัวเอง) — ซ้ำซ้อนกับระบบสกิล/มานา/สเตตัสที่มีอยู่แล้วในเกม (ซึ่งมีสกิล
  **แยกต่างหากทุกฮีโร่ ไม่ใช่แค่ต่ออาชีพ** เช่น Fighter/Knight/Berserker มีสกิลคนละอันกันเป็นของตัวเอง
  ทั้งหมด — ละเอียดกว่าของ Codex มาก) จึงใช้แนวทางเดิมที่ตกลงกันไว้: **ดึงแค่ของใหม่จริงๆ มาต่อยอด
  เอนจินเดิม ไม่แตะระบบสกิล/มานา/สเตตัสที่มีอยู่แล้วเลย**
- **ของใหม่ที่ดึงมาจริง**: ท่าพิเศษบอสทั้ง 3 ตัวตาม cooldown จริง (`area_taunt`/`cone_breath`/
  `arena_curse`) ซึ่งเป็นช่องว่างที่เคยบอกไว้ตอน merge มอนสเตอร์ครั้งก่อนว่า "ยังไม่ implement" —
  ตอนนี้ implement ครบแล้วโดยใช้ pipeline เดิมทั้งหมด (`applyStatusEffectToUnit`/`statuses`/
  `dealSkillDamage`/`hasHardCC`) ไม่ใช้ `unit.runtime` ของ Codex เลย:
  - `area_taunt` (Arena Warden, เวฟ 5): ยั่วยุฮีโร่ในระยะ (บังคับ target ผ่าน `casterRef` แบบเดียวกับ
    Taunt ของ Knight ที่มีอยู่แล้ว) + บอสได้บัฟเกราะชั่วคราว (ประมาณ "ลดดาเมจที่ได้รับ" ด้วยการเพิ่ม
    ค่า armor % ชั่วคราวผ่าน `p_def_pct` status modifier ที่ `getEffectiveArmor()` อ่านอยู่แล้ว — ไม่ใช่
    กลไก "ลดดาเมจตรงๆ" แบบ Codex เพราะเอนจินนี้มีสถิติเกราะแบบเดียวสำหรับศัตรู)
  - `cone_breath` (Bone Dragon, เวฟ 10): โจมตีเวทเป็นรูปกรวยหน้าเป้าหมายที่ใกล้ที่สุด — เขียน
    `getUnitsInCone()` ใหม่ให้ทำงานกับพิกัด `c/r` ของเอนจินนี้ (Codex ใช้ `row/col`)
  - `arena_curse` (Immortal Champion, เวฟ 15): สุ่มฮีโร่ 1 ตัวมาลด P.Def/M.Def ชั่วคราว ผ่าน status
    ปกติ (`modifiers:{p_def_pct,m_def_pct}` — กลไกเดียวกับ Trickster's `m_def_down` ที่มีอยู่แล้ว)
  - ทดสอบยืนยันว่า `applyStatusEffectToUnit()` เรียก `refreshCombatStats()` ให้อัตโนมัติอยู่แล้วทุก
    ครั้งที่ apply สเตตัสใหม่ (ไม่ต้องเรียกซ้ำเอง) — บั๊กที่คิดว่าจะเจอ (stat ไม่ refresh กลางฟกดต์)
    กลับไม่มีจริงเพราะฟังก์ชันเดิมทำให้แล้ว
- **หลอดมานาสีฟ้า**: เพิ่มเมชแยกใต้หลอด HP เดิมใน `makeUnit()` เฉพาะฮีโร่ผู้เล่น (ไม่ใช่มอนสเตอร์/
  ไม่ใช่ summon) อัปเดตสดผ่าน `updateManaBar()` ที่เรียกจากทุกจุดที่ `current_mana` เปลี่ยนค่า
  (`grantMana`, cast-complete หักมานา, revive คืนมานา, `resetForWave`)
- **Floating Text**: sprite แบบ canvas-texture ลอยขึ้น+จางหายใน ~1.1 วินาที (ใช้แพทเทิร์นเดียวกับ
  `EQUIP_BADGE_TEX` เดิม ไม่ต้องวาดรูปใหม่เลย) — โผล่ตอนฮีโร่/บอสเริ่มร่ายสกิล (โชว์ชื่อสกิล) และตอน
  ติดสถานะ Stun (โชว์ "Stun!") ผูกจุดเดียวที่ `applyStatusEffectToUnit` (kind==='stun'/'freeze')
  จึงครอบคลุมทุกแหล่งสตัน (Trickster's Loaded Dice เดิม + Stone Golem's stun_attack จาก merge
  ครั้งก่อน) โดยอัตโนมัติ ไม่ต้องแก้จุดอื่นเพิ่ม
- ทดสอบผ่าน Playwright ครบ: หลอดมานาอัปเดตตรง 0/50%/100%(clamp) ถูกต้อง ไม่มีในมอนสเตอร์, floating
  text โผล่ตอนร่ายสกิล/ตอนสตันถูกต้องและจางหายตามเวลา, `area_taunt` ยั่วยุเฉพาะฮีโร่ในระยะจริง (นอก
  ระยะไม่โดน) + บอสได้บัฟเกราะถูกต้อง, `cone_breath` โดนเฉพาะเป้าหมายในกรวยจริง (นอกกรวยไม่โดน),
  `arena_curse` ลด P.Def ตรง -30% พอดี, และ**เล่นจริงบังคับ speed x4** ยืนยันว่าทั้ง 3 ท่าบอสยิงจริง
  ระหว่างต่อสู้จริงในเวฟบอส 5/10/15 ไม่มี NaN/console error ใหม่เลย

**Hero Stat Scaling & Star System จากทีม Backend (Codex) — สูงสุด 2★ เฉพาะ Tier-2 (เสร็จแล้ว)**
- ทีม Backend (Codex) ส่งระบบ "รวม 3 ตัวเดียวกัน" มาอีกชุด แต่เงื่อนไข trigger ("มีฮีโร่ tier-1
  ตัวเดียวกันครบ 3 ตัว") **ชนกับระบบ Merge & Evolution เดิมตรงๆ** (เดิมคือรวม 3 ตัวแล้วเปิดโมดัลให้
  เลือกเปลี่ยนคลาส tier-2, ของใหม่คือรวม 3 ตัวแล้วกลายเป็น 2 ดาวของตัวเดิม) — สองระบบให้ผลลัพธ์คนละ
  ทางจาก event เดียวกัน ทำพร้อมกันไม่ได้ จึงถามผู้ใช้ก่อน แล้วได้ข้อสรุปที่แก้ conflict ชัดเจน:
  1. รวม 3x **tier-1** คลาสเดียวกัน → เปิดโมดัล Evolution เดิมเป๊ะ (ไม่แตะ) → ได้ tier-2 (1★)
  2. รวม 3x **tier-2** คลาสเดียวกัน+ดาวเท่ากัน (1★ เท่านั้น เพราะดาวสูงสุด 2) → **อัปเกรดเป็น 2★
     ทันทีอัตโนมัติ ไม่มีโมดัลให้เลือก** (เพราะคลาสไม่เปลี่ยน แค่แรงขึ้น)
  3. ร้านค้าตั้งแต่ **เวฟ 6** เป็นต้นไป เปิดขาย tier-2 (1★) ตรงๆ ได้ด้วย (เดิมได้จาก evolution
     ทางเดียว) เพื่อให้ผู้เล่นสะสมครบ 3 ตัวทันใน limit 15 เวฟ
- **ตัวคูณดาว** (`HERO_STAR_MULTIPLIERS`, ตรงตามที่ Codex ให้มา): 2★ = HP/P.Atk/M.Atk x1.8,
  P.Def/M.Def x1.5, Attack Speed x1.12, สกิล (skill_power) x1.5, ระยะเวลาสถานะ x1.15 — Attack
  Range/Move Speed ไม่สเกลตามดาวเลย (ตามสเปก) — ใช้กับสเตตัสของฮีโร่ **ตัวเอง** ใน `HERO_DEFS[key].stats`
  โดยตรง (ไม่ใช้ตาราง base stat แยกต่างหากแค่ 7 คลาสหลักแบบที่ Codex ส่งมา เพราะเกมนี้ฮีโร่ tier-2
  แต่ละตัวมีสเตตัสเป็นของตัวเองอยู่แล้ว เช่น Knight ≠ Berserker ตารางแบบ Codex จะผิดสำหรับเกือบทุกตัว)
- **สเกลสเตตัส**: คำนวณที่ `placeHeroAt()` ตอนวางฮีโร่ลงกระดาน (`getScaledHeroStats()`) ก่อนสร้าง
  `baseStats`/`baseMaxHp` ของยูนิต — เพราะ `baseStats` เป็น snapshot ที่ตรึงไว้ตอนวางอยู่แล้ว ไม่ต้อง
  แก้ `buildCombatStats()` เลย
- **สเกลสกิล**: `SKILL_DEFS` เป็น object เดียวใช้ร่วมกันทุก instance ของฮีโร่ตัวนั้น (ไม่ว่าจะกี่ดาว)
  จึงแก้ค่าใน object ตรงๆ ไม่ได้ — เขียน `getScaledSkillDef(caster, skillDef)` คืนสำเนาที่ scale
  เฉพาะฟิลด์ตัวคูณดาเมจ/ฮีล/โล่/summon (x skill_power) และ duration ของ status_effects (x
  status_duration) ห่อรอบ `executeSkill()` ตรงจุดที่ cast เสร็จ — mana_cost/cast_time ไม่แตะ
  (ไม่ให้ 2★ ร่ายถี่กว่าเดิม ตรงตามสเปก)
- **Auto-combine**: `scanForStarCombine()` นับข้าม **ทั้งบอร์ดและม้านั่ง** (ต่างจาก
  `scanForMergeCandidate()` เดิมของ tier-1 ที่นับแค่ม้านั่งอย่างเดียว ตามที่ผู้ใช้ขอมาเฉพาะระบบดาว) —
  พบครบ 3 ตัว (คลาส+ดาวตรงกัน) เรียก `performStarCombine()`: ถอดไอเทมทั้ง 3 ตัวเก็บไว้ escrow
  (`location:'merge_pool'`, overflow policy เดียวกับ evolution เป๊ะ — ไม่มีทางหาย), ลบตัวต้นทาง
  ออกจากที่ที่มันอยู่จริง (bench ก็ splice, บอร์ดก็ `removeUnit`+splice), สร้างฮีโร่ดาวสูงขึ้น 1
  ตัวใหม่ลงม้านั่งเสมอ (เหมือน evolution — ผลลัพธ์อยู่ม้านั่งเสมอไม่ auto-place ลงกระดาน)
- เรียก `scanForStarCombine()` ที่จุดเดียวกับที่ `scanForMergeCandidate()` เดิมเรียกอยู่แล้ว
  (`buyHero`/`unplaceUnit`) บวกเพิ่ม `placeHeroAt` (วางอาจครบ mix บอร์ด+ม้านั่ง) และท้าย
  `chooseEvolution` (evolve เสร็จอาจครบ 3 ตัวพอดี)
- **หลอดดาว UI**: badge canvas-texture เล็กๆ ใต้หลอดมานาใน 3D (เฉพาะฮีโร่ tier-2 เท่านั้น ตั้งค่า
  ครั้งเดียวตอนสร้างยูนิต ไม่ต้องอัปเดตสด เพราะการอัปดาวจะลบยูนิตเก่าสร้างใหม่เสมอ ไม่มีการอัปดาว
  ยูนิตที่มีอยู่แล้วแบบ in-place) + ต่อท้ายชื่อในการ์ดม้านั่งและ panel HP ทีม (`starLabel()`)
- `createHeroInstance(heroKey, starLevel=1)`/`unplaceUnit` แก้ให้ starLevel ติดตามฮีโร่ไปทุกที่
  (ไม่หายตอนถอนจากกระดานกลับม้านั่ง)
- ทดสอบผ่าน Playwright ครบ: Evolution tier-1 ยังทำงานเป๊ะเหมือนเดิมไม่เปลี่ยน, รวม 3x tier-2 (ม้านั่ง
  อย่างเดียว) ได้ 2★ ทันทีไม่มีโมดัล, รวมแบบผสมบอร์ด+ม้านั่งก็ได้ผลถูกต้อง, รวม 3x ที่เป็น 2★ อยู่แล้ว
  ไม่ทะลุ 3★ (cap ทำงาน), สเตตัส 2★ ตรงสูตรทุกค่า (ตรวจ Knight: HP 850→1530, P.Atk 38→68, P.Def
  55→83, AtkSpeed 1→1.12), สกิลสเกลตรง (Fighter's Power Strike p_atk_multiplier 1.6→2.4 ที่ 2★,
  SKILL_DEFS ต้นฉบับไม่ถูกแก้เลย), หลอดดาวโชว์เฉพาะ tier-2, ร้านค้าเปิดขาย tier-2 จริงตั้งแต่เวฟ 6,
  ไอเทมไม่หายระหว่างรวมดาว (2+2+1 ชิ้นข้าม 3 ตัวต้นทาง), ซื้อจากร้านค้าจริงผ่าน UI จนรวมดาวสำเร็จจริง,
  และ**เล่นจริงบังคับ speed x4** ไม่มี NaN/console error ใหม่เลย

**Layout Overhaul: Full-screen 3D Canvas + Overlay HUD (เสร็จแล้ว)**
- รื้อโครงสร้าง UI ทั้งหมดจากเดิม (`#gameGrid` แบ่ง flex ซ้าย-กลาง-ขวา + กระดานสี่เหลี่ยมจัตุรัส ~60%
  ของจอ) เป็น "Canvas เต็มจอเป็นพื้นหลัง, UI ทั้งหมดลอยทับ (overlay)" ตามสไตล์เกม auto-battler
  มือถือทั่วไป: `#boardContainer` เปลี่ยนเป็น `position:fixed; inset:0; z-index:0` แทนที่จะถูกฝังอยู่ใน
  `#centerCol` — `renderer.setSize(window.innerWidth, window.innerHeight)` เต็มจอเสมอ
- กล้อง orthographic ต้องคำนวณ aspect จากขนาดจอจริงแทนค่าคงที่ `aspect=1` เดิม (ตอนนั้น
  `#boardContainer` เป็นสี่เหลี่ยมจัตุรัสเสมอเลยไม่ต้องคิด aspect) — `layoutBoard()` ใหม่คำนวณ
  `camera.left/right = ±CAMERA_ZOOM*aspect`, `camera.top/bottom = ±CAMERA_ZOOM` แล้ว
  `updateProjectionMatrix()` ทุกครั้งที่ resize ไม่งั้นภาพจะบิดเบี้ยว (grid ไม่เป็นสี่เหลี่ยมจัตุรัส)
- UI จัดใหม่ทั้งหมดเป็น overlay ลอยด้วย `position:fixed`: Top bar กลึ่งกลางบนสุด (Gold/Wave/HP),
  มุมล่างซ้าย (Level/ซื้อ EXP), กึ่งกลางล่าง (ม้านั่งสำรอง โปร่งแสง), มุมล่างขวา (เริ่มต่อสู้/Toggle
  Shop), แผง Synergy/ทีมในสนาม ลอยชิดขอบซ้าย-ขวา
- **ร้านค้าไม่เปิดค้างตลอดเวลาอีกต่อไป**: `#shopDrawer` ซ่อนโดย default (`transform: translate(-50%,
  calc(100% + 20px)); opacity:0`) เลื่อนขึ้นทับม้านั่งเมื่อกดปุ่ม `#shopToggleBtn` เท่านั้น (คลาส
  `.open` สลับ transform) ปิดได้ทั้งกดปุ่มซ้ำหรือปุ่ม X (`#shopCloseBtn`) — ปิดอัตโนมัติทุกครั้งที่
  เข้าเวฟใหม่ (`setShopOpen(false)` ที่จุด `phase='shop'` ทั้ง 2 จุด คือ wave cleared/failed)
  กระเป๋าไอเทมก็เป็นแผงพับเก็บได้แบบเดียวกัน (`#bagToggleBtn`)
- **ขยายกระดานให้ใหญ่ขึ้น**: ลด `CAMERA_ZOOM` จาก 5.0 → 4.5 (มุมกล้อง 55° เท่าเดิม) — ยืนยันด้วยการ
  project มุมกระดานทั้ง 4 จริงผ่านกล้อง (ไม่ใช่กะด้วยตา) ว่ายังอยู่ในขอบจอครบทุกมุมไม่มีโดนตัด ก่อนหน้า
  ลองหลายค่า angle/zoom พบว่า**ลด zoom มากกว่านี้จะทำให้กระดานล้นขอบจอบน-ล่าง** (แนวตั้งเต็มพื้นที่
  เกือบสุดอยู่แล้วที่ zoom เดิม เพราะกล้อง isometric สเกลแนวนอน-แนวตั้งพร้อมกันเสมอ ปรับ zoom เดียว
  ไม่สามารถขยายแค่แนวนอนได้โดยไม่ขยายแนวตั้งตาม) แผง Synergy/ทีม ก็ขยับมาชิดขอบจอ (4px จากเดิม 10px)
  ให้กระดานรู้สึกเต็มตายิ่งขึ้น — เพิ่ม CSS media queries รองรับมือถือแนวนอนจอเตี้ย (`max-height:430px`
  ย่อแผง/ปุ่ม) และแท็บเล็ต/ไอแพด (`min-width:900px` ขยายแผง/ตัวอักษรขึ้นเล็กน้อยไม่ให้เล็กจิ๋ว)
- ทดสอบผ่าน Playwright ครบ: canvas เต็มจอจริงทุก viewport (มือถือแนวนอน/แท็บเล็ต/จอเตี้ย), ร้านค้า
  ซ่อน default + เปิด/ปิดด้วยปุ่มถูกต้อง, กระเป๋าไอเทมพับ/กางถูกต้อง, raycasting คลิกวางฮีโร่ยังแม่นยำ
  หลังเปลี่ยนกล้อง (ยืนยันด้วยการซื้อ+วางฮีโร่ 3 ตัวจริงผ่าน UI แล้วเล่นจบ 1 เวฟ) ไม่มี console error ใหม่

**บั๊กรายงาน: จอ 3D มืดสนิทหลังขยายกระดาน (สอบสวนแล้ว + เสริมความปลอดภัย)**
- ผู้ใช้แจ้งว่าหลังลด `CAMERA_ZOOM` (5.0→4.5) แล้ว 3D canvas มืดสนิท ทั้งที่ UI อื่นยังขึ้นปกติ —
  ตรวจโค้ดจริง (`camera.position`/`camera.lookAt(LOOK_TARGET)`/ไฟ/`renderer.render(scene,camera)`
  ในลูป `animate()`) ครบทุกจุด ไม่มีอะไรถูกแก้/หลุดไปเลย แล้วทดสอบซ้ำผ่าน Playwright ทั้ง
  landscape/portrait/square หลายอัตราส่วนจอ ไม่พบอาการจอมืดเลยสักครั้ง (กระดานแสดงผลถูกต้องทุกกรณี)
- **สาเหตุที่เป็นไปได้มากที่สุด**: `THREE.js` โหลดจาก CDN ภายนอก
  (`cdnjs.cloudflare.com`) — ถ้าเน็ตของผู้เล่นหลุดจังหวะนั้นพอดี/โดน Ad-blocker บล็อก CDN สคริปต์เกม
  ทั้งก้อนจะ crash ทันทีที่บรรทัดแรกที่เรียก `THREE.xxx` (เพราะ `THREE` undefined) ทำให้ `#loading`
  (พื้นหลังทึบเต็มจอ z-index สูงสุด) ค้างอยู่ตลอดไปไม่ถูกซ่อน — ขณะที่ pills บนสุด (Gold/Wave/HP) มี
  ค่า default ฝังอยู่ใน HTML อยู่แล้ว (`0`, `1/15`, `3/3`) เลยดูเหมือน "UI อื่นปกติ" ทั้งที่จริงๆ
  JavaScript ทั้งไฟล์ไม่ได้รันเลยสักบรรทัด — อาการนี้ตรงกับที่ผู้ใช้อธิบายเป๊ะ (มืดสนิทเงียบๆ
  ไม่มี error ที่มองเห็นได้)
- **แก้/เสริมความปลอดภัย** (ไม่กระทบพฤติกรรมปกติเลย แค่ทำให้ error ที่เกิดขึ้นจริง "มองเห็นได้" แทน
  จอมืดเงียบๆ): (1) เพิ่ม `onerror` บน `<script src="...three.min.js">` + เช็ค
  `typeof THREE === 'undefined'` ทันทีที่ต้นสคริปต์เกม → เปลี่ยนข้อความ `#loading` เป็นแจ้งเตือนชัดเจน
  ถ้าโหลด Three.js ไม่สำเร็จ, (2) เพิ่ม `window.addEventListener('error', ...)` โชว์ข้อความ error
  จริงบน `#loading` ถ้ามี exception ใดๆ เกิดขึ้นระหว่าง init ก่อนเกมพร้อม, (3) กัน `aspect` เป็น
  `Infinity`/`NaN` ถ้า `window.innerHeight` เป็น 0 ชั่วขณะ (เช่นตอน browser chrome animate ระหว่าง
  หมุนจอ) ทั้งใน `layoutBoard()` และตอนตั้งกล้องครั้งแรก — ทดสอบจำลอง CDN ล่มจริงผ่าน Playwright
  ยืนยันว่าข้อความแจ้งเตือนขึ้นถูกต้องแล้ว
- **ข้อสรุปสำหรับผู้ใช้**: ถ้าเจอจอมืดอีก ให้ลองรีเฟรชหน้าใหม่ (hard refresh) และเช็คว่าอินเทอร์เน็ต/
  Ad-blocker ไม่ได้บล็อก `cdnjs.cloudflare.com` — ตอนนี้ถ้าเกิดปัญหาแบบเดียวกันอีก จะเห็นข้อความ
  แจ้งเตือนบนจอแทนความมืดเงียบๆ แล้ว

**Contain-fit Camera: กระดานใหญ่ + ดันลงชิดขอบล่าง (อ้างอิงมุมกล้อง Clean V5) (เสร็จแล้ว)**
- เปลี่ยนมุมกล้องจาก 55°/yaw 15° (เอียงข้างแบบ isometric) เป็น **45°/yaw 0°** ตรงกับ
  `threejs-2_5d-clean-v5.html` (archive) ที่ใช้ `camera.position.set(0,11,11)` (มุม 45° พอดี ไม่มี
  yaw) ให้ความรู้สึก "หน้าตรง" สมส่วนกว่าเดิม
- **เลิกใช้ `CAMERA_ZOOM` คงที่แบบเดา** เปลี่ยนมาใช้เทคนิค **contain-fit frustum** แบบเดียวกับ Clean
  V5 เดิม: project มุมกระดานจริง (world space, `boardCorners`) เข้า camera-local space ด้วย
  `camera.worldToLocal()` (ต้องเรียก `camera.updateMatrixWorld(true)` ก่อนเสมอ ไม่งั้นได้ค่าเก่าค้าง)
  เพื่อรู้ขนาดกระดานบนจอจริงตามมุมกล้องปัจจุบัน แล้วค่อยตั้ง frustum ให้กระดานกิน
  `BOARD_FILL_RATIO` ของความสูงจอ
- **บทเรียนสำคัญเรื่องคณิตศาสตร์การดันตำแหน่งลง**: ตอนแรกลอง `BOARD_FILL_RATIO=0.94` (ใหญ่มาก)
  + bias สูตรที่ผิด ผลคือกระดานแทบไม่ขยับลงเลย เพราะ **fill ratio สูงเกินไปแทบไม่เหลือพื้นที่ว่าง
  (slack) ให้ดันลงล่างได้เลย** (slack = halfH-contentHalfH มีแค่ ~6% ของพื้นที่) — ต้องลด fill
  ratio ลงมาที่ **0.84** ก่อน ถึงจะเหลือ slack ~16% พอให้ดันกระดานทั้งหมดไปกองไว้ที่ margin บน (เว้น
  ที่ให้ topbar) แทบไม่เหลือ margin ล่างเลย (`BOARD_DOWN_BIAS=0.97`) — สูตรที่ถูกต้อง:
  `slack = halfH - contentHalfH; cY = slack * (2*BIAS - 1)` (BIAS=1 → slack ทั้งหมดไปอยู่ขอบบน,
  BIAS=0.5 → กึ่งกลาง, BIAS=0 → ชิดขอบบนแทน) — ทดสอบยืนยันด้วยการ project มุมกระดานจริงผ่านกล้อง
  วัด margin บน/ล่างเป็น pixel จริง (ไม่ใช่กะด้วยตา) ว่า margin ล่าง ~3-12px เท่านั้น ในขณะที่ margin
  บนเก็บพื้นที่ไว้ให้ topbar ปกติทุกขนาดจอที่ทดสอบ (มือถือแนวนอน/จอเตี้ย/iPad)
- ย้าย `#benchPanel`/`.hudCorner` ชิดขอบล่างสุดจอจริง (`bottom: 2px`, ลด max-height ม้านั่งจาก
  128px→104px) ให้สอดคล้องกับกระดานที่ขยายใหญ่และดันลงมาแล้ว
- ทดสอบผ่าน Playwright ครบ: raycasting คลิกวางฮีโร่ยังแม่นยำหลังเปลี่ยนมุมกล้อง+ตำแหน่งทั้งหมด
  (ยืนยันด้วยซื้อ+วาง 3 ตัวจริงผ่าน UI แล้วเล่นจบ 1 เวฟ), ปุ่ม Toggle ร้านค้า/กระเป๋าไอเทมยังทำงาน
  ถูกต้อง ไม่มี console error ใหม่

**รวมม้านั่งสำรองเข้ากับกระดาน 3D เป็นเนื้อเดียวกัน + กระดาน 8x7 (เสร็จแล้ว)**
- เปลี่ยนกระดานจาก 8x8 (`GRID`) เป็น **8 คอลัมน์ x 7 แถว** (`GRID_COLS`/`GRID_ROWS` แยกกัน) — แถวศัตรู
  `[0,1]` (เดิม), แถวรบผู้เล่น `PLAYER_ROWS=[3,4,5]` (เดิม `[5,6,7]`), แถว 2 เป็น buffer ว่าง, และ
  **แถวล่างสุด `BENCH_ROW=6`** กลายเป็นม้านั่งสำรองในตัว (สีเข้ม `0x5c5140` ต่างจากโซนรบสีเขียวชัดเจน)
  แทนที่แผง UI `#benchPanel` ลอยทับแบบเดิมที่บังพื้นที่กระดาน (ลบออกทั้งหมดตามที่ผู้ใช้ขอ)
- **บั๊กใหญ่ที่เจอระหว่างทำ**: ตั้ง `CAMERA_YAW_DEG=0` ไว้ (จากงานก่อนหน้าที่อ้างอิงมุม "หน้าตรง" ของ
  Clean V5) ทำให้ **แถว/คอลัมน์สลับแกนกัน** บนจอ (แถวกลายเป็นแนวนอน คอลัมน์กลายเป็นแนวตั้ง/ลึก) —
  ตอนกระดานยังเป็นจัตุรัส 8x8 สลับแล้วดูไม่ออกเพราะสมมาตร แต่พอเป็น 8x7 ไม่สมมาตรแล้วเห็นชัดว่าม้านั่ง
  กลายเป็นแถบแนวตั้งข้างเดียวแทนที่จะเป็นแถวนอนล่างสุด — สาเหตุคือสูตร
  `camera.position.set(camDist*cos(aR)*cos(yR), camDist*sin(aR), camDist*cos(aR)*sin(yR))` ใช้
  `cos(yaw)` คู่กับแกน X (คอลัมน์) และ `sin(yaw)` คู่กับแกน Z (แถว) — ตำแหน่งกล้องอ้างอิงจริงของ Clean
  V5 คือ `(0,11,11)` ซึ่ง **x=0** (ไม่ใช่ z=0) เทียบเท่ากับ **yaw=90°ในสูตรนี้** ไม่ใช่ yaw=0 — แก้เป็น
  `CAMERA_YAW_DEG=90` แล้วแถว/คอลัมน์ตรงตามที่ตั้งใจทันที (คอลัมน์แนวนอน 8 ช่อง, แถวแนวตั้ง/ลึก 7 ช่อง)
- **โมเดลข้อมูลม้านั่งใหม่**: `benchHeroes[]` เก็บ **ยูนิต 3D จริง** (`alive:false`, `isBench:true`) แทน
  ข้อมูลเบาๆ แบบเดิม — ใช้ `.alive` gate ที่มีอยู่แล้วทุกจุดในเอนจิน (`selectTarget`/`updateUnit`/ทุก
  `units.filter(o=>o.alive...)`) กันฮีโร่ม้านั่งไม่ให้ถูกเล็ง/เดิน/ร่วมรบโดยอัตโนมัติ ไม่ต้องเพิ่ม guard
  ใหม่เลย — และเพราะไม่เคยเรียก `handleUnitDeath` (แค่ตั้ง `alive:false` ตรงๆ ตอนสร้าง) จึงไม่ทริกเกอร์
  แอนิเมชันตาย (`deathT` ยังคง `undefined`) หน้าตายูนิตม้านั่งเลยดูปกติเหมือนมีชีวิต ไม่ล้ม/จาง
- `createUnitFromInstance(instData,c,r)` ฟังก์ชันกลางใหม่ (ดึงมาจากเนื้อ `placeHeroAt` เดิม) สร้าง
  ยูนิตรบเต็มรูปแบบที่ตำแหน่งใดก็ได้ — ใช้ทั้งตอนวางแถวรบ (alive) และตอนสร้างลงม้านั่ง (ผ่าน
  `spawnToBench()`, alive:false) — `moveUnitTo(u,c,r)` ฟังก์ชันเดียวแทนที่ `placeHeroAt`/`unplaceUnit`
  เดิมทั้งคู่: ลบยูนิตเก่า (`removeUnit`) แล้วสร้างใหม่ที่ปลายทางเสมอ ตัดสินใจ alive/เข้า array ไหน
  (`placedUnits` vs `benchHeroes`) จาก `r===BENCH_ROW` เพียงจุดเดียว รองรับการย้ายทุกทิศทาง (ม้านั่ง
  <->สนาม, ม้านั่ง<->ม้านั่งสลับช่อง, สนาม<->สนามขยับตำแหน่ง)
- **บั๊กที่ต้องระวังเป็นพิเศษ**: `lockMergeSources`/`performStarCombine` เดิมแค่ `benchHeroes.splice()`
  ตอนลบตัวต้นทางออกจากม้านั่ง (ตอนยังเป็นข้อมูลเบาๆ ไม่มีผลอะไร) — ตอนนี้ตัวต้นทางเป็น **ยูนิต 3D จริง**
  แล้ว ถ้า splice เฉยๆ โดยไม่เรียก `removeUnit()` ก่อน จะเหลือ "ยูนิตผี" ค้างอยู่ในฉากและใน `units[]`
  ตลอดไป (ไม่มีใครมาลบ) — ต้องเรียก `removeUnit(inst)` ก่อน splice ทุกจุดที่ลบฮีโร่ม้านั่งออกแบบถาวร
- ปุ่ม gear/sell บนการ์ด DOM ม้านั่งเดิมหายไปพร้อมแผง UI จึงเพิ่ม **แถบฮีโร่ที่เลือกไว้ลอยกึ่งกลางล่างจอ**
  (`#selectedUnitBar`: ชื่อฮีโร่ + ปุ่ม ⚙ไอเทม/💰ขาย/✕ยกเลิก) โผล่เมื่อแตะเลือกฮีโร่ (ม้านั่งหรือสนามรบ
  ก็ได้) แทน — แตะฮีโร่ครั้งแรกเลือก, แตะช่องปลายทาง (ม้านั่งหรือสนามรบ) เพื่อย้าย, หรือลากตรงๆ ด้วยผี
  sprite แบบเดียวกับระบบลากม้านั่งเดิม (`unitDrag`, เปลี่ยนจาก `benchDrag` ที่ผูกกับการ์ด DOM มาผูกกับ
  ยูนิต 3D โดยตรงผ่าน raycasting) — `sellUnit(u)` ฟังก์ชันเดียวแทนที่ `sellBenchHero`/`sellFieldHero`
  เดิมทั้งคู่ (เช็คว่าอยู่ array ไหนแล้วจัดการให้ถูกต้อง)
- pathfinding (`astar`) และ `findAdjacentEmptyTile` (จุด spawn summon) เพิ่มเงื่อนไข `nr===BENCH_ROW`
  ห้ามเดิน/ห้าม summon ลงแถวม้านั่งเด็ดขาด (ไม่งั้นศัตรูอาจเดินทะลุเข้าไปได้ถ้าช่องว่าง) — ทดสอบยืนยัน
  เล่นจริง 7 เวฟติดต่อกันที่ speed x4 ไม่มียูนิตไหน (ผู้เล่นหรือศัตรู) เหยียบแถวม้านั่งเลยแม้แต่ครั้งเดียว
- เทสต์ raycasting ยูนิต 3D ต้อง project จากตำแหน่งจริงของ **body mesh** (`body.getWorldPosition()`)
  ไม่ใช่จุดกึ่งกลางไทล์ระดับพื้น (`gridToWorld(c,r)` ตรงๆ, y=0) เพราะสไปรต์ลอยอยู่ที่ความสูงหัว
  (`body.position.y = h/2`) การ project จากจุดพื้นทำให้พิกัดจอผิดและ raycast พลาดเป้า (บทเรียนเทสต์
  ซ้ำกับที่เจอตอนเทสระบบ Synergy ครั้งแรกในเซสชันนี้ — ต้อง project จากตำแหน่งจริงที่เรนเดอร์ ไม่ใช่กะเอา)
- ทดสอบผ่าน Playwright ครบ: ซื้อฮีโร่ → กลายเป็นยูนิต 3D บนม้านั่งจริง (alive:false), แตะเลือก+แตะช่องรบ
  → ย้ายเข้าสนามถูกต้อง (alive:true), แตะยูนิตสนาม+แตะช่องม้านั่งว่าง → ย้ายกลับม้านั่งถูกต้อง, Evolution
  (3x tier-1 เหมือนกัน) เปิดโมดัลถูกต้องไม่มียูนิตผีค้าง, Star Combine (3x tier-2 ดาวเท่ากัน) รวมทันที
  ไม่มียูนิตผีค้าง, ขายฮีโร่ม้านั่งได้ทองเพิ่มจริง ไม่มียูนิตผีค้าง, สวมไอเทมฮีโร่ม้านั่งผ่านโมดัลได้ปกติ,
  เล่นจริง 7 เวฟติดกันที่ speed x4 ไม่มี NaN/console error ใหม่ ไม่มียูนิตไหนเหยียบแถวม้านั่งเลย

**Team Combo Buff: บัฟทีมเมื่อลงสนามรบครบ 3 ตัวพอดี (เสร็จแล้ว)**
- ผู้ใช้ยืนยันชัดเจนว่า **ห้ามแตะระบบ Evolution/Star Combine เดิมเด็ดขาด** (3x ตัวซ้ำ → อัปเกรดดาว) —
  ระบบนี้ไม่เคยถูกลบหรือแก้ลอจิกเลยตลอดงาน 8x7/ม้านั่งด้านบน มีแค่ปรับวิธีเก็บข้อมูล (จาก object เบาๆ
  เป็นยูนิต 3D จริง) เท่านั้น ยืนยันด้วยเทสซ้ำหลัง feature นี้เสร็จว่า evolution modal เปิดถูกต้อง +
  star combine รวมดาวถูกต้อง เหมือนเดิมทุกอย่าง
- **ระบบใหม่ที่เพิ่มเข้ามาเป็นอีกชั้นแยกต่างหาก** (ไม่ใช่ตัวแทนหรือทับระบบเดิม): เปิดใช้งานเมื่อ
  `placedUnits.length === 3` **พอดี** เท่านั้น (2 หรือ 4 ตัวไม่เปิด) — แต่ละฮีโร่ในเซ็ต 3 ตัวนี้ (นับ
  ตาม root class เดียวกับ Synergy System ผ่าน `getRootClass()`) มีบัฟเฉพาะตัวของตัวเอง
  (`TEAM_COMBO_ROOT_BUFFS`, 1 ค่าต่อ 1 root class จาก 7 คลาสหลัก) รวมกันเป็นบัฟทีมเดียว — ถ้าตัวไหน
  ในเซ็ตเป็น tier-2 (evolve/star แล้ว) บัฟของตัวนั้นใช้ค่า `tier2` ที่แรงกว่า `tier1` แทน (ยืนยันด้วย
  เทส: 3 ตัว tier-1 คนละคลาส (Fighter/Archer/Mage) ได้ `max_hp_pct+8` แต่พอเปลี่ยน Fighter เป็น
  Knight (tier-2, root ยังเป็น fighter) ค่ากลายเป็น `max_hp_pct+15` ทันที)
- **จุดออกแบบสำคัญที่ทำให้ implement เร็วและปลอดภัย**: ใช้ effect key ชื่อเดียวกับ `SYNERGY_DEFS.effects`
  เป๊ะ (`max_hp_pct`/`p_atk_pct`/`attack_speed_pct`/ฯลฯ) แล้ว **พับรวมเข้า `computeSynergyBuffs()`
  โดยตรง** (ไม่สร้าง object/state ใหม่แยกต่างหาก) ทำให้ทุก integration point ที่อ่าน `synergyBuffs`
  อยู่แล้วทั่วทั้งเอนจิน (`buildCombatStats`, `applyPreCombatSynergyBuffs`, ทองรางวัลจบด่าน, การรักษา,
  สเกลสเตตัส summon ฯลฯ) รับบัฟใหม่นี้ไปใช้ทันทีโดยไม่ต้องแก้โค้ดจุดอื่นเลยแม้แต่บรรทัดเดียว
- UI: เพิ่มหัวข้อ "บัฟทีม 3 คน (x/3)" ต่อท้ายรายการ Synergy อาชีพเดิมในแผงซ้าย — โชว์ "ทำงาน! ชื่อฮีโร่,
  ชื่อฮีโร่, ..." (ติด ★ ถ้าตัวไหนเป็น tier-2 ที่ให้บัฟอัปเกรด) พร้อม tooltip อธิบายบัฟแต่ละตัว หรือ
  "ต้องมีฮีโร่ในสนามรบพอดี 3 ตัว" ถ้ายังไม่ครบ/เกิน
- ทดสอบผ่าน Playwright ครบ: 2/4 ตัวไม่เปิดบัฟ, 3 ตัวพอดีเปิดถูกต้อง, ค่าบัฟจริงไหลเข้า combatStats
  ถูกต้อง (ยืนยัน maxHp เปลี่ยนตามเปอร์เซ็นต์จริง), UI panel แสดงผลถูกต้อง, evolution/star-combine ยัง
  ทำงาน 100% เหมือนเดิมหลังเพิ่มระบบนี้, เล่นจริง 4 เวฟที่ speed x4 กับทีม 3 ตัวไม่มี NaN/error ใหม่

**Hybrid Architecture Refactor: แยก JS ออกจาก HTML เป็น `src/game.js` (เสร็จแล้ว)**
- ตัดโค้ด JavaScript ทั้งก้อน (Three.js scene/camera/render/AI/combat/economy/UI-wiring — ทุกอย่างที่
  เคยอยู่ใน `<script>...</script>` มาตั้งแต่ต้น) ออกจาก `autochess.html` ไปไว้ที่ `src/game.js` แบบ
  **ตัดวางล้วนๆ ไม่แก้ลอจิกแม้แต่บรรทัดเดียว** — `autochess.html` เหลือแค่ `<head>`/CSS/โครง HTML ของ
  UI ทั้งหมด แล้วปิดท้ายด้วย `<script src="https://cdnjs.../three.min.js">` (เดิม) ตามด้วย
  `<script src="src/game.js">` (ใหม่) แทนโค้ดอินไลน์เดิม
- จุดที่ต้องระวัง: การอ้าง `document.getElementById(...)` แบบ top-level จำนวนมากในสคริปต์เกม —
  เพราะ `<script src>` ทำงานเหมือน inline script ทุกประการเมื่อวางไว้ตำแหน่งเดิมท้าย `<body>` (ตัว
  browser parse/execute ตามลำดับเดียวกัน ไม่ต่างจาก inline) จึงย้ายได้ตรงๆ โดยไม่ต้องห่อด้วย
  `DOMContentLoaded` หรือแก้ไขอะไรเพิ่ม
- อัปเดต `.github/workflows/pages.yml` เพิ่มบรรทัด `cp -r src _site/src` (ไม่งั้น deploy ขึ้น GitHub
  Pages แล้วเว็บจะจอมืดเงียบๆ ทันที เพราะ `<script src="src/game.js">` จะ 404 — คนละสาเหตุกับบั๊กจอมืด
  ที่เคยเจอตอน CDN ล่ม แต่อาการหน้าตาเหมือนกันเป๊ะ ต้องเช็คทั้งคู่ถ้าเจอจอมืดอีกในอนาคต)
- ทดสอบผ่าน Playwright ครบด้วยโครงสร้างไฟล์จริงหลังแยก (serve ทั้ง `index.html`+`src/game.js`+`assets/`
  แยกไฟล์จริงเหมือน deploy จริง ไม่ใช่แค่ inline script เดิม): ไม่มี console error, ทุกระบบที่เพิ่งทำ
  เสร็จก่อนหน้า (8x7 grid + ม้านั่งรวมแถวล่างสุด, evolution/star-combine, Team Combo Buff 3 คน, AI
  เดินสู้) ให้ผลลัพธ์ **เหมือนเดิมทุกประการ 100%** เทียบกับก่อนแยกไฟล์ — เล่นจริง 8 เวฟที่ speed x4
  ไม่มี NaN/error ใหม่เลย

**Manual Link Selection: เปลี่ยน Auto Class Synergy เป็นเลือกเอง 3 ตัว (เสร็จแล้ว)**
- **Auto Class Synergy (นับอาชีพซ้ำครบ 3 ตัวเปิดบัฟอัตโนมัติ) และ Team Combo Buff (ครบ 3 ตัวพอดี
  อัตโนมัติ) ถูกแทนที่ทั้งคู่ด้วย Manual Link Selection**: ผู้เล่นแตะฮีโร่บนสนามรบเพื่อเลือกเข้า
  "ทีม Link" เองสูงสุด 3 ตัว — แต่ละตัวที่เลือกเปิดบัฟของ root class ตัวเองทันที (`LINK_CLASS_BUFFS`,
  7 คลาส) อาชีพซ้ำกันให้บัฟครั้งเดียวไม่ stack (dedup ผ่าน `getActiveLinkedClasses()`), tier-2 นับตาม
  root class ผ่าน `getRootClass()` เดิม
- **State**: `linkedHeroIds` เป็น `Set` ของ **instanceId** (ห้ามใช้ heroKey — ผู้เล่นมีฮีโร่ตัวเดียวกัน
  ซ้ำหลายตัวได้) — ฮีโร่ม้านั่ง (BENCH_ROW) เลือกเข้า Link ไม่ได้ (tap ม้านั่ง = select เพื่อย้าย/ไอเทม/
  ขาย เหมือนเดิม, tap สนามรบ = toggle Link — การย้ายฮีโร่สนามรบยังทำได้ผ่านการลาก) — กดตัวที่ 4 ขึ้น
  floating text เตือน "เลือก Link ได้สูงสุด 3 ตัว"
- **จุดออกแบบสำคัญ**: `computeSynergyBuffs()` (ชื่อเดิมที่ทุก integration point เรียกอยู่) กลายเป็น
  delegate ไป `computeLinkedBuffs()` — object ฟิลด์เดิมครบทุกตัว จึงไม่ต้องแก้ `buildCombatStats`/
  `applyPreCombatSynergyBuffs`/ทอง/การรักษา/summon แม้แต่บรรทัดเดียว — freeze ระหว่างต่อสู้ได้ฟรีจาก
  กลไกเดิม (snapshot ตอน `applyPreCombatSynergyBuffs` + `toggleLinkedHero` guard `phase !== 'shop'`)
- **หลุดจาก Link อัตโนมัติ**: `sanitizeLinkedHeroes()` เรียกที่ต้น renderUI ก่อนคำนวณบัฟเสมอ — ลบ id
  ที่ไม่อยู่ใน placedUnits ออก ครอบคลุมทุกเส้นทาง (ถอนกลับม้านั่ง/ขาย/รวมร่าง Evolution/รวมดาว Star)
  โดยไม่ต้องดัก hook ทีละจุด เพราะทุกเส้นทางจบที่ renderUI อยู่แล้ว — ตัวชี้เป็น instanceId จึงรอด
  การย้ายตำแหน่ง (moveUnitTo สร้างยูนิตใหม่แต่ instanceId เดิม → Link ติดตามไปเอง)
- **UI แผงซ้ายใหม่**: หัวข้อ "ทีม Link (x/3)" + ช่อง Portrait 3 ช่อง (ว่าง = "+", เต็ม = รูป+ไอคอนอาชีพ
  emoji จาก `CLASS_ICON_MAP`+ชื่อสั้น+⭐ ถ้า tier-2, คลิกช่องเพื่อถอด) + รายการเฉพาะบัฟที่ทำงานจริง —
  ลบรายการอาชีพ 7 แถว 0/3 (`SYNERGY_DEFS`/`renderSynergyPanel`/`getRootClassCounts`/
  `getActiveSynergyDefs`) และ Team Combo section (`TEAM_COMBO_ROOT_BUFFS`/`computeTeamComboBuff`)
  ออกทั้งหมด — ไอคอนใช้ emoji ตรงๆ เพราะไฟล์ใน assets/icons/classes มีไม่ครบ 7 คลาสและชื่อไม่ตรง
  (มีแค่ mage/merchant/ranger/warrior/forest)
- **Visual บนกระดาน**: วงแหวนทองรอบฐาน (RingGeometry) + ป้ายโซ่ 🔗 (ตำแหน่งซ้ายบนของ HP bar, สมมาตร
  กับ equipBadge ฝั่งขวา ไม่บังหลอด HP/มานา) สร้างไว้กับทุกยูนิตผู้เล่น (ซ่อนไว้) toggle ผ่าน
  `updateLinkedHeroVisuals()` ทุก renderUI
- ฟังก์ชันเพิ่ม: `toggleLinkedHero, sanitizeLinkedHeroes, getLinkedHeroes, getActiveLinkedClasses,
  computeLinkedBuffs, renderLinkPanel, updateLinkedHeroVisuals` / ฟังก์ชันลบ: `getRootClassCounts,
  getActiveSynergyDefs, computeTeamComboBuff, renderSynergyPanel` (ตัว `computeSynergyBuffs` คงชื่อไว้
  เป็น delegate)
- Acceptance ผ่านครบ (Playwright, จอมือถือแนวนอน + iPad): เริ่มเกมมีช่องว่าง 3 ช่องไม่มีรายการอาชีพ,
  เลือก 1/3 ตัวแสดง Portrait+ไอคอน+บัฟถูกต้อง, ตัวที่ 4 ถูกปฏิเสธ+เตือน, ม้านั่งเลือกไม่ได้, Fighter
  ซ้ำ 2 ตัวบัฟทำงานครั้งเดียว (maxHp +15 ไม่ใช่ +30), ขาย/ถอนแล้วหลุดจาก Link ทันที, ระหว่างต่อสู้
  แก้ Link ไม่ได้ กลับ shop แก้ได้, เล่นจริง 3 เวฟ x4 ไม่มี NaN/duplicate buff/console error, แผง 3
  ช่อง+บัฟ 3 แถวเห็นครบไม่มี scroll ทั้งสองขนาดจอ

## บทเรียนสำคัญ

ก่อนหน้านี้เคยสับสนไฟล์หลายรอบเพราะชื่อ/ศัพท์คล้ายกันมาก (`HERO_DEFS` vs `HEROES`,
"ม้านั่งสำรอง/Bench" มีทั้งคู่) — ตอนนี้เหลือไฟล์เดียวแล้วปัญหานี้หมดไป แต่ถ้ามีคนอ้างถึง
`threejs-2_5d-clean-v5.html` อีกในอนาคต ให้เข้าใจว่านั่นคือไฟล์ที่ถูก archive แล้ว
ไม่ใช่ไฟล์ที่ควรแก้ไข — ยืนยันกับผู้ใช้ก่อนเสมอถ้าไม่แน่ใจ

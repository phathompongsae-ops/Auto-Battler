# Asset Credits

สรุปที่มาของไฟล์ภาพ/ข้อมูลทั้งหมดในโปรเจกต์ ระดับ "กลุ่มไฟล์" (ไม่ใช่รายไฟล์ — ดูรายละเอียด
เต็มในรูปแบบ machine-readable ที่ [`source_manifest.json`](./source_manifest.json))

## ภาพที่มาจาก AI image generation (ภายนอกโปรเจกต์)

`assets/v5/body_*.png`, `assets/v5/face_*.png`, `assets/v5/mon_*.png`,
`assets/v5/board_ground.jpg` — ผู้ใช้เจนภาพด้วยเครื่องมือ AI ภายนอก (เรียกกันในแชทว่า "GPT")
แล้วอัปโหลดเข้ามาให้ Claude ประมวลผลต่อ:

- ตัดพื้นหลัง/ลายตารางหมากรุกปลอมที่ติดมากับภาพ (flood-fill + ตรวจช่องปิดที่เข้าไม่ถึงจากขอบภาพ)
- ครอปให้ได้สัดส่วน, มาตรฐานตำแหน่งตา 48% ของความสูงสำหรับภาพหน้า
- เกลี่ยขอบภาพพื้นสนามให้กลืนกับพื้นหญ้ารอบข้าง

**สถานะลิขสิทธิ์**: ไม่ทราบเงื่อนไขที่แน่ชัดของเครื่องมือ AI ที่ใช้เจน — ยังไม่ได้ตรวจสอบ
สำหรับเอกสารนี้ ถ้าจะเผยแพร่โปรเจกต์ต่อสาธารณะควรตรวจสอบ TOS ของเครื่องมือที่ใช้ก่อน

## ภาพที่สร้างด้วยโค้ด (procedural, ไม่มีภายนอกเกี่ยวข้อง)

- `assets/icons/classes/*.png` — ไอคอนซินเนอร์จี 5 อัน วาดด้วย `tools/gen_class_icons.py`
- `assets/*.png` (roster/มอนสเตอร์แมพ 1 ชุดเดิม) — `tools/gen_sprites.py`, `tools/gen_bosses.py`
- `assets/heroes/*_sheet.png` — `tools/gen_heroes.py` (จับคู่พาเลตต์สีจาก character sheet
  ต้นฉบับที่ผู้ใช้อัปโหลดในแชท แต่ไม่ได้เก็บไฟล์ต้นฉบับนั้นไว้ในรีโป)
- `assets/portraits/*.png` — `tools/gen_portraits.py`

**สถานะลิขสิทธิ์**: งานต้นฉบับทั้งหมด ไม่มีการนำภาพ/โค้ดจากภายนอกมาใช้

## ฟอนต์ที่ฝังอยู่ในภาพที่สร้างด้วยโค้ด

`tools/gen_portraits.py` ใช้ฟอนต์จาก `/mnt/skills/examples/canvas-design/canvas-fonts`:

- **Gloock** (ชื่อตัวละคร) — Google Fonts, SIL Open Font License
- **IBM Plex Mono** (role/label) — Google Fonts, SIL Open Font License

## ข้อมูลเกม

`game_config.json` — ผู้ใช้ส่งมาเป็น JSON ในแชทโดยตรง ไม่ใช่ asset ภาพ ไม่มีประเด็นลิขสิทธิ์

---

อัปเดตไฟล์นี้ทุกครั้งที่เพิ่ม asset กลุ่มใหม่เข้าโปรเจกต์ — ระบุที่มา (AI-generated /
procedural / user-provided) และเครื่องมือ/สคริปต์ที่ใช้เสมอ

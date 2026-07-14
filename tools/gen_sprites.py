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

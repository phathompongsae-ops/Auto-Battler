"""
Hero sprite + animation generator — 8 ตัวละครฮีโร่ตาม character sheet อนิเมะ
(Blade Master, Beast Lord, Trickster, Duelist, Archmage, Frost Weaver, Summoner, Sniper)

พาเลตต์สีอ้างอิงจากภาพชีตที่ผู้ใช้ส่งมา (Main/Sub colors ต่อตัว)
สัดส่วน "mild chibi": หัว 7px จากความสูงตัวรวม ~26px ใช้งาน (~1:3.3)

แต่ละตัวได้สไปรท์ชีตแนวนอน 8 เฟรม:
  [0] idle  [1-4] walk cycle  [5-7] attack (windup / strike-cast / recover)
ขนาดต่อเฟรม 28x34 พิกเซล ขยาย 6 เท่า -> 168x204 ต่อเฟรม
"""
from PIL import Image, ImageDraw
import os

W, H = 28, 34
SCALE = 6
OUT = "assets/heroes"
os.makedirs(OUT, exist_ok=True)

def new_canvas():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def px(d, x, y, w, h, c):
    if w <= 0 or h <= 0:
        return
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

DARK = (20, 14, 10, 255)

# ============================================================
# ร่างมนุษย์พารามิเตอร์ได้ — รองรับออฟเซ็ตแขน/ขา/ชายเสื้อคลุมสำหรับแอนิเมชัน
# หัวขยายเป็น 7px (จาก 6px เดิม) ตามมติ "mild chibi" หัว:ตัว ~1:3.3
# ============================================================
def humanoid2(d, skin, hair, cloth, pants, boots, cloth_hi=None, robe=False,
              leg_dx=0, leg_dy=0, arm_dx=0, arm_dy=0, hem_dx=0, female=False):
    # หัว (7px)
    px(d, 10, 2, 7, 7, skin)
    px(d, 11, 5, 1, 1, DARK)
    px(d, 15, 5, 1, 1, DARK)
    # ผม
    px(d, 10, 1, 7, 2, hair)
    if female:
        px(d, 17, 3, 2, 8, hair)   # หางม้ายาวด้านหลัง
    # คอ
    px(d, 12, 9, 3, 1, skin)
    if robe:
        px(d, 8 + hem_dx, 10, 12, 15, cloth)
        px(d, 7 + hem_dx, 23, 14, 3, cloth)
        if cloth_hi: px(d, 8 + hem_dx, 10, 12, 1, cloth_hi)
        px(d, 10, 25, 2, 2, boots)
        px(d, 15, 25, 2, 2, boots)
    else:
        skirt_w = 12 if female else 9
        px(d, 9, 10, skirt_w, 8, cloth)
        if cloth_hi: px(d, 9, 10, skirt_w, 1, cloth_hi)
        lx, rx = 10 + leg_dx, 15 - leg_dx
        px(d, lx, 18 + leg_dy, 2, 7, pants)
        px(d, rx, 18 - leg_dy, 2, 7, pants)
        px(d, lx - 1, 25 + leg_dy, 3, 2, boots)
        px(d, rx - 1, 25 - leg_dy, 3, 2, boots)
    ax, rx2 = 7 + arm_dx, 19 - arm_dx
    px(d, ax, 11 + arm_dy, 2, 7, skin)
    px(d, rx2, 11 - arm_dy, 2, 7, skin)
    return ax, rx2  # คืนตำแหน่ง x แขน สำหรับวางอาวุธ

def glow(d, cx, cy, r, color):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

def slash_arc(d, cx, cy, color):
    for i, (dx, dy) in enumerate([(-6, 4), (-3, 1), (0, -2), (3, -5), (6, -8)]):
        px(d, cx + dx, cy + dy, 2, 2, color)

def save_frame(img):
    return img.resize((W * SCALE, H * SCALE), Image.NEAREST)

# ============================================================
# อาวุธ — สองแม่แบบแอนิเมชัน: melee_swing (ประชิด) / ranged_cast (ระยะไกล/เวท)
# ============================================================
def draw_melee_weapon(d, arm_rx, arm_ry, phase, blade_color, hilt_color, length=15):
    """phase: idle/walk=0(ท่าปกติ), windup=1, strike=2, recover=3"""
    if phase == 0:
        px(d, arm_rx + 1, arm_ry - 1, 2, length, blade_color)
        px(d, arm_rx, arm_ry + length - 2, 4, 1, hilt_color)
    elif phase == 1:  # windup — ยกอาวุธขึ้นหลัง
        for i in range(length):
            d.point((arm_rx + 3 + i // 4, arm_ry - 2 - i), fill=blade_color)
        px(d, arm_rx + 1, arm_ry - 2, 3, 2, hilt_color)
    elif phase == 2:  # strike — ฟันแนวทแยงลงหน้า + ริ้วแสง
        for i in range(length):
            d.point((arm_rx - 1 - i // 2, arm_ry + 2 + i), fill=blade_color)
        px(d, arm_rx - 2, arm_ry + 1, 3, 2, hilt_color)
        slash_arc(d, arm_rx - 4, arm_ry + 6, (255, 255, 255, 130))
    else:  # recover
        px(d, arm_rx - 1, arm_ry, 2, length - 3, blade_color)
        px(d, arm_rx - 2, arm_ry + length - 5, 4, 1, hilt_color)

def draw_ranged_weapon(d, arm_rx, arm_ry, phase, shaft_color, tip_color, glow_color,
                        length=16, projectile=None):
    """phase: idle/walk=0, windup=1, cast=2, recover=3"""
    if phase == 0:
        px(d, arm_rx + 1, arm_ry - 4, 2, length, shaft_color)
        glow(d, arm_rx + 2, arm_ry - 4, 2, tip_color)
    elif phase == 1:  # windup — ยกคทา/อาวุธขึ้น
        px(d, arm_rx + 1, arm_ry - 9, 2, length, shaft_color)
        glow(d, arm_rx + 2, arm_ry - 9, 2, tip_color)
    elif phase == 2:  # cast/shoot — เรืองแสงเต็มที่ + กระสุน/เวท
        px(d, arm_rx + 1, arm_ry - 8, 2, length, shaft_color)
        glow(d, arm_rx + 2, arm_ry - 9, 4, glow_color)
        glow(d, arm_rx + 2, arm_ry - 9, 2, tip_color)
        if projectile:
            glow(d, arm_rx + 9, arm_ry - 9, 2, projectile)
            glow(d, arm_rx + 14, arm_ry - 9, 1, projectile)
    else:  # recover
        px(d, arm_rx + 1, arm_ry - 6, 2, length - 2, shaft_color)
        glow(d, arm_rx + 2, arm_ry - 6, 2, tip_color)

def draw_companion(d, x, y, body_color, glow_color, active):
    """สัตว์ร่วมทางตัวเล็ก — มังกร/หมาป่าวิญญาณ"""
    px(d, x, y, 5, 4, body_color)
    px(d, x + 4, y - 2, 3, 3, body_color)   # หัว
    px(d, x + 6, y - 1, 1, 1, glow_color)   # ตา
    if active:
        px(d, x - 3, y - 1, 3, 3, body_color)  # ปีก/ปากกาง
        glow(d, x + 7, y, 2, glow_color)
    else:
        px(d, x - 2, y + 1, 2, 2, body_color)

# ============================================================
# สร้างเฟรมทั้ง 8 ให้ตัวละคร 1 ตัว แล้วประกอบเป็นสไปรท์ชีตแนวนอน
# ============================================================
WALK_LEG = [(0, 0), (2, 2), (0, 0), (-2, -2)]
WALK_ARM = [(0, 0), (-2, 2), (0, 0), (2, -2)]

def build_hero(key, skin, hair, cloth, pants, boots, cloth_hi, robe, melee,
               weapon_colors, female=False, companion=None):
    frames = []

    def frame(phase, leg=(0, 0), arm=(0, 0), hem=0, atk_phase=0, companion_active=False):
        img, d = new_canvas()
        ax, rx = humanoid2(d, skin, hair, cloth, pants, boots, cloth_hi, robe,
                            leg_dx=leg[0], leg_dy=leg[1], arm_dx=arm[0], arm_dy=arm[1],
                            hem_dx=hem, female=female)
        arm_ry = 11 - arm[1]
        if melee:
            draw_melee_weapon(d, rx, arm_ry, atk_phase, *weapon_colors)
        else:
            draw_ranged_weapon(d, rx, arm_ry, atk_phase, *weapon_colors)
        if companion:
            draw_companion(d, 1, 16, companion[0], companion[1], companion_active)
        return save_frame(img)

    frames.append(frame(0))                                   # 0 idle
    for lo, ao in zip(WALK_LEG, WALK_ARM):                      # 1-4 walk
        frames.append(frame(0, leg=lo, arm=ao, hem=lo[0]))
    frames.append(frame(1, atk_phase=1))                        # 5 windup
    frames.append(frame(2, atk_phase=2, companion_active=True)) # 6 strike/cast
    frames.append(frame(3, atk_phase=3))                        # 7 recover

    sheet = Image.new("RGBA", (W * SCALE * 8, H * SCALE), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W * SCALE, 0), f)
    sheet.save(f"{OUT}/{key}_sheet.png")
    return sheet, frames[0]

SKIN = (217, 168, 120, 255)
SKIN_PALE = (230, 200, 174, 255)
GOLD = (196, 162, 88, 255)

heroes = {}
icons = {}

# --- Blade Master — ขาว/ฟ้า/น้ำเงินเข้ม, ดาบยาว ---
sheet, icon = build_hero(
    "blademaster", SKIN, (32, 46, 82, 255), (228, 224, 214, 255),
    (56, 70, 104, 255), (30, 34, 46, 255), (110, 150, 206, 255), False, True,
    weapon_colors=((208, 224, 240, 255), GOLD, 15))
heroes["blademaster"] = sheet; icons["blademaster"] = icon

# --- Beast Lord — เขียว/น้ำตาล/ทอง, คทา+มังกรวิญญาณ ---
sheet, icon = build_hero(
    "beastlord", SKIN, (196, 168, 110, 255), (104, 138, 90, 255),
    (96, 76, 52, 255), (40, 32, 22, 255), (150, 178, 118, 255), False, False,
    weapon_colors=((100, 74, 48, 255), (120, 210, 150, 255), (150, 240, 180, 160), 16, (150, 240, 180, 255)),
    companion=((80, 140, 92, 255), (150, 240, 180, 255)))
heroes["beastlord"] = sheet; icons["beastlord"] = icon

# --- Trickster — ม่วง/เขียวหัวเป็ด/ทอง, การ์ด+ระเบิดควัน ---
sheet, icon = build_hero(
    "trickster", SKIN, (150, 110, 190, 255), (106, 70, 140, 255),
    (46, 30, 60, 255), (26, 20, 34, 255), (150, 200, 190, 255), False, False,
    weapon_colors=((90, 60, 40, 255), (230, 220, 240, 255), (180, 140, 220, 160), 12, (220, 200, 255, 255)))
heroes["trickster"] = sheet; icons["trickster"] = icon

# --- Duelist — แดงเลือดหมู/ครีม/ทอง, ดาบเรเปียร์ ---
sheet, icon = build_hero(
    "duelist", SKIN, (140, 70, 46, 255), (122, 40, 40, 255),
    (60, 30, 30, 255), (32, 24, 20, 255), (230, 220, 200, 255), False, True,
    weapon_colors=((214, 214, 224, 255), (150, 30, 30, 255), 16))
heroes["duelist"] = sheet; icons["duelist"] = icon

# --- Archmage — ขาว/ม่วงเข้ม/ทอง, คทา+หนังสือ (ผมขาวเฒ่า) ---
sheet, icon = build_hero(
    "archmage", SKIN_PALE, (230, 228, 222, 255), (228, 224, 214, 255),
    None, (30, 26, 22, 255), (140, 100, 190, 255), True, False,
    weapon_colors=((196, 162, 88, 255), (150, 90, 200, 255), (190, 140, 230, 160), 17, (200, 160, 240, 255)))
heroes["archmage"] = sheet; icons["archmage"] = icon

# --- Frost Weaver — ขาว/ฟ้าน้ำแข็ง/กรมท่า, คทาคริสตัล ---
sheet, icon = build_hero(
    "frostweaver", SKIN, (200, 214, 230, 255), (232, 238, 244, 255),
    None, (34, 44, 66, 255), (120, 176, 224, 255), True, False,
    weapon_colors=((160, 210, 240, 255), (200, 232, 250, 255), (150, 210, 250, 160), 17, (210, 240, 255, 255)))
heroes["frostweaver"] = sheet; icons["frostweaver"] = icon

# --- Summoner — ม่วงเข้ม/ดำ/ทอง, คทา+หมาป่าวิญญาณ (ใส่แว่น) ---
sheet, icon = build_hero(
    "summoner", SKIN, (60, 46, 40, 255), (44, 32, 62, 255),
    (26, 20, 34, 255), (18, 14, 22, 255), (76, 58, 96, 255), False, False,
    weapon_colors=((60, 48, 70, 255), (170, 110, 230, 255), (150, 90, 210, 160), 16, (180, 130, 240, 255)),
    companion=((44, 34, 56, 255), (180, 100, 230, 255)))
heroes["summoner"] = sheet; icons["summoner"] = icon

# --- Sniper — กรมท่า/เงิน/ฟ้าเหล็ก, ปืนไรเฟิล (หญิง หางม้ายาว) ---
sheet, icon = build_hero(
    "sniper", SKIN_PALE, (210, 214, 222, 255), (42, 56, 88, 255),
    (30, 40, 62, 255), (20, 22, 30, 255), (150, 170, 196, 255), False, False,
    weapon_colors=((150, 160, 176, 255), (170, 220, 250, 255), (160, 220, 250, 160), 18, (220, 240, 255, 255)),
    female=True)
heroes["sniper"] = sheet; icons["sniper"] = icon

# ============================================================
# Contact sheet รวม (แถวละตัว x 8 คอลัมน์เฟรม) ไว้ตรวจสไตล์เร็ว
# ============================================================
CELL_W, CELL_H = W * SCALE + 6, H * SCALE + 22
names = list(heroes.keys())
sheet = Image.new("RGBA", (CELL_W * 8, CELL_H * len(names)), (36, 28, 20, 255))
ds = ImageDraw.Draw(sheet)
for r, n in enumerate(names):
    frame_sheet = heroes[n]
    for c in range(8):
        fx, fy = c * CELL_W, r * CELL_H
        crop = frame_sheet.crop((c * W * SCALE, 0, (c + 1) * W * SCALE, H * SCALE))
        sheet.paste(crop, (fx + 3, fy + 3), crop)
    ds.text((4, r * CELL_H + CELL_H - 18), n, fill=(224, 210, 180, 255))
sheet.save("assets/heroes_contact_sheet.png")
print("done:", len(names), "heroes x 8 frames each ->", OUT)

"""
Portrait generator — การ์ดภาพตัวละครฮีโร่ 8 คน (สัดส่วนสมจริงแบบ FF ตาม GDD ข้อ 2)
วาดด้วยรูปทรงเวกเตอร์แบน (rounded rect / polygon / ellipse) ซูเปอร์แซมเปิล 3x แล้วลดขนาด
เพื่อให้ขอบเรียบ ไม่ใช่พิกเซลอาร์ต — อ้างอิงพาเลตต์สี/อาวุธ/ผมจาก character sheet ต้นฉบับ
ยังคง "procedural placeholder" ไม่ใช่ AI art จริง (รอนำเข้าเมื่อมีเครื่องมือ image-gen)
"""
from PIL import Image, ImageDraw, ImageFont
import math, os

LW, LH = 480, 720          # ขนาด logical
SS = 3                      # supersample
W, H = LW * SS, LH * SS
OUT = "assets/portraits"
os.makedirs(OUT, exist_ok=True)
FONT_DIR = "/mnt/skills/examples/canvas-design/canvas-fonts"

def font(name, size):
    return ImageFont.truetype(f"{FONT_DIR}/{name}", size * SS)

TITLE_FONT = "Gloock-Regular.ttf"
LABEL_FONT = "IBMPlexMono-Regular.ttf"
LABEL_BOLD = "IBMPlexMono-Bold.ttf"

def S(v): return v * SS

def rect(d, x0, y0, x1, y1, r=0, **kw):
    d.rounded_rectangle([S(x0), S(y0), S(x1), S(y1)], radius=S(r), **kw)

def ellipse(d, x0, y0, x1, y1, **kw):
    d.ellipse([S(x0), S(y0), S(x1), S(y1)], **kw)

def polygon(d, pts, **kw):
    d.polygon([(S(x), S(y)) for x, y in pts], **kw)

def line(d, pts, **kw):
    kw2 = dict(kw)
    if 'width' in kw2: kw2['width'] = S(kw2['width'])
    d.line([(S(x), S(y)) for x, y in pts], **kw2)

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def vgrad(img, top, bottom):
    g = Image.new("RGB", (1, H))
    for y in range(H):
        g.putpixel((0, y), lerp(top, bottom, y / H))
    return g.resize((W, H))

def radial_glow(size, color, alpha=140):
    g = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dd = ImageDraw.Draw(g)
    steps = 40
    for i in range(steps, 0, -1):
        t = i / steps
        r = size / 2 * t
        a = int(alpha * (1 - t) ** 1.6)
        dd.ellipse([size/2-r, size/2-r, size/2+r, size/2+r], fill=(*color, a))
    return g

# ============================================================
# ตัวการ์ตูนหลัก — วาดตามสเปกพาเลตต์/อาวุธ/ท่าทางของแต่ละฮีโร่
# ============================================================
OUTLINE = (24, 17, 12, 255)

def draw_hero(d, spec):
    cx = 240
    skin, hair, cloak, cloak_sub, accent, boots = (
        spec['skin'], spec['hair'], spec['cloak'], spec['cloak_sub'], spec['accent'], spec['boots'])
    female = spec.get('female', False)
    robe = spec.get('robe', False)

    # เงาใต้เท้า
    ellipse(d, cx-70, 618, cx+70, 640, fill=(10, 8, 6, 140))

    # สัตว์ร่วมทาง (วาดก่อนสุดให้อยู่ด้านหลังตัวละคร)
    if spec.get('companion'):
        cc, cg = spec['companion']
        bx, by = cx - 152, 440
        ellipse(d, bx-16, by-10, bx+50, by+40, fill=cc, outline=OUTLINE, width=3)
        polygon(d, [(bx+34,by-4),(bx+70,by-26),(bx+58,by+6)], fill=cc, outline=OUTLINE, width=2)
        ellipse(d, bx+34, by+2, bx+46, by+14, fill=cg)

    # เคปด้านหลัง — วาดก่อนลำตัวให้โผล่เป็นขอบบางๆ รอบตัว ไม่ทับแขน/อาวุธ
    polygon(d, [(cx-70,252),(cx+70,252),(cx+104,462),(cx-104,462)], fill=cloak_sub, outline=OUTLINE, width=3)

    # ขา
    leg_w = 30
    if robe:
        polygon(d, [(cx-84,430),(cx+84,430),(cx+100,616),(cx-100,616)], fill=cloak, outline=OUTLINE, width=3)
        polygon(d, [(cx-84,430),(cx-62,430),(cx-76,470),(cx-90,470)], fill=cloak_sub)
        ellipse(d, cx-30, 604, cx-2, 626, fill=boots, outline=OUTLINE, width=2)
        ellipse(d, cx+2, 604, cx+30, 626, fill=boots, outline=OUTLINE, width=2)
    else:
        skirt_flare = 46 if female else 20
        polygon(d, [(cx-66,410),(cx+66,410),(cx+66+skirt_flare*0.3,462),(cx-66-skirt_flare*0.3,462)], fill=cloak, outline=OUTLINE, width=3)
        rect(d, cx-58, 462, cx-58+leg_w, 604, r=10, fill=spec['pants'], outline=OUTLINE, width=2)
        rect(d, cx+58-leg_w, 462, cx+58, 604, r=10, fill=spec['pants'], outline=OUTLINE, width=2)
        rect(d, cx-64, 588, cx-58+leg_w+6, 620, r=10, fill=boots, outline=OUTLINE, width=2)
        rect(d, cx+58-leg_w-6, 588, cx+64, 620, r=10, fill=boots, outline=OUTLINE, width=2)

    # ลำตัว/เสื้อคลุม (ทับขอบเคปตรงกลาง เหลือขอบเคปโผล่รอบขอบ)
    if robe:
        polygon(d, [(cx-76,255),(cx+76,255),(cx+82,430),(cx-82,430)], fill=cloak, outline=OUTLINE, width=3)
        polygon(d, [(cx-76,255),(cx-52,255),(cx-56,340),(cx-82,340)], fill=cloak_sub)
        rect(d, cx-78, 258, cx+78, 268, r=4, fill=accent)
    else:
        rect(d, cx-66, 250, cx+66, 418, r=24, fill=cloak, outline=OUTLINE, width=3)
        rect(d, cx-66, 250, cx+66, 296, r=24, fill=cloak_sub)
        rect(d, cx-58, 398, cx+58, 420, r=8, fill=accent, outline=OUTLINE, width=2)

    # แขน (วาดหลังเคป/ลำตัว)
    arm_y = 266
    rect(d, cx-100, arm_y, cx-70, arm_y+136, r=14, fill=cloak_sub, outline=OUTLINE, width=2)
    rect(d, cx+70, arm_y, cx+100, arm_y+136, r=14, fill=cloak_sub, outline=OUTLINE, width=2)
    rect(d, cx-96, arm_y+116, cx-74, arm_y+164, r=10, fill=skin, outline=OUTLINE, width=2)
    rect(d, cx+74, arm_y+116, cx+96, arm_y+164, r=10, fill=skin, outline=OUTLINE, width=2)

    # อาวุธ (วาดทับขวาตัว บนสุด)
    draw_weapon(d, cx, spec)

    # คอ + หัว + หน้า
    rect(d, cx-15, 233, cx+15, 260, fill=skin)
    ellipse(d, cx-50, 148, cx+50, 248, fill=skin, outline=OUTLINE, width=3)
    # คิ้ว
    line(d, [(cx-30,186),(cx-16,182)], fill=(70,50,36,255), width=3)
    line(d, [(cx+16,182),(cx+30,186)], fill=(70,50,36,255), width=3)
    # ตา
    ellipse(d, cx-30, 192, cx-18, 204, fill=(30,22,16,255))
    ellipse(d, cx+18, 192, cx+30, 204, fill=(30,22,16,255))
    ellipse(d, cx-27, 193, cx-23, 197, fill=(255,255,255,220))
    ellipse(d, cx+21, 193, cx+25, 197, fill=(255,255,255,220))
    # ปาก
    line(d, [(cx-10,224),(cx,228),(cx+10,224)], fill=(150,90,70,220), width=3)

    draw_hair(d, cx, hair, spec.get('hair_style', 'short'), female)

def draw_weapon(d, cx, spec):
    wt = spec['weapon']
    wc = spec['weapon_color']
    ac = spec.get('weapon_accent', spec['accent'])
    x = cx + 96
    if wt == 'sword':
        rect(d, x-7, 130, x+7, 400, r=6, fill=wc)
        rect(d, x-3, 130, x+3, 400, r=3, fill=(255,255,255,90))
        rect(d, x-26, 292, x+26, 308, r=6, fill=ac)
        rect(d, x-9, 300, x+9, 350, r=6, fill=(70,60,40,255))
    elif wt == 'rapier':
        line(d, [(x, 140), (x-10, 400)], fill=wc, width=5)
        ellipse(d, x-30, 288, x+10, 320, outline=ac, width=5)
        rect(d, x-14, 300, x+2, 340, r=5, fill=(90,20,20,255))
    elif wt == 'staff':
        rect(d, x-8, 190, x+8, 420, r=6, fill=wc)
        ellipse(d, x-30, 150, x+30, 210, fill=ac)
        ellipse(d, x-18, 162, x+18, 198, fill=spec['weapon_glow'])
    elif wt == 'rifle':
        rect(d, x-90, 250, x+40, 272, r=8, fill=wc)
        rect(d, x-96, 258, x-70, 300, r=6, fill=wc)
        ellipse(d, x+18, 252, x+40, 270, fill=spec['weapon_glow'])
        rect(d, x+30, 244, x+40, 278, r=4, fill=ac)
    elif wt == 'cards':
        for i, ang in enumerate([-18, -6, 6, 18]):
            xo = x - 10 + i * 4
            polygon(d, [(xo,300),(xo+34,290),(xo+40,340),(xo+6,352)], fill=wc if i % 2 == 0 else ac)
        ellipse(d, x-40, 330, x+10, 370, fill=(*spec['weapon_glow'][:3], 90))

def draw_hair(d, cx, hair, style, female):
    if style == 'bald_beard':
        polygon(d, [(cx-50,180),(cx-48,150),(cx+48,150),(cx+50,180),(cx+38,166),(cx-38,166)],
                fill=hair, outline=OUTLINE, width=2)
        polygon(d, [(cx-34,230),(cx+34,230),(cx+24,278),(cx-24,278)], fill=hair, outline=OUTLINE, width=2)
        return
    polygon(d, [(cx-56,188),(cx-40,138),(cx+40,138),(cx+56,188),(cx+40,164),(cx-40,164)],
            fill=hair, outline=OUTLINE, width=2)
    polygon(d, [(cx-52,168),(cx-60,228),(cx-44,218)], fill=hair, outline=OUTLINE, width=2)
    polygon(d, [(cx+52,168),(cx+60,228),(cx+44,218)], fill=hair, outline=OUTLINE, width=2)
    if female:
        polygon(d, [(cx+48,178),(cx+70,258),(cx+80,418),(cx+58,418),(cx+50,278)],
                fill=hair, outline=OUTLINE, width=2)

def draw_frame(img, spec, key_label, role_label):
    d = ImageDraw.Draw(img)
    accent = spec['accent']
    rect(d, 10, 10, LW-10, LH-10, r=14, outline=accent, width=3)
    for cx0, cy0 in [(10,10),(LW-10,10),(10,LH-10),(LW-10,LH-10)]:
        ellipse(d, cx0-6, cy0-6, cx0+6, cy0+6, fill=accent)
    rect(d, 10, LH-96, LW-10, LH-10, r=14, fill=(12,9,7,215))
    rect(d, 10, LH-96, LW-10, LH-10, r=14, outline=accent, width=2)
    tf = font(TITLE_FONT, 26)
    lf = font(LABEL_FONT, 13)
    d.text((S(LW/2), S(LH-72)), key_label, font=tf, fill=(240,230,205,255), anchor="mm")
    d.text((S(LW/2), S(LH-40)), role_label, font=lf, fill=(190,170,130,255), anchor="mm")
    # สวอทช์พาเลตต์มุมล่างซ้าย (อ้างอิงพาเนล Palette ของชีตต้นฉบับ)
    for i, c in enumerate(spec['swatches']):
        ellipse(d, 26 + i*22, LH-24, 26 + i*22 + 16, LH-8, fill=c, outline=(0,0,0,120), width=1)

def render(key, spec, title, role):
    img = vgrad(None, spec['bg_top'], spec['bg_bottom']).convert("RGBA")
    glow = radial_glow(int(W*0.62), spec['accent'][:3] if len(spec['accent'])==3 else spec['accent'], 130)
    img.alpha_composite(glow, (W//2 - glow.width//2, int(H*0.18)))
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    draw_hero(d, spec)
    img.alpha_composite(layer)
    draw_frame(img, spec, title, role)
    small = img.resize((LW, LH), Image.LANCZOS)
    small.convert("RGB").save(f"{OUT}/{key}.png", quality=95)
    return small

HERO_SPECS = {
    "blademaster": dict(
        title="BLADE MASTER", role="Physical / Burst — Melee Duelist",
        skin=(217,168,120), hair=(28,40,74), hair_style='short',
        cloak=(228,224,214), cloak_sub=(96,132,186), accent=(196,162,88), boots=(30,34,46),
        pants=(56,70,104), weapon='sword', weapon_color=(210,225,240), weapon_accent=(196,162,88),
        bg_top=(58,84,120), bg_bottom=(16,20,30),
        swatches=[(228,224,214),(96,132,186),(196,162,88),(30,34,46)]),
    "beastlord": dict(
        title="BEAST LORD", role="Summoner / Physical — Front Support",
        skin=(217,168,120), hair=(196,168,110), hair_style='short',
        cloak=(104,138,90), cloak_sub=(96,76,52), accent=(196,162,88), boots=(40,32,22),
        pants=(96,76,52), weapon='staff', weapon_color=(100,74,48), weapon_accent=(120,210,150),
        weapon_glow=(150,240,180), companion=((80,140,92),(150,240,180)),
        bg_top=(58,96,64), bg_bottom=(14,22,16),
        swatches=[(104,138,90),(96,76,52),(196,162,88),(120,210,150)]),
    "trickster": dict(
        title="TRICKSTER", role="Merchant / Dexterity — Ranged Control",
        skin=(217,168,120), hair=(150,110,190), hair_style='short',
        cloak=(106,70,140), cloak_sub=(54,120,120), accent=(196,162,88), boots=(26,20,34),
        pants=(46,30,60), weapon='cards', weapon_color=(230,220,240), weapon_accent=(150,90,190),
        weapon_glow=(180,140,220), bg_top=(66,54,96), bg_bottom=(16,14,24),
        swatches=[(106,70,140),(54,120,120),(196,162,88),(180,140,220)]),
    "duelist": dict(
        title="DUELIST", role="Swordman / Physical — Speed & Crit",
        skin=(217,168,120), hair=(140,70,46), hair_style='short',
        cloak=(122,40,40), cloak_sub=(230,220,200), accent=(196,162,88), boots=(32,24,20),
        pants=(60,30,30), weapon='rapier', weapon_color=(214,214,224), weapon_accent=(150,30,30),
        bg_top=(96,48,48), bg_bottom=(20,12,12),
        swatches=[(122,40,40),(230,220,200),(196,162,88),(150,30,30)]),
    "archmage": dict(
        title="ARCHMAGE", role="Mage / Magic — Arcane Burst",
        skin=(230,200,174), hair=(230,228,222), hair_style='bald_beard',
        cloak=(228,224,214), cloak_sub=(140,100,190), accent=(196,162,88), boots=(30,26,22),
        pants=None, robe=True, weapon='staff', weapon_color=(196,162,88), weapon_accent=(150,90,200),
        weapon_glow=(200,160,240), bg_top=(78,64,110), bg_bottom=(18,16,26),
        swatches=[(228,224,214),(140,100,190),(196,162,88),(200,160,240)]),
    "frostweaver": dict(
        title="FROST WEAVER", role="Mage / Control — Ice Domain",
        skin=(217,168,120), hair=(200,214,230), hair_style='short',
        cloak=(232,238,244), cloak_sub=(120,176,224), accent=(150,190,220), boots=(34,44,66),
        pants=None, robe=True, weapon='staff', weapon_color=(160,210,240), weapon_accent=(200,232,250),
        weapon_glow=(210,240,255), bg_top=(70,110,150), bg_bottom=(14,20,30),
        swatches=[(232,238,244),(120,176,224),(150,190,220),(210,240,255)]),
    "summoner": dict(
        title="SUMMONER", role="Summoner / Support — Field Control",
        skin=(217,168,120), hair=(60,46,40), hair_style='short',
        cloak=(44,32,62), cloak_sub=(26,20,34), accent=(196,162,88), boots=(18,14,22),
        pants=(26,20,34), weapon='staff', weapon_color=(60,48,70), weapon_accent=(170,110,230),
        weapon_glow=(180,130,240), companion=((44,34,56),(180,100,230)),
        bg_top=(54,42,74), bg_bottom=(12,10,18),
        swatches=[(44,32,62),(26,20,34),(196,162,88),(180,130,240)]),
    "sniper": dict(
        title="SNIPER", role="Ranged / Physical — Long-range DPS",
        skin=(230,200,174), hair=(210,214,222), hair_style='short', female=True,
        cloak=(42,56,88), cloak_sub=(150,170,196), accent=(196,162,88), boots=(20,22,30),
        pants=(30,40,62), weapon='rifle', weapon_color=(150,160,176), weapon_accent=(196,162,88),
        weapon_glow=(170,220,250), bg_top=(30,42,70), bg_bottom=(8,10,18),
        swatches=[(42,56,88),(150,170,196),(196,162,88),(170,220,250)]),
}

if __name__ == "__main__":
    for key, spec in HERO_SPECS.items():
        render(key, spec, spec["title"], spec["role"])
        print("saved", key)

    # contact sheet รวม
    cols = 4
    thumb_w, thumb_h = 260, 390
    keys = list(HERO_SPECS.keys())
    rows = (len(keys) + cols - 1) // cols
    sheet = Image.new("RGB", (cols*thumb_w+40, rows*thumb_h+40), (20,16,12))
    for i, k in enumerate(keys):
        im = Image.open(f"{OUT}/{k}.png").resize((thumb_w-16, thumb_h-16), Image.LANCZOS)
        x, y = 20 + (i % cols) * thumb_w, 20 + (i // cols) * thumb_h
        sheet.paste(im, (x, y))
    sheet.save(f"{OUT}/portraits_contact_sheet.png")
    print("contact sheet saved")

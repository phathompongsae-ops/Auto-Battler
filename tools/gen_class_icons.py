"""
Class/synergy icon generator — 5 ไอคอนกลมสำหรับแท็กซินเนอร์จี (Warrior/Ranger/Mage/Forest/
Merchant) ที่ใช้ใน threejs-2_5d-clean-v5.html (แผง Synergy) วาดด้วยรูปทรงเวกเตอร์แบน
(polygon/line/ellipse) ซูเปอร์แซมเปิล 4x แล้วลดขนาด เพื่อให้ขอบเรียบ สไตล์เดียวกับ
CLASS_BADGE ที่วาดสดด้วย Canvas 2D ในเกม (blade/bow/staff+orb) บวกไอคอนใหม่ 2 อัน
(Forest, Merchant) ที่เกมยังไม่เคยมี — พื้นหลังวงกลมใช้สีเดียวกับ TAG_COLORS ในเกมเป๊ะ
เพื่อให้ภาพเข้ากับสีที่มีอยู่แล้วในแผง Synergy/การ์ดร้านค้า
"""
from PIL import Image, ImageDraw
import math, os

LS = 128           # ขนาด logical (ไอคอนสี่เหลี่ยมจัตุรัส)
SS = 4              # supersample
S_ = LS * SS
OUT = "assets/icons/classes"
os.makedirs(OUT, exist_ok=True)

# ต้องตรงกับ TAG_COLORS ใน threejs-2_5d-clean-v5.html เป๊ะ
TAG_COLORS = {
    "warrior":  "#e0665a",
    "ranger":   "#6fce8f",
    "mage":     "#8ab6ff",
    "forest":   "#8fd16a",
    "merchant": "#e0b04c",
}

def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def shade(rgb, pct):
    return tuple(max(0, min(255, int(c + 255 * pct / 100))) for c in rgb)

def s(v): return v * SS

def new_canvas():
    return Image.new("RGBA", (S_, S_), (0, 0, 0, 0))

def draw_backdrop(d, color):
    rgb = hexrgb(color)
    # radial-ish two-tone disc (lighter top, darker bottom) — matches the card glow style
    d.ellipse([s(6), s(6), s(122), s(122)], fill=shade(rgb, -8))
    d.ellipse([s(10), s(10), s(118), s(50)], fill=shade(rgb, 22))

def save(name, im):
    im = im.resize((LS, LS), Image.LANCZOS)
    im.save(f"{OUT}/{name}.png", optimize=True)
    print("saved", f"{OUT}/{name}.png")

def icon_warrior():
    im = new_canvas(); d = ImageDraw.Draw(im)
    draw_backdrop(d, TAG_COLORS["warrior"])
    cx, cy = 64, 66
    # blade
    d.line([(s(cx-24), s(cy+26)), (s(cx+26), s(cy-24))], fill=(238, 238, 238, 255), width=s(7))
    d.polygon([(s(cx+26), s(cy-24)), (s(cx+34), s(cy-32)), (s(cx+30), s(cy-20))], fill=(238, 238, 238, 255))
    # crossguard + hilt
    d.line([(s(cx-16), s(cy+10)), (s(cx-4), s(cy+22))], fill=hexrgb("#8a6a2a")+(255,), width=s(9))
    d.line([(s(cx-26), s(cy+20)), (s(cx-14), s(cy+32))], fill=hexrgb("#5a4118")+(255,), width=s(6))
    save("warrior", im)

def icon_ranger():
    im = new_canvas(); d = ImageDraw.Draw(im)
    draw_backdrop(d, TAG_COLORS["ranger"])
    cx, cy, r = 60, 64, 28
    # true semicircle bulging left (90°->270° sweeps through west) so the
    # string is exactly the vertical chord at x=cx — no guessed coordinates
    d.arc([s(cx-r), s(cy-r), s(cx+r), s(cy+r)], 90, 270, fill=hexrgb("#4a3320")+(255,), width=s(6))
    d.line([(s(cx), s(cy-r)), (s(cx), s(cy+r))], fill=(240, 236, 220, 255), width=s(3))
    d.line([(s(cx-16), s(cy)), (s(cx+r+16), s(cy))], fill=hexrgb("#4a3320")+(255,), width=s(4))
    d.polygon([(s(cx+r+16), s(cy)), (s(cx+r+4), s(cy-6)), (s(cx+r+4), s(cy+6))], fill=(240, 236, 220, 255))
    save("ranger", im)

def icon_mage():
    im = new_canvas(); d = ImageDraw.Draw(im)
    draw_backdrop(d, TAG_COLORS["mage"])
    cx, cy = 60, 70
    d.line([(s(cx-18), s(cy+28)), (s(cx+14), s(cy-20))], fill=hexrgb("#6a4a2c")+(255,), width=s(6))
    ox, oy, orb_r = cx+18, cy-30, 15
    d.ellipse([s(ox-orb_r), s(oy-orb_r), s(ox+orb_r), s(oy+orb_r)], fill=(90, 170, 235, 255))
    # off-center highlight blob (not a concentric ring) so it reads as a glowing
    # sphere rather than a magnifying-glass lens
    d.ellipse([s(ox-8), s(oy-9), s(ox+1), s(oy)], fill=(210, 240, 255, 230))
    save("mage", im)

def icon_forest():
    im = new_canvas(); d = ImageDraw.Draw(im)
    draw_backdrop(d, TAG_COLORS["forest"])
    cx = 64
    trunk = hexrgb("#5a3c22")
    d.rectangle([s(cx-6), s(88), s(cx+6), s(102)], fill=trunk+(255,))
    green_dark = hexrgb("#2c6939")
    green_light = hexrgb("#4a8a4f")
    d.polygon([(s(cx), s(30)), (s(cx-26), s(70)), (s(cx+26), s(70))], fill=green_dark+(255,))
    d.polygon([(s(cx), s(46)), (s(cx-22), s(84)), (s(cx+22), s(84))], fill=green_light+(255,))
    save("forest", im)

def icon_merchant():
    im = new_canvas(); d = ImageDraw.Draw(im)
    draw_backdrop(d, TAG_COLORS["merchant"])
    cx, cy = 64, 68
    gold = hexrgb("#ffe6a0")
    d.ellipse([s(cx-24), s(cy-24), s(cx+24), s(cy+24)], fill=hexrgb("#a97a24")+(255,), outline=gold+(255,), width=s(3))
    d.ellipse([s(cx-16), s(cy-16), s(cx+16), s(cy+16)], outline=gold+(200,), width=s(2))
    # simple star mark at the coin's center (no text glyphs, keeps it locale-agnostic)
    pts = []
    for i in range(5):
        ang = -math.pi/2 + i*2*math.pi/5
        pts.append((cx+10*math.cos(ang), cy+10*math.sin(ang)))
        ang2 = ang + math.pi/5
        pts.append((cx+4*math.cos(ang2), cy+4*math.sin(ang2)))
    d.polygon([(s(x), s(y)) for x, y in pts], fill=gold+(255,))
    save("merchant", im)

icon_warrior()
icon_ranger()
icon_mage()
icon_forest()
icon_merchant()
print("done")

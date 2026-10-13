import Phaser from 'phaser';

/*
 * Code-drawn 2x environment features (Visual Quality Pass 1), in the same
 * illustrated language as hdPropArt: the Crypt's stairwell portals (replacing
 * the purple placeholder squares), the sealed iron portcullis on Story gates
 * (replacing rune diamonds), and a soft contact shadow. Drawn once at boot;
 * visual only, no collision, no gameplay.
 */

type Ctx = CanvasRenderingContext2D;
const INK = '#1b1722';

export const CRYPT_PORTAL_KEY = 'env-crypt-portal';
export const GATE_SEAL_KEY = 'env-gate-seal';
export const SOFT_SHADOW_KEY = 'env-soft-shadow';

/** World size of the crypt portal art (a 2-tile doorway plus its frame). */
export const CRYPT_PORTAL_SIZE = { w: 96, h: 64 } as const;
/** World size of the gate seal (a 4-tile doorway, one tile deep). */
export const GATE_SEAL_SIZE = { w: 128, h: 44 } as const;

function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: readonly (readonly [number, string])[]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function rad(c: Ctx, x: number, y: number, r: number, stops: readonly (readonly [number, string])[]) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function block(c: Ctx, x: number, y: number, w: number, h: number, light: string, dark: string, r = 3): void {
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.lineWidth = 3;
  c.strokeStyle = INK;
  c.stroke();
  c.fillStyle = lin(c, x, y, x, y + h, [[0, light], [1, dark]]);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.14)';
  c.fillRect(x + 2, y + 2, w - 4, 3);
  c.restore();
}

/**
 * A stairwell leading out of the Crypt, seen from above: a dark descending stair
 * inside a carved stone frame, a cool pale glow of daylight at the bottom.
 * 2x canvas (192×128) for a 96×64 world footprint; the doorway is the middle 64 px.
 */
function cryptPortal(c: Ctx): void {
  const W = 192, H = 128;
  // Stair well: steps darkening toward the exit, a pale glow beyond.
  c.fillStyle = lin(c, 0, 18, 0, H, [[0, '#2a2733'], [1, '#0d0b12']]);
  c.fillRect(32, 18, 128, H - 18);
  for (let i = 0; i < 6; i++) {
    const y = 26 + i * 17;
    const shade = 70 - i * 9;
    c.fillStyle = `rgb(${shade},${shade - 4},${shade + 8})`;
    c.fillRect(34, y, 124, 11);
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.fillRect(34, y, 124, 2);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(34, y + 11, 124, 6);
  }
  c.fillStyle = rad(c, 96, H + 10, 70, [[0, 'rgba(190,220,255,0.55)'], [0.5, 'rgba(150,190,240,0.18)'], [1, 'rgba(150,190,240,0)']]);
  c.fillRect(32, 40, 128, H - 40);
  // Side posts and lintel of carved stone.
  block(c, 6, 10, 30, H - 10, '#8d8898', '#4b4757');
  block(c, 156, 10, 30, H - 10, '#8d8898', '#4b4757');
  block(c, 0, 0, W, 22, '#9b96a6', '#5c5868', 4);
  // Lintel carving: a small skull keystone and two rune grooves.
  c.fillStyle = '#d8d2c2';
  c.beginPath();
  c.ellipse(96, 10, 9, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = INK;
  c.stroke();
  c.fillStyle = INK;
  for (const x of [92, 100]) {
    c.beginPath();
    c.arc(x, 10, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = 'rgba(30,26,40,0.55)';
  c.lineWidth = 2;
  for (const x of [40, 136]) {
    c.beginPath();
    c.moveTo(x, 6);
    c.lineTo(x + 16, 6);
    c.moveTo(x, 14);
    c.lineTo(x + 16, 14);
    c.stroke();
  }
  // Moss and wear at the post feet.
  c.fillStyle = 'rgba(95,140,80,0.6)';
  for (const [x, y] of [[12, H - 8], [176, H - 10]] as const) {
    c.beginPath();
    c.ellipse(x, y, 8, 4, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * The Story gate seal: a dark iron portcullis across a 4-tile doorway with an
 * amber rune lock in the middle and a faint warm glow on the floor (2x: 256×88).
 */
function gateSeal(c: Ctx): void {
  const W = 256, H = 88;
  c.fillStyle = rad(c, W / 2, H - 14, 140, [[0, 'rgba(255,190,90,0.32)'], [1, 'rgba(255,190,90,0)']]);
  c.fillRect(0, 0, W, H);
  // Bars.
  for (let x = 14; x < W - 6; x += 20) {
    c.fillStyle = lin(c, x, 0, x + 8, 0, [[0, '#6f6a78'], [0.5, '#3b3742'], [1, '#24212a']]);
    c.fillRect(x, 6, 8, H - 16);
    c.fillStyle = INK;
    c.fillRect(x - 1, 6, 1.5, H - 16);
    // Spiked feet.
    c.beginPath();
    c.moveTo(x - 1, H - 10);
    c.lineTo(x + 4, H - 2);
    c.lineTo(x + 9, H - 10);
    c.closePath();
    c.fillStyle = '#2a2730';
    c.fill();
  }
  // Cross beams.
  for (const y of [14, 44]) {
    c.fillStyle = lin(c, 0, y, 0, y + 9, [[0, '#7a7484'], [1, '#2e2b35']]);
    c.fillRect(4, y, W - 8, 9);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(4, y, W - 8, 2);
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.strokeRect(4, y, W - 8, 9);
    for (let x = 14; x < W - 6; x += 20) {
      c.fillStyle = '#9a94a6';
      c.beginPath();
      c.arc(x + 4, y + 4.5, 2, 0, Math.PI * 2);
      c.fill();
    }
  }
  // Rune lock plate.
  const cx = W / 2, cy = 34;
  c.fillStyle = rad(c, cx, cy, 34, [[0, 'rgba(255,200,110,0.55)'], [1, 'rgba(255,200,110,0)']]);
  c.fillRect(cx - 40, cy - 34, 80, 68);
  c.beginPath();
  c.moveTo(cx, cy - 22);
  c.lineTo(cx + 20, cy);
  c.lineTo(cx, cy + 22);
  c.lineTo(cx - 20, cy);
  c.closePath();
  c.fillStyle = lin(c, cx - 20, cy - 22, cx + 20, cy + 22, [[0, '#8a6a32'], [1, '#3e2c12']]);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = INK;
  c.stroke();
  c.strokeStyle = '#ffd27a';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(cx, cy - 12);
  c.lineTo(cx, cy + 12);
  c.moveTo(cx - 8, cy - 4);
  c.lineTo(cx, cy + 4);
  c.lineTo(cx + 8, cy - 4);
  c.stroke();
  c.strokeStyle = 'rgba(255,240,200,0.9)';
  c.lineWidth = 1;
  c.stroke();
}

/** A soft elliptical contact shadow (64×24, alpha falling off to the rim). */
function softShadow(c: Ctx): void {
  c.save();
  c.translate(32, 12);
  c.scale(1, 12 / 32);
  c.fillStyle = rad(c, 0, 0, 32, [[0, 'rgba(8,6,14,1)'], [0.45, 'rgba(8,6,14,0.85)'], [1, 'rgba(8,6,14,0)']]);
  c.beginPath();
  c.arc(0, 0, 32, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

const ART: readonly [string, number, number, (c: Ctx) => void, number][] = [
  [CRYPT_PORTAL_KEY, 192, 128, cryptPortal, 0.5],
  [GATE_SEAL_KEY, 256, 88, gateSeal, 0.5],
  [SOFT_SHADOW_KEY, 64, 24, softShadow, 1],
];

/** Create the textures once (skipped for keys that already exist). */
export function createEnvFeatureTextures(scene: Phaser.Scene): void {
  for (const [key, w, h, draw, scale] of ART) {
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) continue;
    draw(tex.getContext());
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    (tex.customData as Record<string, unknown>).envDrawScale = scale;
  }
}

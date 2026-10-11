/*
 * Illustrated item, currency and passive / proc icons, CODE-DRAWN in this
 * repo (no generated or third-party art): 96×96 transparent canvases in the
 * game's smooth chibi-fantasy language (dark ink outline, soft gradient
 * shading, a lit top-left), drawn once on first use and reused as cached
 * data URLs. Symbol only: rarity frames, stack counts, cooldowns and lock
 * states stay UI layers. Anything without a drawing keeps its existing
 * lettered disc / vector glyph; `?iconArt=off` forces that fallback.
 */

type Ctx = CanvasRenderingContext2D;
type Pt = readonly [number, number];

export const ICON_ART_SIZE = 96;
const INK = '#1f1a26';

// ------------------------------------------------------------------ helpers

function shape(c: Ctx, path: () => void, fill: string | CanvasGradient, width = 3.5): void {
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.beginPath();
  path();
  c.closePath();
  if (width > 0) {
    c.lineWidth = width;
    c.strokeStyle = INK;
    c.stroke();
  }
  c.fillStyle = fill;
  c.fill();
  c.restore();
}
const poly = (c: Ctx, pts: readonly Pt[]) => () => pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
const oval = (c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => () => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
const rrect = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => () => c.roundRect(x, y, w, h, r);
function smooth(c: Ctx, pts: readonly Pt[]): () => void {
  return () => {
    const n = pts.length;
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = mid(pts[n - 1], pts[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
  };
}
function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: readonly (readonly [number, string])[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function rad(c: Ctx, x: number, y: number, r: number, stops: readonly (readonly [number, string])[]): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function clip(c: Ctx, path: () => void, body: () => void): void {
  c.save();
  c.beginPath();
  path();
  c.closePath();
  c.clip();
  body();
  c.restore();
}
function line(c: Ctx, pts: readonly Pt[], color: string, width: number): void {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  poly(c, pts)();
  c.stroke();
  c.restore();
}
/** A soft white gloss streak (the lit top-left). */
function gloss(c: Ctx, x: number, y: number, rx: number, ry: number, rot = -0.6, alpha = 0.5): void {
  c.save();
  c.fillStyle = `rgba(255,255,255,${alpha})`;
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function sparkle(c: Ctx, x: number, y: number, s: number, color = '#fffbe8'): void {
  c.save();
  c.fillStyle = color;
  c.beginPath();
  poly(c, [[x, y - s], [x + s * 0.28, y - s * 0.28], [x + s, y], [x + s * 0.28, y + s * 0.28], [x, y + s], [x - s * 0.28, y + s * 0.28], [x - s, y], [x - s * 0.28, y - s * 0.28]])();
  c.closePath();
  c.fill();
  c.restore();
}

/** Light / mid / dark shades of one hue. */
interface Tone {
  light: string;
  mid: string;
  dark: string;
}
const tone = (light: string, mid: string, dark: string): Tone => ({ light, mid, dark });

// ------------------------------------------------------------------ item shapes

function flask(c: Ctx, liquid: Tone, big: boolean): void {
  const s = big ? 1.08 : 1;
  c.save();
  c.translate(48, 52);
  c.scale(s, s);
  c.translate(-48, -52);
  const body = () => {
    c.moveTo(40, 26);
    c.lineTo(40, 38);
    c.bezierCurveTo(22, 44, 18, 62, 24, 74);
    c.bezierCurveTo(30, 86, 66, 86, 72, 74);
    c.bezierCurveTo(78, 62, 74, 44, 56, 38);
    c.lineTo(56, 26);
  };
  shape(c, body, 'rgba(220,240,255,0.55)');
  clip(c, body, () => {
    c.fillStyle = lin(c, 20, 0, 76, 0, [[0, liquid.light], [0.55, liquid.mid], [1, liquid.dark]]);
    c.fillRect(10, 52, 80, 40);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(48, 53, 26, 4, 0, 0, Math.PI * 2);
    c.fill();
    for (const [x, y, r] of [[40, 66, 3], [55, 72, 2.2], [47, 60, 1.6]] as const) {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
  gloss(c, 33, 54, 4, 11, 0.35, 0.55);
  // Cork and neck ring.
  shape(c, rrect(c, 37, 33, 22, 6, 3), big ? '#e0bf5c' : '#c9b08a', 2.5);
  shape(c, rrect(c, 39, 16, 18, 14, 4), lin(c, 39, 0, 57, 0, [[0, '#c69a6a'], [1, '#8a6038']]), 3);
  c.restore();
}

function crystal(c: Ctx, t: Tone, base = true): void {
  if (base) {
    shape(c, smooth(c, [[18, 78], [26, 66], [48, 62], [72, 66], [80, 78], [62, 86], [32, 86]]), lin(c, 18, 0, 80, 0, [[0, '#9aa3b0'], [1, '#5c6474']]), 3);
    gloss(c, 34, 70, 8, 3, 0, 0.3);
  }
  const outer = poly(c, [[48, 10], [66, 34], [60, 74], [36, 74], [30, 34]]);
  shape(c, outer, lin(c, 30, 0, 66, 0, [[0, t.light], [0.5, t.mid], [1, t.dark]]));
  clip(c, outer, () => {
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    poly(c, [[48, 10], [30, 34], [42, 40]])();
    c.fill();
    c.fillStyle = 'rgba(0,0,20,0.22)';
    c.beginPath();
    poly(c, [[48, 10], [66, 34], [60, 74], [52, 74], [54, 40]])();
    c.fill();
  });
  line(c, [[42, 40], [48, 10]], 'rgba(255,255,255,0.4)', 1.5);
  line(c, [[42, 40], [36, 74]], 'rgba(255,255,255,0.25)', 1.5);
  // Small side shard.
  shape(c, poly(c, [[66, 50], [76, 58], [72, 76], [62, 76]]), lin(c, 62, 0, 76, 0, [[0, t.light], [1, t.dark]]), 3);
  sparkle(c, 38, 24, 6);
}

function scroll(c: Ctx, seal: Tone): void {
  const paper = lin(c, 0, 20, 0, 80, [[0, '#fbf1d6'], [1, '#d9c39a']]);
  shape(c, rrect(c, 22, 24, 52, 50, 4), paper);
  for (let y = 36; y <= 60; y += 8) line(c, [[30, y], [64, y]], 'rgba(120,90,50,0.45)', 2);
  // Rolled ends.
  for (const y of [22, 76]) {
    shape(c, rrect(c, 16, y - 7, 64, 14, 7), lin(c, 0, y - 7, 0, y + 7, [[0, '#f3e4c0'], [1, '#bfa478']]));
    shape(c, oval(c, 18, y, 4, 7), '#a68858', 2.5);
    shape(c, oval(c, 78, y, 4, 7), '#a68858', 2.5);
  }
  // Wax seal.
  shape(c, oval(c, 62, 62, 10, 10), rad(c, 58, 58, 14, [[0, seal.light], [0.6, seal.mid], [1, seal.dark]]), 3);
  line(c, [[57, 62], [62, 57], [67, 62], [62, 67], [57, 62]], 'rgba(255,255,255,0.55)', 1.8);
}

function egg(c: Ctx, shell: Tone, spots: string, star = false): void {
  const body = smooth(c, [[48, 10], [66, 24], [74, 52], [68, 76], [48, 86], [28, 76], [22, 52], [30, 24]]);
  shape(c, body, rad(c, 38, 32, 60, [[0, shell.light], [0.55, shell.mid], [1, shell.dark]]));
  clip(c, body, () => {
    c.fillStyle = spots;
    for (const [x, y, r] of [[40, 30, 5], [60, 44, 6], [34, 58, 7], [56, 70, 5], [46, 48, 3]] as const) {
      c.beginPath();
      c.ellipse(x, y, r, r * 0.8, 0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.fillRect(56, 0, 40, 96);
  });
  gloss(c, 36, 28, 6, 10, 0.5, 0.55);
  if (star) {
    sparkle(c, 66, 20, 9, '#fff3b0');
    sparkle(c, 24, 70, 5, '#fff3b0');
  }
}

function ticket(c: Ctx, paper: Tone, emblem: (cx: number, cy: number) => void): void {
  const body = () => {
    c.moveTo(14, 28);
    c.lineTo(82, 28);
    c.lineTo(82, 40);
    c.arc(82, 48, 8, -Math.PI / 2, Math.PI / 2, true);
    c.lineTo(82, 68);
    c.lineTo(14, 68);
    c.lineTo(14, 56);
    c.arc(14, 48, 8, Math.PI / 2, -Math.PI / 2, true);
  };
  c.save();
  c.translate(48, 48);
  c.rotate(-0.18);
  c.translate(-48, -48);
  shape(c, body, lin(c, 0, 28, 0, 68, [[0, paper.light], [1, paper.mid]]));
  c.setLineDash([3, 4]);
  line(c, [[30, 32], [30, 64]], paper.dark, 2);
  c.setLineDash([]);
  c.strokeStyle = 'rgba(255,255,255,0.45)';
  c.lineWidth = 2;
  c.strokeRect(19, 33, 58, 30);
  emblem(56, 48);
  c.restore();
}

function crate(c: Ctx): void {
  const wood = lin(c, 0, 20, 0, 84, [[0, '#d39a5c'], [1, '#8a5a2e']]);
  shape(c, poly(c, [[16, 34], [48, 22], [80, 34], [80, 72], [48, 86], [16, 72]]), wood);
  shape(c, poly(c, [[16, 34], [48, 22], [80, 34], [48, 46]]), lin(c, 16, 22, 80, 46, [[0, '#f0c088'], [1, '#c08548']]), 3);
  line(c, [[48, 46], [48, 86]], INK, 3);
  for (const [a, b] of [[[20, 46], [44, 56]], [[20, 60], [44, 72]], [[52, 56], [76, 46]], [[52, 72], [76, 60]]] as const) line(c, [a, b], 'rgba(70,40,15,0.55)', 2);
  for (const [x, y] of [[22, 40], [74, 40], [48, 80]] as const) shape(c, oval(c, x, y, 2.6, 2.6), '#d8d4c4', 1.5);
}

function chest(c: Ctx): void {
  shape(c, rrect(c, 14, 44, 68, 38, 6), lin(c, 0, 44, 0, 82, [[0, '#b0703a'], [1, '#6e4020']]));
  shape(c, () => {
    c.moveTo(14, 46);
    c.bezierCurveTo(14, 20, 82, 20, 82, 46);
  }, lin(c, 0, 22, 0, 46, [[0, '#d8904c'], [1, '#9a5a2c']]));
  for (const x of [26, 70]) shape(c, rrect(c, x - 4, 26, 8, 56, 2), lin(c, x - 4, 0, x + 4, 0, [[0, '#ffe08a'], [1, '#c99a2e']]), 2.5);
  shape(c, rrect(c, 40, 46, 16, 18, 3), lin(c, 0, 46, 0, 64, [[0, '#ffe08a'], [1, '#c99a2e']]), 2.5);
  shape(c, oval(c, 48, 55, 2.5, 3.5), INK, 0);
  gloss(c, 34, 32, 10, 3, -0.2, 0.35);
  sparkle(c, 76, 20, 7, '#fff3b0');
}

function fang(c: Ctx): void {
  const tooth = () => {
    c.moveTo(30, 16);
    c.quadraticCurveTo(52, 10, 64, 18);
    c.quadraticCurveTo(70, 50, 44, 86);
    c.quadraticCurveTo(46, 52, 30, 16);
  };
  shape(c, tooth, lin(c, 30, 0, 66, 0, [[0, '#fffaf0'], [0.6, '#e8e0c8'], [1, '#b8ab8a']]));
  shape(c, rrect(c, 26, 12, 42, 12, 6), lin(c, 0, 12, 0, 24, [[0, '#d8a0a0'], [1, '#a86868']]), 3);
  gloss(c, 44, 40, 3, 14, 0.25, 0.6);
}

function tusk(c: Ctx): void {
  const body = () => {
    c.moveTo(16, 70);
    c.bezierCurveTo(20, 30, 60, 14, 82, 22);
    c.bezierCurveTo(64, 28, 40, 44, 36, 80);
    c.quadraticCurveTo(24, 82, 16, 70);
  };
  shape(c, body, lin(c, 16, 80, 82, 20, [[0, '#a8875a'], [0.4, '#efe0bc'], [1, '#fffaee']]));
  for (const t of [0.25, 0.45]) line(c, [[18 + t * 40, 72 - t * 50], [30 + t * 40, 78 - t * 46]], 'rgba(110,80,40,0.5)', 2);
  gloss(c, 50, 34, 12, 3, -0.6, 0.5);
}

function bark(c: Ctx): void {
  const body = smooth(c, [[20, 30], [44, 18], [76, 24], [82, 52], [70, 80], [40, 82], [16, 64]]);
  shape(c, body, lin(c, 16, 0, 82, 0, [[0, '#a2703e'], [0.5, '#7a4e26'], [1, '#553418']]));
  clip(c, body, () => {
    for (const x of [28, 40, 52, 64]) line(c, [[x, 14], [x + 4, 40], [x - 2, 66], [x + 3, 90]], 'rgba(40,20,8,0.55)', 3);
  });
  // Moss and the Guardian's amber heart.
  for (const [x, y, r] of [[30, 28, 9], [44, 22, 8], [24, 40, 6]] as const) shape(c, oval(c, x, y, r, r * 0.75), '#6fae3f', 2.5);
  gloss(c, 38, 22, 6, 2.5, -0.2, 0.5);
  c.fillStyle = rad(c, 56, 54, 18, [[0, 'rgba(255,200,90,0.75)'], [1, 'rgba(255,170,60,0)']]);
  c.fillRect(36, 34, 40, 40);
  shape(c, oval(c, 56, 54, 7, 8), rad(c, 54, 51, 9, [[0, '#fff1b8'], [0.5, '#ffc04a'], [1, '#c77a14']]), 2.5);
}

function gel(c: Ctx, t: Tone, vial = false): void {
  if (vial) {
    shape(c, rrect(c, 32, 20, 32, 62, 10), 'rgba(220,240,255,0.5)');
    clip(c, rrect(c, 32, 20, 32, 62, 10), () => {
      c.fillStyle = lin(c, 32, 0, 64, 0, [[0, t.light], [1, t.dark]]);
      c.fillRect(30, 44, 36, 40);
    });
    shape(c, rrect(c, 30, 14, 36, 10, 4), lin(c, 0, 14, 0, 24, [[0, '#c69a6a'], [1, '#8a6038']]), 3);
    gloss(c, 40, 50, 3, 10, 0, 0.55);
    return;
  }
  const blob = smooth(c, [[20, 70], [22, 46], [36, 30], [52, 24], [70, 36], [78, 58], [74, 76], [48, 80]]);
  shape(c, blob, rad(c, 40, 38, 56, [[0, t.light], [0.55, t.mid], [1, t.dark]]));
  gloss(c, 38, 40, 9, 5, -0.5, 0.6);
  shape(c, oval(c, 74, 80, 6, 4.5), t.mid, 2.5);
}

function mushroomCap(c: Ctx): void {
  shape(c, rrect(c, 40, 52, 16, 30, 6), lin(c, 40, 0, 56, 0, [[0, '#fff6e2'], [1, '#cdb48e']]));
  const cap = () => {
    c.moveTo(12, 56);
    c.bezierCurveTo(12, 20, 84, 20, 84, 56);
    c.quadraticCurveTo(48, 64, 12, 56);
  };
  shape(c, cap, rad(c, 34, 30, 64, [[0, '#f57b62'], [0.5, '#d5403a'], [1, '#97202a']]));
  c.fillStyle = '#fff6ea';
  for (const [x, y, rx, ry] of [[32, 36, 7, 5], [54, 30, 8, 5.5], [70, 46, 5, 4], [22, 50, 4, 3]] as const) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function shard(c: Ctx, t: Tone): void {
  const body = poly(c, [[40, 10], [70, 30], [62, 86], [32, 70], [24, 38]]);
  shape(c, body, lin(c, 24, 0, 70, 0, [[0, t.light], [0.5, t.mid], [1, t.dark]]));
  clip(c, body, () => {
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath();
    poly(c, [[40, 10], [24, 38], [44, 44]])();
    c.fill();
  });
  line(c, [[44, 44], [62, 86]], 'rgba(0,0,0,0.25)', 2);
  c.fillStyle = rad(c, 46, 48, 30, [[0, 'rgba(255,120,90,0.45)'], [1, 'rgba(255,120,90,0)']]);
  c.fillRect(16, 18, 60, 60);
  sparkle(c, 34, 28, 6);
}

function ingot(c: Ctx): void {
  shape(c, poly(c, [[14, 66], [28, 44], [70, 44], [82, 66]]), lin(c, 0, 44, 0, 66, [[0, '#ffe39a'], [1, '#c99a2e']]));
  shape(c, poly(c, [[14, 66], [82, 66], [78, 76], [18, 76]]), '#a87b22', 3);
  shape(c, poly(c, [[24, 44], [36, 26], [64, 26], [72, 44]]), lin(c, 0, 26, 0, 44, [[0, '#fff1c0'], [1, '#e0b44a']]), 3);
  sparkle(c, 66, 22, 7);
}

function orb(c: Ctx, t: Tone): void {
  shape(c, oval(c, 48, 50, 28, 28), rad(c, 40, 40, 40, [[0, t.light], [0.6, t.mid], [1, t.dark]]));
  gloss(c, 38, 38, 9, 5, -0.6, 0.6);
  line(c, [[36, 62], [48, 50], [60, 62]], 'rgba(255,255,255,0.5)', 2.5);
}

// ------------------------------------------------------------------ equipment

/** Material palette by set: traveler leather, Guardian green-bronze, Warborn steel, Berserker crimson. */
interface Material {
  main: Tone;
  trim: Tone;
}
const MATERIALS: Record<string, Material> = {
  leather: { main: tone('#c99a66', '#9a6a3a', '#5e3c1c'), trim: tone('#e8d4a8', '#b89c68', '#7a6238') },
  iron: { main: tone('#e4e8ef', '#a9b2c0', '#5f6878'), trim: tone('#d8b878', '#a8823e', '#6a4e1c') },
  guardian: { main: tone('#9fd0a0', '#4f8a5a', '#24432c'), trim: tone('#ffe08a', '#c99a2e', '#7a5a12') },
  warborn: { main: tone('#e4e8f2', '#8f9ab0', '#465066'), trim: tone('#9fc4ff', '#4f7ad0', '#203c7a') },
  berserker: { main: tone('#e8a0a0', '#a83a3a', '#5a1818'), trim: tone('#3a3440', '#26222c', '#141018') },
  wood: { main: tone('#d8a868', '#9a6a36', '#5a3a18'), trim: tone('#c9e4a0', '#6fae3f', '#3a6a22') },
};
const mat = (k: string) => MATERIALS[k] ?? MATERIALS.iron;

function sword(c: Ctx, m: Material, great = false): void {
  c.save();
  c.translate(48, 48);
  c.rotate(Math.PI / 4);
  c.translate(-48, -48);
  const w = great ? 9 : 6.5;
  const blade = poly(c, [[48 - w, 64], [48 - w, 16], [48, great ? 2 : 6], [48 + w, 16], [48 + w, 64]]);
  shape(c, blade, lin(c, 48 - w, 0, 48 + w, 0, [[0, '#ffffff'], [0.45, m.main.light], [0.55, m.main.mid], [1, m.main.dark]]));
  line(c, [[48, 14], [48, 60]], 'rgba(60,70,90,0.45)', 1.6);
  shape(c, rrect(c, 28, 62, 40, 8, 3), lin(c, 0, 62, 0, 70, [[0, m.trim.light], [1, m.trim.dark]]), 3);
  shape(c, rrect(c, 44, 70, 8, 16, 2), lin(c, 44, 0, 52, 0, [[0, '#8a5a34'], [1, '#4a2c14']]), 3);
  shape(c, oval(c, 48, 90, 5, 5), lin(c, 0, 85, 0, 95, [[0, m.trim.light], [1, m.trim.dark]]), 2.5);
  c.restore();
}

function twinBlades(c: Ctx, m: Material): void {
  for (const [dx, rot] of [[-10, -0.35], [10, 0.35]] as const) {
    c.save();
    c.translate(48 + dx, 50);
    c.rotate(rot);
    c.translate(-48, -50);
    shape(c, () => {
      c.moveTo(44, 64);
      c.quadraticCurveTo(40, 30, 50, 10);
      c.quadraticCurveTo(54, 36, 52, 64);
    }, lin(c, 40, 0, 54, 0, [[0, '#ffffff'], [0.5, m.main.mid], [1, m.main.dark]]), 3);
    shape(c, rrect(c, 38, 62, 20, 6, 3), m.trim.mid, 2.5);
    shape(c, rrect(c, 45, 68, 6, 14, 2), '#5a3a1c', 2.5);
    c.restore();
  }
}

function bow(c: Ctx, m: Material): void {
  line(c, [[28, 14], [28, 82]], INK, 4);
  line(c, [[28, 14], [28, 82]], '#efe6d0', 2);
  const limb = () => {
    c.moveTo(24, 10);
    c.bezierCurveTo(86, 18, 86, 78, 24, 86);
    c.lineTo(32, 78);
    c.bezierCurveTo(66, 70, 66, 26, 32, 18);
  };
  shape(c, limb, lin(c, 30, 0, 72, 0, [[0, m.main.light], [1, m.main.dark]]), 3);
  shape(c, rrect(c, 58, 40, 10, 16, 3), m.trim.mid, 2.5);
}

function staff(c: Ctx, m: Material): void {
  c.save();
  c.translate(48, 48);
  c.rotate(Math.PI / 5);
  c.translate(-48, -48);
  shape(c, rrect(c, 44, 26, 8, 64, 4), lin(c, 44, 0, 52, 0, [[0, m.main.light], [1, m.main.dark]]), 3);
  shape(c, smooth(c, [[36, 26], [38, 12], [48, 6], [58, 12], [60, 26], [48, 32]]), lin(c, 36, 0, 60, 0, [[0, m.main.mid], [1, m.main.dark]]), 3);
  c.restore();
  c.fillStyle = rad(c, 36, 24, 18, [[0, 'rgba(160,230,255,0.75)'], [1, 'rgba(160,230,255,0)']]);
  c.fillRect(16, 4, 40, 40);
  shape(c, oval(c, 36, 24, 7, 7), rad(c, 34, 22, 9, [[0, '#ffffff'], [0.5, '#7fd4ff'], [1, '#2c6aa0']]), 2.5);
}

function mace(c: Ctx, m: Material): void {
  c.save();
  c.translate(48, 48);
  c.rotate(Math.PI / 4);
  c.translate(-48, -48);
  shape(c, rrect(c, 44, 40, 8, 48, 3), lin(c, 44, 0, 52, 0, [[0, '#8a5a34'], [1, '#4a2c14']]), 3);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    shape(c, poly(c, [[48 + Math.cos(a) * 12, 26 + Math.sin(a) * 12], [48 + Math.cos(a + 0.3) * 22, 26 + Math.sin(a + 0.3) * 22], [48 + Math.cos(a + 0.6) * 12, 26 + Math.sin(a + 0.6) * 12]]), m.main.mid, 2.5);
  }
  shape(c, oval(c, 48, 26, 14, 14), rad(c, 44, 22, 18, [[0, m.main.light], [1, m.main.dark]]), 3);
  c.restore();
}

function shieldIcon(c: Ctx, m: Material): void {
  const body = () => {
    c.moveTo(48, 10);
    c.quadraticCurveTo(66, 18, 80, 18);
    c.quadraticCurveTo(82, 62, 48, 86);
    c.quadraticCurveTo(14, 62, 16, 18);
    c.quadraticCurveTo(30, 18, 48, 10);
  };
  shape(c, body, lin(c, 16, 0, 80, 0, [[0, m.main.light], [0.5, m.main.mid], [1, m.main.dark]]));
  clip(c, body, () => {
    c.strokeStyle = lin(c, 0, 10, 0, 86, [[0, m.trim.light], [1, m.trim.dark]]);
    c.lineWidth = 7;
    c.beginPath();
    body();
    c.stroke();
    if (m === MATERIALS.wood) for (const x of [34, 48, 62]) line(c, [[x, 14], [x, 86]], 'rgba(60,30,10,0.35)', 2);
  });
  shape(c, oval(c, 48, 46, 9, 9), lin(c, 0, 37, 0, 55, [[0, m.trim.light], [1, m.trim.dark]]), 2.5);
  gloss(c, 32, 30, 8, 3, -0.5, 0.35);
}

function helm(c: Ctx, m: Material): void {
  const dome = () => {
    c.moveTo(18, 64);
    c.bezierCurveTo(16, 22, 80, 22, 78, 64);
    c.lineTo(78, 74);
    c.lineTo(18, 74);
  };
  shape(c, dome, lin(c, 18, 0, 78, 0, [[0, m.main.light], [0.5, m.main.mid], [1, m.main.dark]]));
  clip(c, dome, () => {
    c.fillStyle = 'rgba(10,8,20,0.75)';
    c.fillRect(30, 50, 36, 8);
    c.fillRect(44, 50, 8, 22);
  });
  shape(c, rrect(c, 14, 68, 68, 10, 4), lin(c, 0, 68, 0, 78, [[0, m.trim.light], [1, m.trim.dark]]), 3);
  shape(c, rrect(c, 44, 18, 8, 18, 3), lin(c, 0, 18, 0, 36, [[0, m.trim.light], [1, m.trim.dark]]), 2.5);
  gloss(c, 32, 38, 9, 4, -0.7, 0.45);
}

function cap(c: Ctx, m: Material): void {
  shape(c, () => {
    c.moveTo(16, 62);
    c.bezierCurveTo(14, 24, 76, 18, 80, 58);
    c.lineTo(86, 66);
    c.lineTo(16, 66);
  }, lin(c, 16, 0, 80, 0, [[0, m.main.light], [0.5, m.main.mid], [1, m.main.dark]]));
  shape(c, rrect(c, 12, 62, 76, 10, 5), lin(c, 0, 62, 0, 72, [[0, m.trim.light], [1, m.trim.dark]]), 3);
  shape(c, smooth(c, [[56, 30], [74, 12], [82, 18], [64, 34]]), '#e8e0c8', 2.5);
  gloss(c, 34, 36, 9, 4, -0.6, 0.4);
}

function armor(c: Ctx, m: Material): void {
  const body = poly(c, [[24, 18], [38, 14], [48, 22], [58, 14], [72, 18], [80, 36], [70, 42], [68, 82], [28, 82], [26, 42], [16, 36]]);
  shape(c, body, lin(c, 16, 0, 80, 0, [[0, m.main.light], [0.5, m.main.mid], [1, m.main.dark]]));
  clip(c, body, () => {
    line(c, [[48, 26], [48, 82]], 'rgba(0,0,0,0.25)', 2.5);
    for (const y of [56, 68]) line(c, [[30, y], [66, y]], 'rgba(0,0,0,0.22)', 2.5);
    c.fillStyle = lin(c, 0, 0, 0, 1, [[0, m.trim.light], [1, m.trim.mid]]);
    c.fillStyle = m.trim.mid;
    c.fillRect(26, 44, 44, 6);
  });
  for (const [x, y] of [[24, 26], [72, 26]] as const) shape(c, oval(c, x, y, 10, 8), lin(c, 0, y - 8, 0, y + 8, [[0, m.trim.light], [1, m.trim.dark]]), 3);
  gloss(c, 36, 32, 6, 10, 0.3, 0.35);
}

function gloves(c: Ctx, m: Material): void {
  const hand = smooth(c, [[30, 84], [26, 54], [24, 34], [32, 22], [42, 28], [46, 18], [56, 20], [64, 30], [74, 44], [70, 56], [62, 62], [62, 84]]);
  shape(c, hand, lin(c, 24, 0, 74, 0, [[0, m.main.light], [0.5, m.main.mid], [1, m.main.dark]]));
  clip(c, hand, () => {
    for (const x of [38, 50]) line(c, [[x, 20], [x, 48]], 'rgba(0,0,0,0.25)', 2.5);
  });
  shape(c, rrect(c, 26, 72, 40, 14, 4), lin(c, 0, 72, 0, 86, [[0, m.trim.light], [1, m.trim.dark]]), 3);
  gloss(c, 34, 36, 4, 8, 0.2, 0.4);
}

function boots(c: Ctx, m: Material): void {
  const boot = poly(c, [[28, 12], [56, 12], [58, 58], [80, 66], [82, 82], [24, 82], [26, 56]]);
  shape(c, boot, lin(c, 24, 0, 82, 0, [[0, m.main.light], [0.5, m.main.mid], [1, m.main.dark]]));
  shape(c, rrect(c, 24, 10, 36, 12, 4), lin(c, 0, 10, 0, 22, [[0, m.trim.light], [1, m.trim.dark]]), 3);
  shape(c, rrect(c, 22, 78, 62, 8, 3), '#3a2a20', 3);
  for (const y of [32, 44]) line(c, [[32, y], [52, y]], 'rgba(0,0,0,0.3)', 2.5);
  gloss(c, 36, 40, 4, 12, 0, 0.35);
}

function ring(c: Ctx, m: Material, gem: Tone): void {
  c.save();
  c.lineWidth = 13;
  c.strokeStyle = INK;
  c.beginPath();
  c.ellipse(48, 56, 24, 22, 0, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 8;
  c.strokeStyle = lin(c, 24, 0, 72, 0, [[0, m.trim.light], [0.5, m.trim.mid], [1, m.trim.dark]]);
  c.stroke();
  c.restore();
  shape(c, poly(c, [[36, 30], [48, 18], [60, 30], [48, 42]]), lin(c, 36, 18, 60, 42, [[0, gem.light], [0.5, gem.mid], [1, gem.dark]]), 3);
  sparkle(c, 44, 26, 4);
}

function necklace(c: Ctx, m: Material, gem: Tone): void {
  c.save();
  c.strokeStyle = m.trim.mid;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(20, 16);
  c.quadraticCurveTo(48, 70, 76, 16);
  c.stroke();
  c.restore();
  for (let i = 1; i < 8; i++) {
    const tt = i / 8;
    const x = (1 - tt) * (1 - tt) * 20 + 2 * (1 - tt) * tt * 48 + tt * tt * 76;
    const y = (1 - tt) * (1 - tt) * 16 + 2 * (1 - tt) * tt * 70 + tt * tt * 16;
    shape(c, oval(c, x, y, 4, 4), m.trim.light, 2);
  }
  shape(c, poly(c, [[48, 52], [60, 66], [48, 86], [36, 66]]), lin(c, 36, 52, 60, 86, [[0, gem.light], [0.5, gem.mid], [1, gem.dark]]), 3);
  sparkle(c, 44, 62, 4);
}

// ------------------------------------------------------------------ currency

function goldCoins(c: Ctx): void {
  for (const [x, y, s] of [[34, 62, 0.85], [58, 50, 1]] as const) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    shape(c, oval(c, 0, 4, 22, 22), '#a8781c');
    shape(c, oval(c, 0, 0, 22, 22), rad(c, -7, -8, 30, [[0, '#fff3b8'], [0.45, '#ffcf4a'], [1, '#c48a12']]));
    c.strokeStyle = 'rgba(140,90,10,0.7)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(0, 0, 15, 15, 0, 0, Math.PI * 2);
    c.stroke();
    // A minted crown-and-star mark (no letters).
    sparkle(c, 0, 0, 8, '#c48a12');
    gloss(c, -9, -10, 6, 3, -0.7, 0.6);
    c.restore();
  }
}

function diamondGem(c: Ctx): void {
  const outer = poly(c, [[24, 34], [36, 18], [60, 18], [72, 34], [48, 82]]);
  shape(c, outer, lin(c, 24, 18, 72, 82, [[0, '#d8f6ff'], [0.4, '#6fd0ff'], [1, '#1f6fb8']]));
  clip(c, outer, () => {
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath();
    poly(c, [[24, 34], [36, 18], [44, 34]])();
    c.fill();
    c.fillStyle = 'rgba(0,30,80,0.25)';
    c.beginPath();
    poly(c, [[60, 18], [72, 34], [48, 82], [56, 34]])();
    c.fill();
  });
  line(c, [[24, 34], [72, 34]], 'rgba(255,255,255,0.6)', 2);
  line(c, [[40, 34], [48, 82], [56, 34]], 'rgba(255,255,255,0.35)', 1.6);
  line(c, [[36, 18], [40, 34], [48, 18], [56, 34], [60, 18]], 'rgba(255,255,255,0.4)', 1.6);
  sparkle(c, 70, 18, 8);
}

// ------------------------------------------------------------------ passives / procs

/** Passive art sits on a muted round plate (actives use the bright medallion PNGs), so the two never read alike. */
function passivePlate(c: Ctx, rim: string, inner: Tone): void {
  shape(c, oval(c, 48, 48, 40, 40), lin(c, 0, 8, 0, 88, [[0, rim], [1, '#3a2c1c']]), 3);
  shape(c, oval(c, 48, 48, 33, 33), rad(c, 40, 38, 46, [[0, inner.light], [0.6, inner.mid], [1, inner.dark]]), 2);
}

function heavyArmorMastery(c: Ctx): void {
  passivePlate(c, '#b08a4a', tone('#5a6478', '#38404f', '#1c2028'));
  c.save();
  c.translate(48, 50);
  c.scale(0.62, 0.62);
  c.translate(-48, -50);
  armor(c, MATERIALS.iron);
  c.restore();
}

function swordMastery(c: Ctx): void {
  passivePlate(c, '#b08a4a', tone('#5a6478', '#38404f', '#1c2028'));
  c.save();
  c.translate(48, 48);
  c.scale(0.66, 0.66);
  c.translate(-48, -48);
  sword(c, MATERIALS.iron);
  c.restore();
  // Laurel sprigs.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + side * (0.5 + i * 0.32);
      shape(c, oval(c, 48 + Math.cos(a) * 26, 52 + Math.sin(a) * 26, 5, 2.6, a + Math.PI / 2), '#9fd36a', 1.6);
    }
  }
}

function guardianInstinct(c: Ctx): void {
  passivePlate(c, '#c9a64a', tone('#4f7a5a', '#2e5038', '#14261a'));
  c.save();
  c.translate(48, 48);
  c.scale(0.62, 0.62);
  c.translate(-48, -48);
  shieldIcon(c, MATERIALS.guardian);
  c.restore();
  c.fillStyle = rad(c, 48, 48, 16, [[0, 'rgba(255,220,120,0.8)'], [1, 'rgba(255,200,90,0)']]);
  c.fillRect(30, 30, 36, 36);
  shape(c, () => {
    c.moveTo(48, 56);
    c.bezierCurveTo(36, 48, 40, 38, 48, 44);
    c.bezierCurveTo(56, 38, 60, 48, 48, 56);
  }, '#ffcf5a', 2);
}

function battleInstinct(c: Ctx): void {
  passivePlate(c, '#c9a64a', tone('#7a3a34', '#4f2220', '#26100e'));
  for (const [dx, rot] of [[-6, -0.7], [6, 0.7]] as const) {
    c.save();
    c.translate(48 + dx, 50);
    c.rotate(rot);
    c.scale(0.5, 0.5);
    c.translate(-48, -48);
    shape(c, poly(c, [[42, 64], [42, 16], [48, 6], [54, 16], [54, 64]]), lin(c, 42, 0, 54, 0, [[0, '#ffffff'], [1, '#8f9ab0']]), 4);
    shape(c, rrect(c, 32, 62, 32, 8, 3), '#c99a2e', 4);
    c.restore();
  }
  // Three strikes building to the proc.
  for (const [x, y] of [[30, 26], [48, 20], [66, 26]] as const) sparkle(c, x, y, 5, '#ffcf5a');
}

// ------------------------------------------------------------------ registry

const T = {
  hp: tone('#b8f5c0', '#4cc062', '#1f7a34'),
  mp: tone('#bfeaff', '#3fa8f0', '#1a5a9e'),
  slime: tone('#d4ffb0', '#7cd04a', '#2f7a1c'),
  sample: tone('#c8fff0', '#5fd3a7', '#1f7a5c'),
  blue: tone('#e0f0ff', '#8fb4e8', '#3f5f9a'),
  violet: tone('#f0d8ff', '#b781ff', '#5a2aa0'),
  cyan: tone('#e0fbff', '#7fd4ff', '#2a74a8'),
  gold: tone('#fff3c0', '#ffd166', '#b8861a'),
  red: tone('#ffd0c8', '#e0524a', '#7a1a18'),
  pink: tone('#ffe0f0', '#ff9ec8', '#b0507a'),
  green: tone('#e0ffe0', '#7ee787', '#2f8a3c'),
  orange: tone('#ffe0c0', '#ff9e64', '#b0501c'),
};

/** Icon drawings by art id. */
const ART: Record<string, (c: Ctx) => void> = {
  small_hp_potion: (c) => flask(c, T.hp, false),
  medium_hp_potion: (c) => flask(c, T.hp, true),
  small_mp_potion: (c) => flask(c, T.mp, false),
  medium_mp_potion: (c) => flask(c, T.mp, true),
  slime_gel: (c) => gel(c, T.slime),
  slime_sample: (c) => gel(c, T.sample, true),
  wolf_fang: fang,
  mushroom_cap: mushroomCap,
  boar_tusk: tusk,
  guardian_bark: bark,
  enhancement_stone: (c) => crystal(c, T.blue),
  enchant_stone: (c) => crystal(c, T.violet),
  protection_stone: (c) => crystal(c, T.cyan),
  success_booster: (c) => crystal(c, T.gold),
  boss_fragment: (c) => shard(c, T.red),
  rare_craft_material: ingot,
  blueprint_guardian: (c) => scroll(c, tone('#c8f0c0', '#4f8a5a', '#24432c')),
  blueprint_warborn: (c) => scroll(c, tone('#c8dcff', '#4f7ad0', '#203c7a')),
  egg_basic: (c) => egg(c, tone('#fffaf0', '#e8dcc4', '#a8987a'), 'rgba(150,120,80,0.35)'),
  egg_fine: (c) => egg(c, tone('#f0fbff', '#9fd8f5', '#3f7aa8'), 'rgba(255,255,255,0.45)'),
  egg_mystic: (c) => egg(c, tone('#f6ecff', '#c49cf5', '#6a3ab0'), 'rgba(255,240,255,0.45)', true),
  egg_ancient: (c) => egg(c, tone('#fff8d8', '#f5c84a', '#a8761a'), 'rgba(150,90,10,0.35)', true),
  random_egg_ticket: (c) => ticket(c, tone('#fff6dc', '#f3d898', '#a88a4a'), (x, y) => egg2(c, x, y)),
  town_warp_scroll: (c) => scroll(c, T.green),
  dungeon_warp_scroll: (c) => scroll(c, T.orange),
  additional_dungeon_ticket: (c) => ticket(c, tone('#ffeaf4', '#ffb6d6', '#b0507a'), (x, y) => gate(c, x, y)),
  material_box: crate,
  weekly_chest: chest,
  stat_reset_test: (c) => orb(c, T.violet),
  // Currency.
  currency_gold: goldCoins,
  currency_diamond: diamondGem,
  // Warrior passives and procs.
  heavy_armor_mastery: heavyArmorMastery,
  sword_mastery: swordMastery,
  guardian_instinct: guardianInstinct,
  battle_instinct: battleInstinct,
};

function egg2(c: Ctx, x: number, y: number): void {
  shape(c, smooth(c, [[x, y - 12], [x + 9, y - 4], [x + 8, y + 8], [x, y + 12], [x - 8, y + 8], [x - 9, y - 4]]), rad(c, x - 3, y - 4, 14, [[0, '#ffffff'], [1, '#e0c890']]), 2.5);
}
function gate(c: Ctx, x: number, y: number): void {
  shape(c, () => {
    c.moveTo(x - 11, y + 12);
    c.lineTo(x - 11, y - 2);
    c.arc(x, y - 2, 11, Math.PI, 0);
    c.lineTo(x + 11, y + 12);
  }, lin(c, 0, y - 13, 0, y + 12, [[0, '#8a7a9a'], [1, '#4a3a5a']]), 2.5);
  shape(c, () => {
    c.moveTo(x - 5, y + 12);
    c.lineTo(x - 5, y);
    c.arc(x, y, 5, Math.PI, 0);
    c.lineTo(x + 5, y + 12);
  }, '#2a1a36', 0);
}

/** Equipment art id by slot / weapon type and set (material). */
export function equipmentArtId(slotType: string, weaponType: string | undefined, defId: string): string {
  const set = defId.startsWith('guardian') ? 'guardian' : defId.startsWith('warborn') ? 'warborn' : defId.startsWith('berserker') ? 'berserker'
    : defId.startsWith('traveler') ? 'leather' : defId.startsWith('oak') ? 'wood' : 'iron';
  const kind = slotType === 'weapon' ? (weaponType ?? 'sword') : slotType === 'head' && set === 'leather' ? 'cap' : slotType;
  return `eq:${kind}:${set}`;
}

const GEMS: Record<string, Tone> = { copper_ring: T.red, quartz_ring: tone('#ffffff', '#e8e4f0', '#a8a0c0'), bead_necklace: T.cyan };

function drawEquipment(c: Ctx, id: string): boolean {
  const [, kind, set] = id.split(':');
  const m = mat(set);
  switch (kind) {
    case 'sword':
      sword(c, m);
      return true;
    case 'two_handed_sword':
      sword(c, m, true);
      return true;
    case 'dual_blade':
      twinBlades(c, m);
      return true;
    case 'bow':
      bow(c, MATERIALS.wood);
      return true;
    case 'staff':
      staff(c, MATERIALS.wood);
      return true;
    case 'mace':
      mace(c, m);
      return true;
    case 'shield':
    case 'off_hand':
      shieldIcon(c, m);
      return true;
    case 'head':
      helm(c, m);
      return true;
    case 'cap':
      cap(c, m);
      return true;
    case 'armor':
      armor(c, m);
      return true;
    case 'gloves':
      gloves(c, m);
      return true;
    case 'boots':
      boots(c, m);
      return true;
    default:
      return false;
  }
}

/** Jewellery: the gem colour comes from the item. */
export function jewelleryArtId(slotType: string, defId: string): string | null {
  return slotType === 'ring' || slotType === 'necklace' ? `jw:${slotType}:${defId}` : null;
}

function drawJewellery(c: Ctx, id: string): boolean {
  const [, kind, defId] = id.split(':');
  const gem = GEMS[defId] ?? T.cyan;
  const metal = defId.startsWith('copper') ? MATERIALS.leather : MATERIALS.iron;
  if (kind === 'ring') ring(c, { main: metal.main, trim: defId.startsWith('copper') ? tone('#f0b890', '#c0703a', '#7a3a18') : tone('#f4f6fa', '#c0c6d2', '#7a8292') }, gem);
  else necklace(c, { main: metal.main, trim: tone('#f4e0b0', '#c9a64a', '#7a5a12') }, gem);
  return true;
}

// ------------------------------------------------------------------ cache

const cache = new Map<string, string | null>();

/** `?iconArt=off` keeps every lettered disc / vector glyph (fallback review). */
export function iconArtDisabled(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('iconArt') === 'off';
}

/** Whether an art id has a drawing (without drawing it). */
export function hasIconArt(id: string): boolean {
  return id in ART || id.startsWith('eq:') || id.startsWith('jw:');
}

/**
 * Data URL of an icon, drawn once and cached; null when the id has no drawing,
 * the canvas is unavailable or icon art is switched off (callers keep their fallback).
 */
export function iconArtUrl(id: string): string | null {
  if (iconArtDisabled()) return null;
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  let url: string | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ICON_ART_SIZE;
    const c = canvas.getContext('2d');
    if (c) {
      const drawn = ART[id] ? (ART[id](c), true) : id.startsWith('eq:') ? drawEquipment(c, id) : id.startsWith('jw:') ? drawJewellery(c, id) : false;
      if (drawn) url = canvas.toDataURL('image/png');
    }
  } catch {
    url = null;
  }
  cache.set(id, url);
  return url;
}

/** Number of icons drawn so far (tests: icons are cached, never redrawn per frame). */
export function iconArtCacheSize(): number {
  return cache.size;
}

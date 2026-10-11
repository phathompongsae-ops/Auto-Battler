import type { PropKind } from '../data/maps/props';

/*
 * Higher-detail CODE-DRAWN art for the props (and the Town NPC figure) that
 * still have no production PNG: drawn at 2x (64 art px per 32 world px tile)
 * with soft shading, like the illustrated environment PNGs, and shown at half
 * scale with linear filtering. Same texture keys and footprints as the 1x
 * placeholders in propTextures.ts, which stay the `?envArt=off` fallback.
 * A production PNG under the same key always wins (ENV_PROP_ART).
 */

type Ctx = CanvasRenderingContext2D;
type Pt = readonly [number, number];

/** Source pixels per world pixel of this art. */
export const HD_ART_SCALE = 2;

const INK = '#231d2b';

function outlineAndFill(c: Ctx, path: () => void, fill: string | CanvasGradient, width = 3): void {
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

/** A closed curve through the midpoints of `pts` (soft, organic outlines). */
const smooth = (c: Ctx, pts: readonly Pt[]) => () => {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  c.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
};
const polygon = (c: Ctx, pts: readonly Pt[]) => () => pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
const ellipsePath = (c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => () => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
const roundRect = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => () => c.roundRect(x, y, w, h, r);

function linear(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: readonly (readonly [number, string])[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, color] of stops) g.addColorStop(o, color);
  return g;
}
function radial(c: Ctx, x: number, y: number, r: number, stops: readonly (readonly [number, string])[]): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, color] of stops) g.addColorStop(o, color);
  return g;
}

/** Soft elliptical contact shadow. */
function groundShadow(c: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.32): void {
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.fillStyle = radial(c, 0, 0, rx, [[0, `rgba(10,8,20,${alpha})`], [0.7, `rgba(10,8,20,${alpha * 0.6})`], [1, 'rgba(10,8,20,0)']]);
  c.beginPath();
  c.arc(0, 0, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Paint `body` clipped to a shape. */
function within(c: Ctx, path: () => void, body: () => void): void {
  c.save();
  c.beginPath();
  path();
  c.closePath();
  c.clip();
  body();
  c.restore();
}

function stroke(c: Ctx, pts: readonly Pt[], color: string, width: number, curved = false): void {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  if (curved && pts.length > 2) {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last[0], last[1]);
  } else {
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  }
  c.stroke();
  c.restore();
}

/** A clump of moss: outlined lobes with a lit top. */
function moss(c: Ctx, lobes: readonly (readonly [number, number, number])[]): void {
  for (const [x, y, r] of lobes) outlineAndFill(c, ellipsePath(c, x, y, r, r * 0.8), '#4f8a34', 2.5);
  for (const [x, y, r] of lobes) {
    c.fillStyle = '#6fae3f';
    c.beginPath();
    c.ellipse(x - r * 0.1, y - r * 0.15, r * 0.8, r * 0.58, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(190,235,120,0.75)';
    c.beginPath();
    c.ellipse(x - r * 0.3, y - r * 0.38, r * 0.35, r * 0.2, -0.4, 0, Math.PI * 2);
    c.fill();
  }
}

/** A few grass blades fanning out from a base point. */
function blades(c: Ctx, x: number, y: number, spread = 1): void {
  for (const [dx, h, lean, color] of [[-5, 10, -4, '#3f7a35'], [-1, 14, -1, '#5c9b3c'], [3, 12, 3, '#4b8a38'], [7, 8, 5, '#6aa846']] as const) {
    stroke(c, [[x + dx * spread, y], [x + dx * spread + lean * 0.4, y - h * 0.55], [x + dx * spread + lean, y - h]], color, 2.2, true);
  }
}

function pebble(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  groundShadow(c, x + 1, y + ry * 0.7, rx * 1.2, ry * 0.55, 0.3);
  outlineAndFill(c, ellipsePath(c, x, y, rx, ry), linear(c, x - rx, y - ry, x + rx, y + ry, [[0, '#b9c1cb'], [0.55, '#8a94a2'], [1, '#5f6877']]), 1.6);
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.beginPath();
  c.ellipse(x - rx * 0.35, y - ry * 0.4, rx * 0.35, ry * 0.25, -0.3, 0, Math.PI * 2);
  c.fill();
}

function miniMushroom(c: Ctx, x: number, y: number, s: number, cap: string, capDark: string): void {
  groundShadow(c, x, y + 1, 7 * s, 2.5 * s, 0.28);
  outlineAndFill(c, roundRect(c, x - 2.4 * s, y - 9 * s, 4.8 * s, 9 * s, 2 * s), linear(c, x - 3 * s, 0, x + 3 * s, 0, [[0, '#fff6e2'], [1, '#d9c39e']]), 2);
  const capPath = () => {
    c.moveTo(x - 8 * s, y - 8 * s);
    c.bezierCurveTo(x - 8 * s, y - 17 * s, x + 8 * s, y - 17 * s, x + 8 * s, y - 8 * s);
    c.quadraticCurveTo(x, y - 6 * s, x - 8 * s, y - 8 * s);
  };
  outlineAndFill(c, capPath, radial(c, x - 3 * s, y - 14 * s, 12 * s, [[0, cap], [1, capDark]]), 2);
  c.fillStyle = 'rgba(255,248,236,0.95)';
  for (const [dx, dy, r] of [[-3.5, -11, 1.6], [2.5, -13, 1.9], [4.5, -9.5, 1.2]] as const) {
    c.beginPath();
    c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    c.fill();
  }
}

// ---------------------------------------------------------------- Field

function standingStone(c: Ctx): void {
  groundShadow(c, 33, 120, 27, 7);
  const body: Pt[] = [[13, 121], [11, 86], [12, 48], [17, 22], [28, 9], [40, 8], [49, 18], [53, 44], [55, 86], [52, 121], [33, 124]];
  const path = smooth(c, body);
  outlineAndFill(c, path, linear(c, 10, 0, 56, 0, [[0, '#a3adba'], [0.45, '#7d8898'], [1, '#535d6e']]));
  within(c, path, () => {
    // Shaded east facet, ground occlusion, lit north-west rim.
    c.fillStyle = 'rgba(28,30,48,0.3)';
    c.beginPath();
    polygon(c, [[41, 4], [58, 40], [58, 126], [44, 126], [46, 64], [43, 26]])();
    c.fill();
    c.fillStyle = linear(c, 0, 92, 0, 124, [[0, 'rgba(20,22,36,0)'], [1, 'rgba(20,22,36,0.42)']]);
    c.fillRect(0, 88, 64, 40);
    stroke(c, [[16, 104], [15, 60], [17, 34], [24, 18], [34, 11], [42, 12]], 'rgba(255,255,255,0.28)', 3.5, true);
    // Weathering: pits and cracks.
    stroke(c, [[22, 92], [26, 98], [24, 108]], 'rgba(35,29,43,0.45)', 1.6);
    stroke(c, [[45, 34], [41, 41], [43, 46]], 'rgba(35,29,43,0.4)', 1.6);
    c.fillStyle = 'rgba(35,29,43,0.25)';
    for (const [x, y, r] of [[19, 40, 1.6], [46, 72, 2], [37, 100, 1.4]] as const) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
  // Carved rune holding the Guardian's amber glow.
  c.fillStyle = radial(c, 32, 63, 24, [[0, 'rgba(255,196,96,0.55)'], [0.5, 'rgba(255,170,60,0.2)'], [1, 'rgba(255,170,60,0)']]);
  c.fillRect(6, 38, 52, 52);
  const rune: Pt[][] = [[[32, 47], [32, 80]], [[24, 56], [32, 63], [40, 56]], [[25, 71], [32, 76], [39, 71]]];
  for (const line of rune) stroke(c, line, 'rgba(70,40,10,0.55)', 5);
  for (const line of rune) stroke(c, line, '#ffc65a', 3);
  for (const line of rune) stroke(c, line, '#fff1c2', 1.2);
  moss(c, [[24, 17, 7], [34, 13, 8.5], [44, 19, 6], [15, 44, 4]]);
  moss(c, [[17, 116, 7], [27, 120, 5.5], [48, 117, 7.5]]);
  blades(c, 10, 123);
  blades(c, 56, 123, 0.8);
}

function giantMushroom(c: Ctx): void {
  groundShadow(c, 44, 113, 32, 7.5);
  // Stem with a little skirt.
  const stem = () => {
    c.moveTo(34, 113);
    c.quadraticCurveTo(30, 82, 37, 52);
    c.lineTo(52, 52);
    c.quadraticCurveTo(59, 82, 55, 113);
    c.quadraticCurveTo(44, 117, 34, 113);
  };
  outlineAndFill(c, stem, linear(c, 32, 0, 58, 0, [[0, '#fff7e4'], [0.6, '#ecdcbc'], [1, '#c8ad86']]));
  within(c, stem, () => {
    c.fillStyle = linear(c, 0, 92, 0, 116, [[0, 'rgba(90,60,30,0)'], [1, 'rgba(90,60,30,0.35)']]);
    c.fillRect(28, 88, 34, 30);
    stroke(c, [[39, 60], [37, 84], [38, 106]], 'rgba(255,255,255,0.55)', 2.5, true);
  });
  outlineAndFill(c, ellipsePath(c, 45, 71, 12, 4), linear(c, 33, 0, 57, 0, [[0, '#fbf0d8'], [1, '#d6bf98']]), 2);
  // Gills under the cap.
  outlineAndFill(c, ellipsePath(c, 44, 52, 37, 9.5), '#e3c49a');
  within(c, ellipsePath(c, 44, 52, 37, 9.5), () => {
    for (let i = -6; i <= 6; i++) stroke(c, [[44, 50], [44 + i * 6.2, 61]], 'rgba(150,105,60,0.45)', 1.4);
    c.fillStyle = 'rgba(90,50,20,0.25)';
    c.fillRect(0, 40, 88, 10);
  });
  // Cap dome.
  const cap = () => {
    c.moveTo(5, 52);
    c.bezierCurveTo(5, 18, 28, 5, 44, 5);
    c.bezierCurveTo(60, 5, 83, 18, 83, 52);
    c.quadraticCurveTo(44, 63, 5, 52);
  };
  outlineAndFill(c, cap, radial(c, 30, 18, 72, [[0, '#f57b62'], [0.4, '#d5403a'], [1, '#97202a']]));
  within(c, cap, () => {
    c.fillStyle = linear(c, 0, 36, 0, 60, [[0, 'rgba(70,0,12,0)'], [1, 'rgba(70,0,12,0.38)']]);
    c.fillRect(0, 34, 88, 30);
    for (const [x, y, rx, ry] of [[24, 25, 7.5, 5.5], [46, 15, 8.5, 6], [65, 28, 6.5, 5], [36, 41, 5.5, 3.6], [71, 45, 3.8, 2.6], [14, 43, 4.2, 3]] as const) {
      c.fillStyle = 'rgba(120,20,30,0.35)';
      c.beginPath();
      c.ellipse(x + 1, y + 1.5, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff6ea';
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }
    stroke(c, [[14, 36], [22, 20], [38, 11]], 'rgba(255,255,255,0.4)', 3.5, true);
  });
  blades(c, 30, 115);
  blades(c, 60, 115, 0.8);
  miniMushroom(c, 72, 115, 0.75, '#e2604f', '#a02a2c');
}

function ruinPillar(c: Ctx): void {
  groundShadow(c, 32, 132, 30, 7);
  // Two-step plinth.
  outlineAndFill(c, roundRect(c, 5, 118, 54, 14, 2), linear(c, 5, 0, 59, 0, [[0, '#d2c8b2'], [1, '#8e846f']]));
  c.fillStyle = 'rgba(255,255,255,0.22)';
  c.fillRect(6, 119, 52, 3);
  outlineAndFill(c, roundRect(c, 10, 107, 44, 13, 2), linear(c, 10, 0, 54, 0, [[0, '#ddd3be'], [1, '#9a8f79']]));
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(11, 108, 42, 3);
  // Broken fluted shaft.
  const top: Pt[] = [[14, 108], [14, 42], [19, 35], [23, 41], [28, 27], [34, 33], [39, 22], [44, 31], [50, 28], [50, 108]];
  const shaft = polygon(c, top);
  outlineAndFill(c, shaft, linear(c, 14, 0, 50, 0, [[0, '#ece3cf'], [0.5, '#cbbfa6'], [1, '#978b74']]));
  within(c, shaft, () => {
    for (const x of [20, 26, 32, 38, 44]) {
      stroke(c, [[x, 30], [x, 106]], 'rgba(95,82,62,0.32)', 2.2);
      stroke(c, [[x + 2, 30], [x + 2, 106]], 'rgba(255,255,255,0.16)', 1.4);
    }
    c.fillStyle = linear(c, 0, 90, 0, 108, [[0, 'rgba(60,50,35,0)'], [1, 'rgba(60,50,35,0.3)']]);
    c.fillRect(10, 88, 44, 22);
    stroke(c, [[36, 58], [40, 68], [37, 80]], 'rgba(60,48,35,0.55)', 1.6);
  });
  // The broken face catches the light.
  outlineAndFill(c, polygon(c, [[14, 42], [19, 35], [23, 41], [28, 27], [34, 33], [39, 22], [44, 31], [50, 28], [47, 35], [40, 31], [34, 38], [27, 34], [22, 45], [17, 41]]), '#f3ead7', 1.5);
  // Ivy climbing the west side.
  stroke(c, [[17, 107], [22, 92], [17, 78], [24, 64], [19, 52]], '#3e6f2c', 2.6, true);
  for (const [x, y, r] of [[20, 98, -0.6], [18, 84, 0.5], [22, 70, -0.4], [21, 58, 0.6], [25, 90, 0.3]] as const) {
    outlineAndFill(c, ellipsePath(c, x, y, 4.2, 2.8, r), '#6fae3f', 1.6);
  }
  moss(c, [[12, 117, 5], [52, 118, 5.5]]);
  // A fallen chunk.
  outlineAndFill(c, polygon(c, [[50, 131], [53, 124], [60, 123], [63, 129], [59, 133]]), linear(c, 50, 0, 63, 0, [[0, '#d8ceb8'], [1, '#948a74']]), 2);
}

function smallMushrooms(c: Ctx): void {
  blades(c, 16, 50, 0.7);
  miniMushroom(c, 22, 46, 1, '#e8604f', '#a3282c');
  miniMushroom(c, 37, 38, 0.8, '#d9a35c', '#9a6430');
  miniMushroom(c, 45, 50, 0.7, '#e8604f', '#a3282c');
  blades(c, 52, 52, 0.6);
}

function pebbles(c: Ctx): void {
  pebble(c, 18, 40, 6.5, 4.6);
  pebble(c, 29, 47, 4.2, 3.1);
  pebble(c, 44, 29, 5.2, 3.7);
  pebble(c, 39, 38, 3, 2.2);
}

// ---------------------------------------------------------------- Crypt

function sarcophagus(c: Ctx): void {
  groundShadow(c, 32, 130, 31, 6.5, 0.4);
  // Front face (the coffin's south side).
  outlineAndFill(c, roundRect(c, 6, 100, 52, 30, 3), linear(c, 0, 100, 0, 130, [[0, '#5d5869'], [1, '#3b3746']]));
  c.strokeStyle = 'rgba(20,16,28,0.5)';
  c.lineWidth = 1.5;
  c.strokeRect(12, 112, 40, 13);
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.strokeRect(13, 113, 40, 13);
  // Lid seen from above.
  const lid = roundRect(c, 3, 10, 58, 98, 7);
  outlineAndFill(c, lid, linear(c, 3, 0, 61, 0, [[0, '#9a95a6'], [0.5, '#7b7689'], [1, '#585366']]));
  within(c, lid, () => {
    c.fillStyle = 'rgba(30,24,40,0.35)';
    c.fillRect(0, 100, 64, 10);
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(10, 17, 44, 82, 4);
    c.stroke();
    c.strokeStyle = 'rgba(20,16,28,0.35)';
    c.beginPath();
    c.roundRect(12, 19, 44, 82, 4);
    c.stroke();
    stroke(c, [[46, 22], [42, 30], [45, 36]], 'rgba(20,16,28,0.45)', 1.4);
    stroke(c, [[8, 80], [14, 86]], 'rgba(20,16,28,0.4)', 1.4);
  });
  // Carved sword relief with a faint violet gem (the Crypt Lord's colour).
  outlineAndFill(c, polygon(c, [[29, 40], [35, 40], [35, 86], [32, 93], [29, 86]]), linear(c, 29, 0, 35, 0, [[0, '#c3bed0'], [1, '#8c879b']]), 2);
  outlineAndFill(c, roundRect(c, 20, 37, 24, 5, 2), '#a9a4b6', 2);
  outlineAndFill(c, roundRect(c, 30, 26, 4, 11, 1.5), '#8c879b', 2);
  c.fillStyle = radial(c, 32, 24, 9, [[0, 'rgba(214,140,255,0.6)'], [1, 'rgba(214,140,255,0)']]);
  c.fillRect(22, 14, 20, 20);
  outlineAndFill(c, ellipsePath(c, 32, 24, 3.4, 3.4), '#d58cf5', 1.6);
  // Dust settled on the lid.
  c.fillStyle = 'rgba(210,205,190,0.18)';
  c.beginPath();
  c.ellipse(20, 62, 7, 18, 0.2, 0, Math.PI * 2);
  c.fill();
}

function cryptBanner(c: Ctx): void {
  const cloth = polygon(c, [[8, 10], [40, 10], [40, 84], [24, 97], [8, 84]]);
  outlineAndFill(c, cloth, linear(c, 8, 0, 40, 0, [[0, '#6a3584'], [0.5, '#4f2566'], [1, '#331645']]));
  within(c, cloth, () => {
    for (const [x, w] of [[14, 6], [24, 5], [33, 6]] as const) {
      c.fillStyle = linear(c, x - w, 0, x + w, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(10,0,20,0.28)'], [1, 'rgba(0,0,0,0)']]);
      c.fillRect(x - w, 10, w * 2, 90);
    }
    c.fillStyle = linear(c, 0, 70, 0, 98, [[0, 'rgba(10,0,20,0)'], [1, 'rgba(10,0,20,0.35)']]);
    c.fillRect(0, 70, 48, 30);
  });
  // Gold trim and a crowned skull.
  stroke(c, [[11, 13], [11, 82], [24, 92], [37, 82], [37, 13]], '#c9a64a', 2.2);
  stroke(c, [[11, 21], [37, 21]], '#c9a64a', 1.6);
  outlineAndFill(c, polygon(c, [[17, 34], [17, 27], [20.5, 31], [24, 25], [27.5, 31], [31, 27], [31, 34]]), '#e0bf5c', 1.6);
  outlineAndFill(c, smooth(c, [[16, 42], [17, 35], [24, 33], [31, 35], [32, 42], [28, 48], [20, 48]]), linear(c, 16, 0, 32, 0, [[0, '#f0e2b0'], [1, '#bfa766']]), 1.8);
  c.fillStyle = '#2a1636';
  for (const x of [20.5, 27.5]) {
    c.beginPath();
    c.ellipse(x, 41, 2.4, 2.8, 0, 0, Math.PI * 2);
    c.fill();
  }
  outlineAndFill(c, ellipsePath(c, 24, 99, 2.6, 3.2), '#e0bf5c', 1.4);
  // Iron rod with gold finials.
  outlineAndFill(c, roundRect(c, 3, 5, 42, 6, 3), linear(c, 0, 5, 0, 11, [[0, '#55505f'], [1, '#26222d']]), 2);
  for (const x of [4, 44]) outlineAndFill(c, ellipsePath(c, x, 8, 3.4, 3.4), '#d4b25a', 1.6);
}

/** A corner web anchored at the top-left of its tile; restrained so it never hides a telegraph. */
function cobweb(c: Ctx): void {
  const ax = 2;
  const ay = 2;
  const angles = [0.06, 0.42, 0.78, 1.14, 1.5];
  const len = [58, 52, 50, 52, 58];
  const ends = angles.map((a, i): Pt => [ax + Math.cos(a) * len[i], ay + Math.sin(a) * len[i]]);
  for (const [i, [x, y]] of ends.entries()) stroke(c, [[ax, ay], [x, y]], i % 2 ? 'rgba(228,230,242,0.45)' : 'rgba(228,230,242,0.6)', 1.3);
  for (const r of [10, 19, 29, 40]) {
    c.save();
    c.strokeStyle = r > 30 ? 'rgba(228,230,242,0.38)' : 'rgba(228,230,242,0.52)';
    c.lineWidth = 1.1;
    c.beginPath();
    for (let i = 0; i < angles.length - 1; i++) {
      const p = [ax + Math.cos(angles[i]) * r, ay + Math.sin(angles[i]) * r];
      const q = [ax + Math.cos(angles[i + 1]) * r, ay + Math.sin(angles[i + 1]) * r];
      const mid = (angles[i] + angles[i + 1]) / 2;
      // Each strand sags toward the corner.
      const sag = r * 0.82;
      if (i === 0) c.moveTo(p[0], p[1]);
      c.quadraticCurveTo(ax + Math.cos(mid) * sag, ay + Math.sin(mid) * sag, q[0], q[1]);
    }
    c.stroke();
    c.restore();
  }
  c.fillStyle = 'rgba(235,236,245,0.5)';
  c.beginPath();
  c.arc(ax + 9, ay + 9, 1.6, 0, Math.PI * 2);
  c.fill();
}

function cobwebRight(c: Ctx, w: number): void {
  c.save();
  c.translate(w, 0);
  c.scale(-1, 1);
  cobweb(c);
  c.restore();
}

/** The throne-room runner: woven crimson with gold borders and a lozenge motif, fringed at the open end. */
function carpetRunner(c: Ctx, w: number, h: number): void {
  c.fillStyle = linear(c, 0, 0, w, 0, [[0, '#4a0f1a'], [0.12, '#62172a'], [0.5, '#7c2232'], [0.88, '#62172a'], [1, '#4a0f1a']]);
  c.fillRect(0, 0, w, h - 14);
  // Weave.
  c.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 0; y < h - 14; y += 4) c.fillRect(0, y, w, 1);
  c.fillStyle = 'rgba(255,220,220,0.035)';
  for (let x = 0; x < w; x += 6) c.fillRect(x, 0, 2, h - 14);
  // Dark selvedge and gold border bands.
  for (const x of [0, w - 8]) {
    c.fillStyle = '#2e0a12';
    c.fillRect(x, 0, 8, h - 14);
  }
  for (const x of [12, w - 28]) {
    c.fillStyle = linear(c, x, 0, x + 16, 0, [[0, '#8a6a2a'], [0.35, '#e1c271'], [0.6, '#c9a64a'], [1, '#7a5a22']]);
    c.fillRect(x, 0, 16, h - 14);
    c.fillStyle = 'rgba(60,30,10,0.55)';
    for (let y = 6; y < h - 20; y += 16) {
      c.beginPath();
      polygon(c, [[x + 8, y], [x + 13, y + 8], [x + 8, y + 16], [x + 3, y + 8]])();
      c.fill();
    }
  }
  // Central lozenges.
  for (let y = 120; y < h - 60; y += 168) {
    const cx = w / 2;
    c.fillStyle = 'rgba(30,5,12,0.45)';
    c.beginPath();
    polygon(c, [[cx, y - 52], [cx + 44, y], [cx, y + 52], [cx - 44, y]])();
    c.fill();
    stroke(c, [[cx, y - 46], [cx + 38, y], [cx, y + 46], [cx - 38, y], [cx, y - 46]], '#c9a64a', 3);
    stroke(c, [[cx, y - 30], [cx + 22, y], [cx, y + 30], [cx - 22, y], [cx, y - 30]], 'rgba(201,166,74,0.55)', 2);
    c.fillStyle = '#e1c271';
    for (const [dx, dy] of [[0, 0], [0, -62], [0, 62]] as const) {
      c.beginPath();
      c.arc(cx + dx, y + dy, dy ? 3 : 5, 0, Math.PI * 2);
      c.fill();
    }
  }
  // Wear down the middle, where everyone walks.
  c.fillStyle = linear(c, 0, 0, w, 0, [[0.3, 'rgba(255,200,200,0)'], [0.5, 'rgba(255,200,200,0.06)'], [0.7, 'rgba(255,200,200,0)']]);
  c.fillRect(0, 0, w, h - 14);
  // Fringe.
  for (let x = 14; x < w - 12; x += 7) stroke(c, [[x, h - 15], [x + 1, h - 3]], '#c9a64a', 2.4);
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(0, h - 16, w, 3);
}

/**
 * A Crypt wall's visible south face (above a room's north edge): stone courses
 * with a lit lip and a contact shadow. Two variants by brick offset.
 */
export function drawCryptWallFace(c: Ctx, variant: number): void {
  const s = 64;
  c.fillStyle = '#2f2b38';
  c.fillRect(0, 0, s, s);
  const rows = 4;
  const rh = s / rows;
  for (let r = 0; r < rows; r++) {
    const offset = ((r + variant) % 2) * 16;
    for (let x = -offset; x < s; x += 32) {
      const shade = ((r * 7 + Math.floor((x + offset) / 32) * 3 + variant * 5) % 5) * 5;
      c.fillStyle = `rgb(${66 + shade},${62 + shade},${78 + shade})`;
      c.fillRect(x + 1, r * rh + 1, 30, rh - 2);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(x + 1, r * rh + 1, 30, 2);
      c.fillStyle = 'rgba(10,8,16,0.25)';
      c.fillRect(x + 1, r * rh + rh - 3, 30, 2);
    }
  }
  if (variant === 1) stroke(c, [[38, 20], [42, 27], [40, 33]], 'rgba(15,12,22,0.6)', 1.4);
  // Lip where the wall top meets the face, and the shadow on the floor line.
  c.fillStyle = '#5a5568';
  c.fillRect(0, 0, s, 4);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(0, 0, s, 1.5);
  c.fillStyle = linear(c, 0, 0, 0, s, [[0, 'rgba(12,10,20,0.35)'], [0.25, 'rgba(12,10,20,0)'], [0.75, 'rgba(12,10,20,0)'], [1, 'rgba(12,10,20,0.45)']]);
  c.fillRect(0, 0, s, s);
}

// ---------------------------------------------------------------- Town NPC

/** The NPC figure's untinted layer: shadow, boots, hands, head and hair (64×88, feet at the bottom). */
export function drawNpcBase(c: Ctx): void {
  groundShadow(c, 32, 83, 20, 5, 0.34);
  for (const x of [24, 40]) outlineAndFill(c, roundRect(c, x - 5, 70, 10, 13, 3), linear(c, 0, 70, 0, 83, [[0, '#4a4058'], [1, '#2c2536']]), 2.5);
  // Robe outline sits under the tinted robe layer.
  outlineAndFill(c, polygon(c, [[20, 42], [44, 42], [52, 74], [12, 74]]), INK, 2.5);
  for (const x of [14, 50]) outlineAndFill(c, ellipsePath(c, x, 62, 4.6, 4.6), linear(c, 0, 57, 0, 67, [[0, '#ffe0c0'], [1, '#e6b28a']]), 2.2);
  // Head.
  outlineAndFill(c, ellipsePath(c, 32, 26, 18, 17), radial(c, 26, 22, 26, [[0, '#ffe6cc'], [0.7, '#f6cfa6'], [1, '#e2ac84']]));
  // Hair: a rounded cap with a side sweep.
  const hair = () => {
    c.moveTo(13, 28);
    c.bezierCurveTo(10, 6, 52, 2, 51, 26);
    c.quadraticCurveTo(45, 18, 34, 19);
    c.quadraticCurveTo(26, 14, 22, 22);
    c.quadraticCurveTo(17, 22, 13, 28);
  };
  outlineAndFill(c, hair, linear(c, 0, 6, 0, 28, [[0, '#8a5a34'], [1, '#5c3a20']]), 2.5);
  stroke(c, [[20, 14], [29, 10], [38, 10]], 'rgba(255,220,170,0.45)', 2.5, true);
  // Face.
  for (const x of [25, 39]) {
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(x, 30, 2.6, 3.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x - 0.8, 28.8, 1, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = 'rgba(240,120,120,0.35)';
  for (const x of [20, 44]) {
    c.beginPath();
    c.ellipse(x, 35, 3.2, 1.8, 0, 0, Math.PI * 2);
    c.fill();
  }
  stroke(c, [[30, 37], [32, 38.2], [34, 37]], '#8a4a3a', 1.4, true);
}

/** The NPC robe layer (white with grey shading; each NPC tints it). */
export function drawNpcRobe(c: Ctx): void {
  const robe = polygon(c, [[21, 43], [43, 43], [51, 73], [13, 73]]);
  within(c, robe, () => {
    c.fillStyle = linear(c, 13, 0, 51, 0, [[0, '#ffffff'], [0.55, '#ececec'], [1, '#b9b9b9']]);
    c.fillRect(10, 40, 44, 36);
    // Folds and a belt.
    for (const x of [24, 32, 40]) {
      c.fillStyle = linear(c, x - 3, 0, x + 3, 0, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.13)'], [1, 'rgba(0,0,0,0)']]);
      c.fillRect(x - 3, 55, 6, 20);
    }
    c.fillStyle = '#8e8e8e';
    c.fillRect(10, 54, 44, 4);
    c.fillStyle = '#d8d8d8';
    c.fillRect(29, 53, 6, 6);
    c.fillStyle = linear(c, 0, 66, 0, 74, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.22)']]);
    c.fillRect(10, 64, 44, 12);
  });
  // Collar.
  c.fillStyle = '#d0d0d0';
  c.beginPath();
  polygon(c, [[24, 43], [32, 50], [40, 43]])();
  c.fill();
}

/** HD drawings by prop kind; kinds not listed keep only their 1x placeholder. */
export const HD_PROP_ART: Partial<Record<PropKind, (c: Ctx, w: number, h: number) => void>> = {
  standing_stone: standingStone,
  giant_mushroom: giantMushroom,
  ruin_pillar: ruinPillar,
  small_mushrooms: smallMushrooms,
  pebbles,
  sarcophagus,
  crypt_banner: cryptBanner,
  cobweb,
  cobweb_right: (c, w) => cobwebRight(c, w),
  carpet_runner: carpetRunner,
};

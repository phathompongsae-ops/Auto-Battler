// TEMPORARY representative Town validation art (environment style lock, docs/art/town-style-lock.md).
// Runs in a browser page (Canvas 2D); tools/env-art/generate.mjs drives it and writes the PNGs.
// Everything is drawn at 2x source scale: 64 art px per 32 world px tile.
// Style contract: top-left key light, short soft shadows down-right, 3 shading bands + highlight,
// coloured (darkened local hue) outlines on props, no outlines on ground, low texture noise,
// glow only on magical landmarks. These are stand-ins to validate the pipeline and the look,
// not final production art.

/* eslint-disable */
(() => {
  // ------------------------------------------------------------------ helpers
  const T = 64; // art px per tile
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const reseed = (s) => (seed = s % 2147483647 || 1);
  const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
  /** A material: three bands + highlight + outline, all from one hue. */
  const mat = (h, s, l) => ({
    light: hsl(h, s, Math.min(92, l + 12)),
    mid: hsl(h, s, l),
    dark: hsl(h + 6, Math.min(100, s + 6), Math.max(8, l - 14)),
    hi: hsl(h - 4, Math.max(0, s - 10), Math.min(97, l + 24)),
    line: hsl(h + 8, Math.min(100, s + 10), Math.max(6, l - 34)),
  });
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  /** Soft cast shadow, offset down-right of a base ellipse (cool violet, 30%). */
  const castShadow = (ctx, cx, cy, rx, ry, alpha = 0.3) => {
    ctx.save();
    ctx.filter = 'blur(3px)';
    ctx.fillStyle = `rgba(52, 44, 86, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.18, cy + ry * 0.35, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  /**
   * Fill a path with 3 bands (light top-left, mid, dark bottom-right) and outline it.
   * `bounds` = [x, y, w, h] of the shape, used to place the band splits.
   */
  const shade = (ctx, path, m, bounds, { outline = 2, hi = null, split = 0.42 } = {}) => {
    const [x, y, w, h] = bounds;
    ctx.save();
    path(ctx);
    ctx.clip();
    ctx.fillStyle = m.mid;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    // Light band: top-left diagonal.
    ctx.fillStyle = m.light;
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 2);
    ctx.lineTo(x + w * (split + 0.2), y - 2);
    ctx.lineTo(x - 2, y + h * (split + 0.25));
    ctx.closePath();
    ctx.fill();
    // Dark band: bottom-right.
    ctx.fillStyle = m.dark;
    ctx.beginPath();
    ctx.moveTo(x + w + 2, y + h * (1 - split - 0.15));
    ctx.lineTo(x + w + 2, y + h + 2);
    ctx.lineTo(x + w * (1 - split - 0.25), y + h + 2);
    ctx.closePath();
    ctx.fill();
    if (hi) {
      ctx.fillStyle = m.hi;
      hi(ctx);
    }
    ctx.restore();
    if (outline) {
      ctx.save();
      path(ctx);
      ctx.lineWidth = outline;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = m.line;
      ctx.stroke();
      ctx.restore();
    }
  };
  const rectPath = (x, y, w, h, r = 0) => (ctx) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const ellPath = (cx, cy, rx, ry) => (ctx) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };
  const polyPath = (pts) => (ctx) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  };
  /** Draw `fn` at x−64, x, x+64 (and y) so marks crossing the tile edge wrap seamlessly. */
  const wrap = (ctx, fn) => {
    for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
      ctx.save();
      ctx.translate(ox, oy);
      fn(ctx);
      ctx.restore();
    }
  };

  // ------------------------------------------------------------------ palette
  const P = {
    grass: { base: hsl(96, 40, 54), dark: hsl(100, 42, 45), light: hsl(88, 46, 63), blade: hsl(92, 44, 40) },
    cobble: { joint: hsl(32, 11, 55), base: [36, 12, 63] },
    dirt: { base: hsl(37, 36, 63), dark: hsl(32, 32, 54), light: hsl(40, 42, 71) },
    plaza: { joint: hsl(38, 18, 74), base: [42, 26, 81] },
    trim: { joint: hsl(30, 10, 48), base: [32, 11, 55] },
    wood: mat(28, 42, 40),
    woodLight: mat(32, 46, 52),
    stone: mat(38, 14, 62),
    steel: mat(214, 12, 46),
    iron: mat(222, 14, 28),
    terracotta: mat(10, 52, 46),
    navy: mat(226, 34, 30),
    gold: mat(44, 70, 56),
    cherry: mat(338, 62, 76),
    leaf: mat(102, 40, 44),
    cyan: mat(188, 72, 62),
    cream: mat(40, 40, 86),
    red: mat(356, 58, 50),
  };

  // ------------------------------------------------------------------ ground (64x64, seamless, no outline)
  function grassTile(v) {
    const c = canvas(T, T);
    const ctx = c.getContext('2d');
    reseed(101 + v * 17);
    ctx.fillStyle = P.grass.base;
    ctx.fillRect(0, 0, T, T);
    const clumps = Array.from({ length: 4 }, () => [rand() * T, rand() * T, 7 + rand() * 9]);
    wrap(ctx, (g) => {
      for (const [x, y, r] of clumps) {
        g.fillStyle = P.grass.dark;
        g.beginPath();
        g.ellipse(x + 2, y + 2, r, r * 0.62, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = P.grass.light;
        g.beginPath();
        g.ellipse(x - 1, y - 1, r * 0.7, r * 0.42, 0, 0, Math.PI * 2);
        g.fill();
      }
    });
    // A few blade strokes.
    ctx.strokeStyle = P.grass.blade;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3 + v; i++) {
      const x = 6 + rand() * 52;
      const y = 8 + rand() * 50;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x - 2, y);
      ctx.moveTo(x + 3, y + 5);
      ctx.lineTo(x + 4, y + 1);
      ctx.stroke();
    }
    return c;
  }

  /**
   * Ground stone material: much lower contrast than props (the ground must stay
   * calmer than characters): light / mid / dark only a few % apart.
   */
  const groundMat = (h, s, l) => ({
    light: hsl(h, s, l + 5),
    mid: hsl(h, s, l),
    dark: hsl(h + 4, s + 2, l - 6),
    hi: hsl(h, Math.max(0, s - 4), l + 8),
    line: 'transparent',
  });

  /**
   * Rounded stones in staggered rows with irregular widths: cobble / plaza / trim,
   * seamless. Joints sit close to the stone value so no grid reads at game scale.
   */
  function stoneTile(kind, v, rows, cols) {
    const c = canvas(T, T);
    const ctx = c.getContext('2d');
    const style = P[kind];
    const m = groundMat(...style.base);
    reseed(301 + v * 29 + kind.length * 7);
    ctx.fillStyle = style.joint;
    ctx.fillRect(0, 0, T, T);
    const rh = T / rows;
    const stones = [];
    for (let r = 0; r < rows; r++) {
      // Irregular widths summing to the tile width; each row starts at a different offset.
      const weights = Array.from({ length: cols }, () => 0.7 + rand() * 0.6);
      const total = weights.reduce((a, b) => a + b, 0);
      let x = rand() * (T / cols);
      for (const w of weights) {
        const width = (w / total) * T;
        stones.push([x + 1.5, r * rh + 1.5, width - 3, rh - 3, rand()]);
        x += width;
      }
    }
    wrap(ctx, (g) => {
      for (const [x, y, w, h, t] of stones) {
        shade(g, rectPath(x, y, w, h, Math.min(w, h) * 0.38), m, [x, y, w, h], { outline: 0, split: 0.3 + t * 0.12 });
      }
    });
    // Very light wear marks.
    ctx.fillStyle = 'rgba(80, 64, 48, 0.12)';
    for (let i = 0; i < 2; i++) ctx.fillRect(rand() * 56, rand() * 56, 4 + rand() * 4, 2);
    return c;
  }

  function dirtTile(v) {
    const c = canvas(T, T);
    const ctx = c.getContext('2d');
    reseed(501 + v * 13);
    ctx.fillStyle = P.dirt.base;
    ctx.fillRect(0, 0, T, T);
    const spots = Array.from({ length: 3 }, () => [rand() * T, rand() * T, 8 + rand() * 10]);
    wrap(ctx, (g) => {
      for (const [x, y, r] of spots) {
        g.fillStyle = P.dirt.light;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
        g.fill();
      }
    });
    // Pebbles with a light top-left and dark underside.
    for (let i = 0; i < 3; i++) {
      const x = 6 + rand() * 52;
      const y = 6 + rand() * 52;
      const r = 2 + rand() * 2;
      ctx.fillStyle = P.dirt.dark;
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 1, r, r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.dirt.light;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.8, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  /**
   * Transition overlay: a soft organic fringe of `kind` (grass / dirt) spilling into the
   * cell from each side in `mask` (bit 1 = N, 2 = E, 4 = S, 8 = W). Transparent elsewhere.
   */
  function fringe(kind, mask) {
    const c = canvas(T, T);
    const ctx = c.getContext('2d');
    const depth = kind === 'grass' ? 13 : 10;
    const col = kind === 'grass' ? P.grass : P.dirt;
    const sides = [
      [1, (t) => [t * T, 0], (d) => [0, d]],
      [2, (t) => [T, t * T], (d) => [-d, 0]],
      [4, (t) => [t * T, T], (d) => [0, -d]],
      [8, (t) => [0, t * T], (d) => [d, 0]],
    ];
    for (const [bit, along, inward] of sides) {
      if (!(mask & bit)) continue;
      reseed(700 + bit * 31 + kind.length);
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const d = depth * (0.55 + 0.45 * Math.sin(t * Math.PI)) + (rand() - 0.5) * 4;
        const [ax, ay] = along(t);
        const [ix, iy] = inward(d);
        pts.push([ax + ix, ay + iy]);
      }
      const [s0x, s0y] = along(0);
      const [s1x, s1y] = along(1);
      // Soft AO line under the fringe (on the receiving ground), then the fringe itself.
      ctx.save();
      ctx.filter = 'blur(1.5px)';
      ctx.fillStyle = 'rgba(60, 52, 70, 0.22)';
      ctx.beginPath();
      ctx.moveTo(s0x, s0y);
      for (const [px, py] of pts) {
        const [ix, iy] = inward(2.5);
        ctx.lineTo(px + ix, py + iy);
      }
      ctx.lineTo(s1x, s1y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = col.base;
      ctx.beginPath();
      ctx.moveTo(s0x, s0y);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(s1x, s1y);
      ctx.closePath();
      ctx.fill();
      if (kind === 'grass') {
        // Blade tips along the edge.
        ctx.strokeStyle = col.blade;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 1; i < 8; i += 2) {
          const [px, py] = pts[i];
          const [ix, iy] = inward(4);
          ctx.beginPath();
          ctx.moveTo(px - ix * 0.2, py - iy * 0.2);
          ctx.lineTo(px + ix, py + iy);
          ctx.stroke();
        }
      }
    }
    return c;
  }

  /** The ground atlas: 64 px frames with 2 px extruded borders (margin 2, spacing 4), 9 columns. */
  function groundAtlas() {
    const frames = [
      ...[0, 1, 2, 3].map((v) => grassTile(v)),
      ...[0, 1, 2, 3].map((v) => stoneTile('cobble', v, 4, 3)),
      ...[0, 1, 2].map((v) => dirtTile(v)),
      ...[0, 1].map((v) => stoneTile('plaza', v, 2, 2)),
      ...[0, 1].map((v) => stoneTile('trim', v, 4, 2)),
      ...Array.from({ length: 15 }, (_, i) => fringe('grass', i + 1)),
      ...Array.from({ length: 15 }, (_, i) => fringe('dirt', i + 1)),
    ];
    const cols = 9;
    const cell = T + 4;
    const rows = Math.ceil(frames.length / cols);
    const atlas = canvas(cols * cell, rows * cell);
    const ctx = atlas.getContext('2d');
    frames.forEach((f, i) => {
      const x = (i % cols) * cell + 2;
      const y = Math.floor(i / cols) * cell + 2;
      // Extrude: edges stretched into the 2 px border so linear filtering never samples a neighbour.
      ctx.drawImage(f, 0, 0, T, 1, x, y - 2, T, 2);
      ctx.drawImage(f, 0, T - 1, T, 1, x, y + T, T, 2);
      ctx.drawImage(f, 0, 0, 1, T, x - 2, y, 2, T);
      ctx.drawImage(f, T - 1, 0, 1, T, x + T, y, 2, T);
      ctx.drawImage(f, 0, 0, 1, 1, x - 2, y - 2, 2, 2);
      ctx.drawImage(f, T - 1, 0, 1, 1, x + T, y - 2, 2, 2);
      ctx.drawImage(f, 0, T - 1, 1, 1, x - 2, y + T, 2, 2);
      ctx.drawImage(f, T - 1, T - 1, 1, 1, x + T, y + T, 2, 2);
      ctx.drawImage(f, x, y);
    });
    return atlas;
  }

  // ------------------------------------------------------------------ props (2x, base at the bottom edge)

  function anvil() {
    const c = canvas(64, 64);
    const ctx = c.getContext('2d');
    castShadow(ctx, 32, 56, 24, 6);
    shade(ctx, rectPath(18, 36, 28, 22, 4), P.wood, [18, 36, 28, 22]); // stump
    ctx.fillStyle = P.wood.dark;
    ctx.fillRect(22, 44, 20, 2);
    shade(ctx, rectPath(25, 24, 14, 14, 2), P.iron, [25, 24, 14, 14]); // waist
    shade(ctx, polyPath([[6, 14], [50, 14], [58, 18], [46, 26], [16, 26]]), P.iron, [6, 14, 52, 12], {
      hi: (g) => g.fillRect(12, 15, 30, 2),
    });
    // Ember glow on the face (forge heat, not magic).
    const g = ctx.createRadialGradient(48, 16, 0, 48, 16, 10);
    g.addColorStop(0, 'rgba(255, 170, 80, 0.7)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(36, 4, 24, 24);
    return c;
  }

  function cherryTree() {
    const c = canvas(144, 176);
    const ctx = c.getContext('2d');
    castShadow(ctx, 74, 166, 46, 10);
    shade(ctx, polyPath([[62, 170], [66, 112], [60, 96], [70, 100], [78, 92], [80, 112], [84, 170]]), P.wood, [60, 92, 24, 78]);
    // Crown: lobes from back to front, each with 3 bands and a coloured outline.
    const lobes = [
      [44, 70, 32], [100, 70, 32], [72, 46, 36], [48, 98, 28], [96, 98, 28], [72, 84, 34],
    ];
    for (const [x, y, r] of lobes) {
      shade(ctx, ellPath(x, y, r, r * 0.86), P.cherry, [x - r, y - r, r * 2, r * 2], {
        hi: (g) => {
          g.beginPath();
          g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.32, r * 0.22, -0.5, 0, Math.PI * 2);
          g.fill();
        },
      });
    }
    // A few blossom dots.
    reseed(909);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 3 ? hsl(340, 70, 90) : hsl(330, 52, 64);
      ctx.beginPath();
      ctx.arc(30 + rand() * 84, 30 + rand() * 90, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }

  function flowerBed() {
    const c = canvas(128, 64);
    const ctx = c.getContext('2d');
    castShadow(ctx, 64, 58, 58, 6);
    shade(ctx, rectPath(4, 26, 120, 34, 8), P.stone, [4, 26, 120, 34]);
    ctx.fillStyle = hsl(26, 34, 30);
    ctx.beginPath();
    ctx.roundRect(12, 30, 104, 18, 6);
    ctx.fill();
    reseed(55);
    const colors = [P.red, mat(48, 80, 60), mat(275, 42, 64), mat(330, 56, 72), P.cream];
    for (let i = 0; i < 16; i++) {
      const x = 18 + i * 6.2 + (rand() - 0.5) * 3;
      const y = 26 + (i % 3) * 6 + rand() * 3;
      ctx.fillStyle = P.leaf.mid;
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 5, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      const m = colors[i % colors.length];
      shade(ctx, ellPath(x, y, 4.5, 4), m, [x - 5, y - 5, 10, 10], { outline: 1.5 });
    }
    return c;
  }

  function lampPost() {
    const c = canvas(48, 144);
    const ctx = c.getContext('2d');
    castShadow(ctx, 24, 138, 14, 4);
    shade(ctx, rectPath(14, 128, 20, 12, 3), P.iron, [14, 128, 20, 12]);
    shade(ctx, rectPath(20, 36, 8, 94, 3), P.iron, [20, 36, 8, 94], { hi: (g) => g.fillRect(21, 40, 2, 84) });
    shade(ctx, rectPath(10, 30, 28, 8, 3), P.iron, [10, 30, 28, 8]);
    // Lantern: warm glass, iron cage, cap (lit but no magic halo).
    shade(ctx, rectPath(12, 8, 24, 24, 4), mat(44, 86, 72), [12, 8, 24, 24], { outline: 2 });
    ctx.fillStyle = P.iron.mid;
    ctx.fillRect(22, 8, 4, 24);
    shade(ctx, polyPath([[8, 10], [24, 0], [40, 10]]), P.iron, [8, 0, 32, 10]);
    return c;
  }

  function barrel() {
    const c = canvas(52, 64);
    const ctx = c.getContext('2d');
    castShadow(ctx, 26, 58, 22, 6);
    shade(ctx, rectPath(6, 8, 40, 52, 10), P.woodLight, [6, 8, 40, 52], {
      hi: (g) => g.fillRect(12, 14, 4, 38),
    });
    ctx.fillStyle = P.iron.mid;
    ctx.fillRect(7, 18, 38, 4);
    ctx.fillRect(7, 44, 38, 4);
    shade(ctx, ellPath(26, 9, 20, 6), P.wood, [6, 3, 40, 12]);
    return c;
  }

  function crates() {
    const c = canvas(64, 72);
    const ctx = c.getContext('2d');
    castShadow(ctx, 32, 66, 28, 6);
    const crate = (x, y, s) => {
      shade(ctx, rectPath(x, y, s, s, 3), P.woodLight, [x, y, s, s]);
      ctx.strokeStyle = P.wood.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + s - 4, y + s - 4);
      ctx.stroke();
      ctx.strokeRect(x + 4, y + 4, s - 8, s - 8);
    };
    crate(4, 32, 36);
    crate(26, 8, 32);
    return c;
  }

  function marketStall() {
    const c = canvas(200, 180);
    const ctx = c.getContext('2d');
    castShadow(ctx, 100, 168, 92, 10);
    for (const x of [16, 178]) shade(ctx, rectPath(x, 56, 8, 112, 2), P.wood, [x, 56, 8, 112]);
    // Counter with goods.
    shade(ctx, rectPath(8, 112, 184, 60, 6), P.woodLight, [8, 112, 184, 60], { hi: (g) => g.fillRect(12, 116, 176, 4) });
    ctx.fillStyle = P.wood.dark;
    for (const x of [60, 100, 140]) ctx.fillRect(x, 128, 3, 40);
    reseed(7);
    const goods = [P.red, mat(44, 80, 58), mat(100, 46, 50), mat(28, 76, 58), mat(330, 50, 68)];
    for (let i = 0; i < 9; i++) {
      const x = 26 + i * 18.5;
      const m = goods[i % goods.length];
      shade(ctx, ellPath(x, 104, 9, 8), m, [x - 9, 96, 18, 16], { outline: 2, hi: (g) => g.fillRect(x - 5, 99, 4, 3) });
    }
    // Striped awning with a scalloped lip.
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      const x = 4 + i * 24;
      const m = i % 2 ? P.cream : P.red;
      shade(ctx, polyPath([[x + 6, 22], [x + 30, 22], [x + 24, 64], [x, 64]]), m, [x, 22, 30, 42], { outline: 0 });
    }
    for (let i = 0; i < stripes; i++) {
      const x = 4 + i * 24;
      const m = i % 2 ? P.cream : P.red;
      shade(ctx, ellPath(x + 12, 64, 12, 9), m, [x, 55, 24, 18], { outline: 0 });
    }
    ctx.strokeStyle = P.red.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 22, 182, 42);
    shade(ctx, rectPath(6, 12, 188, 12, 4), P.wood, [6, 12, 188, 12]);
    return c;
  }

  function enchantCrystal() {
    const c = canvas(68, 128);
    const ctx = c.getContext('2d');
    castShadow(ctx, 34, 120, 24, 6);
    // Magical halo (the only glow in Town).
    const g = ctx.createRadialGradient(34, 46, 2, 34, 46, 34);
    g.addColorStop(0, 'rgba(140, 240, 255, 0.55)');
    g.addColorStop(1, 'rgba(120, 220, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 10, 68, 76);
    shade(ctx, polyPath([[12, 104], [56, 104], [50, 124], [18, 124]]), P.stone, [12, 104, 44, 20]);
    shade(ctx, rectPath(16, 94, 36, 12, 3), P.stone, [16, 94, 36, 12]);
    shade(ctx, polyPath([[34, 8], [52, 46], [34, 92], [16, 46]]), P.cyan, [16, 8, 36, 84], {
      hi: (g2) => {
        g2.beginPath();
        g2.moveTo(34, 14);
        g2.lineTo(42, 44);
        g2.lineTo(34, 70);
        g2.closePath();
        g2.fill();
      },
    });
    return c;
  }

  function monument() {
    const c = canvas(256, 320);
    const ctx = c.getContext('2d');
    castShadow(ctx, 128, 304, 124, 16);
    // Stepped base (footprint 4x2 = 256x128 art px at the bottom).
    shade(ctx, rectPath(8, 240, 240, 74, 8), P.stone, [8, 240, 240, 74], { hi: (g) => g.fillRect(14, 244, 228, 4) });
    shade(ctx, rectPath(32, 208, 192, 40, 6), P.stone, [32, 208, 192, 40], { hi: (g) => g.fillRect(36, 211, 184, 3) });
    // Navy pedestal with gold trim.
    shade(ctx, rectPath(72, 128, 112, 84, 6), P.navy, [72, 128, 112, 84]);
    shade(ctx, rectPath(68, 124, 120, 12, 4), P.gold, [68, 124, 120, 12]);
    shade(ctx, ellPath(128, 170, 14, 14), P.gold, [114, 156, 28, 28]);
    // Hooded hero statue (stone-navy), holding a sword upright.
    shade(ctx, polyPath([[96, 128], [110, 60], [128, 38], [146, 60], [160, 128]]), mat(222, 18, 38), [96, 38, 64, 90], {
      hi: (g) => g.fillRect(112, 64, 6, 52),
    });
    shade(ctx, ellPath(128, 40, 18, 18), mat(222, 18, 40), [110, 22, 36, 36]);
    shade(ctx, rectPath(160, 18, 7, 104, 2), P.steel, [160, 18, 7, 104]);
    shade(ctx, rectPath(150, 92, 27, 6, 2), P.gold, [150, 92, 27, 6]);
    // Braziers with soft gold monument flames.
    for (const x of [40, 216]) {
      shade(ctx, rectPath(x - 10, 196, 20, 18, 3), P.iron, [x - 10, 196, 20, 18]);
      shade(ctx, polyPath([[x - 16, 186], [x + 16, 186], [x + 10, 198], [x - 10, 198]]), P.iron, [x - 16, 186, 32, 12]);
      const f = ctx.createRadialGradient(x, 176, 1, x, 176, 22);
      f.addColorStop(0, 'rgba(255, 220, 130, 0.6)');
      f.addColorStop(1, 'rgba(255, 190, 90, 0)');
      ctx.fillStyle = f;
      ctx.fillRect(x - 24, 150, 48, 44);
      shade(ctx, polyPath([[x - 9, 188], [x, 160], [x + 9, 188]]), mat(30, 90, 58), [x - 9, 160, 18, 28], { outline: 0 });
      shade(ctx, polyPath([[x - 4, 188], [x, 172], [x + 4, 188]]), mat(46, 96, 76), [x - 4, 172, 8, 16], { outline: 0 });
    }
    return c;
  }

  /** The Forge: 8x5 footprint (512x320 art px) + 96 px of roof above = 512x416. */
  function forge() {
    const c = canvas(512, 416);
    const ctx = c.getContext('2d');
    castShadow(ctx, 260, 404, 250, 14, 0.26);
    // Stone base wall (bottom), plaster upper wall with timber frame.
    shade(ctx, rectPath(16, 300, 480, 108, 6), P.stone, [16, 300, 480, 108], { hi: (g) => g.fillRect(20, 304, 472, 4) });
    ctx.fillStyle = P.stone.dark;
    for (let row = 0; row < 3; row++) for (let k = 0; k < 10; k++) ctx.fillRect(16 + k * 48 + (row % 2) * 24, 330 + row * 26, 2, 22);
    shade(ctx, rectPath(24, 196, 464, 108, 4), P.cream, [24, 196, 464, 108]);
    ctx.fillStyle = P.wood.mid;
    for (const x of [24, 140, 256, 372, 482]) ctx.fillRect(x, 196, 8, 108);
    ctx.fillRect(24, 196, 466, 8);
    ctx.fillRect(24, 296, 466, 8);
    // Roof: terracotta planes with a ridge, eave lip, gable shading.
    shade(ctx, polyPath([[0, 204], [70, 64], [442, 64], [512, 204]]), P.terracotta, [0, 64, 512, 140], {
      hi: (g) => g.fillRect(80, 70, 300, 6),
    });
    ctx.strokeStyle = P.terracotta.dark;
    ctx.lineWidth = 2;
    for (let y = 92; y < 200; y += 22) {
      ctx.beginPath();
      ctx.moveTo(14 + (204 - y) * 0.35, y);
      ctx.lineTo(498 - (204 - y) * 0.35, y);
      ctx.stroke();
    }
    shade(ctx, rectPath(60, 56, 392, 14, 6), P.terracotta, [60, 56, 392, 14]);
    shade(ctx, rectPath(0, 198, 512, 12, 4), mat(12, 48, 38), [0, 198, 512, 12]);
    // Chimney with a little smoke (soft grey, not glow).
    shade(ctx, rectPath(366, 0, 40, 90, 4), P.stone, [366, 0, 40, 90]);
    ctx.fillStyle = 'rgba(210, 210, 220, 0.45)';
    for (const [x, y, r] of [[390, 8, 9], [400, -2, 7]]) {
      ctx.beginPath();
      ctx.arc(x, y + 6, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Big forge door with ember glow inside (heat), windows, anvil sign.
    shade(ctx, rectPath(204, 300, 104, 108, 10), P.wood, [204, 300, 104, 108]);
    const heat = ctx.createRadialGradient(256, 380, 4, 256, 380, 46);
    heat.addColorStop(0, 'rgba(255, 150, 60, 0.65)');
    heat.addColorStop(1, 'rgba(255, 110, 40, 0)');
    ctx.fillStyle = heat;
    ctx.fillRect(210, 330, 92, 78);
    for (const x of [72, 384]) {
      shade(ctx, rectPath(x, 224, 56, 48, 6), mat(208, 34, 58), [x, 224, 56, 48], { hi: (g) => g.fillRect(x + 6, 228, 12, 18) });
      ctx.fillStyle = P.wood.mid;
      ctx.fillRect(x + 26, 224, 4, 48);
      ctx.fillRect(x, 246, 56, 4);
    }
    shade(ctx, rectPath(226, 216, 60, 44, 6), P.wood, [226, 216, 60, 44]);
    shade(ctx, polyPath([[234, 236], [278, 236], [272, 244], [240, 244]]), P.iron, [234, 236, 44, 8], { outline: 1.5 });
    shade(ctx, rectPath(250, 244, 12, 10, 2), P.iron, [250, 244, 12, 10], { outline: 1.5 });
    // Crimson banners flanking the door (part of the facade).
    for (const x of [164, 328]) {
      shade(ctx, polyPath([[x, 308], [x + 24, 308], [x + 24, 360], [x + 12, 350], [x, 360]]), P.red, [x, 308, 24, 52]);
      shade(ctx, ellPath(x + 12, 324, 5, 5), P.gold, [x + 7, 319, 10, 10], { outline: 1.5 });
    }
    return c;
  }

  window.__townValidation = {
    'ground/town_ground.png': groundAtlas,
    'props/monument.png': monument,
    'props/anvil.png': anvil,
    'props/cherry_tree.png': cherryTree,
    'props/flower_bed.png': flowerBed,
    'props/lamp_post.png': lampPost,
    'props/barrel.png': barrel,
    'props/crates.png': crates,
    'props/market_stall.png': marketStall,
    'props/enchant_crystal.png': enchantCrystal,
    'buildings/forge.png': forge,
  };
})();

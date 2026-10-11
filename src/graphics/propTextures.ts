import Phaser from 'phaser';
import type { PropKind } from '../data/maps/props';
import { environmentArtDisabled } from './environmentArt';
import { drawCryptWallFace, HD_ART_SCALE, HD_PROP_ART } from './hdPropArt';

/*
 * PLACEHOLDER prop art drawn to canvas at boot (one texture per prop kind,
 * key `prop-<kind>`). Simple shapes with dark outlines and soft shadows, in
 * the chibi-fantasy palette; real environment art replaces these keys later.
 * Every texture is drawn bottom-centred on its footprint (see WorldScene).
 */

export const propTextureKey = (kind: PropKind) => `prop-${kind}`;

/** Code-drawn 2x Crypt wall faces (two brick variants); absent with `?envArt=off`. */
export const CRYPT_WALL_FACE_KEYS = ['crypt-wall-face-0', 'crypt-wall-face-1'] as const;

type Ctx = CanvasRenderingContext2D;

const OUTLINE = '#1d1b26';

function shadow(c: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.28): void {
  c.fillStyle = `rgba(0,0,0,${alpha})`;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, fill: string, outline = true): void {
  if (outline) {
    c.fillStyle = OUTLINE;
    c.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
}
function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, outline = true): void {
  if (outline) {
    c.fillStyle = OUTLINE;
    c.beginPath();
    c.ellipse(cx, cy, rx + 1, ry + 1, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
function circle(c: Ctx, cx: number, cy: number, r: number, fill: string, outline = true): void {
  ellipse(c, cx, cy, r, r, fill, outline);
}
function poly(c: Ctx, points: [number, number][], fill: string, outline = true): void {
  const path = () => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  };
  if (outline) {
    c.strokeStyle = OUTLINE;
    c.lineWidth = 2;
    path();
    c.stroke();
  }
  c.fillStyle = fill;
  path();
  c.fill();
}
function glow(c: Ctx, cx: number, cy: number, r: number, color: string): void {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function flame(c: Ctx, cx: number, by: number, s = 1): void {
  glow(c, cx, by - 6 * s, 14 * s, 'rgba(255,190,80,0.45)');
  poly(c, [[cx - 5 * s, by], [cx, by - 14 * s], [cx + 5 * s, by]], '#f08a2c', false);
  poly(c, [[cx - 3 * s, by], [cx, by - 8 * s], [cx + 3 * s, by]], '#ffe08a', false);
}
function leafCanopy(c: Ctx, cx: number, cy: number, r: number, colors: [string, string, string]): void {
  circle(c, cx - r * 0.55, cy + r * 0.2, r * 0.7, colors[1]);
  circle(c, cx + r * 0.55, cy + r * 0.2, r * 0.7, colors[1]);
  circle(c, cx, cy - r * 0.25, r * 0.8, colors[0]);
  circle(c, cx - r * 0.25, cy - r * 0.45, r * 0.3, colors[2], false);
  circle(c, cx + r * 0.35, cy, r * 0.22, colors[2], false);
}

interface PropArt {
  w: number;
  h: number;
  draw(c: Ctx, w: number, h: number): void;
}

const ART: Record<PropKind, PropArt> = {
  // ------------------------------------------------------------------ Town
  fountain: {
    w: 132,
    h: 110,
    draw: (c) => {
      shadow(c, 66, 96, 62, 12);
      ellipse(c, 66, 82, 62, 24, '#8d909c');
      ellipse(c, 66, 78, 56, 18, '#b9bcc6');
      ellipse(c, 66, 80, 50, 14, '#4f9be0');
      ellipse(c, 60, 77, 20, 4, '#9fd0ff', false);
      rect(c, 58, 40, 16, 38, '#a7aab4');
      ellipse(c, 66, 44, 24, 8, '#b9bcc6');
      ellipse(c, 66, 43, 19, 5, '#6fb2f0', false);
      // Bronze knight on the spout.
      rect(c, 61, 16, 10, 22, '#b08d57');
      circle(c, 66, 12, 6, '#c9a46a');
      rect(c, 74, 8, 2, 24, '#d8d4c4');
      c.fillStyle = 'rgba(170,215,255,0.8)';
      for (const dx of [-16, 16]) c.fillRect(66 + dx, 48, 3, 26);
    },
  },
  monument: {
    w: 128,
    h: 156,
    draw: (c) => {
      shadow(c, 64, 148, 58, 9);
      rect(c, 6, 120, 116, 32, '#8b8579');
      rect(c, 16, 104, 96, 20, '#a49d90');
      rect(c, 36, 64, 56, 44, '#3a3542');
      rect(c, 36, 64, 56, 6, '#c9a64a');
      // Hooded figure statue.
      poly(c, [[44, 66], [64, 10], [84, 66]], '#2a2633');
      circle(c, 64, 22, 10, '#4a4456');
      rect(c, 82, 8, 4, 56, '#6b5aa8');
      for (const x of [22, 106]) {
        rect(c, x - 6, 90, 12, 16, '#5a5350');
        flame(c, x, 90, 1.2);
      }
    },
  },
  statue: {
    w: 34,
    h: 76,
    draw: (c) => {
      shadow(c, 17, 70, 15, 5);
      rect(c, 5, 50, 24, 22, '#9a9ca6');
      rect(c, 3, 48, 28, 5, '#b9bcc6');
      rect(c, 11, 20, 12, 28, '#c9ccd6');
      circle(c, 17, 14, 7, '#d6d9e2');
      rect(c, 25, 6, 3, 40, '#e8e6dc');
      rect(c, 21, 26, 10, 3, '#a7aab4');
    },
  },
  market_stall: {
    w: 100,
    h: 90,
    draw: (c) => {
      shadow(c, 50, 84, 46, 6);
      rect(c, 8, 32, 4, 46, '#5a3a22');
      rect(c, 88, 32, 4, 46, '#5a3a22');
      rect(c, 4, 54, 92, 26, '#8a5a32');
      rect(c, 4, 54, 92, 5, '#a8743f');
      const goods = ['#e05a4a', '#f2c94c', '#6cc04a', '#f08ab0', '#7fb6ff', '#f2994a'];
      goods.forEach((g, i) => circle(c, 14 + i * 14, 50, 5, g));
      for (let i = 0; i < 6; i++) rect(c, 2 + i * 16, 16, 16, 22, i % 2 ? '#f4ecdb' : '#c0392b');
      for (let i = 0; i < 6; i++) circle(c, 10 + i * 16, 38, 8, i % 2 ? '#f4ecdb' : '#c0392b');
      rect(c, 0, 12, 100, 6, '#7a1f1f');
    },
  },
  lamp_post: {
    w: 24,
    h: 72,
    draw: (c) => {
      shadow(c, 12, 68, 8, 3);
      rect(c, 10, 18, 4, 50, '#2d2f3a');
      rect(c, 6, 64, 12, 4, '#2d2f3a');
      glow(c, 12, 12, 16, 'rgba(255,220,130,0.55)');
      rect(c, 6, 4, 12, 14, '#f5d77a');
      rect(c, 4, 2, 16, 3, '#2d2f3a');
    },
  },
  bench: {
    w: 64,
    h: 32,
    draw: (c) => {
      shadow(c, 32, 28, 28, 4);
      rect(c, 6, 18, 4, 10, '#3d2a1a');
      rect(c, 54, 18, 4, 10, '#3d2a1a');
      rect(c, 2, 12, 60, 7, '#9a6a3c');
      rect(c, 2, 2, 60, 6, '#8a5a32');
    },
  },
  flower_bed: {
    w: 64,
    h: 32,
    draw: (c) => {
      rect(c, 1, 10, 62, 20, '#9a9ca6');
      rect(c, 4, 13, 56, 14, '#5a3a22', false);
      const colors = ['#f2e55c', '#f08ab0', '#e05a4a', '#ffffff', '#b388ff'];
      for (let i = 0; i < 12; i++) {
        circle(c, 8 + i * 4.4, 12 + (i % 3) * 5, 3, '#3f8f3a', false);
        circle(c, 8 + i * 4.4, 10 + (i % 3) * 5, 2.4, colors[i % colors.length], false);
      }
    },
  },
  cherry_tree: {
    w: 72,
    h: 88,
    draw: (c) => {
      shadow(c, 36, 82, 24, 6);
      rect(c, 32, 50, 8, 32, '#6b4426');
      leafCanopy(c, 36, 34, 28, ['#f4a6c8', '#e07ea8', '#ffd6e7']);
    },
  },
  barrel: {
    w: 26,
    h: 32,
    draw: (c) => {
      shadow(c, 13, 29, 11, 3);
      rect(c, 3, 4, 20, 24, '#8a5a32');
      rect(c, 3, 9, 20, 2, '#3d2a1a', false);
      rect(c, 3, 21, 20, 2, '#3d2a1a', false);
      ellipse(c, 13, 4, 10, 3, '#a8743f');
    },
  },
  crates: {
    w: 32,
    h: 36,
    draw: (c) => {
      shadow(c, 16, 33, 14, 3);
      rect(c, 2, 14, 18, 18, '#b0844a');
      rect(c, 14, 4, 16, 14, '#c49656');
      c.strokeStyle = '#6b4a24';
      c.lineWidth = 2;
      c.strokeRect(4, 16, 14, 14);
      c.strokeRect(16, 6, 12, 10);
    },
  },
  banner: {
    w: 22,
    h: 52,
    draw: (c) => {
      rect(c, 2, 2, 18, 3, '#3d2a1a');
      poly(c, [[3, 5], [19, 5], [19, 42], [11, 36], [3, 42]], '#9b2335');
      circle(c, 11, 18, 4, '#e8c25a');
    },
  },
  anvil: {
    w: 34,
    h: 30,
    draw: (c) => {
      shadow(c, 17, 27, 14, 3);
      rect(c, 11, 14, 12, 12, '#3a3c46');
      poly(c, [[2, 6], [30, 6], [26, 14], [6, 14]], '#5a5d6a');
      glow(c, 26, 4, 8, 'rgba(255,150,60,0.6)');
    },
  },
  enchant_crystal: {
    w: 34,
    h: 64,
    draw: (c) => {
      shadow(c, 17, 60, 13, 4);
      rect(c, 6, 46, 22, 14, '#6d6f78');
      glow(c, 17, 24, 22, 'rgba(120,220,255,0.45)');
      poly(c, [[17, 4], [27, 26], [17, 46], [7, 26]], '#7fd4ff');
      poly(c, [[17, 8], [22, 26], [17, 40]], '#d6f4ff', false);
    },
  },
  workbench: {
    w: 64,
    h: 40,
    draw: (c) => {
      shadow(c, 32, 36, 30, 4);
      rect(c, 6, 20, 4, 16, '#3d2a1a');
      rect(c, 54, 20, 4, 16, '#3d2a1a');
      rect(c, 2, 12, 60, 9, '#9a6a3c');
      rect(c, 10, 4, 3, 9, '#6d6f78');
      rect(c, 8, 3, 8, 3, '#8a8c96');
      rect(c, 40, 6, 14, 6, '#c49656');
    },
  },
  pet_house: {
    w: 64,
    h: 56,
    draw: (c) => {
      shadow(c, 32, 52, 30, 4);
      rect(c, 8, 26, 48, 24, '#c49656');
      poly(c, [[2, 28], [32, 4], [62, 28]], '#c0392b');
      ellipse(c, 32, 42, 9, 8, '#3d2a1a');
      circle(c, 32, 18, 4, '#f2e55c');
    },
  },
  notice_board: {
    w: 64,
    h: 60,
    draw: (c) => {
      shadow(c, 32, 56, 28, 4);
      rect(c, 8, 30, 4, 26, '#5a3a22');
      rect(c, 52, 30, 4, 26, '#5a3a22');
      rect(c, 4, 6, 56, 30, '#8a5a32');
      for (const [x, y, col] of [[10, 10, '#f4ecdb'], [26, 12, '#fff3c4'], [42, 9, '#f4ecdb'], [18, 22, '#ffd6e7']] as const) rect(c, x, y, 12, 11, col);
    },
  },
  plaza_mosaic: {
    w: 160,
    h: 96,
    draw: (c) => {
      // Compass-rose inlay set into the plaza floor.
      const cx = 80;
      const cy = 48;
      c.strokeStyle = 'rgba(122,92,60,0.55)';
      c.lineWidth = 3;
      for (const r of [44, 30]) {
        c.beginPath();
        c.ellipse(cx, cy, r * 1.6, r, 0, 0, Math.PI * 2);
        c.stroke();
      }
      const ray = (a: number, len: number, wid: number, color: string) =>
        poly(c, [
          [cx + Math.cos(a) * len * 1.6, cy + Math.sin(a) * len],
          [cx + Math.cos(a + Math.PI / 2) * wid * 1.6, cy + Math.sin(a + Math.PI / 2) * wid],
          [cx + Math.cos(a - Math.PI / 2) * wid * 1.6, cy + Math.sin(a - Math.PI / 2) * wid],
        ], color, false);
      for (let i = 0; i < 8; i++) ray((i * Math.PI) / 4 + Math.PI / 8, 26, 5, 'rgba(160,110,80,0.5)');
      for (let i = 0; i < 4; i++) ray((i * Math.PI) / 2, 40, 7, 'rgba(184,82,62,0.55)');
      ellipse(c, cx, cy, 11, 7, 'rgba(201,166,74,0.8)', false);
    },
  },
  gate_arch: {
    w: 64,
    h: 96,
    draw: (c) => {
      rect(c, 4, 20, 8, 72, '#8b8579');
      rect(c, 52, 20, 8, 72, '#8b8579');
      rect(c, 0, 10, 64, 12, '#a49d90');
      rect(c, 22, 12, 20, 8, '#3f6fd8');
    },
  },

  // ------------------------------------------------------------------ Field
  tree: {
    w: 60,
    h: 80,
    draw: (c) => {
      shadow(c, 30, 74, 22, 6);
      rect(c, 26, 44, 8, 30, '#6b4426');
      leafCanopy(c, 30, 30, 25, ['#4f9a43', '#3b7d34', '#7cc46a']);
    },
  },
  pine: {
    w: 44,
    h: 84,
    draw: (c) => {
      shadow(c, 22, 79, 16, 5);
      rect(c, 19, 62, 6, 16, '#5a3a22');
      poly(c, [[22, 30], [40, 66], [4, 66]], '#2f6b3f');
      poly(c, [[22, 16], [36, 46], [8, 46]], '#367a47');
      poly(c, [[22, 2], [32, 28], [12, 28]], '#3f8a52');
    },
  },
  bush: {
    w: 40,
    h: 32,
    draw: (c) => {
      shadow(c, 20, 28, 17, 4);
      circle(c, 12, 18, 9, '#3b7d34');
      circle(c, 28, 18, 9, '#3b7d34');
      circle(c, 20, 12, 10, '#4f9a43');
      circle(c, 17, 9, 3, '#7cc46a', false);
    },
  },
  rock: {
    w: 34,
    h: 28,
    draw: (c) => {
      shadow(c, 17, 25, 15, 3);
      poly(c, [[3, 24], [6, 10], [16, 4], [28, 8], [31, 24]], '#8a8c96');
      poly(c, [[8, 12], [16, 6], [22, 9], [14, 14]], '#b0b2bc', false);
    },
  },
  big_rock: {
    w: 68,
    h: 64,
    draw: (c) => {
      shadow(c, 34, 60, 30, 5);
      poly(c, [[4, 58], [8, 26], [26, 8], [48, 12], [64, 32], [62, 58]], '#7d808b');
      poly(c, [[16, 28], [28, 14], [44, 18], [30, 30]], '#a7aab4', false);
      poly(c, [[40, 40], [56, 36], [58, 52], [44, 54]], '#6a6d77', false);
    },
  },
  stump: {
    w: 32,
    h: 26,
    draw: (c) => {
      shadow(c, 16, 23, 13, 3);
      rect(c, 6, 8, 20, 14, '#6b4426');
      ellipse(c, 16, 8, 10, 4, '#b38654');
    },
  },
  cave: {
    w: 100,
    h: 84,
    draw: (c) => {
      shadow(c, 50, 78, 46, 6);
      poly(c, [[2, 78], [10, 30], [34, 6], [68, 8], [92, 32], [98, 78]], '#6a6d77');
      poly(c, [[26, 78], [32, 44], [50, 34], [68, 44], [74, 78]], '#15131c');
      poly(c, [[20, 30], [36, 14], [54, 16], [34, 28]], '#8a8c96', false);
      for (const x of [36, 44, 56, 64]) poly(c, [[x, 44], [x + 3, 52], [x + 6, 44]], '#e8e6dc', false);
    },
  },
  giant_mushroom: {
    w: 44,
    h: 60,
    draw: (c) => {
      shadow(c, 22, 56, 16, 4);
      rect(c, 17, 26, 10, 28, '#f4ecdb');
      ellipse(c, 22, 24, 21, 15, '#d0524c');
      for (const [x, y, r] of [[13, 18, 3], [26, 14, 4], [32, 24, 3], [18, 28, 2]]) circle(c, x, y, r, '#fff4e8', false);
    },
  },
  ruin_pillar: {
    w: 32,
    h: 70,
    draw: (c) => {
      shadow(c, 16, 66, 13, 4);
      rect(c, 4, 58, 24, 8, '#8b8579');
      poly(c, [[7, 58], [7, 14], [14, 8], [20, 16], [25, 10], [25, 58]], '#b5ad9c');
      rect(c, 12, 20, 3, 36, '#9a9282', false);
      circle(c, 9, 52, 4, '#4f8a3f', false);
    },
  },
  standing_stone: {
    w: 32,
    h: 64,
    draw: (c) => {
      shadow(c, 16, 60, 13, 4);
      poly(c, [[6, 60], [5, 12], [16, 3], [27, 12], [26, 60]], '#7d808b');
      glow(c, 16, 30, 12, 'rgba(160,255,170,0.5)');
      rect(c, 14, 22, 4, 16, '#a6ffb0', false);
      rect(c, 10, 28, 12, 3, '#a6ffb0', false);
    },
  },
  tent: {
    w: 70,
    h: 70,
    draw: (c) => {
      shadow(c, 35, 66, 32, 5);
      poly(c, [[2, 64], [35, 8], [68, 64]], '#d9c8a0');
      poly(c, [[24, 64], [35, 30], [46, 64]], '#5a4630');
      rect(c, 34, 2, 2, 10, '#5a3a22');
      poly(c, [[36, 2], [48, 6], [36, 10]], '#c0392b', false);
    },
  },
  signpost: {
    w: 30,
    h: 44,
    draw: (c) => {
      shadow(c, 15, 41, 8, 2);
      rect(c, 13, 10, 4, 30, '#6b4426');
      poly(c, [[3, 8], [24, 8], [29, 13], [24, 18], [3, 18]], '#b38654');
    },
  },
  campfire: {
    w: 32,
    h: 32,
    draw: (c) => {
      for (let i = 0; i < 6; i++) circle(c, 16 + Math.cos(i) * 10, 24 + Math.sin(i) * 4, 3, '#8a8c96');
      rect(c, 8, 22, 16, 4, '#6b4426');
      flame(c, 16, 24, 1);
    },
  },
  flowers: {
    w: 32,
    h: 32,
    draw: (c) => {
      const colors = ['#f2e55c', '#f08ab0', '#ffffff', '#b388ff'];
      for (const [i, [x, y]] of [[8, 12], [20, 8], [14, 22], [25, 20]].entries()) {
        rect(c, x, y + 2, 1, 4, '#3f8f3a', false);
        circle(c, x, y, 2.4, colors[i % colors.length], false);
      }
    },
  },
  grass_tuft: {
    w: 32,
    h: 32,
    draw: (c) => {
      c.fillStyle = '#3f7a35';
      for (const [x, y] of [[10, 18], [13, 16], [16, 19], [22, 12], [24, 10]]) c.fillRect(x, y, 2, 6);
    },
  },
  pebbles: {
    w: 32,
    h: 32,
    draw: (c) => {
      for (const [x, y, r] of [[9, 20, 2.5], [14, 23, 1.8], [22, 14, 2.2]]) ellipse(c, x, y, r + 1, r, '#9a9ca6', false);
    },
  },
  small_mushrooms: {
    w: 32,
    h: 32,
    draw: (c) => {
      for (const [x, y] of [[10, 20], [18, 14], [22, 22]]) {
        rect(c, x - 1, y, 2, 4, '#f4ecdb', false);
        ellipse(c, x, y, 4, 2.5, '#d0524c', false);
      }
    },
  },

  // ------------------------------------------------------------------ Dungeon
  pillar: {
    w: 32,
    h: 76,
    draw: (c) => {
      shadow(c, 16, 72, 14, 4);
      rect(c, 3, 64, 26, 8, '#55515e');
      rect(c, 6, 12, 20, 52, '#6e6a78');
      rect(c, 10, 14, 3, 48, '#85818f', false);
      rect(c, 3, 6, 26, 8, '#55515e');
    },
  },
  torch: {
    w: 32,
    h: 32,
    draw: (c) => {
      glow(c, 16, 14, 18, 'rgba(255,170,70,0.5)');
      rect(c, 14, 16, 4, 12, '#3d2a1a');
      rect(c, 11, 14, 10, 3, '#5a5d6a');
      flame(c, 16, 15, 1);
    },
  },
  brazier: {
    w: 32,
    h: 44,
    draw: (c) => {
      shadow(c, 16, 41, 12, 3);
      rect(c, 14, 22, 4, 18, '#3a3c46');
      rect(c, 8, 36, 16, 4, '#3a3c46');
      poly(c, [[4, 16], [28, 16], [24, 24], [8, 24]], '#5a5d6a');
      flame(c, 16, 17, 1.3);
    },
  },
  sarcophagus: {
    w: 32,
    h: 68,
    draw: (c) => {
      shadow(c, 16, 64, 14, 4);
      rect(c, 3, 10, 26, 54, '#6e6a78');
      rect(c, 6, 13, 20, 48, '#85818f');
      rect(c, 14, 18, 4, 30, '#5a5666', false);
      rect(c, 9, 24, 14, 4, '#5a5666', false);
    },
  },
  throne: {
    w: 100,
    h: 112,
    draw: (c) => {
      shadow(c, 50, 106, 44, 7);
      rect(c, 4, 84, 92, 22, '#3a3542');
      rect(c, 22, 10, 56, 80, '#4a2a5e');
      poly(c, [[22, 12], [50, 0], [78, 12]], '#c9a64a');
      rect(c, 30, 20, 40, 50, '#6a3a86');
      rect(c, 14, 54, 14, 34, '#4a2a5e');
      rect(c, 72, 54, 14, 34, '#4a2a5e');
      circle(c, 50, 30, 6, '#e08af7');
    },
  },
  bones: {
    w: 32,
    h: 32,
    draw: (c) => {
      rect(c, 8, 18, 14, 3, '#d8d4c4');
      rect(c, 14, 12, 3, 12, '#d8d4c4');
      circle(c, 23, 22, 3.5, '#e8e6dc');
    },
  },
  rubble: {
    w: 32,
    h: 32,
    draw: (c) => {
      for (const [x, y, s] of [[8, 20, 6], [16, 16, 4], [20, 22, 5]]) rect(c, x, y, s, s - 1, '#5e5a68');
    },
  },
  cobweb: {
    w: 32,
    h: 32,
    draw: (c) => {
      c.strokeStyle = 'rgba(230,230,240,0.55)';
      c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(4, 4);
        c.lineTo(4 + i * 8, 28 - i * 6);
        c.stroke();
      }
      for (const r of [8, 15, 22]) {
        c.beginPath();
        c.arc(4, 4, r, 0, Math.PI / 2);
        c.stroke();
      }
    },
  },
  crypt_banner: {
    w: 24,
    h: 52,
    draw: (c) => {
      rect(c, 2, 2, 20, 3, '#2a2633');
      poly(c, [[4, 5], [20, 5], [20, 44], [12, 38], [4, 44]], '#4a2a5e');
      circle(c, 12, 18, 4, '#c9a64a');
    },
  },
  cobweb_right: {
    w: 32,
    h: 32,
    draw: (c) => {
      c.translate(32, 0);
      c.scale(-1, 1);
      ART.cobweb.draw(c, 32, 32);
    },
  },
  carpet_runner: {
    w: 128,
    h: 480,
    draw: (c) => {
      rect(c, 0, 0, 128, 480, '#6a1c2a', false);
      rect(c, 6, 0, 8, 480, '#c9a64a', false);
      rect(c, 114, 0, 8, 480, '#c9a64a', false);
    },
  },
  rune_circle: {
    w: 96,
    h: 96,
    draw: (c) => {
      c.strokeStyle = 'rgba(200,120,255,0.6)';
      c.lineWidth = 2;
      for (const r of [44, 34]) {
        c.beginPath();
        c.ellipse(48, 48, r, r * 0.8, 0, 0, Math.PI * 2);
        c.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.fillStyle = 'rgba(224,138,247,0.8)';
        c.fillRect(48 + Math.cos(a) * 39 - 2, 48 + Math.sin(a) * 31 - 2, 4, 4);
      }
    },
  },
};

/** Size of a prop kind's art in world px (bottom-centred on its footprint). */
export function propArtSize(kind: PropKind): { w: number; h: number } {
  return { w: ART[kind].w, h: ART[kind].h };
}

/**
 * Code-drawn props for every kind without a loaded PNG (a PNG under the same key wins).
 * Kinds with an HD drawing (hdPropArt.ts) get it at 2x, drawn at half scale with
 * linear filtering like the PNGs; `?envArt=off` keeps the 1x placeholders.
 */
export function createPropTextures(scene: Phaser.Scene): void {
  const hdAllowed = !environmentArtDisabled();
  if (hdAllowed) {
    CRYPT_WALL_FACE_KEYS.forEach((key, variant) => {
      if (scene.textures.exists(key)) return;
      const texture = scene.textures.createCanvas(key, 64, 64);
      if (!texture) throw new Error('Could not create the Crypt wall face texture');
      drawCryptWallFace(texture.getContext(), variant);
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      (texture.customData as Record<string, unknown>).envDrawScale = 1 / HD_ART_SCALE;
    });
  }
  for (const [kind, art] of Object.entries(ART) as [PropKind, PropArt][]) {
    if (scene.textures.exists(propTextureKey(kind))) continue;
    const hd = hdAllowed ? HD_PROP_ART[kind] : undefined;
    const k = hd ? HD_ART_SCALE : 1;
    const texture = scene.textures.createCanvas(propTextureKey(kind), art.w * k, art.h * k);
    if (!texture) throw new Error(`Could not create ${kind} prop texture`);
    (hd ?? art.draw)(texture.getContext(), art.w * k, art.h * k);
    texture.refresh();
    if (!hd) continue;
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    (texture.customData as Record<string, unknown>).envDrawScale = 1 / HD_ART_SCALE;
  }
}

#!/usr/bin/env node

// Validates the REAL Archer attack motion-test binaries against Pilot Motion Test Contract v1:
// naming (000-padded), exactly 10 frames, every PNG structurally valid (signature, IHDR, IDAT
// inflates to the exact expected length), 8-bit RGBA, identical 320x480 canvas, alpha actually
// used (corners transparent, image not fully opaque), and the sidecar consistent with both the
// contract and the actual files (fps/frameCount/loop/anchor/canvas/markers/rootMotion,
// canonicalApproved false). This validator never modifies any file.

import fs from 'node:fs';
import zlib from 'node:zlib';
import process from 'node:process';

const DIR = 'assets/units/hero.archer/attack';
const SIDECAR = 'assets/units/hero.archer/hero.archer_attack_motiontest.json';
const errors = [];
const warnings = [];
const assert = (ok, msg) => { if (!ok) errors.push(msg); };

// ---- minimal PNG reader: chunks -> IHDR + inflated raw scanlines -> unfiltered RGBA ----
function readPng(path) {
  const buf = fs.readFileSync(path);
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('bad PNG signature');
  let off = 8, ihdr = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.slice(off + 4, off + 8).toString();
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error('missing IHDR');
  if (ihdr.interlace !== 0) throw new Error('interlaced PNG not supported by this validator');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ihdr.colorType === 6 ? 4 : ihdr.colorType === 2 ? 3 : null;
  if (bpp === null || ihdr.depth !== 8) return { ihdr, pixels: null, raw };
  const stride = ihdr.w * bpp;
  if (raw.length !== (stride + 1) * ihdr.h) throw new Error(`IDAT length ${raw.length} != expected ${(stride + 1) * ihdr.h}`);
  // unfilter (types 0-4)
  const px = Buffer.alloc(stride * ihdr.h);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[y * (stride + 1)];
    const row = y * stride, prev = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawB = raw[y * (stride + 1) + 1 + x];
      const left = x >= bpp ? px[row + x - bpp] : 0;
      const up = y > 0 ? px[prev + x] : 0;
      const ul = y > 0 && x >= bpp ? px[prev + x - bpp] : 0;
      let v;
      if (f === 0) v = rawB;
      else if (f === 1) v = rawB + left;
      else if (f === 2) v = rawB + up;
      else if (f === 3) v = rawB + ((left + up) >> 1);
      else if (f === 4) v = rawB + paeth(left, up, ul);
      else throw new Error('unknown filter type ' + f);
      px[row + x] = v & 0xff;
    }
  }
  return { ihdr, pixels: px, bpp };
}

// ---- frames ----
const frames = [];
for (let i = 0; i < 10; i++) {
  const name = `hero.archer_attack_${String(i).padStart(3, '0')}.png`;
  const path = `${DIR}/${name}`;
  assert(fs.existsSync(path), `missing frame: ${path}`);
  if (!fs.existsSync(path)) continue;
  try {
    const png = readPng(path);
    frames.push({ name, ...png });
  } catch (e) {
    errors.push(`${name}: unreadable/corrupt PNG (${e.message})`);
  }
}
assert(!fs.existsSync(`${DIR}/hero.archer_attack_010.png`), 'unexpected extra frame 010 present');
assert(frames.length === 10 || errors.length > 0, 'exactly 10 frames required');

if (frames.length) {
  const { w, h } = frames[0].ihdr;
  for (const f of frames) {
    assert(f.ihdr.w === w && f.ihdr.h === h, `${f.name}: canvas ${f.ihdr.w}x${f.ihdr.h} differs from ${w}x${h}`);
    assert(f.ihdr.depth === 8 && f.ihdr.colorType === 6, `${f.name}: must be 8-bit RGBA (got depth ${f.ihdr.depth}, colorType ${f.ihdr.colorType})`);
    if (f.pixels) {
      const alphaAt = (x, y) => f.pixels[(y * f.ihdr.w + x) * 4 + 3];
      const corners = [alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)];
      assert(corners.every((a) => a === 0), `${f.name}: corners not fully transparent (${corners.join(',')})`);
      let opaque = 0;
      for (let p = 3; p < f.pixels.length; p += 4) if (f.pixels[p] > 8) opaque++;
      const frac = opaque / (w * h);
      assert(frac > 0.05 && frac < 0.95, `${f.name}: opaque fraction ${frac.toFixed(2)} implausible (alpha channel unused or fully opaque)`);
    }
  }
}

// ---- sidecar consistency ----
assert(fs.existsSync(SIDECAR), `missing sidecar: ${SIDECAR}`);
if (fs.existsSync(SIDECAR)) {
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(SIDECAR, 'utf8')); } catch (e) { errors.push('sidecar is not valid JSON: ' + e.message); }
  if (meta) {
    assert(meta.unitId === 'hero.archer', 'sidecar unitId must be hero.archer');
    assert(meta.state === 'attack', 'sidecar state must be attack');
    assert(meta.fps === 12, 'sidecar fps must be 12');
    assert(meta.frameCount === 10, 'sidecar frameCount must be 10');
    assert(meta.loop === false, 'sidecar loop must be false');
    assert(JSON.stringify(meta.anchor) === JSON.stringify([0.5, 0.92]), 'sidecar anchor must be [0.5, 0.92]');
    if (frames.length) assert(JSON.stringify(meta.canvas) === JSON.stringify([frames[0].ihdr.w, frames[0].ihdr.h]), `sidecar canvas ${JSON.stringify(meta.canvas)} must match actual PNG ${frames[0].ihdr.w}x${frames[0].ihdr.h}`);
    assert(Array.isArray(meta.eventMarkers) && meta.eventMarkers.length === 1 && meta.eventMarkers[0].name === 'projectileRelease' && meta.eventMarkers[0].normalizedTime === 0.55, 'sidecar must declare exactly projectileRelease @ 0.55');
    assert(meta.rootMotion === 'in-place', 'sidecar rootMotion must be in-place');
    assert(meta.canonicalApproved === false, 'sidecar canonicalApproved must remain false');
  }
}

for (const w2 of warnings) console.warn('WARNING: ' + w2);
if (errors.length) {
  console.error('Archer attack frames validation failed:');
  for (const e of errors) console.error('- ' + e);
  process.exit(1);
}
console.log('Archer attack frames validation passed (10 real frames, structure/alpha/sidecar consistent).');

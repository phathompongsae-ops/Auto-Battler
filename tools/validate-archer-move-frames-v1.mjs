#!/usr/bin/env node

// Validates the REAL Archer move motion-test binaries (PR #41 source, integrated on the pilot
// chain): naming 000-007, exactly 8 frames, structurally valid PNGs (signature, IHDR, IDAT
// inflates to the exact expected length, unfilter 0-4), 8-bit RGBA, identical 320x480 canvas,
// alpha genuinely used (transparent corners, no opaque border pixels), unique hashes, and
// sidecar consistency (fps 12, frameCount 8, loop true, anchor [0.5,0.92], exactly
// leftFootstepCue @ 0.25 + rightFootstepCue @ 0.75, rootMotion in-place,
// canonicalApproved false). Never modifies any file.

import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import process from 'node:process';

const DIR = 'assets/units/hero.archer/move';
const SIDECAR = 'assets/units/hero.archer/hero.archer_move_motiontest.json';
const N = 8, W = 320, H = 480;
const errors = [];
const assert = (ok, msg) => { if (!ok) errors.push(msg); };

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
  if (ihdr.interlace !== 0) throw new Error('interlaced PNG not supported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (ihdr.depth !== 8 || ihdr.colorType !== 6) return { ihdr, pixels: null };
  const stride = ihdr.w * 4;
  if (raw.length !== (stride + 1) * ihdr.h) throw new Error(`IDAT length ${raw.length} != expected ${(stride + 1) * ihdr.h}`);
  const px = Buffer.alloc(stride * ihdr.h);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[y * (stride + 1)];
    const row = y * stride, prev = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawB = raw[y * (stride + 1) + 1 + x];
      const left = x >= 4 ? px[row + x - 4] : 0;
      const up = y > 0 ? px[prev + x] : 0;
      const ul = y > 0 && x >= 4 ? px[prev + x - 4] : 0;
      let v;
      if (f === 0) v = rawB;
      else if (f === 1) v = rawB + left;
      else if (f === 2) v = rawB + up;
      else if (f === 3) v = rawB + ((left + up) >> 1);
      else if (f === 4) v = rawB + paeth(left, up, ul);
      else throw new Error('unknown filter ' + f);
      px[row + x] = v & 0xff;
    }
  }
  return { ihdr, pixels: px };
}

const frames = [];
const hashes = new Set();
for (let i = 0; i < N; i++) {
  const name = `hero.archer_move_${String(i).padStart(3, '0')}.png`;
  const path = `${DIR}/${name}`;
  assert(fs.existsSync(path), `missing frame: ${path}`);
  if (!fs.existsSync(path)) continue;
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert(!hashes.has(digest), `${name}: duplicate frame (hash matches an earlier frame)`);
  hashes.add(digest);
  try { frames.push({ name, ...readPng(path) }); }
  catch (e) { errors.push(`${name}: unreadable/corrupt PNG (${e.message})`); }
}
assert(!fs.existsSync(`${DIR}/hero.archer_move_008.png`), 'unexpected extra frame 008 present');

for (const f of frames) {
  assert(f.ihdr.w === W && f.ihdr.h === H, `${f.name}: canvas ${f.ihdr.w}x${f.ihdr.h} must be ${W}x${H}`);
  assert(f.ihdr.depth === 8 && f.ihdr.colorType === 6, `${f.name}: must be 8-bit RGBA`);
  if (f.pixels) {
    const alphaAt = (x, y) => f.pixels[(y * W + x) * 4 + 3];
    const corners = [alphaAt(0, 0), alphaAt(W - 1, 0), alphaAt(0, H - 1), alphaAt(W - 1, H - 1)];
    assert(corners.every((a) => a === 0), `${f.name}: corners not fully transparent (${corners.join(',')})`);
    let borderOpaque = 0;
    for (let x = 0; x < W; x++) { if (alphaAt(x, 0) > 16) borderOpaque++; if (alphaAt(x, H - 1) > 16) borderOpaque++; }
    for (let y = 0; y < H; y++) { if (alphaAt(0, y) > 16) borderOpaque++; if (alphaAt(W - 1, y) > 16) borderOpaque++; }
    assert(borderOpaque === 0, `${f.name}: ${borderOpaque} opaque pixels on the canvas border (unintended crop)`);
    let opaque = 0;
    for (let p = 3; p < f.pixels.length; p += 4) if (f.pixels[p] > 8) opaque++;
    const frac = opaque / (W * H);
    assert(frac > 0.05 && frac < 0.95, `${f.name}: opaque fraction ${frac.toFixed(2)} implausible`);
  }
}

assert(fs.existsSync(SIDECAR), `missing sidecar: ${SIDECAR}`);
if (fs.existsSync(SIDECAR)) {
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(SIDECAR, 'utf8')); } catch (e) { errors.push('sidecar not valid JSON: ' + e.message); }
  if (meta) {
    assert(meta.unitId === 'hero.archer', 'sidecar unitId must be hero.archer');
    assert(meta.state === 'move', 'sidecar state must be move');
    assert(meta.fps === 12, 'sidecar fps must be 12');
    assert(meta.frameCount === 8, 'sidecar frameCount must be 8');
    assert(meta.loop === true, 'sidecar loop must be true');
    assert(JSON.stringify(meta.anchor) === JSON.stringify([0.5, 0.92]), 'sidecar anchor must be [0.5, 0.92]');
    if (frames.length) assert(JSON.stringify(meta.canvas) === JSON.stringify([frames[0].ihdr.w, frames[0].ihdr.h]), `sidecar canvas ${JSON.stringify(meta.canvas)} must match actual PNGs`);
    const em = Array.isArray(meta.eventMarkers) ? meta.eventMarkers : [];
    assert(em.length === 2 && em[0].name === 'leftFootstepCue' && em[0].normalizedTime === 0.25 && em[1].name === 'rightFootstepCue' && em[1].normalizedTime === 0.75, 'move must declare exactly leftFootstepCue @ 0.25 then rightFootstepCue @ 0.75');
    assert(meta.rootMotion === 'in-place', 'sidecar rootMotion must be in-place');
    assert(meta.canonicalApproved === false, 'sidecar canonicalApproved must remain false');
  }
}

if (errors.length) {
  console.error('Archer move frames validation failed:');
  for (const e of errors) console.error('- ' + e);
  process.exit(1);
}
console.log('Archer move frames validation passed (8 real frames, unique hashes, structure/alpha/border/sidecar+footstep-markers consistent).');

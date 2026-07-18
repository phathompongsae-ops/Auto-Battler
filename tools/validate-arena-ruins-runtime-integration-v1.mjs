#!/usr/bin/env node

// Arena Ruins Static Board Runtime Integration v1 — repository-state gate.
// Verifies: the seven PR #49 production PNGs + pack manifest exist with the exact manifest
// SHA-256/dimensions/bytes; the contract JSONs are present with canonicalApproved=false;
// every production path the runtime references resolves to a real file; the runtime binds ONLY
// contract-proven sources (surface / bench treatment / perimeter ground) and never a review
// artifact; board geometry stays 8 cols x 7 rows with bench row 6; Map 2-3 stay disabled
// metadata with no art integration. Read-only — never modifies any file.

import fs from 'node:fs';
import crypto from 'node:crypto';
import process from 'node:process';

const errors = [];
const assert = (ok, msg) => { if (!ok) errors.push(msg); };
const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');
const exists = (p) => fs.existsSync(ROOT + p);

// --- production pack: manifest consistency + real bytes ---
const MANIFEST = 'assets/maps/arena-ruins/board/arena-ruins-static-board-pack-v1.json';
assert(exists(MANIFEST), 'missing production pack manifest');
let man = null;
try { man = JSON.parse(read(MANIFEST)); } catch (e) { errors.push('manifest not valid JSON: ' + e.message); }
if (man) {
  assert(man.canonicalApproved === false, 'pack manifest canonicalApproved must remain false');
  assert(Array.isArray(man.assets) && man.assets.length === 7, 'manifest must list exactly 7 production assets');
  for (const a of man.assets || []) {
    if (!exists(a.path)) { errors.push('missing production asset: ' + a.path); continue; }
    const buf = fs.readFileSync(ROOT + a.path);
    assert(buf.length === a.bytes, `${a.path}: size ${buf.length} != manifest ${a.bytes}`);
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    assert(sha === a.sha256, `${a.path}: sha256 mismatch vs manifest`);
    assert(buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a', `${a.path}: bad PNG signature`);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), depth = buf[24], ctype = buf[25];
    assert(w === a.dimensions[0] && h === a.dimensions[1], `${a.path}: ${w}x${h} != manifest ${a.dimensions}`);
    assert(depth === 8, `${a.path}: bit depth must be 8`);
    if (a.format === 'RGB8') assert(ctype === 2, `${a.path}: expected RGB (color type 2), got ${ctype}`);
    if (a.format === 'RGBA8') assert(ctype === 6, `${a.path}: expected RGBA (color type 6), got ${ctype}`);
    assert(a.canonicalApproved === false, `${a.path}: manifest entry canonicalApproved must remain false`);
  }
  const layout = man.runtimeLayout || {};
  assert(layout.columns === 8 && layout.rows === 7 && layout.benchRow === 6, 'manifest runtimeLayout must stay 8x7 with bench row 6');
}

// --- contract JSONs present, canonicalApproved=false ---
for (const p of [
  'data/design/arena-ruins-board-implementation-contract-v1.json',
  'data/design/arena-ruins-board-layer-placement-v1.json',
  'data/design/arena-ruins-board-camera-alignment-v1.json',
  'data/design/arena-ruins-board-ui-safe-areas-v1.json',
  'data/design/arena-ruins-board-asset-registry-v1.json',
]) {
  assert(exists(p), 'missing contract file: ' + p);
  if (exists(p)) {
    try { assert(JSON.parse(read(p)).canonicalApproved === false, p + ': canonicalApproved must remain false'); }
    catch (e) { errors.push(p + ': invalid JSON (' + e.message + ')'); }
  }
}

// --- runtime references: every art path the theme runtime binds must resolve; only the three
// contract-proven sources may be bound; review artifacts must never be runtime references ---
const runtime = read('src/map-theme-runtime.js');
const referenced = [...runtime.matchAll(/['"](assets\/maps\/arena-ruins\/[^'"]+)['"]/g)].map((m) => m[1]);
assert(referenced.length > 0, 'runtime must reference the production board art');
for (const p of referenced) assert(exists(p), 'runtime references missing file: ' + p);
const allowedRuntimeBindings = new Set([
  'assets/maps/arena-ruins/board/arena-ruins-board-surface-v1.png',
  'assets/maps/arena-ruins/board/arena-ruins-bench-treatment-v1.png',
  'assets/maps/arena-ruins/board/arena-ruins-perimeter-ground-v1.png',
]);
for (const p of referenced) {
  assert(allowedRuntimeBindings.has(p), `runtime binds "${p}" which has no proven placement/UV contract (deferred set must stay unbound)`);
}
assert(!/docs\/assets\/review/.test(runtime), 'runtime must never reference review artifacts as textures');
assert(!/docs\/assets\/review/.test(read('src/game.js')), 'game.js must never reference review artifacts');

// --- board geometry / bench constants unchanged in the gameplay source ---
const game = read('src/game.js');
assert(/const GRID_COLS = 8;/.test(game), 'GRID_COLS must remain 8');
assert(/const GRID_ROWS = 7;/.test(game), 'GRID_ROWS must remain 7');
assert(/const BENCH_ROW = 6;/.test(game), 'BENCH_ROW must remain 6');

// --- no Map 2-3 integration: registered only as disabled metadata, no map2/map3 art paths ---
assert(!/assets\/maps\/(map2|map3|lava|heaven)/.test(runtime), 'no Map 2-3 asset integration allowed');
assert(/enabled:\s*false/.test(runtime), 'Map 2/3 themes must remain disabled metadata');

// --- integration must keep the fallback seam (forceMissing suppresses file art) ---
assert(/forceMissing/.test(runtime) && /procedural baseline/.test(runtime), 'file-art loader must keep the procedural fallback seam');

if (errors.length) {
  console.error('Arena Ruins runtime integration validation failed:');
  for (const e of errors) console.error('- ' + e);
  process.exit(1);
}
console.log('Arena Ruins runtime integration validation passed (7 production PNGs + manifest + contracts verified, runtime binds only contract-proven sources, 8x7/bench-6 intact, Map 2-3 untouched).');

#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseSha = 'da53c453f12d9b17d9dbe6955d64f9d824605003';
const branchName = 'coco/arena-ruins-reference-matched-board-preview-v2';
const reviewRoot = path.join(root, 'docs/assets/review/arena-ruins/reference-match-v2');
const markdownName = 'ARENA_RUINS_REFERENCE_MATCH_PREVIEW_V2.md';

const requiredPngs = new Map([
  ['camera-preview-runtime-v2.png', [1536, 1024]],
  ['arena-ruins-reference-match-board-only-v2.png', [1536, 1024]],
  ['arena-ruins-reference-match-with-pilots-v2.png', [1536, 1024]],
  ['arena-ruins-reference-match-readability-v2.png', [1536, 1024]],
  ['arena-ruins-reference-comparison-v2.png', [1536, 433]],
  ['arena-ruins-reference-match-mobile-crop-v2.png', [844, 390]],
  ['reference-alignment-guide-v2.png', [1536, 1024]],
]);

const requiredV1Files = [
  'camera-preview-full-board.png',
  'camera-preview-board-only.png',
  'camera-preview-with-pilots.png',
  'arena-ruins-board-concept-v1.png',
  'arena-ruins-board-concept-v1-with-pilots.png',
  'arena-ruins-board-concept-v1-overlays.png',
  'ARENA_RUINS_BOARD_CONCEPT_PREVIEW_V1.md',
];

const requiredMarkdownFragments = [
  '# Arena Ruins Reference-Matched Board Concept Preview v2',
  'Draft PR #46',
  baseSha,
  '1000042598.png',
  'Runtime board, bench, and deploy rows',
  'Must Match Closely',
  'Match Where Runtime Allows',
  'Adapt for Gameplay Readability',
  'Preview v1 to v2 differences',
  'Pilot contrast observations',
  'Mobile readability observations',
  'Unresolved items',
  'canonicalApproved=false',
];

const expectedPilotHashes = new Map([
  ['assets/units/hero.archer/idle/hero.archer_idle_000.png', '4a1a24f9e691d48aeef55c235a47af07931032e6345b159122f0128d7aa7e888'],
  ['assets/units/monster.slime/move/monster.slime_move_000.png', '12ca260a001dbda6177f29565e9df2c369c09216c889974aeee8b12fb5ae04f9'],
  ['assets/mon_golem.png', '50a51034e08f7ca479a036bb17488c58192480204487bcded48d91838b0db42e'],
]);

const failures = [];
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function inspectPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 64) throw new Error('file is empty or too small');
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('invalid PNG signature');

  let offset = 8;
  let ihdr = null;
  let sawIend = false;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const crcOffset = dataOffset + length;
    if (crcOffset + 4 > buffer.length) throw new Error('truncated PNG chunk');
    const type = buffer.toString('ascii', typeOffset, dataOffset);
    const typeAndData = buffer.subarray(typeOffset, crcOffset);
    if (crc32(typeAndData) !== buffer.readUInt32BE(crcOffset)) throw new Error(`CRC mismatch in ${type}`);
    const data = buffer.subarray(dataOffset, crcOffset);
    if (type === 'IHDR') ihdr = Buffer.from(data);
    if (type === 'IDAT') idat.push(Buffer.from(data));
    if (type === 'IEND') {
      sawIend = true;
      offset = crcOffset + 4;
      break;
    }
    offset = crcOffset + 4;
  }

  if (!ihdr || ihdr.length !== 13) throw new Error('missing or invalid IHDR');
  if (!sawIend) throw new Error('missing IEND');
  if (offset !== buffer.length) throw new Error('unexpected bytes after IEND');
  if (idat.length === 0) throw new Error('missing IDAT');

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filterMethod = ihdr[11];
  const interlace = ihdr[12];
  if (width <= 0 || height <= 0) throw new Error('non-positive dimensions');
  if (bitDepth !== 8 || ![2, 3, 6].includes(colorType)) throw new Error(`unsupported PNG mode bitDepth=${bitDepth} colorType=${colorType}`);
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) throw new Error('unexpected PNG encoding options');

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const decoded = zlib.inflateSync(Buffer.concat(idat));
  const expectedBytes = (width * channels + 1) * height;
  if (decoded.length !== expectedBytes) throw new Error(`decoded byte count ${decoded.length} != ${expectedBytes}`);
  for (let row = 0; row < height; row += 1) {
    const filter = decoded[row * (width * channels + 1)];
    if (filter > 4) throw new Error(`invalid scanline filter ${filter} at row ${row}`);
  }

  return { width, height, bitDepth, colorType, bytes: buffer.length };
}

for (const [name, [expectedWidth, expectedHeight]] of requiredPngs) {
  const filePath = path.join(reviewRoot, name);
  if (!fs.existsSync(filePath)) {
    failures.push(`missing required PNG: ${name}`);
    continue;
  }
  try {
    const info = inspectPng(filePath);
    if (info.width !== expectedWidth || info.height !== expectedHeight) {
      failures.push(`${name}: expected ${expectedWidth}x${expectedHeight}, got ${info.width}x${info.height}`);
    }
    console.log(`PNG OK ${name} ${info.width}x${info.height} 8-bit colorType=${info.colorType} ${info.bytes} bytes`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

const markdownPath = path.join(reviewRoot, markdownName);
if (!fs.existsSync(markdownPath)) {
  failures.push(`missing required markdown: ${markdownName}`);
} else {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  for (const fragment of requiredMarkdownFragments) {
    if (!markdown.includes(fragment)) failures.push(`${markdownName}: missing required content: ${fragment}`);
  }
  if (markdown.includes('canonicalApproved=true')) failures.push(`${markdownName}: canonicalApproved=true is forbidden`);
  console.log(`MARKDOWN OK ${markdownName}`);
}

const v1Root = path.join(root, 'docs/assets/review/arena-ruins');
for (const name of requiredV1Files) {
  const filePath = path.join(v1Root, name);
  if (!fs.existsSync(filePath)) failures.push(`Preview v1 file missing: ${name}`);
  else console.log(`V1 PRESERVED ${name}`);
}

for (const [relativePath, expectedHash] of expectedPilotHashes) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push(`pilot source missing: ${relativePath}`);
    continue;
  }
  const actualHash = sha256(filePath);
  if (actualHash !== expectedHash) failures.push(`${relativePath}: pilot source hash changed (${actualHash})`);
  else console.log(`PILOT SOURCE OK ${relativePath} ${actualHash}`);
}

try {
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  if (branch !== branchName) failures.push(`unexpected branch: ${branch}`);
  console.log(`BRANCH ${branch}`);
  execFileSync('git', ['cat-file', '-e', `${baseSha}^{commit}`], { cwd: root });
  console.log(`BASE OK ${baseSha}`);
} catch (error) {
  failures.push(`branch/base validation failed: ${error.message}`);
}

let status = '';
try {
  status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
} catch (error) {
  failures.push(`could not inspect git status: ${error.message}`);
}

const allowedPrefixes = [
  'docs/assets/review/arena-ruins/reference-match-v2/',
  'tools/validate-arena-ruins-reference-match-preview-v2.mjs',
];
for (const line of status.trim().split('\n').filter(Boolean)) {
  const relativePath = line.slice(3).replace(/^"|"$/g, '');
  if (!allowedPrefixes.some((prefix) => relativePath.startsWith(prefix))) failures.push(`scope violation in working tree: ${relativePath}`);
  if (line.startsWith(' D') || line.startsWith('D ')) failures.push(`deletion is forbidden: ${relativePath}`);
}

if (failures.length > 0) {
  console.error('\nArena Ruins Reference-Matched Preview v2 validation FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nArena Ruins Reference-Matched Preview v2 validation PASSED');
console.log('reference=1000042598.png');
console.log('canonicalApproved=false');

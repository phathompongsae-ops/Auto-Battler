#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewRoot = path.join(root, 'docs/assets/review/arena-ruins');
const baseSha = '80ca5b942e6777ca7f083cf6e9e2d6604b531905';
const expectedWidth = 1536;
const expectedHeight = 1024;

const requiredPngs = [
  'camera-preview-full-board.png',
  'camera-preview-board-only.png',
  'camera-preview-with-pilots.png',
  'arena-ruins-board-concept-v1.png',
  'arena-ruins-board-concept-v1-with-pilots.png',
  'arena-ruins-board-concept-v1-overlays.png',
];

const markdownName = 'ARENA_RUINS_BOARD_CONCEPT_PREVIEW_V1.md';
const requiredMarkdownFragments = [
  '# Arena Ruins Board Concept Preview v1',
  'Base: PR #43',
  'Exact base SHA',
  'Verified runtime board and camera',
  'Preview artifacts',
  'Board concept summary',
  'Pilot readability observations',
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
    const storedCrc = buffer.readUInt32BE(crcOffset);
    if (crc32(typeAndData) !== storedCrc) throw new Error(`CRC mismatch in ${type}`);
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
  if (bitDepth !== 8 || ![2, 3, 6].includes(colorType)) throw new Error(`unsupported PNG mode: bitDepth=${bitDepth}, colorType=${colorType}`);
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) throw new Error('unexpected PNG encoding options');

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const decoded = zlib.inflateSync(Buffer.concat(idat));
  const rowBytes = width * channels;
  const expectedBytes = (rowBytes + 1) * height;
  if (decoded.length !== expectedBytes) throw new Error(`decoded byte count ${decoded.length} != ${expectedBytes}`);
  for (let row = 0; row < height; row += 1) {
    const filter = decoded[row * (rowBytes + 1)];
    if (filter > 4) throw new Error(`invalid scanline filter ${filter} at row ${row}`);
  }

  return { width, height, bitDepth, channels, bytes: buffer.length };
}

for (const name of requiredPngs) {
  const filePath = path.join(reviewRoot, name);
  if (!fs.existsSync(filePath)) {
    failures.push(`missing required PNG: ${name}`);
    continue;
  }
  try {
    const info = inspectPng(filePath);
    if (info.width !== expectedWidth || info.height !== expectedHeight) failures.push(`${name}: expected ${expectedWidth}x${expectedHeight}, got ${info.width}x${info.height}`);
    const mode = info.channels === 4 ? 'RGBA' : info.channels === 3 ? 'RGB' : 'INDEXED';
    console.log(`PNG OK ${name} ${info.width}x${info.height} ${info.bitDepth}-bit ${mode} ${info.bytes} bytes`);
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

for (const [relativePath, expectedHash] of expectedPilotHashes) {
  const actual = execFileSync('sha256sum', [path.join(root, relativePath)], { encoding: 'utf8' }).split(/\s+/)[0];
  if (actual !== expectedHash) failures.push(`${relativePath}: pilot source hash changed (${actual})`);
  else console.log(`PILOT SOURCE OK ${relativePath} ${actual}`);
}

let status = '';
try {
  status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
} catch (error) {
  failures.push(`could not inspect git status: ${error.message}`);
}

const forbiddenPathPatterns = [
  /^src\//,
  /^assets\/units\/hero\.archer\//,
  /^assets\/units\/monster\.slime\//,
  /^assets\/mon_golem\.png$/,
  /^assets\/maps\/map[23]/,
  /reference-match-v2/i,
];

for (const line of status.trim().split('\n').filter(Boolean)) {
  const relativePath = line.slice(3).replace(/^"|"$/g, '');
  if (forbiddenPathPatterns.some((pattern) => pattern.test(relativePath))) failures.push(`scope violation in working tree: ${relativePath}`);
}

try {
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  if (branch !== 'coco/arena-ruins-board-concept-preview-v1') failures.push(`unexpected branch: ${branch}`);
  console.log(`BRANCH OK ${branch}`);
  execFileSync('git', ['cat-file', '-e', `${baseSha}^{commit}`], { cwd: root });
  console.log(`BASE OK ${baseSha}`);
} catch (error) {
  failures.push(`branch/base validation failed: ${error.message}`);
}

if (failures.length > 0) {
  console.error('\nArena Ruins Board Concept Preview v1 validation FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nArena Ruins Board Concept Preview v1 validation PASSED');
console.log('canonicalApproved=false');

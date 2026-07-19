#!/usr/bin/env node

// Pre-runtime browser-decode compatibility test for Archer Attack v3.2 frame 004
// (16-bit-per-channel RGBA PNG). Test-only, isolated harness -- does not touch
// src/game.js, does not register any asset in the running game, does not load
// THREE.js (network-blocked; see NOTE below for why the tested primitives are
// still production-representative).
//
// NOTE on THREE.js r128 (the version autochess.html loads via CDN):
// THREE.TextureLoader has no PNG decoder of its own. Internally (via
// THREE.ImageLoader) it creates a native `Image`, sets `.src`, and on load
// wraps that HTMLImageElement in a THREE.Texture; WebGLRenderer then uploads
// it via the native WebGL `texImage2D`. Both of those primitives -- native
// `Image` decode and native `texImage2D` upload -- are exercised directly
// below, in the same Chromium/Blink engine the production CDN build would
// run in. This is NOT identical to executing THREE.js r128's own code path,
// but it is a faithful test of the two things that actually determine
// whether a 16-bit PNG works: can the browser decode it, and can WebGL
// upload the decoded bitmap as a texture.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const FRAMES_DIR = 'docs/assets/review/character-production/archer/attack-v3-2/frames';
// Resolve the repo root from this file's own location (tools/<this file>),
// not process.cwd() -- makes the script correct regardless of the directory
// it's invoked from.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8743;

function serveStatic(root) {
  return createServer(async (req, res) => {
    try {
      const filePath = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      const type = ext === '.png' ? 'image/png' : ext === '.html' ? 'text/html' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
      res.end(data);
    } catch {
      res.writeHead(404); res.end();
    }
  });
}

async function main() {
  const results = { target: {}, neighbors: {}, sequence: {}, textureUpload: {}, limitations: [] };

  const server = serveStatic(ROOT);
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  let browser;
  try {
    browser = await chromium.launch(); // relies on PLAYWRIGHT_BROWSERS_PATH auto-detection
  } catch (e) {
    results.limitations.push(`Chromium launch failed: ${e.message}`);
    server.close();
    console.log(JSON.stringify(results, null, 2));
    process.exit(3); // distinct exit code: environment could not run the test at all
  }

  const page = await browser.newPage();
  page.on('pageerror', (err) => results.limitations.push(`page error: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') results.limitations.push(`console error: ${msg.text()}`); });

  // Navigate to an actual http:// origin served by our local server first.
  // A page at about:blank has a null/opaque origin, which Chromium's Private
  // Network Access policy treats as "less private" than loopback and blocks
  // from fetching 127.0.0.1 resources -- an unrelated browser security
  // policy, not a PNG-decode issue. Giving the page a real http:// origin
  // avoids that false negative. (Discovered and isolated during this task;
  // see docs/reviews/archer-attack-v3-2-16bit-compatibility-check-v1.md.)
  await page.goto(`http://127.0.0.1:${PORT}/docs/`).catch(() => {}); // 404 is fine, only the origin matters

  // --- Core decode + alpha-bounds + pixel-sample test, run for target and neighbors ---
  async function decodeTest(relPath) {
    return page.evaluate(async (url) => {
      const img = new Image();
      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve('loaded');
        img.onerror = (e) => reject(new Error('image onerror fired'));
      });
      img.src = url;
      let loadResult;
      try {
        loadResult = await loadPromise;
      } catch (e) {
        return { decodeSucceeded: false, error: e.message };
      }
      const naturalWidth = img.naturalWidth, naturalHeight = img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = naturalWidth; canvas.height = naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, naturalWidth, naturalHeight);
      } catch (e) {
        return { decodeSucceeded: true, naturalWidth, naturalHeight, canvasReadFailed: true, error: e.message };
      }

      const data = imageData.data; // always Uint8ClampedArray, 8-bit/channel regardless of source PNG bit depth
      let minX = naturalWidth, minY = naturalHeight, maxX = -1, maxY = -1;
      let borderOpaque = 0;
      for (let y = 0; y < naturalHeight; y++) {
        for (let x = 0; x < naturalWidth; x++) {
          const a = data[(y * naturalWidth + x) * 4 + 3];
          if (a > 0) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (x === 0 || y === 0 || x === naturalWidth - 1 || y === naturalHeight - 1) borderOpaque++;
          }
        }
      }

      // sample a handful of deterministic points
      const sample = (x, y) => {
        const i = (y * naturalWidth + x) * 4;
        return { x, y, r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
      };
      const samples = [
        sample(0, 0), // corner, expect fully transparent
        sample(Math.floor(naturalWidth / 2), Math.floor(naturalHeight / 2)), // center
      ];
      if (maxX >= 0) samples.push(sample(minX, minY), sample(maxX, maxY)); // extreme opaque corners of bbox

      return {
        decodeSucceeded: true,
        naturalWidth, naturalHeight,
        canvasReadFailed: false,
        alphaBounds: maxX >= 0 ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
        borderOpaque,
        samples,
      };
    }, `http://127.0.0.1:${PORT}/${relPath}`);
  }

  results.target = await decodeTest(`${FRAMES_DIR}/hero.archer_attack_v3_2_004.png`);
  results.neighbors.frame003 = await decodeTest(`${FRAMES_DIR}/hero.archer_attack_v3_2_003.png`);
  results.neighbors.frame005 = await decodeTest(`${FRAMES_DIR}/hero.archer_attack_v3_2_005.png`);

  // --- WebGL texImage2D upload test (native API, same one THREE.WebGLRenderer/Texture calls internally) ---
  results.textureUpload = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('decode failed for upload test')); img.src = url; });

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { glAvailable: false };

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    let uploadError = null;
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } catch (e) {
      uploadError = e.message;
    }
    const glError = gl.getError();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const isTexture = gl.isTexture(tex);

    // dispose, mirroring THREE.Texture.dispose()'s eventual gl.deleteTexture call
    gl.deleteTexture(tex);
    const stillTexture = gl.isTexture(tex);

    return {
      glAvailable: true,
      glVersion: gl.getParameter(gl.VERSION),
      uploadThrew: uploadError !== null,
      uploadError,
      glErrorAfterUpload: glError, // 0 === gl.NO_ERROR
      isTextureAfterUpload: isTexture,
      isTextureAfterDispose: stillTexture, // should be false after deleteTexture
    };
  }, `http://127.0.0.1:${PORT}/${FRAMES_DIR}/hero.archer_attack_v3_2_004.png`);

  // --- Sequence load test: all 12 frames, confirm none throws, all decode to 640x960 ---
  const seqResults = [];
  for (let i = 0; i < 12; i++) {
    const idx = String(i).padStart(3, '0');
    const r = await decodeTest(`${FRAMES_DIR}/hero.archer_attack_v3_2_${idx}.png`);
    seqResults.push({ frame: idx, decodeSucceeded: r.decodeSucceeded, dims: r.naturalWidth ? `${r.naturalWidth}x${r.naturalHeight}` : null });
  }
  results.sequence = {
    allDecoded: seqResults.every(r => r.decodeSucceeded),
    allCorrectDims: seqResults.every(r => r.dims === '640x960'),
    perFrame: seqResults,
  };

  await browser.close();
  server.close();

  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error('HARNESS ERROR:', e.stack || e.message);
  process.exit(2);
});

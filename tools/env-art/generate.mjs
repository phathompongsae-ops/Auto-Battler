// Generates the TEMPORARY Town validation PNGs (2x environment art) into public/assets/environment/town/.
//   node tools/env-art/generate.mjs
// Uses headless Chrome (the browser-test harness) to run tools/env-art/townValidation.js on a Canvas 2D.
// Representative stand-ins for the style lock (docs/art/town-style-lock.md), not final production art.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser } from '../../tests/browser/cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(root, 'public', 'assets', 'environment', 'town');
const script = readFileSync(join(here, 'townValidation.js'), 'utf8');

const b = await Browser.launch({ port: 9336 });
try {
  await b.goto('about:blank');
  await b.eval(script);
  const names = await b.eval('Object.keys(window.__townValidation)');
  for (const name of names) {
    const url = await b.eval(`window.__townValidation[${JSON.stringify(name)}]().toDataURL('image/png')`);
    const file = join(out, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`wrote ${name}`);
  }
} finally {
  await b.close();
}

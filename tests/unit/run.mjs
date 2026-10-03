// Engine-independent unit tests: plain TypeScript run in Node.
//   npm run test:unit
// Each tests/unit/*.test.ts is loaded through Vite's module runner (so the
// project's TypeScript and import style just work) and uses node:test.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runnerImport } from 'vite';

const dir = join(process.cwd(), 'tests', 'unit');
const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts')).sort();
for (const file of files) {
  await runnerImport(join(dir, file), { logLevel: 'error' });
}

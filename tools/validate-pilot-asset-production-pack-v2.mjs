import fs from 'node:fs';

const path = 'data/design/pilot-asset-production-pack-v2.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];
const assert = (ok, message) => { if (!ok) errors.push(message); };

assert(data.schemaVersion === 2, 'schemaVersion must be 2');
assert(data.status === 'production-contract-draft', 'status must remain draft');
assert(data.global?.canonicalApproved === false, 'canonicalApproved must remain false');
assert(data.global?.fpsDefault === 12, 'default FPS must be 12');
assert(data.global?.fpsAcceptedRange?.[0] === 8 && data.global?.fpsAcceptedRange?.[1] === 15, 'accepted FPS must be 8-15');
assert(JSON.stringify(data.global?.states) === JSON.stringify(['idle','move','attack','skill','hit','death']), 'six states must be exact');
assert(data.runtimeReference?.assetAnimationPr === 23, 'must reference PR #23');
assert(data.runtimeReference?.assetAnimationHead === '5a3a8eec7991a98aad6f3acf0ce38687764dcb1a', 'PR #23 head mismatch');

const expected = {
  'hero.archer': { anchor: [0.5, 0.92], motionTest: 'attack' },
  'monster.slime': { anchor: [0.5, 0.9], motionTest: 'move' },
  'monster.golem': { anchor: [0.5, 0.94], motionTest: 'attack' }
};

for (const [id, exp] of Object.entries(expected)) {
  const pilot = data.pilots?.[id];
  assert(Boolean(pilot), `missing pilot ${id}`);
  assert(JSON.stringify(pilot?.anchor) === JSON.stringify(exp.anchor), `${id} anchor mismatch`);
  assert(pilot?.motionTest === exp.motionTest, `${id} motion test mismatch`);
}

assert(data.motionTests?.length === 3, 'exactly three motion tests required');
assert(data.deferred?.includes('full six-state production for all pilots'), 'full production must remain deferred');
assert(data.deferred?.includes('final canonical approval'), 'canonical approval must remain deferred');

if (errors.length) {
  console.error('Pilot asset production pack validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Pilot asset production pack v2 validation passed.');

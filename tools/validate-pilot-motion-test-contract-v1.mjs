import fs from 'node:fs';

// Validates data/design/pilot-motion-test-contract-v1.json — the contract for the first three
// motion tests (Archer attack, Slime move, Golem attack). Enforces: exact test list, locked
// runtime values (FPS/anchors from PR #23 and Production Pack v2), integer + consistent frame
// budgets, loop policy, required key poses/phases, unique well-formed event markers from the
// framework vocabulary, transparent-background and canvas rules, non-canonical status, and a
// deferred scope that keeps full six-state production and the Arena Ruins runtime test out of
// this round. Documentation/data only — it never touches runtime files.

const path = 'data/design/pilot-motion-test-contract-v1.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];
const assert = (ok, message) => { if (!ok) errors.push(message); };

// --- status / approval ---
assert(data.status === 'motion_test_contract_pending_production', 'status must be motion_test_contract_pending_production');
assert(data.canonicalApproved === false, 'canonicalApproved must remain false');
assert(data.runtimeReference?.assetAnimationPr === 23, 'must reference PR #23');
assert(data.runtimeReference?.productionPackHead === 'a779e242de37a59124259361c04af20106d4a932', 'production pack head mismatch');
assert(data.runtimeReference?.archerReferenceDesignHead === '336fcf931ed2ebb6a81294216e51a574db690ba3', 'archer reference design head mismatch');

// --- common contract ---
const c = data.common || {};
assert(c.fpsDefault === 12, 'common fpsDefault must be 12');
assert(c.fpsAcceptedRange?.[0] === 8 && c.fpsAcceptedRange?.[1] === 15, 'common fpsAcceptedRange must be [8,15]');
assert(c.transparentBackground === true, 'transparent background is required');
for (const field of ['consistentCanvasPerAsset', 'noCropping', 'cameraLock', 'motionBlurPolicy', 'referenceDesignLock', 'anchorLock', 'naming', 'sheetNaming', 'frameNumbering']) {
  assert(typeof c[field] === 'string' && c[field].length > 0, `common.${field} is required`);
}
assert(/\{frameIndex\}/.test(c.naming || ''), 'naming must include {frameIndex}');
assert(/000/.test(c.frameNumbering || ''), 'frameNumbering must be zero-padded starting at 000');
const meta = c.metadataFormat || {};
assert(typeof meta.sidecarFile === 'string', 'metadataFormat.sidecarFile is required');
for (const f of ['unitId', 'state', 'fps', 'frameCount', 'loop', 'anchor', 'canvas', 'eventMarkers', 'rootMotion']) {
  assert((meta.requiredFields || []).includes(f), `metadata requiredFields must include ${f}`);
}

// --- canvas rules (resolution-independent source, separate runtime display size) ---
const canvas = data.canvas || {};
assert(canvas.resolutionIndependentSource === true, 'canvas.resolutionIndependentSource must be true');
assert(canvas.maxSourceDimensionPx === 1024, 'max source dimension must be 1024');
assert(canvas.battleExportMaxDimensionPx === 512, 'battle export max dimension must be 512');
for (const id of ['hero.archer', 'monster.slime', 'monster.golem']) {
  const wc = canvas.recommendedWorkingCanvas?.[id];
  assert(Array.isArray(wc) && wc.length === 2 && wc.every((n) => Number.isInteger(n) && n > 0 && n <= 1024), `recommendedWorkingCanvas for ${id} must be two positive integers <= 1024`);
}

// --- anchors locked ---
const expectedAnchors = { 'hero.archer': [0.5, 0.92], 'monster.slime': [0.5, 0.9], 'monster.golem': [0.5, 0.94] };
for (const [id, anchor] of Object.entries(expectedAnchors)) {
  assert(JSON.stringify(data.anchors?.[id]) === JSON.stringify(anchor), `anchors.${id} must be ${JSON.stringify(anchor)}`);
}

// --- exactly the three locked motion tests ---
const tests = Array.isArray(data.motionTests) ? data.motionTests : [];
assert(tests.length === 3, 'exactly three motion tests are required');
const expectedTests = {
  'hero.archer': { state: 'attack', loop: false, marker: 'projectileRelease' },
  'monster.slime': { state: 'move', loop: true, marker: 'footstepCue' },
  'monster.golem': { state: 'attack', loop: false, marker: 'impactCue' },
};
const seenUnits = new Set();
const seenMarkers = new Set();
const vocab = data.runtimeReference?.eventMarkerVocabulary || [];

for (const t of tests) {
  const exp = expectedTests[t.unit];
  assert(Boolean(exp), `unexpected motion test unit: ${t.unit}`);
  if (!exp) continue;
  assert(!seenUnits.has(t.unit), `duplicate motion test for ${t.unit}`);
  seenUnits.add(t.unit);
  assert(t.state === exp.state, `${t.unit} state must be ${exp.state}`);
  assert(t.loop === exp.loop, `${t.unit} loop must be ${exp.loop}`);
  assert(t.fps === 12, `${t.unit} fps must be 12`);
  // frame budget: integers, min <= target <= max, inside the pack's accepted range shape
  for (const f of ['frameTarget', 'frameMin', 'frameMax']) assert(Number.isInteger(t[f]) && t[f] > 0, `${t.unit} ${f} must be a positive integer`);
  assert(t.frameMin <= t.frameTarget && t.frameTarget <= t.frameMax, `${t.unit} frame budget must satisfy min <= target <= max`);
  assert(typeof t.approxDurationSeconds === 'number' && t.approxDurationSeconds > 0, `${t.unit} approxDurationSeconds required`);
  assert(JSON.stringify(t.anchor) === JSON.stringify(expectedAnchors[t.unit]), `${t.unit} anchor must match the locked anchor`);
  // key poses + phases
  assert(Array.isArray(t.keyPoses) && t.keyPoses.length >= 5, `${t.unit} must declare ordered key poses`);
  for (const phase of ['anticipation', 'actionPhase', 'recovery']) assert(typeof t[phase] === 'string' && t[phase].length > 0, `${t.unit} must define ${phase}`);
  assert(typeof t.anchorLockNotes === 'string' && t.anchorLockNotes.length > 0, `${t.unit} must define anchor lock notes`);
  assert(Array.isArray(t.readabilityChecks) && t.readabilityChecks.length >= 3, `${t.unit} must define readability checks`);
  assert(Array.isArray(t.forbiddenDeviations) && t.forbiddenDeviations.length >= 4, `${t.unit} must define forbidden deviations`);
  // event markers: exactly one, from the framework vocabulary, normalized (0,1), globally unique
  assert(Array.isArray(t.eventMarkers) && t.eventMarkers.length === 1, `${t.unit} must declare exactly one event marker`);
  const m = t.eventMarkers?.[0] || {};
  assert(m.name === exp.marker, `${t.unit} event marker must be ${exp.marker}`);
  assert(vocab.includes(m.name), `${t.unit} event marker must come from the framework vocabulary`);
  assert(typeof m.normalizedTime === 'number' && m.normalizedTime > 0 && m.normalizedTime < 1, `${t.unit} event marker normalizedTime must be inside (0,1)`);
  assert(!seenMarkers.has(m.name), `event marker ${m.name} must not repeat across tests`);
  seenMarkers.add(m.name);
}
for (const id of Object.keys(expectedTests)) assert(seenUnits.has(id), `missing motion test for ${id}`);

// --- slime in-place / root-motion rule ---
const slime = tests.find((t) => t.unit === 'monster.slime');
assert(/in-place/i.test(slime?.anchorLockNotes || ''), 'slime move must be produced in-place (world movement is runtime-owned)');
assert(/root motion|rootMotion/i.test(slime?.anchorLockNotes || ''), 'slime move must reference explicit root-motion metadata if authored');

// --- no baked runtime effects in the non-loop attacks ---
const archer = tests.find((t) => t.unit === 'hero.archer');
assert((archer?.forbiddenDeviations || []).join(' ').toLowerCase().includes('projectile'), 'archer attack must forbid baked/runtime projectiles this round');
const golem = tests.find((t) => t.unit === 'monster.golem');
const golemForbidden = (golem?.forbiddenDeviations || []).join(' ').toLowerCase();
assert(golemForbidden.includes('vfx') && golemForbidden.includes('hitbox'), 'golem attack must forbid baked VFX and hitbox/damage logic this round');

// --- deferred scope ---
const deferred = (data.deferred || []).join(' | ').toLowerCase();
assert(deferred.includes('full six-state production'), 'deferred must include full six-state production');
assert(deferred.includes('arena ruins'), 'deferred must include the Arena Ruins runtime test');
assert(deferred.includes('final canonical approval'), 'deferred must include final canonical approval');

if (errors.length) {
  console.error('Pilot motion test contract v1 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Pilot motion test contract v1 validation passed.');

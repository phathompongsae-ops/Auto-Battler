import fs from 'node:fs';

// Validates data/design/archer-reference-design-v1.json against the Archer Reference Design v1
// contract: a pre-production visual specification only. It must never claim canonical approval,
// must stay locked to the runtime values already fixed by PR #23 / the Production Pack v2
// contract (asset id, gender, anchor, FPS, first motion test), must define a complete HEX color
// palette, and must explicitly forbid the visual traits that would make it collide with Acolyte
// or other classes. It must not reference animation frames, sprite sheets, motion test execution,
// or any binary/image artifact.

const path = 'data/design/archer-reference-design-v1.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];
const assert = (ok, message) => { if (!ok) errors.push(message); };

// --- identity + approval status ---
assert(data.assetId === 'hero.archer', 'assetId must be hero.archer');
assert(data.gender === 'female', 'gender must be female');
assert(data.canonicalApproved === false, 'canonicalApproved must remain false');
assert(data.status === 'reference_design_pending_user_approval', 'status must be reference_design_pending_user_approval');

// --- runtime values locked by PR #23 / Production Pack v2 (must not drift) ---
const rt = data.runtimeReference || {};
assert(JSON.stringify(rt.anchor) === JSON.stringify([0.5, 0.92]), 'anchor must remain [0.5, 0.92]');
assert(rt.fpsDefault === 12, 'default FPS must be 12');
assert(rt.fpsAcceptedRange?.[0] === 8 && rt.fpsAcceptedRange?.[1] === 15, 'accepted FPS range must be 8-15');
assert(rt.firstMotionTest === 'attack', 'first motion test must be attack');
assert(rt.assetAnimationPr === 23, 'must reference PR #23');

// --- art direction (mandatory style constraints) ---
const ad = data.artDirection || {};
assert(/stylized 3d fantasy/i.test(ad.style || ''), 'style must be stylized 3D fantasy');
assert(/hand-painted/i.test(ad.texture || ''), 'texture must be hand-painted');
assert(/chibi/i.test(ad.proportion || ''), 'proportion must specify chibi');
assert(ad.presentation === 'full body', 'presentation must be full body');
assert(/3\/4 front/i.test(ad.cameraAngle || ''), 'camera angle must be 3/4 front view');
assert(ad.background === 'transparent', 'background must be transparent');
assert(Array.isArray(ad.excludedFromCanvas) && ad.excludedFromCanvas.length >= 4, 'excludedFromCanvas must list forbidden canvas elements');

// --- required specification sections must all be present ---
const requiredSections = [
  'visualIdentity', 'silhouette', 'bodyProportion', 'costume', 'colorPalette', 'hair',
  'faceReadability', 'weapon', 'pose', 'cameraAndFraming', 'lighting', 'materialGuidance',
  'mobileReadabilityConstraints', 'transparentBackgroundExportConstraints',
  'forbiddenVisualTraits', 'differentiationFromAcolyte',
];
for (const key of requiredSections) assert(data[key] !== undefined && data[key] !== null, `missing required section: ${key}`);

// --- color palette: primary/secondary/accent/skin/hair, each a valid 6-digit hex ---
const hexRe = /^#[0-9A-Fa-f]{6}$/;
const palette = data.colorPalette || {};
for (const role of ['primary', 'secondary', 'accent', 'skin', 'hair']) {
  const entry = palette[role];
  assert(Boolean(entry), `colorPalette.${role} is required`);
  assert(hexRe.test(entry?.hex || ''), `colorPalette.${role}.hex must be a valid 6-digit hex color`);
}
assert(hexRe.test(data.hair?.colorHex || ''), 'hair.colorHex must be a valid 6-digit hex color');

// --- weapon must clearly specify a bow, never a staff/crossbow/sword ---
const weapon = data.weapon || {};
assert(/bow/i.test(weapon.bowDesign || ''), 'weapon.bowDesign must describe a bow');
assert(!/staff|crossbow|sword/i.test(weapon.bowDesign || ''), 'weapon.bowDesign must not describe a staff, crossbow, or sword');
assert(typeof weapon.quiverPlacement === 'string' && weapon.quiverPlacement.length > 0, 'weapon.quiverPlacement is required');

// --- forbidden traits must explicitly rule out Acolyte/other-class collisions ---
const forbidden = (data.forbiddenVisualTraits || []).join(' | ').toLowerCase();
for (const mustForbid of ['acolyte', 'staff', 'shield', 'sword', 'robe', 'crossbow']) {
  assert(forbidden.includes(mustForbid), `forbiddenVisualTraits must rule out "${mustForbid}"`);
}

// --- must not claim any production output beyond a reference design ---
const forbiddenKeys = ['animationFrames', 'spriteSheet', 'motionTestResult', 'finalArtwork', 'imagePath', 'canonicalPath'];
for (const key of forbiddenKeys) assert(!(key in data), `must not include out-of-scope key: ${key}`);
const excluded = (data.excludedFromThisTask || []).join(' | ').toLowerCase();
for (const mustExclude of ['animation frames', 'sprite sheet', 'motion test', 'final artwork', 'runtime integration', 'canonical approval']) {
  assert(excluded.includes(mustExclude), `excludedFromThisTask must list "${mustExclude}"`);
}

if (errors.length) {
  console.error('Archer reference design v1 validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Archer reference design v1 validation passed.');

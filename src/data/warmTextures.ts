import { MAGE_ART } from './characterArt';
import { VFX_ART, type VfxId } from './vfxArt';

/*
 * Textures uploaded to the GPU gradually after boot (rendering/prewarm.ts,
 * warmTexturesGradually), so their first real use does not stall a frame.
 * Order: what a fresh Mage meets first (Magic Bolt, the cast pose), then the
 * spells, the heaviest (Meteor) last.
 */
const MAGE_VFX: readonly VfxId[] = ['magic_bolt', 'magic_bolt_impact', 'flame_burst', 'frost_nova', 'frost_storm', 'meteor_fall', 'meteor_impact'];

export const MAGE_WARM_TEXTURES: readonly string[] = [
  ...Object.values(MAGE_ART.actions.attack).map((a) => a.key),
  ...Object.values(MAGE_ART.actions.cast).map((a) => a.key),
  ...MAGE_VFX.map((id) => VFX_ART[id].key),
];

/*
 * The shared telegraph curve (pure, engine-free): how a danger zone's intensity and style follow its wind-up
 * progress. Rendering lives in Telegraphs.ts; unit tests read these same numbers.
 */

/** 0..1 danger intensity at wind-up progress `p`: soft and slowly rising, then urgent over the final 30%. */
export function telegraphIntensity(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  if (t <= 0.7) return 0.12 + 0.43 * Math.pow(t / 0.7, 1.5);
  return Math.min(1, 0.55 + 0.45 * Math.pow((t - 0.7) / 0.3, 0.75));
}

/** Intensity below which the zone has no rim at all: early and mid wind-up are a soft field only. */
export const TELEGRAPH_RIM_FROM = 0.45;

/**
 * Style of a zone at a progress / intensity (pure: the renderer and the tests read the same numbers). A soft red
 * danger SHADOW, never a stroked ring: every layer is a feathered radial texture on the real radius.
 * `pulse` (0..1) is the restrained late breath, applied by the renderer over the final ~22%.
 */
export function telegraphStyle(p: number, e: number, pulse = 0) {
  const rim = Math.max(0, (e - TELEGRAPH_RIM_FROM) / (1 - TELEGRAPH_RIM_FROM));
  return {
    /** Dark ground shade under the red: the zone still reads on red carpet and bright grass. */
    shadeAlpha: 0.07 + 0.32 * e,
    /** Translucent red field with a soft radial falloff; darkens as the wind-up runs. */
    fillAlpha: 0.07 + 0.4 * e + 0.04 * pulse,
    /** Growing inner field: how far the wind-up has run. */
    coreScale: 0.05 + 0.95 * Math.min(1, Math.max(0, p)),
    coreAlpha: 0.04 + 0.16 * e,
    /** Feathered rim glow: absent early / mid, only firming up in the late phase (never a hard line). */
    rimAlpha: Math.min(0.75, 0.55 * rim + 0.18 * pulse * rim),
  };
}

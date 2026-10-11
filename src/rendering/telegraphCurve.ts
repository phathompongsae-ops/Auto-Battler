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

/** Style of a zone at a progress / intensity (pure: the renderer and the tests read the same numbers). */
export function telegraphStyle(p: number, e: number, pulse = 0) {
  return {
    /** Soft red shadow over the whole zone. */
    fillAlpha: 0.04 + 0.2 * e,
    /** Growing inner fill: how far the wind-up has run. */
    coreScale: 0.05 + 0.95 * Math.min(1, Math.max(0, p)),
    coreAlpha: 0.06 + 0.12 * e,
    /** Edge: faint at first, clearest just before impact (a small late pulse on top). */
    edgeAlpha: Math.min(1, 0.18 + 0.82 * e),
    edgeWidth: 1.1 + 1.7 * e + pulse,
    /** Dark under-stroke so the edge reads on red carpet and bright ground. */
    shadeAlpha: 0.12 + 0.38 * e,
  };
}

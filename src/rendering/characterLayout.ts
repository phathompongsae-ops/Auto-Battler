import type { CharacterVisualLayout } from '../data/characterArt';

/*
 * Placement of overhead UI and body-surrounding effects, derived from a
 * character's visual layout. Offsets are world pixels relative to the
 * character's position; negative is up.
 */

/** Space between the top of the head and the HP bar. */
const BAR_GAP = 9;
/** Bars are drawn with a 1px outline above their top row. */
const BAR_OUTLINE = 1;
/** Space between the top of the bars and the bottom of floating text. */
const TEXT_GAP = 2;

/** Height of the head above the position. */
export function headTop(layout: CharacterVisualLayout): number {
  return layout.height - layout.feetOffset;
}

/** Y offset of the top HP bar row. */
export function barOffsetY(layout: CharacterVisualLayout): number {
  return -(headTop(layout) + BAR_GAP);
}

/** Y offset where floating text starts (its bottom edge), just above the bars. */
export function textAnchorY(layout: CharacterVisualLayout): number {
  return barOffsetY(layout) - BAR_OUTLINE - TEXT_GAP;
}

/** Y offset of the middle of the drawn body. */
export function bodyCenterY(layout: CharacterVisualLayout): number {
  return layout.feetOffset - layout.height / 2;
}

/** Ellipse that surrounds the body: guard aura and similar effects. */
export function auraEllipse(layout: CharacterVisualLayout): { offsetY: number; width: number; height: number } {
  return {
    offsetY: bodyCenterY(layout),
    width: layout.bodyWidth + layout.effectPadding.x * 2,
    height: layout.height + layout.effectPadding.y * 2,
  };
}

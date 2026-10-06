import { tileHash } from '../../world/layout';
import type { Tile } from '../../world/tiles';
import type { PropKind, PropPlacement } from './props';

/**
 * Deterministic scatter of non-solid ground decoration (flowers, tufts,
 * bones...) over tiles of the given kinds. `avoid` keeps roads, landmarks and
 * spawn areas clear. Decoration never changes collision.
 */
export function scatterDecor(
  tiles: readonly (readonly Tile[])[],
  on: readonly Tile[],
  kinds: readonly PropKind[],
  density: number,
  avoid: (x: number, y: number) => boolean = () => false,
  salt = 0,
): PropPlacement[] {
  const out: PropPlacement[] = [];
  tiles.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (!on.includes(tile) || avoid(x, y)) return;
      if (tileHash(x + salt * 31.7, y - salt * 17.3) >= density) return;
      out.push({ kind: kinds[Math.floor(tileHash(y + salt, x * 3.1) * kinds.length)], x, y });
    }),
  );
  return out;
}

import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import type { CharacterVisualLayout } from '../data/characterArt';
import { DIRECTIONS, type Direction } from '../input/Direction';
import { Tile, TILE_COUNT } from '../world/testMap';

/*
 * Placeholder art drawn to canvas at boot. Every texture here is meant to be
 * replaced by real sprite sheets later, keeping the same keys and frame names.
 */

export const TILESET_KEY = 'tiles';
export const PLAYER_KEY = 'player';
export const PLAYER_FRAME_SIZE = 32;

/** Frames per facing: 0 = idle, 1 = left foot forward, 2 = right foot forward. */
export const PLAYER_FRAMES_PER_DIRECTION = 3;

/**
 * Layout of the drawn placeholder player: head top at y-13, feet at y+13,
 * a 14px-wide body. Padding keeps the guard aura at its original 36×40.
 */
export const PLAYER_PLACEHOLDER_LAYOUT: CharacterVisualLayout = {
  feetOffset: 13,
  height: 26,
  bodyWidth: 14,
  effectPadding: { x: 11, y: 7 },
};

export function playerFrame(dir: Direction, index: number): string {
  return `${dir}-${index}`;
}

export const SLIME_KEY = 'slime';
export const LOOT_KEY = 'loot-gem';

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  createTileset(scene);
  createPlayerSheet(scene);
  createSlimeSheet(scene);
  createLootGem(scene);
}

/** Two-frame squishy slime; frames `slime-0` and `slime-1`. */
function createSlimeSheet(scene: Phaser.Scene): void {
  const s = 32;
  const texture = scene.textures.createCanvas(SLIME_KEY, s * 2, s);
  if (!texture) throw new Error('Could not create slime texture');
  const ctx = texture.getContext();

  for (let frame = 0; frame < 2; frame++) {
    const ox = frame * s;
    const squash = frame === 1 ? 1 : 0;
    const w = 11 + squash; // half-width
    const h = 8 - squash; // half-height
    const cy = 22 + squash;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(ox + 16, 29, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1f4d1a';
    ctx.beginPath();
    ctx.ellipse(ox + 16, cy, w + 1, h + 1, 0, Math.PI, 0);
    ctx.lineTo(ox + 16 + w + 1, cy + 5);
    ctx.lineTo(ox + 16 - w - 1, cy + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#6cc04a';
    ctx.beginPath();
    ctx.ellipse(ox + 16, cy, w, h, 0, Math.PI, 0);
    ctx.lineTo(ox + 16 + w, cy + 4);
    ctx.lineTo(ox + 16 - w, cy + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b6ee8f';
    ctx.fillRect(ox + 10, cy - h + 2, 4, 2);

    ctx.fillStyle = '#1d1b26';
    ctx.fillRect(ox + 12, cy - 2, 2, 3);
    ctx.fillRect(ox + 18, cy - 2, 2, 3);

    texture.add(`${SLIME_KEY}-${frame}`, 0, ox, 0, s, s);
  }
  texture.refresh();
}

/** White gem shape; tinted per item at runtime. */
function createLootGem(scene: Phaser.Scene): void {
  const texture = scene.textures.createCanvas(LOOT_KEY, 12, 12);
  if (!texture) throw new Error('Could not create loot texture');
  const ctx = texture.getContext();
  ctx.fillStyle = '#1d1b26';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(12, 6);
  ctx.lineTo(6, 12);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 2);
  ctx.lineTo(10, 6);
  ctx.lineTo(6, 10);
  ctx.lineTo(2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(6, 6, 3, 3);
  texture.refresh();
}

function createTileset(scene: Phaser.Scene): void {
  const s = TILE_SIZE;
  const texture = scene.textures.createCanvas(TILESET_KEY, s * TILE_COUNT, s);
  if (!texture) throw new Error('Could not create tileset texture');
  const ctx = texture.getContext();

  const fill = (tile: Tile, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(tile * s, 0, s, s);
  };
  const dots = (tile: Tile, color: string, points: [number, number][], size = 2) => {
    ctx.fillStyle = color;
    for (const [x, y] of points) ctx.fillRect(tile * s + x, y, size, size);
  };

  fill(Tile.Grass, '#5f9e4f');
  dots(Tile.Grass, '#6fb15d', [[5, 6], [20, 4], [12, 17], [26, 22], [7, 26], [17, 28]]);

  fill(Tile.Flowers, '#5f9e4f');
  dots(Tile.Flowers, '#6fb15d', [[20, 4], [26, 22]]);
  dots(Tile.Flowers, '#f2e55c', [[7, 8], [22, 14], [11, 23]], 3);
  dots(Tile.Flowers, '#f08ab0', [[16, 6], [5, 18], [24, 26]], 3);

  fill(Tile.Path, '#c8a96b');
  dots(Tile.Path, '#b39256', [[4, 5], [18, 9], [9, 20], [25, 25], [27, 3]]);

  fill(Tile.Wall, '#6d6f78');
  ctx.fillStyle = '#4b4d55';
  const wx = Tile.Wall * s;
  ctx.fillRect(wx, 15, s, 2);
  ctx.fillRect(wx + 15, 0, 2, 15);
  ctx.fillRect(wx + 7, 17, 2, 15);
  ctx.fillRect(wx + 23, 17, 2, 15);
  ctx.fillStyle = '#8a8c96';
  ctx.fillRect(wx, 0, s, 2);

  fill(Tile.Water, '#3d7cc9');
  ctx.fillStyle = '#6aa3e6';
  const ox = Tile.Water * s;
  ctx.fillRect(ox + 4, 8, 10, 2);
  ctx.fillRect(ox + 17, 20, 10, 2);

  texture.refresh();
}

const PLAYER_COLORS = {
  shadow: 'rgba(0, 0, 0, 0.25)',
  outline: '#1d1b26',
  skin: '#f1c89b',
  hair: '#5a3a22',
  tunic: '#3f6fd8',
  belt: '#2a2f45',
  legs: '#3a3348',
  eye: '#1d1b26',
};

function createPlayerSheet(scene: Phaser.Scene): void {
  const s = PLAYER_FRAME_SIZE;
  const cols = PLAYER_FRAMES_PER_DIRECTION;
  const texture = scene.textures.createCanvas(PLAYER_KEY, s * cols, s * DIRECTIONS.length);
  if (!texture) throw new Error('Could not create player texture');
  const ctx = texture.getContext();

  DIRECTIONS.forEach((dir, row) => {
    for (let col = 0; col < cols; col++) {
      const x = col * s;
      const y = row * s;
      drawPlayer(ctx, x, y, dir, col);
      texture.add(playerFrame(dir, col), 0, x, y, s, s);
    }
  });

  texture.refresh();
}

/** Draws one 32×32 chibi frame with its feet near the bottom of the cell. */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: Direction,
  step: number,
): void {
  const c = PLAYER_COLORS;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  // Walking frames bob the body up a pixel and swing the legs.
  const bob = step === 0 ? 0 : -1;
  const side = dir === 'left' || dir === 'right';
  const leftLeg = step === 1 ? -2 : step === 2 ? 1 : 0;
  const rightLeg = step === 2 ? -2 : step === 1 ? 1 : 0;

  // Shadow
  ctx.fillStyle = c.shadow;
  ctx.beginPath();
  ctx.ellipse(ox + 16, oy + 29, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  if (side) {
    rect(13 + leftLeg, 23, 3, 6 + Math.min(0, -leftLeg), c.legs);
    rect(17 + rightLeg, 23, 3, 6 + Math.min(0, -rightLeg), c.legs);
  } else {
    rect(12, 23 + bob, 3, 6 + leftLeg, c.legs);
    rect(17, 23 + bob, 3, 6 + rightLeg, c.legs);
  }

  // Body
  rect(9, 14 + bob, 14, 10, c.outline);
  rect(10, 15 + bob, 12, 8, c.tunic);
  rect(10, 20 + bob, 12, 2, c.belt);

  // Head
  rect(9, 3 + bob, 14, 12, c.outline);
  rect(10, 4 + bob, 12, 10, c.skin);

  // Hair and face, depending on facing
  switch (dir) {
    case 'down':
      rect(10, 4 + bob, 12, 3, c.hair);
      rect(13, 9 + bob, 2, 2, c.eye);
      rect(17, 9 + bob, 2, 2, c.eye);
      break;
    case 'up':
      rect(10, 4 + bob, 12, 10, c.hair);
      break;
    case 'left':
      rect(10, 4 + bob, 12, 3, c.hair);
      rect(16, 4 + bob, 6, 8, c.hair);
      rect(11, 9 + bob, 2, 2, c.eye);
      break;
    case 'right':
      rect(10, 4 + bob, 12, 3, c.hair);
      rect(10, 4 + bob, 6, 8, c.hair);
      rect(19, 9 + bob, 2, 2, c.eye);
      break;
  }
}

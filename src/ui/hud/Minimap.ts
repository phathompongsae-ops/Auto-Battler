import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import type { CombatWorld } from '../../game/CombatWorld';
import { Tile } from '../../world/testMap';
import { createPanel } from '../components/Panel';
import { h } from '../dom';

const PX_PER_TILE = 3;
const REFRESH_MS = 100;

const TILE_COLORS: Record<number, string> = {
  [Tile.Grass]: '#3f6b38',
  [Tile.Flowers]: '#41703a',
  [Tile.Path]: '#8f7a52',
  [Tile.Wall]: '#4b4d58',
  [Tile.Water]: '#2c5c99',
};

/** Top-right minimap: the whole test map, camera view, monsters, loot and the player. */
export class Minimap {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly background: HTMLCanvasElement;
  private lastDraw = -Infinity;

  constructor(
    private readonly world: CombatWorld,
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    tiles: number[][],
    areaName: string,
  ) {
    const w = tiles[0].length * PX_PER_TILE;
    const hgt = tiles.length * PX_PER_TILE;
    this.background = document.createElement('canvas');
    this.background.width = w;
    this.background.height = hgt;
    const bg = this.background.getContext('2d')!;
    tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        bg.fillStyle = TILE_COLORS[tile] ?? '#000';
        bg.fillRect(x * PX_PER_TILE, y * PX_PER_TILE, PX_PER_TILE, PX_PER_TILE);
      }),
    );

    this.canvas = h('canvas', { attrs: { width: String(w), height: String(hgt) } });
    this.ctx = this.canvas.getContext('2d')!;
    this.el = createPanel({ className: 'hud-minimap', strong: true }, [
      this.canvas,
      h('div', { className: 'hud-minimap__label', text: areaName }),
    ]);
    this.el.dataset.hud = 'minimap';
  }

  update(now: number): void {
    if (now - this.lastDraw < REFRESH_MS) return;
    this.lastDraw = now;
    const ctx = this.ctx;
    const k = PX_PER_TILE / TILE_SIZE;
    ctx.drawImage(this.background, 0, 0);

    const view = this.camera.worldView;
    ctx.strokeStyle = 'rgba(244, 236, 219, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(view.x * k + 0.5, view.y * k + 0.5, view.width * k - 1, view.height * k - 1);

    ctx.fillStyle = '#9be36b';
    for (const drop of this.world.loot.drops) ctx.fillRect(drop.x * k - 1, drop.y * k - 1, 2, 2);

    ctx.fillStyle = '#ff6b6b';
    for (const m of this.world.monsters) {
      if (!m.combat.dead) ctx.fillRect(m.x * k - 1.5, m.y * k - 1.5, 3, 3);
    }

    const p = this.world.player;
    ctx.fillStyle = '#1d1b26';
    ctx.fillRect(p.x * k - 2.5, p.y * k - 2.5, 5, 5);
    ctx.fillStyle = '#f3d898';
    ctx.fillRect(p.x * k - 1.5, p.y * k - 1.5, 3, 3);
  }
}

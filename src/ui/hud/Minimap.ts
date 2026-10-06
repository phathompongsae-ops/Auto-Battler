import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import type { MapDef } from '../../data/maps';
import type { CombatWorld } from '../../game/CombatWorld';
import { Tile } from '../../world/tiles';
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
  [Tile.Cobble]: '#7d7871',
  [Tile.Roof]: '#7a3a2e',
  [Tile.Portal]: '#9a72e8',
  [Tile.Dirt]: '#7a6040',
  [Tile.Moss]: '#3f6f55',
  [Tile.DarkGrass]: '#2f5528',
  [Tile.Tree]: '#24501f',
  [Tile.DungeonFloor]: '#45414d',
  [Tile.DungeonWall]: '#1c1a21',
  [Tile.Carpet]: '#5c2433',
};

/** Top-right minimap: the current map, camera view, monsters, loot and the player. Redrawn when the map changes. */
export class Minimap {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly background: HTMLCanvasElement;
  private readonly label: HTMLDivElement;
  private mapId: string | null = null;
  private lastDraw = -Infinity;

  constructor(
    private readonly world: CombatWorld,
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
  ) {
    this.background = document.createElement('canvas');
    this.canvas = h('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.label = h('div', { className: 'hud-minimap__label' });
    this.el = createPanel({ className: 'hud-minimap', strong: true }, [this.canvas, this.label]);
    this.el.dataset.hud = 'minimap';
    this.syncMap();
  }

  /** Rebuild the background and label when the world is on another map. */
  private syncMap(): void {
    const map: MapDef = this.world.maps.map;
    if (map.id === this.mapId) return;
    this.mapId = map.id;
    const w = map.tiles[0].length * PX_PER_TILE;
    const hgt = map.tiles.length * PX_PER_TILE;
    this.background.width = this.canvas.width = w;
    this.background.height = this.canvas.height = hgt;
    const bg = this.background.getContext('2d')!;
    map.tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        bg.fillStyle = TILE_COLORS[tile] ?? '#000';
        bg.fillRect(x * PX_PER_TILE, y * PX_PER_TILE, PX_PER_TILE, PX_PER_TILE);
      }),
    );
    this.label.textContent = map.displayName;
    this.el.dataset.mapId = map.id;
    this.el.dataset.mapType = map.type;
    this.lastDraw = -Infinity;
  }

  update(now: number): void {
    this.syncMap();
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

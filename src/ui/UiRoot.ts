import Phaser from 'phaser';
import { h } from './dom';
import './styles/tokens.css';
import './styles/components.css';
import './styles/hud.css';

/** --ui-scale is the canvas height relative to the design height, kept in this range. */
const DESIGN_HEIGHT = 540;
const MIN_UI_SCALE = 0.8;
const MAX_UI_SCALE = 1.5;

/**
 * DOM layer laid exactly over the game canvas. The canvas is letterboxed by
 * Phaser's FIT scaling, so the root follows its on-page rect and exposes
 * `--ui-scale` for every component to size itself from.
 */
export class UiRoot {
  readonly el: HTMLDivElement;
  /** CSS pixels per game pixel. */
  cssPerGamePixel = 1;
  uiScale = 1;

  private readonly observer: ResizeObserver;
  private readonly parent: HTMLElement;

  constructor(private readonly game: Phaser.Game) {
    const canvas = game.canvas;
    this.parent = canvas.parentElement ?? document.body;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.el = h('div', { className: 'ui-root', attrs: { 'data-ui-root': '', 'data-touch': String(coarse) } });
    this.parent.append(this.el);

    this.observer = new ResizeObserver(() => this.sync());
    this.observer.observe(canvas);
    window.addEventListener('resize', this.sync);
    game.scale.on(Phaser.Scale.Events.RESIZE, this.sync);
    this.sync();
  }

  /** Game-space point (pointer.x/y) to a position inside the UI root. */
  toLocal(x: number, y: number): { x: number; y: number } {
    return { x: x * this.cssPerGamePixel, y: y * this.cssPerGamePixel };
  }

  destroy(): void {
    this.observer.disconnect();
    window.removeEventListener('resize', this.sync);
    this.game.scale.off(Phaser.Scale.Events.RESIZE, this.sync);
    this.el.remove();
  }

  private readonly sync = (): void => {
    const canvas = this.game.canvas.getBoundingClientRect();
    const parent = this.parent.getBoundingClientRect();
    const s = this.el.style;
    s.left = `${canvas.left - parent.left}px`;
    s.top = `${canvas.top - parent.top}px`;
    s.width = `${canvas.width}px`;
    s.height = `${canvas.height}px`;
    this.cssPerGamePixel = canvas.width / this.game.scale.width || 1;
    this.uiScale = Phaser.Math.Clamp(canvas.height / DESIGN_HEIGHT, MIN_UI_SCALE, MAX_UI_SCALE);
    this.el.style.setProperty('--ui-scale', this.uiScale.toFixed(3));
  };
}

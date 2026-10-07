import Phaser from 'phaser';
import { WORLD_TEXT_FONT } from './fonts';

export interface FloatingTextStyle {
  color: string;
  size?: number;
  rise?: number;
  duration?: number;
  /** Outline colour / width (default: dark ink, 3). */
  stroke?: string;
  strokeThickness?: number;
  /** Starting scale of a short pop that settles to 1 (default 1: no pop). */
  pop?: number;
  /** ms of that pop. */
  popMs?: number;
  /** A small code-drawn starburst behind the text (critical hits). */
  spark?: boolean;
}

const POOL_SIZE = 32;
const SPARK_POOL_SIZE = 6;
const TOP_DEPTH = 1_000_000;
const DEFAULT_STROKE = '#1d1b26';

/**
 * Pooled rising/fading world-space text: damage numbers, EXP, pickups,
 * messages. Fixed pools (32 texts, 6 sparks) created once: a busy fight
 * recycles the oldest instead of allocating; each live text has at most two
 * tweens (pop, rise/fade), killed on recycle.
 */
export class FloatingText {
  private readonly pool: Phaser.GameObjects.Text[] = [];
  /** Style last applied to each pooled text, so recycling re-renders its canvas only when the look changes. */
  private readonly applied = new WeakMap<Phaser.GameObjects.Text, string>();
  /** Font metrics per style, measured once: re-measuring scans canvas pixels, too slow per hit. */
  private readonly metrics = new Map<string, { ascent: number; descent: number; fontSize: number }>();
  private readonly sparks: Phaser.GameObjects.Graphics[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: WORLD_TEXT_FONT,
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: DEFAULT_STROKE,
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1)
          .setDepth(TOP_DEPTH)
          .setVisible(false)
          .setActive(false),
      );
    }
    for (let i = 0; i < SPARK_POOL_SIZE; i++) this.sparks.push(this.drawSpark());
  }

  show(x: number, y: number, message: string, style: FloatingTextStyle): void {
    // Reuse a free text, or recycle the oldest one if all are busy.
    let text = this.pool.find((t) => !t.active);
    if (!text) {
      text = this.pool.shift()!;
      this.scene.tweens.killTweensOf(text);
      this.pool.push(text);
    }
    const size = style.size ?? 14;
    const stroke = style.stroke ?? DEFAULT_STROKE;
    const thickness = style.strokeThickness ?? 3;
    const key = `${style.color}|${size}|${stroke}|${thickness}`;
    // Exactly one canvas render per show: restyle without rendering (cached metrics), then render once.
    const restyle = this.applied.get(text) !== key;
    if (restyle) {
      const look = { color: style.color, fontSize: `${size}px`, stroke, strokeThickness: thickness };
      const known = this.metrics.get(key);
      if (known) text.style.setStyle({ ...look, metrics: known }, false);
      else {
        text.setStyle(look);
        // TextStyle.metrics exists at runtime (Phaser measures it on restyle) but is missing from the typings.
        const m = (text.style as unknown as { metrics: { ascent: number; descent: number; fontSize: number } }).metrics;
        this.metrics.set(key, { ascent: m.ascent, descent: m.descent, fontSize: m.fontSize });
      }
      this.applied.set(text, key);
    }
    if (text.text !== message) text.setText(message);
    else if (restyle) text.updateText();
    const duration = style.duration ?? 700;
    const pop = style.pop ?? 1;
    text.setPosition(x, y).setAlpha(1).setScale(pop).setVisible(true).setActive(true);

    if (pop !== 1) {
      this.scene.tweens.add({ targets: text, scale: 1, duration: style.popMs ?? 100, ease: pop >= 1.5 ? 'Back.easeOut' : 'Quad.easeOut' });
    }
    this.scene.tweens.add({
      targets: text,
      y: y - (style.rise ?? 28),
      alpha: { from: 1, to: 0, delay: duration * 0.55 },
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => text.setVisible(false).setActive(false),
    });
    if (style.spark) this.spark(x, y - size * 0.55);
  }

  /** A pooled starburst behind a critical number: a quick flash outward, then gone. */
  private spark(x: number, y: number): void {
    let g = this.sparks.find((s) => !s.active);
    if (!g) {
      g = this.sparks.shift()!;
      this.scene.tweens.killTweensOf(g);
      this.sparks.push(g);
    }
    g.setPosition(x, y).setScale(0.55).setAlpha(0.95).setVisible(true).setActive(true);
    this.scene.tweens.add({
      targets: g,
      scale: 1.25,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => g.setVisible(false).setActive(false),
    });
  }

  /** Drawn once: eight short rays around a small warm core. */
  private drawSpark(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(TOP_DEPTH - 1).setVisible(false).setActive(false);
    g.fillStyle(0xffd27a, 0.55);
    g.fillCircle(0, 0, 5);
    g.lineStyle(2, 0xffe2a0, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const inner = 6;
      const outer = i % 2 === 0 ? 15 : 11;
      g.lineBetween(Math.cos(a) * inner, Math.sin(a) * inner, Math.cos(a) * outer, Math.sin(a) * outer);
    }
    return g;
  }
}

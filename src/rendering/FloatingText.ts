import Phaser from 'phaser';

export interface FloatingTextStyle {
  color: string;
  size?: number;
  rise?: number;
  duration?: number;
}

const POOL_SIZE = 32;
const TOP_DEPTH = 1_000_000;

/** Pooled rising/fading world-space text: damage numbers, EXP, pickups, messages. */
export class FloatingText {
  private readonly pool: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#1d1b26',
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1)
          .setDepth(TOP_DEPTH)
          .setVisible(false)
          .setActive(false),
      );
    }
  }

  show(x: number, y: number, message: string, style: FloatingTextStyle): void {
    // Reuse a free text, or recycle the oldest one if all are busy.
    let text = this.pool.find((t) => !t.active);
    if (!text) {
      text = this.pool.shift()!;
      this.scene.tweens.killTweensOf(text);
      this.pool.push(text);
    }
    const jitter = (Math.random() - 0.5) * 10;
    text
      .setText(message)
      .setColor(style.color)
      .setFontSize(style.size ?? 14)
      .setPosition(x + jitter, y)
      .setAlpha(1)
      .setScale(1)
      .setVisible(true)
      .setActive(true);

    this.scene.tweens.add({
      targets: text,
      y: y - (style.rise ?? 28),
      alpha: { from: 1, to: 0, delay: (style.duration ?? 700) * 0.5 },
      duration: style.duration ?? 700,
      ease: 'Cubic.easeOut',
      onComplete: () => text.setVisible(false).setActive(false),
    });
  }
}

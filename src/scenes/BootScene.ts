import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Placeholder frame and emblem — no game art yet.
    this.add.rectangle(cx, cy, width - 48, height - 48).setStrokeStyle(2, 0x3b4a63);
    const emblem = this.add.rectangle(cx, cy - 70, 64, 64, 0x4f7cff).setAngle(45);
    this.tweens.add({
      targets: emblem,
      angle: 405,
      duration: 4000,
      repeat: -1,
    });

    this.add
      .text(cx, cy + 20, 'Auto-Battler RPG', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#e8eefc',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 66, `Phaser ${Phaser.VERSION} · TypeScript · Vite`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8fa3c7',
      })
      .setOrigin(0.5);
  }
}

import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import type { ProgressionGateDef } from '../data/maps';
import { GATE_SEAL_KEY, GATE_SEAL_SIZE } from '../graphics/envFeatureArt';

/** On the floor: above the ground tiles (-1..-0.85), below every y-sorted character, monster and prop. */
const BARRIER_DEPTH = -0.5;
const AMBER = 0xd9a441;
const RUNE = 0xf1cf86;

interface Barrier {
  gate: ProgressionGateDef;
  g: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  shimmer: Phaser.Tweens.Tween;
}

/**
 * Closed progression gates drawn across their doorway (from the shared gate
 * data): a dark iron portcullis with an amber rune lock (graphics/envFeatureArt,
 * stretched to the doorway width), its lock glow breathing gently while closed;
 * the older code-drawn rune band when that art is unavailable. Hidden the
 * moment the gate opens (and its shimmer paused); rebuilt per map.
 */
export class GateBarriers {
  private barriers: Barrier[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Replace the barriers with the given gates (the loaded map's gates in force). */
  build(gates: readonly ProgressionGateDef[]): void {
    this.clear();
    for (const gate of gates) {
      const w = gate.area.w * TILE_SIZE;
      const h = gate.area.h * TILE_SIZE;
      const cx = gate.area.x * TILE_SIZE + w / 2;
      const cy = gate.area.y * TILE_SIZE + h / 2;
      if (this.scene.textures.exists(GATE_SEAL_KEY)) {
        const seal = this.scene.add.image(cx, cy, GATE_SEAL_KEY).setDepth(BARRIER_DEPTH).setDisplaySize(w, GATE_SEAL_SIZE.h * (w / GATE_SEAL_SIZE.w));
        const shimmer = this.scene.tweens.add({ targets: seal, alpha: { from: 0.86, to: 1 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.barriers.push({ gate, g: seal, shimmer });
        continue;
      }
      const g = this.scene.add.graphics().setDepth(BARRIER_DEPTH).setPosition(cx, cy);
      g.fillStyle(AMBER, 0.12);
      g.fillRect(-w / 2, -h / 2 + 4, w, h - 8);
      g.lineStyle(1.5, AMBER, 0.6);
      g.lineBetween(-w / 2 + 3, -7, w / 2 - 3, -7);
      g.lineBetween(-w / 2 + 3, 7, w / 2 - 3, 7);
      g.lineStyle(1.5, RUNE, 0.9);
      for (const x of [-w / 3, 0, w / 3]) {
        g.strokePoints([new Phaser.Math.Vector2(x, -5), new Phaser.Math.Vector2(x + 5, 0), new Phaser.Math.Vector2(x, 5), new Phaser.Math.Vector2(x - 5, 0)], true);
        g.lineBetween(x - 2, 0, x + 2, 0);
      }
      const shimmer = this.scene.tweens.add({ targets: g, alpha: { from: 0.6, to: 1 }, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.barriers.push({ gate, g, shimmer });
    }
  }

  /** Show each barrier exactly while its gate is closed. */
  update(isOpen: (gate: ProgressionGateDef) => boolean): void {
    for (const b of this.barriers) {
      const closed = !isOpen(b.gate);
      if (b.g.visible === closed) continue;
      b.g.setVisible(closed);
      if (closed) b.shimmer.resume();
      else b.shimmer.pause();
    }
  }

  /** For tests / dev tools: which barriers are drawn and visible. */
  states(): { id: string; visible: boolean }[] {
    return this.barriers.map((b) => ({ id: b.gate.id, visible: b.g.visible }));
  }

  clear(): void {
    for (const b of this.barriers) {
      b.shimmer.remove();
      b.g.destroy();
    }
    this.barriers = [];
  }
}

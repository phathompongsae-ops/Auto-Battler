import Phaser from 'phaser';
import { VFX_ART, type VfxId } from '../data/vfxArt';
import { hasVfxArt } from '../graphics/vfxArt';

/** Above characters and props, like the code-drawn effects. */
export const VFX_DEPTH = 900_000;
/** Hard cap on one-shot effect sprites alive at once (a burst beyond it is skipped, never queued). */
const MAX_SPRITES = 24;

export interface VfxPlacement {
  x: number;
  y: number;
  /** Radians; the strips are drawn facing right. */
  rotation?: number;
  flipY?: boolean;
  /** Multiplies the strip's own world scale. */
  scale?: number;
}

/**
 * Bounded pool of one-shot VFX sprites, all created up front (24); sprites are
 * recycled when their animation completes; nothing is destroyed or
 * allocated per effect. Timing comes from the caller's event.
 */
export class VfxPool {
  private readonly free: Phaser.GameObjects.Sprite[] = [];
  private created = 0;

  constructor(private readonly scene: Phaser.Scene) {
    // Created once, up front (like the damage-number pool): combat never adds display objects.
    if (hasVfxArt(scene, 'hit')) while (this.created < MAX_SPRITES) this.free.push(this.make());
  }

  has(id: VfxId): boolean {
    return hasVfxArt(this.scene, id);
  }

  /** Play a one-shot strip; false when the art is missing or the pool is exhausted (caller may fall back). */
  play(id: VfxId, at: VfxPlacement): boolean {
    if (!this.has(id)) return false;
    const sprite = this.take();
    if (!sprite) return false;
    const def = VFX_ART[id];
    sprite
      .setPosition(at.x, at.y)
      .setRotation(at.rotation ?? 0)
      .setFlipY(at.flipY ?? false)
      .setScale(def.scale * (at.scale ?? 1))
      .setDepth(VFX_DEPTH)
      .setAlpha(1)
      .setVisible(true)
      .setActive(true);
    sprite.play(def.key);
    return true;
  }

  private take(): Phaser.GameObjects.Sprite | null {
    const sprite = this.free.pop();
    if (sprite) return sprite;
    if (this.created >= MAX_SPRITES) return null;
    return this.make();
  }

  private make(): Phaser.GameObjects.Sprite {
    this.created++;
    const fresh = this.scene.add.sprite(0, 0, VFX_ART.hit.key).setVisible(false).setActive(false);
    fresh.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      fresh.setVisible(false).setActive(false);
      this.free.push(fresh);
    });
    return fresh;
  }
}

const pools = new WeakMap<Phaser.Scene, VfxPool>();

/** One pool per scene, shared by every effect layer (the cap is global, not per layer). */
export function sharedVfxPool(scene: Phaser.Scene): VfxPool {
  let pool = pools.get(scene);
  if (!pool) pools.set(scene, (pool = new VfxPool(scene)));
  return pool;
}

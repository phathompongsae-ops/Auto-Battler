import Phaser from 'phaser';
import { VFX_ART, type VfxArtDef, type VfxId } from '../data/vfxArt';
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
  /** Ground effects with a measured footprint: scale so the painted footprint spans this radius (world px). */
  radius?: number;
  /** Draw order (default: above characters). Ground effects pass a depth just under the actors standing on them. */
  depth?: number;
  alpha?: number;
}

/** World scale of a strip played at a placement (its footprint fitted to `radius` when both are known). */
export function vfxScale(def: VfxArtDef, at: Pick<VfxPlacement, 'scale' | 'radius'>): number {
  const base = def.footprint && at.radius ? (2 * at.radius) / def.footprint : def.scale;
  return base * (at.scale ?? 1);
}

/** Origin (0..1) that puts the strip's anchor pixel on the placement point. */
export function vfxOrigin(def: VfxArtDef): { x: number; y: number } {
  return def.anchor ? { x: def.anchor.x / def.frameWidth, y: def.anchor.y / def.frameHeight } : { x: 0.5, y: 0.5 };
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
    const origin = vfxOrigin(def);
    sprite
      .setPosition(at.x, at.y)
      .setOrigin(origin.x, origin.y)
      .setRotation(at.rotation ?? 0)
      .setFlipY(at.flipY ?? false)
      .setScale(vfxScale(def, at))
      .setBlendMode(def.blend === 'add' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setDepth(at.depth ?? VFX_DEPTH)
      .setAlpha(at.alpha ?? 1)
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

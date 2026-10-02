import Phaser from 'phaser';
import { LOOT_KEY, PLAYER_KEY, SLIME_KEY } from '../graphics/placeholderTextures';

const PREWARM_MS = 100;
const ALPHA = 0.01;

/**
 * Compiles shader variants up front so the first fight doesn't stutter.
 *
 * Phaser 4's sprite shader is specialised by how many different textures one
 * draw batch uses. Every Text (damage numbers etc.) has its own texture, so a
 * busy fight produces batches with 2, 3, … N textures and each new count
 * compiled a shader mid-combat (measured 30–70 ms per variant, 11 variants).
 * Here we draw one group per texture count, separated by Graphics objects so
 * each group is its own batch, all in a single frame during load.
 */
export function prewarmShaders(scene: Phaser.Scene): void {
  const renderer = scene.game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;

  const { centerX: x, centerY: y } = scene.cameras.main;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject & { setAlpha(value: number): unknown }>(obj: T): T => {
    obj.setAlpha(ALPHA);
    objects.push(obj);
    return obj;
  };

  // Distinct 2×2 textures, one per texture unit.
  const units = renderer.maxTextures;
  const keys: string[] = [];
  for (let i = 0; i < units; i++) {
    const key = `__prewarm-${i}`;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, 2, 2);
      if (!tex) continue;
      tex.getContext().fillRect(0, 0, 2, 2);
      tex.refresh();
    }
    keys.push(key);
  }

  const batchBreak = () => keep(scene.add.graphics().fillStyle(0xffffff).fillRect(x, y, 1, 1).setScrollFactor(0));
  for (let count = 1; count <= keys.length; count++) {
    for (let i = 0; i < count; i++) keep(scene.add.image(x, y, keys[i]).setScrollFactor(0));
    batchBreak();
  }

  // Other first-use paths: fill-mode tint flash, stroked arcs/rings, filled shapes.
  for (const key of [PLAYER_KEY, SLIME_KEY, LOOT_KEY]) {
    const frame = scene.textures.get(key).getFrameNames()[0];
    keep(scene.add.image(x, y, key, frame).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL).setScrollFactor(0));
  }
  const g = keep(scene.add.graphics().setScrollFactor(0));
  g.lineStyle(3, 0xffffff, 1).beginPath().arc(x, y, 16, 0, 1.8).strokePath();
  const ring = keep(scene.add.circle(x, y, 10).setStrokeStyle(2, 0xffffff).setScrollFactor(0));
  ring.isFilled = false;
  keep(scene.add.circle(x, y, 6, 0xff7b2e).setStrokeStyle(2, 0xfff1a8).setScrollFactor(0));
  keep(scene.add.ellipse(x, y, 34, 14).setStrokeStyle(2, 0xff5a5a).setFillStyle(0x7fd4ff, 0.12).setScrollFactor(0));

  scene.time.delayedCall(PREWARM_MS, () => {
    for (const obj of objects) obj.destroy();
    for (const key of keys) scene.textures.remove(key);
  });
}

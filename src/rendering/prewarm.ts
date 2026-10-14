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

/** Frames between two texture warm-ups (one texture per step, never a burst). */
const WARM_STEP_FRAMES = 2;
/** Start after the first world frames have settled (boot and the HUD pre-paint come first). */
const WARM_DELAY_MS = 1200;

/**
 * Uploads textures to the GPU ahead of their first real use, gradually: one
 * texture every couple of frames, each drawn once as a 2 px image at 1%
 * opacity (WebGL uploads a texture the first time it is drawn; that upload
 * was the cold first-cast hitch of new strips). Missing keys are skipped.
 * Returns the number of textures queued.
 */
export function warmTexturesGradually(scene: Phaser.Scene, keys: readonly string[]): number {
  const renderer = scene.game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return 0;
  const queue = keys.filter((key) => scene.textures.exists(key));
  if (!queue.length) return 0;
  const probe = scene.add.image(0, 0, queue[0]).setScrollFactor(0).setDisplaySize(2, 2).setAlpha(ALPHA).setVisible(false);
  let frame = 0;
  const step = () => {
    if (frame++ % WARM_STEP_FRAMES !== 0) return;
    const key = queue.shift();
    if (!key) {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step);
      probe.destroy();
      return;
    }
    if (!scene.textures.exists(key)) return;
    const { centerX: x, centerY: y } = scene.cameras.main;
    probe.setTexture(key, 0).setPosition(x, y).setDisplaySize(2, 2).setVisible(true);
  };
  scene.time.delayedCall(WARM_DELAY_MS, () => scene.events.on(Phaser.Scenes.Events.POST_UPDATE, step));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, step));
  return queue.length;
}

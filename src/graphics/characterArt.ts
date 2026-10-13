import Phaser from 'phaser';
import { allAnimArt, idleMotionKey, type CharacterArt } from '../data/characterArt';
import { idleDisplacement, type IdlePose } from '../data/idleMotion';

/** `?art=placeholder` skips the sprite sheets and uses the canvas placeholders. */
export function characterArtDisabled(): boolean {
  return new URLSearchParams(window.location.search).get('art') === 'placeholder';
}

/** Queue every strip of a character for loading. Call from a scene's preload(). */
export function preloadCharacterArt(scene: Phaser.Scene, art: CharacterArt): void {
  for (const anim of allAnimArt(art)) {
    scene.load.spritesheet(anim.key, anim.url, { frameWidth: art.frameSize, frameHeight: art.frameSize });
  }
}

/** True when every strip loaded; otherwise callers fall back to placeholder art. */
export function isCharacterArtReady(scene: Phaser.Scene, art: CharacterArt): boolean {
  return allAnimArt(art).every((anim) => scene.textures.exists(anim.key));
}

/**
 * The game runs with `pixelArt: true` (nearest filtering). Sheets drawn at a
 * fraction of their source size alias badly that way, so they opt into linear.
 */
export function applyCharacterArtFilter(scene: Phaser.Scene, art: CharacterArt): void {
  if (!art.smooth) return;
  for (const anim of allAnimArt(art)) {
    for (const key of [anim.key, idleMotionKey(anim.key)]) {
      if (scene.textures.exists(key)) scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
}

/**
 * Bakes each strip's idle-motion poses (data/idleMotion) into a sprite sheet with the strip's own cell size, so
 * the idle can breathe without scaling or moving the sprite. Rows from the knees down are copied untouched (the
 * feet stay pixel-identical); rows above are resampled bilinearly, in premultiplied alpha so edges don't darken.
 * Runs once at boot (~1 M pixels for the Warrior). A strip that failed to load keeps its plain timed idle.
 */
export function bakeIdleMotion(scene: Phaser.Scene, art: CharacterArt): void {
  const size = art.frameSize;
  for (const anim of allAnimArt(art)) {
    const poses = anim.motion;
    const key = idleMotionKey(anim.key);
    if (!poses?.length || !scene.textures.exists(anim.key) || scene.textures.exists(key)) continue;
    const image = scene.textures.get(anim.key).getSourceImage() as CanvasImageSource & { width: number; height: number };
    const read = document.createElement('canvas');
    read.width = image.width;
    read.height = image.height;
    const rg = read.getContext('2d', { willReadFrequently: true });
    if (!rg) continue;
    rg.drawImage(image, 0, 0);
    const src = rg.getImageData(0, 0, read.width, read.height);
    const out = document.createElement('canvas');
    out.width = size * poses.length;
    out.height = size;
    const og = out.getContext('2d');
    if (!og) continue;
    const dst = og.createImageData(out.width, size);
    const feetRow = art.feetY + (anim.offsetY ?? 0);
    poses.forEach((pose, i) => bakePose(src, pose.frame * size, dst, i * size, size, feetRow, pose));
    og.putImageData(dst, 0, 0);
    scene.textures.addSpriteSheet(key, out as unknown as HTMLImageElement, { frameWidth: size, frameHeight: size });
  }
}

function bakePose(src: ImageData, sx0: number, dst: ImageData, dx0: number, size: number, feetRow: number, pose: IdlePose): void {
  const s = src.data, d = dst.data, sw = src.width, dw = dst.width;
  // Premultiplied sample of the base cell (transparent outside it).
  const px = (x: number, y: number, out: number[], w: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size || w === 0) return;
    const o = (y * sw + sx0 + x) * 4, a = s[o + 3] * w;
    out[0] += s[o] * a; out[1] += s[o + 1] * a; out[2] += s[o + 2] * a; out[3] += a;
  };
  const acc = [0, 0, 0, 0];
  for (let y = 0; y < size; y++) {
    const { dx, dy } = idleDisplacement(feetRow - y, pose);
    const row = (y * dw + dx0) * 4;
    if (dx === 0 && dy === 0) {
      const from = (y * sw + sx0) * 4;
      d.set(s.subarray(from, from + size * 4), row);
      continue;
    }
    // Destination (x, y) shows source (x - dx, y - dy).
    const fy = y - dy, y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < size; x++) {
      const fx = x - dx, x0 = Math.floor(fx), tx = fx - x0;
      acc[0] = acc[1] = acc[2] = acc[3] = 0;
      px(x0, y0, acc, (1 - tx) * (1 - ty));
      px(x0 + 1, y0, acc, tx * (1 - ty));
      px(x0, y0 + 1, acc, (1 - tx) * ty);
      px(x0 + 1, y0 + 1, acc, tx * ty);
      const o = row + x * 4, a = acc[3];
      if (a <= 0) continue;
      d[o] = acc[0] / a; d[o + 1] = acc[1] / a; d[o + 2] = acc[2] / a; d[o + 3] = Math.min(255, Math.round(a));
    }
  }
}

import Phaser from 'phaser';
import type { CombatEntity } from '../combat/types';
import type { CombatWorld } from '../game/CombatWorld';
import { telegraphIntensity, telegraphStyle } from './telegraphCurve';

/*
 * Monster danger zones (every wind-up: Bone Smash, Grave Slam, Stomp, Gore...),
 * one shared presentation: a soft red danger shadow on the ground — feathered
 * radial textures, no stroked ring — that darkens as the wind-up runs out, most
 * urgent over its last ~30%, where a soft rim firms up and gently breathes,
 * then a short flash as the hit lands.
 *
 * Progress is read from the game clock every frame (world.now since the
 * `skillWindup` event, over the wind-up's real duration), so it pauses with
 * hit-stop and can never drift from the damage; the zone ends on the first
 * frame the hit is due or the caster is no longer winding up (it landed or
 * was cancelled). Images are pooled and restyled in place: no per-frame
 * allocation.
 *
 * The player's own delayed ground strikes (Meteor Burst) use the same zone
 * anchored on their target point, in the friendly palette: arcane blue with a
 * gold rim, on the ground under every actor, so it never reads as danger.
 */

export type TelegraphPalette = 'danger' | 'friendly';

const PALETTES: Record<TelegraphPalette, { fill: number; rim: number; shade: number }> = {
  danger: { fill: 0xc8261f, rim: 0xff5a4a, shade: 0x1a0505 },
  friendly: { fill: 0x4f7dff, rim: 0xffd27a, shade: 0x0b1440 },
};
/** Friendly zones lie on the ground: above tiles and shadows, under props and every actor. */
const FRIENDLY_DEPTH = -0.55;
/** Impact flash length (after the damage tick; never delays it). */
const FLASH_MS = 140;
/** Restrained pulse over the final part of the wind-up. */
const PULSE_FROM = 0.78;

/** Feathered radial textures (white, tinted per layer), drawn once. */
export const TELEGRAPH_FIELD_KEY = 'telegraph-field';
export const TELEGRAPH_RIM_KEY = 'telegraph-rim';
const TEX = 256;

interface Shapes {
  shade: Phaser.GameObjects.Image;
  fill: Phaser.GameObjects.Image;
  core: Phaser.GameObjects.Image;
  rim: Phaser.GameObjects.Image;
}

interface Zone {
  caster: CombatEntity;
  palette: TelegraphPalette;
  x: number;
  y: number;
  radius: number;
  start: number;
  ms: number;
  shapes: Shapes;
  /** Last applied state, for tests and debugging. */
  progress: number;
  intensity: number;
}

export class Telegraphs {
  private readonly zones: Zone[] = [];
  private readonly pool: Shapes[] = [];
  private readonly onUpdate = () => this.update();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: CombatWorld,
  ) {
    createTelegraphTextures(scene);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  /**
   * A wind-up began now (game clock): its zone runs for `ms` of game time, around the caster or at `point`
   * (a ground-targeted strike), in the danger palette (monsters) or the friendly one (the player's own).
   */
  start(caster: CombatEntity, radius: number, ms: number, options: { point?: { x: number; y: number }; palette?: TelegraphPalette } = {}): void {
    const shapes = this.pool.pop() ?? this.createShapes();
    const palette = options.palette ?? 'danger';
    const at = options.point ?? caster;
    const depth = palette === 'friendly' ? FRIENDLY_DEPTH : caster.y - 1;
    const size = radius * 2;
    const colors = PALETTES[palette];
    shapes.shade.setTint(colors.shade);
    shapes.fill.setTint(colors.fill);
    shapes.core.setTint(colors.fill);
    shapes.rim.setTint(colors.rim);
    for (const s of [shapes.shade, shapes.fill, shapes.core, shapes.rim]) s.setPosition(at.x, at.y).setDisplaySize(size, size).setDepth(depth).setVisible(true);
    const zone: Zone = { caster, palette, x: at.x, y: at.y, radius, start: this.world.now, ms: Math.max(1, ms), shapes, progress: 0, intensity: telegraphIntensity(0) };
    this.zones.push(zone);
    this.apply(zone, 0);
  }

  /** Active zones (tests: progress is game-clock based; intensity rises with it). */
  states(): { casterId: string; palette: TelegraphPalette; x: number; y: number; fillTint: number; radius: number; ms: number; progress: number; intensity: number; fillAlpha: number; shadeAlpha: number; coreAlpha: number; rimAlpha: number }[] {
    return this.zones.map((z) => ({
      casterId: z.caster.id,
      palette: z.palette,
      x: z.x,
      y: z.y,
      fillTint: PALETTES[z.palette].fill,
      radius: z.radius,
      ms: z.ms,
      progress: z.progress,
      intensity: z.intensity,
      fillAlpha: z.shapes.fill.alpha,
      shadeAlpha: z.shapes.shade.alpha,
      coreAlpha: z.shapes.core.alpha,
      rimAlpha: z.shapes.rim.alpha,
    }));
  }

  private createShapes(): Shapes {
    const add = (key: string) => this.scene.add.image(0, 0, key).setAlpha(0).setData('telegraph', key === TELEGRAPH_RIM_KEY ? 'rim' : 'field');
    // Tinted per zone in start() (danger or friendly palette).
    return { shade: add(TELEGRAPH_FIELD_KEY), fill: add(TELEGRAPH_FIELD_KEY), core: add(TELEGRAPH_FIELD_KEY), rim: add(TELEGRAPH_RIM_KEY) };
  }

  private update(): void {
    const now = this.world.now;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      const p = (now - z.start) / z.ms;
      const dead = z.caster.combat.dead;
      if (p >= 1 || dead || !this.world.skills.windingUp(z.caster)) {
        this.zones.splice(i, 1);
        // Flash only when the hit really lands; a cancelled wind-up (the caster died) just disappears.
        this.land(z, p >= 1 && !dead);
        continue;
      }
      this.apply(z, p);
    }
  }

  private apply(z: Zone, p: number): void {
    const e = telegraphIntensity(p);
    // A slow breath over the final part, quickening slightly as impact nears (game clock: pauses with hit-stop).
    const pulse = p > PULSE_FROM ? 0.5 * (1 + Math.sin(this.world.now / (75 - 30 * p))) * ((p - PULSE_FROM) / (1 - PULSE_FROM)) : 0;
    const s = telegraphStyle(p, e, pulse);
    z.progress = Math.min(1, Math.max(0, p));
    z.intensity = e;
    const { shade, fill, core, rim } = z.shapes;
    const size = z.radius * 2;
    shade.setAlpha(s.shadeAlpha);
    fill.setAlpha(s.fillAlpha);
    core.setAlpha(s.coreAlpha).setDisplaySize(size * s.coreScale, size * s.coreScale);
    rim.setAlpha(s.rimAlpha);
  }

  /** The hit is due (or the wind-up was cancelled): a short flash when it lands, then the images return to the pool. */
  private land(z: Zone, landed: boolean): void {
    const shapes = z.shapes;
    const parts = [shapes.shade, shapes.fill, shapes.core, shapes.rim];
    const release = () => {
      for (const s of parts) s.setVisible(false).setAlpha(0);
      this.pool.push(shapes);
    };
    if (!landed) {
      release();
      return;
    }
    const size = z.radius * 2;
    shapes.fill.setAlpha(0.5);
    shapes.core.setDisplaySize(size, size).setAlpha(0.2);
    shapes.rim.setAlpha(0.8);
    this.scene.tweens.add({ targets: parts, alpha: 0, duration: FLASH_MS, ease: 'Quad.easeOut', onComplete: release });
  }
}

/**
 * The two feathered radial textures, white so each layer tints them:
 * - field: a soft disc, slightly denser toward its outer body, feathered to nothing at the real radius;
 * - rim: a soft glow band just inside the radius (a gaussian, never a hard line).
 */
function createTelegraphTextures(scene: Phaser.Scene): void {
  const draw = (key: string, alpha: (r: number) => number) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, TEX, TEX);
    if (!tex) return;
    const ctx = tex.getContext();
    const img = ctx.createImageData(TEX, TEX);
    const c = (TEX - 1) / 2;
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const r = Math.hypot(x - c, y - c) / (TEX / 2);
        const o = (y * TEX + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = Math.round(255 * Math.max(0, Math.min(1, alpha(r))));
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  draw(TELEGRAPH_FIELD_KEY, (r) => (r >= 1 ? 0 : (0.78 + 0.22 * smooth(0.3, 0.84, r)) * (1 - smooth(0.84, 1, r))));
  draw(TELEGRAPH_RIM_KEY, (r) => (r >= 1 ? 0 : Math.exp(-(((r - 0.9) / 0.055) ** 2))));
}

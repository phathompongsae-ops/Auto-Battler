import Phaser from 'phaser';
import type { CombatEntity } from '../combat/types';
import type { CombatWorld } from '../game/CombatWorld';
import { telegraphIntensity, telegraphStyle } from './telegraphCurve';

/*
 * Monster danger zones (every wind-up: Bone Smash, Grave Slam, Stomp, Gore...),
 * one shared presentation: a soft red ground shadow that darkens and sharpens
 * as the wind-up runs out, most urgent over its last ~30%, then a short flash
 * as the hit lands.
 *
 * Progress is read from the game clock every frame (world.now since the
 * `skillWindup` event, over the wind-up's real duration), so it pauses with
 * hit-stop and can never drift from the damage; the zone ends on the first
 * frame the hit is due or the caster is no longer winding up (it landed or
 * was cancelled). Shapes are pooled and restyled in place: no per-frame
 * allocation.
 */

const FILL = 0xd8322a;
const EDGE = 0xff4d42;
const SHADE = 0x1a0505;
/** Impact flash length (after the damage tick; never delays it). */
const FLASH_MS = 140;

interface Shapes {
  shade: Phaser.GameObjects.Arc;
  fill: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
  edge: Phaser.GameObjects.Arc;
}

interface Zone {
  caster: CombatEntity;
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
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  /** A wind-up began now (game clock): its zone runs for `ms` of game time. */
  start(caster: CombatEntity, radius: number, ms: number): void {
    const shapes = this.pool.pop() ?? this.createShapes();
    const depth = caster.y - 1;
    for (const s of [shapes.shade, shapes.fill, shapes.core, shapes.edge]) s.setPosition(caster.x, caster.y).setRadius(radius).setDepth(depth).setVisible(true).setAlpha(1);
    const zone: Zone = { caster, radius, start: this.world.now, ms: Math.max(1, ms), shapes, progress: 0, intensity: telegraphIntensity(0) };
    this.zones.push(zone);
    this.apply(zone, 0);
  }

  /** Active zones (tests: progress is game-clock based; intensity rises with it). */
  states(): { casterId: string; radius: number; ms: number; progress: number; intensity: number; fillAlpha: number; edgeAlpha: number; edgeWidth: number }[] {
    return this.zones.map((z) => ({
      casterId: z.caster.id,
      radius: z.radius,
      ms: z.ms,
      progress: z.progress,
      intensity: z.intensity,
      fillAlpha: z.shapes.fill.fillAlpha,
      edgeAlpha: z.shapes.edge.strokeAlpha,
      edgeWidth: z.shapes.edge.lineWidth,
    }));
  }

  private createShapes(): Shapes {
    const add = () => this.scene.add.circle(0, 0, 1, FILL, 0);
    return { shade: add(), fill: add(), core: add(), edge: add() };
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
        this.land(z.shapes, p >= 1 && !dead);
        continue;
      }
      this.apply(z, p);
    }
  }

  private apply(z: Zone, p: number): void {
    const e = telegraphIntensity(p);
    // Restrained pulse over the final quarter: the edge breathes slightly faster as impact nears.
    const pulse = p > 0.75 ? 0.5 * (1 + Math.sin(this.world.now / (70 - 30 * p))) * ((p - 0.75) / 0.25) : 0;
    const s = telegraphStyle(p, e, pulse);
    z.progress = Math.min(1, Math.max(0, p));
    z.intensity = e;
    const { shade, fill, core, edge } = z.shapes;
    shade.setFillStyle(SHADE, 0).setStrokeStyle(s.edgeWidth + 3, SHADE, s.shadeAlpha);
    fill.setFillStyle(FILL, s.fillAlpha).setStrokeStyle(0, FILL, 0);
    core.setFillStyle(FILL, s.coreAlpha).setScale(s.coreScale);
    edge.setFillStyle(FILL, 0).setStrokeStyle(s.edgeWidth, EDGE, s.edgeAlpha);
  }

  /** The hit is due (or the wind-up was cancelled): a short flash when it lands, then the shapes return to the pool. */
  private land(shapes: Shapes, landed: boolean): void {
    const parts = [shapes.shade, shapes.fill, shapes.core, shapes.edge];
    const release = () => {
      for (const s of parts) s.setVisible(false).setScale(1).setAlpha(1);
      this.pool.push(shapes);
    };
    if (!landed) {
      release();
      return;
    }
    shapes.fill.setFillStyle(FILL, 0.34);
    shapes.core.setScale(1);
    this.scene.tweens.add({ targets: parts, alpha: 0, duration: FLASH_MS, ease: 'Quad.easeOut', onComplete: release });
  }
}

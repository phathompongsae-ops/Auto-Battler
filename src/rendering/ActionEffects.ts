import Phaser from 'phaser';
import type { ActionVfx } from '../data/characterArt';
import { PLAYER_ACTION_HIT, type PlayerActionHit } from '../entities/Player';
import type { CombatWorld } from '../game/CombatWorld';
import type { Direction } from '../input/Direction';
import { bodyCenterY } from './characterLayout';

const EFFECT_DEPTH = 900_000;

const FACING_ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * Data-driven action VFX (see ActionVfx in characterArt): a slash arc and
 * an afterimage on the animation's hit frame, an impact flash on the target
 * when the hit's damage lands. Hit stop and shake stay with CombatEffects.
 */
export class ActionEffects {
  constructor(
    private readonly scene: Phaser.Scene,
    world: CombatWorld,
  ) {
    const player = world.player;
    player.on(PLAYER_ACTION_HIT, ({ action, direction }: PlayerActionHit) => {
      const vfx = player.actionVfx(action, direction);
      if (!vfx) return;
      if (vfx.arc) this.arc(player.x, player.y + bodyCenterY(player.layout), direction, vfx.arc);
      if (vfx.afterimage) this.afterimage(player, vfx.afterimage);
    });

    world.events.on('damage', ({ sourceId, targetId, skillId }) => {
      if (sourceId !== player.id) return;
      const impact = player.skillVfx(skillId)?.impact;
      const target = world.getEntity(targetId);
      if (impact && target) this.impact(target.x, target.y, impact);
    });
  }

  /** A crescent that sweeps across the facing, then fades. */
  private arc(x: number, y: number, facing: Direction, arc: NonNullable<ActionVfx['arc']>): void {
    const centre = FACING_ANGLE[facing];
    const half = Phaser.Math.DegToRad(arc.sweepDeg) / 2;
    const ox = x + Math.cos(centre) * arc.reach;
    const oy = y + Math.sin(centre) * arc.reach;
    const g = this.scene.add.graphics().setDepth(EFFECT_DEPTH).setPosition(ox, oy);
    const state = { t: 0 };
    const draw = () => {
      const sweep = Phaser.Math.Easing.Cubic.Out(Math.min(1, state.t / 0.6));
      const fade = state.t < 0.5 ? 1 : 1 - (state.t - 0.5) / 0.5;
      const start = centre + half;
      const end = start - half * 2 * sweep;
      g.clear();
      g.lineStyle(arc.thickness, arc.color, 0.85 * fade);
      g.beginPath();
      g.arc(0, 0, arc.radius, start, end, true);
      g.strokePath();
      g.lineStyle(Math.max(1, arc.thickness * 0.35), 0xffffff, fade);
      g.beginPath();
      g.arc(0, 0, arc.radius - arc.thickness * 0.15, start, end, true);
      g.strokePath();
    };
    draw();
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: arc.durationMs,
      onUpdate: draw,
      onComplete: () => g.destroy(),
    });
  }

  /** Bright burst on the target. */
  private impact(x: number, y: number, impact: NonNullable<ActionVfx['impact']>): void {
    const flash = this.scene.add.circle(x, y, impact.radius * 0.5, impact.color, 0.9).setDepth(EFFECT_DEPTH);
    const ring = this.scene.add.circle(x, y, impact.radius * 0.6).setStrokeStyle(2, impact.color).setDepth(EFFECT_DEPTH);
    ring.isFilled = false;
    this.scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: impact.durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
    this.scene.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: impact.durationMs * 1.4,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Additive, tinted copy of the current pose that fades out: a short sword trail. */
  private afterimage(
    sprite: Phaser.GameObjects.Sprite,
    after: NonNullable<ActionVfx['afterimage']>,
  ): void {
    const ghost = this.scene.add
      .image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scaleX, sprite.scaleY)
      .setFlipX(sprite.flipX)
      .setTint(after.color)
      .setTintMode(Phaser.TintModes.FILL)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(after.alpha)
      .setDepth(sprite.depth - 0.5);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: sprite.scaleX * 1.08,
      scaleY: sprite.scaleY * 1.08,
      duration: after.durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy(),
    });
  }
}

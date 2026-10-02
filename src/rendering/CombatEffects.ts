import Phaser from 'phaser';
import type { SkillFailReason } from '../combat/SkillSystem';
import type { CombatEntity } from '../combat/types';
import type { SkillDef } from '../data/skillData';
import type { CombatWorld } from '../game/CombatWorld';
import { FloatingText } from './FloatingText';

/** A view that can flash when hit. Player and Monster both implement it. */
interface FlashableView {
  setTint(color: number): unknown;
  setTintMode(mode: Phaser.TintModes): unknown;
  resetTint(): void;
}

const FLASH_MS = 70;
const HIT_STOP_MS = 55;
const SHAKE = { duration: 110, intensity: 0.004 };
const EFFECT_DEPTH = 900_000;

const FAIL_MESSAGES: Record<SkillFailReason, string> = {
  dead: '',
  cooldown: 'Not ready',
  no_target: 'No target',
  out_of_range: 'Out of range',
  no_mp: 'Not enough MP',
};

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Lightweight combat feedback driven entirely by simulation events:
 * hit flash, damage numbers, slashes, shake, hit stop, level-up, pickups.
 */
export class CombatEffects {
  private readonly text: FloatingText;
  private hitStopUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    world: CombatWorld,
  ) {
    this.text = new FloatingText(scene);
    const ev = world.events;

    ev.on('damage', ({ source, target, amount, crit, heavy, skill }) => {
      this.flash(target);
      const isPlayer = target === world.player;
      this.text.show(target.x, target.y - 16, crit ? `${amount}!` : `${amount}`, {
        color: isPlayer ? '#ff6b6b' : crit ? '#ffd166' : '#ffffff',
        size: crit ? 20 : heavy ? 17 : 14,
      });
      if (skill.effect.kind === 'damage') this.slash(source, target, skill, heavy);
      if (heavy) {
        this.scene.cameras.main.shake(SHAKE.duration, SHAKE.intensity);
        this.hitStop();
      }
    });

    ev.on('heal', ({ target, amount }) => {
      if (amount > 0) this.text.show(target.x, target.y - 16, `+${amount}`, { color: '#7ee787' });
    });

    ev.on('skillFailed', ({ caster, reason }) => {
      if (caster !== world.player || !FAIL_MESSAGES[reason]) return;
      this.text.show(caster.x, caster.y - 22, FAIL_MESSAGES[reason], { color: '#c9d1e3', size: 12, rise: 14 });
    });

    ev.on('expGained', ({ entity, amount }) => {
      this.text.show(entity.x, entity.y - 30, `+${amount} EXP`, { color: '#c39bff', size: 13, duration: 1000 });
    });

    ev.on('levelUp', ({ entity, level }) => {
      this.text.show(entity.x, entity.y - 40, `LEVEL UP! Lv.${level}`, {
        color: '#ffe066',
        size: 18,
        rise: 40,
        duration: 1600,
      });
      this.ring(entity.x, entity.y, 0xffe066, 48, 500);
    });

    ev.on('lootPicked', ({ drop, by }) => {
      this.text.show(by.x, by.y - 30, `+1 ${drop.item.name}`, { color: hex(drop.item.color), size: 13 });
    });

    ev.on('statusApplied', ({ target, status }) => {
      this.ring(target.x, target.y, status.color, 30, 350);
    });

    ev.on('projectileRemoved', ({ projectile, reason }) => {
      if (reason !== 'expired') this.ring(projectile.x, projectile.y, projectile.color, 16, 220);
    });

    ev.on('death', ({ entity }) => {
      if (entity === world.player) {
        this.text.show(entity.x, entity.y - 24, 'You were defeated', { color: '#ff6b6b', size: 16, duration: 2500, rise: 10 });
      }
    });
  }

  private flash(target: CombatEntity): void {
    const view = target as unknown as FlashableView;
    view.setTint(0xffffff);
    view.setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(FLASH_MS, () => view.resetTint());
  }

  /** Brief freeze of physics on strong hits. Simulation timers keep running. */
  private hitStop(): void {
    const physics = this.scene.physics.world;
    const until = this.scene.time.now + HIT_STOP_MS;
    if (until <= this.hitStopUntil) return;
    this.hitStopUntil = until;
    physics.pause();
    this.scene.time.delayedCall(HIT_STOP_MS, () => {
      if (this.scene.time.now >= this.hitStopUntil - 1) physics.resume();
    });
  }

  /** Short arc from the attacker toward the target. */
  private slash(source: CombatEntity, target: CombatEntity, skill: SkillDef, heavy: boolean): void {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const radius = heavy ? 22 : 16;
    const g = this.scene.add.graphics().setDepth(EFFECT_DEPTH);
    g.lineStyle(heavy ? 4 : 3, skill.color ?? 0xffffff, 1);
    g.beginPath();
    g.arc(0, 0, radius, angle - 0.9, angle + 0.9);
    g.strokePath();
    g.setPosition(source.x + Math.cos(angle) * 6, source.y + Math.sin(angle) * 6);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scale: 1.3,
      duration: heavy ? 220 : 150,
      onComplete: () => g.destroy(),
    });
  }

  private ring(x: number, y: number, color: number, radius: number, duration: number): void {
    const ring = this.scene.add.circle(x, y, radius * 0.4).setStrokeStyle(2, color).setDepth(EFFECT_DEPTH);
    ring.isFilled = false;
    this.scene.tweens.add({
      targets: ring,
      scale: 2.5,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}

import Phaser from 'phaser';
import type { SkillFailReason } from '../combat/SkillSystem';
import type { CombatEntity } from '../combat/types';
import { ITEMS } from '../data/itemData';
import { SKILLS } from '../data/skillData';
import { STATUSES } from '../data/statusData';
import type { CombatWorld } from '../game/CombatWorld';
import { bodyCenterY, textAnchorY } from './characterLayout';
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
  not_learned: 'Not learned',
};

/** Bottom of monster floating text, relative to the monster position. */
const MONSTER_TEXT_ANCHOR_Y = -16;

/** How far above an entity's text anchor each kind of message starts. */
const TEXT_LIFT = { damage: 0, heal: 0, fail: 6, death: 8, exp: 14, loot: 14, levelUp: 24 } as const;
type TextKind = keyof typeof TEXT_LIFT;

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Lightweight combat feedback driven entirely by simulation events:
 * hit flash, damage numbers, slashes, shake, hit stop, level-up, pickups.
 * Events carry ids; entities are looked up in the world only for positions.
 */
export class CombatEffects {
  private readonly text: FloatingText;

  constructor(
    private readonly scene: Phaser.Scene,
    world: CombatWorld,
  ) {
    this.text = new FloatingText(scene);
    const ev = world.events;
    const isPlayer = (id: string | null) => id === world.player.id;
    // The player's art sets where its text and body-centred effects go; monsters keep fixed offsets.
    const textY = (e: CombatEntity, kind: TextKind) =>
      e.y + (e === world.player ? textAnchorY(world.player.layout) : MONSTER_TEXT_ANCHOR_Y) - TEXT_LIFT[kind];
    const centerY = (e: CombatEntity) => e.y + (e === world.player ? bodyCenterY(world.player.layout) : 0);

    ev.on('damage', ({ sourceId, targetId, skillId, amount, crit, heavy }) => {
      const target = world.getEntity(targetId);
      if (!target) return;
      this.flash(target);
      this.text.show(target.x, textY(target, 'damage'), crit ? `${amount}!` : `${amount}`, {
        color: isPlayer(targetId) ? '#ff6b6b' : crit ? '#ffd166' : '#ffffff',
        size: crit ? 20 : heavy ? 17 : 14,
      });
      const source = world.getEntity(sourceId);
      const skill = SKILLS[skillId];
      // Player skills with their own action VFX (e.g. Power Slash) draw their arc on the hit frame instead.
      const ownArc = source === world.player && !!world.player.skillVfx(skillId)?.arc;
      if (source && skill.effect.kind === 'damage' && !ownArc) this.slash(source, target, skill.color ?? 0xffffff, heavy);
      if (heavy) {
        this.scene.cameras.main.shake(SHAKE.duration, SHAKE.intensity);
        world.requestHitStop(HIT_STOP_MS);
      }
    });

    ev.on('miss', ({ targetId }) => {
      const target = world.getEntity(targetId);
      if (target) this.text.show(target.x, textY(target, 'damage'), 'Miss', { color: '#c9d1e3', size: 13 });
    });

    ev.on('heal', ({ targetId, amount }) => {
      const target = world.getEntity(targetId);
      if (target && amount > 0) this.text.show(target.x, textY(target, 'heal'), `+${amount}`, { color: '#7ee787' });
    });

    ev.on('skillFailed', ({ casterId, reason }) => {
      if (!isPlayer(casterId) || !FAIL_MESSAGES[reason]) return;
      const p = world.player;
      this.text.show(p.x, textY(p, 'fail'), FAIL_MESSAGES[reason], { color: '#c9d1e3', size: 12, rise: 14 });
    });

    ev.on('expGained', ({ entityId, amount }) => {
      const e = world.getEntity(entityId);
      if (e) this.text.show(e.x, textY(e, 'exp'), `+${amount} EXP`, { color: '#c39bff', size: 13, duration: 1000 });
    });

    // TEMPORARY unlock toast; quiet for unlocks restored on load / migration.
    ev.on('featureUnlocked', ({ displayName, restored }) => {
      const p = world.player;
      if (!restored) this.text.show(p.x, textY(p, 'levelUp') - 22, `${displayName} Unlocked!`, { color: '#7fd4ff', size: 15, rise: 30, duration: 2200 });
    });

    ev.on('levelUp', ({ entityId, level }) => {
      const e = world.getEntity(entityId);
      if (!e) return;
      this.text.show(e.x, textY(e, 'levelUp'), `LEVEL UP! Lv.${level}`, { color: '#ffe066', size: 18, rise: 40, duration: 1600 });
      this.ring(e.x, centerY(e), 0xffe066, 48, 500);
    });

    ev.on('lootPicked', ({ itemId, byId }) => {
      const by = world.getEntity(byId);
      const item = ITEMS[itemId];
      if (by) this.text.show(by.x, textY(by, 'loot'), `+1 ${item.name}`, { color: hex(item.color), size: 13 });
    });

    // TEMPORARY VFX for area skills without art (Whirlwind, Provoke): a ring showing their real radius.
    ev.on('skillUsed', ({ casterId, skillId }) => {
      const caster = world.getEntity(casterId);
      const skill = caster && world.skills.definition(caster, skillId);
      const e = skill?.effect;
      if (caster && skill && e && (e.kind === 'aoe_damage' || e.kind === 'taunt')) this.ring(caster.x, centerY(caster), skill.color ?? 0xffffff, e.radius, 300);
    });

    ev.on('statusApplied', ({ targetId, statusId }) => {
      const target = world.getEntity(targetId);
      if (target) this.ring(target.x, centerY(target), STATUSES[statusId].color, 30, 350);
    });

    ev.on('projectileRemoved', ({ x, y, color, reason }) => {
      if (reason !== 'expired') this.ring(x, y, color, 16, 220);
    });

    ev.on('death', ({ entityId }) => {
      if (!isPlayer(entityId)) return;
      const p = world.player;
      this.text.show(p.x, textY(p, 'death'), 'You were defeated', { color: '#ff6b6b', size: 16, duration: 2500, rise: 10 });
    });
  }

  private flash(target: CombatEntity): void {
    const view = target as unknown as FlashableView;
    view.setTint(0xffffff);
    view.setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(FLASH_MS, () => view.resetTint());
  }

  /** Short arc from the attacker toward the target. */
  private slash(source: CombatEntity, target: CombatEntity, color: number, heavy: boolean): void {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const radius = heavy ? 22 : 16;
    const g = this.scene.add.graphics().setDepth(EFFECT_DEPTH);
    g.lineStyle(heavy ? 4 : 3, color, 1);
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

import Phaser from 'phaser';
import type { SkillFailReason } from '../combat/SkillSystem';
import type { CombatEntity } from '../combat/types';
import { ITEMS } from '../data/itemData';
import { SKILLS } from '../data/skillData';
import { SKILL_VFX } from '../data/skillVfx';
import { STATUSES } from '../data/statusData';
import type { CombatWorld } from '../game/CombatWorld';
import { bodyCenterY, textAnchorY } from './characterLayout';
import { COMBAT_NUMBER_STYLES, damageKind, NumberSlots, type CombatNumberKind } from './damageNumbers';
import { FloatingText } from './FloatingText';
import { t, type StringKey } from '../ui/i18n';
import { sharedVfxPool, type VfxPool } from './VfxPool';
import { Telegraphs } from './Telegraphs';

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

/** Skill-failure notes by string key ('' = say nothing). */
const FAIL_MESSAGES: Record<SkillFailReason, StringKey | ''> = {
  dead: '',
  cooldown: 'fail.cooldown',
  no_target: 'fail.no_target',
  out_of_range: 'fail.out_of_range',
  no_mp: 'fail.no_mp',
  not_learned: 'fail.not_learned',
};

/** Bottom of monster floating text, relative to the monster position. */
const MONSTER_TEXT_ANCHOR_Y = -16;

/** How far above an entity's text anchor each kind of message starts. */
const TEXT_LIFT = { damage: 0, heal: 0, fail: 6, death: 8, exp: 14, loot: 14, levelUp: 24 } as const;
type TextKind = keyof typeof TEXT_LIFT;

/** Extra px a critical number starts above its slot. */
const CRIT_EXTRA_LIFT = 6;

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Lightweight combat feedback driven entirely by simulation events:
 * hit flash, damage numbers, slashes, shake, hit stop, level-up, pickups.
 * Events carry ids; entities are looked up in the world only for positions.
 */
export class CombatEffects {
  private readonly text: FloatingText;
  /** Target-local start offsets so rapid hits on one target fan out instead of stacking on one point. */
  private readonly slots = new NumberSlots();
  /** Pooled production strips (slash, impacts); missing art falls back to the code-drawn effects. */
  private readonly vfx: VfxPool;
  private readonly telegraphs: Telegraphs;

  constructor(
    private readonly scene: Phaser.Scene,
    world: CombatWorld,
  ) {
    this.text = new FloatingText(scene);
    this.vfx = sharedVfxPool(scene);
    this.telegraphs = new Telegraphs(scene, world);
    const ev = world.events;
    const isPlayer = (id: string | null) => id === world.player.id;
    // The player's art sets where its text and body-centred effects go; monsters keep fixed offsets.
    const textY = (e: CombatEntity, kind: TextKind) =>
      e.y + (e === world.player ? textAnchorY(world.player.layout) : MONSTER_TEXT_ANCHOR_Y) - TEXT_LIFT[kind];
    const centerY = (e: CombatEntity) => e.y + (e === world.player ? bodyCenterY(world.player.layout) : 0);
    /** A combat number (damage / heal / miss) in its style, at the target's next slot. */
    const number = (target: CombatEntity, kind: CombatNumberKind, value: string, lift: TextKind) => {
      const at = this.slots.next(target.id, world.now);
      // Bigger critical numbers start a little higher so a hit landing with them stays readable underneath.
      const critLift = kind === 'crit' || kind === 'player_crit' ? CRIT_EXTRA_LIFT : 0;
      this.text.show(target.x + at.dx, textY(target, lift) + at.dy - critLift, value, COMBAT_NUMBER_STYLES[kind]);
    };

    ev.on('damage', ({ sourceId, targetId, skillId, amount, crit, heavy, delivery }) => {
      const target = world.getEntity(targetId);
      if (!target) return;
      const dot = delivery === 'dot';
      // A Burn tick is quiet: its small ember number and the body tint, no white flash or impact.
      if (!dot) this.flash(target);
      // Crits keep a trailing "!" as a non-colour cue next to their size and colour.
      number(target, damageKind({ targetIsPlayer: isPlayer(targetId), crit, heavy, dot }), crit ? `${amount}!` : `${amount}`, 'damage');
      if (dot) return;
      const source = world.getEntity(sourceId);
      const skill = SKILLS[skillId];
      // Player skills with their own action VFX (e.g. Power Slash) draw their arc on the hit frame instead.
      const ownVfx = source === world.player ? world.player.skillVfx(skillId) : undefined;
      const ownArc = !!ownVfx?.arc;
      if (source && skill.effect.kind === 'damage' && !ownArc) this.slash(source, target, skill.color ?? 0xffffff, heavy, source === world.player);
      // Production impact strips for the player's hits (skills with their own impact keep it; see ActionEffects).
      if (source === world.player && !ownVfx?.impact) {
        const art = SKILL_VFX[skillId];
        if (art?.impact && delivery !== 'splash') this.vfx.play(art.impact.vfx, { x: target.x, y: target.y - 2, scale: art.impact.scale });
        // Area spells show their own burst where they land (SpellEffects); untextured projectiles show only their ring.
        else if (!art?.area && !art?.zone && !art?.impact && skill.effect.kind !== 'projectile') this.vfx.play(heavy ? 'heavy_hit' : 'hit', { x: target.x, y: target.y - 2 });
      }
      if (heavy) {
        this.scene.cameras.main.shake(SHAKE.duration, SHAKE.intensity);
        world.requestHitStop(HIT_STOP_MS);
      }
    });

    ev.on('miss', ({ targetId }) => {
      const target = world.getEntity(targetId);
      if (target) number(target, 'miss', 'Miss', 'damage');
    });

    ev.on('mpRestored', ({ targetId, amount }) => {
      const target = world.getEntity(targetId);
      if (target && amount > 0) this.text.show(target.x, textY(target, 'heal'), '+' + amount + ' MP', { ...COMBAT_NUMBER_STYLES.heal, color: '#7fd4ff' });
    });

    ev.on('heal', ({ targetId, amount }) => {
      const target = world.getEntity(targetId);
      if (target && amount > 0) number(target, 'heal', `+${amount}`, 'heal');
    });

    ev.on('skillFailed', ({ casterId, reason }) => {
      if (!isPlayer(casterId) || !FAIL_MESSAGES[reason]) return;
      const p = world.player;
      this.text.show(p.x, textY(p, 'fail'), t(FAIL_MESSAGES[reason]), { color: '#c9d1e3', size: 12, rise: 14 });
    });

    ev.on('expGained', ({ entityId, amount }) => {
      const e = world.getEntity(entityId);
      if (e) this.text.show(e.x, textY(e, 'exp'), `+${amount} EXP`, { color: '#c39bff', size: 13, duration: 1000 });
    });

    // TEMPORARY unlock toast; quiet for unlocks restored on load / migration.
    ev.on('featureUnlocked', ({ displayName, restored }) => {
      const p = world.player;
      if (!restored) this.text.show(p.x, textY(p, 'levelUp') - 22, t('notice.featureUnlocked', { feature: displayName }), { color: '#7fd4ff', size: 15, rise: 30, duration: 2200 });
    });

    ev.on('levelUp', ({ entityId, level }) => {
      const e = world.getEntity(entityId);
      if (!e) return;
      this.text.show(e.x, textY(e, 'levelUp'), t('notice.levelUp', { level }), { color: '#ffe066', size: 18, rise: 40, duration: 1600 });
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
      if (SKILL_VFX[skillId]?.area) return; // drawn where it lands (SpellEffects)
      if (caster && skill && e && (e.kind === 'aoe_damage' || e.kind === 'taunt')) this.ring(caster.x, centerY(caster), skill.color ?? 0xffffff, e.radius, 300);
    });

    ev.on('statusApplied', ({ targetId, statusId }) => {
      const target = world.getEntity(targetId);
      const def = STATUSES[statusId];
      // Slow / Burn show as a body tint instead (a zone re-applies them every tick: no ring spam).
      if (target && !def.slow && !def.dot) this.ring(target.x, centerY(target), def.color, 30, 350);
    });

    ev.on('projectileRemoved', ({ x, y, color, reason }) => {
      if (reason !== 'expired') this.ring(x, y, color, 16, 220);
    });

    ev.on('death', ({ entityId }) => {
      if (!isPlayer(entityId)) return;
      const p = world.player;
      this.text.show(p.x, textY(p, 'death'), t('notice.defeated'), { color: '#ff6b6b', size: 16, duration: 2500, rise: 10 });
    });

    // Telegraphs: a monster's wind-up shows where its hit will land, filling up until it does.
    ev.on('skillWindup', ({ casterId, targetId, radius, ms }) => {
      const caster = world.getEntity(casterId);
      if (!caster || caster === world.player) return;
      const target = targetId ? world.getEntity(targetId) : null;
      // Area: the real radius around the caster. Single target: the caster's reach toward the target.
      const r = radius ?? (target ? Math.hypot(target.x - caster.x, target.y - caster.y) + target.hitRadius : 40);
      this.telegraph(caster, r, ms);
    });

    ev.on('goldGained', ({ entityId, amount }) => {
      const e = world.getEntity(entityId);
      if (e) this.text.show(e.x + 18, textY(e, 'loot'), `+${amount} G`, { color: '#ffd166', size: 13, duration: 1000 });
    });

    ev.on('monsterEnraged', ({ entityId }) => {
      const m = world.getEntity(entityId);
      if (!m) return;
      this.text.show(m.x, textY(m, 'levelUp') - 20, t('notice.enraged'), { color: '#ff4d4d', size: 16, rise: 24, duration: 1400 });
      this.ring(m.x, m.y, 0xff4d4d, 60, 500);
    });

    ev.on('questClaimed', ({ questId }) => {
      const def = world.quests.defs[questId];
      if (!def || def.repeat) return;
      const p = world.player;
      this.text.show(p.x, textY(p, 'levelUp') - 30, t('notice.questComplete', { quest: def.title }), { color: '#ffe066', size: 16, rise: 36, duration: 2400 });
      this.ring(p.x, centerY(p), 0xffe066, 56, 600);
    });

    // A checkpoint became the retry point (fires once per checkpoint per attempt): one cool-blue pulse and a
    // short line, then nothing stays behind. Not green and no sparkle: it restores nothing.
    ev.on('checkpointReached', () => {
      const p = world.player;
      this.ring(p.x, centerY(p), 0x9fd8ff, 44, 650);
      this.text.show(p.x, textY(p, 'levelUp') - 8, t('notice.retryPoint'), { color: '#bfe6ff', size: 13, rise: 18, duration: 1500 });
    });

    ev.on('bossDefeated', ({ entityId, claimed, runId }) => {
      const p = world.player;
      // A Story clear has no dungeon run: it is a victory (the Story reward comes from the quest turn-in), never "no reward".
      const boss = world.monsterById(entityId)?.def.name || 'Boss';
      const message = !runId && world.encounterProfile === 'story'
        ? t('notice.bossStoryCleared', { boss: boss.toUpperCase() })
        : t(claimed ? 'notice.bossClaimed' : runId ? 'notice.bossNoReward' : 'notice.bossNoRun');
      this.text.show(p.x, textY(p, 'levelUp') - 30, message, { color: '#ffe066', size: 18, rise: 36, duration: 2600 });
    });
  }

  /** A danger zone around a winding-up monster: the shared progressive telegraph (rendering/Telegraphs.ts). */
  private telegraph(caster: CombatEntity, radius: number, ms: number): void {
    this.telegraphs.start(caster, radius, ms);
  }

  /** Active danger zones (tests / debug). */
  telegraphStates() {
    return this.telegraphs.states();
  }

  /** The shared telegraph layer (the player's friendly ground warnings use it too). */
  get telegraphLayer(): Telegraphs {
    return this.telegraphs;
  }

  private flash(target: CombatEntity): void {
    const view = target as unknown as FlashableView;
    view.setTint(0xffffff);
    view.setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(FLASH_MS, () => view.resetTint());
  }

  /** Short arc from the attacker toward the target: the production slash strip for the player, a code arc for monsters. */
  private slash(source: CombatEntity, target: CombatEntity, color: number, heavy: boolean, byPlayer = false): void {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    if (byPlayer) {
      // Mirrored when swinging left so the crescent always opens away from the hero, never upside down.
      const left = Math.abs(angle) > Math.PI / 2;
      const placed = this.vfx.play('slash', {
        x: source.x + Math.cos(angle) * 14,
        y: source.y + Math.sin(angle) * 14 - 4,
        rotation: angle,
        flipY: left,
        scale: heavy ? 1.25 : 1,
      });
      if (placed) return;
    }
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

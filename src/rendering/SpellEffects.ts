import Phaser from 'phaser';
import type { CombatEntity } from '../combat/types';
import { SKILLS, type SkillId } from '../data/skillData';
import { SKILL_VFX } from '../data/skillVfx';
import { VFX_ART, type VfxId } from '../data/vfxArt';
import type { CombatWorld } from '../game/CombatWorld';
import { hasVfxArt } from '../graphics/vfxArt';
import { TELEGRAPH_FIELD_KEY, type Telegraphs } from './Telegraphs';
import { sharedVfxPool, vfxOrigin, vfxScale, VFX_DEPTH, type VfxPool } from './VfxPool';

/*
 * Spell presentation (Mage): the strips in data/skillVfx.ts, each started by a
 * simulation event and timed on the game clock (so hit stop pauses it).
 *   areaLanded   -> the area's burst strip, fitted to its real radius (code ring without art).
 *   skillWindup  -> a friendly point telegraph for the player's delayed strikes (Meteor), and the
 *                   falling strip timed to end exactly as the strike lands.
 *   zoneStarted  -> a soft ground field + the looping storm strip, both at the real radius and both on
 *                   the ground layer (under every actor, so monsters inside stay readable); faded out on zoneEnded.
 *   projectile hit with a splash -> a thin ring at the splash radius.
 *   Burn / Slow  -> a restrained body tint (Burn: a slow ember flicker; Slow: frosty blue).
 * Zone visuals are pre-made and pooled (never more than the zone cap); one-shot strips use the shared VFX pool.
 */

/** Ground layer: above tiles and contact shadows, under ground props and every actor. */
const FIELD_DEPTH = -0.62;
const STORM_DEPTH = -0.45;
const ZONE_FIELD_ALPHA = 0.32;
const ZONE_STORM_ALPHA = 0.8;
const ZONE_FADE_MS = 220;
/** Zone views made up front (the simulation caps live zones at 8). */
const ZONE_VIEWS = 8;
const EFFECT_DEPTH = 900_000;

const SLOW_TINT = 0xa9d6ff;
const BURN_TINTS = [0xffb98a, 0xffd2b0] as const;
/** Burn flicker period (game ms per tint). */
const BURN_FLICKER_MS = 160;

interface ZoneView {
  field: Phaser.GameObjects.Image;
  storm: Phaser.GameObjects.Sprite | null;
}

interface PendingFall {
  caster: CombatEntity;
  vfx: VfxId;
  x: number;
  y: number;
  radius: number;
  /** Game time to start the fall so it ends as the strike lands. */
  at: number;
}

export class SpellEffects {
  private readonly vfx: VfxPool;
  private readonly zoneViews = new Map<number, ZoneView>();
  private readonly freeZoneViews: ZoneView[] = [];
  private readonly falls: PendingFall[] = [];
  private readonly onUpdate = () => this.update();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: CombatWorld,
    private readonly telegraphs: Telegraphs,
  ) {
    this.vfx = sharedVfxPool(scene);
    for (let i = 0; i < ZONE_VIEWS; i++) this.freeZoneViews.push(this.makeZoneView());
    const ev = world.events;

    ev.on('areaLanded', ({ casterId, skillId, x, y, radius }) => {
      const area = SKILL_VFX[skillId]?.area;
      if (!area || casterId !== world.player.id) return;
      // Ground bursts sit in the world (sorted just above the actors standing in them); flames rise over them briefly.
      const played = this.vfx.play(area.vfx, { x, y, radius, depth: EFFECT_DEPTH });
      if (!played) this.ring(x, y, SKILLS[skillId].color ?? 0xffffff, radius, 360);
      if (skillId === 'meteor_burst') this.scene.cameras.main.shake(220, 0.007);
    });

    ev.on('skillWindup', ({ casterId, skillId, radius, ms, x, y }) => {
      const caster = world.getEntity(casterId);
      if (!caster || caster !== world.player || x === undefined || y === undefined || radius === null) return;
      if (SKILLS[skillId].friendlyTelegraph) this.telegraphs.start(caster, radius, ms, { point: { x, y }, palette: 'friendly' });
      const fall = SKILL_VFX[skillId]?.fall;
      const fallMs = fall ? (VFX_ART[fall.vfx].durationMs ?? 0) : 0;
      if (fall) this.falls.push({ caster, vfx: fall.vfx, x, y, radius, at: world.now + Math.max(0, ms - fallMs) });
    });

    ev.on('zoneStarted', ({ zoneId, skillId, x, y, radius }) => this.startZone(zoneId, skillId, x, y, radius));
    ev.on('zoneEnded', ({ zoneId }) => this.endZone(zoneId));

    ev.on('projectileRemoved', ({ skillId, reason, x, y }) => {
      const color = SKILL_VFX[skillId]?.splashColor;
      if (reason !== 'hit' || color === undefined) return;
      const def = world.skills.definition(world.player, skillId);
      const splash = def?.effect.kind === 'projectile' ? def.effect.splash : undefined;
      if (splash && splash.radius > 0) this.ring(x, y, color, splash.radius, 260);
    });

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate));
  }

  /** Live zone visuals (tests / debug). */
  zoneStates(): { zoneId: number; x: number; y: number; displayWidth: number; fieldAlpha: number; stormAlpha: number; stormDepth: number; hasArt: boolean }[] {
    return [...this.zoneViews].map(([zoneId, v]) => ({
      zoneId,
      x: v.field.x,
      y: v.field.y,
      displayWidth: v.field.displayWidth,
      fieldAlpha: v.field.alpha,
      stormAlpha: v.storm?.alpha ?? 0,
      stormDepth: v.storm?.depth ?? 0,
      hasArt: !!v.storm,
    }));
  }

  private update(): void {
    const now = this.world.now;
    for (let i = this.falls.length - 1; i >= 0; i--) {
      const f = this.falls[i];
      if (f.caster.combat.dead) {
        this.falls.splice(i, 1);
        continue;
      }
      if (f.at > now) continue;
      this.falls.splice(i, 1);
      // Scaled with the impact so the rock lands on its footprint.
      this.vfx.play(f.vfx, { x: f.x, y: f.y, depth: EFFECT_DEPTH });
    }
    this.tintStatuses(now);
  }

  /** Burn / Slow on monster bodies: one tint per state, written only when it changes. */
  private tintStatuses(now: number): void {
    for (const m of this.world.monsters) {
      let tint: number | null = null;
      if (!m.combat.dead) {
        let burning = false;
        let slowed = false;
        for (const s of m.combat.statuses) {
          if (s.def.dot) burning = true;
          if (s.def.slow) slowed = true;
        }
        if (burning) tint = BURN_TINTS[Math.floor(now / BURN_FLICKER_MS) % 2];
        else if (slowed) tint = SLOW_TINT;
      }
      m.setStatusTint(tint);
    }
  }

  private makeZoneView(): ZoneView {
    const field = this.scene.add.image(0, 0, TELEGRAPH_FIELD_KEY).setDepth(FIELD_DEPTH).setVisible(false).setAlpha(0);
    const id: VfxId = 'frost_storm';
    const storm = hasVfxArt(this.scene, id)
      ? this.scene.add.sprite(0, 0, VFX_ART[id].key).setBlendMode(VFX_ART[id].blend === 'add' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL).setDepth(STORM_DEPTH).setVisible(false)
      : null;
    return { field, storm };
  }

  private startZone(zoneId: number, skillId: SkillId, x: number, y: number, radius: number): void {
    const art = SKILL_VFX[skillId]?.zone;
    if (!art) return;
    const view = this.freeZoneViews.pop() ?? this.makeZoneView();
    this.scene.tweens.killTweensOf([view.field, ...(view.storm ? [view.storm] : [])]);
    view.field.setPosition(x, y).setDisplaySize(radius * 2, radius * 2).setTint(art.field).setAlpha(ZONE_FIELD_ALPHA).setVisible(true);
    if (view.storm && hasVfxArt(this.scene, art.vfx)) {
      const def = VFX_ART[art.vfx];
      const origin = vfxOrigin(def);
      view.storm.setTexture(def.key).setOrigin(origin.x, origin.y).setPosition(x, y).setScale(vfxScale(def, { radius })).setAlpha(ZONE_STORM_ALPHA).setVisible(true).play(def.key);
    } else {
      this.ring(x, y, art.field, radius, 400);
    }
    this.zoneViews.set(zoneId, view);
  }

  private endZone(zoneId: number): void {
    const view = this.zoneViews.get(zoneId);
    if (!view) return;
    this.zoneViews.delete(zoneId);
    const parts = [view.field, ...(view.storm ? [view.storm] : [])];
    this.scene.tweens.add({
      targets: parts,
      alpha: 0,
      duration: ZONE_FADE_MS,
      onComplete: () => {
        view.field.setVisible(false);
        view.storm?.stop().setVisible(false);
        this.freeZoneViews.push(view);
      },
    });
  }

  private ring(x: number, y: number, color: number, radius: number, duration: number): void {
    const ring = this.scene.add.circle(x, y, radius).setStrokeStyle(2, color, 0.9).setDepth(VFX_DEPTH);
    ring.isFilled = false;
    ring.setScale(0.6);
    this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }
}

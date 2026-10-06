import Phaser from 'phaser';
import type { CombatEntity } from '../combat/types';
import { RARITY_INFO } from '../data/equipmentData';
import { EQUIPMENT_DEFS } from '../data/equipmentItems';
import { ITEMS, LOOT_DROP } from '../data/itemData';
import type { LootDrop } from '../loot/LootSystem';
import type { CombatWorld } from '../game/CombatWorld';
import type { Monster } from '../entities/Monster';
import type { GameEvents } from '../game/GameEvents';
import { LOOT_KEY } from '../graphics/placeholderTextures';
import { auraEllipse, barOffsetY } from './characterLayout';

const BAR_WIDTH = 26;
/** Monsters still use the placeholder-era fixed offset. */
const MONSTER_BAR_OFFSET_Y = -22;
const BAR_DEPTH = 950_000;
/** Contact shadows: above the ground tiles, under ground decoration, props and characters. */
const SHADOW_DEPTH = -0.6;
/** Feet of the blob monster art below its position, at scale 1. */
const MONSTER_FEET_Y = 13;

/**
 * Per-frame world-space visuals that mirror simulation state: health/MP
 * bars, the target marker, status auras, projectiles and loot.
 */
export class WorldOverlays {
  private readonly bars: Phaser.GameObjects.Graphics;
  /** Soft contact shadows: characters read clearly against the ground. */
  private readonly shadows: Phaser.GameObjects.Graphics;
  private readonly targetMarker: Phaser.GameObjects.Ellipse;
  private readonly guardAura: Phaser.GameObjects.Ellipse;
  private readonly aura: ReturnType<typeof auraEllipse>;
  private readonly projectileViews = new Map<number, Phaser.GameObjects.Arc>();
  private readonly projectilePool: Phaser.GameObjects.Arc[] = [];
  private readonly lootViews = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: CombatWorld,
  ) {
    this.bars = scene.add.graphics().setDepth(BAR_DEPTH);
    this.shadows = scene.add.graphics().setDepth(SHADOW_DEPTH);

    this.targetMarker = scene.add.ellipse(0, 0, 34, 14).setStrokeStyle(2, 0xff5a5a).setVisible(false);
    this.targetMarker.isFilled = false;
    scene.tweens.add({ targets: this.targetMarker, scale: 1.15, yoyo: true, repeat: -1, duration: 400 });

    this.aura = auraEllipse(world.player.layout);
    this.guardAura = scene.add
      .ellipse(0, 0, this.aura.width, this.aura.height)
      .setStrokeStyle(2, 0x7fd4ff)
      .setVisible(false);
    this.guardAura.setFillStyle(0x7fd4ff, 0.12);
    scene.tweens.add({ targets: this.guardAura, alpha: 0.5, yoyo: true, repeat: -1, duration: 300 });

    const ev = world.events;
    ev.on('projectileSpawned', (e) => this.addProjectile(e));
    ev.on('projectileRemoved', ({ projectileId }) => this.removeProjectile(projectileId));
    // Ground views come from world.loot.drops (see update): auto-looted items never touch the ground.
    ev.on('lootPicked', ({ dropId }) => this.removeLoot(dropId));
    ev.on('equipmentPicked', ({ dropId }) => this.removeLoot(dropId));
    ev.on('lootExpired', ({ dropId }) => this.removeLoot(dropId));
  }

  update(now: number): void {
    this.drawShadows();
    this.drawBars();

    const target = this.world.targeting.current;
    this.targetMarker.setVisible(!!target);
    if (target) this.targetMarker.setPosition(target.x, target.y + 12).setDepth(target.y - 1);

    const player = this.world.player;
    const guarded = player.combat.hasStatus('guard');
    this.guardAura.setVisible(guarded);
    if (guarded) this.guardAura.setPosition(player.x, player.y + this.aura.offsetY).setDepth(player.y + 1);

    for (const p of this.world.projectiles.active) {
      this.projectileViews.get(p.id)?.setPosition(p.x, p.y);
    }

    for (const drop of this.world.loot.drops) {
      const view = this.lootViews.get(drop.id) ?? this.addLoot(drop);
      const remaining = drop.expiresAt - now;
      view.setAlpha(remaining < LOOT_DROP.blinkBefore && Math.floor(now / 120) % 2 === 0 ? 0.3 : 1);
    }
  }

  private drawShadows(): void {
    const g = this.shadows.clear();
    g.fillStyle(0x000000, 0.3);
    const player = this.world.player;
    if (!player.combat.dead) g.fillEllipse(player.x, player.y + player.layout.feetOffset, 22, 8);
    for (const m of this.world.monsters) {
      if (m.combat.dead || !m.visible) continue;
      const k = m.def.scale ?? 1;
      g.fillEllipse(m.x, m.y + MONSTER_FEET_Y * k, 22 * k, 7 * k);
    }
  }

  private drawBars(): void {
    const g = this.bars.clear();
    for (const entity of this.world.combatants) {
      const c = entity.combat;
      if (c.dead) continue;
      const isPlayer = entity === this.world.player;
      const damaged = c.hp < c.stats.maxHp;
      if (!isPlayer && !damaged && entity !== this.world.targeting.current) continue;

      const x = Math.round(entity.x - BAR_WIDTH / 2);
      const y = Math.round(entity.y + (isPlayer ? barOffsetY(this.world.player.layout) : MONSTER_BAR_OFFSET_Y * ((entity as Monster).def.scale ?? 1)));
      this.bar(g, x, y, c.hp / c.stats.maxHp, isPlayer ? 0x5ad35a : 0xe0524a);
      if (isPlayer) this.bar(g, x, y + 4, c.mp / c.stats.maxMp, 0x4f8cff);
    }
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, ratio: number, color: number): void {
    g.fillStyle(0x1d1b26, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 5);
    g.fillStyle(color, 1).fillRect(x, y, Math.round(BAR_WIDTH * Math.min(1, Math.max(0, ratio))), 3);
  }

  private addProjectile(p: GameEvents['projectileSpawned']): void {
    const view = this.projectilePool.pop() ?? this.scene.add.circle(0, 0, 1);
    view
      .setRadius(p.radius)
      .setFillStyle(p.color, 1)
      .setStrokeStyle(2, 0xfff1a8, 0.9)
      .setPosition(p.x, p.y)
      .setDepth(BAR_DEPTH - 1)
      .setVisible(true);
    this.projectileViews.set(p.projectileId, view);
  }

  private removeProjectile(id: number): void {
    const view = this.projectileViews.get(id);
    if (!view) return;
    this.projectileViews.delete(id);
    this.projectilePool.push(view.setVisible(false));
  }

  /** A ground drop: a gem tinted by the item, or a larger gem in the equipment's rarity colour. */
  private addLoot(drop: LootDrop): Phaser.GameObjects.Image {
    const equipment = drop.kind === 'equipment';
    const color = equipment ? Number.parseInt(RARITY_INFO[EQUIPMENT_DEFS[drop.defId].rarity].color.slice(1), 16) : ITEMS[drop.itemId].color;
    const view = this.scene.add
      .image(drop.x, drop.y, LOOT_KEY)
      .setTint(color)
      .setScale(equipment ? 1.5 : 1)
      .setDepth(drop.y - 2);
    this.scene.tweens.add({ targets: view, y: drop.y - 4, yoyo: true, repeat: -1, duration: 450, ease: 'Sine.easeInOut' });
    this.lootViews.set(drop.id, view);
    return view;
  }

  private removeLoot(id: number): void {
    const view = this.lootViews.get(id);
    if (!view) return;
    this.lootViews.delete(id);
    this.scene.tweens.killTweensOf(view);
    view.destroy();
  }

  /** For tests/debug: is this entity currently highlighted? */
  isHighlighted(entity: CombatEntity): boolean {
    return this.targetMarker.visible && this.world.targeting.current === entity;
  }
}

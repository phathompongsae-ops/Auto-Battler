import Phaser from 'phaser';
import type { CombatEntity } from '../combat/types';
import { ITEMS, LOOT_DROP } from '../data/itemData';
import type { CombatWorld } from '../game/CombatWorld';
import type { GameEvents } from '../game/GameEvents';
import { LOOT_KEY } from '../graphics/placeholderTextures';

const BAR_WIDTH = 26;
const BAR_DEPTH = 950_000;

/**
 * Per-frame world-space visuals that mirror simulation state: health/MP
 * bars, the target marker, status auras, projectiles and loot.
 */
export class WorldOverlays {
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly targetMarker: Phaser.GameObjects.Ellipse;
  private readonly guardAura: Phaser.GameObjects.Ellipse;
  private readonly projectileViews = new Map<number, Phaser.GameObjects.Arc>();
  private readonly projectilePool: Phaser.GameObjects.Arc[] = [];
  private readonly lootViews = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: CombatWorld,
  ) {
    this.bars = scene.add.graphics().setDepth(BAR_DEPTH);

    this.targetMarker = scene.add.ellipse(0, 0, 34, 14).setStrokeStyle(2, 0xff5a5a).setVisible(false);
    this.targetMarker.isFilled = false;
    scene.tweens.add({ targets: this.targetMarker, scale: 1.15, yoyo: true, repeat: -1, duration: 400 });

    this.guardAura = scene.add.ellipse(0, 0, 36, 40).setStrokeStyle(2, 0x7fd4ff).setVisible(false);
    this.guardAura.setFillStyle(0x7fd4ff, 0.12);
    scene.tweens.add({ targets: this.guardAura, alpha: 0.5, yoyo: true, repeat: -1, duration: 300 });

    const ev = world.events;
    ev.on('projectileSpawned', (e) => this.addProjectile(e));
    ev.on('projectileRemoved', ({ projectileId }) => this.removeProjectile(projectileId));
    ev.on('lootDropped', (e) => this.addLoot(e));
    ev.on('lootPicked', ({ dropId }) => this.removeLoot(dropId));
    ev.on('lootExpired', ({ dropId }) => this.removeLoot(dropId));
  }

  update(now: number): void {
    this.drawBars();

    const target = this.world.targeting.current;
    this.targetMarker.setVisible(!!target);
    if (target) this.targetMarker.setPosition(target.x, target.y + 12).setDepth(target.y - 1);

    const player = this.world.player;
    const guarded = player.combat.hasStatus('guard');
    this.guardAura.setVisible(guarded);
    if (guarded) this.guardAura.setPosition(player.x, player.y + 2).setDepth(player.y + 1);

    for (const p of this.world.projectiles.active) {
      this.projectileViews.get(p.id)?.setPosition(p.x, p.y);
    }

    for (const drop of this.world.loot.drops) {
      const view = this.lootViews.get(drop.id);
      if (!view) continue;
      const remaining = drop.expiresAt - now;
      view.setAlpha(remaining < LOOT_DROP.blinkBefore && Math.floor(now / 120) % 2 === 0 ? 0.3 : 1);
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
      const y = Math.round(entity.y - 22);
      this.bar(g, x, y, c.hp / c.stats.maxHp, isPlayer ? 0x5ad35a : 0xe0524a);
      if (isPlayer) this.bar(g, x, y + 4, c.mp / c.stats.maxMp, 0x4f8cff);
    }
  }

  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, ratio: number, color: number): void {
    g.fillStyle(0x1d1b26, 0.85).fillRect(x - 1, y - 1, BAR_WIDTH + 2, 5);
    g.fillStyle(color, 1).fillRect(x, y, Math.max(0, Math.round(BAR_WIDTH * ratio)), 3);
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

  private addLoot(drop: GameEvents['lootDropped']): void {
    const view = this.scene.add
      .image(drop.x, drop.y, LOOT_KEY)
      .setTint(ITEMS[drop.itemId].color)
      .setDepth(drop.y - 2);
    this.scene.tweens.add({ targets: view, y: drop.y - 4, yoyo: true, repeat: -1, duration: 450, ease: 'Sine.easeInOut' });
    this.lootViews.set(drop.dropId, view);
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

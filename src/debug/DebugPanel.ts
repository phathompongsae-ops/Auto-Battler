import Phaser from 'phaser';
import { expToNext } from '../data/progressionData';
import { PLAYER_BASIC_ATTACK, PLAYER_LOADOUT } from '../data/playerData';
import { ITEMS } from '../data/itemData';
import { SKILLS, type SkillId } from '../data/skillData';
import type { CombatWorld } from '../game/CombatWorld';

const REFRESH_MS = 100;

/** Dev-only text readout of player, target, cooldowns, inventory and monster AI. */
export class DebugPanel {
  private readonly text: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: CombatWorld,
  ) {
    this.text = scene.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 4 },
        lineSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(Number.MAX_SAFE_INTEGER);
    scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: this.refresh, callbackScope: this });
    this.refresh();
  }

  private refresh(): void {
    const w = this.world;
    const now = w.now;
    const p = w.player;
    const c = p.combat;
    const s = c.stats;

    const guardLeft = w.statuses.remaining(p, 'guard', now);
    const cd = (id: SkillId, label: string) => {
      const left = w.skills.cooldownRemaining(p, id, now);
      return `${label} ${left > 0 ? (left / 1000).toFixed(1) + 's' : 'ready'}`;
    };

    const target = w.targeting.current;
    const targetMonster = w.monsters.find((m) => m === target);
    const targetLine = target
      ? `${target.id} ${Math.ceil(target.combat.hp)}/${target.combat.stats.maxHp}` +
        (targetMonster ? ` [${targetMonster.brain.state}]` : '')
      : 'none';

    const inventory =
      w.inventory
        .entries()
        .map(([id, n]) => `${ITEMS[id].name} x${n}`)
        .join(', ') || 'empty';

    const respawn = w.playerRespawnAt !== null ? `  RESPAWN ${((w.playerRespawnAt - now) / 1000).toFixed(1)}s` : '';

    this.text.setText(
      [
        `FPS ${this.scene.game.loop.actualFps.toFixed(0)}  ${p.state} ${p.facing} (${Math.round(p.x)}, ${Math.round(p.y)})${respawn}`,
        `Lv ${c.level}  EXP ${c.exp}/${expToNext(c.level)}  HP ${Math.ceil(c.hp)}/${s.maxHp}  MP ${Math.floor(c.mp)}/${s.maxMp}`,
        `ATK ${s.attack}  DEF ${s.defense}  SPD ${s.moveSpeed}  CRIT ${Math.round(s.critChance * 100)}%` +
          (guardLeft > 0 ? `  GUARD ${(guardLeft / 1000).toFixed(1)}s` : ''),
        `Target: ${targetLine}`,
        [
          cd(PLAYER_BASIC_ATTACK, 'Atk'),
          cd(PLAYER_LOADOUT.skill1, `Q ${SKILLS[PLAYER_LOADOUT.skill1].name}`),
          cd(PLAYER_LOADOUT.skill2, `E ${SKILLS[PLAYER_LOADOUT.skill2].name}`),
          cd(PLAYER_LOADOUT.skill3, `R ${SKILLS[PLAYER_LOADOUT.skill3].name}`),
        ].join(' | '),
        `Inventory: ${inventory}  (on ground: ${w.loot.drops.length})`,
        'Monsters: ' +
          w.monsters
            .map((m) => `${m.id} ${m.brain.state}${m.combat.dead ? '' : ` ${Math.ceil(m.combat.hp)}`}`)
            .join(' · '),
        'WASD/arrows move · Space attack · Q/E/R skills · Tab target · click monster to target',
      ].join('\n'),
    );
  }
}

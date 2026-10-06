import type { MonsterTier } from '../../data/monsterBalance';
import type { Monster } from '../../entities/Monster';
import type { CombatWorld } from '../../game/CombatWorld';
import { Bar } from '../components/Bar';
import { createPanel } from '../components/Panel';
import { h, setText, toggleClass } from '../dom';

const TIER_LABEL: Record<MonsterTier, string> = {
  normal: '',
  elite: 'Elite',
  mini_boss: 'Mini Boss',
  dungeon_boss: 'Boss',
};

/**
 * Top-centre: the selected target's name, level, tier, HP (value / max) and
 * combat state (winding up a telegraphed attack, enraged). Hidden without a
 * target. Reads simulation state every frame; writes only on change.
 */
export class TargetFrame {
  readonly el: HTMLDivElement;
  private readonly hp = new Bar('hp', { showText: true });
  private readonly nameEl: HTMLSpanElement;
  private readonly tierEl: HTMLSpanElement;
  private readonly stateEl: HTMLSpanElement;
  private targetId: string | null = null;

  constructor(private readonly world: CombatWorld) {
    this.nameEl = h('span', { className: 'ui-label hud-target__name' });
    this.tierEl = h('span', { className: 'hud-target__tier' });
    this.stateEl = h('span', { className: 'hud-target__state' });
    const head = h('div', { className: 'hud-target__head' }, [this.tierEl, this.nameEl, this.stateEl]);
    this.el = createPanel({ className: 'hud-target' }, [head, this.hp.el]);
    this.el.dataset.hud = 'target';
    this.el.hidden = true;
  }

  update(): void {
    const target = this.world.targeting.current as Monster | null;
    const shown = !!target && !target.combat.dead;
    if (this.el.hidden === shown) this.el.hidden = !shown;
    if (!target || !shown) {
      if (this.targetId !== null) {
        this.targetId = null;
        delete this.el.dataset.targetId;
      }
      return;
    }
    if (target.id !== this.targetId) {
      this.targetId = target.id;
      this.el.dataset.targetId = target.id;
      this.el.dataset.tier = target.def.tier;
      setText(this.nameEl, `${target.def.name}  Lv ${target.def.level}`);
      setText(this.tierEl, TIER_LABEL[target.def.tier]);
      this.tierEl.hidden = target.def.tier === 'normal';
    }
    const c = target.combat;
    this.hp.set(c.hp, c.stats.maxHp);
    const windup = this.world.skills.windingUp(target);
    const enraged = c.statuses.some((s) => s.def.id === 'enraged');
    setText(this.stateEl, windup ? 'Winding up!' : enraged ? 'Enraged' : '');
    toggleClass(this.el, 'hud-target--danger', windup || enraged);
    this.el.dataset.state = windup ? 'windup' : enraged ? 'enraged' : '';
  }
}

/** Centre: "Defeated — respawning in N s" while the player is down. */
export class RespawnNotice {
  readonly el: HTMLDivElement;
  private readonly text: HTMLSpanElement;

  constructor(private readonly world: CombatWorld) {
    this.text = h('span');
    this.el = createPanel({ className: 'hud-respawn', strong: true }, [h('strong', { text: 'Defeated' }), this.text]);
    this.el.dataset.hud = 'respawn';
    this.el.hidden = true;
  }

  update(now: number): void {
    const at = this.world.playerRespawnAt;
    const down = this.world.player.combat.dead && at !== null;
    if (this.el.hidden === down) this.el.hidden = !down;
    if (down) setText(this.text, `Respawning in ${Math.max(0, Math.ceil((at - now) / 1000))} s`);
  }
}

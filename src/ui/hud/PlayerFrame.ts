import type { CharacterArt } from '../../data/characterArt';
import { JOBS } from '../../data/jobData';
import { expToNext } from '../../progression/expCurve';
import type { Player } from '../../entities/Player';
import { Bar } from '../components/Bar';
import { createPanel } from '../components/Panel';
import { h, setText } from '../dom';

/** Top-left: portrait with level, name, HP / MP / EXP bars. */
export class PlayerFrame {
  readonly el: HTMLDivElement;
  private readonly hp = new Bar('hp', { showText: true });
  private readonly mp = new Bar('mp', { showText: true });
  private readonly exp = new Bar('exp', { thin: true });
  private readonly level: HTMLSpanElement;
  private readonly expText: HTMLSpanElement;
  private readonly nameEl: HTMLSpanElement;

  constructor(
    private readonly player: Player,
    art: CharacterArt | null,
  ) {
    this.level = h('span', { className: 'hud-portrait__level' });
    const portrait = h('div', { className: 'hud-portrait', attrs: { 'data-hud': 'portrait' } }, [this.level]);
    if (art) {
      portrait.style.backgroundImage = `url("${art.portrait.url}")`;
      portrait.style.backgroundSize = art.portrait.size;
      portrait.style.backgroundPosition = art.portrait.position;
    } else {
      portrait.prepend('P');
    }

    this.expText = h('span', { className: 'ui-caption' });
    // The character's real job, not the (demo) art's name.
    this.nameEl = h('span', { className: 'ui-label', attrs: { 'data-hud': 'job' } });
    const name = h('div', { className: 'hud-player__name' }, [
      this.nameEl,
      this.expText,
    ]);
    const info = h('div', { className: 'hud-player__info' }, [name, this.hp.el, this.mp.el, this.exp.el]);
    this.el = createPanel({ className: 'hud-player' }, [portrait, info]);
    this.el.dataset.hud = 'player';
  }

  update(): void {
    const c = this.player.combat;
    this.hp.set(c.hp, c.stats.maxHp);
    this.mp.set(c.mp, c.stats.maxMp);
    const need = expToNext(c.level);
    this.exp.set(c.exp, need);
    setText(this.nameEl, JOBS[this.player.progress.classId].name);
    setText(this.level, `Lv ${c.level}`);
    setText(this.expText, `EXP ${Math.floor((c.exp / Math.max(1, need)) * 100)}%`);
  }
}

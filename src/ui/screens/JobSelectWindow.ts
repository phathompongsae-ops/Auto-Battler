import { CLASS_1_JOB_CHANGE } from '../../data/jobChangeData';
import type { JobId } from '../../data/jobData';
import type { CombatWorld } from '../../game/CombatWorld';
import { PRIMARY_STATS } from '../../stats/primaryStats';
import { createButton } from '../components/Button';
import { UiWindow } from '../components/Window';
import { h, setText } from '../dom';
import type { WindowManager } from './WindowManager';

/**
 * TEMPORARY DEMO job selection (not the final Job UI): five Class 1 choices,
 * a final-choice warning and Confirm. Opens only while selection is really
 * available (right after the Job Trial, or when talking to the Job
 * Instructor while it is pending), goes through the real Job Change, and
 * never opens again once a job is chosen.
 */
export class JobSelectWindow {
  private window: UiWindow | null = null;
  private chosen: JobId | null = null;
  private readonly unsubscribe: (() => void)[];

  constructor(
    private readonly host: HTMLElement,
    private readonly world: CombatWorld,
    private readonly windows: WindowManager,
  ) {
    const events = world.events;
    this.unsubscribe = [
      events.on('jobSelectionAvailable', () => this.open()),
      events.on('npcInteracted', (e) => e.npcId === CLASS_1_JOB_CHANGE.instructorNpcId && this.open()),
      events.on('jobChanged', () => this.close()),
    ];
  }

  get isOpen(): boolean {
    return this.window !== null;
  }

  /** Opens only while selection is legitimately available; returns whether it is open. */
  open(): boolean {
    if (this.world.jobChange.stage() !== 'selection_available') return false;
    if (this.window) return true;
    this.windows.close();
    this.chosen = null;
    const body = h('div', { className: 'ui-job-select' });
    const render = () => body.replaceChildren(...this.renderBody(render));
    render();
    this.window = new UiWindow({ id: 'job-select', title: 'Choose your Class', render: () => body, onClose: () => (this.window = null) });
    this.host.append(this.window.el);
    return true;
  }

  close(): void {
    this.window?.close();
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.close();
  }

  private renderBody(rerender: () => void): Node[] {
    const choices = this.world.jobChange.choices().map((job) => {
      const bonus = PRIMARY_STATS.filter((s) => job.jobBonus[s])
        .map((s) => `${s.toUpperCase()} +${job.jobBonus[s]}`)
        .join('  ');
      const button = createButton({
        label: `${job.displayName} — ${bonus}`,
        variant: this.chosen === job.jobId ? 'primary' : 'default',
        onClick: () => {
          this.chosen = job.jobId;
          rerender();
        },
      });
      button.dataset.job = job.jobId;
      return button;
    });
    const error = h('p', { className: 'ui-caption', attrs: { 'data-role': 'error' } });
    const confirm = createButton({
      label: this.chosen ? `Confirm ${this.world.jobChange.choices().find((j) => j.jobId === this.chosen)?.displayName}` : 'Select a class',
      variant: 'primary',
      onClick: () => {
        if (!this.chosen) return;
        const result = this.world.changePlayerJob(this.chosen);
        if (!result.ok) setText(error, `Cannot choose this class (${result.reason}).`);
        // On success 'jobChanged' closes the window.
      },
    });
    confirm.dataset.action = 'confirm';
    confirm.disabled = !this.chosen;
    return [
      h('div', { className: 'ui-menu-grid' }, choices),
      h('p', { className: 'ui-caption', text: 'This choice is final for the Demo: your class cannot be changed afterwards.' }),
      error,
      confirm,
    ];
  }
}

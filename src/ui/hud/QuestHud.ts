import { NPCS } from '../../data/npcData';
import type { CombatWorld } from '../../game/CombatWorld';
import { nextObjective, objectiveText, questPhase } from '../../quests/questText';
import { createButton } from '../components/Button';
import { createPanel } from '../components/Panel';
import { h, setText } from '../dom';
import { onLocaleChange, t } from '../i18n';
import { goToQuest, renderNpcDialogue } from '../screens/npcDialogue';
import type { WindowManager } from '../screens/WindowManager';

/** Key that talks to the NPC in range (F / G are skill slots). */
export const TALK_KEY = 'KeyT';

/**
 * Bottom-centre: "[T] Talk — Captain Rowan" while an NPC is in range. The
 * key or a click opens the NPC dialogue (which first reports the talk).
 */
export class InteractPrompt {
  readonly el: HTMLButtonElement;
  private npcId: string | null = null;
  private readonly offLocale: () => void;

  constructor(
    private readonly world: CombatWorld,
    private readonly windows: WindowManager,
  ) {
    this.el = createButton({ label: '', onClick: () => this.interact() });
    this.el.classList.add('hud-interact');
    this.el.dataset.hud = 'interact';
    this.el.hidden = true;
    window.addEventListener('keydown', this.onKey);
    // Re-render the prompt in the new language on the next update.
    this.offLocale = onLocaleChange(() => { this.npcId = null; this.el.hidden = true; });
  }

  /** Talk to the NPC in range and open its dialogue. False when nobody is in range. */
  interact(): boolean {
    if (!this.npcId || this.windows.openId) return false;
    const r = this.world.talkTo(this.npcId);
    if (!r.ok) return false;
    const npcId = this.npcId;
    this.windows.openDialog('npc', r.npc.name, () => renderNpcDialogue(this.world, this.windows, npcId));
    return true;
  }

  update(): void {
    const npc = this.windows.openId ? null : this.world.nearbyNpc();
    const id = npc?.id ?? null;
    if (id === this.npcId) return;
    this.npcId = id;
    this.el.hidden = !npc;
    if (npc) {
      setText(this.el, t('hud.talk', { npc: npc.name }));
      this.el.dataset.npc = npc.id;
    } else delete this.el.dataset.npc;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.offLocale();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.code === TALK_KEY && !e.repeat) this.interact();
  };
}

/**
 * Right side: tracked quests (or the next main quest on offer) with each
 * objective's progress ("Wolves 2 / 3"), "turn in to ..." when ready, and a
 * Go button that Auto Moves to the next step. Rebuilt only when it changes.
 */
export class QuestTrackerHud {
  readonly el: HTMLDivElement;
  private signature = '';
  private readonly body: HTMLDivElement;
  private readonly toggle: HTMLButtonElement;
  private collapsed = false;
  private readonly offLocale: () => void;

  constructor(private readonly world: CombatWorld) {
    this.el = createPanel({ className: 'hud-quests' }, []);
    this.el.dataset.hud = 'quest-tracker';
    this.body = h('div', { className: 'hud-quests__body', attrs: { id: 'hud-quest-objectives' } });
    this.toggle = createButton({ label: t('hud.adventure'), icon: 'quest', title: t('hud.questCollapse'), onClick: () => {
      this.collapsed = !this.collapsed;
      this.body.hidden = this.collapsed;
      this.toggle.setAttribute('aria-expanded', String(!this.collapsed));
      this.relabel();
      this.el.dataset.collapsed = String(this.collapsed);
    } });
    this.toggle.classList.add('hud-quests__toggle');
    this.toggle.dataset.action = 'quest-collapse';
    this.toggle.setAttribute('aria-expanded', 'true');
    this.toggle.setAttribute('aria-controls', 'hud-quest-objectives');
    this.el.append(this.toggle, this.body);
    this.offLocale = onLocaleChange(() => {
      this.relabel();
      this.signature = '';
    });
  }

  private relabel(): void {
    const label = this.toggle.querySelector('span');
    if (label) setText(label, t('hud.adventure'));
    const title = t(this.collapsed ? 'hud.questExpand' : 'hud.questCollapse');
    this.toggle.title = title;
    this.toggle.setAttribute('aria-label', title);
  }

  destroy(): void {
    this.offLocale();
  }

  /** Quests to show: tracked ones, else the first main quest an NPC is offering, as a hint. */
  private shown(): string[] {
    const q = this.world.quests;
    const tracked = q.trackedQuestIds();
    if (tracked.length) return tracked;
    const offered = Object.values(q.defs).find((d) => d.type === 'main' && d.giverNpcId && q.status(d.id) === 'available');
    return offered ? [offered.id] : [];
  }

  update(): void {
    const q = this.world.quests;
    const ids = this.shown();
    const signature = ids.map((id) => `${id}:${q.status(id)}:${q.progress(id).map((p) => p.current).join(',')}`).join('|');
    if (signature === this.signature) return;
    this.signature = signature;
    this.el.hidden = ids.length === 0;
    this.body.replaceChildren(
      ...ids.map((id) => {
        const def = q.defs[id];
        const phase = questPhase(q, id);
        const lines: Node[] = [];
        if (phase === 'available') lines.push(h('div', { className: 'hud-quests__hint', text: t('hud.questNew', { npc: NPCS[def.giverNpcId ?? '']?.name ?? t('hud.questGiver') }) }));
        else if (phase === 'ready') lines.push(h('div', { className: 'hud-quests__hint', text: t('hud.questTurnIn', { npc: NPCS[def.turnInNpcId ?? def.giverNpcId ?? '']?.name ?? t('hud.questGiver') }) }));
        else {
          const progress = q.progress(id);
          const next = nextObjective(q, id);
          def.objectives.forEach((o, i) =>
            lines.push(
              h('div', {
                className: `hud-quests__objective${progress[i].current >= progress[i].required ? ' is-done' : i === next ? ' is-next' : ''}`,
                text: objectiveText(o, progress[i].current, progress[i].required),
              }),
            ),
          );
        }
        const go = createButton({ label: t('hud.go'), onClick: () => goToQuest(this.world, id) });
        go.dataset.action = 'quest-go';
        return h('div', { className: 'hud-quests__quest', attrs: { 'data-quest': id, 'data-phase': phase } }, [
          h('div', { className: 'hud-quests__head' }, [h('span', { className: 'ui-label', text: def.title }), go]),
          ...lines,
        ]);
      }),
    );
  }
}

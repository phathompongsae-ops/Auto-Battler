import type { CombatWorld } from '../../game/CombatWorld';
import { createPanel } from '../components/Panel';
import { h, setText, toggleClass } from '../dom';
import { QUEST_TRACKER_MAX, type TrackedQuestDef } from '../data/quests';

export interface QuestProgress {
  def: TrackedQuestDef;
  current: number;
  done: boolean;
}

/**
 * Reads quest progress from world events and inventory. Shared by the HUD
 * tracker and the Quest window so both always agree.
 */
export class QuestProgressSource {
  private readonly kills = new Map<string, number>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly world: CombatWorld,
    readonly quests: readonly TrackedQuestDef[],
  ) {
    this.unsubscribe = world.events.on('death', ({ entityId, killerId }) => {
      if (killerId !== world.player.id) return;
      const monster = world.monsters.find((m) => m.id === entityId);
      if (monster) this.kills.set(monster.def.id, (this.kills.get(monster.def.id) ?? 0) + 1);
    });
  }

  progress(): QuestProgress[] {
    return this.quests.map((def) => {
      const goal = def.goal;
      const have = goal.kind === 'kill' ? (this.kills.get(goal.monster) ?? 0) : this.world.inventory.count(goal.item);
      const current = Math.min(have, goal.count);
      return { def, current, done: current >= goal.count };
    });
  }

  destroy(): void {
    this.unsubscribe();
  }
}

/** Left-middle compact tracker: one line per quest, at most QUEST_TRACKER_MAX lines. */
export class QuestTracker {
  readonly el: HTMLDivElement;
  private readonly rows: { el: HTMLDivElement; progress: HTMLSpanElement }[] = [];

  constructor(private readonly source: QuestProgressSource) {
    this.el = createPanel({ className: 'hud-quests' });
    this.el.dataset.hud = 'quests';
    for (const def of source.quests.slice(0, QUEST_TRACKER_MAX)) {
      const progress = h('span', { className: 'hud-quest__progress' });
      const el = h('div', { className: 'hud-quest' }, [h('span', { className: 'hud-quest__title', text: def.title }), progress]);
      this.rows.push({ el, progress });
      this.el.append(el);
    }
  }

  update(): void {
    this.source.progress().forEach((p, i) => {
      const row = this.rows[i];
      if (!row) return;
      setText(row.progress, p.done ? 'Done' : `${p.current}/${p.def.goal.count}`);
      toggleClass(row.el, 'is-complete', p.done);
    });
  }
}

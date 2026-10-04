import { ITEMS, type ItemId } from '../../data/itemData';
import { DAILY_FEATURE, WEEKLY_FEATURE } from '../../data/quests/recurringQuests';
import type { QuestRewards } from '../../data/questData';
import type { CombatWorld } from '../../game/CombatWorld';
import { createButton } from '../components/Button';
import { h } from '../dom';

/*
 * TEMPORARY Daily Commission / Weekly quest window body (not final art).
 * Everything comes from the RecurringQuests and QuestSystem services; claims
 * go through their real claim paths.
 */

export function rewardText(r: QuestRewards): string {
  const parts: string[] = [];
  if (r.exp) parts.push(`${r.exp} EXP`);
  if (r.gold) parts.push(`${r.gold} Gold`);
  if (r.diamond) parts.push(`${r.diamond} Diamond`);
  for (const i of r.items ?? []) parts.push(`${ITEMS[i.itemId as ItemId].name} x${i.count}`);
  return parts.join(', ') || '—';
}

const STATE_TEXT: Record<string, string> = { locked: 'Locked', available: 'Available', active: 'In progress', completed: 'Complete!', claimed: 'Claimed' };

export function renderRecurring(world: CombatWorld, tab: 'daily' | 'weekly'): HTMLElement {
  const root = h('div', { className: 'ui-list', attrs: { 'data-recurring': tab } });
  const render = () => root.replaceChildren(...build());

  function questRow(questId: string): HTMLElement {
    const def = world.quests.defs[questId];
    const status = world.quests.status(questId);
    const progress = world.quests.progress(questId).map((p) => `${p.current}/${p.required}`).join(' · ');
    const claim = createButton({
      label: 'Claim',
      variant: 'primary',
      onClick: () => {
        world.quests.claim(questId);
        render();
      },
    });
    claim.dataset.claim = questId;
    claim.disabled = status !== 'completed';
    return h('div', { className: 'ui-list__row', attrs: { 'data-quest': questId, 'data-status': status } }, [
      h('div', {}, [
        h('div', { className: 'ui-label', text: `${def.title}  ${progress}` }),
        h('div', { className: 'ui-caption', text: def.description }),
        h('div', { className: 'ui-caption', text: `Reward: ${rewardText(def.rewards)} · ${STATE_TEXT[status]}` }),
      ]),
      claim,
    ]);
  }

  function build(): Node[] {
    const rq = world.recurring;
    const feature = tab === 'daily' ? DAILY_FEATURE : WEEKLY_FEATURE;
    if (!world.features.isFeatureUnlocked(feature)) {
      const access = world.featureProgression.check(feature);
      return [
        h('div', { className: 'ui-empty', attrs: { 'data-recurring-state': 'locked' } }, [
          h('div', { className: 'ui-label', text: 'Not unlocked yet' }),
          h('div', { className: 'ui-caption', text: access.ok ? '' : access.message }),
        ]),
      ];
    }
    if (tab === 'daily') {
      return [
        h('div', { className: 'ui-caption', text: `Server day ${rq.state.daily.cycleId} · resets each server day · ${rq.state.weekly.dailyClaims} claimed this week` }),
        ...rq.dailyQuestIds().map(questRow),
      ];
    }
    const claimed = rq.weeklyClaimed();
    const milestones = rq.milestones().map((m) => {
      const button = createButton({
        label: m.claimed ? 'Claimed' : `Claim ${m.milestone}/7`,
        variant: 'primary',
        onClick: () => {
          rq.claimMilestone(m.milestone);
          render();
        },
      });
      button.dataset.milestone = String(m.milestone);
      button.disabled = m.claimed || !m.reached;
      return h('div', { className: 'ui-list__row', attrs: { 'data-milestone-row': String(m.milestone) } }, [
        h('div', {}, [
          h('div', { className: 'ui-label', text: `Milestone ${m.milestone}/7` }),
          h('div', { className: 'ui-caption', text: `Reward: ${rewardText(m.rewards)}` }),
        ]),
        button,
      ]);
    });
    return [
      h('div', { className: 'ui-caption', attrs: { 'data-role': 'weekly-progress' }, text: `Week ${rq.state.weekly.cycleId} · ${claimed}/7 Weekly quests claimed` }),
      ...rq.weeklyQuestIds().map(questRow),
      h('div', { className: 'ui-label', text: 'Milestones' }),
      ...milestones,
    ];
  }

  render();
  return root;
}

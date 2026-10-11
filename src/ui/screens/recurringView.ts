import { ITEMS, type ItemId } from '../../data/itemData';
import { DAILY_FEATURE, WEEKLY_FEATURE } from '../../data/quests/recurringQuests';
import type { QuestRewards } from '../../data/questData';
import type { CombatWorld } from '../../game/CombatWorld';
import { createButton } from '../components/Button';
import { h } from '../dom';
import { t, type StringKey } from '../i18n';

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

const stateText = (status: string) => t(`daily.state.${status}` as StringKey);

export function renderRecurring(world: CombatWorld, tab: 'daily' | 'weekly'): HTMLElement {
  const root = h('div', { className: 'ui-list', attrs: { 'data-recurring': tab } });
  const render = () => root.replaceChildren(...build());

  function questRow(questId: string): HTMLElement {
    const def = world.quests.defs[questId];
    const status = world.quests.status(questId);
    const progress = world.quests.progress(questId).map((p) => `${p.current}/${p.required}`).join(' · ');
    const claim = createButton({
      label: t('daily.claim'),
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
        h('div', { className: 'ui-caption', text: `${t('quest.reward', { rewards: rewardText(def.rewards) })} · ${stateText(status)}` }),
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
          h('div', { className: 'ui-label', text: t('daily.notUnlocked') }),
          h('div', { className: 'ui-caption', text: access.ok ? '' : access.message }),
        ]),
      ];
    }
    if (tab === 'daily') {
      return [
        h('div', { className: 'ui-caption', text: t('daily.serverDay', { day: rq.state.daily.cycleId ?? '—', claims: rq.state.weekly.dailyClaims }) }),
        ...rq.dailyQuestIds().map(questRow),
      ];
    }
    const claimed = rq.weeklyClaimed();
    const milestones = rq.milestones().map((m) => {
      const button = createButton({
        label: m.claimed ? t('daily.claimed') : t('daily.claimMilestone', { n: m.milestone }),
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
          h('div', { className: 'ui-label', text: t('weekly.milestone', { n: m.milestone }) }),
          h('div', { className: 'ui-caption', text: t('quest.reward', { rewards: rewardText(m.rewards) }) }),
        ]),
        button,
      ]);
    });
    return [
      h('div', { className: 'ui-caption', attrs: { 'data-role': 'weekly-progress' }, text: t('weekly.progress', { week: rq.state.weekly.cycleId ?? '—', claimed }) }),
      ...rq.weeklyQuestIds().map(questRow),
      h('div', { className: 'ui-label', text: t('weekly.milestones') }),
      ...milestones,
    ];
  }

  render();
  return root;
}

import { SKILLS, type SkillDef, type SkillId } from '../../data/skillData';
import { SKILL_SLOTS, type SkillSlot } from '../../data/playerData';
import { STATUSES } from '../../data/statusData';
import type { SkillNodeDef } from '../../data/skillTreeData';
import { JOBS } from '../../data/jobData';
import type { CombatWorld } from '../../game/CombatWorld';
import { createButton } from '../components/Button';
import { h } from '../dom';
import { t, type StringKey } from '../i18n';
import { SKILL_ICONS } from '../../data/skillIcons';
import { passiveIconUrl } from '../itemIcons';

/*
 * TEMPORARY Skill Tree window body (not final art). Everything it shows and
 * allows comes from the tree data and the real SkillTree service: the UI
 * never decides gating itself.
 */

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const sec = (ms: number) => `${Math.round(ms / 100) / 10}s`;
const TILE = 32;

/** One line describing what an active/buff skill does at a rank. */
function activeText(skill: SkillDef, node: SkillNodeDef): string {
  const e = skill.effect;
  const parts: string[] = [];
  if ('power' in e && e.power) parts.push(`${pct(e.power)} Physical`);
  if ((e.kind === 'damage' || e.kind === 'dash_strike') && e.onHit) parts.push(`stun ${sec(e.onHit.duration)}`);
  if (e.kind === 'damage' && e.critBonus) parts.push(`+${pct(e.critBonus)} crit`);
  if (e.kind === 'aoe_damage' || e.kind === 'taunt') parts.push(`radius ${Math.round((e.radius / TILE) * 10) / 10}`);
  if (e.kind === 'taunt' || e.kind === 'status') parts.push(`${sec(e.duration)}`);
  if (e.kind === 'status' && node.statusId) parts.push(STATUSES[node.statusId].name);
  parts.push(`CD ${sec(skill.cooldown)}`, `MP ${skill.mpCost}`);
  return parts.join(' · ');
}

/** A passive's total effect at a rank. */
function passiveText(node: SkillNodeDef, rank: number): string {
  const names: Record<string, string> = { def: 'DEF', maxHp: 'Max HP', physicalAtk: 'Physical ATK', accuracy: 'Accuracy' };
  const parts: string[] = [];
  for (const [k, v] of Object.entries(node.perRank?.percent ?? {})) parts.push(`${names[k] ?? k} +${pct(v * rank)}`);
  for (const [k, v] of Object.entries(node.perRank?.flat ?? {})) parts.push(`${names[k] ?? k} +${Math.round(v * rank * 1000) / 10} pts`);
  return parts.join(', ');
}

const BLOCKED_TEXT: Record<string, StringKey> = {
  max_rank: 'skills.blocked.maxRank',
  not_enough_points: 'skills.blocked.noPoints',
  branch_requirement: 'skills.blocked.locked',
  prerequisite: 'skills.blocked.locked',
  feature_locked: 'skills.blocked.locked',
  no_skill_tree: 'skills.blocked.unavailable',
  unknown_skill: 'skills.blocked.unavailable',
};

/**
 * A node's symbol: actives use their illustrated medallion icon, passives and procs
 * the muted round plate (ui/art/iconArt.ts), so the two never read alike.
 */
function nodeIcon(node: SkillNodeDef): HTMLElement | null {
  const url = node.combatSkillId ? SKILL_ICONS[node.combatSkillId] : passiveIconUrl(node.id);
  if (!url) return null;
  return h('img', { className: `skill-node__icon skill-node__icon--${node.type}`, attrs: { src: url, alt: '', 'aria-hidden': 'true', 'data-node-icon': node.type, draggable: 'false' } });
}

export function renderSkillTree(world: CombatWorld): HTMLElement {
  let selected: SkillId | null | undefined;
  let feedback = t('skills.assignHint');
  const root = h('div', { className: 'ui-list', attrs: { 'data-skill-tree': 'root' } });
  const render = () => root.replaceChildren(...build());

  const message = (state: string, title: string, text: string) => [
    h('div', { className: 'ui-empty', attrs: { 'data-skill-tree-state': state } }, [
      h('div', { className: 'ui-label', text: title }),
      h('div', { className: 'ui-caption', text }),
    ]),
  ];

  function build(): Node[] {
    const st = world.skillTree;
    const classId = world.player.progress.classId;
    const tree = st.tree();
    if (!tree) {
      if (JOBS[classId].tier === 0) return message('novice', t('skills.noTree'), t('skills.noTreeHint'));
      return message('not-implemented', t('skills.notImplemented', { job: JOBS[classId].name }), t('skills.notImplementedHint'));
    }
    if (!st.usable()) return message('locked', t('skills.locked'), t('skills.lockedHint'));

    const pts = st.points();
    const reset = createButton({
      label: t('skills.reset'),
      onClick: () => {
        st.reset();
        render();
      },
    });
    reset.dataset.action = 'reset';
    reset.disabled = pts.spent === 0;
    const header = h('div', { className: 'ui-list__row' }, [
      h('div', {}, [
        h('div', { className: 'ui-label', text: `${JOBS[classId].name} · Lv ${world.player.combat.level}` }),
        h('div', {
          className: 'ui-caption',
          attrs: { 'data-role': 'points' },
          text: t('skills.points', { available: pts.available, earned: pts.earned, spent: pts.spent }),
        }),
      ]),
      reset,
    ]);

    const sections: Node[] = [header, hotbar()];
    for (const branch of tree.branches) {
      const nodes = tree.nodes.filter((n) => n.branch === branch.id);
      const branchSpent = nodes.reduce((sum, n) => sum + st.rank(n.id), 0);
      sections.push(h('div', { className: 'ui-label', text: t('skills.branch', { branch: branch.name, spent: branchSpent }) }));
      for (const node of nodes) {
        const view = st.nodeView(node.id);
        const lines: string[] = [node.description];
        if (view.current) lines.push(t('skills.now', { text: activeText(view.current, node) }));
        if (view.next) lines.push(t(view.rank ? 'skills.next' : 'skills.rank1', { text: activeText(view.next, node) }));
        if (node.type === 'passive') {
          if (view.rank) lines.push(t('skills.now', { text: passiveText(node, view.rank) }));
          if (view.rank < node.maxRank) lines.push(t(view.rank ? 'skills.next' : 'skills.rank1', { text: passiveText(node, view.rank + 1) }));
        }
        if (node.branchSpendRequirement) {
          lines.push(t('skills.requires', { count: node.branchSpendRequirement, branch: branch.name, have: Math.min(view.branchSpent, node.branchSpendRequirement) }));
        }
        const learn = createButton({
          label: '+',
          variant: 'primary',
          title: t('skills.learn', { skill: node.displayName }),
          onClick: () => {
            st.learn(node.id);
            render();
          },
        });
        learn.dataset.learn = node.id;
        learn.disabled = view.blockedBy !== null;
        const row = h('div', { className: 'ui-list__row skill-node', attrs: { 'data-node': node.id, 'data-rank': String(view.rank), 'data-type': node.type } }, [
          nodeIcon(node),
          h('div', { className: 'skill-node__text' }, [
            h('div', { className: 'ui-label', text: `${node.displayName}  ${view.rank}/${node.maxRank}  (${t(`skills.type.${node.type}` as StringKey)})` }),
            ...lines.map((text) => h('div', { className: 'ui-caption', text })),
            view.blockedBy && view.blockedBy !== 'max_rank' && view.blockedBy !== 'not_enough_points'
              ? h('div', { className: 'ui-caption', attrs: { 'data-role': 'locked' }, text: t(BLOCKED_TEXT[view.blockedBy]) })
              : null,
          ]),
          learn,
        ]);
        sections.push(row);
      }
    }
    return sections;
  }

  function hotbar(): HTMLElement {
    const st = world.skillTree;
    const layout = st.editingLoadout();
    const place = (slot: SkillSlot, id: SkillId | null) => {
      const result = st.assign(slot, id);
      feedback = t(result.queued ? 'skills.assignQueued' : 'skills.assignUpdated');
      selected = undefined;
      render();
    };
    const slots = SKILL_SLOTS.map((slot, i) => {
      const id = layout[slot];
      const button = createButton({ label: `${['Q', 'E', 'R', 'F', 'G'][i]}: ${id ? SKILLS[id].name : t('hero.empty')}`, onClick: () => {
        if (selected !== undefined) place(slot, selected);
        else if (id) { selected = id; render(); }
      } });
      button.dataset.assignSlot = slot;
      button.addEventListener('dragover', e => e.preventDefault());
      button.addEventListener('drop', e => {
        e.preventDefault();
        const id = e.dataTransfer?.getData('text/plain') as SkillId;
        if (st.activeSkills().includes(id)) place(slot, id);
      });
      return button;
    });
    const learned = st.activeSkills().map(id => {
      const assigned = SKILL_SLOTS.find(s => layout[s] === id);
      const button = createButton({ label: `${SKILLS[id].name} (${assigned ? t('skills.slotN', { n: assigned.slice(5) }) : t('skills.unassigned')})`, onClick: () => { selected = id; render(); } });
      button.dataset.assignSkill = id;
      button.setAttribute('aria-pressed', String(selected === id));
      button.draggable = true;
      button.addEventListener('dragstart', e => e.dataTransfer?.setData('text/plain', id));
      return button;
    });
    return h('section', { attrs: { 'data-hotbar-editor': '', 'aria-label': 'Active skill assignment' } }, [
      h('div', { className: 'ui-label', text: t('skills.activeSlots') }),
      h('div', { className: 'ui-caption', text: feedback, attrs: { 'aria-live': 'polite' } }),
      h('div', { className: 'hotbar-editor__buttons' }, slots),
      h('div', { className: 'hotbar-editor__buttons' }, learned),
      createButton({ label: t('skills.clearSlot'), onClick: () => { selected = null; feedback = t('skills.chooseClear'); render(); } }),
    ]);
  }

  render();
  return root;
}

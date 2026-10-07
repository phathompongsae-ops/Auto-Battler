import { SKILLS, type SkillDef, type SkillId } from '../../data/skillData';
import { SKILL_SLOTS, type SkillSlot } from '../../data/playerData';
import { STATUSES } from '../../data/statusData';
import type { SkillNodeDef } from '../../data/skillTreeData';
import { JOBS } from '../../data/jobData';
import type { CombatWorld } from '../../game/CombatWorld';
import { createButton } from '../components/Button';
import { h } from '../dom';

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

const BLOCKED_TEXT: Record<string, string> = {
  max_rank: 'Max rank',
  not_enough_points: 'No Skill Points',
  branch_requirement: 'Locked',
  prerequisite: 'Locked',
  feature_locked: 'Locked',
  no_skill_tree: 'Unavailable',
  unknown_skill: 'Unavailable',
};

export function renderSkillTree(world: CombatWorld): HTMLElement {
  let selected: SkillId | null | undefined;
  let feedback = 'Select a learned active skill, then a slot. Equipped skills swap positions.';
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
      if (JOBS[classId].tier === 0) return message('novice', 'No skill tree yet', 'Reach Lv11 and choose a Class to unlock your skill tree.');
      return message('not-implemented', `${JOBS[classId].name} skills`, 'Skill Tree not implemented for this class yet.');
    }
    if (!st.usable()) return message('locked', 'Skill tree locked', 'Complete the Job Change to unlock Class 1 skills.');

    const pts = st.points();
    const reset = createButton({
      label: 'Reset (free)',
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
          text: `Skill Points: ${pts.available} available (${pts.earned} earned, ${pts.spent} spent)`,
        }),
      ]),
      reset,
    ]);

    const sections: Node[] = [header, hotbar()];
    for (const branch of tree.branches) {
      const nodes = tree.nodes.filter((n) => n.branch === branch.id);
      const branchSpent = nodes.reduce((sum, n) => sum + st.rank(n.id), 0);
      sections.push(h('div', { className: 'ui-label', text: `${branch.name} — ${branchSpent} SP spent` }));
      for (const node of nodes) {
        const view = st.nodeView(node.id);
        const lines: string[] = [node.description];
        if (view.current) lines.push(`Now: ${activeText(view.current, node)}`);
        if (view.next) lines.push(`${view.rank ? 'Next' : 'Rank 1'}: ${activeText(view.next, node)}`);
        if (node.type === 'passive') {
          if (view.rank) lines.push(`Now: ${passiveText(node, view.rank)}`);
          if (view.rank < node.maxRank) lines.push(`${view.rank ? 'Next' : 'Rank 1'}: ${passiveText(node, view.rank + 1)}`);
        }
        if (node.branchSpendRequirement) {
          lines.push(`Requires ${node.branchSpendRequirement} ${branch.name} SP (${Math.min(view.branchSpent, node.branchSpendRequirement)}/${node.branchSpendRequirement})`);
        }
        const learn = createButton({
          label: '+',
          variant: 'primary',
          title: `Learn ${node.displayName}`,
          onClick: () => {
            st.learn(node.id);
            render();
          },
        });
        learn.dataset.learn = node.id;
        learn.disabled = view.blockedBy !== null;
        const row = h('div', { className: 'ui-list__row', attrs: { 'data-node': node.id, 'data-rank': String(view.rank) } }, [
          h('div', {}, [
            h('div', { className: 'ui-label', text: `${node.displayName}  ${view.rank}/${node.maxRank}  (${node.type})` }),
            ...lines.map((text) => h('div', { className: 'ui-caption', text })),
            view.blockedBy && view.blockedBy !== 'max_rank' && view.blockedBy !== 'not_enough_points'
              ? h('div', { className: 'ui-caption', attrs: { 'data-role': 'locked' }, text: BLOCKED_TEXT[view.blockedBy] })
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
      feedback = result.queued ? 'Assignment queued until the current action finishes.' : 'Assignment updated.';
      selected = undefined;
      render();
    };
    const slots = SKILL_SLOTS.map((slot, i) => {
      const id = layout[slot];
      const button = createButton({ label: `${['Q', 'E', 'R', 'F', 'G'][i]}: ${id ? SKILLS[id].name : 'Empty'}`, onClick: () => {
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
      const button = createButton({ label: `${SKILLS[id].name} (${assigned ? `Slot ${assigned.slice(5)}` : 'unassigned'})`, onClick: () => { selected = id; render(); } });
      button.dataset.assignSkill = id;
      button.setAttribute('aria-pressed', String(selected === id));
      button.draggable = true;
      button.addEventListener('dragstart', e => e.dataTransfer?.setData('text/plain', id));
      return button;
    });
    return h('section', { attrs: { 'data-hotbar-editor': '', 'aria-label': 'Active skill assignment' } }, [
      h('div', { className: 'ui-label', text: 'Active slots' }),
      h('div', { className: 'ui-caption', text: feedback, attrs: { 'aria-live': 'polite' } }),
      h('div', { className: 'hotbar-editor__buttons' }, slots),
      h('div', { className: 'hotbar-editor__buttons' }, learned),
      createButton({ label: 'Clear a slot', onClick: () => { selected = null; feedback = 'Choose the slot to clear.'; render(); } }),
    ]);
  }

  render();
  return root;
}

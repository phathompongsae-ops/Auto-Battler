import { SKILLS, type SkillDef, type SkillId } from '../../data/skillData';
import { SKILL_SLOTS, type SkillSlot } from '../../data/playerData';
import { STATUSES } from '../../data/statusData';
import type { SkillNodeDef } from '../../data/skillTreeData';
import { JOBS } from '../../data/jobData';
import { SKILL_ICONS } from '../../data/skillIcons';
import type { CombatWorld } from '../../game/CombatWorld';
import type { NodeView } from '../../skills/SkillTree';
import { createButton } from '../components/Button';
import { h } from '../dom';
import { t, type StringKey } from '../i18n';
import { icon } from '../icons';
import { passiveIconUrl } from '../itemIcons';

/*
 * Skills window: an MMORPG skill / build screen over the real SkillTree service
 * (the UI never decides gating itself).
 *   Header: class, level, Skill Points, Reset.
 *   Loadout bar: the five equipped combat slots (Q E R F G), icon-first. Tap a learned
 *     active skill (or Equip in its details), then a slot; or drag a skill onto a slot.
 *   Category tabs: the tree's real branches, plus a Passive filter across them.
 *   Skill list: icon, name, rank, type badge, one-line numbers, learn button.
 *   Details: the selected skill's full description and numbers, next rank, actions.
 *     Beside the list on wide windows; a drawer over the list on narrow ones.
 */

const KEYS = ['Q', 'E', 'R', 'F', 'G'] as const;
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const sec = (ms: number) => `${Math.round(ms / 100) / 10}s`;
const TILE = 32;
const tiles = (px: number) => Math.round((px / TILE) * 10) / 10;

const isPassive = (node: SkillNodeDef) => node.type === 'passive' || node.type === 'proc';
const nodeSkill = (node: SkillNodeDef): SkillId | null => (node.combatSkillId ?? null) as SkillId | null;

/** One line of numbers for an active / buff skill at a rank. */
function activeText(skill: SkillDef, node: SkillNodeDef): string {
  const e = skill.effect;
  const parts: string[] = [];
  if ('power' in e && e.power) parts.push(t('skills.sum.physical', { pct: pct(e.power) }));
  if ((e.kind === 'damage' || e.kind === 'dash_strike') && e.onHit) parts.push(t('skills.sum.stun', { s: sec(e.onHit.duration) }));
  if (e.kind === 'damage' && e.critBonus) parts.push(t('skills.sum.crit', { pct: pct(e.critBonus) }));
  if (e.kind === 'aoe_damage' || e.kind === 'taunt') parts.push(t('skills.sum.radius', { n: tiles(e.radius) }));
  if (e.kind === 'taunt' || e.kind === 'status') parts.push(sec(e.duration));
  if (e.kind === 'status' && node.statusId) parts.push(STATUSES[node.statusId].name);
  parts.push(`CD ${sec(skill.cooldown)}`, `MP ${skill.mpCost}`);
  return parts.join(' · ');
}

const PASSIVE_STAT: Record<string, StringKey> = { def: 'skills.p.def', maxHp: 'skills.p.maxHp', physicalAtk: 'skills.p.physicalAtk', accuracy: 'skills.p.accuracy' };

/** A passive's total effect at a rank. */
function passiveText(node: SkillNodeDef, rank: number): string {
  const name = (k: string) => (PASSIVE_STAT[k] ? t(PASSIVE_STAT[k]) : k);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(node.perRank?.percent ?? {})) parts.push(`${name(k)} +${pct(v * rank)}`);
  for (const [k, v] of Object.entries(node.perRank?.flat ?? {})) parts.push(`${name(k)} +${t('skills.p.points', { n: Math.round(v * rank * 1000) / 10 })}`);
  return parts.join(', ');
}

/** A proc's trigger and effect (its numbers do not change with rank). */
function procText(node: SkillNodeDef): string {
  const p = node.proc;
  if (!p) return '';
  const status = STATUSES[p.statusId].name;
  return p.kind === 'low_hp'
    ? t('skills.proc.lowHp', { percent: Math.round(p.threshold * 100), status, duration: sec(p.durationMs), cooldown: sec(p.icdMs) })
    : t('skills.proc.hitStreak', { hits: p.hits, window: sec(p.windowMs), status, duration: sec(p.durationMs) });
}

/** The row's one-line summary: this rank's numbers (or rank 1's while unlearned). */
function summary(view: NodeView): string {
  const node = view.node;
  if (node.type === 'proc') return procText(node);
  if (isPassive(node)) return passiveText(node, Math.max(1, view.rank));
  const s = view.current ?? view.next;
  return s ? activeText(s, node) : '';
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

/** Actives use their illustrated medallion icon, passives / procs the muted plate (ui/art/iconArt.ts). */
function nodeIcon(node: SkillNodeDef, size: 'sm' | 'lg' = 'sm'): HTMLElement {
  const skill = nodeSkill(node);
  const url = skill ? SKILL_ICONS[skill] : passiveIconUrl(node.id);
  const kind = isPassive(node) ? 'passive' : 'active';
  const frame = h('span', { className: `skill-icon skill-icon--${kind} skill-icon--${size}` });
  frame.append(url ? h('img', { attrs: { src: url, alt: '', 'aria-hidden': 'true', 'data-node-icon': node.type, draggable: 'false' } }) : icon('skills'));
  return frame;
}

const badge = (node: SkillNodeDef) =>
  h('span', { className: `skill-badge skill-badge--${isPassive(node) ? 'passive' : 'active'}`, attrs: { 'data-role': 'badge' }, text: t(isPassive(node) ? 'skills.badge.passive' : 'skills.badge.active') });

const BRANCH_TAB: Record<string, StringKey> = { core: 'skills.tab.core', tank: 'skills.tab.tank', damage: 'skills.tab.damage' };
const branchName = (id: string, fallback: string) => (BRANCH_TAB[id] ? t(BRANCH_TAB[id]) : fallback);

export function renderSkillTree(world: CombatWorld): HTMLElement {
  /** The skill armed for assignment: the next slot tapped receives it (null: clear that slot). */
  let armed: SkillId | null | undefined;
  let feedback = '';
  let tab: string | null = null;
  let focus: string | null = null;
  /** Narrow windows: the details drawer is open over the list. */
  let detailOpen = false;
  const root = h('div', { className: 'skills', attrs: { 'data-skill-tree': 'root' } });
  const render = () => {
    root.replaceChildren(...build());
    root.toggleAttribute('data-detail-open', detailOpen);
  };

  const message = (state: string, title: string, text: string) => [
    h('div', { className: 'ui-empty', attrs: { 'data-skill-tree-state': state } }, [h('div', { className: 'ui-label', text: title }), h('div', { className: 'ui-caption', text })]),
  ];

  const place = (slot: SkillSlot, id: SkillId | null) => {
    const result = world.skillTree.assign(slot, id);
    feedback = t(result.queued ? 'skills.assignQueued' : 'skills.assignUpdated');
    armed = undefined;
    render();
  };

  function build(): Node[] {
    const st = world.skillTree;
    const classId = world.player.progress.classId;
    const tree = st.tree();
    if (!tree) {
      if (JOBS[classId].tier === 0) return message('novice', t('skills.noTree'), t('skills.noTreeHint'));
      return message('not-implemented', t('skills.notImplemented', { job: JOBS[classId].name }), t('skills.notImplementedHint'));
    }
    if (!st.usable()) return message('locked', t('skills.locked'), t('skills.lockedHint'));

    const tabs = [...tree.branches.map((b) => ({ id: b.id, label: branchName(b.id, b.name) })), { id: 'passive', label: t('skills.tab.passive') }];
    if (!tab || !tabs.some((x) => x.id === tab)) tab = tabs[0].id;
    const inTab = (n: SkillNodeDef) => (tab === 'passive' ? isPassive(n) : n.branch === tab);
    if (!focus || !tree.nodes.some((n) => n.id === focus)) focus = tree.nodes.find(inTab)?.id ?? tree.nodes[0].id;

    return [header(), loadout(), h('div', { className: 'skills-main' }, [
      h('div', { className: 'skills-list-col' }, [tabBar(tabs), list(tree.nodes, inTab)]),
      details(st.nodeView(focus), tree.branches.find((b) => b.id === st.nodeView(focus!).node.branch)?.name ?? ''),
    ])];
  }

  function header(): HTMLElement {
    const st = world.skillTree;
    const pts = st.points();
    const reset = createButton({ label: t('skills.reset'), onClick: () => { st.reset(); armed = undefined; render(); } });
    reset.dataset.action = 'reset';
    reset.disabled = pts.spent === 0;
    const classId = world.player.progress.classId;
    return h('div', { className: 'skills-header' }, [
      h('span', { className: 'skills-header__crest' }, [icon('crossed_swords')]),
      h('div', { className: 'skills-header__who' }, [
        h('div', { className: 'skills-header__job', text: JOBS[classId].name }),
        h('div', { className: 'skills-header__level', text: `Lv ${world.player.combat.level}` }),
      ]),
      h('div', { className: 'skills-points', attrs: { 'data-role': 'points', 'data-available': String(pts.available), title: t('skills.pointsDetail', { earned: pts.earned, spent: pts.spent }) } }, [
        h('span', { className: 'skills-points__label', text: t('skills.pointsLabel') }),
        h('strong', { className: 'skills-points__value', text: String(pts.available) }),
      ]),
      reset,
    ]);
  }

  /** The five equipped combat slots. */
  function loadout(): HTMLElement {
    const st = world.skillTree;
    const layout = st.editingLoadout();
    const slots = SKILL_SLOTS.map((slot, i) => {
      const id = layout[slot];
      const name = id ? SKILLS[id].name : t('hero.empty');
      const url = id ? SKILL_ICONS[id] : undefined;
      const face = id && url ? h('img', { attrs: { src: url, alt: '', 'aria-hidden': 'true', draggable: 'false' } }) : h('span', { className: 'skills-slot__plus', text: id ? SKILLS[id].name.slice(0, 2) : '+' });
      const button = h('button', {
        className: `skills-slot${id ? ' is-filled' : ' is-empty'}${armed !== undefined ? ' is-target' : ''}${id && id === armed ? ' is-armed' : ''}`,
        attrs: { type: 'button', 'data-assign-slot': slot, 'aria-label': `${KEYS[i]}: ${name}`, title: `${KEYS[i]}: ${name}` },
      }, [face, h('span', { className: 'skills-slot__key', text: KEYS[i] })]);
      button.addEventListener('click', () => {
        if (armed !== undefined) place(slot, armed);
        else if (id) {
          armed = id;
          focus = nodeIdForSkill(id) ?? focus;
          feedback = t('skills.chooseSlot', { skill: SKILLS[id].name });
          render();
        }
      });
      button.addEventListener('dragover', (e) => e.preventDefault());
      button.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropped = e.dataTransfer?.getData('text/plain') as SkillId;
        if (st.activeSkills().includes(dropped)) place(slot, dropped);
      });
      return button;
    });
    return h('section', { className: 'skills-loadout', attrs: { 'data-hotbar-editor': '', 'aria-label': t('skills.loadout') } }, [
      h('div', { className: 'skills-loadout__head' }, [
        h('span', { className: 'skills-loadout__title', text: t('skills.loadout') }),
        h('span', { className: 'skills-loadout__hint', attrs: { 'aria-live': 'polite', 'data-role': 'assign-feedback' }, text: feedback || t('skills.loadoutHint') }),
      ]),
      h('div', { className: 'skills-loadout__slots' }, slots),
    ]);
  }

  function nodeIdForSkill(id: SkillId): string | null {
    return world.skillTree.tree()?.nodes.find((n) => n.combatSkillId === id)?.id ?? null;
  }

  function tabBar(tabs: { id: string; label: string }[]): HTMLElement {
    return h('div', { className: 'skills-tabs', attrs: { role: 'tablist' } }, tabs.map((x) => {
      const b = h('button', { className: `skills-tab${x.id === tab ? ' is-active' : ''}`, text: x.label, attrs: { type: 'button', role: 'tab', 'aria-selected': String(x.id === tab), 'data-skill-tab': x.id } });
      b.addEventListener('click', () => {
        tab = x.id;
        focus = null;
        detailOpen = false;
        render();
      });
      return b;
    }));
  }

  /** Every node is rendered (its learn button stays reachable); the tab only shows its own. */
  function list(nodes: readonly SkillNodeDef[], inTab: (n: SkillNodeDef) => boolean): HTMLElement {
    const st = world.skillTree;
    const learned = st.activeSkills();
    const rows = nodes.map((node) => {
      const view = st.nodeView(node.id);
      const skill = nodeSkill(node);
      const learn = createButton({ label: '+', variant: 'primary', title: t('skills.learn', { skill: node.displayName }), onClick: () => { st.learn(node.id); focus = node.id; render(); } });
      learn.classList.add('skills-row__learn');
      learn.dataset.learn = node.id;
      learn.disabled = view.blockedBy !== null;
      learn.addEventListener('click', (e) => e.stopPropagation());
      const assignable = skill !== null && learned.includes(skill);
      const row = h('div', {
        className: `skills-row${node.id === focus ? ' is-selected' : ''}${view.rank > 0 ? ' is-learned' : ''}`,
        attrs: { role: 'button', tabindex: '0', 'data-node': node.id, 'data-rank': String(view.rank), 'data-type': node.type, ...(assignable ? { 'data-assign-skill': skill } : {}) },
      }, [
        nodeIcon(node),
        h('div', { className: 'skills-row__text' }, [
          h('div', { className: 'skills-row__title' }, [
            h('span', { className: 'skills-row__name', text: node.displayName }),
            h('span', { className: 'skills-row__rank', attrs: { 'data-role': 'rank' }, text: `${view.rank}/${node.maxRank}` }),
            badge(node),
          ]),
          h('div', { className: 'skills-row__sum', text: summary(view) }),
        ]),
        learn,
      ]);
      row.hidden = !inTab(node);
      const select = () => {
        focus = node.id;
        detailOpen = true;
        // A learned active skill is armed: the next slot tapped receives it.
        if (assignable) {
          armed = skill;
          feedback = t('skills.chooseSlot', { skill: SKILLS[skill].name });
        }
        render();
      };
      row.addEventListener('click', select);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
      if (assignable) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', skill));
      }
      return row;
    });
    return h('div', { className: 'skills-list', attrs: { 'data-role': 'skill-list' } }, rows);
  }

  function details(view: NodeView, branch: string): HTMLElement {
    const st = world.skillTree;
    const node = view.node;
    const skill = nodeSkill(node);
    const def = view.current ?? view.next;
    const rows: [StringKey, string][] = [];
    if (node.type === 'proc') rows.push(['skills.stat.trigger', procText(node)]);
    else if (isPassive(node)) rows.push(['skills.stat.effect', view.rank ? passiveText(node, view.rank) : '—']);
    else if (def) {
      const e = def.effect;
      if ('power' in e && e.power) rows.push(['skills.stat.damage', t('skills.sum.physical', { pct: pct(e.power) })]);
      if ((e.kind === 'damage' || e.kind === 'dash_strike') && e.onHit) rows.push(['skills.stat.stun', sec(e.onHit.duration)]);
      if (e.kind === 'damage' && e.critBonus) rows.push(['skills.stat.crit', `+${pct(e.critBonus)}`]);
      if (e.kind === 'aoe_damage' || e.kind === 'taunt') rows.push(['skills.stat.radius', t('skills.tilesN', { n: tiles(e.radius) })]);
      if (e.kind === 'taunt' || e.kind === 'status') rows.push(['skills.stat.duration', sec(e.duration)]);
      if (e.kind === 'status' && node.statusId) rows.push(['skills.stat.effect', STATUSES[node.statusId].name]);
      rows.push(['skills.stat.cooldown', sec(def.cooldown)], ['skills.stat.mp', String(def.mpCost)]);
      if (node.rangeTiles) rows.push(['skills.stat.range', t('skills.tilesN', { n: node.rangeTiles })]);
    }
    const next = view.rank >= node.maxRank ? null
      : node.type === 'proc' ? null
        : isPassive(node) ? passiveText(node, view.rank + 1)
          : view.next ? activeText(view.next, node) : null;

    const learn = createButton({
      label: t(view.rank ? 'skills.upgradeBtn' : 'skills.learnBtn'),
      variant: 'primary',
      onClick: () => { st.learn(node.id); render(); },
    });
    learn.dataset.action = 'learn';
    learn.disabled = view.blockedBy !== null;
    const actions: HTMLElement[] = [learn];
    const learned = skill !== null && st.activeSkills().includes(skill);
    if (learned) {
      const layout = st.editingLoadout();
      const inSlot = SKILL_SLOTS.find((s) => layout[s] === skill);
      const equip = inSlot
        ? createButton({ label: t('skills.unequip'), onClick: () => place(inSlot, null) })
        : createButton({ label: t('skills.equip'), onClick: () => { armed = skill; detailOpen = false; feedback = t('skills.chooseSlot', { skill: SKILLS[skill].name }); render(); } });
      equip.dataset.action = inSlot ? 'unequip-skill' : 'equip-skill';
      actions.push(equip);
    }
    const close = h('button', { className: 'skills-detail__close', attrs: { type: 'button', 'aria-label': t('skills.detailClose') } }, [icon('close')]);
    close.addEventListener('click', () => { detailOpen = false; render(); });
    const locked = view.blockedBy && view.blockedBy !== 'not_enough_points' ? t(BLOCKED_TEXT[view.blockedBy]) : null;
    const equippedKey = (() => {
      if (!learned) return null;
      const i = SKILL_SLOTS.findIndex((s) => st.editingLoadout()[s] === skill);
      return i >= 0 ? KEYS[i] : null;
    })();

    return h('aside', { className: 'skills-detail', attrs: { 'data-role': 'skill-detail', 'data-detail-node': node.id } }, [
      close,
      h('div', { className: 'skills-detail__head' }, [
        nodeIcon(node, 'lg'),
        h('div', { className: 'skills-detail__title' }, [
          h('div', { className: 'skills-detail__name', text: node.displayName }),
          h('div', { className: 'skills-detail__meta' }, [
            h('span', { className: 'skills-detail__rank', text: t('skills.rankOf', { rank: view.rank, max: node.maxRank }) }),
            badge(node),
            equippedKey ? h('span', { className: 'skills-detail__slot', text: t('skills.equippedIn', { key: equippedKey }) }) : null,
          ]),
        ]),
      ]),
      h('div', { className: 'skills-detail__body' }, [
        h('p', { className: 'skills-detail__desc', text: node.description }),
        rows.length ? h('dl', { className: 'skills-detail__stats' }, rows.flatMap(([k, v]) => [h('dt', { text: t(k) }), h('dd', { text: v })])) : null,
        next ? h('div', { className: 'skills-detail__next' }, [h('div', { className: 'skills-detail__next-title', text: t('skills.nextRank', { rank: view.rank + 1, max: node.maxRank }) }), h('div', { text: next })]) : null,
        node.branchSpendRequirement
          ? h('div', { className: 'skills-detail__req', text: t('skills.requires', { count: node.branchSpendRequirement, branch: branchName(node.branch, branch), have: Math.min(view.branchSpent, node.branchSpendRequirement) }) })
          : null,
        locked ? h('div', { className: 'skills-detail__req', attrs: { 'data-role': 'locked' }, text: locked }) : null,
      ]),
      h('div', { className: 'skills-detail__actions' }, actions),
    ]);
  }

  render();
  return root;
}

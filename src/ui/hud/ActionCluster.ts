import { POTION_COOLDOWNS, preferredPotion, potionKey } from '../../items/PotionSystem';
import { PLAYER_BASIC_ATTACK, SKILL_SLOTS, type SkillSlot as LoadoutSlot } from '../../data/playerData';
import { SKILLS, type SkillId } from '../../data/skillData';
import { BASIC_DODGE } from '../../combat/DodgeSystem';
import type { CombatWorld } from '../../game/CombatWorld';
import type { Action } from '../../input/Action';
import type { VirtualActionSource } from '../../input/VirtualActionSource';
import { SkillSlot, type SlotContent } from '../components/Slot';
import { h, onPress } from '../dom';
import { ACTION_CLUSTER, ACTION_SLOTS, type ActionSlotDef } from '../data/actionBar';
import type { IconName } from '../icons';

/** Which skill an input action fires for the player right now (skill tree or demo kit). */
function skillForAction(world: CombatWorld, action: Action): SkillId | null {
  if (action === 'attack') return PLAYER_BASIC_ATTACK;
  if ((SKILL_SLOTS as readonly string[]).includes(action)) return world.skillTree.loadout()[action as LoadoutSlot];
  return null;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function skillContent(skillId: SkillId): SlotContent {
  const skill = SKILLS[skillId];
  const abbr = skillId === PLAYER_BASIC_ATTACK ? 'ATK' : skill.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  // White reads as "no colour" on a light disc; basic attack gets the gold accent.
  const color = skill.color !== undefined && skill.color !== 0xffffff ? hex(skill.color) : '#a8823a';
  const glyph: IconName = skillId === PLAYER_BASIC_ATTACK ? 'crossed_swords'
    : /guard|shield|provoke/.test(skillId) ? 'shield'
    : /fire/.test(skillId) ? 'flame' : /heal/.test(skillId) ? 'heal'
    : /arrow|shot/.test(skillId) ? 'bow' : /whirl|berserk/.test(skillId) ? 'whirl' : 'slash';
  return { abbr, color, title: skill.name, glyph };
}

interface LiveSlot {
  def: ActionSlotDef;
  slot: SkillSlot;
  /** The input action this slot presses (null for reserved slots). */
  action: Action | null;
  skillId: SkillId | null;
}

/**
 * Bottom-right: ATK plus four core skills, with skill 5 and utility positions
 * outside the ring. Buttons use the existing keyboard Actions.
 */
export class ActionCluster {
  readonly el: HTMLDivElement;
  private readonly slots: LiveSlot[] = [];
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly world: CombatWorld,
    actions: VirtualActionSource,
  ) {
    this.el = h('div', {
      className: 'hud-actions',
      attrs: { 'data-hud': 'actions' },
      style: {
        width: `calc(${ACTION_CLUSTER.width}px * var(--ui-scale))`,
        height: `calc(${ACTION_CLUSTER.height}px * var(--ui-scale))`,
      },
    });

    for (const def of ACTION_SLOTS) {
      const binding = def.binding;
      const skillId = binding.kind === 'action' ? skillForAction(world, binding.action) : null;
      const content: SlotContent | null = skillId
        ? skillContent(skillId)
        : binding.kind === 'action' && (binding.action === 'hp_potion' || binding.action === 'mp_potion') ? { abbr: binding.action === 'hp_potion' ? 'HP' : 'MP', color: binding.action === 'hp_potion' ? '#86ef8f' : '#7fd4ff', title: binding.action === 'hp_potion' ? 'HP Potion' : 'MP Potion', glyph: 'potion' }
        : def.id === 'dodge' ? { abbr: 'DG', color: '#7fd4ff', title: 'Dodge', glyph: 'dodge' }
        : binding.kind === 'reserved' && binding.abbr
          ? { abbr: binding.abbr, color: binding.color, title: binding.label, glyph: ({ special: 'skills', potion: 'potion', dodge: 'dodge', auto: 'auto', pet: 'pet' } as Record<string, IconName>)[def.id] }
          : null;
      // ATK's swing interval is not a player-facing cooldown: no sweep or timer on it.
      const slot = new SkillSlot({ kind: 'action', size: def.size, keyHint: def.keyHint, content, showCooldown: def.id !== 'attack' });
      slot.el.dataset.slot = def.id;
      slot.el.dataset.group = def.group;
      slot.el.append(h('span', { className: 'hud-action__label', text: def.id === 'attack' ? 'ATK' : def.id.startsWith('skill') ? `Skill ${def.id.slice(5)}` : def.id === 'potion' ? 'HP' : def.id === 'mp_potion' ? 'MP' : def.id === 'pet' ? 'Pet' : def.id[0].toUpperCase() + def.id.slice(1) }));
      // Wide and compact positions; the stylesheet's compact media query switches --ax-now / --ay-now.
      const compact = def.compact === undefined ? { x: def.x, y: def.y } : def.compact;
      slot.el.style.setProperty('--ax', `${def.x}px`);
      slot.el.style.setProperty('--ay', `${def.y}px`);
      if (compact) {
        slot.el.style.setProperty('--ax-c', `${compact.x}px`);
        slot.el.style.setProperty('--ay-c', `${compact.y}px`);
      } else slot.el.dataset.compact = 'hidden';
      slot.el.style.left = 'calc(var(--ax-now, var(--ax)) * var(--ui-scale))';
      slot.el.style.top = 'calc(var(--ay-now, var(--ay)) * var(--ui-scale))';
      if (binding.kind === 'action') {
        const action = binding.action;
        this.cleanups.push(onPress(slot.el, () => actions.press(action), () => actions.release(action)));
        slot.el.setAttribute('role', 'button');
        slot.el.setAttribute('aria-label', content?.title ?? action);
      } else {
        slot.setDisabled(true);
        slot.el.title = binding.label;
        slot.el.setAttribute('role', 'button');
        slot.el.setAttribute('aria-label', binding.label);
      }
      this.slots.push({ def, slot, action: binding.kind === 'action' ? binding.action : null, skillId });
      this.el.append(slot.el);
    }
  }

  update(now: number): void {
    const player = this.world.player;
    const c = player.combat;
    for (const live of this.slots) {
      if (!live.action) continue;
      if (live.action === 'hp_potion' || live.action === 'mp_potion') {
        const resource = live.action === 'hp_potion' ? 'hp' : 'mp';
        const max = resource === 'hp' ? c.stats.maxHp : c.stats.maxMp;
        live.slot.setCooldown(Math.max(0, (c.utilityCooldowns.get(potionKey(resource)) ?? 0) - now), POTION_COOLDOWNS[resource]);
        live.slot.setDisabled(c.dead || c.actionLocked(now) || c[resource] >= max || !preferredPotion(this.world.inventory, resource));
        continue;
      }
      if (live.action === 'dodge') {
        live.slot.setCooldown(Math.max(0, (c.utilityCooldowns.get('dodge') ?? 0) - now), BASIC_DODGE.cooldown);
        live.slot.setDisabled(c.dead || c.actionLocked(now));
        continue;
      }
      // Learned skills (or a job change) can change what a slot casts.
      const current = skillForAction(this.world, live.action);
      if (current !== live.skillId) {
        live.skillId = current;
        live.slot.setContent(current ? skillContent(current) : null);
        live.slot.el.setAttribute('aria-label', current ? SKILLS[current].name : 'Empty skill slot');
      }
      const skillId = live.skillId;
      if (!skillId) {
        live.slot.setCooldown(0, 0);
        live.slot.setDisabled(true);
        continue;
      }
      // The caster's own version of the skill (its learned rank) decides MP and cooldown.
      const skill = this.world.skills.definition(player, skillId) ?? SKILLS[skillId];
      live.slot.setCooldown(this.world.skills.cooldownRemaining(player, skillId, now), this.world.skills.cooldownDuration(player, skillId));
      live.slot.setDisabled(c.dead || c.mp < skill.mpCost);
    }
  }

  destroy(): void {
    for (const cleanup of this.cleanups) cleanup();
  }
}

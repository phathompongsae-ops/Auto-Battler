import { PLAYER_BASIC_ATTACK, SKILL_SLOTS, type SkillSlot as LoadoutSlot } from '../../data/playerData';
import { SKILLS, type SkillId } from '../../data/skillData';
import type { CombatWorld } from '../../game/CombatWorld';
import type { Action } from '../../input/Action';
import type { VirtualActionSource } from '../../input/VirtualActionSource';
import { SkillSlot, type SlotContent } from '../components/Slot';
import { h, onPress } from '../dom';
import { ACTION_CLUSTER, ACTION_SLOTS, type ActionSlotDef } from '../data/actionBar';

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
  return { abbr, color, title: skill.name };
}

interface LiveSlot {
  def: ActionSlotDef;
  slot: SkillSlot;
  /** The input action this slot presses (null for reserved slots). */
  action: Action | null;
  skillId: SkillId | null;
}

/**
 * Bottom-right cluster: large Basic Attack, five skill slots, potion / dodge /
 * special. Buttons press the same input Actions as the keyboard.
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
        : binding.kind === 'reserved' && binding.abbr
          ? { abbr: binding.abbr, color: binding.color, title: binding.label }
          : null;
      const slot = new SkillSlot({ kind: 'action', size: def.size, keyHint: def.keyHint, content });
      slot.el.dataset.slot = def.id;
      slot.el.style.left = `calc(${def.x}px * var(--ui-scale))`;
      slot.el.style.top = `calc(${def.y}px * var(--ui-scale))`;
      if (binding.kind === 'action') {
        const action = binding.action;
        this.cleanups.push(onPress(slot.el, () => actions.press(action), () => actions.release(action)));
        slot.el.setAttribute('role', 'button');
        slot.el.setAttribute('aria-label', content?.title ?? action);
      } else {
        slot.setDisabled(true);
        slot.el.title = binding.label;
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

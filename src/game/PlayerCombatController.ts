import type { SkillSystem } from '../combat/SkillSystem';
import type { TargetingSystem } from '../combat/TargetingSystem';
import type { CombatEntity } from '../combat/types';
import { PLAYER_BASIC_ATTACK, SKILL_SLOTS, type SkillSlot } from '../data/playerData';
import { SKILLS, type SkillId } from '../data/skillData';
import type { Player } from '../entities/Player';
import { DIRECTION_VECTORS } from '../input/Direction';
import type { InputController } from '../input/InputController';

/**
 * A Dodge or potion press made while an action is executing (a swing, a skill
 * wind-up) is kept this long and performed on the first frame the action has
 * finished. It never cancels the action; without this, holding ATK (whose
 * swing locks 444 of every 500 ms) silently swallowed most presses.
 */
export const UTILITY_INPUT_BUFFER_MS = 500;

/** Turns player actions (from any input source) into skill uses. */
export class PlayerCombatController {
  /** Until when a buffered Dodge / potion request stays valid (0 = none). */
  private dodgeRequestUntil = 0;
  private readonly potionRequestUntil = { hp: 0, mp: 0 };

  constructor(
    private readonly player: Player,
    private readonly input: InputController,
    private readonly skills: SkillSystem,
    private readonly targeting: TargetingSystem,
    private readonly enemies: () => readonly CombatEntity[],
    /** The skill on each action slot right now (from the skill tree, or the demo kit). */
    private readonly loadout: () => Record<SkillSlot, SkillId | null>,
    private readonly dodge: (now: number) => void = () => {},
    private readonly potion: (resource: 'hp' | 'mp') => void = () => {},
  ) {}

  update(now: number): void {
    // Always read presses so nothing queued while dead fires on respawn.
    const attackPressed = this.input.consumePressed('attack');
    const attackHeld = this.input.isHeld('attack');
    const cyclePressed = this.input.consumePressed('target_next');
    const dodgePressed = this.input.consumePressed('dodge');
    const hpPressed = this.input.consumePressed('hp_potion');
    const mpPressed = this.input.consumePressed('mp_potion');
    const slotsPressed = SKILL_SLOTS.map((slot) => this.input.consumePressed(slot));

    if (dodgePressed) this.dodgeRequestUntil = now + UTILITY_INPUT_BUFFER_MS;
    if (hpPressed) this.potionRequestUntil.hp = now + UTILITY_INPUT_BUFFER_MS;
    if (mpPressed) this.potionRequestUntil.mp = now + UTILITY_INPUT_BUFFER_MS;
    if (this.player.combat.dead) {
      this.dodgeRequestUntil = this.potionRequestUntil.hp = this.potionRequestUntil.mp = 0;
      return;
    }
    // Buffered utility requests: performed once, on the first frame no action is executing.
    const locked = this.player.combat.actionLocked(now);
    for (const resource of ['hp', 'mp'] as const) {
      if (now > this.potionRequestUntil[resource]) this.potionRequestUntil[resource] = 0;
      else if (!locked) {
        this.potionRequestUntil[resource] = 0;
        this.potion(resource);
      }
    }
    const dodgeWaiting = this.dodgeRequestUntil > 0 && now <= this.dodgeRequestUntil;
    if (!dodgeWaiting) this.dodgeRequestUntil = 0;
    else if (!this.player.combat.actionLocked(now)) {
      this.dodgeRequestUntil = 0;
      this.dodge(now);
    }
    if (this.player.combat.dodge) return;
    // A Dodge waiting for the current swing to end must not be starved by the next one.
    const holdAttack = this.dodgeRequestUntil > 0;

    if (cyclePressed) this.targeting.cycle(this.player, this.enemies());

    // Holding attack keeps swinging as the cooldown allows, without failure spam.
    if ((attackPressed || attackHeld) && !holdAttack) this.cast(PLAYER_BASIC_ATTACK, now, !attackPressed);

    const loadout = this.loadout();
    SKILL_SLOTS.forEach((slot, i) => {
      const skillId = loadout[slot];
      if (slotsPressed[i] && skillId) this.cast(skillId, now, false);
    });
  }

  private cast(skillId: SkillId, now: number, quiet: boolean): void {
    const skill = SKILLS[skillId];
    let target: CombatEntity | null = null;
    if (skill.target !== 'self') {
      target = this.targeting.isValid(this.player, this.targeting.current)
        ? this.targeting.current
        : this.targeting.selectNearest(this.player, this.enemies());
    }

    const result = this.skills.use(this.player, skillId, now, {
      target,
      aim: DIRECTION_VECTORS[this.player.facing],
      quiet,
    });
    if (result.ok && target) this.player.faceToward(target.x, target.y);
  }
}

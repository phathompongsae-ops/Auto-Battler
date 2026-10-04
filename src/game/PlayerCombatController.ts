import type { SkillSystem } from '../combat/SkillSystem';
import type { TargetingSystem } from '../combat/TargetingSystem';
import type { CombatEntity } from '../combat/types';
import { PLAYER_BASIC_ATTACK, SKILL_SLOTS, type SkillSlot } from '../data/playerData';
import { SKILLS, type SkillId } from '../data/skillData';
import type { Player } from '../entities/Player';
import { DIRECTION_VECTORS } from '../input/Direction';
import type { InputController } from '../input/InputController';

/** Turns player actions (from any input source) into skill uses. */
export class PlayerCombatController {
  constructor(
    private readonly player: Player,
    private readonly input: InputController,
    private readonly skills: SkillSystem,
    private readonly targeting: TargetingSystem,
    private readonly enemies: () => readonly CombatEntity[],
    /** The skill on each action slot right now (from the skill tree, or the demo kit). */
    private readonly loadout: () => Record<SkillSlot, SkillId | null>,
  ) {}

  update(now: number): void {
    // Always read presses so nothing queued while dead fires on respawn.
    const attackPressed = this.input.consumePressed('attack');
    const attackHeld = this.input.isHeld('attack');
    const cyclePressed = this.input.consumePressed('target_next');
    const slotsPressed = SKILL_SLOTS.map((slot) => this.input.consumePressed(slot));

    if (this.player.combat.dead) return;

    if (cyclePressed) this.targeting.cycle(this.player, this.enemies());

    // Holding attack keeps swinging as the cooldown allows, without failure spam.
    if (attackPressed || attackHeld) this.cast(PLAYER_BASIC_ATTACK, now, !attackPressed);

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

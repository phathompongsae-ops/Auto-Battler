import type { EventBus } from '../core/EventBus';
import { defaultRng, type Rng } from '../core/rng';
import { SKILLS, type DamageType, type SkillId } from '../data/skillData';
import type { StatusId } from '../data/statusData';
import type { DamageDelivery, GameEvents } from '../game/GameEvents';
import { resolveAttack, resolvePeriodic, type AttackResult } from './damage';
import type { CombatEntity } from './types';

/** A skill's damage type from data; non-damage skills are never resolved here. */
function damageTypeOf(skillId: SkillId): DamageType {
  const effect = SKILLS[skillId].effect;
  if ('damageType' in effect) return effect.damageType;
  throw new Error(`${skillId} is not a damaging skill`);
}

export interface DamageOptions {
  critBonus?: number;
  /** How the hit was delivered, for presentation (area / splash hits skip the per-target impact strip). */
  delivery?: DamageDelivery;
}

/** Resolves damage, healing and death. The only place HP goes down. */
export class CombatSystem {
  /** Simulation time, shared by all incoming damage (including projectiles). */
  now = 0;
  rng: Rng = defaultRng;

  constructor(private readonly events: EventBus<GameEvents>) {}

  /**
   * One damaging hit: hit roll, mitigation by DEF/MDEF, crit. Returns null if
   * the target was already dead, otherwise whether it hit. Callers attaching
   * extra effects (crowd control, on-hit procs) must only apply them on a hit.
   */
  dealDamage(source: CombatEntity, target: CombatEntity, skillId: SkillId, power: number, options: DamageOptions = {}): AttackResult | null {
    if (target.combat.dead) return null;
    if (target.combat.invulnerable(this.now)) {
      this.events.emit('miss', { sourceId: source.id, targetId: target.id, skillId });
      return { hit: false };
    }

    const type = damageTypeOf(skillId);
    const result = resolveAttack(source.combat.stats, target.combat.stats, this.multiplier(source, skillId, type, power), type, this.rng, options.critBonus ?? 0);
    if (!result.hit) {
      this.events.emit('miss', { sourceId: source.id, targetId: target.id, skillId });
      return result;
    }
    this.apply(source, target, skillId, result.amount, result.crit, options.delivery);
    return result;
  }

  /**
   * One damage-over-time tick (Burn): mitigated like a hit and boosted by the
   * same skill / element bonuses, but it never misses or crits. Credited to
   * `source` (kill, loot and quest credit as for any hit). Invulnerability
   * (a dodge) skips the tick.
   */
  dealPeriodicDamage(source: CombatEntity, target: CombatEntity, skillId: SkillId, power: number, statusId: StatusId): number {
    if (target.combat.dead || target.combat.invulnerable(this.now)) return 0;
    const type = damageTypeOf(skillId);
    const amount = resolvePeriodic(source.combat.stats, target.combat.stats, this.multiplier(source, skillId, type, power), type);
    this.apply(source, target, skillId, amount, false, 'dot', statusId);
    return amount;
  }

  /** Skill power with its outgoing bonuses: per-skill, Physical, and the skill's element. */
  private multiplier(source: CombatEntity, skillId: SkillId, type: DamageType, power: number): number {
    const stats = source.combat.stats;
    // Skill-specific damage bonuses (e.g. a set bonus on one skill) and outgoing Physical bonuses scale the multiplier.
    const physical = type === 'physical' ? (stats.physicalDamageBonus ?? 0) : 0;
    const element = SKILLS[skillId].element;
    const elemental = element ? (stats.elementDamageBonus?.[element] ?? 0) : 0;
    return power * (1 + (stats.skillDamageBonus[skillId] ?? 0)) * (1 + physical) * (1 + elemental);
  }

  private apply(source: CombatEntity, target: CombatEntity, skillId: SkillId, amount: number, crit: boolean, delivery?: DamageDelivery, statusId?: StatusId): void {
    target.combat.hp = Math.max(0, target.combat.hp - amount);
    this.events.emit('damage', {
      sourceId: source.id,
      targetId: target.id,
      skillId,
      amount,
      crit,
      // A Burn tick is never a heavy hit (no shake / hit stop per tick).
      heavy: delivery !== 'dot' && (crit || !!SKILLS[skillId].heavy),
      ...(delivery ? { delivery } : {}),
      ...(statusId ? { statusId } : {}),
    });
    if (target.combat.hp === 0) this.kill(target, source);
  }

  /** Healing always succeeds (no hit roll). */
  heal(target: CombatEntity, amount: number): number {
    const c = target.combat;
    if (c.dead) return 0;
    const healed = Math.min(Math.round(amount), c.stats.maxHp - c.hp);
    c.hp += healed;
    this.events.emit('heal', { targetId: target.id, amount: healed });
    return healed;
  }

  kill(target: CombatEntity, killer: CombatEntity | null): void {
    const c = target.combat;
    if (c.dead) return;
    c.hp = 0;
    c.dead = true;
    c.statuses.length = 0;
    c.periodicResources.clear();
    c.dodge = null;
    c.refreshStats();
    this.events.emit('death', { entityId: target.id, killerId: killer?.id ?? null });
  }
}

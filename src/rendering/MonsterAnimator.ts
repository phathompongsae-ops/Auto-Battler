import { SKILLS, type SkillId } from '../data/skillData';
import type { CombatWorld } from '../game/CombatWorld';
import type { Monster } from '../entities/Monster';
import type { MonsterAnimSet } from '../data/monsterArt';
import { MONSTER_ANIM_ART } from '../data/monsterAnimArt';
import { chooseMonsterAnim, oneShotFrame, specialCommitted, type AnimFrame, type MonsterAnimTimeline } from './monsterAnimState';

/*
 * Real monster animation (Visual Pass 4) and combat facing. Presentation only:
 * it follows gameplay events on the simulation clock (world.now, which stops
 * during hit stop exactly like the damage it mirrors) and never feeds back.
 *
 *   skillUsed (no wind-up)  basic attack: contact frame on the damage tick
 *   skillWindup             special: raise / hold for the real wind-up ms, impact on its landing tick
 *                           (whether or not anyone is inside the area)
 *   damage on a monster     hit flinch, unless it is attacking or in a special's wind-up / impact
 *
 * Facing (every monster, real strips or not): toward the target when an attack or wind-up begins and
 * again on the impact tick, by mirroring only. Monsters without strips keep MonsterMotion.
 */

/** Below this speed (world px / s) a monster is standing (same threshold as MonsterMotion). */
const MOVING = 6;

interface Track extends MonsterAnimTimeline {
  actor: Monster;
  offset: number;
  /** The special whose impact facing was already applied. */
  facedImpact: number | null;
  last: AnimFrame | null;
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}

export class MonsterAnimator {
  private readonly tracks = new Map<string, Track>();

  constructor(private readonly world: CombatWorld) {
    world.events.on('mapChanged', () => this.tracks.clear());
    world.events.on('respawn', ({ entityId }) => this.tracks.delete(entityId));
    world.events.on('skillUsed', ({ casterId, skillId, targetId }) => {
      const m = world.monsterById(casterId);
      if (!m) return;
      this.face(m, targetId);
      // Telegraphed skills animate from their skillWindup event (emitted in the same use).
      if (SKILLS[skillId as SkillId]?.windup) return;
      const t = this.track(m);
      t.attackAt = world.now;
      t.hitAt = null;
    });
    world.events.on('skillWindup', ({ casterId, targetId, ms }) => {
      const m = world.monsterById(casterId);
      if (!m) return;
      this.face(m, targetId);
      const t = this.track(m);
      t.special = { start: world.now, windupMs: ms };
      t.attackAt = null;
      t.hitAt = null;
    });
    world.events.on('damage', ({ targetId }) => {
      const m = world.monsterById(targetId);
      const anims = m && this.anims(m);
      if (!m || !anims) return;
      const t = this.track(m);
      const now = world.now;
      const attacking = t.attackAt !== null && oneShotFrame(anims.attack, now - t.attackAt) !== null;
      if (!attacking && !specialCommitted(anims, t, now)) t.hitAt = now;
    });
  }

  /** The real strips a monster draws with, or null (fallback art: MonsterMotion). */
  private anims(m: Monster): MonsterAnimSet | null {
    return m.strips ? (MONSTER_ANIM_ART[m.def.artId ?? m.def.texture]?.anims ?? null) : null;
  }

  private track(m: Monster): Track {
    let t = this.tracks.get(m.id);
    if (!t || t.actor !== m) {
      t = { actor: m, offset: hash(m.id), attackAt: null, special: null, hitAt: null, facedImpact: null, last: null };
      this.tracks.set(m.id, t);
    }
    return t;
  }

  /** Face the attack's target; area skills (no target) face the brain's target, else the player. */
  private face(m: Monster, targetId: string | null): void {
    const target = (targetId ? this.world.getEntity(targetId) : null) ?? m.brain?.target ?? this.world.player;
    if (target) m.faceToward(target.x);
  }

  /** Last frame chosen for a monster (tests and debugging). */
  current(id: string): AnimFrame | null {
    return this.tracks.get(id)?.last ?? null;
  }

  update(): void {
    const now = this.world.now;
    for (const m of this.world.monsters) {
      if (m.combat.dead || !m.visible) continue;
      const t = this.track(m);
      if (t.special && t.facedImpact !== t.special.start && now >= t.special.start + t.special.windupMs) {
        t.facedImpact = t.special.start;
        this.face(m, null);
      }
      const anims = this.anims(m);
      if (!anims) continue;
      const speed = Math.hypot(m.body.velocity.x, m.body.velocity.y);
      t.last = chooseMonsterAnim(anims, { now, dead: false, moving: speed > MOVING, offset: t.offset, timeline: t });
      if (t.last) m.showFrame(t.last.state, t.last.frame);
    }
  }
}

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/game/GameEvents';
import type { CombatWorld } from '../../src/game/CombatWorld';
import { MONSTER_ANIM_STATES, MONSTER_ART, MONSTER_ART_DRAW_SCALE, MONSTER_ART_TINT } from '../../src/data/monsterArt';
import { MONSTER_ANIM_ART } from '../../src/data/monsterAnimArt';
import { MONSTERS } from '../../src/data/monsterData';
import { SKILLS, type SkillId } from '../../src/data/skillData';
import { chooseMonsterAnim, specialFrame, type MonsterAnimTimeline } from '../../src/rendering/monsterAnimState';
import { MonsterAnimator } from '../../src/rendering/MonsterAnimator';
import { MonsterMotion } from '../../src/rendering/MonsterMotion';

const OWNERS = { crypt_lord: 'crypt_lord', grove_guardian: 'grove_guardian', crypt_brute: 'crypt_brute' } as const;
const pub = (url: string) => join(process.cwd(), 'public', url);

describe('Visual Pass 4 animation contracts', () => {
  test('the three priority monsters: shared cell, feet row 2 px above the bottom, drawn at exactly 0.5', () => {
    const cells = { crypt_lord: [224, 192, 190], grove_guardian: [208, 160, 158], crypt_brute: [176, 144, 142] };
    assert.deepEqual(Object.keys(MONSTER_ANIM_ART).sort(), Object.keys(OWNERS).sort());
    for (const [id, owner] of Object.entries(OWNERS)) {
      const art = MONSTER_ANIM_ART[id];
      assert.deepEqual([art.frameWidth, art.frameHeight, art.feetRow], cells[id as keyof typeof cells], id);
      assert.ok(art.frameHeight - art.feetRow >= 2, `${id} 2 px clear below the feet`);
      const def = MONSTERS[owner];
      assert.equal(art.homeScale, def.scale, `${id} fitted for its owner's tier scale`);
      assert.equal(MONSTER_ART_DRAW_SCALE * ((def.scale ?? 1) / art.homeScale), 0.5);
      // Every state is one strip of that same cell (no per-state sizes exist in the data model).
      for (const s of MONSTER_ANIM_STATES) assert.equal(art.anims[s].url, `assets/monsters/${id}/${s}.png`);
    }
    assert.equal(MONSTERS.crypt_brute.artId, 'crypt_brute');
    assert.equal(MONSTERS.crypt_brute.texture, 'crypt_skeleton', 'the Skeleton sheet stays the Brute fallback');
  });

  test('frame counts / fps: walk 8@8 (Brute 6@9), contact-first attack 5@12 inside the basic interval, hit 3@15', () => {
    for (const [id, art] of Object.entries(MONSTER_ANIM_ART)) {
      assert.deepEqual([art.anims.walk.frames, art.anims.walk.fps], id === 'crypt_brute' ? [6, 9] : [8, 8], id);
      assert.deepEqual([art.anims.attack.frames, art.anims.attack.fps], [5, 12], id);
      assert.deepEqual([art.anims.hit.frames, art.anims.hit.fps], [3, 15], id);
      assert.deepEqual([art.anims.idle.frames, art.anims.idle.fps], [2, 3], id);
      const basic = SKILLS[MONSTERS[OWNERS[id as keyof typeof OWNERS]].attackSkill];
      assert.equal(basic.windup, undefined, 'basic attacks land on use: the strip must be contact-first');
      assert.ok((art.anims.attack.frames * 1000) / art.anims.attack.fps < basic.cooldown, `${id} attack ends before the next one`);
    }
  });

  test('specials match the real gameplay wind-ups (Grave Slam 1100, Stomp 1000, Bone Smash 1400) and raise fits inside them', () => {
    const expected = { crypt_lord: 1100, grove_guardian: 1000, crypt_brute: 1400 };
    for (const [id, art] of Object.entries(MONSTER_ANIM_ART)) {
      const sp = art.anims.special;
      assert.equal(sp.windupMs, expected[id as keyof typeof expected], id);
      assert.equal(sp.frames, sp.raise + sp.hold + sp.impact + sp.recovery);
      for (const skill of sp.skills) assert.equal(SKILLS[skill as SkillId].windup?.ms, sp.windupMs, `${id} ${skill}`);
      assert.ok((sp.raise * 1000) / sp.fps < sp.windupMs, `${id} raise fits the wind-up`);
    }
    assert.ok(MONSTER_ANIM_ART.crypt_lord.anims.special.skills.includes(MONSTERS.crypt_lord.specialSkill!));
    assert.ok(MONSTER_ANIM_ART.grove_guardian.anims.special.skills.includes(MONSTERS.grove_guardian.specialSkill!));
    assert.ok(MONSTER_ANIM_ART.crypt_brute.anims.special.skills.includes(MONSTERS.crypt_brute.specialSkill!));
  });

  test('standing heights keep the tier order: skeleton < brute < knight < lord; boar < guardian', () => {
    const world = (rows: number) => rows * 0.5;
    const knight = world(MONSTER_ART.crypt_knight.feetRow);
    const skeleton = MONSTER_ART.crypt_skeleton.feetRow * 0.5 * (MONSTERS.crypt_skeleton.scale! / MONSTER_ART.crypt_skeleton.homeScale);
    const [bMin, bMax] = MONSTER_ANIM_ART.crypt_brute.standHeight;
    assert.ok(world(bMin) > skeleton && world(bMax) < knight, `brute ${world(bMin)}..${world(bMax)} between ${skeleton} and ${knight}`);
    assert.ok(world(MONSTER_ANIM_ART.crypt_lord.standHeight[0]) > knight);
    assert.ok(world(MONSTER_ANIM_ART.grove_guardian.standHeight[0]) > world(MONSTER_ART.elite_boar.feetRow));
    for (const art of Object.values(MONSTER_ANIM_ART)) assert.ok(art.standHeight[1] <= art.feetRow);
  });

  test('pending contracts are never requested; integrated ones have every strip at its exact size', () => {
    for (const [id, art] of Object.entries(MONSTER_ANIM_ART)) {
      for (const s of MONSTER_ANIM_STATES) {
        const file = pub(art.anims[s].url);
        if (art.status === 'pending') continue;
        assert.ok(existsSync(file), `${id} ${s}`);
        const b = readFileSync(file);
        assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [art.frameWidth * art.anims[s].frames, art.frameHeight], `${id} ${s}`);
      }
    }
  });

  test('world body is unchanged by the new cells (same math as Monster): 20k x 12k from k*(-10, +2), feet at +13k', () => {
    for (const [id, art] of Object.entries(MONSTER_ANIM_ART)) {
      const k = MONSTERS[OWNERS[id as keyof typeof OWNERS]].scale!;
      const s = MONSTER_ART_DRAW_SCALE * (k / art.homeScale);
      const originY = (art.feetRow - (13 * k) / s) / art.frameHeight;
      assert.ok(originY > 0 && originY < 1, id);
      const offX = art.frameWidth / 2 + (-10 * k) / s, offY = originY * art.frameHeight + (2 * k) / s;
      // Body top-left relative to the position, back in world px.
      assert.ok(Math.abs((offX - art.frameWidth / 2) * s - -10 * k) < 1e-9 && Math.abs((offY - originY * art.frameHeight) * s - 2 * k) < 1e-9, id);
      assert.ok(Math.abs((art.feetRow - originY * art.frameHeight) * s - 13 * k) < 1e-9, `${id} feet on the shadow`);
    }
  });

  test('the Brute tint belongs to the borrowed Skeleton sheet only', () => {
    assert.ok(MONSTER_ART_TINT.crypt_brute);
    assert.equal(MONSTER_ART.crypt_brute, undefined, 'no dedicated idle sheet yet: the resolver falls back to crypt_skeleton');
  });
});

describe('animation state choice (pure)', () => {
  const anims = MONSTER_ANIM_ART.crypt_lord.anims;
  const tl = (t: Partial<MonsterAnimTimeline> = {}): MonsterAnimTimeline => ({ attackAt: null, special: null, hitAt: null, ...t });
  const pick = (t: MonsterAnimTimeline, now: number, moving = false, dead = false) => chooseMonsterAnim(anims, { now, dead, moving, offset: 0, timeline: t });

  test('idle at rest, walk while moving, nothing while dead', () => {
    assert.equal(pick(tl(), 1000)?.state, 'idle');
    assert.equal(pick(tl(), 1000, true)?.state, 'walk');
    assert.equal(pick(tl({ attackAt: 1000 }), 1000, false, true), null);
  });

  test('basic attack shows its contact frame on the damage tick and ends after its strip', () => {
    assert.deepEqual(pick(tl({ attackAt: 1000 }), 1000), { state: 'attack', frame: 0 });
    assert.equal(pick(tl({ attackAt: 1000 }), 1000 + 4 * (1000 / 12) + 1)?.frame, 4);
    assert.equal(pick(tl({ attackAt: 1000 }), 1000 + 5 * (1000 / 12) + 1, true)?.state, 'walk');
  });

  test('special: wind-up until exactly the gameplay impact tick, then impact, recovery, done', () => {
    const t = tl({ special: { start: 0, windupMs: 1100 } });
    const sp = anims.special;
    assert.equal(pick(t, 0)?.phase, 'windup');
    assert.ok(pick(t, 1099)!.frame >= sp.raise && pick(t, 1099)!.frame < sp.raise + sp.hold, 'held loop at the end of the wind-up');
    assert.deepEqual(pick(t, 1100), { state: 'special', frame: sp.raise + sp.hold, phase: 'impact' });
    assert.equal(pick(t, 1100 + 2 * (1000 / 12))?.phase, 'recovery');
    assert.equal(pick(t, 1100 + 5 * (1000 / 12) + 1)?.state, 'idle');
    // Timing comes from the wind-up event, not from a damage event: a whiff animates identically.
    assert.equal(specialFrame(sp, 1100, 1100)?.phase, 'impact');
  });

  test('priority: special wind-up / impact > attack > special recovery > hit > walk', () => {
    const recovering = 1100 + 2 * (1000 / 12) + 1;
    assert.equal(pick(tl({ special: { start: 0, windupMs: 1100 }, attackAt: 500, hitAt: 500 }), 600, true)?.state, 'special');
    assert.equal(pick(tl({ special: { start: 0, windupMs: 1100 }, attackAt: recovering }), recovering)?.state, 'attack', 'an attack cuts recovery');
    assert.equal(pick(tl({ special: { start: 0, windupMs: 1100 }, hitAt: recovering }), recovering)?.state, 'special', 'a hit never cuts the special');
    assert.equal(pick(tl({ attackAt: 0, hitAt: 0 }), 10, true)?.state, 'attack');
    assert.equal(pick(tl({ hitAt: 0 }), 10, true)?.state, 'hit');
    assert.equal(pick(tl({ hitAt: 0 }), 201, true)?.state, 'walk');
  });
});

/** A fake world with one monster that has (or lacks) real strips. */
function rig(strips: boolean, artId = 'crypt_lord') {
  const events = new EventBus<GameEvents>();
  const shown: [string, number][] = [];
  let flip = false;
  let pose = [0, 0, 0];
  const actor = {
    id: 'boss', x: 100, y: 100, visible: true, def: { id: artId, texture: artId, scale: 2.5 },
    strips: strips ? { idle: 'i', walk: 'w', attack: 'a', special: 's', hit: 'h' } : null,
    combat: { dead: false, hp: 500 }, body: { velocity: { x: 0, y: 0 } }, brain: { target: null as null | { x: number } },
    faceToward(x: number) { if (Math.abs(x - this.x) > 1) flip = x < this.x; },
    showFrame: (s: string, f: number) => shown.push([s, f]),
    setPose: (x: number, y: number, r: number) => { pose = [x, y, r]; },
  };
  const player = { id: 'player', x: 60, y: 100 };
  const world = { events, now: 0, monsters: [actor], player, monsterById: (id: string) => (id === actor.id ? actor : null),
    getEntity: (id: string) => (id === actor.id ? actor : id === 'player' ? player : undefined), skills: { windingUp: () => false } };
  const animator = new MonsterAnimator(world as unknown as CombatWorld);
  const motion = new MonsterMotion(world as unknown as CombatWorld);
  const tick = (ms: number) => { world.now += ms; animator.update(); motion.update(ms); };
  return { world, events, actor, player, animator, tick, shown, flip: () => flip, pose: () => pose };
}

describe('MonsterAnimator / MonsterMotion (presentation only)', () => {
  test('faces the target when a basic attack begins, when a special winds up and again on its impact tick', () => {
    const r = rig(true);
    r.events.emit('skillUsed', { casterId: 'boss', skillId: 'slime_bump', targetId: 'player' });
    assert.equal(r.flip(), true, 'player on the left: mirrored');
    r.player.x = 160;
    r.events.emit('skillUsed', { casterId: 'boss', skillId: 'crypt_slam', targetId: 'player' });
    r.events.emit('skillWindup', { casterId: 'boss', skillId: 'crypt_slam', targetId: null, radius: 84, ms: 1100 });
    assert.equal(r.flip(), false, 'area wind-up faces the player (no target id)');
    r.tick(600);
    r.player.x = 40;
    r.tick(400);
    assert.equal(r.flip(), false, 'no turning mid wind-up');
    r.tick(100);
    assert.equal(r.flip(), true, 'impact tick faces the target');
    assert.equal(r.animator.current('boss')?.phase, 'impact');
  });

  test('basic attack: contact frame on the use tick; a hit during it and during a wind-up is ignored', () => {
    const r = rig(true);
    r.tick(16);
    r.events.emit('skillUsed', { casterId: 'boss', skillId: 'slime_bump', targetId: 'player' });
    r.events.emit('damage', { sourceId: 'player', targetId: 'boss', skillId: 'basic_attack', amount: 5, crit: false, heavy: false } as GameEvents['damage']);
    r.tick(0);
    assert.deepEqual(r.animator.current('boss'), { state: 'attack', frame: 0 });
    r.tick(500);
    assert.equal(r.animator.current('boss')?.state, 'idle', 'the hit taken mid-attack did not replay afterwards');
    r.events.emit('skillWindup', { casterId: 'boss', skillId: 'crypt_slam', targetId: null, radius: 84, ms: 1100 });
    r.events.emit('damage', { sourceId: 'player', targetId: 'boss', skillId: 'basic_attack', amount: 5, crit: false, heavy: false } as GameEvents['damage']);
    r.tick(16);
    assert.equal(r.animator.current('boss')?.state, 'special');
    r.tick(1084 + 5 * (1000 / 12) + 1);
    r.events.emit('damage', { sourceId: 'player', targetId: 'boss', skillId: 'basic_attack', amount: 5, crit: false, heavy: false } as GameEvents['damage']);
    r.tick(0);
    assert.equal(r.animator.current('boss')?.state, 'hit');
  });

  test('walk while moving; respawn and map change reset the timeline', () => {
    const r = rig(true);
    r.actor.body.velocity.x = 75;
    r.tick(16);
    assert.equal(r.animator.current('boss')?.state, 'walk');
    r.actor.body.velocity.x = 0;
    r.events.emit('skillUsed', { casterId: 'boss', skillId: 'slime_bump', targetId: 'player' });
    r.events.emit('respawn', { entityId: 'boss' });
    r.tick(1);
    assert.equal(r.animator.current('boss')?.state, 'idle');
  });

  test('real-strip monsters get no procedural lunge / bob / recoil; fallback monsters keep them and get no frames', () => {
    const real = rig(true);
    real.actor.body.velocity.x = 75;
    real.events.emit('miss', { sourceId: 'boss', targetId: 'player', skillId: 'slime_bump' });
    real.events.emit('damage', { sourceId: 'player', targetId: 'boss', skillId: 'basic_attack', amount: 5, crit: false, heavy: false } as GameEvents['damage']);
    for (let i = 0; i < 10; i++) real.tick(16);
    assert.deepEqual(real.pose(), [0, 0, 0]);
    assert.ok(real.shown.length > 0);

    const fallback = rig(false);
    fallback.actor.body.velocity.x = 75;
    fallback.events.emit('miss', { sourceId: 'boss', targetId: 'player', skillId: 'slime_bump' });
    for (let i = 0; i < 5; i++) fallback.tick(16);
    assert.ok(fallback.pose().some((v) => v !== 0), 'fallback keeps procedural motion');
    assert.equal(fallback.shown.length, 0, 'fallback art is never driven frame by frame');
    fallback.events.emit('skillUsed', { casterId: 'boss', skillId: 'slime_bump', targetId: 'player' });
    assert.equal(fallback.flip(), true, 'fallback monsters still face their target on attack');
  });

  test('presentation never touches simulation state', () => {
    const r = rig(true);
    const before = JSON.stringify({ x: r.actor.x, y: r.actor.y, v: r.actor.body.velocity, hp: r.actor.combat.hp, now: r.world.now });
    r.events.emit('skillWindup', { casterId: 'boss', skillId: 'crypt_slam', targetId: null, radius: 84, ms: 1100 });
    r.animator.update();
    assert.equal(JSON.stringify({ x: r.actor.x, y: r.actor.y, v: r.actor.body.velocity, hp: r.actor.combat.hp, now: r.world.now }), before);
  });
});

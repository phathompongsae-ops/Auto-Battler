import type { MonsterAiState } from '../ai/MonsterBrain';
import type { GameEvents } from '../game/GameEvents';
import type { CombatWorld } from '../game/CombatWorld';
import type { WorldOverlays } from '../rendering/WorldOverlays';

export interface EventRecord {
  type: keyof GameEvents;
  t: number;
  source?: string;
  target?: string;
  entity?: string;
  skill?: string;
  amount?: number;
  crit?: boolean;
  reason?: string;
  level?: number;
  item?: string;
}

/**
 * Dev-only hooks for browser tests and manual debugging. Never included in
 * production behaviour (only attached when import.meta.env.DEV).
 */
export function createDevApi(world: CombatWorld, overlays: WorldOverlays) {
  const log: EventRecord[] = [];
  const record = (type: keyof GameEvents, extra: Omit<EventRecord, 'type' | 't'>) =>
    log.push({ type, t: world.now, ...extra });

  const ev = world.events;
  ev.on('damage', (e) => record('damage', { source: e.source.id, target: e.target.id, skill: e.skill.id, amount: e.amount, crit: e.crit }));
  ev.on('heal', (e) => record('heal', { target: e.target.id, amount: e.amount }));
  ev.on('death', (e) => record('death', { entity: e.entity.id, source: e.killer?.id }));
  ev.on('respawn', (e) => record('respawn', { entity: e.entity.id }));
  ev.on('skillUsed', (e) => record('skillUsed', { source: e.caster.id, skill: e.skill.id, target: e.target?.id }));
  ev.on('skillFailed', (e) => record('skillFailed', { source: e.caster.id, skill: e.skill.id, reason: e.reason }));
  ev.on('projectileSpawned', (e) => record('projectileSpawned', { source: e.projectile.owner.id, skill: e.projectile.skill.id }));
  ev.on('projectileRemoved', (e) => record('projectileRemoved', { skill: e.projectile.skill.id, reason: e.reason }));
  ev.on('statusApplied', (e) => record('statusApplied', { target: e.target.id, skill: e.status.id }));
  ev.on('statusExpired', (e) => record('statusExpired', { target: e.target.id, skill: e.status.id }));
  ev.on('expGained', (e) => record('expGained', { entity: e.entity.id, amount: e.amount }));
  ev.on('levelUp', (e) => record('levelUp', { entity: e.entity.id, level: e.level }));
  ev.on('lootDropped', (e) => record('lootDropped', { item: e.drop.item.id }));
  ev.on('lootPicked', (e) => record('lootPicked', { item: e.drop.item.id }));
  ev.on('lootExpired', (e) => record('lootExpired', { item: e.drop.item.id }));
  ev.on('targetChanged', (e) => record('targetChanged', { target: e.target?.id }));

  const monster = (id: string) => {
    const m = world.monsters.find((x) => x.id === id);
    if (!m) throw new Error(`No monster ${id}`);
    return m;
  };

  const api = {
    world,
    log,
    clearLog: () => (log.length = 0),
    setPeaceful: (on: boolean) => (world.peaceful = on),
    setRng: (value: number | null) => world.setRng(value === null ? Math.random : () => value),
    teleportPlayer: (x: number, y: number) => world.player.body.reset(x, y),
    setPlayerHp: (hp: number) => (world.player.combat.hp = hp),
    setPlayerMp: (mp: number) => (world.player.combat.mp = mp),
    resetCooldowns: () => world.player.combat.cooldowns.clear(),
    selectTarget: (id: string | null) => world.targeting.select(id ? monster(id) : null),
    isHighlighted: (id: string) => overlays.isHighlighted(monster(id)),
    monster: (id: string) => {
      const m = monster(id);
      return {
        id: m.id,
        x: m.x,
        y: m.y,
        spawnX: m.spawnX,
        spawnY: m.spawnY,
        hp: m.combat.hp,
        maxHp: m.combat.stats.maxHp,
        dead: m.combat.dead,
        state: m.brain.state as MonsterAiState,
        visible: m.visible,
      };
    },
    /** Move a monster (and optionally its spawn) and reset it to idle. */
    placeMonster: (id: string, x: number, y: number, setSpawn = false) => {
      const m = monster(id);
      if (setSpawn) {
        m.spawnX = x;
        m.spawnY = y;
      }
      if (m.combat.dead) m.respawn();
      m.body.reset(x, y);
      m.brain.setState('idle', world.now);
    },
    setMonsterHp: (id: string, hp: number) => (monster(id).combat.hp = hp),
    player: () => {
      const p = world.player;
      const c = p.combat;
      return {
        x: p.x,
        y: p.y,
        state: p.state,
        facing: p.facing,
        hp: c.hp,
        mp: c.mp,
        dead: c.dead,
        level: c.level,
        exp: c.exp,
        stats: { ...c.stats },
        statuses: c.statuses.map((s) => s.def.id),
        cooldowns: Object.fromEntries([...c.cooldowns].map(([k, v]) => [k, Math.max(0, v - world.now)])),
        target: world.targeting.current?.id ?? null,
        inventory: Object.fromEntries(world.inventory.entries()),
        respawnAt: world.playerRespawnAt,
      };
    },
    drops: () => world.loot.drops.map((d) => ({ id: d.id, item: d.item.id, x: d.x, y: d.y })),
    projectiles: () => world.projectiles.active.length,
    /** Back to a clean slate: player at spawn, monsters home, nothing on the ground. */
    reset: () => {
      world.respawnPlayer();
      world.player.combat.level = 1;
      world.player.combat.exp = 0;
      world.player.combat.reset();
      world.inventory.clear();
      world.loot.clear();
      world.projectiles.clear();
      world.targeting.select(null);
      for (const m of world.monsters) {
        m.spawnX = m.homeX;
        m.spawnY = m.homeY;
        if (m.combat.dead) m.respawn();
        m.combat.reset();
        m.snapToSpawn();
        m.brain.setState('idle', world.now);
      }
      log.length = 0;
    },
  };
  return api;
}

export type DevApi = ReturnType<typeof createDevApi>;

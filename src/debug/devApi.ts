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
  ev.on('damage', (e) => record('damage', { source: e.sourceId, target: e.targetId, skill: e.skillId, amount: e.amount, crit: e.crit }));
  ev.on('heal', (e) => record('heal', { target: e.targetId, amount: e.amount }));
  ev.on('death', (e) => record('death', { entity: e.entityId, source: e.killerId ?? undefined }));
  ev.on('respawn', (e) => record('respawn', { entity: e.entityId }));
  ev.on('skillUsed', (e) => record('skillUsed', { source: e.casterId, skill: e.skillId, target: e.targetId ?? undefined }));
  ev.on('skillFailed', (e) => record('skillFailed', { source: e.casterId, skill: e.skillId, reason: e.reason }));
  ev.on('hitCancelled', (e) => record('hitCancelled', { source: e.casterId, target: e.targetId, skill: e.skillId, reason: e.reason }));
  ev.on('projectileSpawned', (e) => record('projectileSpawned', { source: e.ownerId, skill: e.skillId }));
  ev.on('projectileRemoved', (e) => record('projectileRemoved', { skill: e.skillId, reason: e.reason }));
  ev.on('statusApplied', (e) => record('statusApplied', { target: e.targetId, skill: e.statusId }));
  ev.on('statusExpired', (e) => record('statusExpired', { target: e.targetId, skill: e.statusId }));
  ev.on('expGained', (e) => record('expGained', { entity: e.entityId, amount: e.amount }));
  ev.on('levelUp', (e) => record('levelUp', { entity: e.entityId, level: e.level }));
  ev.on('lootDropped', (e) => record('lootDropped', { item: e.itemId }));
  ev.on('lootPicked', (e) => record('lootPicked', { item: e.itemId }));
  ev.on('lootExpired', (e) => record('lootExpired', { item: e.itemId }));
  ev.on('targetChanged', (e) => record('targetChanged', { target: e.targetId ?? undefined }));

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
    drops: () => world.loot.drops.map((d) => ({ id: d.id, item: d.itemId, x: d.x, y: d.y })),
    projectiles: () => world.projectiles.active.length,
    projectilePositions: () => world.projectiles.active.map((p) => ({ id: p.id, x: p.x, y: p.y })),
    /** Simulation clock, freeze state and whether physics is paused. */
    clock: () => ({
      now: world.now,
      frozen: world.frozen,
      physicsPaused: world.player.scene.physics.world.isPaused,
    }),
    hitStop: (ms: number) => world.requestHitStop(ms),
    monsterIds: () => world.monsters.map((m) => m.id),
    /** Back to a clean slate: player at spawn, monsters home, nothing on the ground. */
    reset: () => {
      world.respawnPlayer();
      world.player.combat.level = 1;
      world.player.combat.exp = 0;
      world.player.combat.reset();
      world.inventory.clear();
      world.loot.clear();
      world.projectiles.clear();
      world.skills.clear();
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

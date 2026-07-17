// Presentation-only projectile framework. It never decides hits or applies damage.
export class ProjectilePresenter {
  constructor({ createView, destroyView } = {}) {
    this.defs = new Map();
    this.active = new Map();
    this.pools = new Map();
    this.nextId = 1;
    this.createView = createView || ((def) => ({ def }));
    this.destroyView = destroyView || (() => {});
  }

  register(id, def) {
    if (!id || typeof id !== 'string') throw new TypeError('projectile id must be a string');
    if (this.defs.has(id)) throw new Error(`Duplicate projectile id: ${id}`);
    const normalized = Object.freeze({
      speed: Math.max(0.001, Number(def.speed ?? 8)),
      lifetime: Math.max(0.01, Number(def.lifetime ?? 3)),
      maxPool: Math.max(0, Number(def.maxPool ?? 24)),
      arcHeight: Number(def.arcHeight ?? 0),
      homing: Boolean(def.homing),
      ...def,
    });
    this.defs.set(id, normalized);
    return this;
  }

  spawn(projectileId, { from, to, targetProvider, ownerId, metadata } = {}) {
    const def = this.defs.get(projectileId);
    if (!def) throw new Error(`Unknown projectile: ${projectileId}`);
    if (!from || !to) throw new Error('Projectile requires from and to positions');
    const pool = this.pools.get(projectileId) || [];
    const view = pool.pop() || this.createView(def, projectileId);
    this.pools.set(projectileId, pool);
    const item = {
      id: this.nextId++, projectileId, def, view, ownerId, metadata,
      from: { ...from }, to: { ...to }, targetProvider,
      elapsed: 0, progress: 0,
    };
    view?.reset?.(item);
    view?.setVisible?.(true);
    this.active.set(item.id, item);
    return item.id;
  }

  update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    for (const p of [...this.active.values()]) {
      p.elapsed += step;
      if (p.def.homing && p.targetProvider) {
        const next = p.targetProvider();
        if (next) p.to = { ...next };
      }
      const dx = p.to.x - p.from.x;
      const dy = p.to.y - p.from.y;
      const dz = p.to.z - p.from.z;
      const distance = Math.hypot(dx, dy, dz) || 0.0001;
      p.progress = Math.min(1, p.progress + (p.def.speed * step) / distance);
      const t = p.progress;
      const pos = {
        x: p.from.x + dx * t,
        y: p.from.y + dy * t + Math.sin(Math.PI * t) * p.def.arcHeight,
        z: p.from.z + dz * t,
      };
      p.view?.setPosition?.(pos, t, p);
      p.view?.update?.(step, p);
      if (t >= 1 || p.elapsed >= p.def.lifetime) this.release(p.id, t >= 1 ? 'arrived' : 'expired');
    }
  }

  release(id, reason = 'cancelled') {
    const p = this.active.get(id);
    if (!p) return false;
    p.view?.onRelease?.(reason, p);
    p.view?.setVisible?.(false);
    this.active.delete(id);
    const pool = this.pools.get(p.projectileId) || [];
    if (pool.length < p.def.maxPool) pool.push(p.view);
    else this.destroyView(p.view, p.def, p.projectileId);
    this.pools.set(p.projectileId, pool);
    return true;
  }

  releaseByOwner(ownerId) {
    for (const p of [...this.active.values()]) if (p.ownerId === ownerId) this.release(p.id);
  }

  clear() { for (const id of [...this.active.keys()]) this.release(id); }

  dispose() {
    this.clear();
    for (const [id, pool] of this.pools) {
      const def = this.defs.get(id);
      pool.forEach((view) => this.destroyView(view, def, id));
    }
    this.pools.clear();
    this.defs.clear();
  }

  snapshot() {
    return {
      registered: this.defs.size,
      active: this.active.size,
      pooled: [...this.pools.values()].reduce((n, p) => n + p.length, 0),
    };
  }
}

// Standalone presentation-only effect manager. No combat/game-loop integration.
export class EffectManager {
  constructor({ createView, destroyView } = {}) {
    this.defs = new Map();
    this.active = new Map();
    this.pools = new Map();
    this.nextId = 1;
    this.createView = createView || ((def) => ({ def }));
    this.destroyView = destroyView || (() => {});
  }

  register(id, def) {
    if (!id || typeof id !== 'string') throw new TypeError('effect id must be a string');
    if (this.defs.has(id)) throw new Error(`Duplicate effect id: ${id}`);
    const normalized = {
      duration: Math.max(0, Number(def.duration ?? 0.4)),
      loop: Boolean(def.loop),
      maxPool: Math.max(0, Number(def.maxPool ?? 16)),
      layer: def.layer || 'world',
      ...def,
    };
    this.defs.set(id, Object.freeze(normalized));
    return this;
  }

  spawn(effectId, payload = {}) {
    const def = this.defs.get(effectId);
    if (!def) throw new Error(`Unknown effect: ${effectId}`);
    const pool = this.pools.get(effectId) || [];
    const view = pool.pop() || this.createView(def, effectId);
    this.pools.set(effectId, pool);
    const instance = {
      id: this.nextId++, effectId, def, view, payload,
      age: 0, done: false, paused: false,
    };
    if (view?.reset) view.reset(payload, def);
    if (view?.setVisible) view.setVisible(true);
    this.active.set(instance.id, instance);
    return instance.id;
  }

  update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    for (const fx of this.active.values()) {
      if (fx.paused || fx.done) continue;
      fx.age += step;
      fx.view?.update?.(step, fx.age, fx.payload, fx.def);
      if (!fx.def.loop && fx.age >= fx.def.duration) this.stop(fx.id);
    }
  }

  stop(instanceId) {
    const fx = this.active.get(instanceId);
    if (!fx) return false;
    fx.done = true;
    fx.view?.setVisible?.(false);
    fx.view?.onRelease?.();
    this.active.delete(instanceId);
    const pool = this.pools.get(fx.effectId) || [];
    if (pool.length < fx.def.maxPool) pool.push(fx.view);
    else this.destroyView(fx.view, fx.def, fx.effectId);
    this.pools.set(fx.effectId, pool);
    return true;
  }

  stopByOwner(ownerId) {
    for (const fx of [...this.active.values()]) {
      if (fx.payload?.ownerId === ownerId) this.stop(fx.id);
    }
  }

  clear() {
    for (const id of [...this.active.keys()]) this.stop(id);
  }

  dispose() {
    this.clear();
    for (const [effectId, pool] of this.pools) {
      const def = this.defs.get(effectId);
      pool.forEach((view) => this.destroyView(view, def, effectId));
    }
    this.pools.clear();
    this.defs.clear();
  }

  snapshot() {
    return {
      registered: this.defs.size,
      active: this.active.size,
      pooled: [...this.pools.values()].reduce((n, p) => n + p.length, 0),
      byEffect: [...this.defs.keys()].map((id) => ({
        id,
        active: [...this.active.values()].filter((x) => x.effectId === id).length,
        pooled: this.pools.get(id)?.length || 0,
      })),
    };
  }
}

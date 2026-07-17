/*
 * Standalone Asset Manager framework.
 *
 * Intentionally not wired into src/game.js yet. Integration belongs in a
 * separate, reviewable task after the active Shop Drawer work is complete.
 */
(function attachAssetManager(global) {
  'use strict';

  class AssetManager {
    constructor(options = {}) {
      this.THREE = options.THREE || global.THREE;
      if (!this.THREE) throw new Error('AssetManager requires THREE');

      this.baseUrl = options.baseUrl || document.baseURI;
      this.logger = options.logger || console;
      this.textureLoader = options.textureLoader || new this.THREE.TextureLoader();
      this.records = new Map();
      this.fallbackTexture = options.fallbackTexture || this._createFallbackTexture();
    }

    register(entries) {
      if (!Array.isArray(entries)) throw new TypeError('entries must be an array');

      for (const entry of entries) {
        this._validateEntry(entry);
        if (this.records.has(entry.key)) {
          throw new Error(`Duplicate asset key: ${entry.key}`);
        }

        this.records.set(entry.key, {
          key: entry.key,
          type: entry.type || 'texture',
          path: entry.path,
          url: new URL(entry.path, this.baseUrl).href,
          state: 'registered',
          value: null,
          error: null,
          refs: 0,
          promise: null,
        });
      }

      return this;
    }

    has(key) {
      return this.records.has(key);
    }

    getRecord(key) {
      const record = this.records.get(key);
      if (!record) throw new Error(`Unknown asset key: ${key}`);
      return record;
    }

    async preload(keys) {
      const list = keys == null ? [...this.records.keys()] : [...keys];
      const results = await Promise.allSettled(list.map((key) => this.load(key)));

      return {
        total: list.length,
        loaded: results.filter((r) => r.status === 'fulfilled').length,
        failed: results.filter((r) => r.status === 'rejected').length,
        results,
      };
    }

    load(key) {
      const record = this.getRecord(key);
      if (record.state === 'loaded') return Promise.resolve(record.value);
      if (record.promise) return record.promise;

      record.state = 'loading';
      record.promise = this._loadRecord(record)
        .then((value) => {
          record.value = value;
          record.state = 'loaded';
          record.error = null;
          return value;
        })
        .catch((error) => {
          record.state = 'failed';
          record.error = error;
          record.value = null;
          this.logger.error?.(`[AssetManager] failed: ${record.key} -> ${record.path}`, error);
          throw error;
        })
        .finally(() => {
          record.promise = null;
        });

      return record.promise;
    }

    acquire(key, options = {}) {
      const record = this.getRecord(key);
      if (record.state === 'loaded' && record.value) {
        record.refs += 1;
        return record.value;
      }

      if (options.allowFallback !== false && record.type === 'texture') {
        this.logger.warn?.(`[AssetManager] using fallback for unloaded asset: ${key}`);
        return this.fallbackTexture;
      }

      throw new Error(`Asset is not loaded: ${key}`);
    }

    async acquireAsync(key, options = {}) {
      try {
        await this.load(key);
        return this.acquire(key, options);
      } catch (error) {
        if (options.allowFallback !== false && this.getRecord(key).type === 'texture') {
          return this.fallbackTexture;
        }
        throw error;
      }
    }

    release(key) {
      const record = this.getRecord(key);
      record.refs = Math.max(0, record.refs - 1);
      return record.refs;
    }

    dispose(key, options = {}) {
      const record = this.getRecord(key);
      if (record.refs > 0 && !options.force) return false;

      if (record.value && typeof record.value.dispose === 'function') {
        record.value.dispose();
      }

      record.value = null;
      record.error = null;
      record.state = 'registered';
      record.promise = null;
      record.refs = 0;
      return true;
    }

    disposeUnused() {
      let disposed = 0;
      for (const key of this.records.keys()) {
        const record = this.records.get(key);
        if (record.refs === 0 && record.state === 'loaded' && this.dispose(key)) disposed += 1;
      }
      return disposed;
    }

    disposeAll() {
      for (const key of this.records.keys()) this.dispose(key, { force: true });
      if (this.fallbackTexture && typeof this.fallbackTexture.dispose === 'function') {
        this.fallbackTexture.dispose();
      }
    }

    retryFailed() {
      const failedKeys = [...this.records.values()]
        .filter((record) => record.state === 'failed')
        .map((record) => record.key);
      return this.preload(failedKeys);
    }

    snapshot() {
      return [...this.records.values()].map((record) => ({
        key: record.key,
        type: record.type,
        path: record.path,
        state: record.state,
        refs: record.refs,
        error: record.error ? String(record.error.message || record.error) : null,
      }));
    }

    _loadRecord(record) {
      if (record.type !== 'texture') {
        return Promise.reject(new Error(`Unsupported asset type: ${record.type}`));
      }

      return new Promise((resolve, reject) => {
        this.textureLoader.load(record.url, resolve, undefined, reject);
      });
    }

    _validateEntry(entry) {
      if (!entry || typeof entry !== 'object') throw new TypeError('asset entry must be an object');
      if (!entry.key || typeof entry.key !== 'string') throw new Error('asset entry requires string key');
      if (!entry.path || typeof entry.path !== 'string') throw new Error(`asset ${entry.key} requires string path`);
    }

    _createFallbackTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillRect(16, 16, 16, 16);
      const texture = new this.THREE.CanvasTexture(canvas);
      texture.name = 'asset-manager-fallback';
      texture.needsUpdate = true;
      return texture;
    }
  }

  global.AssetManager = AssetManager;
})(window);

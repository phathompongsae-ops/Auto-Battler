// ============================================================
// ASSET & ANIMATION FRAMEWORK RUNTIME v1 — Archer / Slime / Golem pilot
// ============================================================
// Smallest stable shared framework that proves the asset + animation pipeline for
// exactly three pilots against the contract in PR #21 (coco/asset-pilot-integration
// -contract-v1, data/design/asset-pilot-integration-v1.json). It does NOT rewrite the
// combat loop: it OBSERVES the existing per-unit logical state (u.animState / u.moving /
// u.action_state / u.alive / u.deathT) and drives a separate VISUAL layer — multi-frame
// animation, facing, and layered Skill/projectile/impact VFX — on top of the existing
// render objects.
//
// Loading: a classic <script> in autochess.html BEFORE src/game.js (sets the global
// AssetAnimationRuntime). game.js calls five one-line, null-guarded hooks; with the module
// absent or AAF_ACTIVE=false the game renders exactly as before.
//
// Node-testability: the pure core (manifest, resolver, texture-cache bookkeeping, animation
// controller state machine, VFX budget, FPS sanitising) has NO reference to THREE or the DOM
// and is exercised by tools/test-asset-animation-runtime.mjs. The browser adapter (canvas
// sprite-sheet generation, mesh wiring, VFX meshes) is feature-detected and dormant under Node.
//
// SCOPE / OWNERSHIP: this module is CC-owned runtime. It generates ONLY clearly-labelled
// technical placeholders (programmatic colored frame strips). It NEVER produces final
// Archer/Slime/Golem art (ChatGPT-owned) and NEVER marks a placeholder canonical
// (canonicalApproved stays false until an exact file is explicitly approved).
// ============================================================
globalThis.AssetAnimationRuntime = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants & state tables (pure data — shared by core + adapter + tests)
  // ---------------------------------------------------------------------------
  const STATES = ['idle', 'move', 'attack', 'skill', 'hit', 'death'];
  // Priority: death > hit > skill > attack > move > idle. A lower-priority request must
  // never interrupt a higher-priority state that is still playing/locked.
  const STATE_PRIORITY = { idle: 0, move: 1, attack: 2, skill: 3, hit: 4, death: 5 };
  // idle/move loop; attack/skill/hit/death play once.
  const STATE_LOOPING = { idle: true, move: true, attack: false, skill: false, hit: false, death: false };
  // Deterministic per-state fallback chain when a state's frames are unavailable (contract §Fallbacks).
  const STATE_FALLBACK = {
    idle: [],
    move: ['idle'],
    attack: ['idle'],
    skill: ['attack', 'idle'],
    hit: ['idle'],
    death: ['hit', 'idle'],
  };

  // FPS policy: default 12, accepted range 8–15, per-state override allowed. Never 0/neg/NaN/Infinity.
  const DEFAULT_FPS = 12, MIN_FPS = 8, MAX_FPS = 15;
  function sanitizeFps(v) {
    if (!Number.isFinite(v) || v <= 0) return DEFAULT_FPS;
    return Math.min(MAX_FPS, Math.max(MIN_FPS, v));
  }

  // Two quality tiers. Frame counts per state; Showcase is richer, Gameplay is the mobile
  // minimum. Both are valid animation — Showcase degrades to Gameplay under VFX budget stress.
  const QUALITY_TIERS = {
    gameplay: { label: 'Gameplay Minimum', frames: { idle: 2, move: 2, attack: 2, skill: 2, hit: 1, death: 2 } },
    showcase: { label: 'Demo Showcase', frames: { idle: 4, move: 6, attack: 4, skill: 5, hit: 2, death: 5 } },
  };
  const DEFAULT_QUALITY = 'gameplay';
  function normalizeQuality(q) { return QUALITY_TIERS[q] ? q : DEFAULT_QUALITY; }

  // Conservative transient-VFX cap (documented). "Transient" = non-character overlays
  // (projectiles/trails/impacts/ground/death sparks). Character animation is NEVER dropped.
  const MAX_TRANSIENT_VFX = 24;

  // ---------------------------------------------------------------------------
  // Pilot manifest — the three contract pilots. Fields mirror PR #21's contract.
  // canonicalApproved is false for all: no exact file has been approved, so resolution
  // lands on the programmatic placeholder. Anchors/scale come from the contract; they drive
  // ONLY the local body mesh (feet-at-ground), never grid coords / occupancy / range / pathing.
  // ---------------------------------------------------------------------------
  const PILOT_MANIFEST = {
    'hero.archer': {
      unitId: 'hero.archer', role: 'player_hero', displayName: 'Archer',
      canonicalPath: 'assets/canonical/heroes/archer.png',
      canonicalApproved: false,          // never true until an exact file is explicitly approved
      candidatePath: null,               // no license-verified download yet
      placeholder: { type: 'programmatic', label: 'AAF technical placeholder', baseColor: '#5f8f4e', accent: '#d8c37a' },
      fallbackPath: null,                // -> built-in geometric visual is the last resort
      frame: { w: 64, h: 96 },           // placeholder frame pixel dims (<= 512 contract budget)
      world: { scale: 1.0, footAnchorX: 0.5, footAnchorY: 0.92, verticalOffset: 0, shadowOffset: 0 },
      facingMode: 'flip_x',
      qualityTier: DEFAULT_QUALITY,
      fpsByState: {},                    // per-state overrides; empty -> DEFAULT_FPS everywhere
      loopingByState: {},                // overrides STATE_LOOPING when present
      statesAvailable: STATES.slice(),   // all six states generated for the placeholder
      vfx: { projectile: 'arrow', trail: 'arrow_trail', impact: 'arrow_hit', ranged: true },
      provenanceStatus: 'placeholder',   // source status: placeholder | candidate | canonical
      timing: {},                        // normalized VFX timing markers default to combat timing
      match: { heroKey: 'archer' },
    },
    'monster.slime': {
      unitId: 'monster.slime', role: 'normal_enemy', displayName: 'Slime',
      canonicalPath: 'assets/canonical/monsters/slime.png',
      canonicalApproved: false,
      candidatePath: null,
      placeholder: { type: 'programmatic', label: 'AAF technical placeholder', baseColor: '#4ea3b0', accent: '#bff2ff' },
      fallbackPath: null,
      frame: { w: 64, h: 64 },
      world: { scale: 0.85, footAnchorX: 0.5, footAnchorY: 0.90, verticalOffset: 0, shadowOffset: 0 },
      facingMode: 'flip_x',
      qualityTier: DEFAULT_QUALITY,
      fpsByState: {},
      loopingByState: {},
      statesAvailable: STATES.slice(),
      vfx: { impact: 'slime_splat', ranged: false },
      provenanceStatus: 'placeholder',
      timing: {},
      match: { enemyName: 'Slime', sprite: null },
    },
    'monster.golem': {
      unitId: 'monster.golem', role: 'miniboss_pilot', displayName: 'Golem',
      canonicalPath: 'assets/canonical/monsters/golem.png',
      canonicalApproved: false,
      candidatePath: null,
      placeholder: { type: 'programmatic', label: 'AAF technical placeholder', baseColor: '#8a7a63', accent: '#c8b48c' },
      fallbackPath: null,
      frame: { w: 96, h: 112 },
      world: { scale: 1.35, footAnchorX: 0.5, footAnchorY: 0.94, verticalOffset: 0, shadowOffset: 0 },
      facingMode: 'flip_x',
      qualityTier: DEFAULT_QUALITY,
      fpsByState: {},
      loopingByState: {},
      statesAvailable: STATES.slice(),
      vfx: { impact: 'golem_impact', ground: 'golem_dust', ranged: false },
      provenanceStatus: 'placeholder',
      timing: {},
      match: { enemyName: 'Golem', sprite: 'Golem' },
    },
  };

  // ---------------------------------------------------------------------------
  // Asset resolution — canonical-approved file -> explicit candidate -> placeholder ->
  // built-in geometric fallback. Pure; broken/missing never throws.
  // ---------------------------------------------------------------------------
  function resolveAsset(record) {
    if (!record || typeof record !== 'object') {
      return { status: 'fallback', source: 'geometric', path: null, canonicalApproved: false };
    }
    if (record.canonicalApproved === true && typeof record.canonicalPath === 'string' && record.canonicalPath) {
      return { status: 'canonical', source: 'canonical_file', path: record.canonicalPath, canonicalApproved: true };
    }
    if (typeof record.candidatePath === 'string' && record.candidatePath) {
      return { status: 'candidate', source: 'candidate_file', path: record.candidatePath, canonicalApproved: false };
    }
    if (record.placeholder && record.placeholder.type === 'programmatic') {
      return { status: 'placeholder', source: 'programmatic', path: null, canonicalApproved: false };
    }
    if (typeof record.placeholder === 'string' && record.placeholder) {
      return { status: 'placeholder', source: 'placeholder_file', path: record.placeholder, canonicalApproved: false };
    }
    if (typeof record.fallbackPath === 'string' && record.fallbackPath) {
      return { status: 'placeholder', source: 'placeholder_file', path: record.fallbackPath, canonicalApproved: false };
    }
    return { status: 'fallback', source: 'geometric', path: null, canonicalApproved: false };
  }

  // State resolution: pick the actual state whose frames to play, applying STATE_FALLBACK when
  // the requested state is unavailable. `available` is a Set of present state names. Returns the
  // resolved state plus whether a fallback was applied (caller logs once). Deterministic.
  function resolveState(requested, available) {
    const have = available instanceof Set ? available : new Set(available || STATES);
    if (!STATE_PRIORITY.hasOwnProperty(requested)) requested = 'idle';
    if (have.has(requested)) return { state: requested, fellBack: false };
    const chain = STATE_FALLBACK[requested] || [];
    for (const alt of chain) if (have.has(alt)) return { state: alt, fellBack: true, from: requested };
    if (have.has('idle')) return { state: 'idle', fellBack: true, from: requested };
    return { state: requested, fellBack: true, from: requested, empty: true };
  }

  function framesForState(record, state) {
    const tier = QUALITY_TIERS[normalizeQuality(record && record.qualityTier)];
    const n = tier.frames[state];
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function fpsForState(record, state) {
    const over = record && record.fpsByState ? record.fpsByState[state] : undefined;
    return sanitizeFps(over === undefined ? DEFAULT_FPS : over);
  }
  function loopingForState(record, state) {
    const over = record && record.loopingByState ? record.loopingByState[state] : undefined;
    return typeof over === 'boolean' ? over : !!STATE_LOOPING[state];
  }

  // ---------------------------------------------------------------------------
  // Texture cache — keyed by resolved path/synthetic key, reference-counted so shared textures
  // are created once and never disposed while any controller still uses them. `deps.create(key)`
  // builds the backing resource (a THREE texture in the browser, a stub in tests); `deps.dispose`
  // frees it. Pure bookkeeping otherwise.
  // ---------------------------------------------------------------------------
  function createTextureCache(deps) {
    const create = deps && typeof deps.create === 'function' ? deps.create : ((k) => ({ key: k }));
    const dispose = deps && typeof deps.dispose === 'function' ? deps.dispose : (() => {});
    const entries = new Map(); // key -> { resource, refs }
    let creates = 0, disposes = 0;
    return {
      acquire(key) {
        let e = entries.get(key);
        if (!e) { e = { resource: create(key), refs: 0 }; entries.set(key, e); creates++; }
        e.refs++;
        return e.resource;
      },
      release(key) {
        const e = entries.get(key);
        if (!e) return;
        e.refs--;
        if (e.refs <= 0) { entries.delete(key); disposes++; try { dispose(e.resource, key); } catch (_) {} }
      },
      has(key) { return entries.has(key); },
      refs(key) { const e = entries.get(key); return e ? e.refs : 0; },
      size() { return entries.size; },
      stats() { return { live: entries.size, creates, disposes }; },
      // Force-drop everything (run reset). Never called mid-frame while refs are legitimately held.
      clear() { for (const [k, e] of entries) { disposes++; try { dispose(e.resource, k); } catch (_) {} } entries.clear(); },
    };
  }

  // ---------------------------------------------------------------------------
  // VFX budget — caps concurrent transient overlays and records the documented graceful
  // degradation order. Pure counter/bookkeeping; the adapter consults it before spawning.
  // Degradation order (worst-first to shed): particles/debris -> trails -> ground effects ->
  // reduce showcase FPS to gameplay FPS -> (never) character/attack/impact.
  // ---------------------------------------------------------------------------
  const VFX_CLASS = { particle: 0, trail: 1, ground: 2, projectile: 3, impact: 4, character: 5 };
  const DROPPABLE_ORDER = ['particle', 'trail', 'ground']; // impact/projectile/character are essential-ish; never character
  function createVfxBudget(cap) {
    const max = Number.isFinite(cap) && cap > 0 ? cap : MAX_TRANSIENT_VFX;
    let active = 0, dropped = 0;
    return {
      cap: max,
      // Returns true if a transient of `cls` may spawn now. Character is never budget-limited.
      canSpawn(cls) {
        if (cls === 'character' || cls === 'impact') return true; // core visuals always allowed
        if (active < max) return true;
        dropped++;
        return false;
      },
      onSpawn() { active++; },
      onDispose() { if (active > 0) active--; },
      active() { return active; },
      droppedCount() { return dropped; },
      reset() { active = 0; dropped = 0; },
    };
  }

  // ---------------------------------------------------------------------------
  // AnimationController — one per attached pilot unit. Pure state machine + frame timing.
  // Holds the per-unit animation record the contract asks for. No THREE/DOM here.
  // ---------------------------------------------------------------------------
  class AnimationController {
    constructor(record, opts) {
      opts = opts || {};
      this.record = record;
      this.available = new Set(record && record.statesAvailable ? record.statesAvailable : STATES);
      this.qualityTier = normalizeQuality(record && record.qualityTier);
      this.currentState = 'idle';
      this.previousState = 'idle';
      this.resolvedState = 'idle';   // after STATE_FALLBACK
      this.frameIndex = 0;
      this.frameCount = framesForState(record, 'idle');
      this.elapsed = 0;              // seconds accumulated toward the next frame
      this.stateStartTime = 0;       // logical clock at the current state's start
      this.clock = 0;                // monotonic seconds fed by update()
      this.lockedUntil = 0;          // one-shot states lock until finished (or death: forever)
      this.facing = 1;               // +1 right, -1 left (observed from the render body)
      this.visualLayers = [];        // ids of active transient layers owned by this unit
      this.disposed = false;
      this.finished = false;         // current one-shot state finished playing
      this._fellBackState = null;    // last state that required a fallback (log-once guard set)
      this._loggedFallback = new Set();
      this.onFallback = typeof opts.onFallback === 'function' ? opts.onFallback : null;
    }

    setQuality(tier) {
      this.qualityTier = normalizeQuality(tier);
      if (this.record) this.record.qualityTier = this.qualityTier;
      this.frameCount = framesForState(this.record, this.resolvedState);
      if (this.frameIndex >= this.frameCount) this.frameIndex = this.frameCount - 1;
    }

    setAvailable(states) { this.available = states instanceof Set ? states : new Set(states || STATES); }

    // Request a logical state. Honors priority: a lower-priority request is ignored while a
    // higher-priority one-shot is still locked. death is terminal (never leaves). Returns true
    // if the state actually changed.
    requestState(state, opts) {
      if (this.disposed) return false;
      if (!STATE_PRIORITY.hasOwnProperty(state)) state = 'idle';
      opts = opts || {};
      // death is absolute and terminal
      if (this.currentState === 'death') return false;
      // while a locked higher/equal-priority one-shot plays, ignore strictly-lower requests
      const locked = this.clock < this.lockedUntil;
      if (locked && STATE_PRIORITY[state] < STATE_PRIORITY[this.currentState]) return false;
      if (state === this.currentState && !opts.restart) return false;
      this._enter(state);
      return true;
    }

    _enter(state) {
      const res = resolveState(state, this.available);
      if (res.fellBack) {
        // one concise warning per (unit,state) — never per frame
        if (!this._loggedFallback.has(state)) {
          this._loggedFallback.add(state);
          if (this.onFallback) this.onFallback(state, res.state, this.record);
        }
      }
      this.previousState = this.currentState;
      this.currentState = state;
      this.resolvedState = res.state;
      this.frameCount = framesForState(this.record, res.state);
      this.frameIndex = 0;
      this.elapsed = 0;
      this.finished = false;
      this.stateStartTime = this.clock;
      const looping = loopingForState(this.record, state);
      if (!looping) {
        const fps = fpsForState(this.record, res.state);
        const dur = this.frameCount / fps;
        // death locks forever (terminal); other one-shots lock for their play duration
        this.lockedUntil = state === 'death' ? Infinity : this.clock + dur;
      } else {
        this.lockedUntil = 0;
      }
    }

    // Advance by dt seconds (already scaled by game speed by the caller). Never freezes at high
    // speed: dt may cover multiple frames, so we consume it in a loop. One-shot states clamp at
    // the last frame and mark finished; looping states wrap.
    update(dt) {
      if (this.disposed) return;
      if (!Number.isFinite(dt) || dt <= 0) { this.clock += (Number.isFinite(dt) && dt > 0 ? dt : 0); return; }
      this.clock += dt;
      const fps = fpsForState(this.record, this.resolvedState);
      const frameDur = 1 / fps; // fps is sanitized > 0
      this.elapsed += dt;
      let guard = 0;
      const looping = loopingForState(this.record, this.currentState);
      while (this.elapsed >= frameDur && guard++ < 1024) {
        this.elapsed -= frameDur;
        if (looping) {
          this.frameIndex = (this.frameIndex + 1) % this.frameCount;
        } else {
          if (this.frameIndex < this.frameCount - 1) this.frameIndex++;
          else { this.finished = true; this.elapsed = 0; break; }
        }
      }
      // A finished non-looping, non-terminal state releases its lock; the driver may then fall
      // back to move/idle on the next sync. death stays finished+locked forever.
      if (this.finished && this.currentState !== 'death') this.lockedUntil = 0;
    }

    // Normalized 0..1 progress through the current state (for VFX timing markers).
    progress() {
      if (this.frameCount <= 1) return this.finished ? 1 : 0;
      return Math.min(1, (this.frameIndex + this.elapsed * fpsForState(this.record, this.resolvedState)) / (this.frameCount - 1));
    }

    snapshot() {
      return {
        currentState: this.currentState, previousState: this.previousState, resolvedState: this.resolvedState,
        frameIndex: this.frameIndex, frameCount: this.frameCount, elapsed: this.elapsed,
        stateStartTime: this.stateStartTime, lockedUntil: this.lockedUntil, facing: this.facing,
        qualityTier: this.qualityTier, visualLayers: this.visualLayers.length, disposed: this.disposed,
        finished: this.finished,
      };
    }

    dispose() { this.disposed = true; this.visualLayers.length = 0; }
  }

  // Map a logical unit's engine state onto a requested animation state (priority-ordered).
  // Reads only existing engine fields; never mutates the unit. `prevHp`/hit is passed in.
  function deriveState(u) {
    if (!u) return 'idle';
    if (!u.alive || u.deathT !== undefined) return 'death';
    if (u._aafHit && u._aafHit > 0) return 'hit';
    if (u.action_state === 'casting') return 'skill';
    if (u.animState === 'attack') return 'attack';
    if (u.moving) return 'move';
    return 'idle';
  }

  // ===========================================================================
  // Public core API (available under Node) + browser adapter (feature-detected).
  // ===========================================================================
  const core = {
    STATES, STATE_PRIORITY, STATE_LOOPING, STATE_FALLBACK,
    DEFAULT_FPS, MIN_FPS, MAX_FPS, sanitizeFps,
    QUALITY_TIERS, DEFAULT_QUALITY, normalizeQuality,
    MAX_TRANSIENT_VFX,
    PILOT_MANIFEST,
    resolveAsset, resolveState, framesForState, fpsForState, loopingForState,
    createTextureCache, createVfxBudget, VFX_CLASS, DROPPABLE_ORDER,
    AnimationController, deriveState,
    // identify which pilot (if any) a runtime unit is, by real runtime identity
    identifyPilot(u) {
      if (!u || typeof u !== 'object') return null;
      for (const id in PILOT_MANIFEST) {
        const m = PILOT_MANIFEST[id].match || {};
        if (m.heroKey && u.heroKey === m.heroKey) return id;
      }
      // enemies: match by sprite key first (Golem), then by name prefix (Slime/Golem)
      for (const id in PILOT_MANIFEST) {
        const m = PILOT_MANIFEST[id].match || {};
        if (m.sprite && u.sprite === m.sprite) return id;
      }
      for (const id in PILOT_MANIFEST) {
        const m = PILOT_MANIFEST[id].match || {};
        if (m.enemyName && typeof u.name === 'string' && u.name.indexOf(m.enemyName) === 0) return id;
      }
      return null;
    },
  };

  // Browser adapter is attached below (same file) when THREE + document exist. Under Node this
  // stays a no-op set so the core object is fully usable by the test harness.
  let adapter = null;
  const hasBrowser = (typeof document !== 'undefined') && (typeof globalThis.THREE !== 'undefined');

  const api = Object.assign({}, core, {
    AAF_ACTIVE: true,
    _hasBrowser: hasBrowser,
    // ---- game.js hooks (all no-ops until the adapter is installed) ----
    onUnitCreated(u) { if (adapter) adapter.onUnitCreated(u); },
    onUnitRemoved(u) { if (adapter) adapter.onUnitRemoved(u); },
    onUnitReset(u) { if (adapter) adapter.onUnitReset(u); },
    tickAnim(u, dt) { if (adapter) return adapter.tickAnim(u, dt); return false; },
    tickWorld(dt) { if (adapter) adapter.tickWorld(dt); },
    _markHit(u) { if (adapter && adapter.markHit) adapter.markHit(u); },
    // ---- debug/introspection (used by the debug UI + tests) ----
    _installAdapter(a) { adapter = a; },
    getController(u) { return u && u._aafCtrl ? u._aafCtrl : null; },
    debugInfo() { return adapter ? adapter.debugInfo() : { active: api.AAF_ACTIVE, controllers: 0, textures: 0, vfx: 0 }; },
    // development-only debug driver (no-ops without the browser adapter)
    debugControllers() { return adapter ? adapter.debugControllers() : []; },
    debugDrive(pilotId, state) { return adapter ? adapter.debugDrive(pilotId, state) : false; },
    debugSetQuality(pilotId, tier) { return adapter ? adapter.debugSetQuality(pilotId, tier) : false; },
    debugForceMissing(pilotId, state) { return adapter ? adapter.debugForceMissing(pilotId, state) : null; },
    debugSetVfx(on) { if (adapter) adapter.debugSetVfx(on); },
    debugSpawnImpact(pilotId) { if (adapter) adapter.debugSpawnImpact(pilotId); },
    debugTick(dt) { if (adapter) adapter.debugTick(dt); },
  });

  return api;
})();

// ============================================================================
// BROWSER ADAPTER — installed only when THREE + document exist (dormant under Node).
// Owns: programmatic placeholder sprite-sheet textures, the character-layer mesh binding,
// and the layered transient VFX (projectile / trail / impact / ground / death spark).
// It reads existing engine state and drives visuals; it NEVER changes combat math, damage,
// targeting, occupancy, grid coords, or timing. VFX follows combat; combat never waits on VFX.
// ============================================================================
(function installAssetAnimationBrowserAdapter() {
  const AAR = globalThis.AssetAnimationRuntime;
  if (!AAR || !AAR._hasBrowser) return;
  const THREE = globalThis.THREE;

  const cache = AAR.createTextureCache({
    create(key) { return buildPlaceholderSheet(key); },
    dispose(res) { if (res && res.texture && res.texture.dispose) res.texture.dispose(); },
  });
  const budget = AAR.createVfxBudget(AAR.MAX_TRANSIENT_VFX);
  const controllers = new Set();     // live controllers (for debugInfo / world tick)
  const transients = [];             // active transient VFX layer records
  let vfxEnabled = true;             // debug/global toggle for transient VFX layers (visual only)

  // --- placeholder sprite-sheet generation (clearly-labelled technical placeholder) ---
  // Key format: aaf://<pilotId>/<state>/<quality> . A horizontal strip of N frames; each frame
  // draws the pilot silhouette with a per-frame motion cue so animation is visibly moving, feet
  // anchored to the frame bottom (stable baseline across states). NearestFilter, alpha.
  function buildPlaceholderSheet(key) {
    const m = /^aaf:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(key);
    const pilotId = m ? m[1] : 'hero.archer';
    const state = m ? m[2] : 'idle';
    const quality = m ? m[3] : 'gameplay';
    const rec = AAR.PILOT_MANIFEST[pilotId] || AAR.PILOT_MANIFEST['hero.archer'];
    const n = AAR.framesForState({ qualityTier: quality }, state);
    const fw = rec.frame.w, fh = rec.frame.h;
    const c = document.createElement('canvas');
    c.width = fw * n; c.height = fh;
    const g = c.getContext('2d');
    const base = (rec.placeholder && rec.placeholder.baseColor) || '#888';
    const accent = (rec.placeholder && rec.placeholder.accent) || '#ccc';
    for (let i = 0; i < n; i++) {
      drawPlaceholderFrame(g, i * fw, fw, fh, i, n, state, base, accent, rec);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.repeat.set(1 / n, 1); tex.offset.set(0, 0); tex.needsUpdate = true;
    return { texture: tex, frames: n, canvas: c };
  }

  function drawPlaceholderFrame(g, x0, fw, fh, i, n, state, base, accent, rec) {
    g.save();
    g.translate(x0, 0);
    g.clearRect(0, 0, fw, fh);
    const phase = n > 1 ? i / (n - 1) : 0;            // 0..1 across the strip
    const cx = fw / 2;
    // motion cues per state (visual only)
    let bob = 0, squash = 1, lean = 0, alpha = 1;
    if (state === 'idle') bob = Math.sin(phase * Math.PI * 2) * fh * 0.02;
    else if (state === 'move') { bob = Math.abs(Math.sin(phase * Math.PI * 2)) * fh * 0.05; lean = Math.sin(phase * Math.PI * 2) * fw * 0.06; }
    else if (state === 'attack') { lean = (phase < 0.5 ? -1 : 1) * fw * 0.14 * (0.4 + phase); }
    else if (state === 'skill') { squash = 1 + phase * 0.12; bob = -phase * fh * 0.03; }
    else if (state === 'hit') { lean = -fw * 0.12 * (1 - phase); }
    else if (state === 'death') { squash = 1 - phase * 0.55; alpha = 1 - phase * 0.65; }
    g.globalAlpha = alpha;
    const bodyW = fw * 0.52 * squash, bodyH = fh * 0.7 * (2 - squash) / 1;
    const footY = fh - fh * 0.06;                     // consistent feet baseline near the bottom
    const topY = footY - bodyH;
    // shadow
    g.globalAlpha = alpha * 0.3; g.fillStyle = '#000';
    g.beginPath(); g.ellipse(cx, footY + fh * 0.02, bodyW * 0.6, fh * 0.03, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = alpha;
    // body
    g.fillStyle = base;
    roundRectPath(g, cx - bodyW / 2 + lean * 0.4, topY, bodyW, bodyH, Math.min(bodyW, bodyH) * 0.28);
    g.fill();
    // accent band + facing marker (asymmetry so X-flip reads clearly)
    g.fillStyle = accent;
    g.fillRect(cx - bodyW / 2 + lean * 0.4, topY + bodyH * 0.32 + bob * 0.2, bodyW, Math.max(2, bodyH * 0.08));
    g.beginPath(); g.arc(cx + bodyW * 0.18 + lean, topY + bodyH * 0.2, Math.max(2, bodyW * 0.1), 0, Math.PI * 2); g.fill();
    // tiny state/frame label so testers can read the sheet (dev placeholder)
    g.globalAlpha = alpha * 0.85; g.fillStyle = '#0a0704';
    g.font = 'bold ' + Math.round(fh * 0.11) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(state[0].toUpperCase() + (i + 1), cx, 2);
    g.restore();
  }
  function roundRectPath(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function texKey(pilotId, state, quality) { return 'aaf://' + pilotId + '/' + state + '/' + quality; }

  // ---- per-unit lifecycle ----
  function onUnitCreated(u) {
    if (!AAR.AAF_ACTIVE || !u || u._aafCtrl) return;
    const pilotId = AAR.identifyPilot(u);
    if (!pilotId) return;
    const record = shallowCloneRecord(AAR.PILOT_MANIFEST[pilotId]);
    const ctrl = new AAR.AnimationController(record, {
      onFallback(reqState, resolved, rec) {
        // one concise warning per (unit,state) — the controller already de-dupes
        console.warn('[AAF] ' + rec.unitId + ': state "' + reqState + '" unavailable -> "' + resolved + '" (placeholder fallback)');
      },
    });
    ctrl.pilotId = pilotId;
    ctrl.unit = u;
    u._aafCtrl = ctrl;
    u._aafOwned = true;
    u._aafHit = 0;
    controllers.add(ctrl);
    bindCharacterLayer(u, ctrl);
    // enter idle immediately so the first frame is correct
    ctrl.requestState('idle', { restart: true });
    syncCharacterTexture(u, ctrl);
  }

  function shallowCloneRecord(rec) {
    // clone so per-unit quality/fps overrides never mutate the shared manifest
    return JSON.parse(JSON.stringify(rec));
  }

  // Bind the framework's animated placeholder to the EXISTING body mesh. For a textured plane
  // (Archer 'Sniper' / Golem) we take over its material.map; for a geometric box (Slime) we
  // rebuild the mesh as a plane. Feet stay at group y=0 (anchor/offset are local only — grid
  // coords, occupancy, range, and pathing are never touched).
  function bindCharacterLayer(u, ctrl) {
    const rec = ctrl.record, w = rec.world;
    const planeW = (rec.frame.w / rec.frame.h) * 1.4 * w.scale; // keep aspect; scale by manifest
    const planeH = 1.4 * w.scale;
    if (!u.body || !u.body.geometry || u.body.geometry.type !== 'PlaneGeometry') {
      // rebuild box body as a plane (Slime path)
      const oldBody = u.body;
      const geo = new THREE.PlaneGeometry(planeW, planeH);
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, alphaTest: 0.4 });
      const plane = new THREE.Mesh(geo, mat);
      plane.userData = { isUnit: true, unit: u };
      plane.position.copy(oldBody.position);
      plane.scale.x = oldBody.scale.x;
      u.group.add(plane);
      u.group.remove(oldBody);
      if (oldBody.geometry) oldBody.geometry.dispose();
      if (oldBody.material) oldBody.material.dispose();
      u.body = plane;
    } else {
      // reuse the plane; drop its old shared/clone map ownership (we set our own cached tex)
      u.body.geometry.dispose();
      u.body.geometry = new THREE.PlaneGeometry(planeW, planeH);
      u.body.material.transparent = true;
      if (u.body.material.alphaTest === 0) u.body.material.alphaTest = 0.4;
    }
    u.body.position.y = planeH / 2 + (w.verticalOffset || 0);
    u.halfH = planeH / 2;
    u._aafPlaneH = planeH;
    u._aafTexKey = null; // force first sync to acquire
  }

  // Swap the body texture to the current resolved-state sheet (cached & refcounted).
  function syncCharacterTexture(u, ctrl) {
    const key = texKey(ctrl.pilotId, ctrl.resolvedState, ctrl.qualityTier);
    if (key === u._aafTexKey) return;
    if (u._aafTexKey) cache.release(u._aafTexKey);
    const res = cache.acquire(key);
    u._aafTexKey = key;
    u._aafFrames = res.frames;
    // each unit gets its own lightweight clone so per-unit offset doesn't fight other units
    if (u._aafTexClone) { u._aafTexClone.dispose(); u._aafTexClone = null; }
    const clone = res.texture.clone();
    clone.needsUpdate = true; clone.repeat.set(1 / res.frames, 1);
    u._aafTexClone = clone;
    u.body.material.map = clone;
    u.body.material.needsUpdate = true;
    u.frames = res.frames;
  }

  // Per-frame animation tick for an owned pilot. Called from game.js updateAnim() in place of the
  // default frame stepper. Reads engine state, drives the controller, updates the visible frame,
  // records facing, and fires pilot VFX on state onsets. dt is already game-speed-scaled.
  function tickAnim(u, dt) {
    const ctrl = u._aafCtrl;
    if (!ctrl || ctrl.disposed) return false;
    // observe facing from the existing engine flip (never overwrite it)
    if (u.body && u.body.scale && Number.isFinite(u.body.scale.x) && u.body.scale.x !== 0) {
      ctrl.facing = u.body.scale.x < 0 ? -1 : 1;
    }
    // decay the transient hit marker (visual only)
    if (u._aafHit > 0) u._aafHit = Math.max(0, u._aafHit - dt);
    const desired = AAR.deriveState(u);
    const prev = ctrl.currentState;
    ctrl.requestState(desired);
    // if a one-shot finished and engine is no longer in that state, settle back
    if (ctrl.finished && ctrl.currentState !== 'death' && ctrl.currentState !== desired) {
      ctrl.requestState(desired, { restart: true });
    }
    ctrl.update(dt);
    // fire pilot VFX exactly on the onset of attack/skill (visual only, post-combat)
    if (ctrl.currentState !== prev) onStateOnset(u, ctrl, ctrl.currentState);
    syncCharacterTexture(u, ctrl);
    // advance the visible frame
    if (u._aafTexClone && u._aafFrames > 0) {
      u._aafTexClone.offset.x = ctrl.frameIndex / u._aafFrames;
    }
    return true;
  }

  // The Three.js scene is a lexical global inside game.js (not on globalThis); every unit group
  // is added to it, so a unit's group.parent is the scene — we read it from there, no new hook.
  function sceneOf(u) { return u && u.group && u.group.parent ? u.group.parent : null; }

  function onStateOnset(u, ctrl, state) {
    const rec = ctrl.record;
    if (state === 'attack' || state === 'skill') {
      const scene = sceneOf(u);
      if (!scene) return;
      const target = u.current_target || (Array.isArray(u.castTarget) ? u.castTarget[0] : u.castTarget);
      if (rec.vfx && rec.vfx.ranged && target && target.group) {
        spawnProjectileLayer(scene, u, target, rec);
      } else if (target && target.group) {
        spawnImpactLayer(scene, target, rec);
      }
    }
  }

  // ---- transient VFX layers (procedural, pooled by simple array; capped by budget) ----
  function makeTransient(kind, cls, obj, duration, update, ownerUnit) {
    const rec = { kind, cls, obj, t: 0, duration: Math.max(0.05, duration), update, owner: ownerUnit || null };
    transients.push(rec);
    budget.onSpawn();
    if (ownerUnit && ownerUnit._aafCtrl) ownerUnit._aafCtrl.visualLayers.push(kind);
    return rec;
  }
  function disposeTransient(rec) {
    if (rec._disposed) return;
    rec._disposed = true;
    if (rec.obj) {
      if (rec.obj.parent) rec.obj.parent.remove(rec.obj);
      if (rec.obj.geometry) rec.obj.geometry.dispose();
      if (rec.obj.material) { if (rec.obj.material.map) rec.obj.material.map.dispose(); rec.obj.material.dispose(); }
    }
    budget.onDispose();
    if (rec.owner && rec.owner._aafCtrl) {
      const i = rec.owner._aafCtrl.visualLayers.indexOf(rec.kind);
      if (i >= 0) rec.owner._aafCtrl.visualLayers.splice(i, 1);
    }
    const idx = transients.indexOf(rec);
    if (idx >= 0) transients.splice(idx, 1);
  }

  function spawnProjectileLayer(scene, u, target, rec) {
    if (!vfxEnabled || !scene || !budget.canSpawn('projectile')) return;
    const from = u.group.position.clone(); from.y = (u._aafPlaneH || 1) * 0.6;
    const to = target.group.position.clone(); to.y = (target._aafPlaneH || 1) * 0.5;
    const geo = new THREE.PlaneGeometry(0.28, 0.06);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0e2a0, transparent: true, side: THREE.DoubleSide });
    const arrow = new THREE.Mesh(geo, mat);
    arrow.position.copy(from);
    const ang = Math.atan2(to.x - from.x, to.z - from.z);
    arrow.rotation.y = ang;
    scene.add(arrow);
    const dist = from.distanceTo(to);
    const dur = Math.min(0.35, 0.06 + dist * 0.03);
    const trailAllowed = budget.canSpawn('trail');
    makeTransient('projectile', 'projectile', arrow, dur, (r, k) => {
      arrow.position.lerpVectors(from, to, k);
      if (trailAllowed && k < 0.95 && (r._trailT = (r._trailT || 0) + 1) % 2 === 0) spawnTrailDot(scene, arrow.position, rec);
      if (k >= 1) spawnImpactLayer(scene, target, rec);
    }, u);
  }
  function spawnTrailDot(scene, pos, rec) {
    if (!scene || !budget.canSpawn('trail')) return;
    const geo = new THREE.PlaneGeometry(0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const dot = new THREE.Mesh(geo, mat); dot.position.copy(pos);
    scene.add(dot);
    makeTransient('trail', 'trail', dot, 0.18, (r, k) => { mat.opacity = 0.7 * (1 - k); });
  }
  function spawnImpactLayer(scene, target, rec) {
    if (!vfxEnabled || !scene || !target || !target.group || !budget.canSpawn('impact')) return;
    const pos = target.group.position.clone(); pos.y = (target._aafPlaneH || 1) * 0.4;
    const color = rec.vfx && rec.vfx.impact === 'slime_splat' ? 0x9be8ff : (rec.vfx && rec.vfx.impact === 'golem_impact' ? 0xd8c090 : 0xffe9a0);
    const geo = new THREE.RingGeometry(0.05, 0.16, 14);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat); ring.position.copy(pos); ring.rotation.x = -Math.PI / 2 + 0.4;
    scene.add(ring);
    makeTransient('impact', 'impact', ring, 0.28, (r, k) => { const s = 0.6 + k * 1.6; ring.scale.set(s, s, 1); mat.opacity = 0.9 * (1 - k); });
    // optional ground puff for heavy units (droppable under budget)
    if (rec.vfx && rec.vfx.ground && budget.canSpawn('ground')) {
      const gGeo = new THREE.CircleGeometry(0.24, 14);
      const gMat = new THREE.MeshBasicMaterial({ color: 0x8a7a63, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const puff = new THREE.Mesh(gGeo, gMat); puff.position.set(pos.x, 0.02, pos.z); puff.rotation.x = -Math.PI / 2;
      scene.add(puff);
      makeTransient('ground', 'ground', puff, 0.4, (r, k) => { const s = 1 + k; puff.scale.set(s, s, 1); gMat.opacity = 0.5 * (1 - k); });
    }
  }

  // Advance all transient VFX. Called once per frame from game.js animate() with the same dt the
  // VFX/combat use (game-speed-scaled during battle). Never blocks combat.
  function tickWorld(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = transients.length - 1; i >= 0; i--) {
      const r = transients[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.duration);
      if (r.update) { try { r.update(r, k); } catch (_) {} }
      if (r.t >= r.duration) disposeTransient(r);
    }
  }

  // Public hook: a unit's basic attack landed a hit on it (from game.js applyHitFlash site is
  // reused instead — see game.js). We expose a marker setter used by the animation-hit bridge.
  function markHit(u) { if (u && u._aafCtrl) u._aafHit = 0.18; }

  function onUnitReset(u) {
    const ctrl = u._aafCtrl;
    if (!ctrl) return;
    u._aafHit = 0;
    ctrl.currentState = 'idle'; ctrl.previousState = 'idle'; ctrl.resolvedState = 'idle';
    ctrl.lockedUntil = 0; ctrl.finished = false; ctrl.frameIndex = 0; ctrl.elapsed = 0;
    ctrl.clock = 0; ctrl.stateStartTime = 0;
    // drop this unit's transient layers (owned projectiles/trails)
    for (let i = transients.length - 1; i >= 0; i--) if (transients[i].owner === u) disposeTransient(transients[i]);
    syncCharacterTexture(u, ctrl);
    if (u._aafTexClone) u._aafTexClone.offset.x = 0;
  }

  function onUnitRemoved(u) {
    const ctrl = u._aafCtrl;
    if (!ctrl) return;
    for (let i = transients.length - 1; i >= 0; i--) if (transients[i].owner === u) disposeTransient(transients[i]);
    if (u._aafTexKey) { cache.release(u._aafTexKey); u._aafTexKey = null; }
    if (u._aafTexClone) { u._aafTexClone.dispose(); u._aafTexClone = null; }
    controllers.delete(ctrl);
    ctrl.dispose();
    u._aafCtrl = null; u._aafOwned = false;
  }

  function debugInfo() {
    return {
      active: AAR.AAF_ACTIVE,
      controllers: controllers.size,
      textures: cache.stats().live,
      vfx: transients.length,
      vfxDropped: budget.droppedCount(),
      cap: budget.cap,
      vfxEnabled,
    };
  }

  // ---- development-only debug driver (used by the #aafDebug panel; no gameplay effect) ----
  function findCtrl(pilotId) { for (const c of controllers) if (c.pilotId === pilotId) return c; return null; }
  function debugControllers() {
    const arr = [];
    for (const c of controllers) arr.push({
      pilotId: c.pilotId, state: c.currentState, resolved: c.resolvedState,
      frame: c.frameIndex, frames: c.frameCount, fps: AAR.fpsForState(c.record, c.resolvedState),
      quality: c.qualityTier, facing: c.facing, layers: c.visualLayers.length,
    });
    return arr;
  }
  function debugDrive(pilotId, state) {
    const c = findCtrl(pilotId); if (!c) return false;
    c._debugHold = state; c.requestState(state, { restart: true });
    return true;
  }
  function debugSetQuality(pilotId, tier) {
    const c = findCtrl(pilotId); if (!c) return false;
    c.setQuality(tier);
    const u = c.unit;
    if (u) { if (u._aafTexKey) { cache.release(u._aafTexKey); u._aafTexKey = null; } syncCharacterTexture(u, c); }
    return true;
  }
  function debugForceMissing(pilotId, state) {
    const c = findCtrl(pilotId); if (!c) return null;
    const av = new Set(c.available); av.delete(state); c.setAvailable(av);
    c._debugHold = state; c.requestState(state, { restart: true });
    return c.resolvedState; // shows the deterministic fallback target
  }
  function debugSetVfx(on) { vfxEnabled = !!on; }
  function debugSpawnImpact(pilotId) {
    const c = findCtrl(pilotId); if (!c || !c.unit) return;
    const scene = sceneOf(c.unit); if (scene) spawnImpactLayer(scene, c.unit, c.record);
  }
  // Debug RAF-independent tick: advances held controllers + their visible frame and the world.
  // Runs only while the debug panel drives it (works in shop phase where the battle loop is idle).
  function debugTick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
    for (const c of controllers) {
      if (!c._debugHold) continue;
      if (c.currentState !== c._debugHold && c.currentState !== 'death') c.requestState(c._debugHold, { restart: true });
      c.update(dt);
      const u = c.unit;
      if (u) { syncCharacterTexture(u, c); if (u._aafTexClone && u._aafFrames > 0) u._aafTexClone.offset.x = c.frameIndex / u._aafFrames; }
    }
    tickWorld(dt);
  }

  AAR._installAdapter({
    onUnitCreated, onUnitRemoved, onUnitReset, tickAnim, tickWorld, markHit, debugInfo,
    debugControllers, debugDrive, debugSetQuality, debugForceMissing, debugSetVfx, debugSpawnImpact, debugTick,
    _cache: cache, _budget: budget, _transients: transients, _controllers: controllers,
    _texKey: texKey, _spawnImpactLayer: spawnImpactLayer,
  });
})();

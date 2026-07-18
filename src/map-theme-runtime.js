// ============================================================
// MAP THEME RUNTIME v1 — shared theme system + Map 1 "Arena Ruins" baseline
// ============================================================
// Smallest stable reusable map-theme layer for Demo 1, built against the Map 1 visual lock
// contract (coco/map1-visual-lock-contract-v1, data/design/map1-visual-lock-v1.json). It owns
// ONLY decorative presentation: six swappable visual layers under one `mapThemeRoot` Group.
//
// It must NOT own (and never touches): combat, unit movement, targeting, occupancy, board
// coordinates, camera gameplay rules, shop/UI logic, economy, animation state, damage, timing.
// Pointer safety is structural: the game raycasts only `tileMeshes` and unit bodies, so theme
// meshes can never intercept placement/drag interactions.
//
// Layer model (per contract): boardSurface, arenaBorder, background, props, ambientVfx,
// lightingProfile — each independently disposable/replaceable, each failing safely to a minimal
// fallback (empty layer), never leaking geometry/material/texture (all theme resources are
// tracked and disposed on disposeTheme()).
//
// Reuse: Map 2 / Map 3 later swap THEME DATA (surface skin, border skin, background, props,
// ambient profile, lighting profile) while board geometry, camera, bench, HUD, combat, the
// Asset & Animation runtime, the VFX runtime and the Fullscreen/Screenshot utility are shared.
// map2.lava_hell / map3.heaven_temple exist only as DISABLED metadata (no scenes, no art).
//
// Loading: classic <script> AFTER src/game.js. It reads the scene through the read-only
// globalThis.MapThemeHooks bridge; when the module, the hooks, or THREE are absent the game
// renders exactly as before (fallback priority 1: existing board presentation).
//
// This is NOT final artwork: everything here is a polished procedural/material baseline that
// final generated artwork can replace later without rewriting the scene structure.
// ============================================================
globalThis.MapThemeRuntime = (function () {
  'use strict';

  const LAYER_NAMES = ['boardSurface', 'arenaBorder', 'background', 'props', 'ambientVfx', 'lightingProfile'];
  const QUALITY_LEVELS = ['high', 'medium', 'low'];

  // ---------------------------------------------------------------------------
  // Theme definitions (data-driven; mirrors data/design/map1-arena-ruins-theme-v1.json —
  // a classic script cannot load JSON synchronously, so the canonical JSON and this embedded
  // definition carry the same values and tools/test-map-theme-runtime.mjs asserts they match).
  // ---------------------------------------------------------------------------
  const MAP1_ARENA_RUINS = {
    id: 'map1.arena_ruins',
    name: 'Arena Ruins',
    enabled: true,
    contract: 'map1.arena_ruins.visual_lock.v1',
    // Palette: weathered cool-gray masonry so the warm-tan Golem (#8a7a63) and olive Archer
    // (#5f8f4e) separate from stone; moss restrained + desaturated so the teal Slime (#4ea3b0)
    // never blends. Warm-neutral key light exists already (game.js); theme adds cool fill + rim.
    palette: {
      masonry: 0x5d6270,        // cool muted stone (border/background) — distinct from Golem tan
      masonryDark: 0x4a4f5c,
      masonryLight: 0x707689,
      moss: 0x55663f,           // restrained desaturated moss — distinct from Slime teal
      bannerCloth: 0x6d3a3a,    // weathered red cloth
      bannerTrim: 0xb99a55,
      ember: 0xffb060,          // warm brazier ember (matches existing torch tone)
      rimLight: 0xd8ad4d,       // soft golden rim
      fillLight: 0x5a6a8a,      // cool muted fill
    },
    layers: LAYER_NAMES.slice(),
    // Per-quality budgets. Degradation order (contract): preserve units -> preserve board/grid ->
    // preserve combat impacts (all owned elsewhere and untouched) -> reduce ambient particles ->
    // remove decorative motion -> reduce distant/background decoration. Gameplay-critical visuals
    // are never removed (they are not owned by the theme at all).
    quality: {
      high:   { particles: 64, lightShafts: 2, bgWalls: 10, bgArches: 3, propScale: 1.0, decals: 8, motion: true },
      medium: { particles: 28, lightShafts: 0, bgWalls: 6,  bgArches: 2, propScale: 0.6, decals: 5, motion: true },
      low:    { particles: 0,  lightShafts: 0, bgWalls: 3,  bgArches: 0, propScale: 0.3, decals: 3, motion: false },
    },
    lighting: { fillIntensity: 0.25, rimIntensity: 0.3 },
  };

  // Deferred maps — DISABLED metadata only (schema examples proving theme-swappability).
  // No scenes, no artwork, no builders. activateTheme rejects disabled themes safely.
  const MAP2_LAVA_HELL = { id: 'map2.lava_hell', name: 'Lava Hell', enabled: false, deferred: true, layers: LAYER_NAMES.slice() };
  const MAP3_HEAVEN_TEMPLE = { id: 'map3.heaven_temple', name: 'Heaven Temple', enabled: false, deferred: true, layers: LAYER_NAMES.slice() };

  // ---------------------------------------------------------------------------
  // Registry + runtime state
  // ---------------------------------------------------------------------------
  const registry = Object.create(null);
  const warned = new Set();
  function warnOnce(key, msg) { if (warned.has(key)) return; warned.add(key); console.warn('[MapTheme] ' + msg); }

  const state = {
    active: null,          // { id, def, ctx, root, layers: {name:{group, ok, fellBack}}, tickFns: [] }
    quality: 'high',
    refreshCount: 0,
    disposeCount: 0,
    forceMissing: false,   // debug: texture resolution returns null -> flat-color fallback path
    layerVisible: {},      // per-layer visibility override, survives rebuilds
    fallbackState: 'none', // none | partial | neutral | inactive
  };
  LAYER_NAMES.forEach((n) => { state.layerVisible[n] = true; });

  // Owned-resource tracking: every geometry/material/texture the theme creates is registered
  // here and disposed in disposeTheme() — nothing shared with the game is ever registered, so
  // disposal can never break gameplay visuals.
  let owned = { geos: [], mats: [], texs: [] };
  function trackGeo(g) { owned.geos.push(g); return g; }
  function trackMat(m) { owned.mats.push(m); return m; }
  function trackTex(t) { if (t) owned.texs.push(t); return t; }

  function hasBrowser() { return typeof document !== 'undefined' && typeof globalThis.THREE !== 'undefined'; }

  function registerTheme(def) {
    if (!def || typeof def.id !== 'string' || !def.id) { warnOnce('reg-bad', 'registerTheme: invalid definition ignored'); return false; }
    registry[def.id] = def;
    return true;
  }
  function getTheme(id) { return registry[id] || null; }
  function listThemes() { return Object.keys(registry); }

  // Resolve the runtime context: explicit ctx wins, else the read-only game hooks.
  function resolveContext(ctx) {
    if (ctx && ctx.scene) return ctx;
    const H = globalThis.MapThemeHooks;
    if (H && typeof H.getScene === 'function') {
      const scene = H.getScene();
      const board = typeof H.getBoardMetrics === 'function' ? H.getBoardMetrics() : null;
      if (scene && board) return { scene, board };
    }
    return null;
  }

  // Theme texture helper — the single "asset resolution" seam. Procedural canvas today; a real
  // texture path later. forceMissing (debug) simulates a missing/broken asset: returns null and
  // the caller falls back to a flat-color material. Missing resources log once, never per frame.
  function themeTexture(key, draw) {
    if (state.forceMissing) { warnOnce('missing-' + key, 'theme resource "' + key + '" unavailable -> flat-color fallback'); return null; }
    try {
      const THREE = globalThis.THREE;
      const cv = document.createElement('canvas');
      draw(cv);
      const t = new THREE.CanvasTexture(cv);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      return trackTex(t);
    } catch (e) {
      warnOnce('missing-' + key, 'theme resource "' + key + '" failed to build -> flat-color fallback');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Layer builders — installed per theme family. Each returns a THREE.Group (already populated)
  // and may push per-frame update fns into api._tickFns. A builder that throws is caught by
  // activateTheme and replaced by an empty fallback group (the game stays playable).
  // ---------------------------------------------------------------------------
  const BUILDERS = Object.create(null); // themeId -> { layerName: (def, ctx, q) => Group }

  function emptyLayer(name) {
    const THREE = globalThis.THREE;
    const g = new THREE.Group();
    g.name = 'themeLayer:' + name + ':fallback';
    return g;
  }

  function activateTheme(themeId, ctx) {
    if (!hasBrowser()) { state.fallbackState = 'inactive'; return false; }
    const def = getTheme(themeId);
    if (!def) { warnOnce('no-theme-' + themeId, 'theme "' + themeId + '" not registered -> keeping existing board presentation'); state.fallbackState = 'inactive'; return false; }
    if (def.enabled === false) { warnOnce('disabled-' + themeId, 'theme "' + themeId + '" is disabled metadata (deferred map) -> not activated'); return false; }
    const context = resolveContext(ctx);
    if (!context) { warnOnce('no-ctx', 'no scene context available -> keeping existing board presentation'); state.fallbackState = 'inactive'; return false; }
    if (state.active) disposeTheme();

    const THREE = globalThis.THREE;
    const q = def.quality && def.quality[state.quality] ? def.quality[state.quality] : { particles: 0, lightShafts: 0, bgWalls: 0, bgArches: 0, propScale: 0, decals: 0, motion: false };
    const root = new THREE.Group();
    root.name = 'mapThemeRoot';
    const layers = {};
    const tickFns = [];
    const builders = BUILDERS[themeId] || {};
    let anyFailed = false, anyBuilt = false;
    const buildApi = { trackGeo, trackMat, trackTex, themeTexture, tickFns, quality: state.quality, q };

    for (const name of LAYER_NAMES) {
      let group = null, ok = false;
      try {
        if (typeof builders[name] === 'function') { group = builders[name](def, context, q, buildApi); ok = !!group; }
      } catch (e) {
        warnOnce('layer-' + name, 'layer "' + name + '" failed to build -> minimal fallback (' + (e && e.message) + ')');
      }
      if (!group) { group = emptyLayer(name); anyFailed = anyFailed || (typeof builders[name] === 'function'); }
      else { anyBuilt = true; }
      group.name = 'themeLayer:' + name;
      group.visible = state.layerVisible[name] !== false;
      root.add(group);
      layers[name] = { group, ok, fellBack: !ok };
    }

    context.scene.add(root);
    state.active = { id: themeId, def, ctx: context, root, layers, tickFns };
    state.fallbackState = anyBuilt ? (anyFailed ? 'partial' : 'none') : 'neutral';
    return true;
  }

  // Dispose the whole theme: remove root from the scene and free every owned resource.
  // Safe to call repeatedly; never touches non-theme scene objects.
  function disposeTheme() {
    const a = state.active;
    if (!a) return false;
    if (a.root && a.root.parent) a.root.parent.remove(a.root);
    for (const g of owned.geos) { try { g.dispose(); } catch (e) {} }
    for (const m of owned.mats) { try { m.dispose(); } catch (e) {} }
    for (const t of owned.texs) { try { t.dispose(); } catch (e) {} }
    owned = { geos: [], mats: [], texs: [] };
    a.tickFns.length = 0;
    state.active = null;
    state.disposeCount++;
    return true;
  }

  // Rebuild the active theme once (same id/context) — e.g. after a quality change.
  function refreshTheme(ctx) {
    const a = state.active;
    if (!a) return false;
    const id = a.id, context = ctx || a.ctx;
    disposeTheme();
    const ok = activateTheme(id, context);
    if (ok) state.refreshCount++;
    return ok;
  }

  function setThemeQuality(level) {
    const l = QUALITY_LEVELS.includes(level) ? level : 'high';
    if (l === state.quality) return state.quality;
    state.quality = l;
    if (state.active) refreshTheme();
    return state.quality;
  }

  function setLayerVisible(name, on) {
    if (!LAYER_NAMES.includes(name)) return false;
    state.layerVisible[name] = !!on;
    const a = state.active;
    if (a && a.layers[name]) a.layers[name].group.visible = !!on;
    return true;
  }

  function setForceMissing(on) { state.forceMissing = !!on; }

  // Per-frame decorative motion (ambient particles etc.). Called from the existing animate()
  // loop through one null-guarded hook — never drives gameplay, never allocates per frame.
  function tick(dt) {
    const a = state.active;
    if (!a || !Number.isFinite(dt) || dt <= 0) return;
    for (let i = 0; i < a.tickFns.length; i++) { try { a.tickFns[i](dt); } catch (e) {} }
  }

  function countObjects(group) {
    let n = 0;
    if (group) group.traverse(function () { n++; });
    return Math.max(0, n - 1); // exclude the layer group itself
  }

  function getThemeDebugState() {
    const a = state.active;
    const perLayer = {};
    let particles = 0;
    if (a) {
      for (const name of LAYER_NAMES) {
        const l = a.layers[name];
        perLayer[name] = { objects: l ? countObjects(l.group) : 0, visible: l ? l.group.visible : false, fellBack: l ? l.fellBack : true };
      }
      const amb = a.layers.ambientVfx;
      if (amb) amb.group.traverse(function (o) { if (o.isPoints && o.geometry && o.geometry.getAttribute('position')) particles += o.geometry.getAttribute('position').count; });
    }
    return {
      activeThemeId: a ? a.id : null,
      quality: state.quality,
      layers: perLayer,
      geometries: owned.geos.length,
      materials: owned.mats.length,
      textures: owned.texs.length,
      ambientParticles: particles,
      fallbackState: state.fallbackState,
      forceMissing: state.forceMissing,
      refreshCount: state.refreshCount,
      disposeCount: state.disposeCount,
      registered: listThemes(),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  const api = {
    LAYER_NAMES, QUALITY_LEVELS,
    registerTheme, getTheme, listThemes,
    activateTheme, refreshTheme, disposeTheme,
    setThemeQuality, setLayerVisible, setForceMissing,
    getThemeDebugState, tick,
    _BUILDERS: BUILDERS,
    _defs: { MAP1_ARENA_RUINS, MAP2_LAVA_HELL, MAP3_HEAVEN_TEMPLE },
    _state: state,
  };

  registerTheme(MAP1_ARENA_RUINS);
  registerTheme(MAP2_LAVA_HELL);
  registerTheme(MAP3_HEAVEN_TEMPLE);

  // Auto-activate the Map 1 baseline when the game hooks are present (this script loads after
  // game.js). Failure is silent-safe: the game keeps its existing presentation.
  if (hasBrowser() && resolveContext(null)) {
    try { activateTheme('map1.arena_ruins', null); } catch (e) { warnOnce('boot', 'auto-activation failed -> existing presentation kept'); }
  }

  return api;
})();

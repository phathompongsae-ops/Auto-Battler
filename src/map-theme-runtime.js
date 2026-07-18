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

  // ---------------------------------------------------------------------------
  // Map 1 "Arena Ruins" layer builders — polished procedural/material baseline (NOT final art).
  // Everything sits OUTSIDE the playable grid (or as subtle sub-decals that disable raycast and
  // never sit under units brighter than the tiles). Deterministic seeded placement.
  // ---------------------------------------------------------------------------
  (function installArenaRuinsBuilders() {
    const noRaycast = function () {};
    function makeRng(seed) { let s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

    function stoneMat(color, opts) {
      const THREE = globalThis.THREE;
      return trackMat(new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 1, metalness: 0 }, opts || {})));
    }

    // boardSurface — visual decal treatment only: faint crack decals at CELL INTERSECTIONS (the
    // grout lines between four cells, never centered under a unit) + restrained moss just outside
    // the grid edge. Raycast disabled on every decal; tiles/grid/occupancy untouched. No bright
    // emissive patterns; opacity kept low so unit silhouettes and tile highlights stay dominant.
    function buildBoardSurface(def, ctx, q, api) {
      const THREE = globalThis.THREE;
      const g = new THREE.Group();
      const b = ctx.board, rng = makeRng(4241);
      const crackTex = api.themeTexture('board-crack', function (cv) {
        cv.width = 32; cv.height = 32;
        const c2 = cv.getContext('2d');
        c2.clearRect(0, 0, 32, 32);
        c2.strokeStyle = 'rgba(20,18,14,0.85)'; c2.lineWidth = 1.4;
        let s = 97; const r2 = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let k = 0; k < 3; k++) {
          c2.beginPath(); let x = 4 + r2() * 8, y = 4 + r2() * 24; c2.moveTo(x, y);
          for (let i = 0; i < 4; i++) { x += 4 + r2() * 4; y += (r2() - 0.5) * 10; c2.lineTo(x, y); }
          c2.stroke();
        }
      });
      const crackGeo = trackGeo(new THREE.PlaneGeometry(0.36, 0.36));
      const crackMat = crackTex
        ? trackMat(new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0.45, depthWrite: false }))
        : trackMat(new THREE.MeshBasicMaterial({ color: def.palette.masonryDark, transparent: true, opacity: 0.12, depthWrite: false }));
      const spots = [];
      for (let c = 1; c < b.cols; c++) for (let r = 1; r < b.rows; r++) spots.push([c, r]);
      for (let i = spots.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = spots[i]; spots[i] = spots[j]; spots[j] = t; }
      for (let i = 0; i < Math.min(q.decals, spots.length); i++) {
        const m = new THREE.Mesh(crackGeo, crackMat);
        m.rotation.x = -Math.PI / 2; m.rotation.z = rng() * Math.PI * 2;
        m.position.set((spots[i][0] - b.cols / 2) * b.tile, 0.004, (spots[i][1] - b.rows / 2) * b.tile);
        m.raycast = noRaycast;
        g.add(m);
      }
      // restrained moss: JUST OUTSIDE the playable edge (on the rim line), never inside a cell
      const mossGeo = trackGeo(new THREE.CircleGeometry(0.16, 10));
      const mossMat = trackMat(new THREE.MeshBasicMaterial({ color: def.palette.moss, transparent: true, opacity: 0.55, depthWrite: false }));
      [[-(b.halfW + 0.34), -1.6], [b.halfW + 0.34, 0.8], [-(b.halfW + 0.34), 2.2], [b.halfW + 0.34, -2.6]].forEach(function (p) {
        const m = new THREE.Mesh(mossGeo, mossMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(p[0], 0.006, p[1]);
        m.scale.set(1 + rng() * 0.6, 1 + rng() * 0.4, 1);
        m.raycast = noRaycast;
        g.add(m);
      });
      return g;
    }

    // arenaBorder — low-profile broken masonry ringing the board OUTSIDE the existing stage rim.
    // Back row may be taller (far from camera); sides stay low; the front (camera/bench side)
    // gets only flat slabs so no cell is ever obscured from the locked camera.
    function buildArenaBorder(def, ctx, q, api) {
      const THREE = globalThis.THREE;
      const g = new THREE.Group();
      const b = ctx.board, rng = makeRng(1733);
      const matA = stoneMat(def.palette.masonry), matB = stoneMat(def.palette.masonryDark);
      const mossTop = trackMat(new THREE.MeshStandardMaterial({ color: def.palette.moss, roughness: 1 }));
      function block(x, z, w, h, d, mat, ry) {
        const m = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
        m.position.set(x, h / 2 - 0.01, z); m.rotation.y = ry || 0;
        g.add(m);
        return m;
      }
      // back edge (enemy side, far from camera): broken parapet, tallest pieces
      for (let i = 0; i < 7; i++) {
        if (rng() < 0.18) continue; // gaps = "broken"
        const x = -b.halfW + 0.6 + i * ((b.halfW * 2 - 1.2) / 6);
        const h = 0.28 + rng() * 0.34;
        const m = block(x, -(b.halfD + 0.78), 0.8 + rng() * 0.2, h, 0.5, rng() < 0.5 ? matA : matB, (rng() - 0.5) * 0.2);
        if (rng() < 0.45) { const t = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.035, 0.3)), mossTop); t.position.set(m.position.x, h - 0.005, m.position.z); g.add(t); }
      }
      // side edges: low ruins
      [-1, 1].forEach(function (sx) {
        for (let i = 0; i < 5; i++) {
          if (rng() < 0.25) continue;
          const z = -b.halfD + 0.7 + i * ((b.halfD * 2 - 1.4) / 4);
          block(sx * (b.halfW + 0.8), z, 0.5, 0.16 + rng() * 0.18, 0.7 + rng() * 0.2, rng() < 0.5 ? matA : matB, (rng() - 0.5) * 0.25);
        }
      });
      // front edge (bench/camera side): flat cracked slabs only — never obscures cells
      for (let i = 0; i < 4; i++) {
        const x = -b.halfW + 1 + i * ((b.halfW * 2 - 2) / 3);
        block(x + (rng() - 0.5) * 0.4, b.halfD + 0.9, 0.7, 0.07 + rng() * 0.06, 0.55, matB, (rng() - 0.5) * 0.3);
      }
      return g;
    }

    // background — distant ruined amphitheatre: broken wall segments + arches at radius ~9-13,
    // back/sides only (never crossing the board view), low-cost boxes/cylinders faded by the
    // existing scene fog. Supports the board; never competes with it.
    function buildBackground(def, ctx, q, api) {
      const THREE = globalThis.THREE;
      const g = new THREE.Group();
      const rng = makeRng(8087);
      const matA = stoneMat(def.palette.masonryDark), matB = stoneMat(def.palette.masonry);
      // candidate slots (x, z, w, h) — all behind or beside the board (z <= 1), none in front
      const slots = [
        [-9, -8, 3.2, 2.4], [-4, -10, 3.6, 2.0], [1, -11, 3.0, 2.6], [6, -9.5, 3.4, 1.8],
        [10, -7, 2.8, 2.2], [-11, -3, 2.6, 1.6], [11, -2, 2.6, 1.9], [-12, 1, 2.4, 1.3],
        [12, 0.5, 2.4, 1.4], [-10.5, -5.5, 2.2, 2.8], [9.5, -4.5, 2.0, 2.5], [3.5, -12, 2.8, 1.7],
      ];
      for (let i = 0; i < Math.min(q.bgWalls, slots.length); i++) {
        const s = slots[i];
        const m = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(s[2], s[3], 0.6)), rng() < 0.5 ? matA : matB);
        m.position.set(s[0], s[3] / 2 - 0.02, s[1]);
        m.rotation.y = Math.atan2(-s[0], -s[1]) + (rng() - 0.5) * 0.3; // face roughly inward
        g.add(m);
      }
      // ruined arches at the back
      const archX = [-6.5, 0.5, 7];
      for (let i = 0; i < Math.min(q.bgArches, archX.length); i++) {
        const x = archX[i], z = -9.6 - rng() * 1.2;
        const colGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 2.5, 6));
        const c1 = new THREE.Mesh(colGeo, matB); c1.position.set(x - 0.8, 1.23, z); g.add(c1);
        if (i === 1) { // one collapsed arch: single column + fallen lintel
          const fallen = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 0.32, 0.5)), matA);
          fallen.position.set(x + 0.7, 0.16, z + 0.8); fallen.rotation.y = 0.7; fallen.rotation.z = 0.12;
          g.add(fallen);
        } else {
          const c2 = new THREE.Mesh(colGeo, matB); c2.position.set(x + 0.8, 1.23, z); g.add(c2);
          const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.34, 0.5)), matA);
          lintel.position.set(x, 2.55, z); lintel.rotation.z = (rng() - 0.5) * 0.06;
          g.add(lintel);
        }
      }
      return g;
    }

    // props — broken columns, rubble clusters, weathered banners, cracked braziers, moss tufts.
    // Fixed candidate list, ALL outside the playable grid / bench / HUD / touch paths; propScale
    // takes a prefix, so low quality keeps only the closest anchor pieces.
    function buildProps(def, ctx, q, api) {
      const THREE = globalThis.THREE;
      const g = new THREE.Group();
      const b = ctx.board, rng = makeRng(5519);
      const stoneA = stoneMat(def.palette.masonry), stoneB = stoneMat(def.palette.masonryDark);
      const mossMat = trackMat(new THREE.MeshStandardMaterial({ color: def.palette.moss, roughness: 1 }));
      const rubbleGeo = trackGeo(new THREE.DodecahedronGeometry(0.2, 0));
      const tuftGeo = trackGeo(new THREE.SphereGeometry(0.16, 6, 4));

      const builders = [
        function brokenColumnL() {
          const m = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.26, 0.32, 1.9, 6)), stoneA);
          m.position.set(-(b.halfW + 1.7), 0.93, -(b.halfD + 1.4)); m.rotation.z = 0.07; g.add(m);
          const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.7, 0.24, 0.7)), stoneB);
          base.position.set(-(b.halfW + 1.7), 0.1, -(b.halfD + 1.4)); g.add(base);
        },
        function brokenColumnR() {
          const m = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.26, 0.32, 1.25, 6)), stoneA);
          m.position.set(b.halfW + 1.8, 0.6, -(b.halfD + 1.3)); m.rotation.z = -0.12; g.add(m);
        },
        function brazierL() { brazier(-(b.halfW - 0.4), -(b.halfD + 1.9)); },
        function brazierR() { brazier(b.halfW - 0.4, -(b.halfD + 1.9)); },
        function rubbleBL() { rubbleCluster(-(b.halfW + 1.6), 1.6, 3); },
        function rubbleBR() { rubbleCluster(b.halfW + 1.7, 2.4, 2); },
        function bannerL() { banner(-(b.halfW + 1.9), 0.2, 1); },
        function bannerR() { banner(b.halfW + 1.9, -0.6, -1); },
        function rubbleFar1() { rubbleCluster(-(b.halfW + 2.6), -2.8, 3); },
        function rubbleFar2() { rubbleCluster(b.halfW + 2.5, -3.4, 2); },
      ];
      function rubbleCluster(x, z, n) {
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(rubbleGeo, rng() < 0.5 ? stoneA : stoneB);
          const s = 0.55 + rng() * 0.8;
          m.scale.set(s, s * (0.7 + rng() * 0.4), s);
          m.position.set(x + (rng() - 0.5) * 0.8, 0.09 * s, z + (rng() - 0.5) * 0.8);
          m.rotation.set(rng() * 3, rng() * 3, 0);
          g.add(m);
          if (rng() < 0.5) { const t = new THREE.Mesh(tuftGeo, mossMat); t.scale.set(1.1, 0.35, 1.1); t.position.set(m.position.x + 0.2, 0.03, m.position.z + 0.15); g.add(t); }
        }
      }
      function banner(x, z, side) {
        const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 6)), stoneB);
        pole.position.set(x, 0.74, z); g.add(pole);
        const tex = api.themeTexture('banner-cloth', function (cv) {
          cv.width = 16; cv.height = 32;
          const c2 = cv.getContext('2d');
          c2.fillStyle = '#6d3a3a'; c2.fillRect(0, 0, 16, 32);
          c2.fillStyle = '#b99a55'; c2.fillRect(0, 0, 16, 4);
          c2.fillStyle = 'rgba(0,0,0,0.25)'; c2.fillRect(0, 24, 16, 8);
          c2.clearRect(2, 29, 4, 3); c2.clearRect(10, 27, 4, 5); // torn bottom
        });
        const mat = tex
          ? trackMat(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, roughness: 1 }))
          : trackMat(new THREE.MeshStandardMaterial({ color: def.palette.bannerCloth, side: THREE.DoubleSide, roughness: 1 }));
        const cloth = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.42, 0.8)), mat);
        cloth.position.set(x - side * 0.24, 1.02, z);
        cloth.rotation.y = side * 0.5;
        g.add(cloth);
      }
      function brazier(x, z) {
        const bowl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.16, 0.2, 8)), stoneB);
        bowl.position.set(x, 0.34, z); g.add(bowl);
        const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.09, 0.26, 6)), stoneA);
        leg.position.set(x, 0.12, z); g.add(leg);
        const emberTex = api.themeTexture('brazier-ember', function (cv) {
          cv.width = 32; cv.height = 32;
          const c2 = cv.getContext('2d');
          const grd = c2.createRadialGradient(16, 16, 0, 16, 16, 16);
          grd.addColorStop(0, 'rgba(255,190,110,0.9)'); grd.addColorStop(0.6, 'rgba(255,140,60,0.35)'); grd.addColorStop(1, 'rgba(255,140,60,0)');
          c2.fillStyle = grd; c2.fillRect(0, 0, 32, 32);
        });
        if (emberTex) {
          const glow = new THREE.Sprite(trackMat(new THREE.SpriteMaterial({ map: emberTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
          glow.scale.set(0.5, 0.5, 1); glow.position.set(x, 0.52, z);
          g.add(glow);
          if (q.motion) {
            let t = rng() * 6;
            api.tickFns.push(function (dt) { t += dt; const s = 0.46 + Math.sin(t * 5.1) * 0.05; glow.scale.set(s, s, 1); });
          }
        } // ember texture missing -> brazier stays unlit (safe fallback, no crash)
      }
      const count = Math.max(0, Math.round(builders.length * q.propScale));
      for (let i = 0; i < count; i++) { try { builders[i](); } catch (e) { warnOnce('prop-' + i, 'prop builder ' + i + ' failed -> skipped'); } }
      return g;
    }

    // ambientVfx — slow dust motes (one Points cloud, zero per-frame allocation) + rare soft
    // light shafts (high quality only). First layer reduced under load; never resembles combat
    // VFX, never blocks pointers (Points/planes are not raycast by the game at all).
    function buildAmbientVfx(def, ctx, q, api) {
      const THREE = globalThis.THREE;
      const g = new THREE.Group();
      const rng = makeRng(2657);
      if (q.particles > 0) {
        const n = q.particles;
        const pos = new Float32Array(n * 3);
        const vel = new Float32Array(n * 2); // (vy, vxDrift) per particle
        for (let i = 0; i < n; i++) {
          pos[i * 3] = (rng() - 0.5) * 13;
          pos[i * 3 + 1] = 0.2 + rng() * 3.0;
          pos[i * 3 + 2] = -6.5 + rng() * 11.5;
          vel[i * 2] = 0.06 + rng() * 0.12;
          vel[i * 2 + 1] = (rng() - 0.5) * 0.05;
        }
        const geo = trackGeo(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = trackMat(new THREE.PointsMaterial({ color: 0xd8c9a8, size: 0.055, transparent: true, opacity: 0.5, depthWrite: false }));
        const points = new THREE.Points(geo, mat);
        points.raycast = noRaycast;
        g.add(points);
        if (q.motion) {
          api.tickFns.push(function (dt) {
            const p = geo.getAttribute('position');
            for (let i = 0; i < n; i++) {
              let y = p.getY(i) + vel[i * 2] * dt;
              if (y > 3.4) y = 0.2;
              p.setY(i, y);
              p.setX(i, p.getX(i) + vel[i * 2 + 1] * dt);
            }
            p.needsUpdate = true;
          });
        }
      }
      // rare soft light shafts (inexpensive additive planes, back corners only — no board cover)
      for (let i = 0; i < q.lightShafts; i++) {
        const shaft = new THREE.Mesh(
          trackGeo(new THREE.PlaneGeometry(1.3, 5)),
          trackMat(new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))
        );
        const sx = i === 0 ? -1 : 1;
        shaft.position.set(sx * 5.6, 2.4, -5.2);
        shaft.rotation.set(0.15, sx * 0.4, sx * -0.45);
        shaft.raycast = noRaycast;
        g.add(shaft);
      }
      return g;
    }

    // lightingProfile — ADDS a cool muted fill + a soft golden rim to the existing warm key
    // light. Never replaces the camera, the game's AmbientLight/key light, and never touches
    // scene.background/fog (owned by the existing Arena Curse atmosphere VFX). Intensities are
    // low so pilot placeholder colors keep their readability contrast.
    function buildLightingProfile(def, ctx, q, api) {
      const THREE = globalThis.THREE;
      const g = new THREE.Group();
      const fill = new THREE.DirectionalLight(def.palette.fillLight, def.lighting.fillIntensity);
      fill.position.set(-6, 8, 6);
      g.add(fill);
      const rim = new THREE.DirectionalLight(def.palette.rimLight, def.lighting.rimIntensity);
      rim.position.set(0, 6, -9);
      g.add(rim);
      return g;
    }

    BUILDERS['map1.arena_ruins'] = {
      boardSurface: buildBoardSurface,
      arenaBorder: buildArenaBorder,
      background: buildBackground,
      props: buildProps,
      ambientVfx: buildAmbientVfx,
      lightingProfile: buildLightingProfile,
    };
  })();

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

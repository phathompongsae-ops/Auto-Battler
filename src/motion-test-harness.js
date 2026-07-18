// ============================================================
// ARENA RUINS PILOT MOTION TEST HARNESS v1
// ============================================================
// Development-only test mode (URL hash #motionTest) that stages the three contract motion tests
// — hero.archer/attack, monster.slime/move, monster.golem/attack — inside the EXISTING Arena
// Ruins baseline (PR #25 theme, PR #23 animation runtime, PR #24 fullscreen/screenshot). It
// loads REAL production frames per the Pilot Motion Test Contract v1 naming when they exist,
// runs playback at 12 FPS (x4 default / x1 toggle), fires the contract event markers, and
// reports full diagnostics. When production frames are absent (current state), every test shows
// status "awaiting_production_frames" with the exact file list the runtime expects — the page
// must never crash, and NO placeholder is ever presented as a passing asset.
//
// It never touches Combat, targeting, pathfinding, economy, stage logic, the game loop, the
// canonical Arena Ruins theme, or any manifest value. All DOM it creates is [data-dev-only]
// (auto-hidden in fullscreen by PR #24) and [data-no-capture] (excluded from screenshots).
// ============================================================
globalThis.MotionTestHarness = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Contract data (mirrors data/design/pilot-motion-test-contract-v1.json, which is a verbatim
  // copy of PR #28 @ 60cc4b0; tools/test-motion-test-harness.mjs asserts this table matches it).
  // ---------------------------------------------------------------------------
  const FPS_DEFAULT = 12;
  const FPS_ACCEPTED = [8, 15];
  const MOTION_TESTS = [
    { unit: 'hero.archer', state: 'attack', loop: false, fps: 12, frameTarget: 10, frameMin: 8, frameMax: 12, anchor: [0.5, 0.92], marker: { name: 'projectileRelease', normalizedTime: 0.55 } },
    { unit: 'monster.slime', state: 'move', loop: true, fps: 12, frameTarget: 8, frameMin: 8, frameMax: 10, anchor: [0.5, 0.9], marker: { name: 'footstepCue', normalizedTime: 0.7 } },
    { unit: 'monster.golem', state: 'attack', loop: false, fps: 12, frameTarget: 12, frameMin: 8, frameMax: 12, anchor: [0.5, 0.94], marker: { name: 'impactCue', normalizedTime: 0.58 } },
  ];
  const MARKER_VOCABULARY = ['projectileRelease', 'impactCue', 'skillFlashCue', 'footstepCue', 'deathDissolveCue'];

  // Additional motion tests beyond the three PR #28 contract tests (which stay untouched above so
  // the contract-consistency Node test keeps passing). Archer idle: 8 frames @ 8 FPS, seamless
  // loop, NO event marker (marker: null -> the playback never fires any event). Archer move:
  // 8 frames @ 12 FPS loop with TWO per-cycle cues; the left/right names are declared here as a
  // test-scoped whitelist — the global MARKER_VOCABULARY stays the verbatim PR #23/#28 list.
  const EXTRA_MOTION_TESTS = [
    { unit: 'hero.archer', state: 'idle', loop: true, fps: 8, frameTarget: 8, frameMin: 8, frameMax: 8, anchor: [0.5, 0.92], marker: null },
    { unit: 'hero.archer', state: 'move', loop: true, fps: 12, frameTarget: 8, frameMin: 8, frameMax: 8, anchor: [0.5, 0.92], marker: null, markers: [{ name: 'leftFootstepCue', normalizedTime: 0.25 }, { name: 'rightFootstepCue', normalizedTime: 0.75 }] },
  ];
  const ALL_TESTS = MOTION_TESTS.concat(EXTRA_MOTION_TESTS);
  function keyOf(t) { return t.unit + '/' + t.state; }

  function pad3(n) { return String(n).padStart(3, '0'); }
  // Contract naming: assets/units/{unitId}/{state}/{unitId}_{state}_{frameIndex}.png (+ sidecar)
  function framePath(unit, state, i) { return 'assets/units/' + unit + '/' + state + '/' + unit + '_' + state + '_' + pad3(i) + '.png'; }
  function sidecarPath(unit, state) { return 'assets/units/' + unit + '/' + unit + '_' + state + '_motiontest.json'; }
  function expectedFiles(test) {
    const files = [];
    for (let i = 0; i < test.frameTarget; i++) files.push(framePath(test.unit, test.state, i));
    files.push(sidecarPath(test.unit, test.state));
    return files;
  }

  // Pure diagnostics per the contract (Node-testable). `load` = { frames: [{w,h}...],
  // metadata: object|null, metadataError: string|null, cornerAlphas: [a,a,a,a]|null }.
  // Returns { status, problems: [...] } — status: 'awaiting_production_frames' | 'loaded' |
  // 'diagnostics_failed'. Warnings (transparency) do not fail the load.
  function evaluateDiagnostics(test, load) {
    const problems = [];
    const warnings = [];
    const n = load.frames.length;
    if (n === 0) return { status: 'awaiting_production_frames', problems: [], warnings: [], reason: 'no production frames found on this branch' };
    if (n < test.frameMin || n > test.frameMax) {
      problems.push('frame count ' + n + ' outside contract range [' + test.frameMin + ',' + test.frameMax + '] (target ' + test.frameTarget + ')');
    }
    const w0 = load.frames[0].w, h0 = load.frames[0].h;
    for (let i = 1; i < n; i++) {
      if (load.frames[i].w !== w0 || load.frames[i].h !== h0) { problems.push('canvas size not constant: frame ' + pad3(i) + ' is ' + load.frames[i].w + 'x' + load.frames[i].h + ' vs ' + w0 + 'x' + h0); break; }
    }
    if (load.metadataError) problems.push('metadata invalid: ' + load.metadataError);
    else if (!load.metadata) problems.push('metadata missing: ' + sidecarPath(test.unit, test.state));
    else {
      const m = load.metadata;
      if (JSON.stringify(m.anchor) !== JSON.stringify(test.anchor)) problems.push('metadata anchor ' + JSON.stringify(m.anchor) + ' does not match contract ' + JSON.stringify(test.anchor));
      if (Number.isFinite(m.frameCount) && m.frameCount !== n) problems.push('metadata frameCount ' + m.frameCount + ' does not match loaded frames ' + n);
      if (m.fps !== undefined && (m.fps < FPS_ACCEPTED[0] || m.fps > FPS_ACCEPTED[1])) problems.push('metadata fps ' + m.fps + ' outside accepted range [8,15]');
      if (m.loop !== undefined && m.loop !== test.loop) problems.push('metadata loop ' + m.loop + ' does not match contract ' + test.loop);
      for (const mk of (m.eventMarkers || [])) {
        if (!MARKER_VOCABULARY.includes(mk.name) && !(test.markers || []).some((x) => x.name === mk.name)) problems.push('unsupported event marker: ' + mk.name);
      }
    }
    if (load.cornerAlphas && load.cornerAlphas.every((a) => a > 0)) {
      warnings.push('transparency warning: all four corners of frame 000 are opaque — background may not be transparent');
    }
    return { status: problems.length ? 'diagnostics_failed' : 'loaded', problems, warnings, reason: problems[0] || null };
  }

  const core = {
    FPS_DEFAULT, FPS_ACCEPTED, MOTION_TESTS, MARKER_VOCABULARY,
    framePath, sidecarPath, expectedFiles, evaluateDiagnostics,
  };

  // ---------------------------------------------------------------------------
  // Browser harness (activates only with #motionTest in the URL hash + game globals present)
  // ---------------------------------------------------------------------------
  const hasBrowser = typeof document !== 'undefined' && typeof globalThis.THREE !== 'undefined';
  const state = {
    active: false, units: {}, tests: {}, selected: 'hero.archer/attack', activeByUnit: {},
    speed: 4,                     // checkpoint default is x4
    playing: true, overlayVisible: true, isolation: false,
    raf: null, lastNow: 0, ui: null,
  };

  function log(msg) { console.warn('[MotionTest] ' + msg); }

  // per-test runtime record
  function makeRun(test) {
    return {
      test, status: 'awaiting_production_frames', problems: [], warnings: [],
      frames: [], textures: [], metadata: null,
      frameIndex: 0, elapsed: 0, completed: false, cycles: 0,
      lastMarker: null, firedThisPass: {}, markerLog: [],
      // effective markers: the sidecar's declared markers win when valid (real files are the
      // source of truth for a motion test); the test's declared marker(s) are the fallback.
      // Tests with none (e.g. idle) keep [] and never fire any event.
      effectiveMarkers: (test.markers || (test.marker ? [test.marker] : [])).map((m) => ({ name: m.name, normalizedTime: m.normalizedTime })),
    };
  }

  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function loadTest(run) {
    const t = run.test;
    // sidecar metadata
    try {
      const res = await fetch(sidecarPath(t.unit, t.state));
      if (res.ok) run.metadata = await res.json();
    } catch (e) { run.metadataError = String(e && e.message); }
    // probe frames 000.. up to frameMax; stop at the first missing frame
    const images = [];
    for (let i = 0; i < t.frameMax; i++) {
      const img = await loadImage(framePath(t.unit, t.state, i));
      if (!img) break;
      images.push(img);
    }
    // corner-alpha transparency probe on frame 000 (best-effort; CORS-safe on same origin)
    let cornerAlphas = null;
    if (images.length) {
      try {
        const c = document.createElement('canvas'); c.width = images[0].width; c.height = images[0].height;
        const g = c.getContext('2d'); g.drawImage(images[0], 0, 0);
        const w = c.width, h = c.height;
        cornerAlphas = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => g.getImageData(x, y, 1, 1).data[3]);
      } catch (e) { cornerAlphas = null; }
    }
    const verdict = evaluateDiagnostics(t, {
      frames: images.map((im) => ({ w: im.width, h: im.height })),
      metadata: run.metadata || null, metadataError: run.metadataError || null, cornerAlphas,
    });
    run.status = verdict.status; run.problems = verdict.problems; run.warnings = verdict.warnings; run.reason = verdict.reason;
    // sidecar marker override (validated against the framework vocabulary or the test's own
    // declared marker names; the test declaration is the fallback)
    const mMetas = run.metadata && Array.isArray(run.metadata.eventMarkers) ? run.metadata.eventMarkers : [];
    const mValid = mMetas.filter((mk) => (MARKER_VOCABULARY.includes(mk.name) || (t.markers || []).some((x) => x.name === mk.name)) && typeof mk.normalizedTime === 'number' && mk.normalizedTime > 0 && mk.normalizedTime < 1);
    if (mValid.length) run.effectiveMarkers = mValid.map((mk) => ({ name: mk.name, normalizedTime: mk.normalizedTime }));
    if (verdict.status !== 'awaiting_production_frames') {
      run.frames = images;
      const THREE = globalThis.THREE;
      run.textures = images.map((im) => { const tex = new THREE.Texture(im); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true; return tex; });
      if (verdict.status === 'loaded') log(t.unit + '/' + t.state + ': loaded ' + images.length + ' production frames');
      else log(t.unit + '/' + t.state + ': diagnostics failed -> ' + verdict.problems.join(' ; '));
    } else {
      log(t.unit + '/' + t.state + ': awaiting_production_frames (expected files listed in overlay)');
    }
  }

  // spawn the three pilots at clearly separated tiles (shop phase — Combat never starts here)
  function spawnPilots() {
    phase = 'shop';
    [...units].forEach((u) => { try { removeUnit(u); } catch (e) {} });
    units.length = 0; placedUnits.length = 0; benchHeroes.length = 0; if (occupied.clear) occupied.clear();
    state.units['hero.archer'] = moveUnitTo(spawnToBench(createHeroInstance('archer', 1)), 1, 4);
    state.units['monster.slime'] = makeUnit({ team: 'enemy', name: 'Slime 1', sprite: 'Slime', c: 4, r: 1, hp: 200, pAtk: 0, atkSpeed: 1, range: 1, moveSpeed: 2, armor: 0 });
    state.units['monster.golem'] = makeUnit({ team: 'enemy', name: 'Golem 1', sprite: 'Golem', c: 6, r: 2, hp: 280, pAtk: 0, atkSpeed: 1, range: 1, moveSpeed: 1, armor: 0, frameSize: { w: 1.3, h: 1.5 } });
    if (typeof renderUI === 'function') renderUI();
  }

  // playback: fixed 12 FPS content clock scaled by playback speed (x4 default). Applies the
  // current frame texture to the pilot's existing body mesh; restores the prior map on teardown.
  function applyFrame(run) {
    const u = state.units[run.test.unit];
    if (!u || !u.body || !run.textures.length) return;
    if (u.__mtPrevMap === undefined) u.__mtPrevMap = u.body.material.map || null;
    u.body.material.map = run.textures[Math.min(run.frameIndex, run.textures.length - 1)];
    u.body.material.transparent = true;
    u.body.material.needsUpdate = true;
  }

  function fireMarker(run, name, atProgress) {
    run.lastMarker = { name, at: atProgress.toFixed(3), frame: run.frameIndex, cycle: run.cycles, time: Date.now() };
    run.markerLog.push(run.lastMarker);
    if (run.markerLog.length > 200) run.markerLog.shift();
  }

  function tick(now) {
    if (!state.active) return;
    state.raf = requestAnimationFrame(tick);
    const dt = Math.min((now - state.lastNow) / 1000, 0.1);
    state.lastNow = now;
    if (!state.playing) return;
    for (const run of Object.values(state.tests)) {
      if (run.status !== 'loaded' && run.status !== 'diagnostics_failed') continue; // nothing playable
      if (state.activeByUnit[run.test.unit] !== keyOf(run.test)) continue; // one display state per unit
      if (!run.textures.length || run.completed) continue;
      const n = run.textures.length;
      const frameDur = 1 / (run.test.fps * state.speed);
      run.elapsed += dt;
      while (run.elapsed >= frameDur) {
        run.elapsed -= frameDur;
        const prevProgress = n > 1 ? run.frameIndex / (n - 1) : 0;
        if (run.frameIndex < n - 1) run.frameIndex++;
        else if (run.test.loop) { run.frameIndex = 0; run.cycles++; run.firedThisPass = {}; }
        else { run.completed = true; }
        const progress = n > 1 ? run.frameIndex / (n - 1) : 1;
        for (const em of run.effectiveMarkers) {
          const mt = em.normalizedTime;
          if (!run.firedThisPass[em.name] && ((prevProgress < mt && progress >= mt) || (run.completed && mt <= 1))) {
            if (progress >= mt || run.completed) { fireMarker(run, em.name, progress); run.firedThisPass[em.name] = true; }
          }
        }
        if (run.completed) break;
      }
      applyFrame(run);
    }
    refreshOverlay();
  }

  function restartRun(run) { run.frameIndex = 0; run.elapsed = 0; run.completed = false; run.cycles = 0; run.firedThisPass = {}; run.lastMarker = null; run.markerLog = []; applyFrame(run); }

  function setIsolation(on) {
    state.isolation = on;
    const selectedUnit = state.selected.split('/')[0];
    for (const [id, u] of Object.entries(state.units)) {
      if (u && u.group) u.group.visible = !on || id === selectedUnit;
    }
  }

  // ---- overlay DOM (all created here; [data-dev-only] + [data-no-capture]) ----
  function buildOverlay() {
    const el = document.createElement('div');
    el.id = 'motionTestOverlay';
    el.setAttribute('data-dev-only', ''); el.setAttribute('data-no-capture', '');
    el.style.cssText = 'position:fixed;left:6px;top:56px;z-index:92;width:min(78vw,290px);max-height:76vh;overflow:auto;' +
      'padding:8px 10px;border-radius:8px;background:rgba(8,10,14,0.92);border:1px solid #5a4a3a;color:#e8dfd2;' +
      'font:11px/1.4 monospace;pointer-events:auto;box-shadow:0 4px 16px rgba(0,0,0,0.5);';
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      '<b style="color:#e5c78a;">Pilot Motion Test — Arena Ruins</b>' +
      '<button id="mtxClose" class="mtxBtn">✕</button></div>' +
      '<div id="mtxTabs" style="display:flex;gap:4px;margin-bottom:6px;"></div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">' +
      '<button id="mtxPlay" class="mtxBtn">⏸ pause</button>' +
      '<button id="mtxRestart" class="mtxBtn">↺ restart</button>' +
      '<button id="mtxSpeed" class="mtxBtn">x4</button>' +
      '<button id="mtxFlip" class="mtxBtn">flipX</button>' +
      '<button id="mtxIso" class="mtxBtn">isolate</button>' +
      '</div>' +
      '<pre id="mtxReadout" style="margin:0;white-space:pre-wrap;color:#cfe0c2;"></pre>';
    document.body.appendChild(el);
    const style = document.createElement('style');
    style.textContent = '#motionTestOverlay .mtxBtn{background:#31281c;color:#e8dfd2;border:1px solid #5a4a3a;border-radius:5px;padding:3px 8px;font:11px monospace;cursor:pointer;min-height:26px;}' +
      '#motionTestOverlay .mtxBtn.on{background:#a8823c;color:#150f08;}#motionTestOverlay .mtxBtn:active{transform:translateY(1px);}';
    document.head.appendChild(style);

    const tabs = el.querySelector('#mtxTabs');
    for (const t of ALL_TESTS) {
      const key = keyOf(t);
      const multi = ALL_TESTS.filter((x) => x.unit === t.unit).length > 1;
      const b = document.createElement('button');
      b.className = 'mtxBtn' + (key === state.selected ? ' on' : '');
      b.textContent = t.unit.split('.')[1] + (multi ? '.' + t.state : '');
      b.onclick = () => {
        state.selected = key;
        if (state.activeByUnit[t.unit] !== key) { state.activeByUnit[t.unit] = key; const run = state.tests[key]; if (run) restartRun(run); }
        tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        if (state.isolation) setIsolation(true);
        refreshOverlay(true);
      };
      tabs.appendChild(b);
    }
    el.querySelector('#mtxClose').onclick = () => toggleOverlay(false);
    el.querySelector('#mtxPlay').onclick = function () { state.playing = !state.playing; this.textContent = state.playing ? '⏸ pause' : '▶ play'; };
    el.querySelector('#mtxRestart').onclick = () => { const run = state.tests[state.selected]; if (run) restartRun(run); };
    el.querySelector('#mtxSpeed').onclick = function () { state.speed = state.speed === 4 ? 1 : 4; this.textContent = 'x' + state.speed; };
    el.querySelector('#mtxFlip').onclick = () => { const u = state.units[state.selected.split('/')[0]]; if (u && u.body) u.body.scale.x *= -1; };
    el.querySelector('#mtxIso').onclick = function () { setIsolation(!state.isolation); this.classList.toggle('on', state.isolation); };
    state.ui = el;
    // small always-available toggle so the overlay can be reopened on touch devices
    const tog = document.createElement('button');
    tog.id = 'motionTestToggle';
    tog.setAttribute('data-dev-only', ''); tog.setAttribute('data-no-capture', '');
    tog.textContent = '🎬 MT';
    tog.style.cssText = 'position:fixed;left:6px;top:56px;z-index:91;display:none;background:rgba(8,10,14,0.85);' +
      'color:#e5c78a;border:1px solid #5a4a3a;border-radius:6px;padding:4px 8px;font:12px monospace;pointer-events:auto;';
    tog.onclick = () => toggleOverlay(true);
    document.body.appendChild(tog);
    state.toggleBtn = tog;
  }

  function toggleOverlay(on) {
    state.overlayVisible = on;
    if (state.ui) state.ui.style.display = on ? 'block' : 'none';
    if (state.toggleBtn) state.toggleBtn.style.display = on ? 'none' : 'block';
  }

  let lastReadout = 0;
  function refreshOverlay(force) {
    if (!state.ui || !state.overlayVisible) return;
    const now = Date.now();
    if (!force && now - lastReadout < 200) return; // keep DOM writes cheap
    lastReadout = now;
    const run = state.tests[state.selected];
    if (!run) return;
    const t = run.test;
    const lines = [
      'asset  ' + t.unit,
      'state  ' + t.state + '  (' + (t.loop ? 'loop' : 'non-loop') + ')',
      'frame  ' + (run.textures.length ? (run.frameIndex + 1) + '/' + run.textures.length : '-/' + t.frameTarget + ' (target)'),
      'fps    ' + t.fps + '   speed x' + state.speed + (state.playing ? '' : '  [paused]'),
      'anchor ' + JSON.stringify(t.anchor),
      'marker ' + (run.effectiveMarkers.length ? run.effectiveMarkers.map((m) => m.name + ' @ ' + m.normalizedTime).join(', ') : '(none — idle fires no events)') + '  last: ' + (run.lastMarker ? run.lastMarker.name + ' @' + run.lastMarker.at + ' (f' + run.lastMarker.frame + ')' : '—'),
      'cycles ' + run.cycles + (run.completed ? '  [completed]' : ''),
      'status ' + run.status,
    ];
    if (run.reason) lines.push('reason ' + run.reason);
    for (const p of run.problems) lines.push('  ✗ ' + p);
    for (const w of run.warnings) lines.push('  ⚠ ' + w);
    if (run.status === 'awaiting_production_frames') {
      lines.push('', 'expected files:');
      for (const f of expectedFiles(t)) lines.push('  ' + f);
    }
    state.ui.querySelector('#mtxReadout').textContent = lines.join('\n');
  }

  async function activate() {
    if (state.active) return true;
    if (!hasBrowser || typeof makeUnit !== 'function' || typeof moveUnitTo !== 'function') return false;
    state.active = true;
    try {
      spawnPilots();
    } catch (e) {
      // never crash the page — report and stay in a safe inactive-visual state
      log('pilot spawn failed (' + (e && e.message) + ') — harness continues with diagnostics only');
    }
    buildOverlay();
    state.activeByUnit = {};
    for (const t of ALL_TESTS) {
      state.tests[keyOf(t)] = makeRun(t);
      if (!(t.unit in state.activeByUnit)) state.activeByUnit[t.unit] = keyOf(t); // contract test stays the default display state
    }
    state.loadsComplete = false;
    await Promise.all(Object.values(state.tests).map((run) => loadTest(run)));
    state.loadsComplete = true;
    refreshOverlay(true);
    state.lastNow = performance.now();
    state.raf = requestAnimationFrame(tick);
    log('harness active — statuses: ' + Object.values(state.tests).map((r) => r.test.unit + '=' + r.status).join(', '));
    return true;
  }

  function deactivate() {
    if (!state.active) return;
    state.active = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    for (const run of Object.values(state.tests)) run.textures.forEach((tex) => { try { tex.dispose(); } catch (e) {} });
    for (const u of Object.values(state.units)) {
      if (u && u.body && u.__mtPrevMap !== undefined) { u.body.material.map = u.__mtPrevMap; u.body.material.needsUpdate = true; delete u.__mtPrevMap; }
      if (u && u.group) u.group.visible = true;
    }
    if (state.ui) { state.ui.remove(); state.ui = null; }
    if (state.toggleBtn) { state.toggleBtn.remove(); state.toggleBtn = null; }
    state.tests = {}; state.units = {};
  }

  const api = Object.assign({}, core, {
    activate, deactivate,
    isActive() { return state.active; },
    getState() {
      const out = { active: state.active, loadsComplete: !!state.loadsComplete, speed: state.speed, playing: state.playing, selected: state.selected, tests: {} };
      for (const [id, run] of Object.entries(state.tests)) {
        out.tests[id] = { status: run.status, frames: run.textures.length, frameIndex: run.frameIndex, cycles: run.cycles, completed: run.completed, lastMarker: run.lastMarker, markerLog: run.markerLog.slice(-60), problems: run.problems.slice(), warnings: run.warnings.slice() };
      }
      return out;
    },
    setSpeed(s) { state.speed = s === 1 ? 1 : 4; },
    setPlaying(p) { state.playing = !!p; },
    restart(key) { const run = state.tests[key || state.selected]; if (run) restartRun(run); },
    setActiveTest(key) {
      const run = state.tests[key];
      if (!run) return false;
      state.selected = key;
      const unit = run.test.unit;
      if (state.activeByUnit[unit] !== key) { state.activeByUnit[unit] = key; restartRun(run); }
      return true;
    },
    _state: state,
  });

  // Auto-activate only in the dev test mode (#motionTest); the normal game is untouched.
  // The game finishes booting asynchronously (loadAllSprites -> hides #loading -> starts the
  // animate loop), so poll for that signal before spawning pilots — never activate early.
  if (hasBrowser && /motiontest/i.test(location.hash)) {
    let tries = 0;
    const bootPoll = setInterval(() => {
      tries++;
      const loadingEl = document.getElementById('loading');
      const gameReady = loadingEl && loadingEl.style.display === 'none' && typeof makeUnit === 'function';
      if (gameReady) { clearInterval(bootPoll); activate(); }
      else if (tries > 150) { clearInterval(bootPoll); log('game never finished booting — harness not activated'); }
    }, 100);
  }

  return api;
})();

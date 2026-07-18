// ============================================================
// GAME PRESENTATION TOOLS v1 — Fullscreen (Demo 1)
// ============================================================
// Small, player-facing presentation utilities kept fully SEPARATE from game logic. They are
// event-driven (no per-frame polling) and touch/desktop friendly. They read the game only through
// the read-only bridge globalThis.GamePresentationHooks (defined in game.js); with that bridge or
// the DOM buttons absent they self-disable. Nothing here touches combat, board dimensions, camera
// lock, animation timing, economy, equipment, ninja, augments, monster balance, or the Asset
// Framework — it only presents what already exists.
//
// A. Fullscreen: requestFullscreen on the ROOT element (documentElement) so the whole game — the
//    Three.js canvas AND the fixed-position HUD overlays — goes fullscreen together, never just the
//    canvas. Standard API + webkit fallback (Safari/iOS). One fullscreenchange listener keeps the
//    button in sync with Esc / browser-back / system exits. Dev-only debug panels are hidden on
//    enter and restored to their prior visibility on exit. Layout is recomputed via the game's own
//    single layout owner (layoutBoard) — no second resize path, no resize loop.
// ============================================================
globalThis.GamePresentationTools = (function () {
  'use strict';

  const ENTER_ICON = '⛶', EXIT_ICON = '🗗';

  let inited = false;
  let fsBtn = null;
  let devSnapshot = null;     // remembered [el, display] pairs while fullscreen hides dev panels
  let wasFullscreen = false;  // last known fullscreen state (drives enter/exit edge detection)

  // ---- fullscreen API abstraction (standard + webkit fallback) ----
  const root = (typeof document !== 'undefined') ? document.documentElement : null;
  function reqFs() { return root && (root.requestFullscreen || root.webkitRequestFullscreen) || null; }
  function exitFs() { return (typeof document !== 'undefined') && (document.exitFullscreen || document.webkitExitFullscreen) || null; }
  function fsElement() { return (typeof document === 'undefined') ? null : (document.fullscreenElement || document.webkitFullscreenElement || null); }
  function isFullscreen() { return !!fsElement(); }
  function fullscreenSupported() { return !!reqFs(); }

  function enterFullscreen() {
    const req = reqFs(); if (!req) return;
    try {
      const p = req.call(root, { navigationUI: 'hide' });
      // requestFullscreen can reject (denied gesture / policy). Swallow so there is no uncaught
      // promise rejection and no console spam; the button state is fixed by fullscreenchange.
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) { /* older webkit throws synchronously with no promise — ignore */ }
  }
  function leaveFullscreen() {
    const ex = exitFs(); if (!ex) return;
    try {
      const p = ex.call(document);
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) { /* ignore */ }
  }
  function toggleFullscreen() { if (isFullscreen()) leaveFullscreen(); else enterFullscreen(); }

  // ---- dev-panel hide/restore (external, non-invasive: only toggles style.display) ----
  function hideDevPanels() {
    devSnapshot = [];
    const els = document.querySelectorAll('[data-dev-only]');
    for (let i = 0; i < els.length; i++) { devSnapshot.push([els[i], els[i].style.display]); els[i].style.display = 'none'; }
  }
  function restoreDevPanels() {
    if (!devSnapshot) return;
    for (let i = 0; i < devSnapshot.length; i++) devSnapshot[i][0].style.display = devSnapshot[i][1];
    devSnapshot = null;
  }

  function updateFsButton(on) {
    if (!fsBtn) return;
    fsBtn.textContent = on ? EXIT_ICON : ENTER_ICON;
    fsBtn.title = on ? 'ออกจากเต็มจอ' : 'เต็มจอ';
    fsBtn.setAttribute('aria-label', on ? 'ออกจากโหมดเต็มจอ' : 'เข้าสู่โหมดเต็มจอ');
    fsBtn.classList.toggle('fs-on', on);
  }

  // Single fullscreenchange handler — fires for button, Esc, browser-back, and system-UI exits, so
  // the button never drifts out of sync. Edge-detects enter vs exit for the dev-panel snapshot.
  function onFullscreenChange() {
    const on = isFullscreen();
    if (on && !wasFullscreen) hideDevPanels();
    else if (!on && wasFullscreen) restoreDevPanels();
    wasFullscreen = on;
    updateFsButton(on);
    // Recompute renderer/camera/layout AFTER the transition settles. rAF avoids reading stale
    // innerWidth/innerHeight mid-transition; the game's own layoutBoard is the sole resize owner,
    // so this adds no second/looping resize path.
    const H = globalThis.GamePresentationHooks;
    if (H && H.relayout) requestAnimationFrame(function () { H.relayout(); });
  }

  // ---- init (wires DOM once; safe no-op if the buttons or DOM are missing) ----
  function init() {
    if (inited || typeof document === 'undefined') return;
    inited = true;
    fsBtn = document.getElementById('fullscreenBtn');

    if (fsBtn) {
      if (!fullscreenSupported()) {
        // Unsupported (e.g. some iOS webviews): hide the control instead of showing a dead button.
        fsBtn.style.display = 'none';
      } else {
        fsBtn.addEventListener('click', toggleFullscreen);
        // one listener each; webkit alias covers Safari/iOS. Both call the same handler.
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);
        wasFullscreen = isFullscreen();
        updateFsButton(wasFullscreen);
      }
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // public surface (mostly for tests / manual triggering)
  return {
    init,
    isFullscreen, fullscreenSupported, enterFullscreen, leaveFullscreen, toggleFullscreen,
    _state() { return { inited, wasFullscreen, devHidden: !!devSnapshot }; },
    _hideDevPanels: hideDevPanels, _restoreDevPanels: restoreDevPanels,
  };
})();

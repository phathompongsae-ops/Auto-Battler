// ============================================================
// GAME PRESENTATION TOOLS v1 — Fullscreen + Screenshot (Demo 1)
// ============================================================
// Two small, player-facing presentation utilities kept fully SEPARATE from game logic. They are
// event-driven (no per-frame polling, no continuous capture) and touch/desktop friendly. They read
// the game only through the read-only bridge globalThis.GamePresentationHooks (defined in game.js);
// with that bridge or the DOM buttons absent they self-disable. Nothing here touches combat, board
// dimensions, camera lock, animation timing, economy, equipment, ninja, augments, monster balance,
// or the Asset Framework — it only presents what already exists.
//
// A. Fullscreen: requestFullscreen on the ROOT element (documentElement) so the whole game —
//    Three.js canvas AND the fixed-position HUD overlays — goes fullscreen together, never just the
//    canvas. Standard API + webkit fallback (Safari/iOS). One fullscreenchange listener keeps the
//    button in sync with Esc / browser-back / system exits. Dev-only debug panels are hidden on
//    enter and restored to their prior visibility on exit. Layout is recomputed via the game's own
//    single layout owner (layoutBoard) — no second resize path, no resize loop.
//
// B. Screenshot: one-shot composite of the WebGL canvas (render-before-capture, since the renderer
//    has no preserveDrawingBuffer) plus a redrawn player-HUD strip onto a temporary 2D canvas, then
//    a locally-generated PNG download. Debug panels and the utility buttons are excluded by
//    construction (only the board + player HUD are drawn). No server, no upload, no big library.
// ============================================================
globalThis.GamePresentationTools = (function () {
  'use strict';

  const ENTER_ICON = '⛶', EXIT_ICON = '🗗';
  const TOAST_MS = 1600;

  let inited = false;
  let fsBtn = null, shotBtn = null, toastEl = null;
  let devSnapshot = null;     // remembered [el, display] pairs while fullscreen hides dev panels
  let wasFullscreen = false;  // last known fullscreen state (drives enter/exit edge detection)
  let capturing = false;      // rapid-tap guard for screenshots
  let toastTimer = null;

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
      // promise rejection and no console spam; the button state is fixed by fullscreenchange (or
      // stays "enter" if the request never took effect).
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

  // ---- screenshot ----
  function two(n) { return String(n).padStart(2, '0'); }
  function screenshotFilename() {
    const H = globalThis.GamePresentationHooks;
    let stage = (H && typeof H.getWave === 'function') ? H.getWave() : null;
    stage = String(stage == null ? 1 : stage).replace(/[^0-9]/g, '');   // sanitize -> digits only
    stage = two(parseInt(stage, 10) || 1);
    const d = new Date();
    const ts = d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '-' + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    return 'auto-battler-stage-' + stage + '-' + ts + '.png';
  }

  function labelText(id) { const e = document.getElementById(id); return e ? (e.textContent || '').trim() : ''; }

  // Redraw the required player HUD onto the composite (faithful values read live from the DOM
  // labels; readable on any board via a translucent strip + text shadow). Only player-facing
  // readouts are drawn, so debug panels and the utility buttons are inherently excluded.
  function drawHud(ctx, w, h) {
    const hp = labelText('playerHpLabel'), waveN = labelText('waveLabel'), waveT = labelText('waveTotal');
    const gold = labelText('goldLabel'), lv = labelText('levelLabel'), phase = labelText('phaseLabel');
    const stageEl = document.getElementById('stageLabel');
    const stage = (stageEl && stageEl.style.display !== 'none') ? (stageEl.textContent || '').trim() : '';
    const barH = Math.max(30, Math.min(72, Math.round(h * 0.06)));
    const fs = Math.max(13, Math.round(barH * 0.42));
    ctx.save();
    ctx.fillStyle = 'rgba(8,11,15,0.60)';
    ctx.fillRect(0, 0, w, barH);
    ctx.font = 'bold ' + fs + 'px system-ui, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#f3efe2';
    const y = Math.round(barH / 2), pad = Math.round(barH * 0.4), gap = Math.round(fs * 1.0);
    let x = pad; ctx.textAlign = 'left';
    function seg(t) { if (!t) return; ctx.fillText(t, x, y); x += ctx.measureText(t).width + gap; }
    seg(hp ? '❤ ' + hp : '');
    seg((waveN ? '🌊 ' + waveN : '') + (waveT ? '/' + waveT : ''));
    seg(gold ? '💰 ' + gold : '');
    seg(lv ? '⭐ Lv.' + lv : '');
    seg(phase);
    if (stage) { ctx.textAlign = 'right'; ctx.fillText(stage, w - pad, y); }
    ctx.restore();
  }

  function endCapture() { capturing = false; if (shotBtn) shotBtn.disabled = false; }

  function captureScreenshot() {
    if (capturing || typeof document === 'undefined') return; // rapid-tap guard + DOM-absent guard
    const H = globalThis.GamePresentationHooks;
    const src = (H && typeof H.getCanvas === 'function') ? H.getCanvas() : document.querySelector('#boardContainer canvas');
    if (!src || !src.width || !src.height) { showToast('บันทึกภาพไม่สำเร็จ'); return; }
    capturing = true; if (shotBtn) shotBtn.disabled = true;
    let out = null;
    try {
      // render-before-capture: draw one fresh frame, then immediately copy it (no preserveDrawing-
      // Buffer needed). Both steps run synchronously before the compositor clears the buffer.
      if (H && typeof H.renderNow === 'function') H.renderNow();
      const w = src.width, h = src.height;   // backing-store px (renderer pixelRatio is 1 => native)
      out = document.createElement('canvas'); out.width = w; out.height = h;
      const ctx = out.getContext('2d');
      ctx.drawImage(src, 0, 0, w, h);        // board — aspect preserved, not stretched, not cropped
      drawHud(ctx, w, h);                    // player HUD strip
      out.toBlob(function (blob) {
        try {
          if (!blob) { showToast('บันทึกภาพไม่สำเร็จ'); endCapture(); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = screenshotFilename();
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);          // free the temporary object URL immediately
          showToast('บันทึกภาพแล้ว');
        } catch (e) {
          showToast('บันทึกภาพไม่สำเร็จ');
        } finally {
          endCapture();                      // temp <canvas>/<a> are unreferenced -> GC'd
        }
      }, 'image/png');
    } catch (e) {
      showToast('บันทึกภาพไม่สำเร็จ');
      endCapture();                          // no persistent hidden state after a failure
    }
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; } // no timer leak / no overlap
    toastTimer = setTimeout(function () { toastEl.style.display = 'none'; toastTimer = null; }, TOAST_MS);
  }

  // ---- init (wires DOM once; safe no-op if the buttons or DOM are missing) ----
  function init() {
    if (inited || typeof document === 'undefined') return;
    inited = true;
    fsBtn = document.getElementById('fullscreenBtn');
    shotBtn = document.getElementById('screenshotBtn');
    toastEl = document.getElementById('presentToast');

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
    if (shotBtn) shotBtn.addEventListener('click', captureScreenshot);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // public surface (mostly for tests / manual triggering)
  return {
    init,
    isFullscreen, fullscreenSupported, enterFullscreen, leaveFullscreen, toggleFullscreen,
    captureScreenshot, screenshotFilename, showToast,
    _state() { return { inited, capturing, wasFullscreen, toastVisible: !!(toastEl && toastEl.style.display === 'block'), devHidden: !!devSnapshot }; },
    _hideDevPanels: hideDevPanels, _restoreDevPanels: restoreDevPanels,
  };
})();

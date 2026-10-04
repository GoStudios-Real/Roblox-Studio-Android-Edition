/* ============================================================
   main.js — boot sequence, Android bridge,
   persistence (drafts + recents), touch controls, service worker
   ============================================================ */
(function (global) {
  'use strict';

  const doc = document;
  const $ = (s) => doc.querySelector(s);

  /* ---------------- Android WebView bridge ----------------
     MainActivity injects `AndroidBridge` (raw @JavascriptInterface).
     We wrap it into a friendlier NativeBridge used by roblox.js. */
  function setupBridge() {
    const raw = global.AndroidBridge;
    if (raw && typeof raw.fetch === 'function') {
      global.NativeBridge = {
        isNative: true,
        async fetch(url, opts) {
          let res;
          try {
            res = await Promise.resolve(raw.fetch(String(url), JSON.stringify(opts || {})));
          } catch (e) {
            throw new Error(String((e && e.message) || e));
          }
          const o = typeof res === 'string' ? JSON.parse(res) : res;
          if (!o || o.error) throw new Error((o && o.error) || 'Native fetch failed');
          let body = o.body;
          if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { /* keep text */ } }
          return { status: o.status || 0, body, ok: o.status >= 200 && o.status < 300, headers: {} };
        },
        openUrl(u) {
          try { raw.openUrl(String(u)); } catch (e) { global.open(String(u), '_blank'); }
        },
        appInfo() {
          try { return JSON.parse(raw.appInfo() || '{}'); } catch (e) { return {}; }
        },
        share(text) {
          try { raw.share(String(text)); return true; } catch (e) { return false; }
        },
        saveFile(name, content) {
          try {
            const r = String(raw.saveFile(String(name), String(content)));
            if (r.indexOf('ok:') === 0) return r.slice(3);
            throw new Error(r);
          } catch (e) { return null; }
        }
      };
      return true;
    }
    global.NativeBridge = { isNative: false };
    return false;
  }

  /* ---------------- persistence helpers ---------------- */
  function countNodes() {
    let c = 0;
    global.Engine.walk(global.Engine.state.place, () => { c++; });
    return c;
  }

  function placeName() {
    const p = global.Engine.state.place;
    return (p && p.props && p.props.Name) || 'Untitled Place';
  }

  function syncPlaceLabel() {
    const name = placeName();
    const el = $('#tbPlace');
    if (el) el.textContent = name;
    doc.title = name + ' — Roblox Studio Android Edition';
  }

  /* Snapshot current place into "Recent places" + autosave a draft. */
  function snapshotPlace() {
    const E = global.Engine;
    if (!E.state.place) return;
    try {
      const json = E.toJSON();
      let list = E.state.recent || (E.state.recent = []);
      const name = placeName();
      const i = list.findIndex((r) => r.name === name);
      const entry = { name, when: Date.now(), count: countNodes(), json };
      if (i >= 0) list.splice(i, 1);
      list.unshift(entry);
      while (list.length > 6) list.pop();
      const store = global.Config.store;
      store.set('recent', list);
      store.set('draft', json);
      const start = $('#startScreen');
      if (start && !start.classList.contains('hidden') && global.UI) global.UI.renderStart();
    } catch (e) {
      console.warn('snapshot failed', e);
    }
  }

  let snapTimer = null;
  function scheduleSnapshot() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapshotPlace, 1200);
  }

  function restoreDraft() {
    const E = global.Engine;
    const d = global.Config.store.get('draft', null);
    if (!d) return false;
    try {
      E.fromJSON(d);
      E.state.dirty = false;
      E.log('sys', 'Draft restored from last session');
      return true;
    } catch (e) {
      global.Config.store.set('draft', null);
      E.log('err', 'Draft could not be restored: ' + e.message);
      return false;
    }
  }

  /* ---------------- touch controls (play mode) ---------------- */
  function wireTouch() {
    const pad = $('#touchPad');
    const base = $('#tpBase');
    const knob = $('#tpKnob');
    const jump = $('#tpJump');
    if (!pad || !base || !knob || !jump) return;
    const R = 44;
    let dragging = false;

    function setJoy(x, y) {
      global.Engine.state.joy[0] = x;
      global.Engine.state.joy[1] = y;
      knob.style.transform = 'translate(' + (x * R) + 'px,' + (y * R) + 'px)';
    }

    function fromEvent(e) {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, R);
      setJoy((dx / d) * (cl / R), (dy / d) * (cl / R));
    }

    base.addEventListener('pointerdown', (e) => {
      dragging = true;
      try { base.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      fromEvent(e);
      e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    ['pointerup', 'pointercancel'].forEach((t) => base.addEventListener(t, () => { dragging = false; setJoy(0, 0); }));
    jump.addEventListener('pointerdown', (e) => {
      global.Engine.state.keys.jump = true;
      e.preventDefault();
    });

    global.Engine.on('mode', () => {
      pad.classList.toggle('hidden', global.Engine.state.mode !== 'play');
      if (global.Engine.state.mode !== 'play') setJoy(0, 0);
    });
  }

  /* ---------------- service worker (offline web build) ---------------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (!global.Lua || !global.Config || !global.Templates || !global.AI || !global.Roblox || !global.Engine || !global.UI) {
      const msg = 'App failed to load — a script is missing or broken.';
      console.error(msg, { Lua: !!global.Lua, Config: !!global.Config, Templates: !!global.Templates, AI: !!global.AI, Roblox: !!global.Roblox, Engine: !!global.Engine, UI: !!global.UI });
      const t = document.createElement('div');
      t.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;background:#3a1212;color:#ffd7d7;padding:12px 16px;border-radius:10px;font:13px/1.4 system-ui;z-index:9999';
      t.textContent = msg;
      document.body.appendChild(t);
      return;
    }

    const E = global.Engine;
    const cfg = global.Config;
    const native = setupBridge();

    E.init();
    const st = E.state;
    st.keys = st.keys || {};
    st.joy = st.joy || [0, 0];
    st.store = cfg.store;
    st.recent = cfg.store.get('recent', []);
    st.groupGames = cfg.store.get('groupGames', []);

    restoreDraft();
    syncPlaceLabel();

    E.on('change', () => { syncPlaceLabel(); scheduleSnapshot(); });
    E.on('props', () => { syncPlaceLabel(); scheduleSnapshot(); });

    global.UI.boot();
    global.UI.renderStart();
    wireTouch();
    registerSW();

    if (native) {
      doc.documentElement.classList.add('native');
      try {
        const info = global.NativeBridge.appInfo() || {};
        if (info.version) {
          const v = $('#stVer');
          if (v) v.textContent = 'v' + info.version + ' · APK';
        }
      } catch (e) { /* ignore */ }
    }

    window.addEventListener('beforeunload', () => { if (snapTimer) { clearTimeout(snapTimer); snapshotPlace(); } });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden && snapTimer) { clearTimeout(snapTimer); snapshotPlace(); } });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);

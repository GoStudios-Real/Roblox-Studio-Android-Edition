/* ============================================================
   Roblox Open Cloud — publishing over the API key.
   No account sign-in: authentication is the Open Cloud API key.
   Network rules:
     1. NativeBridge (Android APK)  — no CORS, works offline of proxies
     2. Direct fetch                 — used when the API sends CORS headers
     3. Optional proxy prefix        — Settings > Credentials > CORS proxy
   ============================================================ */
(function (global) {
  'use strict';

  const cfg = () => global.Config;

  async function net(url, opts) {
    opts = opts || {};
    const proxy = cfg().openCloud.proxy;
    let target = url;
    if (proxy && /^https?:/.test(url)) target = proxy + encodeURIComponent(url);
    if (global.NativeBridge && global.NativeBridge.fetch) {
      try { return await global.NativeBridge.fetch(target, opts); } catch (e) { /* fall through */ }
    }
    const res = await fetch(target, opts);
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch (e) {}
    return { status: res.status, body, headers: {}, ok: res.ok };
  }

  /* ---------------- helpers ---------------- */
  /* Accepts a raw numeric ID or a place link (roblox.com/games/123/…). */
  function parsePlaceId(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    const m = s.match(/\/games\/(\d+)/i) || s.match(/^(\d+)$/);
    return m ? m[1] : s;
  }

  /* Find the universe that owns a place — no auth needed. */
  async function resolveUniverse(placeId) {
    const res = await net('https://apis.roblox.com/universes/v1/places/' + encodeURIComponent(parsePlaceId(placeId)) + '/universe', {});
    if (!res.ok || !res.body || !res.body.universeId) {
      const e = new Error('Could not find a Universe ID for place ' + placeId + ' (HTTP ' + res.status + ')');
      e.status = res.status; throw e;
    }
    return String(res.body.universeId);
  }

  /* ---------------- Open Cloud publishing ---------------- */
  function publishUrl(universeId, placeId, versionType) {
    return cfg().api.publish(universeId, placeId, versionType || 'Published');
  }

  async function publishPlace(opts) {
    const o = cfg().openCloud;
    const universeId = opts.universeId || o.universeId;
    const placeId = parsePlaceId(opts.placeId || o.placeId);
    const apiKey = opts.apiKey || o.apiKey;
    const xml = opts.xml;
    if (!universeId || !placeId) {
      const e = new Error('Missing Place ID (and no Universe ID found) — set them in Game Settings › Publishing.');
      e.code = 'ids'; throw e;
    }
    if (!apiKey) { const e = new Error('Missing Open Cloud API key — Settings › Credentials.'); e.code = 'key'; throw e; }
    if (!xml) { const e = new Error('Nothing to publish.'); e.code = 'empty'; throw e; }

    const url = publishUrl(universeId, placeId, opts.versionType || 'Published');
    const res = await net(url, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/xml' },
      body: xml
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Publish rejected (' + res.status + '): check the API key scopes (universe-places → Write) and that it allows this experience.');
    }
    if (res.status >= 400) {
      const detail = typeof res.body === 'string' ? res.body.slice(0, 300) : JSON.stringify(res.body || {}).slice(0, 300);
      throw new Error('Publish failed (' + res.status + ') ' + detail);
    }
    return { ok: true, universeId: String(universeId), placeId, version: res.body, status: res.status };
  }

  async function introspectKey(apiKey) {
    try {
      const res = await net('https://apis.roblox.com/api-keys/v1/introspect', {
        method: 'POST',
        headers: { 'x-api-key': apiKey || cfg().openCloud.apiKey, 'Content-Type': 'application/json' },
        body: '{}'
      });
      return res.ok ? res.body : null;
    } catch (e) { return null; }
  }

  global.Roblox = {
    publishPlace, publishUrl, resolveUniverse, parsePlaceId, introspectKey, net,
    urls: { create: 'https://create.roblox.com', dashboard: 'https://create.roblox.com/dashboard/creations' }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   Roblox account (OAuth 2.0 + PKCE) and Open Cloud publishing
   Network rules:
     1. NativeBridge (Android APK)  — no CORS, works offline of proxies
     2. Direct fetch                 — used when the API sends CORS headers
     3. Optional proxy prefix        — Settings > Credentials > CORS proxy
   ============================================================ */
(function (global) {
  'use strict';

  const cfg = () => global.Config;
  const store = global.Config.store;
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const random = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };

  function saveTokens(t) { store.set('tokens', t); }
  function tokens() { return store.get('tokens', null); }
  function signedIn() { const t = tokens(); return !!(t && t.access_token); }

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

  /* ---------------- OAuth 2.0 with PKCE ---------------- */
  async function pkce() {
    const verifier = b64url(random(48));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: b64url(digest) };
  }

  async function login(prompt) {
    const o = cfg().oauth;
    if (!o.clientId) {
      const e = new Error('No OAuth Client ID yet — open Settings › Credentials and paste your Roblox Client ID.');
      e.code = 'no-client-id';
      throw e;
    }
    const { verifier, challenge } = await pkce();
    store.set('pkce', verifier);
    const state = b64url(random(16));
    store.set('oauthState', state);
    const url = o.authorize + '?' + new URLSearchParams({
      client_id: o.clientId,
      redirect_uri: o.redirectUri,
      scope: o.scopes,
      response_type: 'code',
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      prompt: prompt || 'login'
    }).toString();
    store.set('pendingAuthUrl', url);

    if (global.NativeBridge && global.NativeBridge.openUrl) {
      global.NativeBridge.openUrl(url);
      return { pending: true, mode: 'external' };
    }
    if (global.isSecureContext || location.protocol === 'http:' || location.protocol === 'https:') {
      location.href = url;
      return { pending: true, mode: 'redirect' };
    }
    location.href = url;
    return { pending: true, mode: 'redirect' };
  }

  async function handleCallback(search) {
    const q = new URLSearchParams(search || location.search);
    const code = q.get('code'), state = q.get('state');
    if (!code) return null;
    const expected = store.get('oauthState', null);
    if (expected && state && state !== expected) throw new Error('OAuth state mismatch — please sign in again.');
    const verifier = store.get('pkce', null);
    const o = cfg().oauth;
    const body = new URLSearchParams({
      client_id: o.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: o.redirectUri,
      code_verifier: verifier || ''
    });
    if (o.clientSecret) body.append('client_secret', o.clientSecret);
    const res = await net(o.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    if (!res.ok || !res.body || !res.body.access_token) {
      throw new Error('Token exchange failed (' + res.status + '): ' + (res.body && (res.body.error_description || res.body.error) || JSON.stringify(res.body)));
    }
    saveTokens(Object.assign({ obtained: Date.now() }, res.body));
    store.set('pkce', null);
    try { history.replaceState({}, '', location.pathname); } catch (e) {}
    return res.body;
  }

  async function refresh() {
    const t = tokens();
    if (!t || !t.refresh_token) return false;
    const o = cfg().oauth;
    const body = new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: o.clientId
    });
    if (o.clientSecret) body.append('client_secret', o.clientSecret);
    const res = await net(o.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    if (res.ok && res.body && res.body.access_token) { saveTokens(Object.assign({ obtained: Date.now() }, res.body)); return true; }
    return false;
  }

  async function authHeaders() {
    let t = tokens();
    if (!t) return null;
    if (t.expires_in && t.obtained && Date.now() - t.obtained > (t.expires_in - 60) * 1000) {
      const ok = await refresh();
      if (!ok) { store.set('tokens', null); return null; }
      t = tokens();
    }
    return { Authorization: 'Bearer ' + t.access_token };
  }

  async function userInfo() {
    const h = await authHeaders();
    if (!h) return null;
    try {
      const res = await net(cfg().oauth.userinfo, { headers: h });
      if (res.ok) return res.body;
    } catch (e) {}
    return null;
  }

  function signOut() { store.set('tokens', null); }

  /* ---------------- generic Roblox REST ---------------- */
  async function get(url, useAuth) {
    const headers = {};
    if (useAuth) { const h = await authHeaders(); if (h) Object.assign(headers, h); }
    const res = await net(url, { headers });
    if (!res.ok) { const err = new Error('HTTP ' + res.status + ' for ' + url); err.status = res.status; err.body = res.body; throw err; }
    return res.body;
  }

  async function profile(userId) {
    try { return await get('https://apis.roblox.com/users/v1/users/' + userId, false); }
    catch (e) { return null; }
  }

  async function myGroups(userId) {
    if (!userId) return [];
    try {
      const r = await get('https://apis.roblox.com/cloud/v2/users/' + userId + '/groups?maxPageSize=50', true);
      const list = (r && (r.groups || r.data)) || [];
      return list.map((g) => ({
        id: String(g.groupId || g.id || '').replace('/groups/', ''),
        name: (g.group && g.group.displayName) || g.displayName || 'Group',
        memberCount: (g.group && g.group.memberCount) || 0,
        role: (g.role && g.role.displayName) || g.roleName || 'Member',
        rank: (g.role && g.role.rank) || 0
      }));
    } catch (e) {
      try {
        const r = await get('https://groups.roblox.com/v1/users/' + userId + '/groups/roles', true);
        return ((r && r.data) || []).map((g) => ({ id: String(g.group.id), name: g.group.name, memberCount: g.group.memberCount, role: g.role ? g.role.name : 'Member', rank: g.role ? g.role.rank : 0 }));
      } catch (e2) { return []; }
    }
  }

  async function myExperiences() {
    try {
      const r = await get('https://create.roblox.com/v1/universes?limit=25&isShared=false', true);
      return (r && r.data) || [];
    } catch (e) { return []; }
  }

  /* ---------------- Open Cloud publishing ---------------- */
  function publishUrl(universeId, placeId, versionType) {
    return cfg().api.publish(universeId, placeId, versionType || 'Published');
  }

  async function publishPlace(opts) {
    const o = cfg().openCloud;
    const universeId = opts.universeId || o.universeId;
    const placeId = opts.placeId || o.placeId;
    const apiKey = opts.apiKey || o.apiKey;
    const xml = opts.xml;
    if (!universeId || !placeId) {
      const e = new Error('Missing Universe ID / Place ID — set them in Game Settings › Publishing.');
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
    return { ok: true, universeId, placeId, version: res.body, status: res.status };
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

  /* ---------------- Toolbox / marketplace ---------------- */
  async function searchAssets(query) {
    try {
      const url = 'https://apis.roblox.com/cloud/v2/assets?filter=contains(name,\'' + encodeURIComponent(query) + '\')&maxPageSize=12';
      const r = await get(url, true);
      return (r && (r.assets || r.data)) || [];
    } catch (e) { return []; }
  }

  async function assetThumbnail(id) {
    return 'https://thumbnails.roblox.com/v1/assets?assetIds=' + id + '&size=150x150&format=Png';
  }

  global.Roblox = {
    login, handleCallback, refresh, userInfo, signOut, signedIn, tokens,
    get, profile, myGroups, myExperiences, publishPlace, introspectKey,
    searchAssets, net, authHeaders,
    urls: { create: 'https://create.roblox.com', dashboard: 'https://create.roblox.com/dashboard/creations' }
  };
})(typeof window !== 'undefined' ? window : globalThis);

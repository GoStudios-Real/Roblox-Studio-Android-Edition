/* Roblox Studio Android Edition — configuration */
(function () {
  const S = window.RSAE_SECRETS || {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rsa:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rsa:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  const Config = {
    version: '1.0.0',
    name: 'Roblox Studio Android Edition',
    store,

    // ---- Fill these in (or set them in Settings > Credentials) ----
    oauth: {
      clientId: store.get('clientId', ''),
      clientSecret: store.get('clientSecret', ''),
      // Deep link used by the APK; HTTPS page used by the web build.
      redirectUri: store.get('redirectUri',
        location.protocol === 'file:' ? 'robloxstudioae://auth'
        : location.origin + location.pathname.replace(/[^/]*$/, '') + 'auth.html'),
      scopes: 'openid profile group:read asset:read universe:write universe.place:write',
      authorize: 'https://apis.roblox.com/oauth/v1/authorize',
      token: 'https://apis.roblox.com/oauth/v1/token',
      userinfo: 'https://apis.roblox.com/oauth/v1/userinfo'
    },

    openCloud: {
      apiKey: store.get('apiKey', S.openCloudApiKey || ''),
      universeId: store.get('universeId', ''),
      placeId: store.get('placeId', ''),
      // Optional CORS proxy prefix for the browser build, e.g. https://your-worker.workers.dev/?url=
      proxy: store.get('proxy', '')
    },

    // Optional OpenAI-compatible model for the AI Builder/Coder.
    ai: {
      endpoint: store.get('aiEndpoint', ''),
      apiKey: store.get('aiKey', ''),
      model: store.get('aiModel', 'gpt-4o-mini')
    },

    getSetting(k, d) { return store.get(k, d); },
    setSetting(k, v) { store.set(k, v); },

    // All Roblox endpoints we talk to.
    api: {
      users: 'https://apis.roblox.com/users/v1',
      groups: 'https://groups.roblox.com/v1',
      marketplace: 'https://apis.roblox.com/cloud/v2',
      publish: (u, p, vt) => `https://apis.roblox.com/universes/v1/${u}/places/${p}/versions?versionType=${vt}`,
      creatorHub: 'https://create.roblox.com'
    }
  };

  window.Config = Config;
})();

/* Roblox Studio Android Edition — configuration */
(function () {
  const S = window.RSAE_SECRETS || {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rsa:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rsa:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* Keys that must also update the in-memory config (so changes apply
     immediately, without a page reload). */
  const SETTING_TARGET = {
    apiKey: ['openCloud', 'apiKey'],
    universeId: ['openCloud', 'universeId'],
    placeId: ['openCloud', 'placeId'],
    proxy: ['openCloud', 'proxy'],
    aiEndpoint: ['ai', 'endpoint'],
    aiKey: ['ai', 'apiKey'],
    aiModel: ['ai', 'model']
  };

  const Config = {
    version: '1.1.0',
    name: 'Roblox Studio Android Edition',
    store,

    // ---- Fill these in (or set them in Settings > Credentials) ----
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
    setSetting(k, v) {
      store.set(k, v);
      const live = SETTING_TARGET[k];
      if (live) Config[live[0]][live[1]] = v;
    },

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

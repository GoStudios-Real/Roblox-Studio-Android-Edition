'use strict';
/* Smoke test: boots the whole app (minus a real canvas) inside Node,
   then checks place building, rbxlx export, templates, AI and Lua glue.

   Run:  node tools/test_app.js                     (also runs tools/test_lua.js)
*/
const path = require('path');
const assert = require('assert');

/* ---------------- browser stubs ---------------- */
global.window = global;
global.self = global;
global.location = {
  protocol: 'file:', origin: 'file://', pathname: '/', search: '', hash: '', href: 'file:///'
};
global.history = { replaceState() {}, pushState() {} };

const mem = new Map();
const storage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => { mem.clear(); },
  key: (i) => Array.from(mem.keys())[i] || null,
  get length() { return mem.size; }
};
global.localStorage = storage;
global.sessionStorage = storage;
function def(name, value) {
  try { Object.defineProperty(global, name, { value, configurable: true, writable: true }); }
  catch (e) { try { global[name] = value; } catch (e2) { /* keep host value */ } }
}
def('navigator', { onLine: true, userAgent: 'node-test', clipboard: null });
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
def('performance', global.performance || { now: () => Date.now() });
def('fetch', async () => { throw new Error('network disabled in test'); });
global.addEventListener = () => {};
global.removeEventListener = () => {};

const ctxStub = new Proxy({}, {
  get: (t, p) => (p in t ? t[p] : () => undefined),
  set: (t, p, v) => { t[p] = v; return true; }
});

function makeEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { return c; }, remove() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [],
    getContext: () => ctxStub,
    focus() {}, blur() {}, click() {}, select() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }),
    insertBefore(c) { return c; },
    contains: () => false,
    textContent: '', innerHTML: '', value: '', placeholder: '',
    width: 800, height: 600, clientWidth: 800, clientHeight: 600,
    scrollLeft: 0, scrollTop: 0, scrollHeight: 0, offsetWidth: 800, offsetHeight: 600,
    parentNode: null, firstChild: null, nextSibling: null
  };
  return el;
}

global.document = {
  readyState: 'complete',
  title: '',
  documentElement: makeEl('html'),
  head: makeEl('head'),
  body: makeEl('body'),
  createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t),
  createTextNode: (t) => ({ textContent: t }),
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  execCommand: () => true,
  activeElement: makeEl()
};
global.getComputedStyle = () => ({ getPropertyValue: () => '', setProperty() {} });

/* ---------------- load the app ---------------- */
const FILES = [
  'lua.js', 'secrets.js', 'config.js', 'templates.js', 'ai.js',
  'roblox.js', 'engine.js', 'ui.js', 'main.js'
];
const jsDir = path.join(__dirname, '..', 'docs', 'js');

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, 'FAIL: ' + label);
  passed++;
  console.log('  ok - ' + label);
}

(async function run() {
  for (const f of FILES) require(path.join(jsDir, f));

  console.log('boot');
  ok(global.Engine && global.UI && global.Lua, 'globals exposed');
  ok(global.Engine.state.place, 'place built on boot');
  ok(global.Engine.state.mode === 'edit', 'boots in edit mode');
  ok(Array.isArray(global.Engine.state.recent), 'recent list loaded');

  console.log('place + rbxlx export');
  const E = global.Engine;
  const xml = E.toXML();
  ok(xml.startsWith('<?xml'), 'xml declaration');
  ok(xml.includes('class="Part"') && xml.includes('Baseplate'), 'baseplate exported');
  ok(xml.includes('class="SpawnLocation"'), 'spawn exported');
  ok(xml.includes('class="Workspace"'), 'services exported');

  let count = 0;
  E.walk(E.state.place, () => { count++; });
  ok(count >= 4, 'instance tree has content (' + count + ' nodes)');

  const json = E.toJSON();
  E.newPlace(true);
  E.fromJSON(json);
  let count2 = 0;
  E.walk(E.state.place, () => { count2++; });
  ok(count2 === count, 'json roundtrip preserves instances');

  console.log('templates');
  const T = global.Templates;
  ok(T.list.length >= 12, 'at least 12 game templates (' + T.list.length + ')');
  ok(!!T.get('obby'), 'obby template present');
  E.loadTemplate('obby');
  const obbyXml = E.toXML();
  ok(obbyXml.includes('Lava') || obbyXml.includes('Checkpoint'), 'obby builds lava/checkpoints');
  ok(E.state.place.children.length >= 3, 'obby has multiple services with content');
  E.newPlace(true);

  console.log('toolbox');
  ok(E.toolboxCategories().length >= 3, 'toolbox categories');
  ok(E.toolboxSearch('spawn').length >= 1, 'toolbox search finds spawn');

  console.log('ai engine');
  const ai = await global.AI.generate('build an obby with lava');
  ok(ai && typeof ai.text === 'string' && ai.text.length > 10, 'AI answers a build prompt');
  const ai2 = await global.AI.generate('write a coin collector script');
  ok(ai2 && (ai2.script || /coin/i.test(ai2.text || '')), 'AI returns lua for a script prompt');
  ok(global.AI.SCRIPTS && Object.keys(global.AI.SCRIPTS).length >= 5, 'script library present');

  console.log('lua glue');
  const r = global.Lua.run('return 1 + 2', {}, {});
  ok(r.ok && r.value && r.value[0] === 3, 'lua runs');
  const r2 = global.Lua.run('print("hello from test")', {}, {});
  ok(r2.ok, 'lua print works');

  console.log('engine play smoke');
  E.playStart();
  ok(E.state.mode === 'play', 'play mode starts');
  E.state.keys.KeyW = true;
  ok(E.state.keys.KeyW, 'shared key buffer wired');
  E.playStop();
  ok(E.state.mode === 'edit', 'play mode stops');

  console.log('oauth removed, api-key only');
  ok(!global.Config.oauth, 'oauth config block removed');
  ok(typeof global.Roblox.login === 'undefined' && typeof global.Roblox.handleCallback === 'undefined', 'OAuth functions removed from Roblox module');
  ok(typeof global.Roblox.signedIn === 'undefined' && typeof global.Roblox.userInfo === 'undefined', 'sign-in helpers removed');
  ok(typeof global.UI.signIn === 'undefined' && typeof global.UI.refreshAccount === 'undefined', 'sign-in UI functions removed');
  ok(typeof global.Roblox.publishPlace === 'function' && typeof global.Roblox.introspectKey === 'function', 'api-key publishing kept');
  ok(global.Roblox.parsePlaceId('https://www.roblox.com/games/1234567890/My-Game?x=1') === '1234567890', 'place URL parsed to id');
  ok(global.Roblox.parsePlaceId('  987654  ') === '987654', 'numeric place id parsed');
  ok(typeof global.Roblox.resolveUniverse === 'function', 'universe auto-resolve present');
  global.Config.setSetting('universeId', '12345');
  ok(global.Config.openCloud.universeId === '12345', 'settings apply immediately without reload');
  global.Config.setSetting('universeId', '');

  console.log('host method colon calls');
  const hm = E.insert({ class: 'Script', name: 'Colon' });
  hm.props.Source = [
    'local Players = game:GetService("Players")',
    'local bp = workspace:FindFirstChild("Baseplate")',
    'local hit = 0',
    'if bp then',
    '  bp.Touched:Connect(function() hit = hit + 1 end)',
    '  bp.Touched:Fire()',
    'end',
    'return type(Players), Players.Name, bp ~= nil, hit'
  ].join('\n');
  const rhm = E.runScriptNode(hm);
  ok(rhm.ok && rhm.value && rhm.value[0] === 'Players', 'game:GetService("Players") colon call returns the service' + (rhm.ok ? '' : ' (' + rhm.error + ')'));
  ok(rhm.ok && rhm.value[2] === true, 'workspace:FindFirstChild colon call works');
  ok(rhm.ok && rhm.value[3] === 1, 'Event:Connect receives the real callback (fires once)');

  console.log('datastores');
  global.localStorage.setItem('rsa:ds:Preload', JSON.stringify({ hp: 7, tag: 'saved' }));
  const dsNode = E.insert({ class: 'Script', name: 'DSTest' });
  dsNode.props.Source = [
    'local DSS = game:GetService("DataStoreService")',
    'local ds = DSS:GetDataStore("Stats")',
    'ds:SetAsync("coins", 42)',
    'ds:IncrementAsync("clicks", 1)',
    'ds:SetAsync("profile", { level = 3, tag = "vip" })',
    'ds:UpdateAsync("xp", function(v) return (v or 0) + 5 end)',
    'local pre = DSS:GetDataStore("Preload")',
    'local hp = pre:GetAsync("hp")',
    'local coins = ds:GetAsync("coins")',
    'local prof = ds:GetAsync("profile")',
    'return hp, coins, prof.level, ds:GetAsync("clicks"), ds:GetAsync("xp")'
  ].join('\n');
  const rds = E.runScriptNode(dsNode);
  ok(rds && rds.ok, 'datastore script runs' + (rds && rds.ok ? '' : ' (' + (rds && rds.error) + ')'));
  ok(rds.ok && rds.value && rds.value[0] === 7, 'DataStore cold-loads values persisted earlier');
  ok(rds.ok && rds.value[1] === 42 && rds.value[2] === 3 && rds.value[3] === 1, 'GetAsync/SetAsync/IncrementAsync roundtrip');
  ok(rds.ok && rds.value[4] === 5, 'UpdateAsync callback works');
  const dsRaw = global.localStorage.getItem('rsa:ds:Stats');
  const dsParsed = dsRaw ? JSON.parse(dsRaw) : {};
  ok(dsParsed.coins === 42 && dsParsed.clicks === 1, 'DataStore writes persist to localStorage');
  ok(dsParsed.profile && dsParsed.profile.level === 3 && dsParsed.profile.tag === 'vip', 'table values persist as plain JSON');
  ok(dsParsed.xp === 5, 'UpdateAsync result persisted');

  console.log('recents snapshot');
  E.emit('change');
  await new Promise((res) => setTimeout(res, 1500));
  ok(global.Engine.state.recent.length >= 1, 'recent entry recorded');
  ok(!!global.localStorage.getItem('rsa:draft'), 'draft autosaved');

  console.log('\n' + passed + ' app smoke checks passed');
})().catch((e) => {
  console.error('\n' + (e && e.stack || e));
  process.exit(1);
});

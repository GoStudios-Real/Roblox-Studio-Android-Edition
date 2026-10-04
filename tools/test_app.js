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

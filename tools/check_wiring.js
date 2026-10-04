'use strict';
/* Checks that every static $('#id') / getElementById('id') referenced by the
   app scripts exists in index.html (catches null-reference boot crashes).
   IDs created dynamically at runtime are listed in DYNAMIC. */
const fs = require('fs');
const path = require('path');

const docs = path.join(__dirname, '..', 'docs', 'app');
const html = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
const htmlIds = new Set();
for (const m of html.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);

/* ids that scripts create on the fly (dialogs, menus, transient nodes) */
const DYNAMIC = new Set([
  'activeMenu', 'f_', 'modalHost', 'ctxMenu', 'toastHost'
]);

const files = ['ui.js', 'main.js', 'engine.js', 'ai.js', 'roblox.js', 'config.js'];
let missing = [];
let refs = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(docs, 'js', f), 'utf8');
  for (const m of src.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)) {
    refs++;
    const id = m[1];
    if (htmlIds.has(id)) continue;
    if (DYNAMIC.has(id) || id.startsWith('f_')) continue;
    const line = src.slice(0, m.index).split('\n').length;
    missing.push(`${f}:${line} #${id}`);
  }
  for (const m of src.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) {
    refs++;
    const id = m[1];
    if (htmlIds.has(id) || DYNAMIC.has(id) || id.startsWith('f_')) continue;
    const line = src.slice(0, m.index).split('\n').length;
    missing.push(`${f}:${line} #${id}`);
  }
}

console.log(`checked ${refs} static id references`);
if (missing.length) {
  console.log('MISSING IDS:');
  missing.forEach((s) => console.log('  ' + s));
  process.exit(1);
}
console.log('all referenced ids exist in index.html');

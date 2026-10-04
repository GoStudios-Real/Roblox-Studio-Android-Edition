'use strict';
/* Verifies every local asset referenced by the landing page, the editor's
   index.html, sw.js and the web manifest actually exists, and prints the
   editor's script load order. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'docs');
const app = path.join(root, 'app');
const missing = [];

function scan(file, base, label) {
  if (!fs.existsSync(file)) { missing.push(label + ' missing: ' + file); return; }
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const u = m[1];
    if (/^(https?:|data:|mailto:|#)/.test(u)) continue;
    if (!fs.existsSync(path.join(base, u))) missing.push(label + ' -> ' + u);
  }
  return html;
}

const landing = scan(path.join(root, 'index.html'), root, 'landing');
scan(path.join(root, 'editor.html'), root, 'editor-alias');
const editor = scan(path.join(app, 'index.html'), app, 'editor');

const scripts = editor ? [...editor.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]) : [];
const css = editor ? [...editor.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]) : [];

const swPath = path.join(app, 'sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8');
  for (const m of sw.matchAll(/'([^']+)'/g)) {
    const u = m[1];
    if (!u.startsWith('./')) continue;
    const rel = u.slice(2);
    if (rel === '' || rel.endsWith('/')) continue;
    if (!fs.existsSync(path.join(app, rel))) missing.push('sw.js -> ' + u);
  }
} else {
  missing.push('app/sw.js missing');
}

const mfPath = path.join(app, 'manifest.webmanifest');
if (fs.existsSync(mfPath)) {
  try {
    const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
    for (const i of mf.icons || []) {
      const rel = i.src.replace(/^\.\//, '').replace(/^\//, '');
      if (!fs.existsSync(path.join(app, rel))) missing.push('manifest -> ' + i.src);
    }
  } catch (e) { missing.push('manifest parse: ' + e.message); }
} else {
  missing.push('manifest.webmanifest missing');
}

console.log('editor css:     ' + css.join(', '));
console.log('editor scripts: ' + scripts.join(' -> '));
if (missing.length) {
  console.log('MISSING:');
  missing.forEach((s) => console.log('  ' + s));
  process.exit(1);
}
console.log('all asset references exist (landing + editor)');

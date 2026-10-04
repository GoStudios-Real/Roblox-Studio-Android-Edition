/* ============================================================
   Lua 5.1-ish interpreter for Roblox Studio Android Edition
   Supports: locals, functions/closures, tables, metatables
   (__index/__newindex/__call/__tostring/__concat/__arith),
   if/while/repeat/for/break/return, varargs, string/math/table
   libs, pcall/error, and a step budget so the UI never locks.
   ============================================================ */
(function (global) {
  'use strict';

  const KW = new Set(['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while']);
  const GLOBALS = new Set(['assert','collectgarbage','error','getmetatable','ipairs','load','loadstring','next','pairs','pcall','print','rawequal','rawget','rawset','select','setmetatable','tonumber','tostring','type','unpack','xpcall','warn','require','coroutine','os','string','table','math','utf8','debug','bit32','workspace','game','script','Instance','SharedTable']);

  class LuaError extends Error {
    constructor(msg, line) { super(String(msg)); this.lua = true; this.line = line || 0; }
  }
  const brk = { brk: true };
  function ret(v) { return { ret: true, v: v || [] }; }

  /* ---------------- Lexer ---------------- */
  function lex(src) {
    const out = []; let i = 0, line = 1, n = src.length;
    const push = (type, value, ln) => out.push({ type, value, line: ln || line });
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '-' && src[i + 1] === '-') {
        i += 2;
        if (src[i] === '[' && src[i + 1] === '[') {           // long comment
          i += 2;
          const end = src.indexOf(']]', i);
          if (end < 0) throw new LuaError('unterminated long comment', line);
          line += (src.slice(i, end).match(/\n/g) || []).length;
          i = end + 2;
        } else {                                              // line comment
          while (i < n && src[i] !== '\n') i++;
        }
        continue;
      }
      if (c === '[' && (src[i + 1] === '[' || src[i + 1] === '=')) {
        let j = i + 1, eq = 0;
        while (src[j] === '=') { eq++; j++; }
        if (src[j] === '[') {
          const close = ']' + '='.repeat(eq) + ']';
          const end = src.indexOf(close, j + 1);
          if (end < 0) throw new LuaError('unterminated long string', line);
          push('string', src.slice(j + 1, end));
          line += (src.slice(j + 1, end).match(/\n/g) || []).length;
          i = end + close.length; continue;
        }
      }
      if (c === '"' || c === "'") {
        const q = c; let s = ''; i++; let ln = line;
        while (i < n && src[i] !== q) {
          if (src[i] === '\\') {
            const e = src[i + 1];
            const map = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '\\': '\\', '"': '"', "'": "'" };
            if (e === 'x') { s += String.fromCharCode(parseInt(src.substr(i + 2, 2), 16)); i += 4; }
            else if (e >= '0' && e <= '9') { let k = i + 1, o = ''; while (k < n && src[k] >= '0' && src[k] <= '9' && o.length < 3) { o += src[k]; k++; } s += String.fromCharCode(parseInt(o, 10)); i = k; }
            else if (e === '\n') { s += '\n'; line++; i += 2; }
            else { s += map[e] !== undefined ? map[e] : e; i += 2; }
          } else { if (src[i] === '\n') line++; s += src[i++]; }
        }
        if (i >= n) throw new LuaError('unfinished string', ln);
        i++; push('string', s, ln); continue;
      }
      if (c >= '0' && c <= '9' || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
        let j = i;
      if (src[i] === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        j = i + 2; while (j < n && /[0-9a-fA-F]/.test(src[j])) j++;
        push('number', parseInt(src.slice(i + 2, j), 16)); i = j; continue;
      }
      while (j < n && /[0-9]/.test(src[j])) j++;
      if (src[j] === '.' && src[j + 1] !== '.') { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
      if (src[j] === 'e' || src[j] === 'E') { j++; if (src[j] === '-' || src[j] === '+') j++; while (j < n && /[0-9]/.test(src[j])) j++; }
        push('number', parseFloat(src.slice(i, j))); i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        const w = src.slice(i, j);
        push(KW.has(w) ? 'kw' : 'name', w); i = j; continue;
      }
      const three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === '...') { push('op', '...'); i += 3; continue; }
      if (two === '..') { push('op', '..'); i += 2; continue; }
      if (['==','~=','<=','>=','//','<<','>>','::'].includes(two)) { push('op', two); i += 2; continue; }
      if ('+-*/%^#<>=(){}[];:,.'.includes(c)) { push('op', c); i++; continue; }
      throw new LuaError("unexpected symbol near '" + c + "'", line);
    }
    out.push({ type: 'eof', value: '<eof>', line });
    return out;
  }

  /* ---------------- Parser ---------------- */
  function parse(src) {
    const ts = lex(src); let p = 0;
    const peek = () => ts[p];
    const next = () => ts[p++];
    const at = (t, v) => ts[p].type === t && (v === undefined || ts[p].value === v);
    const err = (m) => { throw new LuaError(m + ' near ' + (ts[p].type === 'eof' ? '<eof>' : "'" + ts[p].value + "'"), ts[p].line); };
    const accept = (t, v) => { if (at(t, v)) { return next(); } return null; };
    const expect = (t, v) => { const tk = accept(t, v); if (!tk) err((v || t) + ' expected'); return tk; };

    const blockEnd = () => at('eof') || at('kw', 'end') || at('kw', 'else') || at('kw', 'elseif') || at('kw', 'until');

    function parseBlock() {
      const body = [];
      while (!blockEnd()) {
        if (accept('op', ';')) continue;
        const s = parseStat();
        if (s) body.push(s);
        if (s && s.k === 'return') break;
      }
      return body;
    }

    function parseStat() {
      const tk = peek();
      if (tk.type === 'kw') {
        switch (tk.value) {
          case 'local': {
            next();
            if (accept('kw', 'function')) { const name = expect('name').value; return { k: 'localfn', name, fn: parseFuncBody(name, tk.line), line: tk.line }; }
            const names = [expect('name').value];
            while (accept('op', ',')) names.push(expect('name').value);
            let exprs = []; if (accept('op', '=')) exprs = parseExprList();
            return { k: 'local', names, exprs, line: tk.line };
          }
          case 'if': {
            next(); const clauses = [];
            const cond = parseExpr(); expect('kw', 'then');
            clauses.push({ cond, body: parseBlock() });
            while (at('kw', 'elseif')) { next(); const c = parseExpr(); expect('kw', 'then'); clauses.push({ cond: c, body: parseBlock() }); }
            let els = null; if (accept('kw', 'else')) els = parseBlock();
            expect('kw', 'end'); return { k: 'if', clauses, els, line: tk.line };
          }
          case 'while': { next(); const cond = parseExpr(); expect('kw', 'do'); const body = parseBlock(); expect('kw', 'end'); return { k: 'while', cond, body, line: tk.line }; }
          case 'repeat': { next(); const body = parseBlock(); expect('kw', 'until'); const cond = parseExpr(); return { k: 'repeat', cond, body, line: tk.line }; }
          case 'do': { next(); const body = parseBlock(); expect('kw', 'end'); return { k: 'do', body, line: tk.line }; }
          case 'for': {
            next(); const name = expect('name').value;
            if (accept('op', '=')) {
              const a = parseExpr(); expect('op', ','); const b = parseExpr(); let c = null; if (accept('op', ',')) c = parseExpr();
              expect('kw', 'do'); const body = parseBlock(); expect('kw', 'end');
              return { k: 'fornum', name, a, b, c, body, line: tk.line };
            }
            const names = [name]; while (accept('op', ',')) names.push(expect('name').value);
            expect('kw', 'in'); const exprs = parseExprList(); expect('kw', 'do');
            const body = parseBlock(); expect('kw', 'end');
            return { k: 'forin', names, exprs, body, line: tk.line };
          }
          case 'function': { next(); let target = { k: 'name', name: expect('name').value, line: tk.line };
            while (accept('op', '.')) target = { k: 'index', obj: target, key: { k: 'str', v: expect('name').value }, line: tk.line };
            let method = false;
            if (accept('op', ':')) { target = { k: 'index', obj: target, key: { k: 'str', v: expect('name').value }, line: tk.line }; method = true; }
            const fn = parseFuncBody(null, tk.line, method);
            return { k: 'assign', targets: [target], exprs: [fn], line: tk.line };
          }
          case 'return': { next(); const exprs = blockEnd() ? [] : parseExprList(); return { k: 'return', exprs, line: tk.line }; }
          case 'break': next(); return { k: 'break', line: tk.line };
          default: break;
        }
      }
      // expression statement (call or assignment)
      let e = parseSuffixed();
      if (at('op', '=') || at('op', ',')) {
        const targets = [e];
        while (accept('op', ',')) targets.push(parseSuffixed());
        expect('op', '=');
        const exprs = parseExprList();
        for (const t of targets) if (t.k !== 'name' && t.k !== 'index') err('syntax error: cannot assign here');
        return { k: 'assign', targets, exprs, line: tk.line };
      }
      if (e.k !== 'call' && e.k !== 'method') err('syntax error');
      return { k: 'callstat', e, line: tk.line };
    }

    function parseFuncBody(name, line, hasSelf) {
      expect('op', '(');
      const params = hasSelf ? ['self'] : [];
      let vararg = false;
      if (!at('op', ')')) {
        for (;;) {
          if (accept('op', '...')) { vararg = true; break; }
          params.push(expect('name').value);
          if (!accept('op', ',')) break;
        }
      }
      expect('op', ')');
      const body = parseBlock(); expect('kw', 'end');
      return { k: 'function', params, vararg, body, name: name || '(anonymous)', line };
    }

    function parseExprList() { const l = [parseExpr()]; while (accept('op', ',')) l.push(parseExpr()); return l; }

    const BIN = {
      'or': [1, 0], 'and': [2, 0],
      '<': [3, 0], '>': [3, 0], '<=': [3, 0], '>=': [3, 0], '~=': [3, 0], '==': [3, 0],
      '|': [4, 0], '~': [5, 0], '&': [6, 0],
      '<<': [7, 0], '>>': [7, 0],
      '..': [9, 1],
      '+': [10, 0], '-': [10, 0],
      '*': [11, 0], '/': [11, 0], '//': [11, 0], '%': [11, 0],
      '^': [14, 1]
    };
    const UNARY = 12;

    function parseExpr(limit) {
      limit = limit || 0;
      let a;
      const tk = peek();
      if ((tk.type === 'op' || tk.type === 'kw') && ['not', '#', '-', '+'].includes(tk.value)) {
        next(); const e = parseExpr(UNARY);
        a = { k: 'unop', op: tk.value, e, line: tk.line };
      } else a = parseSimple();
      for (;;) {
        const t = peek();
        if (t.type !== 'op' && !(t.type === 'kw' && (t.value === 'and' || t.value === 'or'))) break;
        const key = t.value; const info = BIN[key];
        if (!info || info[0] <= limit && !(info[1] && info[0] === limit)) break;
        if (!info) break;
        next();
        const rhs = parseExpr(info[1] ? info[0] : info[0]);
        a = { k: 'binop', op: key, a, b: rhs, line: t.line };
        if (limit && info[0] <= limit && !info[1]) break;
      }
      return a;
    }

    function parseSimple() {
      const tk = peek();
      if (tk.type === 'name') return parseSuffixed();
      if (tk.type === 'number') { next(); return { k: 'num', v: tk.value, line: tk.line }; }
      if (tk.type === 'string') { next(); return { k: 'str', v: tk.value, line: tk.line }; }
      if (tk.type === 'kw') {
        if (tk.value === 'nil') { next(); return { k: 'nil', line: tk.line }; }
        if (tk.value === 'true') { next(); return { k: 'true', line: tk.line }; }
        if (tk.value === 'false') { next(); return { k: 'false', line: tk.line }; }
        if (tk.value === 'function') { next(); return parseFuncBody(null, tk.line); }
      }
      if (tk.type === 'op') {
        if (tk.value === '...') { next(); return { k: 'vararg', line: tk.line }; }
        if (tk.value === '(') return parseSuffixed();
        if (tk.value === '{') return parseTable();
      }
      err('unexpected symbol');
    }

    function parseTable() {
      const line = peek().line; expect('op', '{');
      const items = [];
      while (!at('op', '}')) {
        if (at('op', '[')) { next(); const key = parseExpr(); expect('op', ']'); expect('op', '='); items.push({ key, val: parseExpr() }); }
        else if (at('name') && ts[p + 1].type === 'op' && ts[p + 1].value === '=') { const key = { k: 'str', v: next().value, line }; next(); items.push({ key, val: parseExpr() }); }
        else items.push({ key: null, val: parseExpr() });
        if (!accept('op', ',') && !accept('op', ';')) break;
      }
      expect('op', '}');
      return { k: 'table', items, line };
    }

    function parseSuffixed() {
      let e = parsePrimary();
      for (;;) {
        const t = peek();
        if (t.type === 'op' && t.value === '.') { next(); e = { k: 'index', obj: e, key: { k: 'str', v: expect('name').value, line: t.line }, line: t.line }; }
        else if (t.type === 'op' && t.value === '[') { next(); const k = parseExpr(); expect('op', ']'); e = { k: 'index', obj: e, key: k, line: t.line }; }
        else if (t.type === 'op' && t.value === ':') { next(); const name = expect('name').value; e = { k: 'method', obj: e, name, args: parseArgs(), line: t.line }; }
        else if (t.type === 'string' || (t.type === 'op' && (t.value === '(' || t.value === '{'))) { e = { k: 'call', fn: e, args: parseArgs(), line: t.line }; }
        else break;
      }
      return e;
    }
    function parseArgs() {
      if (at('op', '(')) { next(); const a = at('op', ')') ? [] : parseExprList(); expect('op', ')'); return a; }
      if (at('op', '{')) return [parseTable()];
      if (at('string')) return [parseSimple()];
      err('(' + ' expected');
    }
    function parsePrimary() {
      const tk = peek();
      if (tk.type === 'name') { next(); return { k: 'name', name: tk.value, line: tk.line }; }
      if (tk.type === 'op' && tk.value === '(') { next(); const e = parseExpr(); expect('op', ')'); return { k: 'paren', e, line: tk.line }; }
      err('unexpected symbol');
    }

    const body = parseBlock();
    if (!at('eof')) err('<eof> expected');
    return body;
  }

  /* ---------------- Values ---------------- */
  class Table {
    constructor(host) { this.m = new Map(); this.meta = null; this.host = host || null; this.arr = null; }
    get(k) {
      if (typeof k === 'number' && k === Math.floor(k)) k = k;
      if (this.m.has(k)) return this.m.get(k);
      if (this.host && k in this.host) { const v = this.host[k]; return typeof v === 'function' ? v.bind(this.host) : v; }
      if (this.meta) { const ix = mt(this.meta, '__index'); if (ix) { if (ix instanceof Table) return ix.get(k); if (typeof ix === 'function') return 'CALL'; } }
      return null;
    }
    set(k, v) {
      if (this.host && k in this.host) {
        try { this.host[k] = v; this.m.delete(k); return; } catch (e) {}
      }
      if (v === null || v === undefined) this.m.delete(k); else this.m.set(k, v);
    }
    len() { let i = 1; while (this.m.has(i)) i++; return i - 1; }
  }
  function mt(t, name) { return (t && t.meta && t.meta.m && t.meta.m.get(name)) || null; }

  function truthy(v) { return v !== null && v !== undefined && v !== false; }
  function num(v, line) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const n = parseFloat(v); if (!isNaN(n)) return n; }
    throw new LuaError("attempt to perform arithmetic on a " + typeName(v) + " value", line);
  }
  function typeName(v) {
    if (v === null || v === undefined) return 'nil';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (v instanceof Table) return v.host && v.host.__type ? v.host.__type : 'table';
    if (typeof v === 'function') return 'function';
    return typeof v;
  }
  function tostring(v) {
    if (v === null || v === undefined) return 'nil';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') {
      if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
      return String(v);
    }
    if (typeof v === 'string') return v;
    if (v instanceof Table) {
      const ts = mt(v, '__tostring'); if (ts && typeof ts === 'function') return String(ts(v));
      if (v.host && v.host.__tostring) return String(v.host.__tostring());
      return (v.host && v.host.__classname ? v.host.__classname : 'table') + ': 0x' + (v.host && v.host.__ref || Math.floor(Math.random() * 1e9).toString(16));
    }
    if (typeof v === 'function') return 'function: 0x' + Math.floor(Math.random() * 1e9).toString(16);
    return String(v);
  }

  /* ---------------- VM ---------------- */
  class Env {
    constructor(parent) { this.vars = new Map(); this.parent = parent || null; }
    declare(n, v) { this.vars.set(n, v === undefined ? null : v); }
    lookup(n) { let e = this; while (e) { if (e.vars.has(n)) return e; e = e.parent; } return null; }
    get(n, line) { const e = this.lookup(n); if (e) return e.vars.get(n);
      const g = globalEnv.vars.get(n); if (g !== undefined) return g;
      throw new LuaError("attempt to call a nil value ('" + n + "')", line); }
    // Note: reading unknown globals returns nil (per Lua); the error above only triggers for calls.
    read(n) { const e = this.lookup(n); if (e) return e.vars.get(n); return globalEnv.vars.has(n) ? globalEnv.vars.get(n) : null; }
    write(n, v) { const e = this.lookup(n); if (e) e.vars.set(n, v); else globalEnv.vars.set(n, v); }
  }

  const globalEnv = new Env(null);
  let currentBudget = { n: 0 };
  const defaultBudget = 5e6;

  function tick(n) { currentBudget.n -= (n || 1); if (currentBudget.n <= 0) throw new LuaError('script timeout (infinite loop protected)', 0); }

  function isCallable(v) {
    if (typeof v === 'function') return true;
    if (v instanceof Table) { if (typeof v.host === 'function') return true; if (mt(v, '__call')) return true; }
    return false;
  }

  function callValue(fn, args, line) {
    tick(2);
    if (typeof fn === 'function') return fn.apply(null, args);
    if (fn instanceof Table) {
      if (typeof fn.host === 'function') return fn.host.apply(fn, args);
      const co = mt(fn, '__call');
      if (co) return callValue(co, [fn].concat(args), line);
    }
    throw new LuaError('attempt to call a ' + typeName(fn) + ' value', line);
  }

  function indexValue(obj, key, line) {
    tick();
    if (obj instanceof Table) {
      const v = obj.get(key);
      if (v !== null && v !== undefined) return v;
      const ix = obj.meta ? obj.meta.m.get('__index') : null;
      if (ix) { if (ix instanceof Table) return indexValue(ix, key, line); if (isCallable(ix)) return callValue(ix, [obj, key], line); }
      return null;
    }
    if (typeof obj === 'string') { const lib = globalEnv.vars.get('string'); return lib ? lib.get(key) : null; }
    if (typeof obj === 'number') { const lib = globalEnv.vars.get('math'); return lib ? lib.get(key) : null; }
    return null;
  }

  function newIndexValue(obj, key, val, line) {
    tick();
    if (!(obj instanceof Table)) throw new LuaError('attempt to index a ' + typeName(obj) + ' value', line);
    if (obj.host && key in obj.host) { try { obj.host[key] = val; obj.m.delete(key); return; } catch (e) {} }
    const raw = obj.m.has(key);
    if (!raw && obj.meta) {
      const nx = obj.meta.m.get('__newindex');
      if (nx) { if (nx instanceof Table) { newIndexValue(nx, key, val, line); return; } if (isCallable(nx)) { callValue(nx, [obj, key, val], line); return; } }
    }
    obj.set(key, val);
  }

  function evalMulti(node, env, line) {
    if (!node) return [];
    if (node.k === 'call' || node.k === 'method') return callExpr(node, env);
    if (node.k === 'vararg') return env.__vararg || [];
    if (node.k === 'name') return [evalExpr(node, env)];
    if (node.k === 'paren') { evalExpr(node.e, env); return [lastOf(evalMulti(node.e, env))]; }
    return [evalExpr(node, env)];
  }
  function lastOf(a) { return a.length ? a[a.length - 1] : null; }

  function callExpr(node, env) {
    let fn, self = null, args;
    if (node.k === 'method') { self = evalExpr(node.obj, env); fn = indexValue(self, node.name, node.line); args = evalArgs(node.args, env, self); }
    else { fn = evalExpr(node.fn, env); args = evalArgs(node.args, env); }
    const r = callValue(fn, args, node.line);
    return Array.isArray(r) ? r : [r === undefined ? null : r];
  }
  function evalArgs(list, env, self) {
    const out = [];
    list.forEach((e, i) => {
      const isLast = i === list.length - 1;
      if (isLast && (e.k === 'call' || e.k === 'method' || e.k === 'vararg')) out.push(...evalMulti(e, env));
      else out.push(evalExpr(e, env));
    });
    if (self !== undefined && self !== null) out.unshift(self);
    return out;
  }

  function evalExpr(node, env) {
    tick();
    switch (node.k) {
      case 'num': return node.v;
      case 'str': return node.v;
      case 'nil': return null;
      case 'true': return true;
      case 'false': return false;
      case 'vararg': return (env.__vararg || [])[0] === undefined ? null : env.__vararg[0];
      case 'name': return env.read(node.name);
      case 'paren': return evalExpr(node.e, env);
      case 'index': { const o = evalExpr(node.obj, env); const k = evalExpr(node.key, env);
        if (o === null || o === undefined) throw new LuaError("attempt to index a nil value", node.line);
        return indexValue(o, k, node.line); }
      case 'call': case 'method': return lastOf(callExpr(node, env));
      case 'function': return makeFunction(node, env);
      case 'table': {
        const t = new Table();
        let i = 1;
        for (const it of node.items) {
          if (it.key) { const k = evalExpr(it.key, env); const v = evalExpr(it.val, env); t.set(k, v); }
          else {
            const isLast = node.items.indexOf(it) === node.items.length - 1;
            if (isLast && (it.val.k === 'call' || it.val.k === 'method' || it.val.k === 'vararg')) { for (const v of evalMulti(it.val, env)) t.set(i++, v); }
            else t.set(i++, evalExpr(it.val, env));
          }
        }
        return t;
      }
      case 'unop': return evalUnop(node, env);
      case 'binop': return evalBinop(node, env);
      default: throw new LuaError('cannot evaluate ' + node.k, node.line);
    }
  }

  function evalUnop(node, env) {
    const v = evalExpr(node.e, env);
    if (node.op === 'not') return !truthy(v);
    if (node.op === '-') return -num(v, node.line);
    if (node.op === '+') return num(v, node.line);
    if (node.op === '#') {
      if (typeof v === 'string') return v.length;
      if (v instanceof Table) return v.len();
      throw new LuaError('attempt to get length of a ' + typeName(v) + ' value', node.line);
    }
  }

  function evalBinop(node, env) {
    const op = node.op;
    if (op === 'and') { const a = evalExpr(node.a, env); return truthy(a) ? evalExpr(node.b, env) : a; }
    if (op === 'or') { const a = evalExpr(node.a, env); return truthy(a) ? a : evalExpr(node.b, env); }
    const a = evalExpr(node.a, env);
    const b = evalExpr(node.b, env);
    switch (op) {
      case '==': return eq(a, b);
      case '~=': return !eq(a, b);
      case '<': case '>': case '<=': case '>=': return compare(op, a, b, node.line);
      case '..': {
        const mm = (a instanceof Table && mt(a, '__concat')) || (b instanceof Table && mt(b, '__concat'));
        if (mm) return callValue(mm, [a, b], node.line);
        if ((typeof a !== 'string' && typeof a !== 'number') || (typeof b !== 'string' && typeof b !== 'number'))
          throw new LuaError('attempt to concatenate a ' + typeName(a) + ' value', node.line);
        return tostring(a) + tostring(b);
      }
      case '+': case '-': case '*': case '/': case '//': case '%': case '^': return arith(op, a, b, node.line);
      case '&': return (num(a, node.line) | 0) & (num(b, node.line) | 0);
      case '|': return (num(a, node.line) | 0) | (num(b, node.line) | 0);
      case '~': return (num(a, node.line) | 0) ^ (num(b, node.line) | 0);
      case '<<': return (num(a, node.line) | 0) << (num(b, node.line) | 0);
      case '>>': return (num(a, node.line) | 0) >> (num(b, node.line) | 0);
    }
    throw new LuaError('unknown operator ' + op, node.line);
  }
  function eq(a, b) {
    if (a === b) return true;
    if (a instanceof Table && b instanceof Table) return a === b;
    return false;
  }
  function compare(op, a, b, line) {
    if (typeof a === 'number' && typeof b === 'number') { }
    else if (typeof a === 'string' && typeof b === 'string') { }
    else throw new LuaError('attempt to compare ' + typeName(a) + ' with ' + typeName(b), line);
    if (op === '<') return a < b; if (op === '>') return a > b;
    if (op === '<=') return a <= b; return a >= b;
  }
  function arith(op, a, b, line) {
    const mm = (a instanceof Table && mt(a, '__' + ({ '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '^': 'pow' }[op])));
    if (mm) return callValue(mm, [a, b], line);
    const x = num(a, line), y = num(b, line);
    switch (op) {
      case '+': return x + y; case '-': return x - y; case '*': return x * y;
      case '/': return x / y;
      case '//': return Math.floor(x / y);
      case '%': return x - Math.floor(x / y) * y;
      case '^': return Math.pow(x, y);
    }
  }

  function makeFunction(node, env) {
    const f = function () {
      const e = new Env(env);
      node.params.forEach((p, i) => e.declare(p, i < arguments.length ? arguments[i] : null));
      if (node.vararg) e.__vararg = Array.from(arguments).slice(node.params.length);
      try { execBlock(node.body, e); } catch (ex) { if (ex && ex.ret) return ex.v; throw ex; }
      return [];
    };
    f.__lua = true; f.__name = node.name || 'function'; f.__params = node.params.length;
    return f;
  }

  function execBlock(body, env) {
    for (const st of body) execStat(st, env);
  }

  function execStat(st, env) {
    tick();
    switch (st.k) {
      case 'local': {
        const vals = [];
        st.exprs.forEach((e, i) => {
          const isLast = i === st.exprs.length - 1;
          if (isLast && (e.k === 'call' || e.k === 'method' || e.k === 'vararg')) vals.push(...evalMulti(e, env));
          else vals.push(evalExpr(e, env));
        });
        st.names.forEach((n, i) => env.declare(n, vals[i] === undefined ? null : vals[i]));
        return;
      }
      case 'localfn': { env.declare(st.name, null); env.vars.set(st.name, makeFunction(st.fn, env)); return; }
      case 'assign': {
        const vals = [];
        st.exprs.forEach((e, i) => {
          const isLast = i === st.exprs.length - 1;
          if (isLast && (e.k === 'call' || e.k === 'method' || e.k === 'vararg')) vals.push(...evalMulti(e, env));
          else vals.push(evalExpr(e, env));
        });
        st.targets.forEach((t, i) => {
          const v = vals[i] === undefined ? null : vals[i];
          if (t.k === 'name') env.write(t.name, v);
          else { const o = evalExpr(t.obj, env); const k = evalExpr(t.key, env);
            if (o === null) throw new LuaError('attempt to index a nil value', st.line);
            newIndexValue(o, k, v, st.line); }
        });
        return;
      }
      case 'callstat': { callExpr(st.e, env); return; }
      case 'if': {
        for (const c of st.clauses) { if (truthy(evalExpr(c.cond, env))) { execBlock(c.body, new Env(env)); return; } }
        if (st.els) execBlock(st.els, new Env(env));
        return;
      }
      case 'while': { while (truthy(evalExpr(st.cond, env))) { try { execBlock(st.body, new Env(env)); } catch (e) { if (e === brk) break; throw e; } tick(); } return; }
      case 'repeat': { do { try { execBlock(st.body, new Env(env)); } catch (e) { if (e === brk) break; throw e; } tick(); } while (!truthy(evalExpr(st.cond, env))); return; }
      case 'do': execBlock(st.body, new Env(env)); return;
      case 'fornum': {
        let a = num(evalExpr(st.a, env), st.line), lim = num(evalExpr(st.b, env), st.line);
        const step = st.c ? num(evalExpr(st.c, env), st.line) : 1;
        if (step === 0) throw new LuaError("'for' step is zero", st.line);
        for (; step > 0 ? a <= lim : a >= lim; a += step) {
          const e = new Env(env); e.declare(st.name, a);
          try { execBlock(st.body, e); } catch (ex) { if (ex === brk) break; throw ex; }
          tick(3);
        }
        return;
      }
      case 'forin': {
        const lists = st.exprs.map((e, i) => {
          const isLast = i === st.exprs.length - 1;
          return isLast && (e.k === 'call' || e.k === 'method' || e.k === 'vararg') ? evalMulti(e, env) : [evalExpr(e, env)];
        });
        const itFn = lists[0][0], state = lists[0][1], ctrl = lists[0][2];
        if (!isCallable(itFn)) throw new LuaError('attempt to call a ' + typeName(itFn) + ' value', st.line);
        let c = ctrl;
        for (;;) {
          tick(3);
          const r = callValue(itFn, [state, c], st.line);
          const vals = Array.isArray(r) ? r : [r];
          if (!truthy(vals[0])) break;
          c = vals[0];
          const e = new Env(env);
          st.names.forEach((n, i) => e.declare(n, vals[i] === undefined ? null : vals[i]));
          try { execBlock(st.body, e); } catch (ex) { if (ex === brk) break; throw ex; }
        }
        return;
      }
      case 'return': {
        const vals = [];
        st.exprs.forEach((e, i) => {
          const isLast = i === st.exprs.length - 1;
          if (isLast && (e.k === 'call' || e.k === 'method' || e.k === 'vararg')) vals.push(...evalMulti(e, env));
          else vals.push(evalExpr(e, env));
        });
        throw ret(vals);
      }
      case 'break': throw brk;
      default: throw new LuaError('cannot execute ' + st.k, st.line);
    }
  }

  /* ---------------- Standard library ---------------- */
  function lib(name, host) { const t = new Table(host); globalEnv.vars.set(name, t); return t; }
  function fn(f) { return f; }

  function strLib() {
    const S = {};
    const norm = (s) => typeof s === 'string' ? s : tostring(s);
    Object.assign(S, {
      len: (s) => norm(s).length,
      sub: (s, i, j) => { s = norm(s); let a = i == null ? 1 : i, b = j == null ? -1 : j;
        a = a < 0 ? Math.max(s.length + a + 1, 1) : Math.min(a, s.length + 1) || 1;
        b = b < 0 ? s.length + b + 1 : b; if (a > b) return ''; return s.slice(a - 1, b); },
      upper: (s) => norm(s).toUpperCase(), lower: (s) => norm(s).toLowerCase(),
      rep: (s, n) => norm(s).repeat(Math.max(0, n | 0)),
      reverse: (s) => norm(s).split('').reverse().join(''),
      byte: (s, i) => norm(s).charCodeAt((i || 1) - 1),
      char: (...a) => a.map(c => String.fromCharCode(c)).join(''),
      format: (f, ...a) => {
        let i = 0;
        return norm(f).replace(/%([-+ #0]*)(\d*)(?:\.(\d+))?([scdifgxeEoqub])/g, (m, flags, w, prec, conv) => {
          let v = a[i++];
          if (conv === 's') return String(typeof v === 'object' && v !== null ? (tostring(v)) : v);
          if (conv === 'q') return '"' + String(v).replace(/"/g, '\\"') + '"';
          const n = Number(v) || 0;
          const width = w ? +w : 0;
          const pad = (s) => (flags.includes('-') ? s.padEnd(width, ' ') : s.padStart(width, flags.includes('0') && !flags.includes('-') ? '0' : ' '));
          if (conv === 'd' || conv === 'i') return pad(String(Math.trunc(n)));
          if (conv === 'f') { const p = prec !== undefined ? +prec : 6; return pad(n.toFixed(p)); }
          if (conv === 'e' || conv === 'E') { const s = n.toExponential(prec !== undefined ? +prec : 6); return pad(conv === 'E' ? s.toUpperCase() : s); }
          if (conv === 'x') return pad((n >>> 0).toString(16));
          if (conv === 'X') return pad((n >>> 0).toString(16).toUpperCase());
          if (conv === 'o') return pad((n >>> 0).toString(8));
          if (conv === 'b') return pad((n >>> 0).toString(2));
          if (conv === 'c') return pad(String.fromCharCode(n));
          if (conv === 'g') return pad(String(Number(n.toPrecision(prec !== undefined ? +prec : 6))));
          return String(v);
        });
      },
      find: (s, pat, init) => { s = norm(s); const start = Math.max((init == null ? 1 : init) - 1, init < 0 ? s.length + init : 0);
        const r = searchFrom(s, norm(pat), start); return r ? [r.pos + 1, r.pos + r.len] : null; },
      match: (s, pat) => { const r = searchFrom(norm(s), norm(pat), 0); return r ? r.v.slice() : null; },
      gmatch: (s, pat) => { s = norm(s); pat = norm(pat); let from = 0;
        const res = [];
        while (from <= s.length) { const r = searchFrom(s, pat, from); if (!r) break;
          res.push(...r.v); from = r.pos + Math.max(r.len, 1); }
        let i = 0; return () => i < res.length ? res[i++] : null; },
      gsub: (s, pat, rep) => { s = norm(s); pat = norm(pat); let out = '', from = 0, count = 0;
        for (;;) {
          const r = searchFrom(s, pat, from);
          if (!r) { out += s.slice(from); break; }
          out += s.slice(from, r.pos);
          const repStr = typeof rep === 'function'
            ? tostring(lastOf(callValue(rep, r.v)))
            : (typeof rep === 'string' ? rep.replace(/%([1-9])/g, (m, d) => tostring(r.v[d - 1] !== undefined ? r.v[d - 1] : '')) : tostring(rep));
          out += repStr; count++;
          from = r.pos + r.len;
          if (r.len === 0) { if (from < s.length) { out += s[from]; from++; } else break; }
          if (count > 100000) break;
        }
        return [out, count]; }
    });
    return S;
  }
  // tiny Lua pattern matcher: %a %d %s %w %p %x classes, '.', quantifiers + * - ?, literals
  const CLS = {
    a: (c) => /[A-Za-z_]/.test(c), d: (c) => /[0-9]/.test(c), s: (c) => /\s/.test(c),
    w: (c) => /[A-Za-z0-9_]/.test(c), l: (c) => /[a-z]/.test(c), u: (c) => /[A-Z]/.test(c),
    x: (c) => /[0-9a-fA-F]/.test(c), p: (c) => /[!-\/:-@\[-`{-~]/.test(c),
    W: (c) => !/[A-Za-z0-9_]/.test(c), D: (c) => !/[0-9]/.test(c), S: (c) => !/\s/.test(c),
    L: (c) => !/[a-z]/.test(c), U: (c) => !/[A-Z]/.test(c)
  };
  function atomAt(pat, j) {
    if (pat[j] === '%') { const c = pat[j + 1]; return { test: CLS[c] ? CLS[c] : ((ch) => ch === c), next: j + 2 }; }
    if (pat[j] === '.') return { test: () => true, next: j + 1 };
    const lit = pat[j];
    return { test: (ch) => ch === lit, next: j + 1 };
  }
  function matchAt(s, pat, i, j) {
    if (j >= pat.length) return i;
    const a = atomAt(pat, j), nj = a.next, q = pat[nj];
    if (q === '+' || q === '*' || q === '-' || q === '?') {
      const rest = nj + 1;
      let end = i; while (end < s.length && a.test(s[end])) end++;
      const runLen = end - i;
      if (q === '-' || q === '?') {                       // lazy / optional: shortest first
        const hi = q === '?' ? 1 : runLen;
        for (let c = 0; c <= hi; c++) { const r = matchAt(s, pat, i + c, rest); if (r >= 0) return r; }
        return -1;
      }
      const lo = q === '+' ? 1 : 0;                       // greedy with backtracking
      for (let c = runLen; c >= lo; c--) { const r = matchAt(s, pat, i + c, rest); if (r >= 0) return r; }
      return -1;
    }
    if (i < s.length && a.test(s[i])) return matchAt(s, pat, i + 1, nj);
    return -1;
  }
  function anchoredMatch(s, pat, si, pi) {
    const r = matchAt(s, pat, si, pi);
    if (r < 0) return null;
    return { len: r - si, v: [s.slice(si, r)] };
  }
  function searchFrom(s, pat, start) {
    if (start < 0) start = 0;
    for (let i = start; i <= s.length; i++) {
      const m = anchoredMatch(s, pat, i, 0);
      if (m) return { pos: i, len: m.len, v: m.v };
      if (pat === '') break;
    }
    return null;
  }

  function mathLib() {
    return {
      abs: Math.abs, floor: Math.ceil ? Math.floor : Math.floor, ceil: Math.ceil, sqrt: Math.sqrt,
      sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
      exp: Math.exp, log: Math.log, log10: Math.log10 || (x => Math.log(x) / Math.LN10),
      max: (...a) => Math.max(...a.map(x => +x)), min: (...a) => Math.min(...a.map(x => +x)),
      fmod: (a, b) => a - Math.floor(a / b) * b, modf: (x) => [Math.trunc(x), x - Math.trunc(x)],
      pow: (a, b) => Math.pow(a, b), random: (a, b) => { if (a === undefined) return Math.random(); if (b === undefined) { const n = Math.floor(a); return Math.floor(Math.random() * (n + 1)); } return Math.floor(Math.random() * (b - a + 1)) + a; },
      randomseed: () => {}, huge: Infinity, pi: Math.PI, tointeger: (x) => Number.isInteger(x) ? x : Math.floor(x),
      clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi), round: (x, p) => { const m = Math.pow(10, p || 0); return Math.round(x * m) / m; }
    };
  }
  function tableLib() {
    return {
      insert: (t, ...a) => { if (a.length === 1) { t.set(t.len() + 1, a[0]); } else { const pos = a[0], v = a[1]; const n = t.len(); for (let i = n; i >= pos; i--) t.set(i + 1, t.get(i)); t.set(pos, v); } },
      remove: (t, pos) => { const n = t.len(); const p = pos == null ? n : pos; if (n === 0) return null; const v = t.get(p); for (let i = p; i < n; i++) t.set(i, t.get(i + 1)); t.set(n, null); return v; },
      concat: (t, sep, i, j) => { sep = sep == null ? '' : sep; const a = i || 1, b = j || t.len(); const out = []; for (let k = a; k <= b; k++) out.push(tostring(t.get(k))); return out.join(sep); },
      sort: (t, cmp) => { const n = t.len(); const arr = []; for (let i = 1; i <= n; i++) arr.push(t.get(i));
        if (cmp) arr.sort((x, y) => { const r = callValue(cmp, [x, y], 0); return truthy(Array.isArray(r) ? r[0] : r) ? -1 : 1; });
        else arr.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
        arr.forEach((v, i) => t.set(i + 1, v)); },
      unpack: (t, i, j) => { const a = i || 1, b = j || t.len(); const out = []; for (let k = a; k <= b; k++) out.push(t.get(k)); return out; }
    };
  }

  function installStdlib() {
    globalEnv.vars.set('print', (...a) => { globalEnv.__print && globalEnv.__print(a.map(tostring).join('\t')); return []; });
    globalEnv.vars.set('warn', (...a) => { globalEnv.__warn && globalEnv.__warn(a.map(tostring).join('\t')); return []; });
    globalEnv.vars.set('error', (m, lvl) => {
      if (typeof m === 'string') throw new LuaError(m, 0);
      throw { luaValue: m };
    });
    globalEnv.vars.set('assert', (c, m) => { if (!truthy(c)) throw new LuaError(tostring(m || 'assertion failed!'), 0); return [c]; });
    globalEnv.vars.set('type', (v) => typeName(v));
    globalEnv.vars.set('tostring', (v) => tostring(v));
    globalEnv.vars.set('tonumber', (v, b) => { if (typeof v === 'number') return v; if (typeof v === 'string') { if (b) { const n = parseInt(v, b); return isNaN(n) ? null : n; } const n = parseFloat(v); return isNaN(n) ? (v.trim() === '' ? null : (/^[+-]?\d+$/.test(v.trim()) ? parseInt(v, 10) : null)) : n; } return null; });
    globalEnv.vars.set('rawget', (t, k) => (t.m.has(k) ? t.m.get(k) : null));
    globalEnv.vars.set('rawset', (t, k, v) => { t.m.set(k, v); return t; });
    globalEnv.vars.set('rawequal', (a, b) => a === b);
    globalEnv.vars.set('setmetatable', (t, m) => { t.meta = m; return t; });
    globalEnv.vars.set('getmetatable', (t) => (t && t.meta) || null);
    globalEnv.vars.set('select', (n, ...a) => { if (n === '#') return a.length; return a.slice(n - 1); });
    globalEnv.vars.set('pcall', (f, ...a) => {
      try { const r = callValue(f, a, 0); const vals = Array.isArray(r) ? r : [r]; return [true].concat(vals); }
      catch (e) {
        if (e === brk) throw e;
        if (e && e.ret) return [true].concat(e.v || []);
        if (e && 'luaValue' in e) return [false, e.luaValue];
        if (e instanceof Table) return [false, e];
        return [false, e && e.lua ? e.message : tostring(e)];
      }
    });
    globalEnv.vars.set('xpcall', (f, h, ...a) => globalEnv.vars.get('pcall')(f, ...a));
    globalEnv.vars.set('ipairs', (t) => { let i = 0; return [(tt, k) => { i = k + 1; const v = t.get(i); return v === null || v === undefined ? null : [i, v]; }, t, 0]; });
    globalEnv.vars.set('pairs', (t) => { const keys = Array.from(t.m.keys()); let i = 0;
      const f = () => { while (i < keys.length) { const k = keys[i++]; const v = t.get(k); if (v !== null && v !== undefined) return [k, v]; } return null; };
      return [() => f(), t, null]; });
    globalEnv.vars.set('next', (t, k) => { const keys = Array.from(t.m.keys()); const idx = k === null ? -1 : keys.indexOf(k); const nk = keys[idx + 1]; return nk === undefined ? null : [nk, t.get(nk)]; });
    globalEnv.vars.set('unpack', tableLib().unpack);
    globalEnv.vars.set('loadstring', (src) => { try { const body = parse(String(src)); return [(env) => { try { execBlock(body, env || new Env(globalEnv)); } catch (e) { if (e && e.ret) return e.v; throw e; } return []; }, null]; } catch (e) { return [null, e.message]; } });
    globalEnv.vars.set('load', globalEnv.vars.get('loadstring'));
    globalEnv.vars.set('collectgarbage', () => 0);
    globalEnv.vars.set('print', globalEnv.vars.get('print'));

    lib('string', strLib());
    lib('math', mathLib());
    lib('table', tableLib());
    lib('os', { time: () => Math.floor(Date.now() / 1000), clock: () => performance.now() / 1000, date: () => new Date().toString(), difftime: (a, b) => a - b });
    lib('utf8', { char: (...a) => a.map(c => String.fromCodePoint(c)).join(''), len: (s) => Array.from(s).length });
    const co = lib('coroutine', {});
    co.set('create', (f) => { let done = false, res = null; return new Table({ __type: 'thread', resume: () => { if (done) return [res === undefined ? null : res]; done = true; try { const r = callValue(f, []); res = Array.isArray(r) ? r[0] : r; return [true, res === undefined ? null : res]; } catch (e) { if (e && e.ret) { res = e.v[0]; return [true, res]; } return [false, e.message || tostring(e)]; } } }); });
    co.set('resume', (th) => { const r = th.get('resume'); return callValue(r, []); });
    co.set('wrap', (f) => { const th = globalEnv.vars.get('coroutine').get('create')(f); return (...a) => { const rr = callValue(th.get('resume'), []); return Array.isArray(rr) ? rr.slice(1) : rr; }; });
    co.set('status', () => 'dead');
    globalEnv.vars.set('SharedTable', function () { return new Table(); });
  }

  /* ---------------- Public API ---------------- */
  function createGlobals(overrides) {
    const t = globalEnv;
    if (overrides) for (const k in overrides) t.vars.set(k, overrides[k]);
    return t;
  }

  function run(src, envVars, opts) {
    opts = opts || {};
    let body;
    const out = { ok: true, error: null, line: 0, value: null };
    try { body = parse(String(src)); }
    catch (e) { out.ok = false; out.error = e.message; out.line = e.line || 0; return out; }
    currentBudget = { n: opts.budget || defaultBudget };
    const env = new Env(globalEnv);
    if (envVars) for (const k in envVars) env.declare(k, envVars[k]);
    if (opts.print) globalEnv.__print = opts.print;
    if (opts.warn) globalEnv.__warn = opts.warn;
    try { execBlock(body, env); }
    catch (e) {
      if (e && e.ret) { out.value = e.v; return out; }
      if (e === brk) { out.ok = false; out.error = 'break outside a loop'; return out; }
      out.ok = false;
      if (e && 'luaValue' in e) { out.error = tostring(e.luaValue); out.value = e.luaValue; }
      else out.error = e && e.message ? e.message : tostring(e);
      out.line = (e && e.line) || 0;
    }
    return out;
  }

  function call(fn, args) {
    const r = callValue(fn, args || [], 0);
    return Array.isArray(r) ? r : [r === undefined ? null : r];
  }

  installStdlib();

  global.Lua = {
    lex, parse, run, call, Table, LuaError, Env, globalEnv, createGlobals,
    truthy, tostring, typeName, indexValue, newIndexValue, isCallable,
    setColor(fn) { globalEnv.vars.set('Color3', fn); }
  };
})(typeof window !== 'undefined' ? window : globalThis);

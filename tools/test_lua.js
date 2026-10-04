/* Node smoke tests for the Lua interpreter + place export */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'docs', 'app', 'js');
const ctx = { window: {}, globalThis: {}, performance: { now: () => Date.now() }, console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['lua.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

const Lua = ctx.window.Lua || ctx.Lua;
let pass = 0, fail = 0;
function t(name, src, expect) {
  const lines = [];
  const r = Lua.run(src, {}, { print: (s) => lines.push(s), warn: (s) => lines.push('W:' + s) });
  const got = lines.map((l) => l.replace(/\t/g, '|')).join('|');
  const ok = r.ok && (expect === undefined || got === expect);
  if (ok) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + '\n      expected: ' + expect + '\n      got     : ' + got + (r.ok ? '' : '\n      error   : ' + r.error + ' (line ' + r.line + ')')); }
}
function tErr(name, src, contains) {
  const r = Lua.run(src, {}, { print: () => {} });
  if (!r.ok && (!contains || r.error.includes(contains))) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + ' -> ' + (r.ok ? 'no error' : r.error)); }
}

console.log('--- basics');
t('arith', 'print(1+2*3)', '7');
t('precedence', 'print(2^3^2)', '512');
t('neg power', 'print(-2^2)', '-4');
t('concat', 'print("a"..1.."" , "x".."y")', 'a1|xy');
t('compare', 'print(1<2, "a"<"b", 1==1.0)', 'true|true|true');
t('logic', 'print(nil or "x", false and 1, not nil)', 'x|false|true');
t('float div/mod', 'print(7/2, 7//2, 7%3, -1%3)', '3.5|3|1|2');
t('len', 'print(#"hello", #{1,2,3})', '5|3');

console.log('--- control flow');
t('if', 'local x=5 if x>3 then print("big") elseif x>1 then print("mid") else print("small") end', 'big');
t('while', 'local i=0 while i<5 do i=i+1 end print(i)', '5');
t('repeat', 'local i=0 repeat i=i+1 until i>=3 print(i)', '3');
t('fornum', 'local s=0 for i=1,10 do s=s+i end print(s)', '55');
t('fornum step', 'local s="" for i=10,1,-2 do s=s..i end print(s)', '108642');
t('forin ipairs', 'local s=0 for i,v in ipairs({1,2,3}) do s=s+v end print(s)', '6');
t('forin pairs', 'local n=0 for k,v in pairs({a=1,b=2}) do n=n+1 end print(n)', '2');
t('break', 'for i=1,10 do if i==4 then break end end print("done")', 'done');

console.log('--- functions & closures');
t('function', 'local function f(a,b) return a*b end print(f(3,4))', '12');
t('closure', 'local function counter() local n=0 return function() n=n+1 return n end end local c=counter() c() c() print(c())', '3');
t('varargs', 'local function f(...) local a,b=... return b end print(f(1,2))', '2');
t('multi ret', 'local function f() return 1,2,3 end local a,b,c=f() print(a,b,c)', '1|2|3');
t('method', 'local o={x=1, get=function(self) return self.x end} print(o:get())', '1');
t('recursion', 'local function fib(n) if n<2 then return n end return fib(n-1)+fib(n-2) end print(fib(10))', '55');
t('anon call', 'print((function(a) return a+1 end)(41))', '42');

console.log('--- tables & metatables');
t('table field', 'local t={a=1,2,3} print(t.a, t[1], t[2])', '1|2|3');
t('table set', 'local t={} t.x=9 t[1]="z" print(t.x,t[1])', '9|z');
t('table insert/remove', 'local t={1,2,3} table.insert(t,4) table.insert(t,1,0) print(table.concat(t,",")) print(table.remove(t,1)) print(table.concat(t,","))', '0,1,2,3,4|0|1,2,3,4');
t('table sort', 'local t={3,1,2} table.sort(t) print(table.concat(t,""))', '123');
t('table sort cmp', 'local t={1,3,2} table.sort(t,function(a,b) return a>b end) print(table.concat(t,""))', '321');
t('metatable index', 'local base={greet=function() return "hi" end} local t=setmetatable({}, {__index=base}) print(t.greet())', 'hi');
t('metatable call', 'local t=setmetatable({}, {__call=function(self,a) return a*2 end}) print(t(21))', '42');
t('metatable tostring', 'local t=setmetatable({}, {__tostring=function() return "OBJ" end}) print(tostring(t))', 'OBJ');
t('len operator table', 'local t={} t[1]=1 t[2]=2 t[3]=nil t[3]=3 print(#t)', '3');

console.log('--- strings');
t('string lib', 'print(string.upper("ab"), string.lower("AB"), string.rep("x",3))', 'AB|ab|xxx');
t('sub', 'print(string.sub("hello",2,4), string.sub("hello",-3), string.sub("hello",9))', 'ell|llo|');
t('find', 'local a,b=string.find("hello world","wor") print(a,b)', '7|9');
t('match', 'print(string.match("id=42","%d+"))', '42');
t('gsub', 'print(string.gsub("a-b-c","-","+"))', 'a+b+c|2');
t('format', 'print(string.format("%s=%d (%.1f)","n",5,3.14159))', 'n=5 (3.1)');
t('gmatch', 'local out={} for w in string.gmatch("one two three","%a+") do table.insert(out,w) end print(table.concat(out,"|"))', 'one|two|three');

console.log('--- stdlib');
t('math', 'print(math.floor(3.7), math.ceil(3.2), math.abs(-5), math.max(1,9), math.min(2,3), math.sqrt(9))', '3|4|5|9|2|3');
t('math huge/pi', 'print(math.pi > 3.14, math.huge > 1e300)', 'true|true');
t('pcall ok', 'local ok,v=pcall(function() return 5 end) print(ok,v)', 'true|5');
t('pcall err', 'local ok,e=pcall(function() error("boom") end) print(ok,e)', 'false|boom');
t('error', 'local ok,e=pcall(function() error({code=1}) end) print(ok,type(e))', 'false|table');
t('select', 'print(select("#",1,2,3), select(2,"a","b","c"))', '3|b|c');
t('type/tostring', 'print(type(1),type("s"),type({}),type(print),tostring(nil),tostring(true))', 'number|string|table|function|nil|true');
t('tonumber', 'print(tonumber("42"), tonumber("ff",16), tonumber("x"))', '42|255|nil');
t('next', 'local t={a=1} local k,v=next(t) print(k,v)', 'a|1');
t('loadstring', 'local f=loadstring("return 7") print(f())', '7');

console.log('--- safety');
tErr('infinite loop guard', 'while true do end', 'timeout');
tErr('syntax error', 'local =', 'expected');
tErr('nil call', 'foo()', 'nil');
tErr('arithmetic on nil', 'print(nil+1)', 'arithmetic');

console.log('--- lua highlight/lex');
t('comments', '--[[ block\n comment ]] print("ok") -- trailing', 'ok');
t('long string', 'print([=[a]=] .. "b")', 'ab');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/* ============================================================
   UI — ribbon, docks, explorer, properties, toolbox, templates,
   groups, AI panel, script editor, dialogs, command bar, theme.
   ============================================================ */
(function (global) {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const E = () => global.Engine;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- toasts & logs ---------------- */
  function toast(msg, kind, ms) {
    const host = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'info');
    const icon = { ok: '✅', err: '⛔', warn: '⚠️', info: 'ℹ️' }[kind || 'info'] || 'ℹ️';
    t.innerHTML = '<span>' + icon + '</span><div>' + esc(msg) + '</div>';
    host.appendChild(t);
    setTimeout(() => { t.style.transition = '.3s opacity'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms || 3400);
  }

  /* ---------------- ribbon ---------------- */
  const RIBBON = {
    home: [
      { label: 'File', items: [
        ['📄 New', () => action('new'), 'New place'],
        ['📂 Open', () => action('open'), 'Open .rbxlx'],
        ['💾 Save', () => action('save'), 'Save local'],
        ['⬇ Export', () => action('export'), 'Download .rbxlx'],
        ['🖨 Publish', () => action('publish'), 'Publish to Roblox']
      ] },
      { label: 'Tools', items: [
        ['➤ Select', () => setTool('select'), 'Select (1)'],
        ['✥ Move', () => setTool('move'), 'Move (2)'],
        ['⟳ Rotate', () => setTool('rotate'), 'Rotate (3)'],
        ['⤢ Scale', () => setTool('scale'), 'Scale (4)']
      ] },
      { label: 'Insert', items: [
        ['➕ Part', () => E().insertPart('Part'), 'Insert a part'],
        ['🧩 Model', () => openPanel('left', 'toolbox'), 'Toolbox models'],
        ['🚩 Spawn', () => E().insert({ class: 'SpawnLocation', name: 'SpawnLocation' }) && refresh(), 'Spawn point'],
        ['📜 Script', () => action('newscript'), 'New server script']
      ] },
      { label: 'History', items: [
        ['↶ Undo', () => E().undo(), 'Undo (Ctrl+Z)'],
        ['↷ Redo', () => E().redo(), 'Redo (Ctrl+Y)'],
        ['🗑 Delete', () => E().deleteSelection(), 'Delete (Del)'],
        ['⧉ Duplicate', () => E().duplicateSelection(), 'Duplicate (Ctrl+D)']
      ] },
      { label: 'Play', items: [
        ['▶ Play', () => action('play'), 'Play solo (F5)'],
        ['⏹ Stop', () => action('stop'), 'Stop (Shift+F5)'],
        ['🔍 Frame', () => E().frameSelection(), 'Frame selection (F)'],
        ['⟳ Pivot', () => { E().state.camera.target = [0, 6, 0]; E().state.camera.dist = 55; }, 'Reset camera']
      ] }
    ],
    model: [
      { label: 'Transform', items: [
        ['⬆ Move Y', () => E().state.snapY = !E().state.snapY, 'Constrain drag to Y'],
        ['▦ Snap 1', () => { E().state.snap = 1; refreshTools(); }, 'Snap to 1 stud'],
        ['▦ Snap 4', () => { E().state.snap = 4; refreshTools(); }, 'Snap to 4 studs'],
        ['▦ No snap', () => { E().state.snap = 0; refreshTools(); }, 'Snap off']
      ] },
      { label: 'Scale', items: [
        ['↔ Widen', () => scaleSel(1.5, 1, 1), 'Scale X'],
        ['↕ Taller', () => scaleSel(1, 1.5, 1), 'Scale Y'],
        ['⤢ Bigger', () => scaleSel(1.5, 1.5, 1.5), 'Scale all'],
        ['⤡ Smaller', () => scaleSel(0.7, 0.7, 0.7), 'Scale down']
      ] },
      { label: 'Arrange', items: [
        ['⬆ Up 4', () => moveSel([0, 4, 0]), 'Move up'],
        ['⬇ Down 4', () => moveSel([0, -4, 0]), 'Move down'],
        ['🎯 Ground', () => moveSelToGround(), 'Drop to ground'],
        ['📐 Center', () => centerSel(), 'Center on origin']
      ] },
      { label: 'Color', items: [
        ['🟥 Red', () => paintSel('#e0433b'), 'Paint red'],
        ['🟩 Green', () => paintSel('#4b8f3f'), 'Paint green'],
        ['🟦 Blue', () => paintSel('#2f7ce0'), 'Paint blue'],
        ['🟨 Gold', () => paintSel('#ffcb3d'), 'Paint gold']
      ] },
      { label: 'Anchor', items: [
        ['⚓ Anchor', () => setPropSel('Anchored', true), 'Anchor on'],
        ['⚓ Unanchor', () => setPropSel('Anchored', false), 'Anchor off'],
        ['🧱 Collide on', () => setPropSel('CanCollide', true), 'CanCollide true'],
        ['👻 Ghost', () => setPropSel('Transparency', 0.7), 'Make see-through']
      ] }
    ],
    ui: [
      { label: 'Screen GUI', items: [
        ['🖥 ScreenGui', () => insertUI('ScreenGui', {}), 'Insert ScreenGui'],
        ['🟥 Frame', () => insertUI('Frame', {}), 'Insert Frame'],
        ['🏷 TextLabel', () => insertUI('TextLabel', { Text: 'Label' }), 'Insert TextLabel'],
        ['🔘 TextButton', () => insertUI('TextButton', { Text: 'Play' }), 'Insert TextButton']
      ] },
      { label: 'Styling', items: [
        ['➰ UICorner', () => insertUI('UICorner', { CornerRadius: 16 }), 'Round the corners'],
        ['📋 UIListLayout', () => insertUI('UIListLayout', {}), 'Auto layout'],
        ['🧱 UIPadding', () => insertUI('UIPadding', {}), 'Padding'],
        ['🖼 ImageLabel', () => insertUI('ImageLabel', {}), 'Image']
      ] },
      { label: 'Themes', items: [
        ['🟦 Roblox Blue', () => paintSel('#00a2ff'), 'Accent part'],
        ['⬛ Dark', () => paintSel('#14171c'), 'Dark part'],
        ['⬜ White', () => paintSel('#f2f4f7'), 'White part']
      ] },
      { label: 'Effects', items: [
        ['💡 PointLight', () => insertInstance('PointLight'), 'Point light'],
        ['🔥 Fire', () => insertInstance('Fire'), 'Fire'],
        ['✨ Particles', () => insertInstance('ParticleEmitter'), 'Particles']
      ] }
    ],
    script: [
      { label: 'Script', items: [
        ['📜 Script', () => action('newscript'), 'Server script'],
        ['💻 LocalScript', () => action('newlocalscript'), 'Client script'],
        ['📦 ModuleScript', () => action('newmodule'), 'Module'],
        ['▶ Run script', () => action('runscript'), 'Run current script (F5)']
      ] },
      { label: 'AI Coder', items: [
        ['🤖 AI Coder', () => { openPanel('right', 'ai'); focusAI(); }, 'Open AI Coder'],
        ['✨ Generate Lua', () => { openPanel('right', 'ai'); focusAI(); }, 'Describe a script'],
        ['🧠 Explain code', () => explainCurrent(), 'Explain this script'],
        ['🧹 Format', () => formatCurrent(), 'Tidy whitespace']
      ] },
      { label: 'Analysis', items: [
        ['🩺 Lint', () => lintCurrent(), 'Check for problems'],
        ['📊 Stats', () => scriptStats(), 'Count lines/tokens'],
        ['🔎 Find', () => action('find'), 'Find in script'],
        ['📋 Copy all', () => copyCurrent(), 'Copy to clipboard']
      ] },
      { label: 'Snippets', items: [
        ['⚡ Touched', () => insertSnippet('touch'), 'Touched handler'],
        ['👥 PlayerAdded', () => insertSnippet('leaderstats'), 'Leaderstats'],
        ['💾 DataStore', () => insertSnippet('datastore'), 'Save data'],
        ['🌙 Day/Night', () => insertSnippet('daynight'), 'Lighting cycle']
      ] }
    ],
    test: [
      { label: 'Run', items: [
        ['▶ Play Solo', () => action('play'), 'Play (F5)'],
        ['⏹ Stop', () => action('stop'), 'Stop (Shift+F5)'],
        ['↻ Restart', () => { action('stop'); setTimeout(action('play'), 120); }, 'Restart session'],
        ['🎮 Team Test', () => action('play'), 'Simulated multiplayer']
      ] },
      { label: 'Diagnostics', items: [
        ['📊 Output', () => openPanel('right', 'output'), 'Show output'],
        ['🧹 Clear output', () => { E().state.output.length = 0; renderOutput(); }, 'Clear logs'],
        ['⏱ Perf', () => toast('FPS: ' + E().fps + ' · instances: ' + countInstances(), 'info'), 'Performance'],
        ['🧮 Instances', () => toast(countInstances() + ' instances in this place', 'info'), 'Count instances']
      ] }
    ],
    view: [
      { label: 'Panels', items: [
        ['🧭 Explorer', () => openPanel('left', 'explorer'), 'Explorer'],
        ['🧰 Toolbox', () => openPanel('left', 'toolbox'), 'Toolbox'],
        ['🎛 Properties', () => openPanel('right', 'properties'), 'Properties'],
        ['📟 Output', () => openPanel('right', 'output'), 'Output']
      ] },
      { label: 'Docks', items: [
        ['⟨ Collapse left', () => toggleDock('left'), 'Toggle left dock'],
        ['⟩ Collapse right', () => toggleDock('right'), 'Toggle right dock'],
        ['▦ Grid', () => { E().state.showGrid = !E().state.showGrid; refreshTools(); }, 'Toggle grid'],
        ['🖼 Fullscreen', () => toggleFullscreen(), 'Fullscreen']
      ] },
      { label: 'Theme', items: [
        ['🌙 Dark', () => setTheme('dark'), 'Dark theme'],
        ['☀ Light', () => setTheme('light'), 'Light theme'],
        ['🎨 Accent blue', () => setAccent('#00a2ff'), 'Blue accent'],
        ['🎨 Accent purple', () => setAccent('#8a4fe0'), 'Purple accent']
      ] },
      { label: 'Camera', items: [
        ['🎥 Front', () => setCamera(0, 0.2), 'Front view'],
        ['🎥 Top', () => setCamera(0, 1.35), 'Top view'],
        ['🎥 Right', () => setCamera(1.6, 0.2), 'Right view'],
        ['🎥 Iso', () => setCamera(0.6, 0.5), 'Isometric']
      ] }
    ],
    plugins: [
      { label: 'AI Tools', items: [
        ['🤖 AI Builder', () => { openPanel('right', 'ai'); focusAI(); }, 'Build with AI'],
        ['🏗 Build obby', () => quickAI('Build an obby with lava and checkpoints'), 'One-click obby'],
        ['🪙 Add coins', () => quickAI('Add spinning coins to collect'), 'One-click coins'],
        ['⚔ Arena', () => quickAI('Create a combat arena with waves'), 'One-click arena']
      ] },
      { label: 'Automation', items: [
        ['🧮 Count parts', () => toast(countParts() + ' parts in Workspace', 'info'), 'Count parts'],
        ['🎨 Recolor all', () => { E().pushUndo(); E().walk(E().state.services.Workspace, (n) => { if (n.props && n.props.Color && Math.random() < 0.5) n.props.Color = '#00a2ff'; }); refresh(); toast('Recoloured workspace', 'ok'); }, 'Randomise colours'],
        ['⚓ Anchor all', () => { E().pushUndo(); E().walk(E().state.services.Workspace, (n) => { if (n.props && 'Anchored' in n.props) n.props.Anchored = true; }); refresh(); toast('All parts anchored', 'ok'); }, 'Anchor everything'],
        ['🧹 Clean empties', () => cleanEmpty(), 'Remove empty folders']
      ] },
      { label: 'Templates', items: [
        ['🧱 Baseplate', () => applyTemplate('baseplate'), 'Baseplate'],
        ['🏃 Obby', () => applyTemplate('obby'), 'Obby'],
        ['🏭 Tycoon', () => applyTemplate('tycoon'), 'Tycoon'],
        ['👥 Group Game', () => applyTemplate('groupgame'), 'Group game']
      ] },
      { label: 'Dev', items: [
        ['📤 Export JSON', () => { download('place.json', E().toJSON(), 'application/json'); }, 'Export JSON'],
        ['📥 Import JSON', () => $('#fileOpen').click(), 'Import place file'],
        ['🔐 Credentials', () => openSettings(), 'API keys'],
        ['ℹ About', () => openAbout(), 'About this app']
      ] }
    ],
    help: [
      { label: 'Help', items: [
        ['📖 Docs', () => openHelp(), 'Open help'],
        ['⌨ Shortcuts', () => openShortcuts(), 'Keyboard shortcuts'],
        ['🎓 Learn Lua', () => openLuaHelp(), 'Lua cheatsheet'],
        ['🐞 Report', () => window.open('https://github.com/GoStudios-Real/Roblox-Studio-Android-Edition/issues', '_blank'), 'Report an issue']
      ] },
      { label: 'Account', items: [
        ['🔐 Sign in', () => signIn(), 'Roblox account'],
        ['🔓 Sign out', () => signOut(), 'Sign out'],
        ['👥 My groups', () => openPanel('left', 'groups'), 'Groups'],
        ['🚀 Publish', () => action('publish'), 'Publish to Roblox']
      ] }
    ]
  };

  function renderRibbon(tab) {
    const groups = RIBBON[tab] || RIBBON.home;
    $('#rbody').innerHTML = groups.map((g) =>
      '<div class="rgroup"><div class="rg-items">' +
      g.items.map((it, i) => '<button class="rbtn" data-g="' + esc(tab) + '" data-i="' + g.label + '|' + i + '" title="' + esc(it[2] || it[0]) + '"><span class="ic">' + esc(it[0].split(' ')[0]) + '</span><span>' + esc(it[0].split(' ').slice(1).join(' ') || it[0]) + '</span></button>').join('') +
      '</div><div class="rg-label">' + esc(g.label) + '</div></div>'
    ).join('');
    $$('#rbody .rbtn').forEach((b) => b.addEventListener('click', () => {
      const [g, i] = b.dataset.i.split('|');
      const grp = (RIBBON[b.dataset.g] || []).find((x) => x.label === g);
      if (grp) grp.items[+i][1]();
    }));
    refreshToolButtons();
  }

  function refreshToolButtons() {
    $$('#vpToolbar .tbtn[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === E().state.tool));
    const snap = $('#vpToolbar [data-snap]');
    if (snap) snap.textContent = 'Grid: ' + (E().state.snap ? E().state.snap + 'st' : 'off');
    const g = $('#vpToolbar #btnGrid'); if (g) g.classList.toggle('active', E().state.showGrid);
    const y = $('#vpToolbar #btnSnapY'); if (y) y.classList.toggle('active', E().state.snapY);
  }

  function setTool(t) { E().state.tool = t; refreshToolButtons(); setStatus(); }

  /* ---------------- explorer ---------------- */
  const ICONS = {
    DataModel: '🗂', Workspace: '🏠', Part: '⬜', SpawnLocation: '🚩', Model: '📦', Folder: '📁',
    Script: '📜', LocalScript: '💻', ModuleScript: '📦', Players: '👥', Lighting: '🌤', Chat: '💬',
    ReplicatedStorage: '🔁', ServerScriptService: '🛰', ServerStorage: '🗄', StarterGui: '🖥',
    StarterPlayer: '🧍', SoundService: '🔊', Frame: '🟥', TextLabel: '🏷', TextButton: '🔘',
    ScreenGui: '🖥', PointLight: '💡', SpotLight: '🔦', Fire: '🔥', Smoke: '💨', Seat: '🪑',
    WedgePart: '📐', TrussPart: '🪜', Folder2: '📁', IntValue: '🔢', BoolValue: '✅', StringValue: '🔤',
    Player: '🧍', Humanoid: '❤️', ClickDetector: '🖱', ProximityPrompt: '✋', Sound: '🎵'
  };

  function renderExplorer() {
    const tree = $('#explorerTree');
    if (!tree) return;
    const filter = ($('#explorerSearch') && $('#explorerSearch').value || '').toLowerCase();
    const root = E().state.place;
    if (!root) return;
    const keep = filter ? new Set((() => { const s = new Set(); E().walk(root, (n) => { if ((n.name || '').toLowerCase().includes(filter) || (n.class || '').toLowerCase().includes(filter)) { s.add(n.id); let p = n.parent; while (p) { s.add(p.id); p = p.parent; } } }); return s; })()) : null;
    tree.innerHTML = renderNode(root, 0, keep, true);
    $$('.tnode', tree).forEach((el2) => {
      el2.addEventListener('click', (ev) => {
        const id = el2.dataset.id;
        E().select([id], ev.ctrlKey || ev.metaKey || ev.shiftKey);
        if (ev.target.classList.contains('tw')) {
          el2.classList.toggle('closed');
          const kids = el2.nextElementSibling;
          if (kids && kids.classList.contains('tkids')) kids.classList.toggle('hidden');
        }
      });
      el2.addEventListener('contextmenu', (ev) => { ev.preventDefault(); E().select([el2.dataset.id]); openContextMenu(ev.clientX, ev.clientY); });
    });
    setStatus();
  }

  function renderNode(n, depth, keep, isRoot) {
    if (keep && !keep.has(n.id)) return '';
    const cls = n.class;
    const icon = ICONS[cls] || (cls.endsWith('Part') ? '⬜' : '▫️');
    const hasKids = n.children && n.children.length;
    const kind = ['Script', 'LocalScript', 'ModuleScript'].includes(cls) ? 'script' : (n.isService || isRoot ? 'service' : (cls.includes('Gui') || cls.includes('Frame') || cls.includes('Label') || cls.includes('Button') ? 'ui' : ''));
    const sel = E().state.selection.includes(n) ? ' sel' : '';
    let html = '<div class="tnode ' + kind + sel + '" data-id="' + n.id + '">' +
      '<span class="tw">' + (hasKids ? '▾' : '') + '</span>' +
      '<span class="ti">' + icon + '</span>' +
      '<span class="tn">' + esc(n.name) + '</span>' +
      '<span class="tclass">' + esc(cls) + '</span></div>';
    if (hasKids) html += '<div class="tkids">' + n.children.map((c) => renderNode(c, depth + 1, keep)).join('') + '</div>';
    return html;
  }

  /* ---------------- properties ---------------- */
  const MATERIALS = ['Plastic', 'SmoothPlastic', 'Neon', 'Wood', 'WoodPlanks', 'Slate', 'Concrete', 'Granite', 'Brick', 'Pebble', 'Cobblestone', 'Metal', 'DiamondPlate', 'Foil', 'Grass', 'Sand', 'Fabric', 'Ice', 'Glass', 'ForceField', 'Marble', 'Asphalt', 'Ground'];
  const SHAPES = ['Block', 'Ball', 'Cylinder', 'Wedge', 'CornerWedge', 'Truss'];
  const PROP_GROUPS = {
    base: [['Name', 'text']],
    part: [
      ['__Appearance'],
      ['Color', 'color'], ['Material', 'select:' + MATERIALS.join(',')], ['Transparency', 'range:0:1:0.05'], ['Reflectance', 'range:0:1:0.05'],
      ['__Transform'],
      ['Position', 'vec'], ['Orientation', 'vec'], ['Size', 'vec'], ['Shape', 'select:' + SHAPES.join(',')],
      ['__Behavior'],
      ['Anchored', 'check'], ['CanCollide', 'check']
    ],
    script: [['__Script'], ['Source', 'code'], ['Disabled', 'check'], ['RunContext', 'select:Legacy,Server,Client,Plugin']],
    value: [['__Value'], ['Value', 'text']],
    ui: [['__Gui'], ['Size', 'vec2'], ['Position', 'vec2'], ['BackgroundColor', 'color'], ['BackgroundTransparency', 'range:0:1:0.05'], ['Text', 'text'], ['TextColor', 'color'], ['TextSize', 'number'], ['Visible', 'check'], ['UICornerRadius', 'number']]
  };

  function schemaFor(n) {
    const rows = [];
    if (!n) return rows;
    if (n.isService || n.class === 'DataModel') return [['Name', 'text']];
    rows.push(...PROP_GROUPS.base);
    if (['Part', 'SpawnLocation', 'Seat', 'WedgePart', 'TrussPart', 'CornerWedgePart', 'CylinderPart'].includes(n.class)) rows.push(...PROP_GROUPS.part);
    else if (['Script', 'LocalScript', 'ModuleScript'].includes(n.class)) rows.push(...PROP_GROUPS.script);
    else if (['Frame', 'TextLabel', 'TextButton', 'ImageLabel'].includes(n.class)) rows.push(...PROP_GROUPS.ui);
    else if (n.class.endsWith('Value')) rows.push(...PROP_GROUPS.value);
    const extra = Object.keys(n.props || {}).filter((k) => !rows.some((r) => r[0] === k));
    if (extra.length) {
      rows.push('__Attributes');
      extra.forEach((k) => rows.push([k, autoType(n.props[k])]));
    }
    return rows;
  }
  function autoType(v) {
    if (typeof v === 'boolean') return 'check';
    if (typeof v === 'number') return 'number';
    if (Array.isArray(v)) return v.length === 3 ? 'vec' : 'vec2';
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return 'color';
    return 'text';
  }

  function renderProperties() {
    const n = E().primary();
    $('#propHead').textContent = n ? n.name + '  ·  ' + n.class : 'No selection';
    const list = $('#propList');
    if (!n) { list.innerHTML = '<div class="muted small" style="padding:14px">Select an instance in the Explorer or the viewport to edit its properties.</div>'; return; }
    const rows = schemaFor(n);
    list.innerHTML = rows.map((r) => {
      if (typeof r === 'string') return '<div class="pgroup-title">' + esc(r.replace('__', '')) + '</div>';
      const [key, type] = r;
      const v = key === 'Name' ? n.name : (key === 'CFrame' ? '' : (n.props[key] === undefined ? '' : n.props[key]));
      return '<div class="prow"><div class="pk" title="' + esc(key) + '">' + esc(key) + '</div><div class="pv" data-key="' + esc(key) + '">' + inputFor(key, type, v) + '</div></div>';
    }).join('');

    $$('#propList .pv').forEach((cell) => {
      const key = cell.dataset.key;
      const node = E().primary();
      const inp = cell.querySelector('input,select,textarea');
      if (!inp) return;
      const handler = () => {
        E().pushUndo();
        if (key === 'Name') E().rename(node, inp.value);
        else if (inp.type === 'checkbox') E().setProp(node, key, inp.checked);
        else if (inp.type === 'range' || inp.type === 'number') E().setProp(node, key, parseFloat(inp.value) || 0);
        else if (cell.dataset.vec) {
          const nums = Array.from(cell.querySelectorAll('input')).map((x) => parseFloat(x.value) || 0);
          E().setProp(node, key, cell.dataset.vec === '3' ? nums : nums.slice(0, 2));
        } else E().setProp(node, key, inp.value);
        E().emit('explorer');
      };
      inp.addEventListener('change', handler);
      if (inp.tagName !== 'SELECT' && inp.type !== 'checkbox') inp.addEventListener('input', () => { if (inp.type === 'range') handler(); });
      cell.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  function inputFor(key, type, v) {
    const t = type.split(':');
    switch (t[0]) {
      case 'check': return '<input type="checkbox" ' + (v ? 'checked' : '') + '>';
      case 'color': return '<input type="color" value="' + esc(v || '#888888') + '">';
      case 'number': return '<input type="number" step="0.1" value="' + esc(v === '' ? 0 : v) + '">';
      case 'range': return '<input type="range" min="' + t[1] + '" max="' + t[2] + '" step="' + (t[3] || 0.1) + '" value="' + esc(v || 0) + '">';
      case 'select': return '<select>' + t[1].split(',').map((o) => '<option ' + (String(v) === o ? 'selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
      case 'vec': { const a = Array.isArray(v) ? v : [0, 0, 0]; return '<div class="vec" data-vec="3">' + [0, 1, 2].map((i) => '<input type="number" step="0.5" value="' + esc(a[i] || 0) + '">').join('') + '</div>'; }
      case 'vec2': { const a = Array.isArray(v) ? v : [0, 0]; return '<div class="vec" data-vec="2">' + [0, 1].map((i) => '<input type="number" step="0.01" value="' + esc(a[i] || 0) + '">').join('') + '</div>'; }
      case 'code': return '<textarea rows="6" style="font-family:var(--mono);font-size:11.5px">' + esc(v) + '</textarea>';
      default: return '<input type="text" value="' + esc(v == null ? '' : v) + '">';
    }
  }

  /* ---------------- output ---------------- */
  function renderOutput() {
    const host = $('#outputList');
    if (!host) return;
    const f = ($('#outputFilter') && $('#outputFilter').value || '').toLowerCase();
    const items = E().state.output.filter((o) => !f || o.msg.toLowerCase().includes(f));
    host.innerHTML = items.map((o) => {
      const t = o.time.toTimeString().slice(0, 8);
      return '<div class="oline ' + esc(o.level) + '"><span class="ts">' + t + '</span><span class="msg">' + esc(o.msg) + '</span></div>';
    }).join('');
    host.scrollTop = host.scrollHeight;
  }

  /* ---------------- toolbox ---------------- */
  let toolboxCat = 'All';
  function renderToolbox() {
    const cats = E().toolboxCategories();
    $('#toolboxCats').innerHTML = cats.map((c) => '<button class="chipbtn ' + (c === toolboxCat ? 'active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
    $$('#toolboxCats .chipbtn').forEach((b) => b.addEventListener('click', () => { toolboxCat = b.dataset.cat; renderToolbox(); }));
    const q = ($('#toolboxSearch') && $('#toolboxSearch').value) || '';
    const items = E().toolboxSearch(q, toolboxCat);
    $('#toolboxGrid').innerHTML = items.map((a, i) =>
      '<div class="card" data-i="' + i + '"><div class="thumb">' + a.icon + '</div><div class="cname">' + esc(a.name) + '</div><div class="cmeta">' + esc(a.cat) + '</div></div>').join('');
    $$('#toolboxGrid .card').forEach((c, i) => c.addEventListener('click', () => { E().toolboxInsert(items[i]); }));
    $('#toolboxNote').textContent = items.length + ' built-in assets';
  }

  /* ---------------- templates ---------------- */
  function renderTemplates(host, sel) {
    const T = global.Templates;
    const q = sel === 'start' ? (($('#templateSearch') && $('#templateSearch').value) || '') : (qFor(sel) || '');
    const list = T.list.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.desc.toLowerCase().includes(q.toLowerCase()));
    host.innerHTML = list.map((t) =>
      '<div class="card" data-id="' + t.id + '" style="--c:' + t.color + '">' +
      '<div class="thumb" style="background:linear-gradient(140deg,' + t.color + '55,#11141b)">' + t.icon + '</div>' +
      '<div class="cname">' + esc(t.name) + '</div><div class="cmeta">' + esc(t.cat) + '</div></div>').join('');
    $$('.card', host).forEach((c) => c.addEventListener('click', () => applyTemplate(c.dataset.id)));
  }
  function qFor(sel) { return sel === 'templates' ? (($('#templateSearch') && $('#templateSearch').value) || '') : ''; }

  /* ---------------- groups ---------------- */
  let groupCat = 'All';
  function renderGroups() {
    const gs = E().state.groups;
    const cats = ['All', 'My Games', 'Templates'];
    $('#groupCats').innerHTML = cats.map((c) => '<button class="chipbtn ' + (c === groupCat ? 'active' : '') + '" data-cat="' + c + '">' + c + '</button>').join('');
    $$('#groupCats .chipbtn').forEach((b) => b.addEventListener('click', () => { groupCat = b.dataset.cat; renderGroups(); }));
    const host = $('#groupList');
    const local = E().state.groupGames;
    let html = '';
    if (!gs.length) {
      html += '<div class="note">Sign in with your Roblox account to load groups, or create local group games below.</div>';
    } else {
      gs.forEach((g) => {
        html += '<div class="li" data-gid="' + esc(g.id) + '"><div class="lav">' + esc((g.name || 'G')[0]) + '</div>' +
          '<div class="lmain"><div class="lname">' + esc(g.name) + '</div><div class="lmeta">' + esc(g.role) + ' · ' + (g.memberCount || 0) + ' members</div></div>' +
          '<div class="lact"><button class="mini" data-act="load" data-gid="' + esc(g.id) + '">Open</button></div></div>';
      });
    }
    local.forEach((gg, i) => {
      html += '<div class="li" data-i="' + i + '"><div class="lav">👥</div><div class="lmain"><div class="lname">' + esc(gg.name) + '</div>' +
        '<div class="lmeta">' + esc(gg.groupName || 'Group') + ' · ' + esc(gg.status || 'draft') + ' · ' + esc(gg.template || 'baseplate') + '</div></div>' +
        '<div class="lact"><button class="mini" data-act="open" data-i="' + i + '">Open</button><button class="mini danger" data-act="del" data-i="' + i + '">✕</button></div></div>';
    });
    host.innerHTML = html || '<div class="muted small" style="padding:8px">No group games yet.</div>';
    $$('[data-act]', host).forEach((b) => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const act = b.dataset.act, i = +b.dataset.i;
      if (act === 'del') { E().state.groupGames.splice(i, 1); saveGroupGames(); renderGroups(); toast('Group game removed', 'info'); }
      if (act === 'open') { const gg = E().state.groupGames[i]; applyTemplate(gg.template || 'baseplate'); toast('Loaded group game: ' + gg.name, 'ok'); }
      if (act === 'load') { const g = E().state.groups.find((x) => x.id === b.dataset.gid); if (g) { $('#grpName').textContent = g.name; $('#grpMeta').textContent = g.role + ' · ' + g.memberCount + ' members'; $('#grpAvatar').textContent = (g.name || 'G')[0]; toast('Switched to group ' + g.name, 'ok'); } }
    }));
  }
  function saveGroupGames() { E().state.store && E().state.store.set('groupGames', E().state.groupGames); try { localStorage.setItem('rsa:groupGames', JSON.stringify(E().state.groupGames)); } catch (e) {} }

  function newGroupGame() {
    dialog('New group game', [
      { label: 'Game name', id: 'name', value: 'My Group Game' },
      { label: 'Group', id: 'group', type: 'select', options: (E().state.groups.length ? E().state.groups.map((g) => g.name) : ['No group loaded']) },
      { label: 'Template', id: 'template', type: 'select', options: global.Templates.list.map((t) => t.name) },
      { label: 'Description', id: 'desc', value: 'A game for our Roblox group!' }
    ], (vals) => {
      const tpl = global.Templates.list.find((t) => t.name === vals.template);
      E().state.groupGames.push({ name: vals.name, groupName: vals.group, template: tpl ? tpl.id : 'baseplate', desc: vals.desc, status: 'draft', created: Date.now() });
      saveGroupGames();
      renderGroups();
      toast('Group game created: ' + vals.name, 'ok');
    });
  }

  /* ---------------- AI panel ---------------- */
  function aiBubble(html, who) {
    const log2 = $('#aiLog');
    const b = document.createElement('div');
    b.className = 'bub ' + who;
    b.innerHTML = html;
    log2.appendChild(b);
    log2.scrollTop = log2.scrollHeight;
    return b;
  }
  function focusAI() { const t = $('#aiInput'); if (t) { t.focus(); } }
  async function runAI(prompt) {
    if (!prompt) return;
    aiBubble(esc(prompt), 'me');
    const b = aiBubble('<span class="muted">Thinking…</span>', 'ai');
    try {
      const res = await global.AI.generate(prompt);
      b.innerHTML = esc(res.text).replace(/\n/g, '<br>') +
        (res.script ? '<pre>' + esc(res.script) + '</pre>' : '') +
        '<div class="acts">' +
        (res.tree ? '<button class="mini" data-a="build">➕ Build in workspace</button>' : '') +
        (res.script ? '<button class="mini" data-a="script">📜 Open in editor</button>' : '') +
        (res.script ? '<button class="mini" data-a="copy">⧉ Copy Lua</button>' : '') +
        '</div>';
      b._res = res;
      $$('[data-a]', b).forEach((btn) => btn.addEventListener('click', () => {
        const r = b._res;
        if (btn.dataset.a === 'build' && r.tree) { E().pushUndo(); const made = r.tree.map((s) => E().insert(s)); refresh(); toast('AI built ' + r.tree.length + ' instance(s)', 'ok'); E().select([made[0] && made[0].id].filter(Boolean)); }
        if (btn.dataset.a === 'script' && r.script) openScript(null, r.scriptName || 'AIScript', r.script);
        if (btn.dataset.a === 'copy' && r.script) { navigator.clipboard && navigator.clipboard.writeText(r.script); toast('Lua copied to clipboard', 'ok'); }
      }));
      E().log('ai', 'AI: ' + res.text.split('\n')[0]);
    } catch (e) {
      b.innerHTML = '<span class="muted">AI failed: ' + esc(e.message) + '</span>';
    }
  }

  /* ---------------- script editor ---------------- */
  const KW = /\b(local|function|end|if|then|else|elseif|for|in|do|while|repeat|until|return|break|nil|true|false|and|or|not|self|type|typeof)\b/g;
  function highlight(src) {
    let out = '';
    const re = /(--\[\[[\s\S]*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[\[[\s\S]*?\]\]|\b\d+\.?\d*\b|\b[A-Za-z_]\w*\b|[-+*/%^#=~<>(){}\[\];:,.])/g;
    let last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const t = m[0];
      let cls = '';
      if (t.startsWith('--')) cls = 'tk-com';
      else if (t[0] === '"' || t[0] === "'" || t.startsWith('[[')) cls = 'tk-str';
      else if (/^\d/.test(t)) cls = 'tk-num';
      else if (/^[A-Za-z_]/.test(t)) {
        if (KW.test(t)) cls = 'tk-kw'; KW.lastIndex = 0;
        if (/^(print|warn|pairs|ipairs|require|type|typeof|tostring|tonumber|pcall|xpcall|select|setmetatable|getmetatable|rawget|rawset|next|error|assert|spawn|wait|delay|tick|task|game|workspace|script|Instance|Enum|Vector3|CFrame|Color3|UDim2|UDim|wait)$/.test(t)) cls = 'tk-global';
      } else cls = 'tk-op';
      out += '<span class="' + cls + '">' + esc(t) + '</span>';
      last = m.index + t.length;
      if (t.startsWith('--')) { }
    }
    out += esc(src.slice(last));
    return out + '\n';
  }

  const scriptTabs = [];
  function openScript(node, name, source) {
    const id = node ? node.id : 'draft_' + (scriptTabs.length + 1);
    let tab = scriptTabs.find((t) => t.id === id);
    if (!tab) { tab = { id, name: name || (node ? node.name : 'Script'), node, source: source !== undefined ? source : (node ? node.props.Source : '-- new script\nprint("hello")') }; scriptTabs.push(tab); }
    else if (source !== undefined) tab.source = source;
    tab.dirty = false;
    setActiveTab(id);
    renderViewTabs();
  }
  function setActiveTab(id) {
    E().state.activeDoc = id;
    const tab = scriptTabs.find((t) => t.id === id);
    $$('.stage').forEach((s) => s.classList.remove('active'));
    $('#viewTabs .vtab').forEach((t) => t.classList.toggle('active', t.dataset.doc === id));
    if (id === 'place') { $('#viewport').classList.add('active'); }
    else if (tab) {
      $('#scriptStage').classList.add('active');
      const ta = $('#seInput');
      ta.value = tab.source;
      updateEditor();
      ta.focus();
    }
    renderViewTabs();
  }
  function renderViewTabs() {
    const host = $('#viewTabs');
    host.innerHTML = '<button class="vtab ' + (E().state.activeDoc === 'place' ? 'active' : '') + '" data-doc="place">🏠 Place</button>' +
      scriptTabs.map((t) => '<button class="vtab script-tab ' + (E().state.activeDoc === t.id ? 'active' : '') + '" data-doc="' + t.id + '">📜 ' + esc(t.name) + (t.dirty ? ' •' : '') + '</button>').join('');
    $$('.vtab', host).forEach((b) => b.addEventListener('click', () => setActiveTab(b.dataset.doc)));
    $$('.vtab.script-tab', host).forEach((b) => {
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = b.dataset.doc;
        const i = scriptTabs.findIndex((t) => t.id === id);
        if (i >= 0) { scriptTabs.splice(i, 1); if (E().state.activeDoc === id) setActiveTab('place'); renderViewTabs(); toast('Script tab closed', 'info'); }
      });
    });
  }
  function currentScript() { return scriptTabs.find((t) => t.id === E().state.activeDoc) || null; }

  function updateEditor() {
    const ta = $('#seInput');
    const tab = currentScript();
    if (tab) tab.source = ta.value;
    $('#seHighlight').innerHTML = highlight(ta.value);
    const lines = ta.value.split('\n').length;
    $('#seGutter').textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const ln = before.split('\n').length;
    const col = pos - before.lastIndexOf('\n');
    $('#seStatus').textContent = 'Lua/Luau · Ln ' + ln + ', Col ' + col + ' · ' + lines + ' lines · UTF-8';
    const h = Math.max($('#scriptStage').clientHeight - 40, lines * 20);
    $('#seHighlight').style.minHeight = h + 'px';
    $('#seInput').style.height = h + 'px';
  }

  /* ---------------- dialogs ---------------- */
  function dialog(title, fields, onOk, extra) {
    const host = $('#modalHost');
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = (extra ? '<div class="' + (extra.kind || 'note') + '">' + extra.html + '</div>' : '') +
      fields.map((f) => {
        if (f.html) return f.html;
        const id = 'f_' + f.id;
        let input;
        if (f.type === 'select') input = '<select id="' + id + '">' + (f.options || []).map((o) => '<option ' + (o === f.value ? 'selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
        else if (f.type === 'textarea') input = '<textarea id="' + id + '" rows="4">' + esc(f.value || '') + '</textarea>';
        else if (f.type === 'check') input = '<input type="checkbox" id="' + id + '" ' + (f.value ? 'checked' : '') + '>';
        else input = '<input id="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(f.value == null ? '' : f.value) + '" placeholder="' + esc(f.placeholder || '') + '">';
        return '<div class="field"><label for="' + id + '">' + esc(f.label) + '</label>' + input + '</div>';
      }).join('');
    $('#modalFoot').innerHTML = (extra && extra.buttons ? extra.buttons : '<button class="btn" data-x="cancel">Cancel</button><button class="btn accent" data-x="ok">OK</button>');
    host.classList.remove('hidden');
    const close = () => host.classList.add('hidden');
    $('#modalClose').onclick = close;
    $$('#modalFoot [data-x]').forEach((b) => b.onclick = () => {
      if (b.dataset.x === 'ok') {
        const vals = {};
        fields.forEach((f) => { if (f.id) { const el2 = $('#f_' + f.id); vals[f.id] = el2 ? (el2.type === 'checkbox' ? el2.checked : el2.value) : ''; } });
        close();
        onOk && onOk(vals);
      } else close();
    });
    return { close, body: $('#modalBody') };
  }

  function openSettings() {
    const c = global.Config;
    const d = dialog('Settings · Credentials', [
      { html: '<div class="note warn">Credentials stay on this device (<code>localStorage</code>). The Android APK build can bundle them; the public GitHub build never receives them.</div>' },
      { label: 'Roblox OAuth Client ID', id: 'clientId', value: c.oauth.clientId, placeholder: 'e.g. 816547628409595165403873012' },
      { label: 'OAuth Client Secret (optional, confidential clients)', id: 'clientSecret', value: c.oauth.clientSecret },
      { label: 'OAuth redirect URI', id: 'redirectUri', value: c.oauth.redirectUri },
      { label: 'Open Cloud API key', id: 'apiKey', value: c.openCloud.apiKey },
      { label: 'Universe ID', id: 'universeId', value: c.openCloud.universeId, placeholder: 'from Creator Dashboard → ⋯ → Copy Universe ID' },
      { label: 'Place ID', id: 'placeId', value: c.openCloud.placeId, placeholder: 'from the place Configure page URL' },
      { label: 'CORS proxy prefix (web only, optional)', id: 'proxy', value: c.openCloud.proxy, placeholder: 'https://your-worker.workers.dev/?url=' },
      { label: 'AI endpoint (OpenAI-compatible, optional)', id: 'aiEndpoint', value: c.ai.endpoint, placeholder: 'https://api.openai.com/v1' },
      { label: 'AI API key', id: 'aiKey', value: c.ai.apiKey },
      { label: 'AI model', id: 'aiModel', value: c.ai.model }
    ], (v) => {
      const s = c.setSetting;
      s('clientId', v.clientId.trim());
      s('clientSecret', v.clientSecret.trim());
      s('redirectUri', v.redirectUri.trim());
      s('apiKey', v.apiKey.trim());
      s('universeId', v.universeId.trim());
      s('placeId', v.placeId.trim());
      s('proxy', v.proxy.trim());
      s('aiEndpoint', v.aiEndpoint.trim());
      s('aiKey', v.aiKey.trim());
      s('aiModel', v.aiModel.trim());
      toast('Settings saved on this device', 'ok');
      updateSyncChip();
    });
    return d;
  }

  function openGameSettings() {
    const c = global.Config;
    dialog('Game Settings · Publishing', [
      { html: '<div class="note">Publishing pushes your place file (.rbxlx) to Roblox through Open Cloud <code>universes/v1/…/versions</code>. Create the API key with the <b>universe-places</b> → <b>Write</b> permission.</div>' },
      { label: 'Place name', id: 'name', value: E().state.place.props.Name || 'My Place' },
      { label: 'Universe ID', id: 'universeId', value: c.openCloud.universeId },
      { label: 'Place ID', id: 'placeId', value: c.openCloud.placeId },
      { label: 'Version type', id: 'vt', type: 'select', options: ['Published', 'Saved'], value: 'Published' },
      { label: 'Description', id: 'desc', type: 'textarea', value: 'Made with Roblox Studio Android Edition' },
      { html: '<div class="note ok">Tip: Universe ID = ⋯ on the experience thumbnail · Place ID = the number in the place Configure URL.</div>' }
    ], async (v) => {
      E().state.place.props.Name = v.name;
      c.setSetting('universeId', v.universeId.trim());
      c.setSetting('placeId', v.placeId.trim());
      await publishNow(v.vt);
    }, { buttons: '<button class="btn" data-x="cancel">Close</button><button class="btn" data-x="ok">Publish now</button>' });
  }

  async function publishNow(vt) {
    const c = global.Config;
    if (!c.openCloud.universeId || !c.openCloud.placeId) { toast('Set Universe ID and Place ID first', 'warn'); openGameSettings(); return; }
    if (!c.openCloud.apiKey) { toast('Add your Open Cloud API key in Settings', 'warn'); openSettings(); return; }
    const xml = E().toXML();
    const toastEl = toast('Publishing ' + (E().state.place.props.Name || 'place') + '…', 'info', 60000);
    try {
      const res = await global.Roblox.publishPlace({ xml, versionType: vt || 'Published' });
      if (toastEl) toastEl.remove();
      toast('Published to Roblox ✓ universe ' + res.universeId + ' place ' + res.placeId, 'ok', 6000);
      E().log('sys', 'Published place to Roblox (universe ' + res.universeId + ', place ' + res.placeId + ')');
      updateSyncChip(true);
      dialog('Published ✓', [], null, {
        kind: 'note ok',
        html: '<b>' + esc(E().state.place.props.Name) + '</b> is live on Roblox.<br><br>' +
          'Universe ID: <code>' + esc(res.universeId) + '</code><br>Place ID: <code>' + esc(res.placeId) + '</code><br>' +
          '<a href="https://create.roblox.com/dashboard/creations" target="_blank">Open Creator Dashboard ↗</a>',
        buttons: '<button class="btn accent" data-x="ok">Done</button>'
      });
    } catch (e) {
      if (toastEl) toastEl.remove();
      toast(e.message, 'err', 7000);
      E().log('err', 'Publish failed: ' + e.message);
      if (/CORS|Failed to fetch|NetworkError|blocked/i.test(e.message)) {
        dialog('Publish blocked by the browser', [], null, {
          kind: 'note warn',
          html: 'Roblox <code>apis.roblox.com</code> does not send CORS headers, so a browser cannot POST on its own.<br><br>' +
            'Options:<br>1. Install the APK (it publishes natively — no CORS).<br>2. Add your own proxy prefix in Settings → Credentials → <b>CORS proxy</b>.<br><br>Original error: ' + esc(e.message),
          buttons: '<button class="btn accent" data-x="ok">Got it</button>'
        });
      }
    }
  }

  function openAbout() {
    dialog('About', [], null, {
      html: '<div style="text-align:center;padding:6px"><img src="assets/logo.svg" style="width:84px"><h2 style="margin:8px 0 4px">Roblox Studio Android Edition</h2>' +
        '<div class="muted">v' + global.Config.version + ' · ' + countInstances() + ' instances · ' + global.Templates.list.length + ' game templates</div>' +
        '<p class="muted small" style="margin-top:12px">A Studio-style editor for Android, Windows, macOS and the browser: 3D viewport, Luau scripting, AI Builder &amp; AI Coder, Toolbox, group games and one-click publish to Roblox via Open Cloud.</p>' +
        '<p class="small">Not affiliated with or endorsed by Roblox Corporation.</p></div>',
      buttons: '<button class="btn accent" data-x="ok">Close</button>'
    });
  }
  function openShortcuts() {
    dialog('Keyboard shortcuts', [], null, {
      html: '<div class="small" style="line-height:2"><code>F5</code> Play · <code>Shift+F5</code> Stop · <code>1-4</code> Tools · <code>Ctrl+Z/Y</code> Undo/Redo · <code>Ctrl+D</code> Duplicate · <code>Del</code> Delete · <code>Ctrl+S</code> Save · <code>Ctrl+P</code> Publish · <code>F</code> Frame · <code>Ctrl+N</code> New place · <code>Esc</code> Close dialog</div>',
      buttons: '<button class="btn accent" data-x="ok">Close</button>'
    });
  }
  function openLuaHelp() {
    dialog('Lua / Luau cheatsheet', [], null, {
      html: '<pre class="bub ai" style="max-width:100%">' + esc(
        'local part = workspace.Baseplate\n' +
        'part.Touched:Connect(function(hit)\n  print(hit.Name)\nend)\n\n' +
        'for i = 1, 10 do print(i) end\n' +
        'local t = {a = 1, 2, 3}\n' +
        'for k, v in pairs(t) do print(k, v) end\n' +
        'local ok, err = pcall(function() error("x") end)\n' +
        'game.Players.PlayerAdded:Connect(function(plr) end)') + '</pre>',
      buttons: '<button class="btn accent" data-x="ok">Close</button>'
    });
  }
  function openHelp() {
    dialog('Help', [], null, {
      html: '<div class="small" style="line-height:1.7">' +
        '<b>Build:</b> drag in the viewport to orbit, tap a part to select, use Tools in the ribbon to move/rotate/scale.<br>' +
        '<b>Script:</b> Scripting tab → new script, edit with Lua highlighting, press Run.<br>' +
        '<b>AI:</b> right dock → AI Builder. Describe what you want; hit Generate, then “Build in workspace”.<br>' +
        '<b>Templates:</b> left dock → Games, or the start screen.<br>' +
        '<b>Publish:</b> Home → Publish. Needs Universe ID + Place ID + API key (Settings → Credentials).<br>' +
        '<b>Account:</b> top-right sign-in uses Roblox OAuth 2.0 (PKCE).</div>',
      buttons: '<button class="btn accent" data-x="ok">Close</button>'
    });
  }

  /* ---------------- actions ---------------- */
  const actions = {
    new: () => { E().newPlace(true); scriptTabs.length = 0; setActiveTab('place'); refresh(); toast('New baseplate place created', 'ok'); },
    open: () => $('#fileOpen').click(),
    save: () => { E().state.dirty = false; download((E().state.place.props.Name || 'place') + '.rbxlx', E().toXML(), 'application/xml'); toast('Place downloaded as .rbxlx', 'ok'); },
    export: () => download('place.rbxlx', E().toXML(), 'application/xml'),
    publish: () => openGameSettings(),
    play: () => E().playStart(),
    stop: () => E().playStop(),
    newscript: () => {
      const n = E().insert({ class: 'Script', name: 'Script' });
      refresh();
      openScript(n, n.name, n.props.Source);
      toast('Server script created', 'ok');
    },
    newlocalscript: () => { const n = E().insert({ class: 'LocalScript', name: 'LocalScript' }); refresh(); openScript(n, n.name, n.props.Source); },
    newmodule: () => { const n = E().insert({ class: 'ModuleScript', name: 'ModuleScript' }); refresh(); openScript(n, n.name, n.props.Source); },
    runscript: () => { const t = currentScript(); if (t) runCurrent(); else toast('Open a script first', 'warn'); },
    find: () => toast('Use Ctrl+F in your browser, or the Explorer filter', 'info')
  };
  function action(name) { const fn = actions[name]; if (fn) fn(); else toast('Unknown action: ' + name, 'warn'); }

  function runCurrent() {
    const t = currentScript();
    if (!t) return;
    if (t.node) { t.node.props.Source = t.source; E().runScriptNode(t.node); }
    else {
      const env = E().state.mode === 'play' ? null : null;
      const r = global.Lua.run(t.source, {}, { print: (m) => E().log('log', m), warn: (m) => E().log('warn', m), budget: 400000 });
      if (r.ok) E().log('sys', '✓ Draft script ran without errors');
      else E().log('err', '✗ ' + r.error + (r.line ? ' (line ' + r.line + ')' : ''));
    }
    openPanel('right', 'output');
  }

  function lintCurrent() {
    const t = currentScript(); if (!t) return;
    const problems = [];
    const src = t.source;
    if (!/\bend\b/.test(src) && /\b(function|if|for|while|do)\b/.test(src)) problems.push('Missing end for a block');
    if (/\bwhile true do\b/.test(src) && !/\bwait\s*\(|task\.wait/.test(src)) problems.push('Infinite loop without wait()');
    if (/print\(/.test(src) && /print\s*\(\s*\)/.test(src)) problems.push('print() with empty args');
    if (/\bvar\b/.test(src)) problems.push('"var" is not Lua — use local');
    if (/\bconsole\.log\b/.test(src)) problems.push('console.log is JavaScript, use print()');
    const res = global.Lua.run(src, {}, { print: () => {}, budget: 200000 });
    if (!res.ok) problems.push('Syntax/runtime: ' + res.error + (res.line ? ' (line ' + res.line + ')' : ''));
    if (!problems.length) { E().log('sys', 'Lint: no problems found ✓'); toast('No problems found ✓', 'ok'); }
    else { problems.forEach((p) => E().log('warn', 'Lint: ' + p)); openPanel('right', 'output'); toast(problems.length + ' lint warning(s)', 'warn'); }
  }
  function scriptStats() {
    const t = currentScript(); if (!t) return;
    const src = t.source;
    const lines = src.split('\n').length;
    const funcs = (src.match(/\bfunction\b/g) || []).length;
    const locals = (src.match(/\blocal\b/g) || []).length;
    toast(lines + ' lines · ' + funcs + ' functions · ' + locals + ' locals · ' + src.length + ' chars', 'info', 5000);
    E().log('info', 'Script stats: ' + lines + ' lines, ' + funcs + ' functions, ' + locals + ' locals');
  }
  function formatCurrent() {
    const t = currentScript(); if (!t) return;
    t.source = t.source.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    $('#seInput').value = t.source; updateEditor(); toast('Whitespace tidied', 'ok');
  }
  function copyCurrent() { const t = currentScript(); if (t && navigator.clipboard) { navigator.clipboard.writeText(t.source); toast('Copied', 'ok'); } }
  function explainCurrent() {
    const t = currentScript(); if (!t) return;
    openPanel('right', 'ai');
    const notes = global.AI.explain(t.source);
    aiBubble('<b>Analysis of ' + esc(t.name) + '</b><br>' + notes.map((n) => '• ' + esc(n)).join('<br>'), 'ai');
  }
  function insertSnippet(kind) {
    const src = global.AI.SCRIPTS[kind];
    openScript(null, kind.charAt(0).toUpperCase() + kind.slice(1) + 'Snippet', src);
    toast('Snippet inserted in a new tab', 'ok');
  }
  function insertUI(cls, props) {
    E().pushUndo();
    const parent = E().primary();
    let gui = parent;
    if (!gui || !['ScreenGui', 'Frame'].includes(gui.class)) {
      gui = E().state.services.StarterGui.children.find((c) => c.class === 'ScreenGui') || E().insert({ class: 'ScreenGui', name: 'Hud' }, E().state.services.StarterGui);
    }
    const node = E().insert({ class: cls, name: cls, props: props || {} }, gui);
    refresh(); E().select([node.id]);
    toast('Inserted ' + cls, 'ok');
  }
  function insertInstance(cls) { const n = E().insert({ class: cls, name: cls }); refresh(); E().select([n.id]); }

  function scaleSel(sx, sy, sz) {
    E().pushUndo();
    E().selected().forEach((n) => { if (n.props.Size) n.props.Size = n.props.Size.map((v, i) => Math.max(0.2, Math.round(v * (i === 0 ? sx : i === 1 ? sy : sz) * 100) / 100)); });
    refresh();
  }
  function moveSel(d) {
    E().pushUndo();
    E().selected().forEach((n) => { if (n.props.Position) n.props.Position = n.props.Position.map((v, i) => v + d[i]); });
    refresh();
  }
  function moveSelToGround() {
    E().pushUndo();
    E().selected().forEach((n) => {
      if (!n.props.Position || !n.props.Size) return;
      let best = -Infinity;
      E().parts.forEach((p) => {
        if (p === n || !p.props.Position) return;
        const dx = Math.abs(p.props.Position[0] - n.props.Position[0]);
        const dz = Math.abs(p.props.Position[2] - n.props.Position[2]);
        if (dx < (p.props.Size[0] + n.props.Size[0]) / 2 && dz < (p.props.Size[2] + n.props.Size[2]) / 2) {
          best = Math.max(best, p.props.Position[1] + p.props.Size[1] / 2 + n.props.Size[1] / 2);
        }
      });
      n.props.Position[1] = best > -Infinity ? best + 0.05 : n.props.Size[1] / 2;
    });
    refresh(); toast('Moved to ground', 'ok');
  }
  function centerSel() {
    E().pushUndo();
    E().selected().forEach((n) => { if (n.props.Position) { n.props.Position[0] = 0; n.props.Position[2] = 0; } });
    refresh();
  }
  function paintSel(color) {
    E().pushUndo();
    const sel = E().selected();
    if (!sel.length) { toast('Select a part first', 'warn'); return; }
    sel.forEach((n) => { if (n.props.Color !== undefined) n.props.Color = color; });
    refresh();
  }
  function setPropSel(k, v) {
    E().pushUndo();
    const sel = E().selected();
    if (!sel.length) { toast('Select something first', 'warn'); return; }
    sel.forEach((n) => { n.props[k] = v; });
    refresh(); toast(k + ' = ' + v, 'ok');
  }
  function countParts() { let c = 0; E().walk(E().state.services.Workspace, (n) => { if (n.props && n.props.Size) c++; }); return c; }
  function countInstances() { let c = 0; E().walk(E().state.place, () => c++); return c; }
  function cleanEmpty() {
    E().pushUndo();
    let removed = 0;
    const prune = (n) => { n.children = n.children.filter((c) => { prune(c); const empty = !c.children.length && ['Folder', 'Model'].includes(c.class) && !c.props.Source; if (empty) removed++; return !empty; }); };
    prune(E().state.place);
    refresh(); toast('Removed ' + removed + ' empty container(s)', 'ok');
  }

  /* ---------------- start screen ---------------- */
  function renderStart() {
    renderTemplates($('#startTemplates'), 'start');
    const recents = E().state.recent;
    $('#recentList').innerHTML = recents.length ? recents.map((r, i) =>
      '<div class="li" data-i="' + i + '"><div class="lav">📁</div><div class="lmain"><div class="lname">' + esc(r.name) + '</div><div class="lmeta">' + esc(r.when) + ' · ' + esc(r.count) + ' instances</div></div>' +
      '<div class="lact"><button class="mini" data-act="load" data-i="' + i + '">Open</button></div></div>').join('') :
      '<div class="muted small">No recent places yet — create one!</div>';
    $$('#recentList [data-act]').forEach((b) => b.addEventListener('click', () => {
      const r = E().state.recent[+b.dataset.i];
      if (r && r.json) { global.Engine.fromJSON(r.json); hideStart(); toast('Opened ' + r.name, 'ok'); }
    }));
    const gg = E().state.groupGames;
    $('#startGroups').innerHTML = gg.length ? gg.map((g) =>
      '<div class="li"><div class="lav">👥</div><div class="lmain"><div class="lname">' + esc(g.name) + '</div><div class="lmeta">' + esc(g.groupName || 'Group') + '</div></div>' +
      '<div class="lact"><button class="mini" data-g="' + esc(g.template) + '">Play</button></div></div>').join('') :
      '<div class="muted small">Group games you create will appear here.</div>';
    $$('#startGroups [data-g]').forEach((b) => b.addEventListener('click', () => { applyTemplate(b.dataset.g); hideStart(); }));
  }
  function hideStart() { $('#startScreen').classList.add('hidden'); }
  function showStart() { renderStart(); $('#startScreen').classList.remove('hidden'); }

  function applyTemplate(id) {
    E().loadTemplate(id);
    scriptTabs.length = 0;
    setActiveTab('place');
    refresh();
    hideStart();
    const t = global.Templates.get(id);
    toast((t ? t.name : id) + ' template loaded ✓', 'ok');
    E().state.camera.target = [0, 8, -20];
    E().state.camera.dist = 70;
  }

  /* ---------------- file IO ---------------- */
  function download(name, text, mime) {
    const nb = global.NativeBridge;
    if (nb && nb.isNative && typeof nb.saveFile === 'function') {
      const where = nb.saveFile(name, text);
      if (where) { toast('Saved to ' + where, 'ok'); return; }
      toast('Could not save file', 'err');
      return;
    }
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function openFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        if (/^\s*\{/.test(text)) global.Engine.fromJSON(text);
        else global.Engine.fromXML(text);
        refresh();
        hideStart();
        toast('Loaded ' + file.name, 'ok');
        E().log('sys', 'Imported ' + file.name + ' (' + countInstances() + ' instances)');
      } catch (e) { toast('Could not open file: ' + e.message, 'err'); }
    };
    reader.readAsText(file);
  }

  /* ---------------- account ---------------- */
  async function signIn() {
    try {
      if (!global.Config.oauth.clientId) { openSettings(); toast('Add your Roblox OAuth Client ID first', 'warn'); return; }
      const r = await global.Roblox.login();
      if (r && r.mode === 'external') toast('Complete the sign-in in your browser…', 'info', 8000);
    } catch (e) {
      toast(e.message, 'err', 6000);
      if (e.code === 'no-client-id') openSettings();
    }
  }
  function signOut() {
    global.Roblox.signOut();
    $('#accountLabel').textContent = 'Sign in';
    $('#avatarImg').src = 'assets/default-avatar.svg';
    E().state.groups = [];
    renderGroups();
    toast('Signed out of Roblox', 'info');
  }
  async function refreshAccount() {
    if (!global.Roblox.signedIn()) return;
    const info = await global.Roblox.userInfo();
    if (info) {
      const name = info.preferred_username || info.nickname || info.sub || 'Signed in';
      $('#accountLabel').textContent = name;
      E().log('sys', 'Signed in as ' + name);
      const groups = await global.Roblox.myGroups(info.sub);
      E().state.groups = groups;
      renderGroups();
      if (info.picture) $('#avatarImg').src = info.picture;
      toast('Signed in as ' + name, 'ok');
    }
  }

  function updateSyncChip(published) {
    const c = global.Config;
    const ready = !!(c.openCloud.universeId && c.openCloud.placeId && c.openCloud.apiKey);
    const chip = $('#btnSync');
    const label = $('#syncLabel');
    if (published) { chip.classList.add('on'); label.textContent = 'Live'; }
    else if (ready) { chip.classList.add('on'); label.textContent = 'Ready'; }
    else { chip.classList.remove('on'); label.textContent = 'Local'; }
    $('#stNet').textContent = (navigator.onLine ? '● online' : '● offline') + (ready ? ' · cloud ready' : '');
  }

  /* ---------------- panels / docks ---------------- */
  function openPanel(side, panel) {
    const dock = side === 'left' ? $('#leftDock') : $('#rightDock');
    const tabs = side === 'left' ? $$('#leftTabs .dtab') : $$('#rightTabs .dtab');
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.panel === panel));
    $$('.dpanel', dock).forEach((p) => p.classList.toggle('active', p.dataset.panel === panel));
    if (window.innerWidth <= 1100) {
      const ws = $('#workspace');
      ws.classList.toggle('mobile-left', side === 'left');
      ws.classList.toggle('mobile-right', side === 'right');
    } else {
      const ws = $('#workspace');
      ws.classList.remove(side === 'left' ? 'left-collapsed' : 'right-collapsed');
    }
    if (panel === 'explorer') renderExplorer();
    if (panel === 'toolbox') renderToolbox();
    if (panel === 'templates') renderTemplates($('#templateGrid'), 'templates');
    if (panel === 'groups') renderGroups();
    if (panel === 'properties') renderProperties();
    if (panel === 'output') renderOutput();
  }
  function toggleDock(side) {
    const ws = $('#workspace');
    if (window.innerWidth <= 1100) {
      if (side === 'left') { ws.classList.toggle('mobile-left'); ws.classList.remove('mobile-right'); }
      else { ws.classList.toggle('mobile-right'); ws.classList.remove('mobile-left'); }
    } else ws.classList.toggle(side === 'left' ? 'left-collapsed' : 'right-collapsed');
  }

  /* ---------------- menus ---------------- */
  const MENUS = {
    file: [['New place', 'new'], ['Open…', 'open'], ['Save / Download .rbxlx', 'save'], ['-', ''], ['Publish to Roblox…', 'publish'], ['Game Settings…', 'publish'], ['-', ''], ['Sign in to Roblox', '_signin'], ['Settings / Credentials', '_settings']],
    edit: [['Undo', '_undo'], ['Redo', '_redo'], ['Duplicate', '_dup'], ['Delete', '_del'], ['-', ''], ['Select all', '_all'], ['Deselect', '_none']],
    insert: [['Part', '_part'], ['Spawn Location', '_spawn'], ['Script', 'newscript'], ['LocalScript', 'newlocalscript'], ['Folder', '_folder'], ['-', ''], ['Open Toolbox', '_toolbox']],
    view: [['Explorer', '_explorer'], ['Properties', '_props'], ['Output', '_output'], ['AI Builder', '_ai'], ['-', ''], ['Toggle left dock', '_l'], ['Toggle right dock', '_r'], ['Fullscreen', '_full']],
    plugins: [['AI Builder', '_ai'], ['Templates', '_tpl'], ['Group games', '_groups'], ['About', '_about']],
    help: [['Help', '_help'], ['Shortcuts', '_keys'], ['Lua cheatsheet', '_lua'], ['Report an issue', '_issue']]
  };
  function openMenu(name, anchor) {
    closeMenu();
    const items = MENUS[name] || [];
    const m = document.createElement('div');
    m.className = 'ctx';
    m.id = 'activeMenu';
    m.innerHTML = items.map(([label, cmd]) => label === '-' ? '<div class="sep"></div>' : '<button data-c="' + cmd + '">' + esc(label) + '</button>').join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.left = r.left + 'px';
    m.style.top = (r.bottom + 4) + 'px';
    $$('button', m).forEach((b) => b.addEventListener('click', () => { menuCommand(b.dataset.c); closeMenu(); }));
  }
  function closeMenu() { const m = $('#activeMenu'); if (m) m.remove(); }
  function menuCommand(c) {
    if (c.startsWith('_')) {
      const map = {
        _signin: signIn, _settings: openSettings, _undo: () => E().undo(), _redo: () => E().redo(),
        _dup: () => E().duplicateSelection(), _del: () => E().deleteSelection(),
        _all: () => { const ids = []; E().walk(E().state.services.Workspace, (n) => ids.push(n.id)); E().select(ids); },
        _none: () => E().clearSelection(), _part: () => E().insertPart('Part'),
        _spawn: () => { E().insert({ class: 'SpawnLocation', name: 'SpawnLocation' }); refresh(); },
        _folder: () => { E().insert({ class: 'Folder', name: 'Folder' }); refresh(); },
        _toolbox: () => openPanel('left', 'toolbox'), _explorer: () => openPanel('left', 'explorer'),
        _props: () => openPanel('right', 'properties'), _output: () => openPanel('right', 'output'),
        _ai: () => openPanel('right', 'ai'), _l: () => toggleDock('left'), _r: () => toggleDock('right'),
        _full: toggleFullscreen, _tpl: () => openPanel('left', 'templates'), _groups: () => openPanel('left', 'groups'),
        _about: openAbout, _help: openHelp, _keys: openShortcuts, _lua: openLuaHelp,
        _issue: () => window.open('https://github.com/GoStudios-Real/Roblox-Studio-Android-Edition/issues', '_blank')
      };
      (map[c] || (() => toast('Not implemented: ' + c, 'warn')))();
    } else action(c);
  }

  /* ---------------- context menu ---------------- */
  function openContextMenu(x, y) {
    const m = $('#ctxMenu');
    m.classList.remove('hidden');
    m.innerHTML = [
      ['➕ Insert child part', 'part'], ['⧉ Duplicate', 'dup'], ['📜 Insert script here', 'script'],
      ['📁 Insert folder', 'folder'], ['🔍 Frame', 'frame'], ['-', ''],
      ['🎨 Paint blue', 'paint'], ['⚓ Toggle anchor', 'anchor'], ['-', ''],
      ['🗑 Delete', 'del']
    ].map(([l, c]) => c === '-' ? '<div class="sep"></div>' : '<button data-c="' + c + '">' + l + '</button>').join('');
    m.style.left = Math.min(x, window.innerWidth - 210) + 'px';
    m.style.top = Math.min(y, window.innerHeight - 260) + 'px';
    $$('button', m).forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.c;
      const sel = E().primary();
      if (c === 'part') { const n = E().insert({ class: 'Part', name: 'Part' }, sel); E().select([n.id]); }
      if (c === 'dup') E().duplicateSelection();
      if (c === 'script') { const n = E().insert({ class: 'Script', name: 'Script' }, sel); openScript(n, n.name, n.props.Source); }
      if (c === 'folder') { const n = E().insert({ class: 'Folder', name: 'Folder' }, sel); E().select([n.id]); }
      if (c === 'frame') E().frameSelection();
      if (c === 'paint') paintSel('#2f7ce0');
      if (c === 'anchor') { if (sel) E().setProp(sel, 'Anchored', !(sel.props.Anchored !== false)); }
      if (c === 'del') E().deleteSelection();
      refresh();
      m.classList.add('hidden');
    }));
  }

  /* ---------------- command bar ---------------- */
  function runCommand(raw) {
    const cmd = String(raw || '').trim();
    if (!cmd) return;
    E().log('info', '> ' + cmd);
    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(' ');
    const lower = head.toLowerCase();
    const sel = E().primary();
    switch (lower) {
      case 'insert': {
        const kind = (rest[0] || 'part').replace(/s$/, '');
        const map = { part: 'Part', spawn: 'SpawnLocation', script: 'Script', model: 'Model', folder: 'Folder', light: 'PointLight', seat: 'Seat', wedge: 'WedgePart', truss: 'TrussPart', gui: 'ScreenGui', frame: 'Frame', button: 'TextButton', label: 'TextLabel' };
        const cls = map[kind] || (rest[0] ? rest[0].charAt(0).toUpperCase() + rest[0].slice(1) : 'Part');
        const n = E().insert({ class: cls, name: cls }, sel);
        E().select([n.id]); refresh(); E().log('sys', 'Inserted ' + cls);
        break;
      }
      case 'goto': case 'tp': {
        const nums = arg.split(/[,\s]+/).map(Number).filter((n) => !isNaN(n));
        if (nums.length >= 3 && sel) { E().pushUndo(); sel.props.Position = nums.slice(0, 3); refresh(); E().log('sys', 'Moved to ' + nums.slice(0, 3).join(', ')); }
        else E().log('warn', 'usage: goto x,y,z');
        break;
      }
      case 'select': {
        const n = E().findByName(arg) || E().findByName(rest[0] || '');
        if (n) { E().select([n.id]); E().log('sys', 'Selected ' + n.name); } else E().log('warn', 'No instance named "' + arg + '"');
        break;
      }
      case 'theme': setTheme(rest[0] === 'light' ? 'light' : 'dark'); break;
      case 'publish': action('publish'); break;
      case 'play': action('play'); break;
      case 'stop': action('stop'); break;
      case 'save': action('save'); break;
      case 'undo': E().undo(); break;
      case 'redo': E().redo(); break;
      case 'clear': E().state.output.length = 0; renderOutput(); break;
      case 'count': E().log('info', countInstances() + ' instances, ' + countParts() + ' parts'); break;
      case 'lua': case 'run': {
        const src = rest.join(' ');
        const r = global.Lua.run(src, {}, { print: (m) => E().log('log', m), warn: (m) => E().log('warn', m) });
        if (!r.ok) E().log('err', r.error + ' (line ' + r.line + ')');
        break;
      }
      case 'ai': case 'ai:': {
        const p = cmd.replace(/^ai:?\s*/i, '');
        openPanel('right', 'ai'); runAI(p);
        break;
      }
      case 'help': openHelp(); break;
      case 'new': actions.new(); break;
      case 'open': action('open'); break;
      default: {
        if (/^ai:/.test(cmd)) { openPanel('right', 'ai'); runAI(cmd.replace(/^ai:\s*/i, '')); break; }
        E().log('err', 'Unknown command: ' + head + ' (try: insert, goto, select, play, publish, lua, ai:, count, help)');
      }
    }
  }

  /* ---------------- misc helpers ---------------- */
  function quickAI(prompt) { openPanel('right', 'ai'); runAI(prompt); }
  function setTheme(t) {
    document.documentElement.classList.toggle('app-theme-light', t === 'light');
    document.body.classList.toggle('app-theme-light', t === 'light');
    $('#app').classList.toggle('theme-dark', t !== 'light');
    try { localStorage.setItem('rsa:theme', t); } catch (e) {}
    toast(t === 'light' ? 'Light theme' : 'Dark theme', 'info', 1600);
  }
  function setAccent(hex) {
    document.documentElement.style.setProperty('--accent', hex);
    toast('Accent colour updated', 'info', 1600);
  }
  function setCamera(yaw, pitch) { const c = E().state.camera; c.yaw = yaw; c.pitch = pitch; c.target = [0, 6, 0]; c.dist = 60; }
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    else document.exitFullscreen && document.exitFullscreen();
  }
  function setStatus() {
    const sel = E().selected();
    $('#stSel').textContent = sel.length ? sel.length + ' selected · ' + (sel[0] ? sel[0].name : '') : 'nothing selected';
    const p = sel[0] && sel[0].props && sel[0].props.Position;
    $('#stPos').textContent = p ? p.map((v) => Math.round(v * 10) / 10).join(', ') : '0, 0, 0';
    $('#stMode').textContent = E().state.mode === 'play' ? 'PlayMode' : 'EditMode';
    $('#tbPlace').textContent = (E().state.place.props.Name || 'Place') + (E().state.dirty ? ' •' : '');
  }
  function refresh() { renderExplorer(); renderProperties(); renderOutput(); setStatus(); E().emit('change'); }

  /* ---------------- wire everything ---------------- */
  function wire() {
    // ribbon tabs
    $$('.rtab').forEach((b) => b.addEventListener('click', () => {
      $$('.rtab').forEach((x) => x.classList.toggle('active', x === b));
      renderRibbon(b.dataset.tab);
    }));
    // dock tabs
    $$('#leftTabs .dtab').forEach((b) => b.addEventListener('click', () => openPanel('left', b.dataset.panel)));
    $$('#rightTabs .dtab').forEach((b) => b.addEventListener('click', () => openPanel('right', b.dataset.panel)));
    $('#leftCollapse').addEventListener('click', () => toggleDock('left'));
    $('#rightCollapse').addEventListener('click', () => toggleDock('right'));
    // toolbar
    $$('#vpToolbar .tbtn[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
    $('#vpToolbar [data-snap]').addEventListener('click', () => {
      const opts = [0, 1, 2, 4, 8];
      E().state.snap = opts[(opts.indexOf(E().state.snap) + 1) % opts.length];
      refreshToolButtons();
    });
    $('#btnSnapY').addEventListener('click', () => { E().state.snapY = !E().state.snapY; refreshToolButtons(); });
    $('#btnFrame').addEventListener('click', () => E().frameSelection());
    $('#btnGrid').addEventListener('click', () => { E().state.showGrid = !E().state.showGrid; refreshToolButtons(); });
    // menus
    $$('#tbMenu button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu(b.dataset.menu, b); }));
    document.addEventListener('click', (e) => { if (!e.target.closest('.ctx')) { closeMenu(); $('#ctxMenu').classList.add('hidden'); } });
    // top bar
    $('#btnSettings').addEventListener('click', openSettings);
    $('#btnTheme').addEventListener('click', () => setTheme(document.body.classList.contains('app-theme-light') ? 'dark' : 'light'));
    $('#btnAccount').addEventListener('click', () => (global.Roblox.signedIn() ? openPanel('left', 'groups') : signIn()));
    $('#btnSync').addEventListener('click', openGameSettings);
    // explorer
    $('#explorerSearch').addEventListener('input', renderExplorer);
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => { E().insertPart(b.dataset.add === 'Folder' ? 'Folder' : b.dataset.add); refresh(); }));
    $('#btnDeleteSel').addEventListener('click', () => { E().deleteSelection(); refresh(); });
    // toolbox
    $('#toolboxSearch').addEventListener('input', renderToolbox);
    // templates
    $('#templateSearch').addEventListener('input', () => renderTemplates($('#templateGrid'), 'templates'));
    // groups
    $('#btnNewGroupGame').addEventListener('click', newGroupGame);
    $('#btnRefreshGroups').addEventListener('click', async () => {
      const info = await global.Roblox.userInfo();
      if (info) { E().state.groups = await global.Roblox.myGroups(info.sub); renderGroups(); toast('Groups refreshed', 'ok'); }
      else toast('Sign in to load groups', 'warn');
    });
    // output
    $('#outputFilter').addEventListener('input', renderOutput);
    $('#btnClearOutput').addEventListener('click', () => { E().state.output.length = 0; renderOutput(); });
    // AI
    $('#btnAiGo').addEventListener('click', () => { const v = $('#aiInput').value; $('#aiInput').value = ''; runAI(v); });
    $('#aiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#btnAiGo').click(); } });
    $$('#aiQuick .chipbtn').forEach((b) => b.addEventListener('click', () => { $('#aiInput').value = b.dataset.ai; runAI(b.dataset.ai); }));
    // command bar
    $('#cmdRun').addEventListener('click', () => { runCommand($('#cmdInput').value); $('#cmdInput').value = ''; });
    $('#cmdInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { runCommand($('#cmdInput').value); $('#cmdInput').value = ''; } });
    // editor
    const ta = $('#seInput');
    ta.addEventListener('input', () => { updateEditor(); const t = currentScript(); if (t) { t.dirty = true; renderViewTabs(); } });
    ta.addEventListener('scroll', () => { $('#seScroll').scrollTop = ta.scrollTop; });
    ta.addEventListener('keyup', updateEditor);
    ta.addEventListener('click', updateEditor);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); updateEditor(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveCurrentScript(); }
      if (e.key === 'F5') { e.preventDefault(); runCurrent(); }
    });
    // start screen
    $('#stNew').addEventListener('click', () => { actions.new(); hideStart(); });
    $('#stTemplates').addEventListener('click', () => { hideStart(); openPanel('left', 'templates'); });
    $('#stOpen').addEventListener('click', () => $('#fileOpen').click());
    $('#stAccounts').addEventListener('click', () => (global.Roblox.signedIn() ? signOut() : signIn()));
    $('#stImport').addEventListener('click', () => $('#fileOpen').click());
    $('#stHide').addEventListener('click', hideStart);
    $('#fileOpen').addEventListener('change', (e) => { if (e.target.files[0]) openFile(e.target.files[0]); });
    // play HUD
    $('#btnStopPlay').addEventListener('click', () => E().playStop());
    // global events
    E().on('explorer', renderExplorer);
    E().on('selection', () => { renderExplorer(); renderProperties(); setStatus(); });
    E().on('props', () => { renderProperties(); setStatus(); });
    E().on('output', renderOutput);
    E().on('mode', () => {
      $('#vpBadge').textContent = E().state.mode === 'play' ? 'Playing' : 'Editor';
      $('#vpBadge').classList.toggle('play', E().state.mode === 'play');
      $('#playHud').classList.toggle('hidden', E().state.mode !== 'play');
      setStatus();
      renderExplorer();
    });
    E().on('change', () => { setStatus(); });
    // keyboard
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input,textarea,select')) {
        if (e.key === 'Escape') { document.activeElement.blur(); }
        return;
      }
      const k = e.key;
      if (k === 'F5') { e.preventDefault(); e.shiftKey ? E().playStop() : E().playStart(); }
      else if (k === 'Delete' || k === 'Backspace') { E().deleteSelection(); refresh(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); E().undo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'Z' && e.shiftKey))) { e.preventDefault(); E().redo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); E().duplicateSelection(); refresh(); }
      else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); action('save'); }
      else if ((e.ctrlKey || e.metaKey) && k === 'p') { e.preventDefault(); openGameSettings(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'n') { e.preventDefault(); actions.new(); }
      else if (k === '1') setTool('select');
      else if (k === '2') setTool('move');
      else if (k === '3') setTool('rotate');
      else if (k === '4') setTool('scale');
      else if (k === 'f' || k === 'F') E().frameSelection();
      else if (k === 'Escape') { $('#modalHost').classList.add('hidden'); $('#ctxMenu').classList.add('hidden'); closeMenu(); }
      else if (k === 'g') openPanel('left', 'explorer');
      else if (k === 'p') openPanel('right', 'properties');
      else if (k === 'o') openPanel('right', 'output');
      else if (k === 'i') openPanel('left', 'toolbox');
      else if (k === '/') { e.preventDefault(); $('#cmdInput').focus(); }
    });
    // play movement keys
    document.addEventListener('keydown', (e) => { if (E().state.mode === 'play') E().state.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { if (E().state.mode === 'play') delete E().state.keys[e.code]; });
    window.addEventListener('resize', () => { renderExplorer(); });
    window.addEventListener('online', updateSyncChip);
    window.addEventListener('offline', updateSyncChip);
  }

  function saveCurrentScript() {
    const t = currentScript();
    if (t && t.node) { t.node.props.Source = t.source; E().log('sys', 'Saved ' + t.node.name); toast('Script saved ✓', 'ok'); }
    else toast('Draft script — use Export to keep it', 'info');
  }

  function boot() {
    wire();
    renderRibbon('home');
    renderExplorer();
    renderProperties();
    renderToolbox();
    renderTemplates($('#templateGrid'), 'templates');
    renderGroups();
    renderOutput();
    renderViewTabs();
    updateSyncChip();
    setStatus();
    const theme = (() => { try { return localStorage.getItem('rsa:theme'); } catch (e) { return null; } })();
    if (theme) setTheme(theme);
    if (!global.Config.oauth.clientId && !global.Config.openCloud.apiKey) setTimeout(() => toast('Tip: add your Roblox credentials in Settings ⚙ → Credentials', 'info', 7000), 1400);
  }

  global.UI = {
    boot, toast, refresh, renderExplorer, renderProperties, renderOutput, renderToolbox, renderGroups,
    renderTemplates, renderStart, showStart, hideStart, openPanel, toggleDock, dialog, openSettings,
    openGameSettings, publishNow, signIn, signOut, refreshAccount, updateSyncChip, runCommand,
    openScript, runCurrent, setStatus, action, applyTemplate, download, openFile, quickAI, runAI,
    setTheme, focusAI, toastCount: () => 0
  };
})(typeof window !== 'undefined' ? window : globalThis);

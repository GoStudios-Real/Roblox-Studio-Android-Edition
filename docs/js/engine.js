/* ============================================================
   Engine — instance tree, 3D viewport, tools, play runtime,
   rbxlx import/export, toolbox assets, group games, output.
   ============================================================ */
(function (global) {
  'use strict';

  const T = () => global.Templates;
  let uidCounter = 1;
  const uid = () => 'I' + (uidCounter++) + '_' + Math.random().toString(36).slice(2, 7);

  /* ---------------- Instance model ---------------- */
  const DEFAULT_PROPS = {
    Part: () => ({ Size: [4, 1, 4], Position: [0, 0, 0], Orientation: [0, 0, 0], Color: '#9aa0a8', Material: 'Plastic', Anchored: true, CanCollide: true, Transparency: 0, Reflectance: 0, Shape: 'Block' }),
    SpawnLocation: () => Object.assign(DEFAULT_PROPS.Part(), { Color: '#f2f4f7', Material: 'SmoothPlastic', Neutral: true, Duration: 0 }),
    WedgePart: () => Object.assign(DEFAULT_PROPS.Part(), { Shape: 'Wedge' }),
    CornerWedgePart: () => Object.assign(DEFAULT_PROPS.Part(), { Shape: 'CornerWedge' }),
    TrussPart: () => Object.assign(DEFAULT_PROPS.Part(), { Shape: 'Truss' }),
    Seat: () => Object.assign(DEFAULT_PROPS.Part(), { Color: '#9c6b3f', Shape: 'Block' }),
    Model: () => ({}),
    Folder: () => ({}),
    Script: () => ({ Source: '-- Roblox Luau script\nprint("Hello from Roblox Studio Android Edition")', Disabled: false, RunContext: 'Legacy' }),
    LocalScript: () => ({ Source: '-- LocalScript (runs on each player)\nprint("client ready")', Disabled: false }),
    ModuleScript: () => ({ Source: '-- ModuleScript\nlocal M = {}\nfunction M.hello() return "hi" end\nreturn M', Disabled: false }),
    PointLight: () => ({ Brightness: 1, Range: 16, Color: '#fff2c9', Shadows: true }),
    SpotLight: () => Object.assign(DEFAULT_PROPS.PointLight(), { Angle: 90 }),
    Fire: () => ({ Size: 5, Heat: 8, Color: '#ff7a2f', SecondaryColor: '#ffdd55' }),
    Smoke: () => ({ Opacity: 0.5, RiseVelocity: 3, Color: '#cfcfcf' }),
    ParticleEmitter: () => ({ Rate: 20, Lifetime: 2, Speed: 5, Color: '#ffd166', Size: 1 }),
    Decal: () => ({ Texture: '', Color: '#ffffff', Transparency: 0, Face: 'Front' }),
    Sound: () => ({ SoundId: '', Volume: 0.5, Looped: false, Playing: false }),
    ClickDetector: () => ({ MaxActivationDistance: 32 }),
    ProximityPrompt: () => ({ ActionText: 'Interact', ObjectText: '', HoldDuration: 0, MaxActivationDistance: 10 }),
    DistanceConstraint: () => ({ Length: 10, Stiffness: 1 }),
    HingeConstraint: () => ({ ActuatorType: 'Motor', MotorMaxTorque: 1000, AngularVelocity: 1 }),
    RopeConstraint: () => ({ Length: 10, Color: '#dddddd' }),
    WeldConstraint: () => ({}),
    VectorForce: () => ({ Force: [0, 100, 0], RelativeTo: 'World' }),
    BodyPosition: () => ({ Position: [0, 0, 0], MaxForce: 10000, D: 500, P: 10000 }),
    BodyVelocity: () => ({ Velocity: [0, 0, 0], MaxForce: 10000, P: 10000 }),
    CylinderPart: () => Object.assign(DEFAULT_PROPS.Part(), { Shape: 'Cylinder' }),
    Ball: () => Object.assign(DEFAULT_PROPS.Part(), { Shape: 'Ball' }),
    ScreenGui: () => ({ Enabled: true, ResetOnSpawn: true, DisplayOrder: 0, IgnoreGuiInset: false }),
    SurfaceGui: () => ({ Face: 'Front', Enabled: true, CanvasSize: [800, 600] }),
    Frame: () => ({ Size: [0.3, 0.2], Position: [0.1, 0.1], BackgroundColor: '#00a2ff', BackgroundTransparency: 0, AnchorPoint: [0, 0], ZIndex: 1, Visible: true, UICornerRadius: 14 }),
    TextLabel: () => ({ Size: [0.2, 0.06], Position: [0.05, 0.05], Text: 'Label', TextColor: '#ffffff', TextSize: 18, BackgroundColor: '#000000', BackgroundTransparency: 1, Font: 'GothamBold', Visible: true }),
    TextButton: () => ({ Size: [0.16, 0.07], Position: [0.05, 0.8], Text: 'Button', TextColor: '#00121f', TextSize: 18, BackgroundColor: '#00a2ff', BackgroundTransparency: 0, Font: 'GothamBold', Visible: true, UICornerRadius: 20 }),
    ImageLabel: () => ({ Size: [0.2, 0.2], Position: [0.4, 0.3], Image: '', BackgroundTransparency: 1, Visible: true }),
    UIPadding: () => ({ PaddingTop: 8, PaddingBottom: 8, PaddingLeft: 8, PaddingRight: 8 }),
    UIListLayout: () => ({ Padding: 6, FillDirection: 'Vertical', HorizontalAlignment: 'Left' }),
    UICorner: () => ({ CornerRadius: 14 }),
    UIClickDetector: () => ({}),
    Atmosphere: () => ({ Density: 0.3, Offset: 0.25, Color: '#c4e0ff', Decay: '#4f6b8a', Glare: 0, Haze: 1 }),
    BloomEffect: () => ({ Intensity: 0.6, Size: 24, Threshold: 1.4 }),
    ColorCorrectionEffect: () => ({ Brightness: 0, Contrast: 0, Saturation: 0, TintColor: '#ffffff' }),
    DepthOfFieldEffect: () => ({ FarIntensity: 0, FocusDistance: 10, InFocusRadius: 50, NearIntensity: 0 }),
    Sky: () => ({ SkyboxBk: '', SkyboxDn: '', SkyboxFt: '', SkyboxLf: '', SkyboxRt: '', SkyboxUp: '', StarCount: 3000, SunAngularSize: 21 }),
    Terrain: () => ({ Material: 'Grass', GridSize: 4 }),
    Camera: () => ({ FieldOfView: 70, CFrame: [0, 15, 30] }),
    WorldMarker: () => ({})
  };

  function makeInstance(class_name, name, opts) {
    const factory = DEFAULT_PROPS[class_name] || (() => ({}));
    const node = {
      id: uid(),
      class: class_name,
      name: name || class_name,
      children: [],
      parent: null,
      props: Object.assign({}, factory(), opts && opts.props ? opts.props : {})
    };
    if (opts) Object.assign(node.props, pickNonChildren(opts));
    if (opts && opts.children) opts.children.forEach((c) => attach(c, node));
    return node;
  }
  function pickNonChildren(o) {
    const out = {};
    for (const k in o) if (!['children', 'class', 'name', 'props', 'parent', 'id', 'source'].includes(k)) out[k] = o[k];
    if (o.source !== undefined) out.Source = o.source;
    if (o.props) Object.assign(out, {});
    return out;
  }
  function attach(childSpec, parent) {
    const c = normalize(childSpec);
    c.parent = parent;
    parent.children.push(c);
    return c;
  }
  function normalize(spec) {
    if (spec.parent) return spec;
    const n = makeInstance(spec.class, spec.name, spec);
    if (spec.stage !== undefined) n.props.Stage = spec.stage;
    if (spec.tag) n.props.Tag = spec.tag;
    if (spec.value !== undefined) n.props.Value = spec.value;
    if (spec.rank !== undefined) n.props.Rank = spec.rank;
    if (spec.cost !== undefined) n.props.Cost = spec.cost;
    if (spec.light !== undefined) n.props.Brightness = spec.light;
    if (spec.velocity !== undefined) n.props.VelocityX = spec.velocity;
    return n;
  }
  function insert(spec, parent) { return attach(spec, parent || state.services.Workspace); }
  function walk(node, fn, depth) {
    fn(node, depth || 0);
    (node.children || []).forEach((c) => walk(c, fn, (depth || 0) + 1));
  }
  function findById(id, root) {
    let found = null;
    walk(root || state.place, (n) => { if (!found && n.id === id) found = n; });
    return found;
  }
  function findByName(name, root) {
    let found = null;
    walk(root || state.place, (n) => { if (!found && n.name === name) found = n; });
    return found;
  }
  function removeNode(node) {
    if (!node || !node.parent) return;
    const i = node.parent.children.indexOf(node);
    if (i >= 0) node.parent.children.splice(i, 1);
    node.parent = null;
  }

  /* ---------------- Services / place ---------------- */
  const SERVICE_ORDER = ['Workspace', 'Players', 'Lighting', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 'StarterGui', 'StarterPlayer', 'SoundService', 'Chat'];
  function buildPlace() {
    const place = { id: uid(), class: 'DataModel', name: 'Place', children: [], parent: null, props: { Name: 'Place' } };
    SERVICE_ORDER.forEach((s) => {
      const svc = makeInstance(s, s, {});
      svc.isService = true;
      attach(svc, place);
    });
    return place;
  }

  /* ---------------- State ---------------- */
  const state = {
    place: null,
    services: {},
    selection: [],
    tool: 'select',
    snap: 0,
    snapY: false,
    showGrid: true,
    mode: 'edit',           // edit | play
    camera: { yaw: 0.6, pitch: 0.45, dist: 55, target: [0, 6, 0] },
    dirty: false,
    recent: [],
    output: [],
    groups: [],
    groupGames: [],
    activeDoc: 'place',
    keys: {},
    joy: [0, 0],
    undoStack: [],
    redoStack: []
  };

  const listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, arg) { (listeners[evt] || []).forEach((f) => { try { f(arg); } catch (e) { console.error(e); } }); }

  /* Serialising the instance tree: nodes carry a `parent` back-reference,
     so plain JSON.stringify would hit a circular structure. */
  function jsonReplacer(k, v) { return k === 'parent' ? undefined : v; }
  function stringifyTree(o) { return JSON.stringify(o, jsonReplacer); }
  function relink(node, parent) {
    if (!node) return;
    node.parent = parent;
    (node.children || []).forEach((c) => relink(c, node));
  }

  function reindexServices() {
    state.services = {};
    state.place.children.forEach((s) => { state.services[s.name] = s; });
  }

  /* ---------------- Output ---------------- */
  function log(level, msg, extra) {
    const entry = { level, msg: String(msg), time: new Date(), extra: extra || '' };
    state.output.push(entry);
    if (state.output.length > 600) state.output.shift();
    emit('output', entry);
  }

  /* ---------------- Undo ---------------- */
  function snapshot() { return stringifyTree({ place: state.place, sel: state.selection.map((s) => s.id) }); }
  function pushUndo() {
    state.undoStack.push(snapshot());
    if (state.undoStack.length > 60) state.undoStack.shift();
    state.redoStack.length = 0;
    state.dirty = true;
    emit('change');
  }
  function applySnapshot(json) {
    const d = JSON.parse(json);
    state.place = d.place;
    relink(state.place, null);
    state.selection = (d.sel || []).map((id) => findById(id)).filter(Boolean);
    reindexServices();
    emit('change');
    emit('selection');
  }
  function undo() {
    if (!state.undoStack.length) return log('warn', 'Nothing to undo');
    state.redoStack.push(snapshot());
    applySnapshot(state.undoStack.pop());
    log('info', 'Undo');
  }
  function redo() {
    if (!state.redoStack.length) return log('warn', 'Nothing to redo');
    state.undoStack.push(snapshot());
    applySnapshot(state.redoStack.pop());
    log('info', 'Redo');
  }

  /* ---------------- Selection ---------------- */
  function select(ids, additive) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!additive) state.selection = [];
    list.forEach((id) => {
      const node = typeof id === 'string' ? findById(id) : id;
      if (node && !state.selection.includes(node)) state.selection.push(node);
    });
    emit('selection');
    emit('status');
  }
  function clearSelection() { state.selection = []; emit('selection'); emit('status'); }
  function selected() { return state.selection; }
  function primary() { return state.selection[0] || null; }

  /* ---------------- Edit operations ---------------- */
  function deleteSelection() {
    if (!state.selection.length) return;
    pushUndo();
    state.selection.forEach((n) => { if (n && n.parent && !n.isService) removeNode(n); });
    log('info', 'Deleted ' + state.selection.length + ' instance(s)');
    clearSelection();
    emit('change');
  }
  function duplicateSelection() {
    if (!state.selection.length) return;
    pushUndo();
    const created = [];
    state.selection.forEach((n) => {
      const copy = JSON.parse(stringifyTree(n));
      const reid = (x) => { x.id = uid(); x.children.forEach(reid); };
      reid(copy);
        if (n.parent) { relink(copy, n.parent); copy.props.Position = (copy.props.Position || [0, 0, 0]).map((v, i) => v + (i === 0 ? 4 : i === 2 ? 4 : 0)); n.parent.children.push(copy); created.push(copy.id); }
    });
    log('info', 'Duplicated ' + created.length + ' instance(s)');
    select(created);
    emit('change');
  }
  function insertPart(kind) {
    pushUndo();
    const spec = { class: kind || 'Part', name: kind || 'Part' };
    const node = insert(spec);
    if (node.props.Position) node.props.Position = [0, Math.max(2, (state.selection[0] && state.selection[0].props.Position ? state.selection[0].props.Position[1] : 0) + 4), 0];
    log('info', 'Inserted ' + node.class + ' into Workspace');
    select([node.id]);
    emit('change');
    return node;
  }
  function setProp(node, key, value) {
    if (!node) return;
    node.props[key] = value;
    state.dirty = true;
    emit('change');
    emit('props');
  }
  function rename(node, name) { if (node) { node.name = name; emit('change'); emit('explorer'); } }

  /* ---------------- Templates ---------------- */
  function loadTemplate(id) {
    const t = T().get(id);
    if (!t) return log('err', 'Unknown template ' + id);
    newPlace(false);
    t.build().forEach((spec) => insert(spec));
    state.dirty = false;
    log('sys', 'Loaded template: ' + t.name);
    emit('change');
    emit('explorer');
    return t;
  }
  function newPlace(withTemplate) {
    state.place = buildPlace();
    reindexServices();
    state.selection = [];
    state.undoStack = [];
    state.redoStack = [];
    state.dirty = false;
    if (withTemplate !== false) insert({ class: 'Part', name: 'Baseplate', props: { Size: [512, 20, 512], Position: [0, -10, 0], Color: '#8d8d8d', Material: 'Slate' } });
    spawnPoint();
    emit('change');
    emit('explorer');
    emit('selection');
  }
  function spawnPoint() {
    insert({ class: 'SpawnLocation', name: 'SpawnLocation', props: { Size: [6, 1, 6], Position: [0, 1, 0], Color: '#f2f4f7' } });
  }

  /* ---------------- rbxlx export / import ---------------- */
  const MATERIAL_TOKENS = { Plastic: 256, SmoothPlastic: 272, Neon: 288, Wood: 512, WoodPlanks: 528, Marble: 784, Slate: 800, Concrete: 816, Granite: 832, Brick: 848, Pebble: 864, Cobblestone: 880, Metal: 1088, DiamondPlate: 1056, Foil: 1072, Grass: 1280, Sand: 1296, Fabric: 1312, Ice: 1536, Glass: 1568, ForceField: 1584, Asphalt: 1040, Ground: 1328 };
    const MATERIAL_BY_TOKEN = (() => { const o = {}; for (const k in MATERIAL_TOKENS) o[MATERIAL_TOKENS[k]] = k; return o; })();

  function colorToInt(hex) {
    const h = (hex || '#9aa0a8').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return ((r << 16) | (g << 8) | b) >>> 0;
  }
  function intToColor(v) { return '#' + (v >>> 0).toString(16).padStart(6, '0').slice(-6); }

  function rotMatrix(deg) {
    const d = Math.PI / 180;
    const rx = deg[0] * d, ry = deg[1] * d, rz = deg[2] * d;
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    // R = Ry * Rx * Rz
    const m = [
      cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
      cx * sz, cx * cz, -sx,
      -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx
    ];
    return m;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function f(n) { const v = Number(n); return Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : '0'; }

  function xmlFor(node, ref) {
    const cls = node.class;
    const p = node.props || {};
    const lines = [];
    const put = (s) => lines.push(s);
    put('<Item class="' + esc(cls) + '" referent="' + ref + '">');
    put('<Properties>');
    put('<string name="Name">' + esc(node.name || cls) + '</string>');

    const isPart = ['Part', 'SpawnLocation', 'Seat', 'WedgePart', 'CornerWedgePart', 'TrussPart', 'MeshPart', 'UnionOperation', 'Terrain'].includes(cls);
    if (isPart && p.Size) {
      put('<Vector3 name="size"><X>' + f(p.Size[0]) + '</X><Y>' + f(p.Size[1]) + '</Y><Z>' + f(p.Size[2]) + '</Z></Vector3>');
      const pos = p.Position || [0, 0, 0], rot = p.Orientation || [0, 0, 0];
      const m = rotMatrix(rot);
      put('<CoordinateFrame name="CFrame">' +
        '<X>' + f(pos[0]) + '</X><Y>' + f(pos[1]) + '</Y><Z>' + f(pos[2]) + '</Z>' +
        '<R00>' + f(m[0]) + '</R00><R01>' + f(m[1]) + '</R01><R02>' + f(m[2]) + '</R02>' +
        '<R10>' + f(m[3]) + '</R10><R11>' + f(m[4]) + '</R11><R12>' + f(m[5]) + '</R12>' +
        '<R20>' + f(m[6]) + '</R20><R21>' + f(m[7]) + '</R21><R22>' + f(m[8]) + '</R22>' +
        '</CoordinateFrame>');
      put('<Color3uint8 name="Color3uint8">' + colorToInt(p.Color) + '</Color3uint8>');
      put('<bool name="Anchored">' + (p.Anchored !== false) + '</bool>');
      put('<bool name="CanCollide">' + (p.CanCollide !== false) + '</bool>');
      put('<float name="Transparency">' + f(p.Transparency || 0) + '</float>');
      put('<float name="Reflectance">' + f(p.Reflectance || 0) + '</float>');
      put('<token name="Material">' + (MATERIAL_TOKENS[p.Material] || 256) + '</token>');
      const shapeTok = { Block: 0, Ball: 1, Cylinder: 2, Wedge: 3, CornerWedge: 4, Truss: 5 }[p.Shape];
      if (shapeTok !== undefined && cls === 'Part') put('<token name="shape">' + shapeTok + '</token>');
      if (cls === 'SpawnLocation') { put('<bool name="Neutral">true</bool>'); put('<float name="Duration">0</float>'); }
    }
    if (['Script', 'LocalScript', 'ModuleScript'].includes(cls)) {
      put('<ProtectedString name="Source"><![CDATA[' + (p.Source || '') + ']]></ProtectedString>');
      put('<bool name="Disabled">' + (p.Disabled === true) + '</bool>');
      put('<token name="RunContext">' + ({ Legacy: 1, Server: 2, Client: 3, Plugin: 4 }[p.RunContext] || 1) + '</token>');
    }
    if (['Frame', 'TextLabel', 'TextButton', 'ImageLabel'].includes(cls)) {
      const sz = p.Size || [0.2, 0.2], ps = p.Position || [0, 0];
      put('<UDim2 name="size"><XS>' + f(sz[0]) + '</XS><YS>' + f(sz[1]) + '</YS><XOffset>0</XOffset><YOffset>0</YOffset></UDim2>');
      put('<UDim2 name="position"><XS>' + f(ps[0]) + '</XS><YS>' + f(ps[1]) + '</YS><XOffset>0</XOffset><YOffset>0</YOffset></UDim2>');
      put('<Color3 name="BackgroundColor3"><R>' + ((parseInt((p.BackgroundColor || '#000000').slice(1, 3), 16) || 0) / 255) + '</R><G>' + ((parseInt((p.BackgroundColor || '#000000').slice(3, 5), 16) || 0) / 255) + '</G><B>' + ((parseInt((p.BackgroundColor || '#000000').slice(5, 7), 16) || 0) / 255) + '</B></Color3>');
      put('<float name="BackgroundTransparency">' + f(p.BackgroundTransparency || 0) + '</float>');
      put('<bool name="Visible">' + (p.Visible !== false) + '</bool>');
      if (p.Text !== undefined) { put('<string name="Text">' + esc(p.Text) + '</string>'); put('<int name="TextSize">' + Math.round(p.TextSize || 14) + '</int>'); }
      if (p.TextColor) {
        const hex = p.TextColor;
        put('<Color3 name="TextColor3"><R>' + ((parseInt(hex.slice(1, 3), 16) || 255) / 255) + '</R><G>' + ((parseInt(hex.slice(3, 5), 16) || 255) / 255) + '</G><B>' + ((parseInt(hex.slice(5, 7), 16) || 255) / 255) + '</B></Color3>');
      }
    }
    if (cls === 'PointLight' || cls === 'SpotLight') {
      put('<float name="Brightness">' + f(p.Brightness || 1) + '</float>');
      put('<float name="Range">' + f(p.Range || 16) + '</float>');
    }
    put('</Properties>');
    (node.children || []).forEach((c, i) => { lines.push(xmlFor(c, ref + '_' + i)); });
    put('</Item>');
    return lines.join('\n');
  }

  function toXML() {
    const head = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n' +
      '<Meta name="ExplicitAutoJoints">true</Meta>\n<External>null</External>\n';
    const body = state.place.children.map((c, i) => xmlFor(c, 'RBX' + i)).join('\n');
    return head + body + '\n</roblox>\n';
  }

  function propOf(item, name) {
    const els = item.getElementsByTagName('*');
    for (let i = 0; i < els.length; i++) if (els[i].getAttribute && els[i].getAttribute('name') === name && els[i].parentNode === item.querySelector('Properties')) return els[i];
    return null;
  }
  function textOf(el) { return el ? el.textContent : null; }

  function fromXML(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XML place file');
    const root = doc.documentElement;
    const place = buildPlace();
    reindexServicesOf(place);

    const importItem = (item, parent) => {
      const cls = item.getAttribute('class');
      const nameEl = Array.from(item.children).find((c) => c.tagName === 'Properties');
      let name = cls;
      const props = {};
      if (nameEl) {
        Array.from(nameEl.children).forEach((p) => {
          const pn = p.getAttribute('name');
          const tag = p.tagName;
          if (pn === 'Name') name = p.textContent;
          else if (tag === 'Vector3') props[rect(p)] = [num(p, 'X'), num(p, 'Y'), num(p, 'Z')];
          else if (tag === 'CoordinateFrame') {
            props.Position = [num(p, 'X'), num(p, 'Y'), num(p, 'Z')];
            const m = [num(p, 'R00'), num(p, 'R01'), num(p, 'R02'), num(p, 'R10'), num(p, 'R11'), num(p, 'R12'), num(p, 'R20'), num(p, 'R21'), num(p, 'R22')];
            props.Orientation = matrixToEuler(m);
          } else if (tag === 'Color3uint8') props.Color = intToColor(parseInt(p.textContent, 10));
          else if (tag === 'bool') props[pn] = p.textContent === 'true';
          else if (tag === 'float' || tag === 'int' || tag === 'token') {
            const v = parseFloat(p.textContent);
            if (pn === 'Material') props.Material = MATERIAL_BY_TOKEN[v] || 'Plastic';
            else if (pn === 'shape') props.Shape = { 0: 'Block', 1: 'Ball', 2: 'Cylinder', 3: 'Wedge', 4: 'CornerWedge', 5: 'Truss' }[v] || 'Block';
            else props[pn] = isNaN(v) ? p.textContent : v;
          } else if (tag === 'ProtectedString') props.Source = p.textContent;
          else if (tag === 'string') props[pn] = p.textContent;
          else if (tag === 'UDim2') { props[pn === 'size' ? 'Size' : 'Position'] = [num(p, 'XS'), num(p, 'YS')]; }
          else if (tag === 'Color3') props[pn.replace('Background', 'Background').replace('Color3', '')] = rgbToHex(p);
        });
      }
      const node = makeInstance(cls, name, { props: {} });
      Object.assign(node.props, props);
      if (cls === 'Part' && !node.props.Size) node.props.Size = [4, 1, 4];
      if (node.props.size && !node.props.Size) { node.props.Size = node.props.size; delete node.props.size; }
      if (parent) attach(node, parent);
      Array.from(item.children).filter((c) => c.tagName === 'Item').forEach((c) => importItem(c, node));
      return node;
    };
    function rect(p) { return p.getAttribute('name') === 'size' ? 'Size' : p.getAttribute('name'); }
    function num(p, k) { const el = Array.from(p.children).find((c) => c.tagName === k); return el ? parseFloat(el.textContent) || 0 : 0; }
    function rgbToHex(p) { const g = (k) => { const el = Array.from(p.children).find((c) => c.tagName === k); return el ? Math.round(parseFloat(el.textContent) * 255) : 0; };
      return '#' + [g('R'), g('G'), g('B')].map((v) => v.toString(16).padStart(2, '0')).join(''); }

    Array.from(root.children).filter((c) => c.tagName === 'Item').forEach((item) => {
      const cls = item.getAttribute('class');
      const existing = state.services[cls] || place.children.find((s) => s.name === cls);
      if (existing) {
        Array.from(item.children).filter((c) => c.tagName === 'Item').forEach((c) => importItem(c, existing));
      } else {
        const node = importItem(item, null);
        node.isService = true;
        attach(node, place);
      }
    });
    state.place = place;
    reindexServices();
    state.selection = [];
    state.undoStack = [];
    emit('change');
    emit('explorer');
    return true;
  }
  function matrixToEuler(m) {
    const sy = -m[6];
    const y = Math.asin(Math.max(-1, Math.min(1, sy)));
    let x, z;
    if (Math.abs(sy) < 0.9999) { x = Math.atan2(m[7], m[8]); z = Math.atan2(m[3], m[0]); }
    else { x = Math.atan2(-m[5], m[4]); z = 0; }
    const d = 180 / Math.PI;
    return [x * d, y * d, z * d];
  }
  function reindexServicesOf(place) {
    state.services = {};
    place.children.forEach((s) => { state.services[s.name] = s; });
  }

  function toJSON() {
    return JSON.stringify({ v: 1, name: (state.place.props && state.place.props.Name) || 'Place', place: state.place }, jsonReplacer, 1);
  }
  function fromJSON(text) {
    const d = JSON.parse(text);
    state.place = d.place || buildPlace();
    relink(state.place, null);
    reindexServices();
    state.selection = [];
    emit('change');
    emit('explorer');
  }

  /* ---------------- Toolbox library ---------------- */
  const TOOLBOX = [
    { name: 'Baseplate', cat: 'Basics', icon: '⬜', make: () => [{ class: 'Part', name: 'Baseplate', props: { Size: [512, 20, 512], Position: [0, -10, 0], Color: '#8d8d8d', Material: 'Slate' } }] },
    { name: 'Part', cat: 'Basics', icon: '🧱', make: () => [{ class: 'Part', name: 'Part', props: { Position: [0, 3, 0] } }] },
    { name: 'Spawn Location', cat: 'Basics', icon: '🚩', make: () => [{ class: 'SpawnLocation', name: 'SpawnLocation', props: { Position: [0, 1, 0], Size: [6, 1, 6] } }] },
    { name: 'Sphere', cat: 'Basics', icon: '⚪', make: () => [{ class: 'Part', name: 'Ball', props: { Shape: 'Ball', Position: [0, 4, 0], Size: [4, 4, 4], Color: '#2f7ce0' } }] },
    { name: 'Wedge', cat: 'Basics', icon: '📐', make: () => [{ class: 'WedgePart', name: 'Wedge', props: { Position: [0, 2, 0], Size: [4, 4, 4], color: '#9aa0a8' } }] },
    { name: 'Truss', cat: 'Basics', icon: '🪜', make: () => [{ class: 'TrussPart', name: 'Truss', props: { Position: [0, 2, 0], Size: [2, 2, 2] } }] },
    { name: 'Seat', cat: 'Basics', icon: '🪑', make: () => [{ class: 'Seat', name: 'Seat', props: { Position: [0, 2, 0], Size: [4, 1, 4] } }] },
    { name: 'Door', cat: 'Buildings', icon: '🚪', make: () => [{ class: 'Part', name: 'Door', props: { Size: [5, 8, 0.6], Position: [0, 4, 0], Color: '#9c6b3f', Material: 'Wood' } }, { class: 'Script', name: 'DoorScript', source: global.AI ? global.AI.SCRIPTS.door : '' }] },
    { name: 'House', cat: 'Buildings', icon: '🏠', make: () => (global.AI ? global.AI.BUILDERS.house() : []) },
    { name: 'Tower', cat: 'Buildings', icon: '🗼', make: () => (global.AI ? global.AI.BUILDERS.tower(10) : []) },
    { name: 'Tree', cat: 'Nature', icon: '🌳', make: () => [{ class: 'Part', name: 'Trunk', props: { Size: [2, 8, 2], Position: [0, 4, 0], Color: '#9c6b3f', Material: 'Wood' } }, { class: 'Part', name: 'Leaves', props: { Size: [9, 7, 9], Position: [0, 11, 0], Color: '#2f7d3a', Material: 'Grass', CanCollide: false } }] },
    { name: 'Forest', cat: 'Nature', icon: '🌲', make: () => (global.AI ? global.AI.BUILDERS.forest(8) : []) },
    { name: 'Rock', cat: 'Nature', icon: '🪨', make: () => [{ class: 'Part', name: 'Rock', props: { Size: [4, 3, 5], Position: [0, 1.5, 0], Shape: 'Ball', Color: '#7d7d7d', Material: 'Slate' } }] },
    { name: 'Lava Kill Brick', cat: 'Gameplay', icon: '🔥', make: () => [{ class: 'Part', name: 'Lava', props: { Size: [12, 1, 12], Position: [0, 1, 0], Color: '#ff5a1f', Material: 'Neon', Tag: 'Kill' } }] },
    { name: 'Checkpoint', cat: 'Gameplay', icon: '🚩', make: () => [{ class: 'Part', name: 'Checkpoint', props: { Size: [7, 1, 7], Position: [0, 1, 0], Color: '#ffcb3d', Material: 'Neon', Stage: 1, Tag: 'Checkpoint' } }] },
    { name: 'Coin', cat: 'Gameplay', icon: '🪙', make: () => [{ class: 'Part', name: 'Coin', props: { Size: [2, 2, 0.4], Position: [0, 3, 0], Shape: 'Cylinder', Color: '#ffcb3d', Material: 'Neon', Value: 5, CanCollide: false, Tag: 'Coin' } }] },
    { name: 'Win Pad', cat: 'Gameplay', icon: '🏆', make: () => [{ class: 'Part', name: 'WinPad', props: { Size: [8, 1, 8], Position: [0, 1, 0], Color: '#ffcb3d', Material: 'Neon', Tag: 'Win' } }] },
    { name: 'Leaderboard Script', cat: 'Scripts', icon: '📜', make: () => [{ class: 'Folder', name: 'Server', children: [{ class: 'Script', name: 'Leaderstats', source: global.Templates.helpers.LEADERSTATS }] }] },
    { name: 'Touch Handler', cat: 'Scripts', icon: '📜', make: () => [{ class: 'Script', name: 'TouchHandler', source: global.AI ? global.AI.SCRIPTS.touch : '' }] },
    { name: 'Day/Night Cycle', cat: 'Scripts', icon: '🌙', make: () => [{ class: 'Script', name: 'DayNight', source: global.AI ? global.AI.SCRIPTS.daynight : '' }] },
    { name: 'DataStore Save', cat: 'Scripts', icon: '💾', make: () => [{ class: 'Script', name: 'SaveData', source: global.AI ? global.AI.SCRIPTS.datastore : '' }] },
    { name: 'Coin Ring', cat: 'Models', icon: '🪙', make: () => (global.AI ? global.AI.BUILDERS.coins(12) : []) },
    { name: 'Combat Arena', cat: 'Models', icon: '⚔️', make: () => (global.AI ? global.AI.BUILDERS.arena() : []) },
    { name: 'Shop Stand', cat: 'Models', icon: '🛒', make: () => (global.AI ? global.AI.BUILDERS.shop() : []) },
    { name: 'Zombie', cat: 'Models', icon: '🧟', make: () => (global.AI ? global.AI.BUILDERS.zombie() : []) },
    { name: 'Point Light', cat: 'Lights', icon: '💡', make: () => [{ class: 'PointLight', name: 'PointLight' }] },
    { name: 'Spot Light', cat: 'Lights', icon: '🔦', make: () => [{ class: 'SpotLight', name: 'SpotLight' }] },
    { name: 'Fire', cat: 'Effects', icon: '🔥', make: () => [{ class: 'Fire', name: 'Fire' }] },
    { name: 'Smoke', cat: 'Effects', icon: '💨', make: () => [{ class: 'Smoke', name: 'Smoke' }] },
    { name: 'Particles', cat: 'Effects', icon: '✨', make: () => [{ class: 'ParticleEmitter', name: 'ParticleEmitter' }] },
    { name: 'Screen GUI', cat: 'UI', icon: '🖥️', make: () => [{ class: 'ScreenGui', name: 'Hud', children: [{ class: 'Frame', name: 'Panel', props: { Size: [0.3, 0.2], Position: [0.05, 0.05] } }] }] },
    { name: 'Round Button', cat: 'UI', icon: '🔴', make: () => [{ class: 'TextButton', name: 'PlayButton', props: { Text: 'PLAY', UICornerRadius: 60 } }] },
    { name: 'Title Label', cat: 'UI', icon: '🏷️', make: () => [{ class: 'TextLabel', name: 'Title', props: { Text: 'My Game', TextSize: 32 } }] }
  ];

  function toolboxCategories() { return ['All'].concat(Array.from(new Set(TOOLBOX.map((a) => a.cat)))); }
  function toolboxSearch(q, cat) {
    const s = (q || '').toLowerCase();
    return TOOLBOX.filter((a) => (cat === 'All' || !cat || a.cat === cat) && (!s || a.name.toLowerCase().includes(s) || a.cat.toLowerCase().includes(s)));
  }
  function toolboxInsert(asset) {
    pushUndo();
    const specs = asset.make();
    const created = [];
    specs.forEach((sp) => { const n = insert(sp); created.push(n.id); walk(n, (x) => created.push(x.id)); });
    log('info', 'Inserted Toolbox asset: ' + asset.name);
    if (created.length) select([created[0]]);
    emit('change');
    emit('explorer');
  }

  /* ============================================================
     Viewport rendering (canvas 2D, painter's algorithm)
     ============================================================ */
  let canvas, ctx, dpr = 1, running = true, lastFrame = 0, fps = 60;
  const parts = [];

  function project(p, w, h) {
    const c = state.camera;
    const dx = p[0] - c.target[0], dy = p[1] - c.target[1], dz = p[2] - c.target[2];
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    let x = dx * cy - dz * sy;
    let z = dx * sy + dz * cy;
    let y = dy;
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const y2 = y * cp - z * sp;
    const z2 = y * sp + z * cp;
    const zz = z2 + c.dist;
    if (zz < 0.5) return null;
    const fov = Math.min(w, h) * 1.15;
    const s = fov / zz;
    return [w / 2 + x * s, h / 2 - y2 * s, zz, s];
  }

  const SHADE = (hex, k) => {
    const h = (hex || '#888888').replace('#', '');
    let r = parseInt(h.slice(0, 2), 16) || 128, g = parseInt(h.slice(2, 4), 16) || 128, b = parseInt(h.slice(4, 6), 16) || 128;
    r = Math.max(0, Math.min(255, Math.round(r * k)));
    g = Math.max(0, Math.min(255, Math.round(g * k)));
    b = Math.max(0, Math.min(255, Math.round(b * k)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };

  function nodeVisible(n) { return n.props.Transparency === undefined || n.props.Transparency < 1; }

  function collectParts() {
    parts.length = 0;
    walk(state.place, (n) => {
      if (!n.props || !n.props.Size) return;
      if (!nodeVisible(n) && !state.selection.includes(n)) return;
      parts.push(n);
    });
  }

  function drawGrid(w, h) {
    if (!state.showGrid) return;
    const step = 8, ext = 120;
    ctx.lineWidth = 1;
    for (let i = -ext; i <= ext; i += step) {
      const a = project([i, 0, -ext], w, h), b = project([i, 0, ext], w, h);
      const c = project([-ext, 0, i], w, h), d = project([ext, 0, i], w, h);
      ctx.strokeStyle = i === 0 ? 'rgba(0,162,255,.55)' : 'rgba(255,255,255,.07)';
      if (a && b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      ctx.strokeStyle = i === 0 ? 'rgba(255,95,87,.5)' : 'rgba(255,255,255,.07)';
      if (c && d) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    }
  }

  const FACE_INDEX = [
    [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]
  ];
  const FACE_SHADE = [1.0, 0.55, 0.72, 0.78, 0.88, 0.62];

  function cornersOf(n) {
    const p = n.props.Position || [0, 0, 0];
    const s = n.props.Size || [1, 1, 1];
    const m = rotMatrix(n.props.Orientation || [0, 0, 0]);
    const out = [];
    for (let i = 0; i < 8; i++) {
      const sx = (i & 1 ? 1 : -1) * s[0] / 2;
      const sy = (i & 2 ? 1 : -1) * s[1] / 2;
      const sz = (i & 4 ? 1 : -1) * s[2] / 2;
      out.push([
        p[0] + m[0] * sx + m[1] * sy + m[2] * sz,
        p[1] + m[3] * sx + m[4] * sy + m[5] * sz,
        p[2] + m[6] * sx + m[7] * sy + m[8] * sz
      ]);
    }
    return out;
  }

  const faceQueue = [];
  function render(ts) {
    if (!canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#111722'); g.addColorStop(0.55, '#0d1119'); g.addColorStop(1, '#0a0d13');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    drawGrid(w, h);

    collectParts();
    faceQueue.length = 0;
    for (const n of parts) {
      const cs = cornersOf(n);
      const pp = cs.map((c) => project(c, w, h));
      if (pp.some((v) => !v)) continue;
      const isSel = state.selection.includes(n);
      const alpha = n.props.Transparency !== undefined ? 1 - n.props.Transparency : 1;
      for (let fi = 0; fi < 6; fi++) {
        const idx = FACE_INDEX[fi];
        const poly = [pp[idx[0]], pp[idx[1]], pp[idx[2]], pp[idx[3]]];
        const depth = (poly[0][2] + poly[1][2] + poly[2][2] + poly[3][2]) / 4;
        faceQueue.push({ n, poly, depth, fi, isSel, alpha, corners: pp });
      }
    }
    faceQueue.sort((a, b) => b.depth - a.depth);

    let current = null;
    for (const f of faceQueue) {
      const base = f.n.props.Color || '#9aa0a8';
      ctx.beginPath();
      ctx.moveTo(f.poly[0][0], f.poly[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(f.poly[i][0], f.poly[i][1]);
      ctx.closePath();
      const mat = f.n.props.Material;
      let k = FACE_SHADE[f.fi];
      if (mat === 'Neon') k = Math.min(1.25, k + 0.35);
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = SHADE(base, k);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.stroke();
    }
    // selection outlines (draw after faces)
    const drawn = new Set();
    for (const f of faceQueue) {
      if (!f.isSel || drawn.has(f.n.id)) continue;
      drawn.add(f.n.id);
      const c = f.corners;
      ctx.strokeStyle = 'rgba(0,190,255,.95)';
      ctx.lineWidth = 2;
      const edges = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      edges.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(c[a][0], c[a][1]); ctx.lineTo(c[b][0], c[b][1]); ctx.stroke(); });
      drawGizmo(f.n, w, h);
    }
    drawAxis(w, h);
  }

  function drawGizmo(n, w, h) {
    const p = n.props.Position || [0, 0, 0];
    const origin = project(p, w, h);
    if (!origin) return;
    const m = rotMatrix(n.props.Orientation || [0, 0, 0]);
    const len = Math.max(...(n.props.Size || [4, 4, 4])) * 0.9 + 2;
    const axes = [
      { v: [m[0], m[3], m[6]], color: '#ff5f57', label: 'X' },
      { v: [m[1], m[4], m[7]], color: '#2ecc71', label: 'Y' },
      { v: [m[2], m[5], m[8]], color: '#4cc2ff', label: 'Z' }
    ];
    if (state.tool === 'select') return;
    axes.forEach((a) => {
      const end = project([p[0] + a.v[0] * len, p[1] + a.v[1] * len, p[2] + a.v[2] * len], w, h);
      if (!end) return;
      ctx.strokeStyle = a.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(origin[0], origin[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.arc(end[0], end[1], 5, 0, Math.PI * 2); ctx.fill();
      if (state.tool === 'rotate') {
        ctx.font = '11px sans-serif'; ctx.fillText(a.label, end[0] + 7, end[1] + 4);
      }
    });
    if (state.tool === 'rotate') {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(origin[0], origin[1], 26, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawAxis(w, h) {
    const host = document.getElementById('vpAxis');
    if (!host) return;
    const c = state.camera;
    const dirs = [[1, 0, 0, '#ff5f57', 'X'], [0, 1, 0, '#2ecc71', 'Y'], [0, 0, 1, '#4cc2ff', 'Z']];
    const cx = 37, cy = 37, R = 26;
    const cyw = Math.cos(c.yaw), syw = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const proj = (v) => {
      const x = v[0] * cyw - v[2] * syw;
      let z = v[0] * syw + v[2] * cyw;
      let y = v[1];
      const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
      return [cx + x * R, cy - y2 * R, z2];
    };
    const pts = dirs.map((d) => ({ p: proj(d), d })).sort((a, b) => a.p[2] - b.p[2]);
    let svg = '<svg width="74" height="74" viewBox="0 0 74 74" xmlns="http://www.w3.org/2000/svg">';
    svg += '<circle cx="37" cy="37" r="34" fill="rgba(12,15,20,.7)" stroke="rgba(255,255,255,.12)"/>';
    pts.forEach(({ p, d }) => {
      svg += '<line x1="37" y1="37" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="' + d[3] + '" stroke-width="2.4"/>';
      svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" fill="' + d[3] + '"/>';
      svg += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3.5).toFixed(1) + '" font-size="9" font-weight="700" text-anchor="middle" fill="#0b0e14">' + d[4] + '</text>';
    });
    svg += '</svg>';
    host.innerHTML = svg;
  }

  /* -------- picking & interaction -------- */
  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function pick(x, y) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const faces = [];
    for (const n of parts) {
      const pp = cornersOf(n).map((c) => project(c, w, h));
      if (pp.some((v) => !v)) continue;
      for (const idx of FACE_INDEX) {
        const poly = [pp[idx[0]], pp[idx[1]], pp[idx[2]], pp[idx[3]]];
        if (pointInPoly(x, y, poly)) { faces.push({ n, depth: (poly[0][2] + poly[1][2] + poly[2][2] + poly[3][2]) / 4 }); break; }
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    return faces.length ? faces[0].n : null;
  }

  function rayToGround(x, y) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const c = state.camera;
    // invert projection: build a ray through screen point and intersect y=0 plane
    const fov = Math.min(w, h) * 1.15;
    const ndx = (x - w / 2) / fov, ndy = -(y - h / 2) / fov;
    // camera space direction
    const dirCam = [ndx, ndy, 1];
    // rotate by pitch then yaw (inverse of project)
    const cp = Math.cos(-c.pitch), sp = Math.sin(-c.pitch);
    const y1 = dirCam[1] * cp - dirCam[2] * sp, z1 = dirCam[1] * sp + dirCam[2] * cp;
    const d = [dirCam[0], y1, z1];
    const cy = Math.cos(-c.yaw), sy = Math.sin(-c.yaw);
    const dxw = d[0] * cy - d[2] * sy, dzw = d[0] * sy + d[2] * cy;
    const origin = [c.target[0] - Math.sin(c.yaw) * c.dist, c.target[1] + Math.sin(c.pitch) * c.dist, c.target[2] - Math.cos(c.yaw) * c.dist];
    // camera position: target minus rotated dist vector — derive properly:
    const cp2 = Math.cos(c.pitch), sp2 = Math.sin(c.pitch);
    const rel = [0, c.dist * cp2, c.dist * sp2];
    const cy2 = Math.cos(c.yaw), sy2 = Math.sin(c.yaw);
    const camPos = [
      c.target[0] + (rel[0] * cy2 + rel[2] * sy2),
      c.target[1] + rel[1],
      c.target[2] + (-rel[0] * sy2 + rel[2] * cy2)
    ];
    const dir = [dxw, d[1], dzw];
    const t = dir[1] === 0 ? 0 : (0 - camPos[1]) / dir[1];
    if (t <= 0) return null;
    return [camPos[0] + dir[0] * t, 0, camPos[2] + dir[2] * t];
  }

  let pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, moved: false, button: 0, mode: null, start: null };
  let pinch = null;

  function setupInput(cv) {
    canvas = cv;
    ctx = cv.getContext('2d');
    const rect = () => cv.getBoundingClientRect();
    const local = (e) => { const r = rect(); return [e.clientX - r.left, e.clientY - r.top]; };

    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const [x, y] = local(e);
      pointer = { down: true, x, y, sx: x, sy: y, moved: false, button: e.button, mode: null, start: JSON.parse(JSON.stringify(state.camera)), part: null };
      if (e.button === 1 || e.shiftKey) { pointer.mode = 'pan'; return; }
      const hit = pick(x, y);
      if (hit) {
        pointer.part = hit;
        if (state.mode === 'play') { pointer.mode = 'orbit'; return; }
        if (state.tool === 'select') { pointer.mode = 'orbit'; select([hit.id], e.ctrlKey || e.metaKey); }
        else { pointer.mode = 'transform'; pointer.ground = rayToGround(x, y); pointer.orig = JSON.parse(JSON.stringify(hit.props)); select([hit.id]); }
      } else {
        pointer.mode = 'orbit';
        if (!e.ctrlKey && state.tool === 'select') clearSelection();
      }
    });

    cv.addEventListener('pointermove', (e) => {
      if (!pointer.down) return;
      const [x, y] = local(e);
      const dx = x - pointer.sx, dy = y - pointer.sy;
      if (Math.abs(x - pointer.x) + Math.abs(y - pointer.y) > 3) pointer.moved = true;
      pointer.x = x; pointer.y = y;
      if (pointer.mode === 'orbit') {
        state.camera.yaw = pointer.start.yaw - dx * 0.008;
        state.camera.pitch = Math.max(-1.3, Math.min(1.4, pointer.start.pitch + dy * 0.008));
      } else if (pointer.mode === 'pan') {
        const k = state.camera.dist * 0.0016;
        const cy = Math.cos(state.camera.yaw), sy = Math.sin(state.camera.yaw);
        state.camera.target[0] += (-dx * cy - 0) * k;
        state.camera.target[2] += (dx * sy) * k;
        state.camera.target[1] += dy * k;
      } else if (pointer.mode === 'transform') {
        const n = pointer.part;
        if (!n) return;
        pushUndoThrottled();
        if (state.tool === 'move') {
          const g = rayToGround(x, y);
          if (g && pointer.ground) {
            let d = [g[0] - pointer.ground[0], 0, g[2] - pointer.ground[2]];
            if (state.snapY) d = [0, -(g[2] - pointer.ground[2]), 0];
            let np = [pointer.orig.Position[0] + d[0], pointer.orig.Position[1] + (state.snapY ? -d[1] : 0), pointer.orig.Position[2] + d[2]];
            if (state.snap) np = np.map((v) => Math.round(v / state.snap) * state.snap);
            n.props.Position = np.map((v) => Math.round(v * 100) / 100);
          }
        } else if (state.tool === 'rotate') {
          const amt = dx * 0.6;
          let o = (pointer.orig.Orientation || [0, 0, 0]).slice();
          o[1] = o[1] + amt;
          if (state.snap) o[1] = Math.round(o[1] / state.snap) * state.snap;
          n.props.Orientation = o;
        } else if (state.tool === 'scale') {
          const f = 1 + dx * 0.006;
          n.props.Size = (pointer.orig.Size || [4, 1, 4]).map((v) => Math.max(0.2, Math.round(v * f * 100) / 100));
        }
        emit('props');
        emit('change');
      }
    });

    const endPointer = () => { pointer.down = false; pointer.mode = null; state.dirty = true; emit('change'); };
    cv.addEventListener('pointerup', endPointer);
    cv.addEventListener('pointercancel', endPointer);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.camera.dist = Math.max(6, Math.min(600, state.camera.dist * (1 + Math.sign(e.deltaY) * 0.12)));
    }, { passive: false });

    // touch pinch zoom
    cv.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch) state.camera.dist = Math.max(6, Math.min(600, pinch * (pinchDist / d)));
        pinchDist = d; pinch = state.camera.dist;
      }
    }, { passive: true });
    let pinchDist = 0;
    cv.addEventListener('touchend', () => { pinch = null; });
  }

  let lastUndo = 0;
  function pushUndoThrottled() {
    const now = Date.now();
    if (now - lastUndo > 700) { pushUndo(); lastUndo = now; }
  }

  function frameSelection() {
    const sel = selected();
    const list = sel.length ? sel : parts.slice(0, 1);
    if (!list.length) return;
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    list.forEach((n) => {
      const c = cornersOf(n);
      c.forEach((p) => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); } });
    });
    state.camera.target = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
    const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    state.camera.dist = Math.max(10, size * 2.4);
    log('info', 'Framed ' + list.length + ' instance(s)');
  }

  /* ============================================================
     Play runtime — Roblox-like environment for the Lua VM
     ============================================================ */
  const play = {
    running: false,
    char: null,
    velocity: [0, 0, 0],
    onGround: false,
    keys: {},
    joy: [0, 0],
    t0: 0,
    time: 0,
    events: [],
    tasks: [],
    stats: { coins: 0, stage: 0, fps: 0 }
  };

  function makeEvent(name) {
    const handlers = [];
    const host = {
      __event: name,
      _handlers: handlers,
      Connect(fn) {
        handlers.push(fn);
        return wrap({ Disconnect() { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); }, Connected: true });
      },
      Once(fn) { const c = host.Connect((...a) => { c && c.Disconnect && c.Disconnect(); fn(...a); }); return c; },
      Fire(...args) { handlers.slice().forEach((h) => { try { runLuaCallback(h, args); } catch (e) { log('err', '[' + name + '] ' + (e && e.message ? e.message : e)); } }); },
      Wait() { return null; }
    };
    return wrap(host);
  }

  let hostCache = new WeakMap();

  function wrap(host, metaFields) {
    const t = new Lua.Table(host);
    if (metaFields) {
      const m = new Lua.Table();
      for (const k in metaFields) m.set(k, metaFields[k]);
      t.meta = m;
    }
    const handler = {
      get(target, prop) {
        if (typeof prop === 'string' && (prop in target || prop in Lua.Table.prototype)) return Reflect.get(target, prop, target);
        const v = host[prop];
        if (typeof v === 'function') return v.bind(host);
        return v === undefined ? null : v;
      },
      has(target, prop) { return prop in target || (typeof prop === 'string' && (prop in Lua.Table.prototype || prop in host)); }
    };
    return new Proxy(t, handler);
  }

  function coerceIn(prop, value) {
    if (value && typeof value === 'object' && value.get) {
      const h = value.host;
      if (h && h.__v3) return [h.X, h.Y, h.Z];
      if (h && h.__c3 && typeof h.toHex === 'function') return h.toHex();
      if (h && h.__cframe) { return { pos: h.__pos.slice(), rot: h.__rot.slice() }; }
    }
    if (Array.isArray(value)) return value.slice(0, 3);
    if (typeof value === 'string' && /^(Material|Font|KeyCode|EasingStyle|PartType)\./.test(value)) return value.split('.').slice(1).join('.');
    return value;
  }
  function coerceOut(prop, value) {
    if (value === undefined || value === null) {
      if (prop === 'CFrame') return cframeTable(nodePosFallback(prop), [0, 0, 0]);
      return null;
    }
    if (Array.isArray(value) && value.length === 3 && (prop === 'Position' || prop === 'Size' || prop === 'Velocity' || prop === 'Force' || prop === 'Orientation')) return v3Table(value);
    return value;
  }
  function nodePosFallback() { return [0, 0, 0]; }

  function v3Table(arrOrX, y, z) {
    let v;
    if (Array.isArray(arrOrX)) v = [arrOrX[0] || 0, arrOrX[1] || 0, arrOrX[2] || 0];
    else v = [Number(arrOrX) || 0, Number(y) || 0, Number(z) || 0];
    const host = {
      __v3: true, X: v[0], Y: v[1], Z: v[2],
      get Magnitude() { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); },
      get Unit() { const m = host.Magnitude || 1; return v3Table([v[0] / m, v[1] / m, v[2] / m]); },
      GetComponents() { return [v[0], v[1], v[2]]; },
      __tostring() { return v[0] + ', ' + v[1] + ', ' + v[2]; }
    };
    return wrap(host, {
      __add: (a, b) => { const B = b && b.host; return v3Table([v[0] + (B.__v3 ? B.X : 0), v[1] + (B.__v3 ? B.Y : 0), v[2] + (B.__v3 ? B.Z : 0)]); },
      __sub: (a, b) => { const B = b && b.host; return v3Table([v[0] - (B.__v3 ? B.X : 0), v[1] - (B.__v3 ? B.Y : 0), v[2] - (B.__v3 ? B.Z : 0)]); },
      __mul: (a, b) => { const B = b && (b.host || null); const n = typeof b === 'number' ? b : (B && B.__v3 === undefined && typeof b === 'number' ? b : null);
        if (typeof b === 'number') return v3Table([v[0] * b, v[1] * b, v[2] * b]);
        if (B && B.__v3) return v3Table([v[0] * B.X, v[1] * B.Y, v[2] * B.Z]);
        return v3Table(v); },
      __div: (a, b) => (typeof b === 'number' ? v3Table([v[0] / b, v[1] / b, v[2] / b]) : v3Table(v)),
      __unm: () => v3Table([-v[0], -v[1], -v[2]]),
      __eq: (a, b) => { const B = b && b.host; return !!(B && B.__v3 && Math.abs(B.X - v[0]) < 1e-6 && Math.abs(B.Y - v[1]) < 1e-6 && Math.abs(B.Z - v[2]) < 1e-6); },
      __tostring: (a) => v[0] + ', ' + v[1] + ', ' + v[2]
    });
  }

  function cframeTable(pos, rot) {
    const p = pos ? pos.slice(0, 3) : [0, 0, 0];
    const r = rot ? rot.slice(0, 3) : [0, 0, 0];
    const M = rotMatrix(r);
    const host = {
      __cframe: true, __pos: p, __rot: r,
      get X() { return p[0]; }, get Y() { return p[1]; }, get Z() { return p[2]; },
      get Position() { return v3Table(p); },
      set Position(v) { const t = coerceIn('Position', v); if (Array.isArray(t)) p = t; },
      get LookVector() { return v3Table([-M[2], -M[5], -M[8]]); },
      get RightVector() { return v3Table([M[0], M[3], M[6]]); },
      get UpVector() { return v3Table([M[1], M[4], M[7]]); },
      GetComponents() { return [p[0], p[1], p[2], M[0], M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8]]; },
      ToEulerAnglesXYZ() { const e = matrixToEuler(M); return [e[0] * Math.PI / 180, e[1] * Math.PI / 180, e[2] * Math.PI / 180]; },
      Lerp: (cf, alpha) => cframeTable(p, r),
      PointToWorldSpace: (v) => v3Table(p),
      __tostring() { return p.map((x) => Math.round(x * 100) / 100).join(', '); }
    };
    const mulCF = (A, B) => {
      const Ra = rotMatrix(A.__rot), Rb = rotMatrix(B.__rot);
      const R = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = Ra[i * 3] * Rb[j] + Ra[i * 3 + 1] * Rb[3 + j] + Ra[i * 3 + 2] * Rb[6 + j];
      const ap = A.__pos;
      const np = [
        ap[0] + Ra[0] * B.__pos[0] + Ra[1] * B.__pos[1] + Ra[2] * B.__pos[2],
        ap[1] + Ra[3] * B.__pos[0] + Ra[4] * B.__pos[1] + Ra[5] * B.__pos[2],
        ap[2] + Ra[6] * B.__pos[0] + Ra[7] * B.__pos[1] + Ra[8] * B.__pos[2]
      ];
      return cframeTable(np, matrixToEuler(R));
    };
    return wrap(host, {
      __mul: (a, b) => {
        const bh = b && (b.host || b);
        if (bh && bh.__v3) {
          const x = p[0] + M[0] * bh.X + M[1] * bh.Y + M[2] * bh.Z;
          const y = p[1] + M[3] * bh.X + M[4] * bh.Y + M[5] * bh.Z;
          const z = p[2] + M[6] * bh.X + M[7] * bh.Y + M[8] * bh.Z;
          return v3Table([x, y, z]);
        }
        if (bh && bh.__cframe) return mulCF(host, bh);
        return cframeTable(p, r);
      },
      __add: (a, b) => { const bh = b && (b.host || b); if (bh && bh.__v3) return cframeTable([p[0] + bh.X, p[1] + bh.Y, p[2] + bh.Z], r); return cframeTable(p, r); },
      __sub: (a, b) => { const bh = b && (b.host || b); if (bh && bh.__v3) return cframeTable([p[0] - bh.X, p[1] - bh.Y, p[2] - bh.Z], r); return cframeTable(p, r); },
      __tostring: () => p.join(', ')
    });
  }

  function color3(r, g, b) {
    let hex;
    if (typeof r === 'string') hex = r.replace('#', '').padEnd(6, '0').slice(0, 6);
    else {
      const fix = (v) => (v <= 1 && String(v).indexOf('.') >= 0 ? Math.round(v * 255) : Math.round(v));
      const rr = fix(r === undefined ? 0 : r), gg = fix(g === undefined ? rr : g), bb = fix(b === undefined ? rr : b);
      hex = [rr, gg, bb].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
    }
    const host = {
      __c3: true,
      R: parseInt(hex.slice(0, 2), 16) / 255,
      G: parseInt(hex.slice(2, 4), 16) / 255,
      B: parseInt(hex.slice(4, 6), 16) / 255,
      toHex() { return '#' + hex; },
      __tostring() { return hex; }
    };
    return wrap(host, { __tostring: () => '#' + hex });
  }

  function instanceTable(node) {
    if (hostCache.has(node)) return hostCache.get(node);
    const evCache = {};
    const api = {
      get __classname() { return node.class; },
      get __type() { return node.class; },
      get __ref() { return node.id; },
      get __node() { return node; },
      get Name() { return node.name; },
      set Name(v) { node.name = String(v); emit('explorer'); },
      get Parent() { return node.parent ? instanceTable(node.parent) : null; },
      set Parent(v) {
        const target = v && (v.host && v.host.__node) || (v && v.__node);
        if (target === node.parent) return;
        if (node.parent) removeNode(node);
        if (target) { node.parent = target; target.children.push(node); emit('explorer'); emit('change'); }
      },
      get ClassName() { return node.class; },
      get Touched() { return evCache.Touched || (evCache.Touched = makeEvent(node.name + '.Touched')); },
      get Changed() { return evCache.Changed || (evCache.Changed = makeEvent(node.name + '.Changed')); },
      get Died() { return evCache.Died || (evCache.Died = makeEvent(node.name + '.Died')); },
      get Activated() { return evCache.Activated || (evCache.Activated = makeEvent('Activated')); },
      get ChildAdded() { return evCache.ChildAdded || (evCache.ChildAdded = makeEvent('ChildAdded')); },
      GetChildren() { return node.children.map(instanceTable); },
      GetDescendants() { const out = []; walk(node, (n) => out.push(instanceTable(n))); return out; },
      FindFirstChild(name) { const c = node.children.find((x) => x.name === name); return c ? instanceTable(c) : null; },
      FindFirstChildOfClass(cls) { const c = node.children.find((x) => x.class === cls); return c ? instanceTable(c) : null; },
      FindFirstAncestor() { return node.parent ? instanceTable(node.parent) : null; },
      WaitForChild(name) { return this.FindFirstChild(name); },
      IsA(cls) {
        const inherit = { SpawnLocation: ['Part', 'BasePart'], Seat: ['Part'], WedgePart: ['Part'], TrussPart: ['Part'], CornerWedgePart: ['Part'], CylinderPart: ['Part'], LocalScript: ['BaseScript'], ModuleScript: ['ModuleScript'], TextButton: ['GuiObject', 'GuiButton'], TextLabel: ['GuiObject'], Frame: ['GuiObject'], SpotLight: ['PointLight'] };
        if (node.class === cls) return true;
        return (inherit[node.class] || []).includes(cls);
      },
      Clone() {
        const copy = JSON.parse(stringifyTree(node));
        const reid = (x) => { x.id = uid(); x.children.forEach(reid); };
        reid(copy);
          relink(copy, node.parent);
          if (node.parent) { node.parent.children.push(copy); emit('explorer'); emit('change'); }
        return instanceTable(copy);
      },
      Destroy() { if (node.parent) removeNode(node); emit('change'); emit('explorer'); },
      GetAttribute(k) { return node.props[k] === undefined ? null : node.props[k]; },
      SetAttribute(k, v) { node.props[k] = coerceIn(k, v); emit('props'); emit('change'); },
      GetAttributes() { const t = new Lua.Table(); for (const k in node.props) t.set(k, node.props[k]); return t; },
      ClearAllChildren() { node.children.slice().forEach((c) => removeNode(c)); emit('change'); },
      AddChild(child) { const t = (child && child.host && child.host.__node) || (child && child.__node); if (t) { t.parent = node; node.children.push(t); emit('explorer'); emit('change'); } },
      GetPivot() { return cframeTable(node.props.Position || [0, 0, 0], node.props.Orientation || [0, 0, 0]); },
      SetPrimaryPartCFrame(cf) { const c = coerceIn('CFrame', cf); if (c && c.pos) { node.props.Position = c.pos; node.props.Orientation = c.rot; emit('change'); } },
      GetBoundingBox() { return [v3Table(node.props.Size || [0, 0, 0]), cframeTable(node.props.Position || [0, 0, 0], [0, 0, 0])]; },
      GetExtentsSize() { return v3Table(node.props.Size || [0, 0, 0]); }
    };

    if (node.class === 'Humanoid') {
      api.Died = evCache.Died || (evCache.Died = makeEvent('Humanoid.Died'));
      api.MoveTo = () => {};
      api.Jump = false;
      api.MoveDirection = () => v3Table([0, 0, 0]);
    }
    if (node.class === 'Players' || node.class === 'PlayerService') {
      api.PlayerAdded = evCache.PlayerAdded || (evCache.PlayerAdded = makeEvent('PlayerAdded'));
      api.PlayerRemoving = evCache.PlayerRemoving || (evCache.PlayerRemoving = makeEvent('PlayerRemoving'));
      Object.defineProperty(api, 'LocalPlayer', { get: () => (global.__rsaPlayers && global.__rsaPlayers[0]) || null, configurable: true });
      api.GetPlayers = () => (global.__rsaPlayers || []);
      api.GetPlayerFromCharacter = () => (global.__rsaPlayers || [])[0] || null;
      api.GetPlayerByUserId = () => null;
    }

    const apiProxy = new Proxy(api, {
      get(t, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop in t) { const v = t[prop]; return typeof v === 'function' ? v.bind(t) : v; }
        if (prop in node.props) return coerceOut(prop, node.props[prop]);
        if (prop === 'CFrame') return cframeTable(node.props.Position || [0, 0, 0], node.props.Orientation || [0, 0, 0]);
        if (prop === 'Position') return v3Table(node.props.Position || [0, 0, 0]);
        if (prop === 'Size') return v3Table(node.props.Size || [4, 1, 4]);
        if (prop === 'Orientation') return v3Table(node.props.Orientation || [0, 0, 0]);
        const child = node.children.find((c) => c.name === prop);
        if (child) return instanceTable(child);
        return undefined;
      },
      set(t, prop, value) {
        if (typeof prop !== 'string') return true;
        const desc = Object.getOwnPropertyDescriptor(t, prop);
        if (desc && desc.set) { t[prop] = value; return true; }
        if (prop in t && typeof t[prop] === 'function') return true;
        if (prop === 'CFrame') {
          const c = coerceIn('CFrame', value);
          if (c && c.pos) { node.props.Position = c.pos; node.props.Orientation = c.rot; }
          emit('change'); emit('props');
          return true;
        }
        node.props[prop] = coerceIn(prop, value);
        if (['Position', 'Size', 'Color', 'Transparency', 'Orientation', 'Text', 'Visible'].includes(prop)) emit('change');
        emit('props');
        return true;
      },
      has(t, prop) {
        if (typeof prop !== 'string') return false;
        return prop in t || prop in node.props || prop === 'CFrame' || node.children.some((c) => c.name === prop);
      }
    });

    // CFrame / Position convenience: keep Position + Orientation in sync
    const out = wrap(apiProxy);
    hostCache.set(node, out);
    return out;
  }

  function runLuaCallback(fn, args) {
    if (!fn) return null;
    if (typeof fn === 'function') return fn.apply(null, args || []);
    if (Lua.isCallable(fn)) return Lua.call(fn, args || []);
    return null;
  }

  function buildRuntimeEnv() {
    const L = global.Lua;
    const env = {};
    const out = (level, msg) => log(level, msg);

    env.print = (...a) => { out('log', a.map(L.tostring).join(' ')); return []; };
    env.warn = (...a) => { out('warn', a.map(L.tostring).join(' ')); return []; };
    env.error = (m) => { throw new L.LuaError(L.tostring(m), 0); };
    env.tick = () => play.time;
    env.time = () => play.time;
    env.wait = (n) => { play.time += (n === undefined ? 0.03 : Number(n) || 0); return n || 0.03; };
    env.spawn = (fn) => { if (L.isCallable(fn)) play.tasks.push(fn); return null; };
    env.delay = (t, fn) => { if (L.isCallable(fn)) play.tasks.push(fn); return null; };
    env.elapsedTime = () => play.time;
    env.require = (m) => m;

    env.task = new L.Table({
      wait: (n) => { play.time += (n === undefined ? 0.03 : Number(n) || 0); return n || 0.03; },
      spawn: (fn) => { if (L.isCallable(fn)) play.tasks.push(fn); return null; },
      defer: (fn) => { if (L.isCallable(fn)) play.tasks.push(fn); return null; },
      delay: (t, fn) => { if (L.isCallable(fn)) play.tasks.push(fn); return null; },
      cancel: () => null,
      synchronize: () => null,
      desynchronize: () => null
    });

    env.Instance = new L.Table({
      new: (cls, parent) => {
        const className = L.tostring(cls);
        const node = makeInstance(className, className, {});
        const target = (parent && parent.__node) || state.services.Workspace;
        node.parent = target;
        target.children.push(node);
        emit('explorer'); emit('change');
        return instanceTable(node);
      },
      fromExisting: (inst) => (inst && inst.Clone ? inst.Clone() : null)
    });

    env.Vector3 = new L.Table({
      new: (x, y, z) => v3Table([x && x.__v3 ? [x.host.X, x.host.Y, x.host.Z] : Array.isArray(x) ? x : [x, y, z]]),
      zero: v3Table([0, 0, 0]),
      one: v3Table([1, 1, 1]),
      dot: (a, b) => { const A = a && a.host, B = b && b.host; return A && B ? A.X * B.X + A.Y * B.Y + A.Z * B.Z : 0; }
    });

    env.CFrame = new L.Table({
      new: (x, y, z) => {
        if (x && x.__v3) return cframeTable([x.host.X, x.host.Y, x.host.Z], y ? [y, z, 0] : [0, 0, 0]);
        if (Array.isArray(x)) return cframeTable(x, y || [0, 0, 0]);
        if (x && x.__cframe) return cframeTable(x.__pos.slice(), x.__rot.slice());
        return cframeTable([x || 0, y || 0, z || 0], [0, 0, 0]);
      },
      Angles: (rx, ry, rz) => cframeTable([0, 0, 0], [(rx || 0) * 180 / Math.PI, (ry || 0) * 180 / Math.PI, (rz || 0) * 180 / Math.PI]),
      identity: () => cframeTable([0, 0, 0], [0, 0, 0]),
      lookAt: (x, y, z) => cframeTable([x || 0, y || 0, z || 0], [0, 0, 0])
    });

    env.Color3 = new L.Table({
      new: (r, g, b) => color3(r, g, b),
      fromRGB: (r, g, b) => color3(r, g, b),
      fromHSV: (h, s, v) => color3('#ffffff'),
      fromHex: (h) => color3(h),
      toHSV: () => [0, 0, 0]
    });

    env.UDim2 = new L.Table({
      new: (a, b, c, d) => ({ XS: a || 0, YS: b || 0, XOffset: c || 0, YOffset: d || 0, __udim2: true }),
      fromScale: (a, b) => ({ XS: a || 0, YS: b || 0, XOffset: 0, YOffset: 0, __udim2: true }),
      fromOffset: (a, b) => ({ XS: 0, YS: 0, XOffset: a || 0, YOffset: b || 0, __udim2: true })
    });
    env.UDim = new L.Table({ new: (s, o) => ({ Scale: s || 0, Offset: o || 0 }) });
    env.Rect = new L.Table({ new: (a, b, c, d) => ({ X: a, Y: b, Width: c, Height: d }) });
    env.NumberRange = new L.Table({ new: (a, b) => ({ Min: a, Max: b === undefined ? a : b }) });
    env.NumberSequence = new L.Table({ new: (a) => ({ Value: a }) });
    env.NumberSequenceKeypoint = new L.Table({ new: (t, v) => ({ Time: t, Value: v }) });
    env.ColorSequence = new L.Table({ new: (c) => ({ Value: c }) });
    env.TweenInfo = new L.Table({ new: (t) => ({ Time: t || 1 }) });
    env.BrickColor = new L.Table({ new: (name) => color3('#9aa0a8'), Random: () => color3('#9aa0a8') });
    env.PhysicalProperties = new L.Table({ new: () => ({}) });
    env.Ray = new L.Table({ new: () => ({}) });
    env.Region3 = new L.Table({ new: () => ({}) });
    env.Instance = env.Instance;

    const enumTable = new L.Table({});
    const enumNames = ['KeyCode', 'Material', 'EasingStyle', 'EasingDirection', 'Font', 'PartType', 'ActuatorType', 'UserInputType', 'FontStyle', 'HorizontalAlignment', 'VerticalAlignment', 'SortOrder', 'AutomaticSize', 'ScaleType', 'ZIndexBehavior', 'BorderMode'];
    enumNames.forEach((k) => {
      const proxy = new Proxy({}, { get: (t, p) => (typeof p === 'string' ? (p.charAt(0).toUpperCase() + p.slice(1)) : null), has: () => true });
      enumTable.set(k, new L.Table(proxy));
    });
    env.Enum = enumTable;

    /* ---------- services ---------- */
    /* DataStores: per-name key/value storage persisted to localStorage, so
       test runs keep data across sessions. Published games use Roblox's
       own DataStoreService — this only backs local play/test mode. */
    const dsMem = Object.create(null);
    function dsKey(name) { return 'rsa:ds:' + L.tostring(name || 'global'); }
    function dsBacking(name) {
      const key = L.tostring(name || 'global');
      if (!dsMem[key]) {
        let data = null;
        try { const raw = localStorage.getItem(dsKey(name)); if (raw) data = JSON.parse(raw); } catch (e) {}
        dsMem[key] = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
      }
      return dsMem[key];
    }
    function dsPersist(name) {
      try {
        const b = dsBacking(name), out = {};
        for (const k in b) out[k] = unbox(b[k]);
        localStorage.setItem(dsKey(name), JSON.stringify(out));
      } catch (e) { /* storage full / unavailable */ }
    }
    function dsRead(b, k) {
      if (!(String(k) in b)) return null;
      const v = b[String(k)];
      if (v === undefined || v === null) return null;
      return (v instanceof L.Table) ? v : box(v);
    }
    function makeDataStore(name) {
      return new L.Table({
        GetAsync: (k) => dsRead(dsBacking(name), k),
        SetAsync: (k, v) => { dsBacking(name)[String(k)] = v; dsPersist(name); return true; },
        UpdateAsync: (k, fn) => {
          const r = runLuaCallback(fn, [dsRead(dsBacking(name), k)]);
          dsBacking(name)[String(k)] = Array.isArray(r) ? r[0] : r;
          dsPersist(name);
          return dsRead(dsBacking(name), k);
        },
        IncrementAsync: (k, d) => {
          const b = dsBacking(name);
          const cur = b[String(k)];
          b[String(k)] = (typeof cur === 'number' ? cur : 0) + (d || 1);
          dsPersist(name);
          return b[String(k)];
        },
        RemoveAsync: (k) => { delete dsBacking(name)[String(k)]; dsPersist(name); return true; },
        GetSortedAsync: () => ({ GetPageAsync: () => [] })
      });
    }
    const svcFallback = {
      DataStoreService: new L.Table({
        GetDataStore: (n) => makeDataStore(L.tostring(n || 'global')),
        GetOrderedDataStore: (n) => makeDataStore('ordered:' + L.tostring(n || 'global'))
      }),
      TweenService: new L.Table({
        Create: (obj, info, goals) => {
          const apply = () => {
            if (!goals || !goals.host) return;
            const g = goals.host;
            for (const k in g) {
              if (k.charAt(0) === '_' || typeof g[k] === 'function') continue;
              try { if (obj && obj.__set) obj.__set(k, g[k]); else if (obj) { const t = obj; t[k] = g[k]; } } catch (e) {}
            }
          };
          return new L.Table({ Play: () => { apply(); return null; }, Cancel: () => null, Pause: () => null, Completed: makeEvent('Tween.Completed') });
        },
        GetValue: () => 0
      }),
      RunService: new L.Table({
        Heartbeat: makeEvent('Heartbeat'),
        RenderStepped: makeEvent('RenderStepped'),
        Stepped: makeEvent('Stepped'),
        BindToRenderStep: () => null,
        IsServer: () => true,
        IsClient: () => false,
        IsStudio: () => true
      }),
      UserInputService: new L.Table({
        InputBegan: makeEvent('InputBegan'),
        InputEnded: makeEvent('InputEnded'),
        InputChanged: makeEvent('InputChanged'),
        IsKeyDown: (k) => {
          const name = L.tostring(k).split('.').pop();
          const keys = play.keys || {};
          return !!(keys[name] || keys['Key' + name] || keys[name.toUpperCase()]);
        },
        GetKeysPressed: () => [],
        TouchEnabled: () => true,
        MouseEnabled: () => true,
        LastInputType: () => 'UserInputType.Touch'
      }),
      ContextActionService: new L.Table({ BindAction: () => null, UnbindAction: () => null, BindActionAtPriority: () => null }),
      CollectionService: new L.Table({
        AddTag: (inst, tag) => { if (inst && inst.__node) { inst.__node.props.Tag = L.tostring(tag); return null; } },
        RemoveTag: (inst) => { if (inst && inst.__node) delete inst.__node.props.Tag; return null; },
        HasTag: (inst, tag) => !!(inst && inst.__node && inst.__node.props.Tag === L.tostring(tag)),
        GetTagged: (tag) => { const out2 = []; walk(state.place, (n) => { if (n.props && n.props.Tag === L.tostring(tag)) out2.push(instanceTable(n)); }); return out2; },
        GetInstanceAddedSignal: () => makeEvent('TagAdded'),
        GetInstanceRemovedSignal: () => makeEvent('TagRemoved')
      }),
      Debris: new L.Table({ AddItem: (inst, t) => { if (inst && inst.Destroy) setTimeout(() => { try { inst.Destroy(); } catch (e) {} }, (t || 10) * 1000); return null; } }),
      HttpService: new L.Table({
        JSONEncode: (t) => { try { return JSON.stringify(unbox(t)); } catch (e) { return '{}'; } },
        JSONDecode: (s) => box(JSON.parse(String(s))),
        GenerateGUID: () => 'xxxxxxxx-xxxx-4xxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)),
        RequestAsync: () => ({ Success: false, Body: '' })
      }),
      MarketplaceService: new L.Table({
        PromptProductPurchase: () => null,
        PromptPurchase: () => null,
        GetProductInfo: () => ({ Name: 'Item', PriceInRobux: 0 }),
        PlayerGotPurchase: makeEvent('Purchase')
      }),
      BadgeService: new L.Table({ AwardBadge: () => true, IsBadgeAwarded: () => false }),
      MessagingService: new L.Table({ PublishAsync: () => null, SubscribeAsync: () => ({ Disconnect: () => null }) }),
      TeleportService: new L.Table({ Teleport: () => null, TeleportToPrivateServer: () => null }),
      PathfindingService: new L.Table({ Create: () => ({ ComputeAsync: () => ({ Status: 'Success', GetWaypoints: () => [] }) }) }),
      PhysicsService: new L.Table({ RegisterCollisionGroup: () => null }),
      ReplicatedFirst: new L.Table({ RemoveDefaultLoadingScreen: () => null }),
      TextChatService: new L.Table({ OnIncomingMessage: () => null }),
      Stats: new L.Table({ GetMemoryUsageMbForTag: () => 0 }),
      GuiService: new L.Table({ IsTenFootInterface: () => false }),
      Teams: new L.Table({ GetTeams: () => [], CreateTeam: () => null }),
      SoundService: state.services.SoundService ? instanceTable(state.services.SoundService) : new L.Table({}),
      Chat: new L.Table({ AddSystemMessageToPlayersInRadius: () => null })
    };

    const gameTable = new L.Table({
      PlaceId: 0,
      GameId: 0,
      JobId: 'rsa-play-solo',
      CreatorId: 0,
      HttpEnabled: false,
      GetService: (name) => {
        const n = L.tostring(name);
        if (svcFallback[n]) return svcFallback[n];
        const svc = state.services[n];
        if (svc) return instanceTable(svc);
        if (!state.services[n]) {
          const node = makeInstance('Folder', n, {});
          node.isService = true;
          node.parent = state.place;
          state.place.children.push(node);
          reindexServices();
          return instanceTable(node);
        }
        return instanceTable(state.services[n]);
      },
      FindService: (name) => {
        const n = L.tostring(name);
        if (svcFallback[n]) return svcFallback[n];
        return state.services[n] ? instanceTable(state.services[n]) : null;
      },
      GetAttribute: (k) => (state.place.props[k] === undefined ? null : state.place.props[k]),
      SetAttribute: (k, v) => { state.place.props[k] = v; },
      GetAttributeChangedSignal: () => makeEvent('AttrChanged'),
      IsLoaded: () => true,
      Load: () => null,
      GetChildren: () => state.place.children.map(instanceTable),
      FindFirstChild: (n) => { const c = state.place.children.find((x) => x.name === n); return c ? instanceTable(c) : null; }
    });
    env.game = gameTable;
    Object.keys(svcFallback).forEach((k) => {
      Object.defineProperty(gameTable, k, { get: () => svcFallback[k], configurable: true });
    });
    env.workspace = instanceTable(state.services.Workspace);
    env.Workspace = env.workspace;
    env.Lighting = state.services.Lighting ? instanceTable(state.services.Lighting) : null;
    env.script = instanceTable({ class: 'Script', name: 'Script', props: {}, children: [], id: 'runtime-script', parent: null });
    env.Shared = new L.Table({});
    env._G = new L.Table({});

    /* ---------- players ---------- */
    const playersService = instanceTable(state.services.Players);
    const playerObj = {
      Name: 'Builder', UserId: 1, AccountAge: 0, MembershipType: 'None',
      FindFirstChild: (n) => (n === 'leaderstats' ? env.__leaderstats : null),
      WaitForChild: (n) => playerObj.FindFirstChild(n),
      GetRankInGroup: () => 255,
      IsInGroup: () => true,
      Kick: (msg) => { out('warn', 'You were kicked: ' + msg); },
      LoadCharacter: () => null,
      MoveTo: () => null,
      GetMouse: () => new L.Table({ Target: null, Hit: v3Table([0, 0, 0]), KeyDown: makeEvent('KeyDown'), Button1Down: makeEvent('Button1Down'), Click: makeEvent('Click') }),
      Character: null,
      Chatted: makeEvent('Player.Chatted'),
      CharacterAdded: makeEvent('Player.CharacterAdded'),
      CharacterRemoving: makeEvent('Player.CharacterRemoving')
    };
    global.__rsaPlayers = [playerObj];
    env.__players = global.__rsaPlayers;
    gameTable.Players = playersService;
    gameTable.LocalPlayer = playerObj;

    gameTable.GetPlayers = () => global.__rsaPlayers;
    const pa = playersService;
    // leaderstats scaffold on the Players service (removed when play stops)
    const ls = makeInstance('Folder', 'leaderstats', {});
    const coins = makeInstance('IntValue', 'Coins', { props: { Value: 0 } });
    const wins = makeInstance('IntValue', 'Wins', { props: { Value: 0 } });
    const stageVal = makeInstance('IntValue', 'Stage', { props: { Value: 0 } });
    [coins, wins, stageVal].forEach((c) => { c.parent = ls; ls.children.push(c); });
    const playerInst = makeInstance('Player', 'Builder', {});
    playerInst.parent = state.services.Players;
    state.services.Players.children.push(playerInst);
    playerInst.children.push(ls); ls.parent = playerInst;
    env.__leaderstats = instanceTable(ls);
    playerObj.FindFirstChild = (n) => (n === 'leaderstats' ? env.__leaderstats : null);
    playerObj.Character = null;
    playerObj.PlayerGui = null;

    /* ---------- helpers used by scripts ---------- */
    env.printf = (...a) => { out('log', a.map(L.tostring).join(' ')); return []; };
    env.dump = (v) => { out('log', L.tostring(v)); return []; };
    env.setfenv = () => null;
    env.getfenv = () => new L.Table({});

    return env;
  }

  function unbox(v) {
    if (v && v.host) {
      const h = v.host;
      if (h.__v3) return { X: h.X, Y: h.Y, Z: h.Z };
      const out2 = {};
      for (const k in h) if (typeof h[k] !== 'function' && k.charAt(0) !== '_') out2[k] = h[k];
      return out2;
    }
    if (v instanceof global.Lua.Table) {
      const out2 = {};
      v.m.forEach((val, k) => { out2[k] = unbox(val); });
      return out2;
    }
    if (Array.isArray(v)) return v.map(unbox);
    return v;
  }
  function box(v) {
    const L = global.Lua;
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) { const t = new L.Table(); v.forEach((x, i) => t.set(i + 1, box(x))); return t; }
    if (typeof v === 'object') { const t = new L.Table(); Object.keys(v).forEach((k) => t.set(k, box(v[k]))); return t; }
    return v;
  }

  function removePlayScaffold() {
    ['Players'].forEach((s) => {
      const svc = state.services[s];
      if (!svc) return;
      svc.children = svc.children.filter((c) => c.name !== 'leaderstats' && c.name !== 'Player1');
    });
  }

  const runState = { scripts: [], env: null };

  function collectScripts() {
    const out = [];
    walk(state.place, (n) => {
      if (['Script', 'LocalScript', 'ModuleScript'].includes(n.class) && n.props.Disabled !== true && n.props.Source) out.push(n);
    });
    return out;
  }

  function playStart() {
    if (play.running) return;
    pushUndo();
    play.running = true;
    state.mode = 'play';
    play.t0 = Date.now();
    play.time = 0;
    play.tasks = [];
    play.stats = { coins: 0, stage: 0 };

    // spawn a simple character at the first spawn point
    const spawn = findByName('SpawnLocation') || parts.find((n) => n.class === 'SpawnLocation');
    const sp = spawn && spawn.props.Position ? spawn.props.Position : [0, 3, 0];
    const char = makeInstance('Model', 'Character', {});
    const root = makeInstance('Part', 'HumanoidRootPart', { props: { Size: [2, 2, 1], Position: [sp[0], sp[1] + 3, sp[2]], Color: '#3d8bff', CanCollide: false, Anchored: false, Transparency: 0.15 } });
    const head = makeInstance('Part', 'Head', { props: { Size: [1.4, 1.4, 1.4], Position: [sp[0], sp[1] + 4.8, sp[2]], Color: '#f4c542', Anchored: false } });
    const hum = makeInstance('Humanoid', 'Humanoid', { props: { Health: 100, MaxHealth: 100, WalkSpeed: 16, JumpPower: 50 } });
    [root, head, hum].forEach((c) => { c.parent = char; char.children.push(c); });
    char.parent = state.services.Workspace;
    state.services.Workspace.children.push(char);
    play.char = char;
    play.charTable = instanceTable(char);
    play.velocity = [0, 0, 0];
    play.onGround = false;
    // share the UI input buffers so keyboard + touch both drive play mode
    play.keys = state.keys;
    play.joy = state.joy;

    const env = buildRuntimeEnv();
    env.__charTable = play.charTable;
    runState.env = env;

    const scripts = collectScripts();
    runState.scripts = scripts.map((n) => ({ node: n, src: n.props.Source }));
    log('sys', '▶ Play started — running ' + scripts.length + ' script(s)');
    emit('mode');
    emit('explorer');

    // run each script once (they may block on waits → budget handled by VM)
    runState.scripts.forEach((s) => {
      const e = new Lua.Env(Lua.globalEnv);
      for (const k in env) e.declare(k, env[k]);
      e.declare('script', instanceTable(s.node));
      e.declare('workspace', env.workspace);
      e.declare('game', env.game);
      const r = Lua.run(s.src, env, {
        print: (m) => log('log', m),
        warn: (m) => log('warn', m),
        budget: 300000
      });
      if (!r.ok) log('err', s.node.name + ': ' + r.error + (r.line ? ' (line ' + r.line + ')' : ''));
    });
  }

  function playStop() {
    if (!play.running) return;
    play.running = false;
    state.mode = 'edit';
    // remove character + play scaffold
    if (play.char) removeNode(play.char);
    play.char = null;
    removePlayScaffold();
    hostCache = new WeakMap();
    Object.keys(state.keys).forEach((k) => { delete state.keys[k]; });
    state.joy[0] = 0;
    state.joy[1] = 0;
    log('sys', '■ Play stopped');
    emit('mode');
    emit('explorer');
    emit('change');
  }

  function dispatchTouchEvents() {
    if (!play.char) return;
    const root = play.char.children.find((c) => c.name === 'HumanoidRootPart');
    if (!root) return;
    const rc = root.props.Position;
    const humTable = instanceTable(play.char.children.find((c) => c.class === 'Humanoid') || play.char);
    for (const p of parts) {
      if (p === root || !p.props.Size) continue;
      const pp = p.props.Position, s = p.props.Size;
      if (Math.abs(rc[0] - pp[0]) < s[0] / 2 + 1.2 &&
          Math.abs(rc[1] - pp[1]) < s[1] / 2 + 1.2 &&
          Math.abs(rc[2] - pp[2]) < s[2] / 2 + 1.2) {
        const ev = instanceTable(p).Touched;
        if (ev && ev._handlers && ev._handlers.length) ev.Fire(instanceTable(root));
        const tag = p.props.Tag;
        if (tag === 'Kill') { const h = instanceTable(play.char.children.find((c) => c.class === 'Humanoid')); if (h.Health > 0) { h.Health = 0; log('warn', 'You died on ' + p.name); } }
        if (tag === 'Coin') { play.stats.coins += (p.props.Value || 5); const c = state.services.Players && findByName('Coins'); if (c && c.props) { c.props.Value = play.stats.coins; } log('log', 'Coin collected! (' + play.stats.coins + ')'); p.props.Transparency = 1; }
        if (tag === 'Checkpoint' || p.props.Stage) { play.stats.stage = Math.max(play.stats.stage, p.props.Stage || 1); }
        if (tag === 'Win') { log('sys', '🏆 You win! Stage ' + play.stats.stage + ' · Coins ' + play.stats.coins); }
      }
    }
  }

  function stepPhysics(dt) {
    if (!play.char || state.mode !== 'play') return;
    const root = play.char.children.find((c) => c.name === 'HumanoidRootPart');
    if (!root) return;
    const pos = root.props.Position.slice();
    const speed = 16;
    const dir = [0, 0, 0];
    if (play.keys.KeyW || play.keys.ArrowUp || play.joy[1] < -0.3) dir[2] -= 1;
    if (play.keys.KeyS || play.keys.ArrowDown || play.joy[1] > 0.3) dir[2] += 1;
    if (play.keys.KeyA || play.keys.ArrowLeft || play.joy[0] < -0.3) dir[0] -= 1;
    if (play.keys.KeyD || play.keys.ArrowRight || play.joy[0] > 0.3) dir[0] += 1;
    const len = Math.hypot(dir[0], dir[2]) || 1;
    const yaw = state.camera.yaw;
    const mv = [((dir[0] / len) * Math.cos(yaw) - (dir[2] / len) * Math.sin(yaw)) * speed * dt,
                0,
                ((dir[0] / len) * Math.sin(yaw) + (dir[2] / len) * Math.cos(yaw)) * speed * dt];
    pos[0] += mv[0]; pos[2] += mv[2];

    play.velocity[1] -= 60 * dt;
    pos[1] += play.velocity[1] * dt;
    play.onGround = false;
    for (const p of parts) {
      if (!p.props.Size || p.props.CanCollide === false || p === root) continue;
      const pp = p.props.Position, s = p.props.Size;
      const inside = Math.abs(pos[0] - pp[0]) < s[0] / 2 + 0.8 && Math.abs(pos[2] - pp[2]) < s[2] / 2 + 0.8;
      if (!inside) continue;
      const top = pp[1] + s[1] / 2;
      if (pos[1] - 2 <= top && pos[1] > pp[1] && play.velocity[1] <= 0) {
        pos[1] = top + 2;
        play.velocity[1] = 0;
        play.onGround = true;
      }
    }
    if (pos[1] < -80) { pos[1] = 6; play.velocity[1] = 0; log('warn', 'You fell out of the world'); }
    if ((play.keys.Space || play.keys.jump) && play.onGround) { play.velocity[1] = 42; play.keys.jump = false; }
    root.props.Position = pos.map((v) => Math.round(v * 100) / 100);
    const head = play.char.children.find((c) => c.name === 'Head');
    if (head) head.props.Position = [pos[0], pos[1] + 2.4, pos[2]];
  }

  function pumpTasks() {
    const budget = 40;
    let n = 0;
    while (play.tasks.length && n < budget) {
      const fn = play.tasks.shift();
      try { runLuaCallback(fn, []); } catch (e) { log('err', 'task: ' + (e && e.message ? e.message : e)); }
      n++;
    }
  }

  /* ---------------- main loop ---------------- */
  let fpsSamples = [];
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastFrame) / 1000 || 0.016);
    lastFrame = ts;
    if (state.mode === 'play') {
      play.time += dt;
      stepPhysics(dt);
      dispatchTouchEvents();
      pumpTasks();
      const hum = play.char && play.char.children.find((c) => c.class === 'Humanoid');
      const hud = document.getElementById('playStats');
      if (hud) hud.textContent = '♥ ' + (hum ? Math.round(hum.props.Health) : 0) + ' · 🪙 ' + play.stats.coins + ' · ⚑ stage ' + play.stats.stage;
    }
    if (canvas && state.activeDoc === 'place') render(ts);
    fpsSamples.push(1 / Math.max(dt, 0.0001));
    if (fpsSamples.length > 30) fpsSamples.shift();
    fps = Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length);
    const stFps = document.getElementById('stFps');
    if (stFps && ts % 500 < 20) stFps.textContent = fps + ' fps';
    requestAnimationFrame(loop);
  }

  /* ---------------- boot ---------------- */
  function init() {
    newPlace(true);
    setupInput(document.getElementById('vp'));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    requestAnimationFrame(loop);
    on('change', () => { if (!state.dirty) { state.dirty = true; } });
    log('sys', 'Roblox Studio Android Edition engine ready');
  }

  /* ---------------- run one script from the editor ---------------- */
  function runScriptNode(node) {
    if (!node) return;
    const env = play.running && runState.env ? runState.env : buildRuntimeEnv();
    const r = Lua.run(node.props.Source || '', env, { print: (m) => log('log', m), warn: (m) => log('warn', m), budget: 400000 });
    if (r.ok) log('sys', '✓ ' + node.name + ' ran without errors');
    else log('err', '✗ ' + node.name + ': ' + r.error + (r.line ? ' (line ' + r.line + ')' : ''));
    return r;
  }

  global.Engine = {
    state, init, on, emit,
    buildPlace, newPlace, loadTemplate, insert, insertPart, normalize, walk, findById, findByName, removeNode,
    select, clearSelection, selected, primary, deleteSelection, duplicateSelection, setProp, rename,
    undo, redo, pushUndo,
    toXML, fromXML, toJSON, fromJSON,
    toolboxCategories, toolboxSearch, toolboxInsert,
    frameSelection, setupInput,
    playStart, playStop, runScriptNode,
    log,
    get fps() { return fps; },
    get parts() { return parts; },
    cornersOf, rayToGround
  };
})(typeof window !== 'undefined' ? window : globalThis);

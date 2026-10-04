/* ============================================================
   AI Builder + AI Coder
   Offline intent engine (parts + Lua generation). If an
   OpenAI-compatible endpoint is configured in Settings, the
   prompt is forwarded there first and the local engine is the
   fallback, so the feature always works.
   ============================================================ */
(function (global) {
  'use strict';

  const H = () => global.Templates.helpers;
  const C = () => global.Templates.colors;

  const SCRIPTS = {
    touch: `-- Run something when a part is touched
local part = script.Parent
local debounce = {}

part.Touched:Connect(function(hit)
	local plr = game.Players:GetPlayerFromCharacter(hit.Parent)
	if not plr or debounce[plr] then return end
	debounce[plr] = true
	print(plr.Name .. " touched " .. part.Name)
	wait(1)
	debounce[plr] = nil
end)`,
    leaderstats: global.Templates ? global.Templates.helpers.LEADERSTATS : '',
    door: `-- A door that opens when you touch it
local door = script.Parent
local open = false
local original = door.CFrame

door.Touched:Connect(function(hit)
	if hit.Parent:FindFirstChild("Humanoid") and not open then
		open = true
		door.CFrame = original * CFrame.Angles(0, math.rad(90), 0)
		door.CanCollide = false
		wait(3)
		door.CFrame = original
		door.CanCollide = true
		open = false
	end
end)`,
    daynight: `-- Day / night cycle
local lighting = game:GetService("Lighting")
while true do
	for i = 0, 1440, 2 do
		lighting.ClockTime = i / 60
		wait(0.05)
	end
end`,
    datastore: `-- Save coins with DataStoreService
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local store = DataStoreService:GetDataStore("Coins_v1")

Players.PlayerAdded:Connect(function(plr)
	local coins = 0
	local ok, saved = pcall(function() return store:GetAsync(plr.UserId) end)
	if ok and saved then coins = saved end
	local ls = plr:FindFirstChild("leaderstats")
	if ls and ls:FindFirstChild("Coins") then ls.Coins.Value = coins end
end)

Players.PlayerRemoving:Connect(function(plr)
	local ls = plr:FindFirstChild("leaderstats")
	if ls and ls:FindFirstChild("Coins") then
		pcall(function() store:SetAsync(plr.UserId, ls.Coins.Value) end)
	end
end)`,
    npc: `-- A friendly NPC that greets players who click it
local npc = script.Parent
local click = Instance.new("ClickDetector")
click.MaxActivationDistance = 16
click.Parent = npc

click.MouseClick:Connect(function(plr)
	print(npc.Name .. ": Hey " .. plr.Name .. "! Welcome to my game.")
end)`,
    gui: `-- Simple HUD with a round button (created at runtime)
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.Name = "Hud"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local btn = Instance.new("TextButton")
btn.Size = UDim2.fromOffset(120, 120)
btn.Position = UDim2.new(1, -140, 1, -140)
btn.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
btn.Text = "JUMP"
btn.TextSize = 22
btn.Font = Enum.Font.GothamBold
btn.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(1, 0)
corner.Parent = btn

btn.MouseButton1Click:Connect(function()
	local char = player.Character
	if char and char:FindFirstChild("Humanoid") then char.Humanoid.Jump = true end
end)`,
    tween: `-- Smoothly move a part with TweenService
local TweenService = game:GetService("TweenService")
local part = script.Parent

local info = TweenInfo.new(1, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut, -1, true)
local tween = TweenService:Create(part, info, { CFrame = part.CFrame * CFrame.new(0, 8, 0) })
tween:Play()`,
    keys: `-- Press E to trigger an action
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local mouse = player:GetMouse()

player.CharacterAdded:Connect(function(char)
	local humanoid = char:WaitForChild("Humanoid")
	humanoid:MoveTo(Vector3.new(0, 0, 0))
end)

game:GetService("UserInputService").InputBegan:Connect(function(input, gpe)
	if gpe then return end
	if input.KeyCode == Enum.KeyCode.E then
		print("E pressed!")
	end
end)`,
    zombie: `-- Chasing zombie
local zombie = script.Parent
local humanoid = zombie:WaitForChild("Humanoid")
local target = nil

while true do
	wait(0.4)
	local best, dist = nil, 60
	for _, plr in ipairs(game.Players:GetPlayers()) do
		local char = plr.Character
		if char and char:FindFirstChild("HumanoidRootPart") then
			local d = (char.HumanoidRootPart.Position - zombie.Position).Magnitude
			if d < dist then best, dist = char, d end
		end
	end
	if best then
		humanoid:MoveTo(best.HumanoidRootPart.Position)
	end
end`,
    race: `-- Race timer with laps
local Players = game:GetService("Players")
local checkpoints = workspace:FindFirstChild("Checkpoints")

Players.PlayerAdded:Connect(function(plr)
	plr:SetAttribute("LapStart", tick())
	plr:SetAttribute("Lap", 0)
end)`,
    coins: `-- Spinning collectable coins
local coins = script.Parent
local Players = game:GetService("Players")

for _, coin in ipairs(coins:GetChildren()) do
	local taken = false
	coin.Touched:Connect(function(hit)
		if taken then return end
		local plr = Players:GetPlayerFromCharacter(hit.Parent)
		if not plr then return end
		taken = true
		local ls = plr:FindFirstChild("leaderstats")
		if ls and ls:FindFirstChild("Coins") then
			ls.Coins.Value = ls.Coins.Value + (coin:GetAttribute("Value") or 5)
		end
		coin.Transparency = 1
		coin.CanCollide = false
		wait(6)
		coin.Transparency = 0
		coin.CanCollide = true
		taken = false
	end)
end`
  };

  /* ---- part generators ---------------------------------------------------- */
  function ringOf(n, radius, make) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push(make(Math.cos(a) * radius, Math.sin(a) * radius, i, a)); } return out; }

  const BUILDERS = {
    obby(count) {
      const P = H().P, out = [H().Spawn([0, 1, 10])];
      const n = count || 8;
      for (let i = 0; i < n; i++) {
        out.push(P({ name: 'Lava' + i, size: [24, 1, 8], pos: [0, 4 + i * 5, -12 * i], color: C().lava, material: 'Neon', tag: 'Kill' }));
        out.push(P({ name: 'Step' + i, size: [6, 1, 6], pos: [i % 2 ? 7 : -7, 5 + i * 5, -12 * i - 6], color: [C().blue, C().purple, C().cyan][i % 3], material: 'SmoothPlastic' }));
        out.push(P({ name: 'Checkpoint' + i, size: [7, 1, 7], pos: [0, 5 + i * 5, -12 * i - 12], color: C().gold, material: 'Neon', stage: i + 1 }));
      }
      out.push(H().S('ObbyService', `-- Generated by AI Builder
local Players = game:GetService("Players")
Players.PlayerAdded:Connect(function(plr)
	local s = Instance.new("IntValue"); s.Name = "Stage"; s.Value = 0; s.Parent = plr
end)
for _, p in ipairs(workspace:GetChildren()) do
	if p:IsA("Part") and p.Name:find("Lava") then
		p.Touched:Connect(function(hit)
			local h = hit.Parent and hit.Parent:FindFirstChild("Humanoid")
			if h then h.Health = 0 end
		end)
	end
	if p:IsA("Part") and p.Name:find("Checkpoint") then
		p.Touched:Connect(function(hit)
			local plr = Players:GetPlayerFromCharacter(hit.Parent)
			local st = plr and plr:FindFirstChild("Stage")
			if st and st.Value < (p:GetAttribute("Stage") or 1) then st.Value = p:GetAttribute("Stage") or 1 end
		end)
	end
end`));
      return out;
    },
    coins(count) {
      const P = H().P, out = [H().M('Coins', [0, 0, 0], [])];
      const n = count || 16;
      out[0].children = ringOf(n, 16, (x, z, i) => P({
        name: 'Coin', size: [2, 2, 0.4], pos: [x, 3 + (i % 3), z], rot: [0, 0, 90], shape: 'Cylinder',
        color: C().gold, material: 'Neon', tag: 'Coin', value: 5, canCollide: false
      }));
      out.push(H().S('CoinScript', SCRIPTS.coins));
      return out;
    },
    arena() {
      const P = H().P;
      return [
        H().Spawn([-18, 1, 0], [0, 90, 0]), H().Spawn([18, 1, 0], [0, -90, 0]),
        P({ name: 'Arena', size: [70, 1, 70], pos: [0, -0.5, 0], color: C().dark, material: 'Slate' }),
        P({ name: 'NorthWall', size: [70, 14, 1], pos: [0, 7, -35], color: C().stone, material: 'Concrete' }),
        P({ name: 'SouthWall', size: [70, 14, 1], pos: [0, 7, 35], color: C().stone, material: 'Concrete' }),
        P({ name: 'EastWall', size: [1, 14, 70], pos: [35, 7, 0], color: C().stone, material: 'Concrete' }),
        P({ name: 'WestWall', size: [1, 14, 70], pos: [-35, 7, 0], color: C().stone, material: 'Concrete' }),
        ...ringOf(4, 16, (x, z) => P({ name: 'Cover', size: [6, 5, 6], pos: [x, 2.5, z], color: C().wood, material: 'Wood' })),
        P({ name: 'WeaponSpawn', size: [1, 1, 7], pos: [0, 3, 0], color: C().cyan, material: 'Metal', tag: 'Weapon' }),
        H().S('ArenaWaves', `-- Spawn enemies every wave
local folder = Instance.new("Folder"); folder.Name = "Enemies"; folder.Parent = workspace
local wave = 0
while true do
	wave = wave + 1
	print("Wave " .. wave)
	for i = 1, wave + 2 do
		local e = Instance.new("Part")
		e.Size = Vector3.new(4, 4, 4)
		e.Position = Vector3.new(math.random(-30, 30), 6, math.random(-30, 30))
		e.Color = Color3.fromRGB(180, 40, 40)
		e.Parent = folder
		local hum = Instance.new("Humanoid"); hum.MaxHealth = 30 + wave * 10; hum.Health = hum.MaxHealth; hum.Parent = e
	end
	wait(20)
end`)
      ];
    },
    house() {
      const P = H().P;
      return [
        P({ name: 'HouseFloor', size: [24, 1, 20], pos: [0, 0.5, 0], color: C().wood, material: 'WoodPlanks' }),
        P({ name: 'FrontWall', size: [24, 10, 1], pos: [0, 5, -10], color: C().white, material: 'SmoothPlastic' }),
        P({ name: 'BackWall', size: [24, 10, 1], pos: [0, 5, 10], color: C().white, material: 'SmoothPlastic' }),
        P({ name: 'LeftWall', size: [1, 10, 20], pos: [-12, 5, 0], color: C().white, material: 'SmoothPlastic' }),
        P({ name: 'RightWall', size: [1, 10, 20], pos: [12, 5, 0], color: C().white, material: 'SmoothPlastic' }),
        P({ name: 'Roof', size: [26, 1, 22], pos: [0, 10.5, 0], color: C().red, material: 'Slate' }),
        P({ name: 'Door', size: [5, 8, 0.6], pos: [0, 4, -10], color: C().wood, material: 'Wood', tag: 'Door' }),
        H().S('DoorScript', SCRIPTS.door, '')
      ];
    },
    forest(count) {
      const P = H().P, out = [];
      const n = count || 10;
      for (let i = 0; i < n; i++) {
        const x = Math.round((Math.random() - 0.5) * 60), z = Math.round((Math.random() - 0.5) * 60);
        out.push(P({ name: 'Trunk', size: [2, 8 + Math.random() * 6, 2], pos: [x, 5, z], color: C().wood, material: 'Wood' }));
        out.push(P({ name: 'Leaves', size: [8, 6, 8], pos: [x, 12, z], color: '#2f7d3a', material: 'Grass', canCollide: false }));
      }
      return out;
    },
    tower(count) {
      const P = H().P, out = [];
      const n = count || 12;
      for (let i = 0; i < n; i++) out.push(P({
        name: 'Ledge' + i, size: [6, 1, 6], pos: [Math.cos(i * 0.8) * 9, 4 + i * 4, Math.sin(i * 0.8) * 9],
        rot: [0, i * 30, 0], color: i % 2 ? C().cyan : C().purple, material: 'SmoothPlastic'
      }));
      out.push(P({ name: 'Summit', size: [12, 1, 12], pos: [0, 4 + n * 4, 0], color: C().gold, material: 'Neon' }));
      return out;
    },
    track() {
      const P = H().P, out = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        out.push(P({
          name: 'Track' + i, size: [24, 1, 16], pos: [Math.cos(a) * 50, 0.5, Math.sin(a) * 50],
          rot: [0, -(i / 14) * 360, 0], color: i % 2 ? '#22262e' : '#f2f4f7', material: 'Asphalt'
        }));
      }
      out.push(H().Spawn([0, 1, 66]));
      return out;
    },
    gui() { return [H().LS('HudScript', SCRIPTS.gui)]; },
    zombie() {
      const P = H().P;
      return [
        P({ name: 'Zombie', size: [3, 5, 3], pos: [10, 3, -10], color: '#3fa64f', material: 'SmoothPlastic', tag: 'Enemy' }),
        H().S('ZombieAI', SCRIPTS.zombie)
      ];
    },
    shop() {
      const P = H().P;
      return [
        P({ name: 'ShopStand', size: [10, 4, 3], pos: [0, 2, -12], color: C().cyan, material: 'SmoothPlastic' }),
        P({ name: 'BuyButton', size: [3, 3, 1], pos: [0, 3, -10], color: C().gold, material: 'Neon', tag: 'Shop' }),
        H().S('ShopScript', `-- Buy items with coins
local button = workspace:WaitForChild("BuyButton")
local PRICE = 50
local busy = false
button.Touched:Connect(function(hit)
	if busy then return end
	local plr = game.Players:GetPlayerFromCharacter(hit.Parent)
	if not plr then return end
	local ls = plr:FindFirstChild("leaderstats")
	local coins = ls and ls:FindFirstChild("Coins")
	if coins and coins.Value >= PRICE then
		coins.Value = coins.Value - PRICE
		busy = true
		print(plr.Name .. " purchased an item!")
		wait(1)
		busy = false
	else
		print(plr.Name .. " cannot afford it")
	end
end)`)
      ];
    }
  };

  /* ---- intent matching ---------------------------------------------------- */
  const INTENTS = [
    { re: /obby|obstacle|lava|parkour|jump\s*course/i, kind: 'build', fn: () => BUILDERS.obby(), label: 'Obby course with checkpoints & kill bricks', script: null },
    { re: /coin|cash|money|currency|collect/i, kind: 'build', fn: (m) => BUILDERS.coins(), label: 'Spinning coin ring + collector script', script: 'coins' },
    { re: /arena|battle|deathmatch|pvp|combat|sword/i, kind: 'build', fn: () => BUILDERS.arena(), label: 'Fenced combat arena with waves', script: null },
    { re: /house|home|building|shop\s*house/i, kind: 'build', fn: () => BUILDERS.house(), label: 'House shell with an animated door', script: 'door' },
    { re: /tree|forest|wood|nature|jungle/i, kind: 'build', fn: (m, n) => BUILDERS.forest(n), label: 'Random forest of trees', script: null },
    { re: /tower|climb|vertical|platform/i, kind: 'build', fn: (m, n) => BUILDERS.tower(n), label: 'Climbing tower of ledges', script: null },
    { re: /race|racing|track|circuit|lap/i, kind: 'build', fn: () => BUILDERS.track(), label: 'Oval race track', script: 'race' },
    { re: /zombie|enemy|mob|npc|monster|ai\s*bot/i, kind: 'build', fn: () => BUILDERS.zombie(), label: 'Chasing enemy with AI', script: 'zombie' },
    { re: /shop|store|buy|purchase|market/i, kind: 'build', fn: () => BUILDERS.shop(), label: 'Shop stand with buy button', script: null },
    { re: /hud|gui|button|interface|screen\s*ui/i, kind: 'build', fn: () => BUILDERS.gui(), label: 'Round HUD button (LocalScript)', script: 'gui' },

    { re: /day\s*[\/\-]?\s*night|lighting|sunset|sunrise/i, kind: 'script', script: 'daynight', label: 'Day/night lighting cycle' },
    { re: /save|persist|data\s*store|datastore|load\s*data/i, kind: 'script', script: 'datastore', label: 'DataStore save/load for coins' },
    { re: /door|gate|open/i, kind: 'script', script: 'door', label: 'Touch to open door' },
    { re: /tween|animate|smooth\s*(move|motion)/i, kind: 'script', script: 'tween', label: 'TweenService animation' },
    { re: /key|keyboard|press\s*e|input/i, kind: 'script', script: 'keys', label: 'Keyboard input handler' },
    { re: /leaderstat|leaderboard|score|points/i, kind: 'script', script: 'leaderstats', label: 'Leaderstats setup' },
    { re: /click|mouse|detector/i, kind: 'script', script: 'npc', label: 'Click detector NPC' },
    { re: /touched?|touch|trigger|pad/i, kind: 'script', script: 'touch', label: 'Debounced Touched handler' }
  ];

  function matchIntent(prompt) {
    const p = String(prompt || '');
    for (const it of INTENTS) { const m = p.match(it.re); if (m) return Object.assign({ m }, it); }
    return null;
  }

  /* ---- smart free-form build (numbers, colours, shapes in the prompt) ----- */
  function adhocBuild(prompt) {
    const P = H().P;
    const p = prompt.toLowerCase();
    const nMatch = p.match(/(\d+)\s*(parts?|blocks?|platforms?|coins?|trees?|steps?)/);
    const n = nMatch ? Math.min(parseInt(nMatch[1], 10), 60) : 8;
    let shape = 'platform';
    if (/cylinder|circle|ring|round/.test(p)) shape = 'ring';
    else if (/tower|stack|pile|pyramid/.test(p)) shape = 'stack';
    else if (/wall|fence|barrier/.test(p)) shape = 'wall';
    else if (/grid|field|matrix/.test(p)) shape = 'grid';

    let color = '#8d8d8d';
    const cmap = { red: '#e0433b', blue: '#2f7ce0', green: '#4b8f3f', yellow: '#f4d03f', purple: '#8a4fe0', pink: '#f06fa8', orange: '#f2802a', cyan: '#33c6d6', black: '#14171c', white: '#f2f4f7', gold: '#ffcb3d' };
    for (const k in cmap) if (new RegExp('\\b' + k + '\\b').test(p)) color = cmap[k];

    const out = [];
    if (shape === 'ring') out.push(...ringOf(n, 14, (x, z, i) => P({ name: 'Part' + (i + 1), size: [4, 4, 4], pos: [x, 3, z], color, material: 'Neon' })));
    else if (shape === 'stack') { for (let i = 0; i < n; i++) out.push(P({ name: 'Block' + (i + 1), size: [6, 2, 6], pos: [0, 2 + i * 2, 0], rot: [0, i * 15, 0], color, material: 'SmoothPlastic' })); }
    else if (shape === 'wall') { for (let i = 0; i < n; i++) out.push(P({ name: 'Panel' + (i + 1), size: [4, 8, 1], pos: [-n * 2 + i * 4, 4, 0], color, material: 'Concrete' })); }
    else if (shape === 'grid') { const s = Math.ceil(Math.sqrt(n)); for (let i = 0; i < n; i++) out.push(P({ name: 'Tile' + (i + 1), size: [4, 1, 4], pos: [(i % s) * 5 - s * 2.5, 1, Math.floor(i / s) * 5 - s * 2.5], color, material: 'SmoothPlastic' })); }
    else { for (let i = 0; i < n; i++) out.push(P({ name: 'Platform' + (i + 1), size: [7, 1, 7], pos: [(i % 4) * 8 - 12, 3 + Math.floor(i / 4) * 3, Math.floor(i / 4) * -10], color, material: 'SmoothPlastic' })); }
    return out;
  }

  function scriptFor(intent, prompt) {
    if (intent && intent.script) return SCRIPTS[intent.script] || null;
    if (/save|persist|data/i.test(prompt)) return SCRIPTS.datastore;
    if (/door/i.test(prompt)) return SCRIPTS.door;
    if (/gui|hud|button/i.test(prompt)) return SCRIPTS.gui;
    if (/touched?|touch|trigger/i.test(prompt)) return SCRIPTS.touch;
    if (/day|night|light/i.test(prompt)) return SCRIPTS.daynight;
    return SCRIPTS.touch;
  }

  function scriptName(intent, prompt) {
    if (intent && intent.script) return { coins: 'CoinService', daynight: 'DayNightCycle', datastore: 'SaveData', door: 'DoorController', tween: 'TweenMover', keys: 'KeyInput', leaderstats: 'LeaderstatsSetup', npc: 'NPCDialog', touch: 'TouchHandler', gui: 'HudController', race: 'RaceTimer', zombie: 'EnemyAI' }[intent.script] || 'AIScript';
    if (/save|persist/i.test(prompt)) return 'SaveData';
    if (/door/i.test(prompt)) return 'DoorController';
    if (/gui|hud/i.test(prompt)) return 'HudController';
    return 'AIGeneratedScript';
  }

  async function remote(prompt) {
    const cfg = global.Config && global.Config.ai;
    if (!cfg || !cfg.endpoint || !cfg.apiKey) return null;
    try {
      const body = {
        model: cfg.model,
        messages: [
          { role: 'system', content: 'You are a Roblox Luau expert inside Roblox Studio Android Edition. Answer with (1) a short plan and (2) one complete Lua script in a ```lua block. Keep scripts compatible with standard Roblox APIs.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      };
      const url = cfg.endpoint.replace(/\/$/, '') + '/chat/completions';
      const doFetch = (u, o) => {
        if (global.NativeBridge && global.NativeBridge.fetch) return global.NativeBridge.fetch(u, o);
        return fetch(u, o);
      };
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
        body: JSON.stringify(body)
      });
      if (!res.ok) return null;
      const j = await res.json();
      const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      return text || null;
    } catch (e) { return null; }
  }

  async function generate(prompt) {
    const p = String(prompt || '').trim();
    if (!p) return { text: 'Tell me what to build or which Lua to write.', tree: null, script: null };
    const intent = matchIntent(p);
    const countMatch = p.match(/\b(\d{1,2})\b/);
    const n = countMatch ? Math.min(parseInt(countMatch[1], 10), 60) : null;

    const remoteText = await remote(p);

    let tree = null, script = null, scriptNm = null;
    const wantBuild = intent ? intent.kind === 'build' : /build|create|make|generate|add|place|spawn/i.test(p);
    const wantScript = intent ? intent.kind === 'script' || !!intent.script : /script|lua|code|function|event|program/i.test(p);

    if (wantBuild) tree = intent ? intent.fn(p, n) : adhocBuild(p);
    if (wantScript || (!tree && /script|lua|code/i.test(p)) || !tree) {
      script = scriptFor(intent, p);
      scriptNm = scriptName(intent, p);
    }

    const label = intent ? intent.label : (tree ? 'Custom build: ' + p : 'Custom Lua script');
    const parts = tree ? tree.length : 0;
    let text = remoteText
      ? (remoteText + '\n\n_(model) ' + (global.Config && global.Config.ai.model) + '_')
      : '✔ ' + label + (parts ? ' — ' + parts + ' instance' + (parts === 1 ? '' : 's') : '') +
        (script ? '\n✔ Wrote `' + scriptNm + '.lua` (' + script.split('\n').length + ' lines)' : '') +
        '\n\nTip: switch on "Use connected model' + '" in Settings › AI to chat with a real LLM.';

    return { text, tree, script, scriptName: scriptNm };
  }

  function explain(code) {
    const lines = String(code || '').split('\n');
    const notes = [];
    if (/Touched:Connect/.test(code)) notes.push('Listens for touch events (debounce recommended).');
    if (/PlayerAdded/.test(code)) notes.push('Runs for each player that joins.');
    if (/DataStoreService/.test(code)) notes.push('Persists data across sessions on Roblox servers.');
    if (/TweenService/.test(code)) notes.push('Animates properties smoothly over time.');
    if (/leaderstats/.test(code)) notes.push('Creates the leaderboard folder shown in the player list.');
    if (/while true/.test(code)) notes.push('Contains an infinite loop — make sure it yields with wait()/task.wait().');
    if (/LocalScript|PlayerGui/.test(code)) notes.push('Client-side code (runs in each player\'s game).');
    if (!notes.length) notes.push(lines.length + ' lines of Lua · ' + (code.match(/function/g) || []).length + ' function(s) · ' + (code.match(/end\b/g) || []).length + ' block end(s).');
    return notes;
  }

  global.AI = { generate, explain, SCRIPTS, BUILDERS, matchIntent, adhocBuild };
})(typeof window !== 'undefined' ? window : globalThis);

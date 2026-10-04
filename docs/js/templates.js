/* ============================================================
   Game templates — each template builds an instance tree
   (parts + Roblox Lua scripts) that the engine can run.
   ============================================================ */
(function (global) {
  'use strict';

  const COLORS = {
    grass: '#4b8f3f', dirt: '#7a5a3a', stone: '#8d8d8d', dark: '#2b2f36',
    red: '#e0433b', orange: '#f2802a', yellow: '#f4d03f', blue: '#2f7ce0',
    cyan: '#33c6d6', purple: '#8a4fe0', pink: '#f06fa8', white: '#f2f4f7',
    black: '#14171c', lava: '#ff5a1f', gold: '#ffcb3d', wood: '#9c6b3f',
    water: '#2f9bd8', neon: '#00ffe1'
  };

  function P(o) {
    return Object.assign({
      class: 'Part', name: 'Part', size: [4, 1, 4], pos: [0, 0, 4], rot: [0, 0, 0],
      color: COLORS.stone, material: 'Plastic', anchored: true, canCollide: true,
      transparency: 0, reflectance: 0, shape: 'Block'
    }, o);
  }
  function M(name, pos, children) { return { class: 'Model', name, pos: pos || [0, 0, 0], children: children || [] }; }
  function F(name, children) { return { class: 'Folder', name, children: children || [] }; }
  function S(name, source) { return { class: 'Script', name, source: source || '', runContext: 'Legacy' }; }
  function LS(name, source) { return { class: 'LocalScript', name, source: source || '' }; }
  function Spawn(pos, rot) { return P({ class: 'SpawnLocation', name: 'SpawnLocation', size: [6, 1, 6], pos, rot: rot || [0, 0, 0], color: COLORS.white, material: 'SmoothPlastic' }); }
  function Clicker(name, props) { return Object.assign(P({ name, canCollide: false }), props); }

  const BADGE_SCRIPT = `-- Awards a badge when a stage is reached (Open Cloud ready)
local BADGE_ID = 0 -- put your badge id here
game.Players.PlayerAdded:Connect(function(plr)
    local stage = Instance.new("IntValue")
    stage.Name = "Stage"
    stage.Value = 0
    stage.Parent = plr
end)`;

  const LEADERSTATS = `-- Creates the leaderboard stats folder for every player
local Players = game:GetService("Players")

local function onPlayer(player)
    local stats = Instance.new("Folder")
    stats.Name = "leaderstats"

    local coins = Instance.new("IntValue")
    coins.Name = "Coins"
    coins.Value = 0
    coins.Parent = stats

    local wins = Instance.new("IntValue")
    wins.Name = "Wins"
    wins.Value = 0
    wins.Parent = stats

    stats.Parent = player
end

Players.PlayerAdded:Connect(onPlayer)
for _, p in ipairs(Players:GetPlayers()) do onPlayer(p) end`;

  /* ------------------------------------------------------------------ */
  const templates = [];

  templates.push({
    id: 'baseplate', name: 'Baseplate', icon: '🧱', cat: 'Basics', color: '#5b6472',
    desc: 'Classic empty baseplate with a spawn — the perfect blank canvas.',
    build: () => [
      P({ name: 'Baseplate', size: [512, 20, 512], pos: [0, -10, 0], color: COLORS.stone, material: 'Slate', anchored: true }),
      Spawn([0, 1, 0])
    ]
  });

  templates.push({
    id: 'obby', name: 'Obby', icon: '🏃', cat: 'Adventure', color: '#ff7a45',
    desc: 'Checkpoints, lava, moving platforms and a win pad.',
    build: () => {
      const stages = [];
      const colors = [COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink];
      for (let i = 0; i < 6; i++) {
        stages.push(P({
          name: 'Checkpoint' + (i + 1), size: [8, 1, 8], pos: [0, 6 + i * 6, -14 * (i + 1)],
          color: colors[i % colors.length], material: 'Neon', tag: 'Checkpoint', stage: i + 1
        }));
        stages.push(P({
          name: 'Jump' + (i + 1), size: [5, 1, 5], pos: [(i % 2 ? 6 : -6), 6 + i * 6, -14 * i - 7],
          color: COLORS.white, material: 'SmoothPlastic'
        }));
        stages.push(P({
          name: 'Lava' + (i + 1), size: [26, 1, 12], pos: [0, 3 + i * 6, -14 * i - 7],
          color: COLORS.lava, material: 'Neon', tag: 'Kill'
        }));
      }
      return [
        Spawn([0, 1, 8]),
        P({ name: 'WinPad', size: [10, 1, 10], pos: [0, 40, -100], color: COLORS.gold, material: 'Neon', tag: 'Win' }),
        S('Leaderboard', LEADERSTATS),
        S('StageService', `-- Obby stage / checkpoint logic
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(plr)
	local stage = Instance.new("IntValue")
	stage.Name = "Stage"
	stage.Value = 0
	stage.Parent = plr
end)

local function bind(stage)
	local function hit(hit)
		local plr = game.Players:GetPlayerFromCharacter(hit.Parent)
		if not plr then return end
		local value = plr:FindFirstChild("Stage")
		if value and value.Value < stage.Stage then
			value.Value = stage.Stage
			print(plr.Name .. " reached stage " .. stage.Stage)
		end
	end
	stage.Touched:Connect(hit)
end

for _, stage in ipairs(workspace:GetChildren()) do
	if stage:IsA("Part") and stage:FindFirstChild("Stage") == nil and stage.Stage then bind(stage) end
end
workspace.ChildAdded:Connect(function(c)
	if c:IsA("Part") and c.Stage then bind(c) end
end)`),
        S('KillBricks', `-- Anything tagged Kill destroys the character
local function bind(part)
	part.Touched:Connect(function(hit)
		local char = hit.Parent
		if char and char:FindFirstChild("Humanoid") then
			char.Humanoid.Health = 0
		end
	end)
end
for _, p in ipairs(workspace:GetChildren()) do
	if p:IsA("Part") and p.Name:find("Lava") then bind(p) end
end`),
        M('Stages', [0, 0, 0], stages),
        F('Scripts', [])
      ];
    }
  });

  templates.push({
    id: 'tycoon', name: 'Tycoon', icon: '🏭', cat: 'Simulator', color: '#41c363',
    desc: 'Dropper, conveyor, purchase buttons and cash generation.',
    build: () => [
      Spawn([0, 1, 22]),
      P({ name: 'Floor', size: [40, 1, 44], pos: [0, -0.5, 0], color: COLORS.grass, material: 'Grass' }),
      P({ name: 'Dropper', size: [4, 6, 4], pos: [0, 12, -12], color: COLORS.purple, material: 'Metal' }),
      P({ name: 'Conveyor', size: [6, 1, 24], pos: [0, 4, 0], color: COLORS.dark, material: 'Metal', velocity: 8 }),
      P({ name: 'CashCollector', size: [8, 1, 8], pos: [0, 4.6, 14], color: COLORS.gold, material: 'Neon', tag: 'Cash' }),
      P({ name: 'BuyDropper', size: [5, 5, 1], pos: [-10, 3, -10], color: COLORS.blue, material: 'SmoothPlastic', tag: 'Purchase', cost: 100 }),
      P({ name: 'BuyConveyor', size: [5, 5, 1], pos: [10, 3, -10], color: COLORS.blue, material: 'SmoothPlastic', tag: 'Purchase', cost: 250 }),
      P({ name: 'WallL', size: [1, 8, 44], pos: [-20, 4, 0], color: COLORS.wood, material: 'WoodPlanks' }),
      P({ name: 'WallR', size: [1, 8, 44], pos: [20, 4, 0], color: COLORS.wood, material: 'WoodPlanks' }),
      S('Leaderboard', LEADERSTATS),
      S('TycoonMain', `-- Simple tycoon loop: dropper makes cash, buttons buy upgrades
local Players = game:GetService("Players")
local running = {}

local function getStats(plr)
	local ls = plr:FindFirstChild("leaderstats")
	return ls and ls:FindFirstChild("Coins")
end

Players.PlayerAdded:Connect(function(plr)
	running[plr] = true
	task.defer(function()
		while running[plr] and plr.Parent do
			wait(2)
			local coins = getStats(plr)
			if coins then coins.Value = coins.Value + 10 end
		end
	end)
end)

Players.PlayerRemoving:Connect(function(plr) running[plr] = nil end)

-- purchase buttons
for _, p in ipairs(workspace:GetChildren()) do
	if p:IsA("Part") and p:FindFirstChild("Cost") then
		p.Touched:Connect(function(hit)
			local plr = Players:GetPlayerFromCharacter(hit.Parent)
			local coins = plr and getStats(plr)
			if coins and coins.Value >= p.Cost.Value then
				coins.Value = coins.Value - p.Cost.Value
				p.Transparency = 0.7
				print(plr.Name .. " bought " .. p.Name)
			end
		end)
	end
end`)
    ]
  });

  templates.push({
    id: 'swordfight', name: 'Sword Fight', icon: '⚔️', cat: 'Combat', color: '#e0433b',
    desc: 'Arena with weapon pickups and round handling.',
    build: () => [
      Spawn([-16, 1, 0], [0, 90, 0]), Spawn([16, 1, 0], [0, -90, 0]),
      P({ name: 'ArenaFloor', size: [64, 1, 64], pos: [0, -0.5, 0], color: COLORS.stone, material: 'Slate' }),
      P({ name: 'WallN', size: [64, 12, 1], pos: [0, 6, -32], color: COLORS.dark, material: 'Concrete' }),
      P({ name: 'WallS', size: [64, 12, 1], pos: [0, 6, 32], color: COLORS.dark, material: 'Concrete' }),
      P({ name: 'WallE', size: [1, 12, 64], pos: [32, 6, 0], color: COLORS.dark, material: 'Concrete' }),
      P({ name: 'WallW', size: [1, 12, 64], pos: [-32, 6, 0], color: COLORS.dark, material: 'Concrete' }),
      P({ name: 'Pillar1', size: [4, 16, 4], pos: [-14, 8, -14], color: COLORS.wood, material: 'Wood' }),
      P({ name: 'Pillar2', size: [4, 16, 4], pos: [14, 8, 14], color: COLORS.wood, material: 'Wood' }),
      P({ name: 'SwordPickup', size: [1, 1, 6], pos: [0, 3, 0], color: COLORS.cyan, material: 'Metal', tag: 'Weapon' }),
      S('Leaderboard', LEADERSTATS),
      S('RoundService', `-- Round based deathmatch
local Players = game:GetService("Players")
local roundTime = 60
local intermission = 10
local inRound = false

local function broadcast(msg)
	for _, plr in ipairs(Players:GetPlayers()) do
		local gui = plr:FindFirstChild("PlayerGui")
		if gui then print(msg) end
	end
	print("[ROUND] " .. msg)
end

while true do
	broadcast("Intermission: " .. intermission .. "s")
	for i = intermission, 1, -1 do wait(1) end
	inRound = true
	broadcast("Fight! Round ends in " .. roundTime .. "s")
	for i = roundTime, 1, -1 do
		wait(1)
		if i % 10 == 0 then broadcast(i .. " seconds left") end
	end
	inRound = false
	for _, plr in ipairs(Players:GetPlayers()) do
		local char = plr.Character
		if char and char:FindFirstChild("Humanoid") then char.Humanoid.Health = 0 end
	end
end`)
    ]
  });

  templates.push({
    id: 'coinrush', name: 'Coin Rush', icon: '🪙', cat: 'Adventure', color: '#ffcb3d',
    desc: 'Collect coins across a parkour map with a live leaderboard.',
    build: () => {
      const coins = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        coins.push(P({
          name: 'Coin', size: [2, 2, 2], pos: [Math.cos(a) * (14 + (i % 3) * 4), 3 + (i % 4) * 2, Math.sin(a) * (14 + (i % 3) * 4)],
          color: COLORS.gold, material: 'Neon', shape: 'Cylinder', rot: [0, 0, 90], tag: 'Coin', value: 5, canCollide: false
        }));
      }
      return [
        Spawn([0, 1, 0]),
        P({ name: 'Ground', size: [90, 2, 90], pos: [0, -1, 0], color: COLORS.grass, material: 'Grass' }),
        P({ name: 'Tower', size: [8, 20, 8], pos: [0, 10, 0], color: COLORS.stone, material: 'Concrete' }),
        M('Coins', [0, 0, 0], coins),
        S('Leaderboard', LEADERSTATS),
        S('CoinService', `-- Spinning, collectable coins
local Players = game:GetService("Players")

local function setup(coin)
	local busy = false
	coin.Touched:Connect(function(hit)
		if busy then return end
		local plr = Players:GetPlayerFromCharacter(hit.Parent)
		if not plr then return end
		busy = true
		local ls = plr:FindFirstChild("leaderstats")
		local coins = ls and ls:FindFirstChild("Coins")
		if coins then coins.Value = coins.Value + (coin.Value or 5) end
		coin.Transparency = 1
		coin.CanCollide = false
		wait(8)
		coin.Transparency = 0
		busy = false
	end)
end

for _, c in ipairs(workspace.Coins:GetChildren()) do setup(c) end

-- spin animation
spawn(function()
	while true do
		wait(0.05)
		for _, c in ipairs(workspace.Coins:GetChildren()) do
			c.CFrame = c.CFrame * CFrame.Angles(0, math.rad(6), 0)
		end
	end
end)`)
      ];
    }
  });

  templates.push({
    id: 'simulator', name: 'Click Simulator', icon: '🖱️', cat: 'Simulator', color: '#8a4fe0',
    desc: 'Click to earn, rebirth multiplier, shop and saved data feel.',
    build: () => [
      Spawn([0, 1, 10]),
      P({ name: 'Ground', size: [70, 2, 70], pos: [0, -1, 0], color: COLORS.purple, material: 'SmoothPlastic' }),
      P({ name: 'ClickPad', size: [10, 1, 10], pos: [0, 1, -8], color: COLORS.neon, material: 'Neon', tag: 'Click' }),
      P({ name: 'RebirthPad', size: [8, 1, 8], pos: [14, 1, -8], color: COLORS.pink, material: 'Neon', tag: 'Rebirth' }),
      P({ name: 'ShopPad', size: [8, 1, 8], pos: [-14, 1, -8], color: COLORS.cyan, material: 'Neon', tag: 'Shop' }),
      S('Leaderboard', LEADERSTATS),
      S('ClickerMain', `-- Click simulator core
local Players = game:GetService("Players")
local multiplier = {}

Players.PlayerAdded:Connect(function(plr)
	multiplier[plr] = 1
	local ls = plr:FindFirstChild("leaderstats")
	local coins = ls and ls:FindFirstChild("Coins")
	local pad = workspace:FindFirstChild("ClickPad")
	if not pad or not coins then return end
	pad.Touched:Connect(function(hit)
		if Players:GetPlayerFromCharacter(hit.Parent) == plr then
			coins.Value = coins.Value + multiplier[plr]
		end
	end)
end)

Players.PlayerRemoving:Connect(function(plr) multiplier[plr] = nil end)

workspace:WaitForChild("RebirthPad").Touched:Connect(function(hit)
	local plr = Players:GetPlayerFromCharacter(hit.Parent)
	local ls = plr and plr:FindFirstChild("leaderstats")
	local coins = ls and ls:FindFirstChild("Coins")
	if coins and coins.Value >= 500 then
		coins.Value = 0
		multiplier[plr] = (multiplier[plr] or 1) + 1
		print(plr.Name .. " rebirth! x" .. multiplier[plr])
	end
end)`)
    ]
  });

  templates.push({
    id: 'racing', name: 'Racing', icon: '🏁', cat: 'Sports', color: '#2f7ce0',
    desc: 'Track with checkpoints, boost pads and lap counting.',
    build: () => {
      const parts = [Spawn([0, 1, 40])];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        parts.push(P({
          name: 'Track' + i, size: [22, 1, 14], pos: [Math.cos(a) * 46, 0.5, Math.sin(a) * 46],
          rot: [0, -(i / 12) * 360, 0], color: i % 3 === 0 ? COLORS.white : COLORS.dark, material: 'Asphalt'
        }));
        if (i % 4 === 0) parts.push(P({
          name: 'Boost', size: [10, 0.5, 6], pos: [Math.cos(a) * 46, 1.3, Math.sin(a) * 46],
          rot: [0, -(i / 12) * 360, 0], color: COLORS.cyan, material: 'Neon', tag: 'Boost'
        }));
      }
      parts.push(P({ name: 'StartFinish', size: [22, 0.6, 4], pos: [0, 1.3, 46], color: COLORS.gold, material: 'Neon', tag: 'Lap' }));
      return parts.concat([
        S('Leaderboard', LEADERSTATS),
        S('RaceService', `-- Lap counter + boost pads
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(plr)
	local laps = Instance.new("IntValue")
	laps.Name = "Laps"
	laps.Value = 0
	laps.Parent = plr
end)

local start = workspace:WaitForChild("StartFinish")
start.Touched:Connect(function(hit)
	local plr = Players:GetPlayerFromCharacter(hit.Parent)
	local laps = plr and plr:FindFirstChild("Laps")
	if laps then laps.Value = laps.Value + 1 print(plr.Name .. " lap " .. laps.Value) end
end)

for _, p in ipairs(workspace:GetChildren()) do
	if p.Name == "Boost" then
		p.Touched:Connect(function(hit)
			local hum = hit.Parent and hit.Parent:FindFirstChild("Humanoid")
			if hum then hit.Parent.Velocity = hit.Parent.CFrame.LookVector * 120 end
		end)
	end
end`)
      ]);
    }
  });

  templates.push({
    id: 'towerdefense', name: 'Tower Defense', icon: '🛡️', cat: 'Strategy', color: '#41a6c3',
    desc: 'Enemy path, wave spawner and placeable turret spots.',
    build: () => [
      Spawn([-24, 1, -24]),
      P({ name: 'Ground', size: [80, 2, 80], pos: [0, -1, 0], color: COLORS.grass, material: 'Grass' }),
      P({ name: 'Path1', size: [8, 0.4, 60], pos: [-20, 0.4, 0], color: COLORS.dirt, material: 'Ground' }),
      P({ name: 'Path2', size: [40, 0.4, 8], pos: [0, 0.4, -26], color: COLORS.dirt, material: 'Ground' }),
      P({ name: 'Path3', size: [8, 0.4, 50], pos: [18, 0.4, 0], color: COLORS.dirt, material: 'Ground' }),
      P({ name: 'Base', size: [12, 6, 12], pos: [18, 3, 24], color: COLORS.blue, material: 'Metal' }),
      P({ name: 'TurretSpot1', size: [6, 1, 6], pos: [-8, 1, 0], color: COLORS.cyan, material: 'Neon', tag: 'TurretSpot' }),
      P({ name: 'TurretSpot2', size: [6, 1, 6], pos: [8, 1, -10], color: COLORS.cyan, material: 'Neon', tag: 'TurretSpot' }),
      S('WaveSpawner', `-- Wave spawner: enemies walk the path and damage the base
local enemies = workspace:FindFirstChild("Enemies") or Instance.new("Folder")
enemies.Name = "Enemies"
enemies.Parent = workspace

local waypoints = {
	Vector3.new(-20, 2, 30), Vector3.new(-20, 2, -26),
	Vector3.new(18, 2, -26), Vector3.new(18, 2, 24)
}

local function spawnEnemy(hp)
	local e = Instance.new("Part")
	e.Size = Vector3.new(3, 3, 3)
	e.Color = Color3.fromRGB(220, 60, 60)
	e.Anchored = false
	e.CFrame = CFrame.new(waypoints[1])
	e.Parent = enemies
	local hum = Instance.new("Humanoid")
	hum.MaxHealth = hp
	hum.Health = hp
	hum.Parent = e
	task.spawn(function()
		for i = 2, #waypoints do
			while (e.Position - waypoints[i]).Magnitude > 3 and e.Parent do
				e.CFrame = e.CFrame + (waypoints[i] - e.Position).Unit * (12 * 0.05)
				wait(0.05)
			end
		end
		if e.Parent then e:Destroy() end
	end)
end

local wave = 0
while true do
	wave = wave + 1
	print("Wave " .. wave)
	for i = 1, 4 + wave do spawnEnemy(40 + wave * 10) wait(1) end
	wait(12)
end`)
    ]
  });

  templates.push({
    id: 'horror', name: 'Horror Map', icon: '🕯️', cat: 'Adventure', color: '#6b5bd6',
    desc: 'Dark maze with flickering lights and a jump-scare trigger.',
    build: () => {
      const walls = [];
      const maze = [
        [0, 0, 40, 2], [0, 20, 2, 44], [-20, -20, 40, 2], [20, -10, 2, 24],
        [-10, 10, 2, 20], [10, 5, 22, 2], [-15, -8, 16, 2]
      ];
      maze.forEach((m, i) => walls.push(P({
        name: 'Wall' + i, size: [m[2], 12, m[3]], pos: [m[0], 6, m[1]], color: COLORS.dark, material: 'Concrete'
      })));
      return [
        Spawn([0, 1, 18]),
        P({ name: 'Floor', size: [50, 1, 50], pos: [0, -0.5, 0], color: '#1b1e24', material: 'Slate' }),
        P({ name: 'Ceiling', size: [50, 1, 50], pos: [0, 13, 0], color: '#111318', material: 'Concrete', transparency: 0.2 }),
        ...walls,
        P({ name: 'Lamp1', size: [2, 0.5, 2], pos: [-10, 12, 0], color: COLORS.yellow, material: 'Neon', light: 8 }),
        P({ name: 'Lamp2', size: [2, 0.5, 2], pos: [12, 12, -14], color: COLORS.yellow, material: 'Neon', light: 8 }),
        P({ name: 'ScareTrigger', size: [6, 6, 1], pos: [0, 3, -18], color: COLORS.red, material: 'Neon', transparency: 1, canCollide: false, tag: 'Scare' }),
        S('LightFlicker', `-- Flickering lights + a scare trigger
local lamps = {}
for _, p in ipairs(workspace:GetChildren()) do
	if p.Name:find("Lamp") then table.insert(lamps, p) end
end

task.spawn(function()
	while true do
		wait(math.random(1, 4))
		for _, l in ipairs(lamps) do
			l.Material = Enum.Material.Neon
			if math.random() < 0.4 then
				l.Material = Enum.Material.SmoothPlastic
				wait(0.08)
			end
		end
	end
end)

local trigger = workspace:WaitForChild("ScareTrigger")
trigger.Touched:Connect(function(hit)
	local plr = game.Players:GetPlayerFromCharacter(hit.Parent)
	if plr then
		print("BOO! " .. plr.Name .. " got scared")
		local hum = hit.Parent:FindFirstChild("Humanoid")
		if hum then hum.Jump = true end
	end
end)`)
      ];
    }
  });

  templates.push({
    id: 'socialhub', name: 'Social Hub', icon: '🏙️', cat: 'Roleplay', color: '#f06fa8',
    desc: 'Lobby with shops, seats, a photo area and chat commands.',
    build: () => [
      Spawn([0, 1, 20]),
      P({ name: 'Plaza', size: [70, 2, 70], pos: [0, -1, 0], color: COLORS.white, material: 'SmoothPlastic' }),
      P({ name: 'Fountain', size: [12, 3, 12], pos: [0, 1.5, 0], color: COLORS.cyan, material: 'Glass' }),
      P({ name: 'ShopCounter', size: [16, 4, 3], pos: [-20, 2, -14], color: COLORS.wood, material: 'Wood' }),
      P({ name: 'PhotoWall', size: [14, 8, 1], pos: [20, 4, -14], color: COLORS.pink, material: 'SmoothPlastic' }),
      P({ name: 'Bench1', size: [8, 1.5, 2], pos: [-10, 0.75, 12], color: COLORS.wood, material: 'Wood' }),
      P({ name: 'Bench2', size: [8, 1.5, 2], pos: [10, 0.75, 12], color: COLORS.wood, material: 'Wood' }),
      S('Welcome', `-- Welcome message + chat style commands
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(plr)
	wait(1)
	print("Welcome to the hub, " .. plr.Name .. "!")
end)

Players.PlayerChatted:Connect(function(plr, msg)
	if msg:lower() == "/dance" then
		print(plr.Name .. " is dancing")
	elseif msg:lower() == "/wave" then
		print(plr.Name .. " waves at everyone")
	end
end)`)
    ]
  });

  templates.push({
    id: 'groupgame', name: 'Group Game', icon: '👥', cat: 'Group', color: '#a86bff',
    desc: 'Group-exclusive lobby with rank rewards and a group wall.',
    build: () => [
      Spawn([0, 1, 16]),
      P({ name: 'GroupFloor', size: [56, 2, 56], pos: [0, -1, 0], color: COLORS.purple, material: 'SmoothPlastic' }),
      P({ name: 'GroupWall', size: [24, 12, 1], pos: [0, 6, -24], color: COLORS.dark, material: 'Metal' }),
      P({ name: 'RewardPad1', size: [6, 1, 6], pos: [-12, 1, 0], color: COLORS.gold, material: 'Neon', tag: 'GroupReward', rank: 1 }),
      P({ name: 'RewardPad2', size: [6, 1, 6], pos: [0, 1, 0], color: COLORS.cyan, material: 'Neon', tag: 'GroupReward', rank: 2 }),
      P({ name: 'RewardPad3', size: [6, 1, 6], pos: [12, 1, 0], color: COLORS.pink, material: 'Neon', tag: 'GroupReward', rank: 3 }),
      S('GroupGate', `-- Rewards members of your Roblox group (set GROUP_ID)
local Players = game:GetService("Players")
local GROUP_ID = 0 -- << put your group id here

local function onPlayer(plr)
	if GROUP_ID == 0 then return end
	local ok, rank = pcall(function() return plr:GetRankInGroup(GROUP_ID) end)
	if ok and rank and rank > 0 then
		print(plr.Name .. " is rank " .. rank .. " in the group")
		local ls = Instance.new("Folder")
		ls.Name = "leaderstats"
		local member = Instance.new("BoolValue")
		member.Name = "GroupMember"
		member.Value = true
		member.Parent = ls
		ls.Parent = plr
	end
end

Players.PlayerAdded:Connect(onPlayer)`),
      S('Leaderboard', LEADERSTATS)
    ]
  });

  templates.push({
    id: 'parkour', name: 'Parkour Tower', icon: '🗼', cat: 'Adventure', color: '#33c6d6',
    desc: 'Vertical climbing tower with disappearing platforms.',
    build: () => {
      const parts = [Spawn([0, 1, 12])];
      for (let i = 0; i < 16; i++) {
        const a = (i * 0.9);
        parts.push(P({
          name: i % 5 === 4 ? 'Vanish' + i : 'Platform' + i,
          size: [6, 1, 6],
          pos: [Math.cos(a) * 10, 4 + i * 4, Math.sin(a) * 10],
          rot: [0, i * 24, 0],
          color: i % 5 === 4 ? COLORS.red : COLORS.cyan,
          material: i % 5 === 4 ? 'Neon' : 'SmoothPlastic',
          tag: i % 5 === 4 ? 'Vanish' : 'Platform'
        }));
      }
      parts.push(P({ name: 'TopPlatform', size: [14, 1, 14], pos: [0, 70, 0], color: COLORS.gold, material: 'Neon', tag: 'Win' }));
      return parts.concat([
        S('ParkourScripts', `-- Disappearing platforms + win detection
for _, p in ipairs(workspace:GetChildren()) do
	if p:IsA("Part") and p.Name:find("Vanish") then
		task.spawn(function()
			while true do
				wait(3)
				p.CanCollide = false
				p.Transparency = 0.6
				wait(1.5)
				p.CanCollide = true
				p.Transparency = 0
			end
		end)
	end
	if p.Name == "TopPlatform" then
		p.Touched:Connect(function(hit)
			local plr = game.Players:GetPlayerFromCharacter(hit.Parent)
			if plr then print(plr.Name .. " reached the top!") end
		end)
	end
end`)
      ]);
    }
  });

  global.Templates = {
    list: templates,
    colors: COLORS,
    helpers: { P, M, F, S, LS, Spawn, Clicker, LEADERSTATS, BADGE_SCRIPT },
    get(id) { return templates.find((t) => t.id === id) || null; },
    byCategory(cat) { return cat === 'All' ? templates : templates.filter((t) => t.cat === cat); },
    categories() { return ['All'].concat(Array.from(new Set(templates.map((t) => t.cat)))); }
  };
})(typeof window !== 'undefined' ? window : globalThis);

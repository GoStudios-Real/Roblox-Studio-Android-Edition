# Roblox Studio Android Edition

A Roblox Studio-style editor that runs **on the web, on Android, and on desktop** — 3D viewport, Lua scripting with syntax highlighting, AI Builder/Coder, Toolbox, game templates, and one-click publishing to Roblox via the Open Cloud API.

**Website:** https://gostudios-real.github.io/Roblox-Studio-Android-Edition/
**Editor (direct):** https://gostudios-real.github.io/Roblox-Studio-Android-Edition/app/index.html
**Download APK:** [Releases](https://github.com/GoStudios-Real/Roblox-Studio-Android-Edition/releases) (Android 8+)

## Features

- **3D viewport** — orbit/pan/zoom camera, select/move/rotate/scale tools, grid snapping, play-solo testing with touch controls
- **Lua script editor** — syntax highlighting, line gutter, run scripts in a sandboxed Lua runtime
- **AI Builder & Coder** — natural-language prompts that place objects or write scripts (offline rule-based engine, no API key needed)
- **Explorer & Properties** — full instance tree, live property editing, undo/redo
- **Toolbox & templates** — parts, models, scripts, and ready-made games (obby, tycoon, baseplate, …)
- **Script tabs** — scrollable tab strip, drag & drop reordering (mouse + touch), close buttons
- **Publish to Roblox** — Open Cloud API key only, no sign-in; Universe ID auto-resolves from your Place ID or game URL
- **DataStores** — persistent `GetAsync`/`SetAsync`/`UpdateAsync` in the sandbox
- **Works offline** — service worker caches the whole editor; publishing needs network

## Quick start

| Where | How |
|---|---|
| **Web** | Open the [website](https://gostudios-real.github.io/Roblox-Studio-Android-Edition/) and click *Launch the editor* |
| **Android** | Grab `RobloxStudioAE-*.apk` from [Releases](https://github.com/GoStudios-Real/Roblox-Studio-Android-Edition/releases) and sideload it |
| **Local** | Open `docs/index.html` in a browser, or serve the repo (`docs/`) with any static server |

## Publishing to Roblox

1. Create an Open Cloud **API key** with the *universes:publish* permission at https://create.roblox.com/cloud
2. In the editor: **Settings → Credentials** → paste the key
3. In **Game Settings**, enter your Place ID (or paste the game URL — the Universe ID resolves automatically)
4. Hit **Publish**

## Build from source

Web app — just static files under `docs/app/` (no bundler; `node tools/` contains checks):

```
node tools/test_app.js        # app smoke tests
node tools/test_lua.js        # Lua runtime tests
node tools/check_wiring.js    # HTML id wiring check
node tools/check_assets.js    # asset reference check
```

Android APK (no Gradle needed — uses aapt2/javac/d8/apksigner directly):

```
powershell -ExecutionPolicy Bypass -File tools\build_apk.ps1
# → dist/RobloxStudioAE-<version>.apk  (signed, ready to install)
```

Requires: JDK 11+, Android SDK build-tools 35.0.0, Python 3 (for zip fixing), Node.js for tests.

## Layout

```
docs/            GitHub Pages site (root = landing page)
  index.html     Landing page
  editor.html    Alias that opens the editor
  app/           The editor itself (served at /app/)
android/         Android project (no Gradle; custom build script)
tools/           Build + test scripts
```

## Notes

- Not affiliated with Roblox Corporation.
- The editor ships with an empty API-key stub (`docs/app/js/secrets.js`); your key stays on your device/only in your local build.

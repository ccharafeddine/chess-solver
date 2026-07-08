<p align="center">
  <img src="docs/logo.png" width="120" alt="Chess Solver logo" />
</p>

<h1 align="center">Chess Solver</h1>

<p align="center">
  A desktop chess analysis tool powered by Stockfish 18.<br />
  Set up any board position and get the top engine-recommended moves with evaluations, tactical motifs, and principal variations.
</p>

<p align="center">
  <a href="https://github.com/ccharafeddine/chess-solver/actions/workflows/ci.yml"><img src="https://github.com/ccharafeddine/chess-solver/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/ccharafeddine/chess-solver/releases/latest"><img src="https://img.shields.io/github/v/release/ccharafeddine/chess-solver?include_prereleases&label=release" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_19-087ea4?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Electron-2b2e3a?logo=electron&logoColor=9feaf9" alt="Electron" />
  <img src="https://img.shields.io/badge/Stockfish_18-WASM-863bff" alt="Stockfish 18 WASM" />
</p>

## Features

- Drag-and-drop piece movement with click-to-place editing
- Stockfish 18 analysis with streaming results (moves appear instantly)
- 1 / 3 / 5 candidate lines (fewer lines = deeper search), with eval bars and depth info
- Tactical motif detection (forks, pins, skewers, checks, etc.)
- Opening name recognition
- Checkmate, stalemate, and draw detection
- Light/dark theme toggle
- Board flip and turn switching
- Built-in update check (Settings → Check for updates)

## Quick Start (Development)

```bash
npm install
npm run dev
```

Opens the app in your browser at `http://localhost:5173`.

> **Note:** cloning requires [Git LFS](https://git-lfs.com/) — the Stockfish WASM binary (~108 MB) is stored with LFS.

## Testing

```bash
npm test        # unit tests (vitest)
npm run lint    # eslint
npm run build   # type-check + production build
```

The same three steps run in CI on every push and pull request.

## Download

Prebuilt binaries are on the [releases page](https://github.com/ccharafeddine/chess-solver/releases/latest):

- **Windows** — `Chess.Solver.<version>.exe`, a portable single-file build. Download and run (SmartScreen may warn on first run because the binary is unsigned; choose "More info → Run anyway").
- **macOS** — `Chess.Solver-<version>-universal.dmg`, a universal (Intel + Apple Silicon) disk image. The app is not notarized, so on first launch right-click the app → **Open** → **Open** to get past Gatekeeper.

Release binaries are built by the [release workflow](.github/workflows/release.yml) on tagged commits.

## Build Standalone Desktop App

```bash
npm install
npm run electron
```

Builds the production bundle and launches it as a standalone Electron desktop app.

## Build Installers

```bash
npm run dist
```

Builds for the platform you run it on and outputs to `release/`:

- **On Windows:** `release/Chess Solver <version>.exe` — single-file portable build (movable to USB / other machines) — plus `release/win-unpacked/`, the unpacked app folder used as the source for desktop installs
- **On macOS:** `release/Chess Solver-<version>-universal.dmg` — universal disk image for Intel and Apple Silicon

`.dmg` files can only be built on macOS; CI's release workflow uses a macOS runner for that.

### First-time build (Windows)

The first `npm run dist` on a machine downloads the `winCodeSign` toolchain, which contains symbolic links into a macOS subfolder. Windows blocks symlink creation unless one of these is true:

- The PowerShell session is running as **Administrator**, or
- **Developer Mode** is enabled in Settings → Privacy & Security → For developers

Run the first build under one of those conditions. Subsequent builds reuse the cached toolchain and do not need elevated privileges.

## Install as a Desktop App (Windows)

After running `npm run dist`, you can install the app for the current user so it has a desktop and Start Menu shortcut and survives future rebuilds:

```powershell
Copy-Item -Recurse -Force `
  "$PWD\release\win-unpacked" `
  "$env:LOCALAPPDATA\ChessSolver"

$ws = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), "$env:APPDATA\Microsoft\Windows\Start Menu\Programs")) {
  $lnk = $ws.CreateShortcut("$dir\Chess Solver.lnk")
  $lnk.TargetPath = "$env:LOCALAPPDATA\ChessSolver\Chess Solver.exe"
  $lnk.WorkingDirectory = "$env:LOCALAPPDATA\ChessSolver"
  $lnk.IconLocation = "$env:LOCALAPPDATA\ChessSolver\Chess Solver.exe,0"
  $lnk.Save()
}
```

To pin to the taskbar, right-click the desktop shortcut → **Pin to taskbar** (Windows blocks programmatic taskbar pinning).

## App Icon

The app icon is a chess-knight glyph on a purple `#863bff` rounded square. Windows embeds `build/icon.ico`; macOS converts `build/icon.png` (1024×1024) to `.icns` at package time. To regenerate both after editing the design, run:

```powershell
powershell -ExecutionPolicy Bypass -File build/make-icon.ps1      # icon.ico (256..16)
powershell -ExecutionPolicy Bypass -File build/make-icon-png.ps1  # icon.png (1024)
```

Both scripts use GDI+ with no external dependencies. Rerun `npm run dist` afterwards to embed the result.

## How to Use

1. The board starts with the standard chess position. Stockfish begins analyzing automatically.
2. Select a piece from the palette below the board, then click any square to place it.
3. Use **Remove** to erase pieces from the board.
4. Toggle **White/Black to move** to change the side to analyze.
5. The analysis panel shows the top engine moves with evaluations, tactical motifs, and principal variations. Use the **1 / 3 / 5** selector to trade breadth for depth.
6. Click any analysis line to play that move on the board.
7. Hover over a line to highlight the move on the board.
8. Use **Reset** to restore the starting position or **Clear** to empty the board.
9. Open the **⚙ settings menu** (top left) to see the app version or check for updates.

## Tech Stack

- React 19 + TypeScript
- Vite (dev server serves COOP/COEP headers so `SharedArrayBuffer` is available for the threaded Stockfish build)
- Stockfish 18 WASM (multi-threaded build, pthread workers)
- chess.js for move validation
- react-chessboard for the board UI
- Electron for desktop runtime, electron-builder for packaging
- Vitest for unit tests, GitHub Actions for CI

## License

[MIT](LICENSE)

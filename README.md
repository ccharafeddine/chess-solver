# Chess Solver

A desktop chess analysis tool powered by Stockfish 18. Set up any board position and get the top 10 engine-recommended moves with evaluations, tactical motifs, and principal variations.

## Features

- Drag-and-drop piece movement with click-to-place editing
- Stockfish 18 analysis with streaming results (moves appear instantly)
- Top 10 move recommendations with eval bars and depth info
- Tactical motif detection (forks, pins, skewers, checks, etc.)
- Opening name recognition
- Checkmate, stalemate, and draw detection
- Light/dark theme toggle
- Board flip and turn switching

## Quick Start (Development)

```bash
npm install
npm run dev
```

Opens the app in your browser at `http://localhost:5173`.

## Build Standalone Desktop App

```bash
npm install
npm run electron
```

Builds the production bundle and launches it as a standalone Electron desktop app.

## Build Portable .exe

```bash
npm run dist
```

Outputs to `release/`:

- `release/Chess Solver <version>.exe` — single-file portable build (movable to USB / other machines)
- `release/win-unpacked/` — unpacked app folder used as the source for desktop installs

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

The Windows executable uses `build/icon.ico` (a chess-knight glyph on a purple `#863bff` rounded square). To regenerate the icon from scratch — for example after editing the design — run:

```powershell
powershell -ExecutionPolicy Bypass -File build/make-icon.ps1
```

This produces a multi-resolution `.ico` (256, 128, 64, 48, 32, 16) using GDI+ with no external dependencies. Rerun `npm run dist` afterwards to embed it into the executable.

## How to Use

1. The board starts with the standard chess position. Stockfish begins analyzing automatically.
2. Select a piece from the palette below the board, then click any square to place it.
3. Use **Remove** to erase pieces from the board.
4. Toggle **White/Black to move** to change the side to analyze.
5. The analysis panel shows the top 10 engine moves with evaluations, tactical motifs, and principal variations.
6. Click any analysis line to play that move on the board.
7. Hover over a line to highlight the move on the board.
8. Use **Reset** to restore the starting position or **Clear** to empty the board.

## Tech Stack

- React 19 + TypeScript
- Vite (dev server serves COOP/COEP headers so `SharedArrayBuffer` is available for the threaded Stockfish build)
- Stockfish 18 WASM (multi-threaded build, pthread workers)
- chess.js for move validation
- react-chessboard for the board UI
- Electron for desktop runtime, electron-builder for packaging

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

Creates a portable Windows executable in the `release/` folder that can be run without installation.

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
- Vite
- Stockfish 18 WASM (lite single-threaded build)
- chess.js for move validation
- react-chessboard for the board UI
- Electron for desktop packaging

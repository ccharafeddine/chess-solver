# Chess Solver

A browser-based chess position analyzer powered by Stockfish 18 WASM.

## Features

- **Interactive board editing** - Click to place, move, or remove pieces with a visual piece palette
- **Stockfish 18 WASM engine** - Runs entirely in-browser via Web Worker, no server required
- **Top 5 move analysis** - MultiPV evaluation with centipawn scores and mate detection
- **Opening recognition** - Identifies 100+ named openings from the board position
- **Tactical motif detection** - Flags forks, pins, skewers, discovered attacks, checks, captures, and promotions
- **Responsive design** - Dark theme UI that works on desktop, tablet, and mobile

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## How to Use

1. The board starts with the standard chess position. Stockfish begins analyzing automatically.
2. Select a piece from the palette below the board, then click any square to place it.
3. Use the **Remove** button to erase pieces from the board.
4. Toggle **White/Black to move** to change the side to analyze.
5. The analysis panel on the right shows the top 5 engine moves with evaluations, tactical motifs, and the principal variation for each line.
6. Hover over any analysis line to highlight the move on the board.
7. Use **Reset** to restore the starting position or **Clear** to empty the board.

## Tech Stack

- React 19 + TypeScript
- Vite
- [react-chessboard](https://www.npmjs.com/package/react-chessboard)
- [chess.js](https://www.npmjs.com/package/chess.js)
- [Stockfish 18 WASM](https://www.npmjs.com/package/stockfish) (lite single-threaded)

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server.

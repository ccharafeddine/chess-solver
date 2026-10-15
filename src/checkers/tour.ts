/** Checkers tour: each step points at part of the screen and can load a live example position. */
export interface TourStep {
  target: string; // element id
  title: string;
  body: string;
  fen?: string;
  play?: boolean; // switch to Play vs engine for this step
}

export const START_FEN = 'B:W21,22,23,24,25,26,27,28,29,30,31,32:B1,2,3,4,5,6,7,8,9,10,11,12';

export const CHECKERS_TOUR: TourStep[] = [
  {
    target: 'ck-board',
    title: 'The board',
    body: 'This is American checkers. Black moves first, down the board. Click a piece, then one of the dotted squares to move it.',
    fen: START_FEN,
  },
  {
    target: 'ck-analysis',
    title: 'Best moves, ranked',
    body: 'The engine ranks your moves. +1.00 means you are about one piece ahead; "Win in 5" means a forced win in 5 moves. Click a line to play it.',
    fen: START_FEN,
  },
  {
    target: 'ck-board',
    title: 'Captures are required',
    body: 'If you can jump, you must. Here Black has to take with 14x23, so it is the only move listed.',
    fen: 'B:W18,30:B14,9',
  },
  {
    target: 'ck-board',
    title: 'Double jumps',
    body: 'A piece keeps jumping while it can. Here 14x23x32 takes two pieces in one move, and the piece is crowned at the end.',
    fen: 'B:W18,27,29:B14',
  },
  {
    target: 'ck-board',
    title: 'Kings',
    body: 'A piece that reaches the far row becomes a king (it gets a crown) and can then move backwards too. Move 27 forward to crown it.',
    fen: 'B:W5:B27',
  },
  {
    target: 'ck-palette',
    title: 'Set up any position',
    body: 'Pick a piece here, then click squares to place it. Pick it again to stop. Remove clears a square; Clear empties the board.',
  },
  {
    target: 'ck-mode',
    title: 'Play the engine',
    body: 'Switch to Play to take a side against the engine. It moves on its own; turn on hints if you want help.',
    fen: START_FEN,
    play: true,
  },
  {
    target: 'ck-undo',
    title: 'Undo',
    body: 'Undo takes back your last move (and the engine reply in Play). The move list lets you step back through the game too.',
  },
];

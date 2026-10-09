import { Chess, validateFen, type Square } from 'chess.js';
import { START_FEN } from './fen';

export interface GameState {
  startFen: string;
  /** SAN moves from startFen. Empty for an edited position chess.js cannot play. */
  moves: string[];
  /** 0 is startFen; moves.length is the position after the last move. */
  cursor: number;
  /** PGN headers from an imported game. Absent for a position set up in the app. */
  headers?: Record<string, string>;
}

export interface ParsedGame {
  startFen: string;
  moves: string[];
  headers: Record<string, string>;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EDGE_PAWNS = 'Invalid FEN: some pawns are on the edge rows';

function normalizeSpaces(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

// chess.js accepts a board plus a side to move and fills the rest. Pasted
// FENs often omit the counters, so do the same before validating.
function withDefaultFields(fen: string): string {
  const tokens = normalizeSpaces(fen).split(' ');
  if (tokens.length >= 2 && tokens.length < 6) {
    const defaults = ['-', '-', '0', '1'];
    return tokens.concat(defaults.slice(-(6 - tokens.length))).join(' ');
  }
  return tokens.join(' ');
}

export function parseFenInput(input: string): ParseResult<string> {
  const text = withDefaultFields(input);
  if (!text) return { ok: false, error: 'Enter a FEN to load.' };

  const result = validateFen(text);
  if (result.ok) {
    return { ok: true, value: new Chess(text).fen() };
  }
  // The editor supports pawns on rank 1 or 8. validateFen reports that only
  // after the rest of the FEN is well formed, so the position can still load.
  if (result.error === EDGE_PAWNS) {
    return { ok: true, value: text };
  }
  return { ok: false, error: result.error ?? 'That FEN is not valid.' };
}

function pgnError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message.startsWith('Invalid move in PGN')) {
    return `Could not import that PGN. ${message}`;
  }
  if (message.startsWith('Invalid PGN') || message.startsWith('Invalid FEN')) {
    return `Could not import that PGN. ${message}`;
  }
  return message || 'Could not import that PGN.';
}

export function parsePgn(input: string): ParseResult<ParsedGame> {
  const text = input.trim();
  if (!text) return { ok: false, error: 'PGN is empty.' };

  try {
    const chess = new Chess();
    chess.loadPgn(text);
    const moves = chess.history();
    const headers = chess.getHeaders();
    while (chess.history().length > 0) chess.undo();
    return { ok: true, value: { startFen: chess.fen(), moves, headers } };
  } catch (err) {
    return { ok: false, error: pgnError(err) };
  }
}

export function fenAt(startFen: string, moves: string[], cursor: number): string {
  const ply = Math.max(0, Math.min(cursor, moves.length));
  if (ply === 0) return startFen;
  try {
    const chess = new Chess(startFen);
    for (let i = 0; i < ply; i++) chess.move(moves[i]);
    return chess.fen();
  } catch {
    return startFen;
  }
}

export function moveSquares(
  startFen: string,
  moves: string[],
  cursor: number,
): { from: string; to: string } | null {
  if (cursor <= 0) return null;
  try {
    const chess = new Chess(startFen);
    let last: { from: string; to: string } | null = null;
    const ply = Math.min(cursor, moves.length);
    for (let i = 0; i < ply; i++) {
      const played = chess.move(moves[i]);
      last = { from: played.from, to: played.to };
    }
    return last;
  } catch {
    return null;
  }
}

export function legalMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string,
): { san: string; from: string; to: string } | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: from as Square,
      to: to as Square,
      promotion: promotion ?? 'q',
    });
    if (!move) return null;
    return { san: move.san, from: move.from, to: move.to };
  } catch {
    return null;
  }
}

export function appendMove(game: GameState, san: string): GameState {
  if (game.moves[game.cursor] === san) {
    return { ...game, cursor: game.cursor + 1 };
  }
  const moves = game.moves.slice(0, game.cursor);
  moves.push(san);
  const headers = game.headers ? { ...game.headers, Result: '*' } : undefined;
  return { startFen: game.startFen, moves, cursor: moves.length, headers };
}

function fallbackPgn(startFen: string): string {
  return [
    '[Event "Chess Solver"]',
    '[Site "Chess Solver"]',
    '[Date "????.??.??"]',
    '[Round "?"]',
    '[White "?"]',
    '[Black "?"]',
    '[Result "*"]',
    '[SetUp "1"]',
    `[FEN "${startFen}"]`,
    '',
    '*',
    '',
  ].join('\n');
}

export function serializePgn(game: GameState): string {
  try {
    const chess = new Chess(game.startFen);
    if (game.headers) {
      for (const [key, value] of Object.entries(game.headers)) {
        if (key === 'FEN' || key === 'SetUp') continue;
        chess.setHeader(key, value);
      }
    } else {
      chess.setHeader('Event', 'Chess Solver');
      chess.setHeader('Site', 'Chess Solver');
    }
    for (const san of game.moves) chess.move(san);
    const text = chess.pgn({ maxWidth: 80 });
    return text.endsWith('\n') ? text : `${text}\n`;
  } catch {
    return fallbackPgn(game.startFen);
  }
}

export function emptyGame(startFen: string = START_FEN): GameState {
  return { startFen, moves: [], cursor: 0 };
}

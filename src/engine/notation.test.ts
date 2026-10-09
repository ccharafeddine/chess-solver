import { describe, it, expect } from 'vitest';
import { START_FEN } from './fen';
import {
  appendMove,
  emptyGame,
  fenAt,
  moveSquares,
  parseFenInput,
  parsePgn,
  serializePgn,
} from './notation';

const EDGE_PAWN_FEN = '8/8/8/8/8/8/4k3/P6K w - - 0 1';

describe('parseFenInput', () => {
  it('accepts the starting position and returns chess.js canonical form', () => {
    expect(parseFenInput(START_FEN)).toEqual({ ok: true, value: START_FEN });
  });

  it('fills omitted counters before validating', () => {
    const partial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
    expect(parseFenInput(partial)).toEqual({ ok: true, value: START_FEN });
  });

  it('accepts an editor position chess.js rejects', () => {
    expect(parseFenInput(EDGE_PAWN_FEN)).toEqual({ ok: true, value: EDGE_PAWN_FEN });
  });

  it('rejects a malformed FEN with a clear error', () => {
    const result = parseFenInput('not-a-fen');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Invalid FEN/);
  });

  it('rejects an empty string', () => {
    const result = parseFenInput('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Enter a FEN/);
  });
});

describe('parsePgn / serializePgn', () => {
  it('parses a short game and serializes the same moves', () => {
    const parsed = parsePgn('1. e4 e5 2. Nf3 Nc6 *');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(parsed.value.startFen).toBe(START_FEN);

    const exported = serializePgn({ ...emptyGame(parsed.value.startFen), moves: parsed.value.moves, headers: parsed.value.headers });
    const again = parsePgn(exported);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.moves).toEqual(parsed.value.moves);
    expect(again.value.startFen).toBe(START_FEN);
  });

  it('round-trips a game that starts from a custom FEN', () => {
    const pgn = `[Event "Test"]
[White "A"]
[Black "B"]
[Result "1-0"]
[SetUp "1"]
[FEN "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"]

3. Bb5 a6 4. Ba4 1-0`;
    const parsed = parsePgn(pgn);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.moves).toEqual(['Bb5', 'a6', 'Ba4']);
    expect(parsed.value.headers.White).toBe('A');

    const exported = serializePgn({
      startFen: parsed.value.startFen,
      moves: parsed.value.moves,
      cursor: parsed.value.moves.length,
      headers: parsed.value.headers,
    });
    expect(exported).toContain('[White "A"]');
    expect(exported).toContain('[FEN "');
    expect(exported).toContain('Bb5');

    const again = parsePgn(exported);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.moves).toEqual(['Bb5', 'a6', 'Ba4']);
    expect(again.value.startFen).toBe(parsed.value.startFen);
  });

  it('rejects text that is not a game', () => {
    const result = parsePgn('hello world');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Could not import that PGN/);
  });

  it('rejects an empty PGN', () => {
    const result = parsePgn('  \n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/i);
  });

  it('writes a setup tag for a position chess.js cannot load', () => {
    const pgn = serializePgn(emptyGame(EDGE_PAWN_FEN));
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(`[FEN "${EDGE_PAWN_FEN}"]`);
  });
});

describe('fenAt / move list', () => {
  it('steps through a game one ply at a time', () => {
    const moves = ['e4', 'e5'];
    expect(fenAt(START_FEN, moves, 0)).toBe(START_FEN);
    expect(fenAt(START_FEN, moves, 1)).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    );
    expect(fenAt(START_FEN, moves, 2).split(' ')[1]).toBe('w');
    expect(moveSquares(START_FEN, moves, 1)).toEqual({ from: 'e2', to: 'e4' });
    expect(moveSquares(START_FEN, moves, 0)).toBeNull();
  });

  it('advances along the line and branches when a different move is played', () => {
    const game = { ...emptyGame(), moves: ['e4', 'e5', 'Nf3'], cursor: 1 };
    expect(appendMove(game, 'e5').cursor).toBe(2);
    expect(appendMove(game, 'e5').moves).toEqual(['e4', 'e5', 'Nf3']);

    const branched = appendMove(game, 'c5');
    expect(branched.moves).toEqual(['e4', 'c5']);
    expect(branched.cursor).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import {
  START_FEN,
  EMPTY_FEN,
  expandRow,
  compressRow,
  buildFen,
  editBoard,
  movePiece,
  hasBothColors,
  hasKings,
  isAnalyzable,
} from './fen';

describe('expandRow / compressRow', () => {
  it('expands digits into dots', () => {
    expect(expandRow('8')).toBe('........');
    expect(expandRow('r3k2r')).toBe('r...k..r');
    expect(expandRow('pppppppp')).toBe('pppppppp');
  });

  it('round-trips through compress', () => {
    for (const row of ['8', 'r3k2r', 'RNBQKBNR', '2p2p2', 'p6P']) {
      expect(compressRow(expandRow(row))).toBe(row);
    }
  });
});

describe('buildFen', () => {
  it('grants castling rights only when king and rooks are on home squares', () => {
    expect(buildFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', 'w')).toBe(START_FEN);
  });

  it('drops castling rights when the king has moved', () => {
    const fen = buildFen('rnbq1bnr/ppppkppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR', 'w');
    expect(fen.split(' ')[2]).toBe('KQ');
  });

  it('reports no castling rights with dashes', () => {
    const fen = buildFen('8/4k3/8/8/8/8/4K3/8', 'b');
    expect(fen.split(' ')[2]).toBe('-');
  });
});

describe('editBoard', () => {
  it('places a piece on an empty square', () => {
    const fen = editBoard(EMPTY_FEN, 'e4', 'Q');
    expect(fen.split(' ')[0]).toBe('8/8/8/8/4Q3/8/8/8');
  });

  it('removes a piece', () => {
    const fen = editBoard(START_FEN, 'e2', null);
    expect(fen.split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPP1PPP/RNBQKBNR');
  });
});

describe('movePiece', () => {
  it('moves a piece between squares', () => {
    const fen = movePiece(START_FEN, 'e2', 'e4');
    expect(fen.split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  });

  it('returns the same FEN when the source square is empty', () => {
    expect(movePiece(START_FEN, 'e4', 'e5')).toBe(START_FEN);
  });

  it('moves the rook when the king castles kingside', () => {
    const castleReady = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const fen = movePiece(castleReady, 'e1', 'g1');
    expect(fen.split(' ')[0]).toBe('r3k2r/8/8/8/8/8/8/R4RK1');
  });

  it('moves the rook when the king castles queenside', () => {
    const castleReady = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const fen = movePiece(castleReady, 'e1', 'c1');
    expect(fen.split(' ')[0]).toBe('r3k2r/8/8/8/8/8/8/2KR3R');
  });
});

describe('hasBothColors / hasKings', () => {
  it('detects both colors on the board', () => {
    expect(hasBothColors(START_FEN)).toBe(true);
    expect(hasBothColors('8/8/8/8/8/8/8/4K3 w - - 0 1')).toBe(false);
  });

  it('detects missing kings', () => {
    expect(hasKings(START_FEN)).toBe(true);
    expect(hasKings('8/4k3/8/8/8/8/8/8 w - - 0 1')).toBe(false);
  });
});

describe('isAnalyzable', () => {
  it('accepts the starting position', () => {
    expect(isAnalyzable(START_FEN)).toBe(true);
  });

  it('rejects an empty board', () => {
    expect(isAnalyzable(EMPTY_FEN)).toBe(false);
  });

  it('rejects a position with two kings of the same color', () => {
    expect(isAnalyzable('4k3/8/8/8/8/8/8/2K1K3 w - - 0 1')).toBe(false);
  });

  it('rejects a malformed board with a short row', () => {
    expect(isAnalyzable('4k3/8/8/8/8/8/8/K6 w - - 0 1')).toBe(false);
  });
});

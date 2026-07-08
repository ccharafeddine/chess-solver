import { describe, it, expect } from 'vitest';
import { uciToSan, detectGameEnd, isKingInCheck, formatEval, evalColor } from './utils';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('uciToSan', () => {
  it('converts pawn and knight moves', () => {
    expect(uciToSan(START_FEN, 'e2e4')).toBe('e4');
    expect(uciToSan(START_FEN, 'g1f3')).toBe('Nf3');
  });

  it('converts castling', () => {
    const castleReady = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    expect(uciToSan(castleReady, 'e1g1')).toBe('O-O');
    expect(uciToSan(castleReady, 'e1c1')).toBe('O-O-O');
  });

  it('converts promotions', () => {
    const promo = '8/P6k/8/8/8/8/8/4K3 w - - 0 1';
    expect(uciToSan(promo, 'a7a8q')).toBe('a8=Q');
  });

  it('falls back gracefully for positions chess.js rejects', () => {
    // No black king — chess.js refuses to load this position.
    const noKing = '8/8/8/8/3Q4/8/8/4K3 w - - 0 1';
    expect(uciToSan(noKing, 'd4d8')).toBe('Qd8');
  });
});

describe('detectGameEnd', () => {
  it("detects fool's mate", () => {
    const foolsMate = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(detectGameEnd(foolsMate)).toBe('Checkmate - Black wins');
  });

  it('detects stalemate', () => {
    const stalemate = 'k7/8/1Q6/8/8/8/8/K7 b - - 0 1';
    expect(detectGameEnd(stalemate)).toBe('Stalemate - Draw');
  });

  it('detects insufficient material', () => {
    const bareKings = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    expect(detectGameEnd(bareKings)).toBe('Draw - Insufficient material');
  });

  it('returns null for a normal position', () => {
    expect(detectGameEnd(START_FEN)).toBeNull();
  });
});

describe('isKingInCheck', () => {
  it('sees a rook check along a file', () => {
    const fen = '4k3/8/8/8/8/8/8/4R2K b - - 0 1';
    expect(isKingInCheck(fen, 'b')).toBe(true);
    expect(isKingInCheck(fen, 'w')).toBe(false);
  });

  it('sees a knight check', () => {
    const fen = '4k3/8/3N4/8/8/8/8/7K b - - 0 1';
    expect(isKingInCheck(fen, 'b')).toBe(true);
  });

  it('sees a pawn check', () => {
    const fen = '4k3/3P4/8/8/8/8/8/7K b - - 0 1';
    expect(isKingInCheck(fen, 'b')).toBe(true);
  });

  it('respects blockers on sliding attacks', () => {
    const fen = '4k3/4p3/8/8/8/8/8/4R2K b - - 0 1';
    expect(isKingInCheck(fen, 'b')).toBe(false);
  });
});

describe('formatEval', () => {
  it('formats centipawns as pawns with a sign', () => {
    expect(formatEval(40, null)).toBe('+0.4');
    expect(formatEval(-120, null)).toBe('-1.2');
    expect(formatEval(0, null)).toBe('+0.0');
  });

  it('formats mate scores', () => {
    expect(formatEval(0, 3)).toBe('M3');
    expect(formatEval(0, -2)).toBe('M2');
  });
});

describe('evalColor', () => {
  it('maps centipawn ranges to classes', () => {
    expect(evalColor(200, null)).toBe('eval-winning');
    expect(evalColor(100, null)).toBe('eval-slight-advantage');
    expect(evalColor(0, null)).toBe('eval-equal');
    expect(evalColor(-100, null)).toBe('eval-slight-disadvantage');
    expect(evalColor(-300, null)).toBe('eval-losing');
  });

  it('maps mate scores to winning/losing', () => {
    expect(evalColor(0, 5)).toBe('eval-winning');
    expect(evalColor(0, -5)).toBe('eval-losing');
  });
});

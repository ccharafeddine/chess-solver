import { describe, it, expect } from 'vitest';
import { detectTactics } from './tactics';

const types = (fen: string, move: string) => detectTactics(fen, move).map((m) => m.type);

describe('detectTactics', () => {
  it('detects a capture', () => {
    const fen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
    expect(types(fen, 'e4d5')).toContain('capture');
  });

  it('detects a knight fork with check', () => {
    const fen = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
    const found = types(fen, 'b5c7');
    expect(found).toContain('fork');
    expect(found).toContain('check');
  });

  it('detects a promotion', () => {
    const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    expect(types(fen, 'a7a8q')).toContain('promotion');
  });

  it('detects checkmate', () => {
    // Back-rank mate: Ra1-a8#
    const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
    expect(types(fen, 'a1a8')).toContain('checkmate');
  });

  it('detects a pin against the king', () => {
    // Re1 pins the black queen on e5 to the king on e8.
    const fen = '4k3/8/8/4q3/8/8/8/R5K1 w - - 0 1';
    expect(types(fen, 'a1e1')).toContain('pin');
  });

  it('returns no motifs for a quiet move', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(detectTactics(start, 'e2e4')).toHaveLength(0);
  });
});

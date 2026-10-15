import { describe, expect, it } from 'vitest';
import { analyse, evaluate, WIN } from './search';
import { parseFen, startPosition, type Position } from './rules';
import { blackBarPercent, formatCheckersEval } from './format';

const pos = (fen: string): Position => {
  const r = parseFen(fen);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('engine', () => {
  it('scores the start position as roughly level and ranks the requested number of moves', () => {
    const r = analyse(startPosition(), { multiPV: 3, maxDepth: 6, movetimeMs: 5000 });
    expect(r.lines).toHaveLength(3);
    expect(Math.abs(r.lines[0].score)).toBeLessThan(60);
    expect(r.lines[0].score).toBeGreaterThanOrEqual(r.lines[1].score);
    expect(r.lines[1].score).toBeGreaterThanOrEqual(r.lines[2].score);
  });

  it('is symmetric: the evaluation flips with the side to move', () => {
    const p = pos('B:W21,22,K30:B1,5,9');
    expect(evaluate({ ...p, turn: -1 })).toBe(-evaluate(p));
  });

  it('takes the double jump that crowns', () => {
    const r = analyse(pos('B:W18,27,29:B14'), { maxDepth: 4 });
    expect(r.lines[0].notation).toBe('14x23x32');
  });

  it('proves a won king ending', () => {
    const r = analyse(pos('B:WK18:BK1,K3'), { maxDepth: 40, movetimeMs: 10000 });
    expect(r.lines[0].winIn).not.toBeNull();
    expect(r.lines[0].winIn!).toBeGreaterThan(0);
  });

  it('scores a position with no legal move as lost', () => {
    // After White's only sensible move Black is stuck, so White should see a forced win.
    const r = analyse(pos('W:W32,K23:B28'), { maxDepth: 6 });
    expect(r.lines[0].winIn).not.toBeNull();
    expect(r.lines[0].winIn!).toBeGreaterThan(0);
  });

  it('treats a repeated position as a draw', () => {
    const p = pos('B:WK32:BK1');
    const r = analyse(p, { maxDepth: 8 });
    expect(Math.abs(r.lines[0].score)).toBeLessThan(WIN - 1000);
  });

  it('stops on time', () => {
    const t = Date.now();
    analyse(startPosition(), { movetimeMs: 300 });
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe('formatting', () => {
  it('shows evals in pieces and forced results in moves', () => {
    expect(formatCheckersEval(130, null)).toBe('+1.30');
    expect(formatCheckersEval(-45, null)).toBe('−0.45');
    expect(formatCheckersEval(0, null)).toBe('0.00');
    expect(formatCheckersEval(WIN - 9, 9)).toBe('Win in 5');
    expect(formatCheckersEval(-(WIN - 4), -4)).toBe('Loss in 2');
  });
  it('fills the eval bar for the side that is better', () => {
    expect(blackBarPercent(0, null, true)).toBe(50);
    expect(blackBarPercent(500, null, true)).toBe(100);
    expect(blackBarPercent(500, null, false)).toBe(0);
    expect(blackBarPercent(WIN, 3, false)).toBe(0);
  });
});

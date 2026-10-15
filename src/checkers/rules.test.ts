import { describe, expect, it } from 'vitest';
import {
  applyMove, gameOverMessage, generateMoves, moveNotation, parseFen, perft, startPosition, toFen, colOf, rowOf, squareAt,
  type Position,
} from './rules';

const pos = (fen: string): Position => {
  const r = parseFen(fen);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const notations = (fen: string) => generateMoves(pos(fen)).map(moveNotation).sort();

describe('board geometry', () => {
  it('numbers squares 1-32 on the dark squares, with 1 at the top left', () => {
    expect([rowOf(0), colOf(0)]).toEqual([0, 1]);
    expect([rowOf(3), colOf(3)]).toEqual([0, 7]);
    expect([rowOf(28), colOf(28)]).toEqual([7, 0]);
    for (let s = 0; s < 32; s++) expect(squareAt(rowOf(s), colOf(s))).toBe(s);
    expect(squareAt(0, 0)).toBe(-1);
  });
});

describe('perft from the start position', () => {
  // Published move-path counts for English draughts.
  const expected = [1, 7, 49, 302, 1469, 7361, 36768, 179740, 845931];
  expected.forEach((n, depth) => {
    it(`depth ${depth} = ${n}`, () => expect(perft(startPosition(), depth)).toBe(n));
  });
});

describe('rules', () => {
  it('opens with the seven standard moves for Black', () => {
    expect(notations(toFen(startPosition()))).toEqual(['10-14', '10-15', '11-15', '11-16', '12-16', '9-13', '9-14']);
  });

  it('forces a capture when one exists', () => {
    expect(notations('B:W18,30:B14,9')).toEqual(['14x23']);
  });

  it('lets you choose between captures, not just the longest one', () => {
    // 15x22 takes one piece, the others take two. Any of them is legal in American checkers.
    expect(notations('B:W18,27,19,29:B14,15')).toEqual(['14x23x32', '15x22', '15x24x31']);
  });

  it('makes a jumping piece keep jumping', () => {
    expect(notations('B:W18,27,29:B14')).toEqual(['14x23x32']);
  });

  it('ends the move when a man is crowned mid-jump', () => {
    // After 23x32 the new king could jump 28 backwards, but the move stops at the crown.
    const moves = generateMoves(pos('B:W27,28:B23'));
    expect(moves.map(moveNotation)).toEqual(['23x32']);
    const after = applyMove(pos('B:W27,28:B23'), moves[0]);
    expect(after.board[31]).toBe(2);
    expect(after.board[27]).toBe(-1);
  });

  it('crowns a man on the far row', () => {
    const p = pos('B:W5:B27');
    const m = generateMoves(p).find((x) => moveNotation(x) === '27-32')!;
    expect(applyMove(p, m).board[31]).toBe(2);
    const w = pos('W:W6:B30');
    const mw = generateMoves(w).find((x) => moveNotation(x) === '6-1')!;
    expect(applyMove(w, mw).board[0]).toBe(-2);
  });

  it('lets men move only forward but kings both ways', () => {
    expect(notations('B:W1:B18')).toEqual(['18-22', '18-23']);
    expect(notations('B:W1:BK18')).toEqual(['18-14', '18-15', '18-22', '18-23']);
    expect(notations('W:W18:B32')).toEqual(['18-14', '18-15']);
  });

  it('never jumps the same piece twice and lets a king pass its own start square', () => {
    // King on 10 can loop 10x19x26x17x10 around four pieces, capturing each once.
    const moves = generateMoves(pos('B:W14,15,22,23:BK10'));
    const loop = moves.find((m) => m.captures.length === 4);
    expect(loop).toBeDefined();
    expect(new Set(loop!.captures).size).toBe(4);
    expect(moves.every((m) => new Set(m.captures).size === m.captures.length)).toBe(true);
  });

  it('removes captured pieces only after the whole move', () => {
    const p = pos('B:W18,27,29:B14');
    const after = applyMove(p, generateMoves(p)[0]);
    expect(after.board[17]).toBe(0);
    expect(after.board[26]).toBe(0);
    expect(after.board[28]).toBe(-1);
    expect(after.turn).toBe(-1);
  });

  it('says who won when a side has no move or no pieces', () => {
    expect(gameOverMessage(pos('B:W1:B'))).toMatch(/White wins: Black has no pieces/);
    // The black man on 28 has one forward square (32), and White holds it.
    expect(gameOverMessage(pos('B:W32,27:B28'))).toMatch(/White wins: Black has no legal move/);
    expect(gameOverMessage(startPosition())).toBeNull();
  });
});

describe('position text', () => {
  it('round-trips the start position', () => {
    const fen = toFen(startPosition());
    expect(fen).toBe('B:W21,22,23,24,25,26,27,28,29,30,31,32:B1,2,3,4,5,6,7,8,9,10,11,12');
    expect(toFen(pos(fen))).toBe(fen);
  });
  it('reads kings, ranges and the PDN tag form', () => {
    const p = pos('[FEN "W:WK3,21-23:B1,K9"]');
    expect(p.turn).toBe(-1);
    expect(p.board[2]).toBe(-2);
    expect([p.board[20], p.board[21], p.board[22]]).toEqual([-1, -1, -1]);
    expect(p.board[8]).toBe(2);
  });
  it('rejects bad input with a plain message', () => {
    expect(parseFen('hello').ok).toBe(false);
    expect(parseFen('B:W33:B1').ok).toBe(false);
    expect(parseFen('B:W5:B5').ok).toBe(false);
  });
});

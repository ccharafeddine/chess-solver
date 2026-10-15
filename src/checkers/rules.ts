/**
 * American checkers (English draughts) rules.
 *
 * Squares use the standard 1-32 numbering, stored 0-31. Square 1 is the top
 * left playable square with Black at the top; Black moves first, down the
 * board. A board cell holds 0 (empty), 1 (black man), 2 (black king),
 * -1 (white man) or -2 (white king). Captures are forced, a jumping piece
 * must keep jumping while it can, and a man that reaches the far row is
 * crowned and its move ends there.
 */

export type Side = 1 | -1; // 1 = Black, -1 = White
export type Cell = -2 | -1 | 0 | 1 | 2;

export interface Position {
  board: Int8Array; // 32 cells
  turn: Side;
}

export interface Move {
  from: number;
  /** Landing squares in order; the last one is where the piece ends. */
  path: number[];
  captures: number[];
}

export const BLACK: Side = 1;
export const WHITE: Side = -1;

export function rowOf(s: number): number {
  return s >> 2;
}
export function colOf(s: number): number {
  const r = s >> 2;
  return 2 * (s & 3) + (r % 2 === 0 ? 1 : 0);
}
/** The square index at (row, col), or -1 if it is off the board or a light square. */
export function squareAt(row: number, col: number): number {
  if (row < 0 || row > 7 || col < 0 || col > 7) return -1;
  if ((row + col) % 2 === 0) return -1;
  return row * 4 + (col >> 1);
}

const DIRS: [number, number][] = [[1, -1], [1, 1], [-1, -1], [-1, 1]];
/** STEP[s][d] and JUMP[s][d]: the neighbour and the square beyond it, or -1. */
export const STEP: number[][] = [];
export const JUMP: number[][] = [];
for (let s = 0; s < 32; s++) {
  const r = rowOf(s), c = colOf(s);
  STEP.push(DIRS.map(([dr, dc]) => squareAt(r + dr, c + dc)));
  JUMP.push(DIRS.map(([dr, dc]) => squareAt(r + 2 * dr, c + 2 * dc)));
}
/** Direction indexes a piece may use: black men go down (0,1), white men up (2,3). */
function dirsFor(cell: number): number[] {
  if (cell === 1) return [0, 1];
  if (cell === -1) return [2, 3];
  return [0, 1, 2, 3];
}
const crownRow = (side: Side) => (side === BLACK ? 7 : 0);

export function startPosition(): Position {
  const board = new Int8Array(32);
  for (let s = 0; s < 12; s++) board[s] = 1;
  for (let s = 20; s < 32; s++) board[s] = -1;
  return { board, turn: BLACK };
}
export function emptyPosition(turn: Side = BLACK): Position {
  return { board: new Int8Array(32), turn };
}
export function clonePosition(p: Position): Position {
  return { board: new Int8Array(p.board), turn: p.turn };
}

function jumpsFrom(board: Int8Array, from: number, piece: number, side: Side, out: Move[]): void {
  const path: number[] = [];
  const caps: number[] = [];
  const isMan = piece === 1 || piece === -1;
  const dfs = (sq: number) => {
    let extended = false;
    // A man that has just been crowned stops; it cannot keep jumping as a king.
    if (!(isMan && path.length > 0 && rowOf(sq) === crownRow(side))) {
      for (const d of dirsFor(piece)) {
        const over = STEP[sq][d];
        const land = JUMP[sq][d];
        if (land < 0) continue;
        const v = board[over];
        if (v === 0 || Math.sign(v) === side || caps.includes(over)) continue;
        // Captured pieces stay on the board until the move ends, so they block landings.
        if (board[land] !== 0 && land !== from) continue;
        extended = true;
        caps.push(over);
        path.push(land);
        dfs(land);
        path.pop();
        caps.pop();
      }
    }
    if (!extended && path.length > 0) out.push({ from, path: path.slice(), captures: caps.slice() });
  };
  dfs(from);
}

/** Every legal move for the side to move. Captures, when there are any, are the only legal moves. */
export function generateMoves(p: Position): Move[] {
  const { board, turn } = p;
  const jumps: Move[] = [];
  for (let s = 0; s < 32; s++) {
    const v = board[s];
    if (v !== 0 && Math.sign(v) === turn) jumpsFrom(board, s, v, turn, jumps);
  }
  if (jumps.length) return dedupe(jumps);
  const moves: Move[] = [];
  for (let s = 0; s < 32; s++) {
    const v = board[s];
    if (v === 0 || Math.sign(v) !== turn) continue;
    for (const d of dirsFor(v)) {
      const to = STEP[s][d];
      if (to >= 0 && board[to] === 0) moves.push({ from: s, path: [to], captures: [] });
    }
  }
  return moves;
}

/** Two jump routes that take the same pieces and land on the same square give the same position. */
function dedupe(moves: Move[]): Move[] {
  const seen = new Set<string>();
  return moves.filter((m) => {
    const key = `${m.from}:${m.path[m.path.length - 1]}:${[...m.captures].sort((a, b) => a - b).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function hasCapture(p: Position): boolean {
  const out: Move[] = [];
  for (let s = 0; s < 32; s++) {
    const v = p.board[s];
    if (v !== 0 && Math.sign(v) === p.turn) {
      jumpsFrom(p.board, s, v, p.turn, out);
      if (out.length) return true;
    }
  }
  return false;
}

export function moveTo(m: Move): number {
  return m.path[m.path.length - 1];
}

export function applyMove(p: Position, m: Move): Position {
  const board = new Int8Array(p.board);
  let piece = board[m.from];
  board[m.from] = 0;
  for (const c of m.captures) board[c] = 0;
  const to = moveTo(m);
  if ((piece === 1 && rowOf(to) === 7) || (piece === -1 && rowOf(to) === 0)) piece = (piece * 2) as Cell;
  board[to] = piece;
  return { board, turn: (-p.turn) as Side };
}

/** Standard notation: 11-15 for a step, 15x24x31 for a jump (1-based squares). */
export function moveNotation(m: Move): string {
  if (m.captures.length === 0) return `${m.from + 1}-${m.path[0] + 1}`;
  return [m.from, ...m.path].map((s) => s + 1).join('x');
}

export function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.path.length === b.path.length && a.path.every((s, i) => s === b.path[i]);
}

export function perft(p: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = generateMoves(p);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(p, m), depth - 1);
  return n;
}

export function countPieces(p: Position): { black: number; white: number; blackKings: number; whiteKings: number } {
  let black = 0, white = 0, blackKings = 0, whiteKings = 0;
  for (const v of p.board) {
    if (v > 0) { black++; if (v === 2) blackKings++; }
    if (v < 0) { white++; if (v === -2) whiteKings++; }
  }
  return { black, white, blackKings, whiteKings };
}

/**
 * Position text in the PDN FEN style: side to move, then each side's squares,
 * with K marking kings. Example: B:W21,22,K30:B1,2,K9
 */
export function toFen(p: Position): string {
  const list = (side: Side) => {
    const out: string[] = [];
    for (let s = 0; s < 32; s++) {
      const v = p.board[s];
      if (v !== 0 && Math.sign(v) === side) out.push(`${Math.abs(v) === 2 ? 'K' : ''}${s + 1}`);
    }
    return out.join(',');
  };
  return `${p.turn === BLACK ? 'B' : 'W'}:W${list(WHITE)}:B${list(BLACK)}`;
}

export type FenResult = { ok: true; value: Position } | { ok: false; error: string };

export function parseFen(text: string): FenResult {
  const t = text.trim().replace(/^\[FEN\s+"/i, '').replace(/"\]$/, '').replace(/\.$/, '').replace(/\s+/g, '');
  const parts = t.split(':');
  if (parts.length < 2 || !/^[BW]$/i.test(parts[0])) {
    return { ok: false, error: 'Use the form B:W21,22,K30:B1,2,K9 (side to move, then White and Black squares).' };
  }
  const p = emptyPosition(parts[0].toUpperCase() === 'B' ? BLACK : WHITE);
  for (const part of parts.slice(1)) {
    const side = part[0]?.toUpperCase();
    if (side !== 'W' && side !== 'B') return { ok: false, error: `"${part}" should start with W or B.` };
    const sign = side === 'B' ? 1 : -1;
    const body = part.slice(1);
    if (!body) continue;
    for (const raw of body.split(',')) {
      const king = /^K/i.test(raw);
      const range = raw.replace(/^K/i, '').split('-').map(Number);
      const [a, b = a] = range;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b > 32 || a > b) {
        return { ok: false, error: `"${raw}" is not a square from 1 to 32.` };
      }
      for (let n = a; n <= b; n++) {
        const s = n - 1;
        if (p.board[s] !== 0) return { ok: false, error: `Square ${n} is listed twice.` };
        const man = !king && rowOf(s) !== (sign === 1 ? 7 : 0);
        p.board[s] = (man ? sign : 2 * sign) as Cell;
      }
    }
  }
  return { ok: true, value: p };
}

/** A short plain-words result when the side to move has no move, else null. */
export function gameOverMessage(p: Position): string | null {
  if (generateMoves(p).length > 0) return null;
  const winner = p.turn === BLACK ? 'White' : 'Black';
  const loser = p.turn === BLACK ? 'Black' : 'White';
  const { black, white } = countPieces(p);
  const none = p.turn === BLACK ? black === 0 : white === 0;
  return none ? `${winner} wins: ${loser} has no pieces left.` : `${winner} wins: ${loser} has no legal move.`;
}

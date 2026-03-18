import { Chess, type Square } from 'chess.js';

const PIECE_SYMBOLS: Record<string, string> = {
  k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N',
};

function uciFallback(fen: string, uciMove: string): string {
  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  const promotion = uciMove.length > 4 ? uciMove.slice(4).toUpperCase() : '';

  // Try to figure out the piece from the FEN
  const file = from.charCodeAt(0) - 97;
  const rank = 8 - parseInt(from[1]);
  const rows = fen.split(' ')[0].split('/');
  if (rank >= 0 && rank < 8 && rows[rank]) {
    let col = 0;
    for (const ch of rows[rank]) {
      const d = parseInt(ch);
      if (!isNaN(d)) {
        col += d;
      } else {
        if (col === file) {
          const symbol = PIECE_SYMBOLS[ch.toLowerCase()];
          if (symbol && symbol !== 'K') {
            // Pawn has no symbol prefix
            if (ch.toLowerCase() === 'p') {
              return `${to}${promotion ? `=${promotion}` : ''}`;
            }
            return `${symbol}${to}${promotion ? `=${promotion}` : ''}`;
          }
          if (symbol === 'K') {
            return `K${to}`;
          }
          break;
        }
        col++;
      }
    }
  }

  return uciMove;
}

export function uciToSan(fen: string, uciMove: string): string {
  try {
    const chess = new Chess(fen);
    const from = uciMove.slice(0, 2) as Square;
    const to = uciMove.slice(2, 4) as Square;
    const promotion = uciMove.length > 4 ? uciMove.slice(4) : undefined;
    const move = chess.move({ from, to, promotion });
    return move.san;
  } catch {
    return uciFallback(fen, uciMove);
  }
}

export function isKingInCheck(fen: string, side: 'w' | 'b'): boolean {
  const board = expandFenToGrid(fen);
  if (!board) return false;

  const kingChar = side === 'w' ? 'K' : 'k';
  let kr = -1, kf = -1;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (board[r][f] === kingChar) { kr = r; kf = f; }
    }
  }
  if (kr === -1) return false;

  const isEnemy = (ch: string) =>
    side === 'w' ? ch >= 'a' && ch <= 'z' : ch >= 'A' && ch <= 'Z';
  const enemyIs = (ch: string, piece: string) =>
    isEnemy(ch) && ch.toLowerCase() === piece;

  // Knight attacks
  const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, df] of knightMoves) {
    const r = kr + dr, f = kf + df;
    if (r >= 0 && r < 8 && f >= 0 && f < 8 && enemyIs(board[r][f], 'n')) return true;
  }

  // Pawn attacks
  const pawnDir = side === 'w' ? -1 : 1;
  for (const df of [-1, 1]) {
    const r = kr + pawnDir, f = kf + df;
    if (r >= 0 && r < 8 && f >= 0 && f < 8 && enemyIs(board[r][f], 'p')) return true;
  }

  // King adjacency
  for (let dr = -1; dr <= 1; dr++) {
    for (let df = -1; df <= 1; df++) {
      if (dr === 0 && df === 0) continue;
      const r = kr + dr, f = kf + df;
      if (r >= 0 && r < 8 && f >= 0 && f < 8 && enemyIs(board[r][f], 'k')) return true;
    }
  }

  // Sliding pieces: rook/queen on ranks/files, bishop/queen on diagonals
  const straight: [number, number][] = [[0,1],[0,-1],[1,0],[-1,0]];
  const diagonal: [number, number][] = [[1,1],[1,-1],[-1,1],[-1,-1]];

  for (const [dr, df] of straight) {
    for (let i = 1; i < 8; i++) {
      const r = kr + dr * i, f = kf + df * i;
      if (r < 0 || r >= 8 || f < 0 || f >= 8) break;
      const ch = board[r][f];
      if (ch !== '.') {
        if (enemyIs(ch, 'r') || enemyIs(ch, 'q')) return true;
        break;
      }
    }
  }

  for (const [dr, df] of diagonal) {
    for (let i = 1; i < 8; i++) {
      const r = kr + dr * i, f = kf + df * i;
      if (r < 0 || r >= 8 || f < 0 || f >= 8) break;
      const ch = board[r][f];
      if (ch !== '.') {
        if (enemyIs(ch, 'b') || enemyIs(ch, 'q')) return true;
        break;
      }
    }
  }

  return false;
}

function expandFenToGrid(fen: string): string[][] | null {
  const rows = fen.split(' ')[0].split('/');
  if (rows.length !== 8) return null;
  const grid: string[][] = [];
  for (const row of rows) {
    const expanded: string[] = [];
    for (const ch of row) {
      const d = parseInt(ch);
      if (!isNaN(d)) {
        for (let i = 0; i < d; i++) expanded.push('.');
      } else {
        expanded.push(ch);
      }
    }
    if (expanded.length !== 8) return null;
    grid.push(expanded);
  }
  return grid;
}

export function formatEval(cp: number, mate: number | null): string {
  if (mate !== null) {
    return `M${Math.abs(mate)}`;
  }

  const sign = cp >= 0 ? '+' : '';
  return `${sign}${(cp / 100).toFixed(1)}`;
}

export function evalColor(cp: number, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? 'eval-winning' : 'eval-losing';
  }

  if (cp > 150) return 'eval-winning';
  if (cp > 50) return 'eval-slight-advantage';
  if (cp >= -50) return 'eval-equal';
  if (cp >= -150) return 'eval-slight-disadvantage';
  return 'eval-losing';
}

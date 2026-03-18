import { Chess, type Square, type Color, type PieceSymbol } from 'chess.js';

export interface TacticalMotif {
  type:
    | 'fork'
    | 'pin'
    | 'skewer'
    | 'check'
    | 'checkmate'
    | 'capture'
    | 'promotion'
    | 'discovered_attack';
  description: string;
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

const FILES = 'abcdefgh';
const RANKS = '12345678';

const ALL_SQUARES: Square[] = [];
for (const f of FILES) {
  for (const r of RANKS) {
    ALL_SQUARES.push((f + r) as Square);
  }
}

function fileIndex(sq: Square): number {
  return FILES.indexOf(sq[0]);
}

function rankIndex(sq: Square): number {
  return RANKS.indexOf(sq[1]);
}

function squareAt(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return (FILES[file] + RANKS[rank]) as Square;
}

type Direction = [number, number];

const ROOK_DIRS: Direction[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];
const BISHOP_DIRS: Direction[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const QUEEN_DIRS: Direction[] = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_OFFSETS: Direction[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

function getAttackedSquares(
  board: Chess,
  square: Square,
  piece: PieceSymbol,
  color: Color
): Square[] {
  const f = fileIndex(square);
  const r = rankIndex(square);
  const attacked: Square[] = [];

  if (piece === 'n') {
    for (const [df, dr] of KNIGHT_OFFSETS) {
      const sq = squareAt(f + df, r + dr);
      if (sq) attacked.push(sq);
    }
    return attacked;
  }

  if (piece === 'p') {
    const dir = color === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const sq = squareAt(f + df, r + dir);
      if (sq) attacked.push(sq);
    }
    return attacked;
  }

  if (piece === 'k') {
    for (const [df, dr] of QUEEN_DIRS) {
      const sq = squareAt(f + df, r + dr);
      if (sq) attacked.push(sq);
    }
    return attacked;
  }

  const dirs =
    piece === 'r' ? ROOK_DIRS : piece === 'b' ? BISHOP_DIRS : QUEEN_DIRS;

  for (const [df, dr] of dirs) {
    let cf = f + df;
    let cr = r + dr;
    while (cf >= 0 && cf <= 7 && cr >= 0 && cr <= 7) {
      const sq = squareAt(cf, cr)!;
      attacked.push(sq);
      if (board.get(sq)) break;
      cf += df;
      cr += dr;
    }
  }

  return attacked;
}

function scanRay(
  board: Chess,
  startFile: number,
  startRank: number,
  df: number,
  dr: number
): { square: Square; piece: PieceSymbol; color: Color }[] {
  const pieces: { square: Square; piece: PieceSymbol; color: Color }[] = [];
  let cf = startFile + df;
  let cr = startRank + dr;
  while (cf >= 0 && cf <= 7 && cr >= 0 && cr <= 7) {
    const sq = squareAt(cf, cr)!;
    const p = board.get(sq);
    if (p) {
      pieces.push({ square: sq, piece: p.type, color: p.color });
    }
    cf += df;
    cr += dr;
  }
  return pieces;
}

function detectForks(
  board: Chess,
  toSquare: Square,
  movedPiece: PieceSymbol,
  ourColor: Color
): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];
  const enemyColor: Color = ourColor === 'w' ? 'b' : 'w';
  const attacked = getAttackedSquares(board, toSquare, movedPiece, ourColor);

  const forkedPieces: { piece: PieceSymbol; square: Square }[] = [];
  for (const sq of attacked) {
    const target = board.get(sq);
    if (target && target.color === enemyColor && target.type !== 'p') {
      forkedPieces.push({ piece: target.type, square: sq });
    }
  }

  if (forkedPieces.length >= 2) {
    const names = forkedPieces.map((fp) => PIECE_NAMES[fp.piece]);
    motifs.push({
      type: 'fork',
      description: `${PIECE_NAMES[movedPiece]} forks ${names.join(' and ')}`,
    });
  }

  return motifs;
}

function detectPins(
  board: Chess,
  ourColor: Color
): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];
  const enemyColor: Color = ourColor === 'w' ? 'b' : 'w';

  const enemyKingSquares = board.findPiece({ type: 'k', color: enemyColor });
  if (enemyKingSquares.length === 0) return motifs;
  const kingSquare = enemyKingSquares[0];
  const kf = fileIndex(kingSquare);
  const kr = rankIndex(kingSquare);

  for (const [df, dr] of QUEEN_DIRS) {
    const isDiagonal = df !== 0 && dr !== 0;
    const piecesOnRay = scanRay(board, kf, kr, df, dr);

    if (piecesOnRay.length < 2) continue;

    const first = piecesOnRay[0];
    const second = piecesOnRay[1];

    if (first.color !== enemyColor) continue;
    if (second.color !== ourColor) continue;

    const attackerCanSlide = isDiagonal
      ? second.piece === 'b' || second.piece === 'q'
      : second.piece === 'r' || second.piece === 'q';

    if (!attackerCanSlide) continue;

    motifs.push({
      type: 'pin',
      description: `${PIECE_NAMES[first.piece]} on ${first.square} is pinned to the King`,
    });
  }

  return motifs;
}

function detectSkewers(
  board: Chess,
  toSquare: Square,
  movedPiece: PieceSymbol,
  ourColor: Color
): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];
  if (movedPiece !== 'r' && movedPiece !== 'b' && movedPiece !== 'q') {
    return motifs;
  }

  const enemyColor: Color = ourColor === 'w' ? 'b' : 'w';
  const f = fileIndex(toSquare);
  const r = rankIndex(toSquare);

  const dirs =
    movedPiece === 'r'
      ? ROOK_DIRS
      : movedPiece === 'b'
        ? BISHOP_DIRS
        : QUEEN_DIRS;

  for (const [df, dr] of dirs) {
    const piecesOnRay = scanRay(board, f, r, df, dr);
    if (piecesOnRay.length < 2) continue;

    const first = piecesOnRay[0];
    const second = piecesOnRay[1];

    if (first.color !== enemyColor || second.color !== enemyColor) continue;

    const VALUE_ORDER: Record<PieceSymbol, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 100,
    };

    if (VALUE_ORDER[first.piece] > VALUE_ORDER[second.piece]) {
      motifs.push({
        type: 'skewer',
        description: `${PIECE_NAMES[movedPiece]} skewers ${PIECE_NAMES[first.piece]} to ${PIECE_NAMES[second.piece]}`,
      });
    }
  }

  return motifs;
}

function detectDiscoveredAttack(
  beforeBoard: Chess,
  afterBoard: Chess,
  fromSquare: Square,
  ourColor: Color
): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];
  const enemyColor: Color = ourColor === 'w' ? 'b' : 'w';
  const f = fileIndex(fromSquare);
  const r = rankIndex(fromSquare);

  for (const [df, dr] of QUEEN_DIRS) {
    const isDiagonal = df !== 0 && dr !== 0;

    let cf = f - df;
    let cr = r - dr;
    let behindPiece: { piece: PieceSymbol; color: Color } | null = null;
    while (cf >= 0 && cf <= 7 && cr >= 0 && cr <= 7) {
      const sq = squareAt(cf, cr)!;
      const p = beforeBoard.get(sq);
      if (p) {
        behindPiece = { piece: p.type, color: p.color };
        break;
      }
      cf -= df;
      cr -= dr;
    }

    if (!behindPiece || behindPiece.color !== ourColor) continue;

    const canSlide = isDiagonal
      ? behindPiece.piece === 'b' || behindPiece.piece === 'q'
      : behindPiece.piece === 'r' || behindPiece.piece === 'q';

    if (!canSlide) continue;

    let af = f + df;
    let ar = r + dr;
    while (af >= 0 && af <= 7 && ar >= 0 && ar <= 7) {
      const sq = squareAt(af, ar)!;
      const p = afterBoard.get(sq);
      if (p) {
        if (p.color === enemyColor && (p.type === 'q' || p.type === 'r' || p.type === 'k')) {
          motifs.push({
            type: 'discovered_attack',
            description: `Discovered attack by ${PIECE_NAMES[behindPiece.piece]} on ${PIECE_NAMES[p.type]}`,
          });
        }
        break;
      }
      af += df;
      ar += dr;
    }
  }

  return motifs;
}

export function detectTactics(fen: string, moveUci: string): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];

  const before = new Chess(fen);
  const fromSq = moveUci.slice(0, 2) as Square;
  const toSq = moveUci.slice(2, 4) as Square;
  const promotion = moveUci.length > 4 ? moveUci[4] : undefined;

  const movingPiece = before.get(fromSq);
  if (!movingPiece) return motifs;

  const ourColor = movingPiece.color;
  const captured = before.get(toSq);

  if (captured && captured.color !== ourColor) {
    motifs.push({
      type: 'capture',
      description: `${PIECE_NAMES[movingPiece.type]} captures ${PIECE_NAMES[captured.type]} on ${toSq}`,
    });
  }

  if (promotion) {
    motifs.push({
      type: 'promotion',
      description: `Pawn promotes to ${PIECE_NAMES[promotion as PieceSymbol]}`,
    });
  }

  const after = new Chess(fen);
  try {
    after.move({ from: fromSq, to: toSq, promotion });
  } catch {
    return motifs;
  }

  if (after.isCheckmate()) {
    motifs.push({ type: 'checkmate', description: 'Checkmate' });
  } else if (after.isCheck()) {
    motifs.push({
      type: 'check',
      description: `${PIECE_NAMES[promotion ? (promotion as PieceSymbol) : movingPiece.type]} gives check`,
    });
  }

  const landedPiece = promotion ? (promotion as PieceSymbol) : movingPiece.type;
  motifs.push(...detectForks(after, toSq, landedPiece, ourColor));
  motifs.push(...detectPins(after, ourColor));
  motifs.push(...detectSkewers(after, toSq, landedPiece, ourColor));
  motifs.push(...detectDiscoveredAttack(before, after, fromSq, ourColor));

  return motifs;
}

// FEN board-editing helpers. The board editor allows positions that are not
// reachable in a legal game, so these operate on raw FEN text instead of
// chess.js (which rejects illegal positions).

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export const FEN_PIECE_MAP: Record<string, string> = {
  K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P',
  k: 'k', q: 'q', r: 'r', b: 'b', n: 'n', p: 'p',
};

export function expandRow(row: string): string {
  let result = '';
  for (const ch of row) {
    const digit = parseInt(ch);
    if (!isNaN(digit)) {
      result += '.'.repeat(digit);
    } else {
      result += ch;
    }
  }
  return result;
}

export function compressRow(row: string): string {
  let result = '';
  let empties = 0;
  for (const ch of row) {
    if (ch === '.') {
      empties++;
    } else {
      if (empties > 0) {
        result += empties;
        empties = 0;
      }
      result += ch;
    }
  }
  if (empties > 0) result += empties;
  return result;
}

function getPieceAt(expanded: string[], file: number, rank: number): string {
  return expanded[rank][file];
}

function castleMove(
  expanded: string[],
  piece: string,
  fromFile: number,
  fromRank: number,
  toFile: number,
  toRank: number,
): boolean {
  if (piece !== 'K' && piece !== 'k') return false;
  if (fromRank !== toRank || fromFile !== 4) return false;
  if (Math.abs(toFile - fromFile) !== 2) return false;

  const kingside = toFile > fromFile;
  const rookChar = piece === 'K' ? 'R' : 'r';
  const rookFile = kingside ? 7 : 0;
  if (expanded[fromRank][rookFile] !== rookChar) return false;

  const step = kingside ? 1 : -1;
  for (let file = fromFile + step; file !== rookFile; file += step) {
    if (expanded[fromRank][file] !== '.') return false;
  }
  return true;
}

function computeCastling(expanded: string[]): string {
  let castling = '';
  // White: king on e1 (file 4, rank 7)
  if (getPieceAt(expanded, 4, 7) === 'K') {
    if (getPieceAt(expanded, 7, 7) === 'R') castling += 'K';
    if (getPieceAt(expanded, 0, 7) === 'R') castling += 'Q';
  }
  // Black: king on e8 (file 4, rank 0)
  if (getPieceAt(expanded, 4, 0) === 'k') {
    if (getPieceAt(expanded, 7, 0) === 'r') castling += 'k';
    if (getPieceAt(expanded, 0, 0) === 'r') castling += 'q';
  }
  return castling || '-';
}

export function buildFen(boardPart: string, turn: string): string {
  const expanded = boardPart.split('/').map(expandRow);
  const castling = computeCastling(expanded);
  return `${boardPart} ${turn} ${castling} - 0 1`;
}

export function editBoard(fen: string, square: string, piece: string | null): string {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1]);

  const expanded = rows.map(expandRow);
  const row = expanded[rank].split('');
  row[file] = piece ? FEN_PIECE_MAP[piece] : '.';
  expanded[rank] = row.join('');

  const boardPart = expanded.map(compressRow).join('/');
  return buildFen(boardPart, parts[1]);
}

export function movePiece(fen: string, from: string, to: string): string {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const expanded = rows.map(expandRow);

  const fromFile = from.charCodeAt(0) - 97;
  const fromRank = 8 - parseInt(from[1]);
  const toFile = to.charCodeAt(0) - 97;
  const toRank = 8 - parseInt(to[1]);

  const piece = expanded[fromRank][fromFile];
  if (piece === '.') return fen;

  // A two-square king slide is castling only when it really is one: the king
  // starts on the e-file, the corner rook is still there, and every square
  // between them is empty. Anything else (no rook, or the start position,
  // where the bishop and knight block Ke1-g1) must move the king alone.
  // Treating every two-square slide as castling created a rook on the
  // bishop's square and deleted the piece on the corner.
  const castle = castleMove(expanded, piece, fromFile, fromRank, toFile, toRank);

  // Clear source square
  const srcRow = expanded[fromRank].split('');
  srcRow[fromFile] = '.';
  expanded[fromRank] = srcRow.join('');

  // Place piece on destination
  const destRow = expanded[toRank].split('');
  destRow[toFile] = piece;
  expanded[toRank] = destRow.join('');

  if (castle) {
    const kingside = toFile > fromFile;
    const rookChar = piece === 'K' ? 'R' : 'r';
    const rookFromFile = kingside ? 7 : 0;
    const rookToFile = kingside ? 5 : 3;
    const castleRow = expanded[fromRank].split('');
    castleRow[rookFromFile] = '.';
    castleRow[rookToFile] = rookChar;
    expanded[fromRank] = castleRow.join('');
  }

  const boardPart = expanded.map(compressRow).join('/');
  return buildFen(boardPart, parts[1]);
}

export function hasBothColors(fen: string): boolean {
  const board = fen.split(' ')[0];
  let hasWhite = false;
  let hasBlack = false;
  for (const ch of board) {
    if (ch >= 'A' && ch <= 'Z') hasWhite = true;
    if (ch >= 'a' && ch <= 'z') hasBlack = true;
    if (hasWhite && hasBlack) return true;
  }
  return false;
}

export function hasKings(fen: string): boolean {
  const board = fen.split(' ')[0];
  return board.includes('K') && board.includes('k');
}

export function isAnalyzable(fen: string): boolean {
  if (!hasBothColors(fen) || !hasKings(fen)) return false;

  const parts = fen.split(' ');
  if (parts.length < 4) return false;

  const rows = parts[0].split('/');
  if (rows.length !== 8) return false;

  // Check each row sums to 8 squares
  for (const row of rows) {
    let count = 0;
    for (const ch of row) {
      const d = parseInt(ch);
      count += isNaN(d) ? 1 : d;
    }
    if (count !== 8) return false;
  }

  // Exactly one king per side
  const board = parts[0];
  if ((board.match(/K/g) || []).length !== 1) return false;
  if ((board.match(/k/g) || []).length !== 1) return false;

  return true;
}

import type { Cell } from './rules';

/** A checker drawn with the same theme tokens as the chess pieces, so it follows every skin. */
export function CheckerPiece({ cell, size = 100 }: { cell: Cell; size?: number | string }) {
  if (cell === 0) return null;
  const side = cell > 0 ? 'b' : 'w';
  const king = Math.abs(cell) === 2;
  const fill = `var(--pc-${side}-fill)`;
  const stroke = `var(--pc-${side}-stroke)`;
  const detail = `var(--pc-${side}-detail)`;
  return (
    <svg className="piece-svg checker-svg" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="54" r="38" fill={stroke} opacity="0.55" />
      <circle cx="50" cy="50" r="38" fill={fill} stroke={stroke} strokeWidth="3" />
      <circle cx="50" cy="50" r="27" fill="none" stroke={detail} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="18" fill="none" stroke={detail} strokeWidth="1.5" opacity="0.7" />
      {king && (
        <path
          d="M30 60 L27 38 L39 49 L50 32 L61 49 L73 38 L70 60 Z"
          fill={detail}
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

interface CheckersBoardProps {
  board: Int8Array;
  flipped: boolean;
  boardWidth: number;
  selected: number | null;
  targets: number[];
  lastMove: number[];
  hint: number[];
  onSquareClick: (square: number) => void;
}

export default function CheckersBoard({ board, flipped, boardWidth, selected, targets, lastMove, hint, onSquareClick }: CheckersBoardProps) {
  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const sq = boardWidth / 8;
  return (
    <div className="board-frame" style={{ width: boardWidth + 24 }}>
      <div className="checkers-board" style={{ width: boardWidth, height: boardWidth }} role="grid" aria-label="Checkers board">
        {rows.map((r) =>
          cols.map((c) => {
            const dark = (r + c) % 2 === 1;
            if (!dark) return <div key={`${r}-${c}`} className="ck-sq ck-light" />;
            const s = r * 4 + (c >> 1);
            const cls = [
              'ck-sq ck-dark',
              lastMove.includes(s) || hint.includes(s) ? 'ck-hl' : '',
              selected === s ? 'ck-selected' : '',
            ].join(' ');
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={cls}
                onClick={() => onSquareClick(s)}
                aria-label={`Square ${s + 1}${board[s] ? `, ${board[s] > 0 ? 'Black' : 'White'} ${Math.abs(board[s]) === 2 ? 'king' : 'man'}` : ''}`}
              >
                <span className="ck-num" style={{ fontSize: Math.max(9, sq * 0.15) }}>{s + 1}</span>
                <CheckerPiece cell={board[s] as Cell} size="86%" />
                {targets.includes(s) && <span className="ck-target" aria-hidden="true" />}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

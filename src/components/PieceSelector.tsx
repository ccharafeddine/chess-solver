interface PieceSelectorProps {
  onSelectPiece: (piece: string | null) => void;
  selectedPiece: string | null;
}

const UNICODE_PIECES: Record<string, string> = {
  K: '\u2654',
  Q: '\u2655',
  R: '\u2656',
  B: '\u2657',
  N: '\u2658',
  P: '\u2659',
  k: '\u265A',
  q: '\u265B',
  r: '\u265C',
  b: '\u265D',
  n: '\u265E',
  p: '\u265F',
};

const WHITE_PIECES = ['K', 'Q', 'R', 'B', 'N', 'P'];
const BLACK_PIECES = ['k', 'q', 'r', 'b', 'n', 'p'];

export default function PieceSelector({
  onSelectPiece,
  selectedPiece,
}: PieceSelectorProps) {
  return (
    <div className="piece-selector">
      <div className="piece-row-label">White</div>
      <div className="piece-row">
        {WHITE_PIECES.map((p) => (
          <button
            key={p}
            className={`piece-btn piece-btn-white${selectedPiece === p ? ' piece-btn-active' : ''}`}
            onClick={() => onSelectPiece(selectedPiece === p ? null : p)}
            title={p}
          >
            {UNICODE_PIECES[p]}
          </button>
        ))}
      </div>
      <div className="piece-row-label">Black</div>
      <div className="piece-row">
        {BLACK_PIECES.map((p) => (
          <button
            key={p}
            className={`piece-btn piece-btn-black${selectedPiece === p ? ' piece-btn-active' : ''}`}
            onClick={() => onSelectPiece(selectedPiece === p ? null : p)}
            title={p}
          >
            {UNICODE_PIECES[p]}
          </button>
        ))}
      </div>
      <button
        className={`piece-btn piece-btn-remove${selectedPiece === 'REMOVE' ? ' piece-btn-active' : ''}`}
        onClick={() =>
          onSelectPiece(selectedPiece === 'REMOVE' ? null : 'REMOVE')
        }
      >
        Remove
      </button>
    </div>
  );
}

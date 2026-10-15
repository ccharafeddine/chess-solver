import { PieceSvg } from './pieces';
import type { PieceKind } from './pieceArt';

interface PieceSelectorProps {
  onSelectPiece: (piece: string | null) => void;
  selectedPiece: string | null;
}

const NAMES: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

const WHITE_PIECES = ['K', 'Q', 'R', 'B', 'N', 'P'];
const BLACK_PIECES = ['k', 'q', 'r', 'b', 'n', 'p'];

export default function PieceSelector({
  onSelectPiece,
  selectedPiece,
}: PieceSelectorProps) {
  return (
    <div className="piece-selector">
      <div className="piece-row" role="group" aria-label="Place a piece">
        {WHITE_PIECES.map((p) => (
          <button
            key={p}
            className={`piece-btn piece-btn-white${selectedPiece === p ? ' piece-btn-active' : ''}`}
            onClick={() => onSelectPiece(selectedPiece === p ? null : p)}
            title={`White ${NAMES[p]}`}
            aria-label={`White ${NAMES[p]}`}
            aria-pressed={selectedPiece === p}
          >
            <PieceSvg kind={p as PieceKind} side="w" />
          </button>
        ))}
        <span className="piece-sep" aria-hidden="true" />
        {BLACK_PIECES.map((p) => (
          <button
            key={p}
            className={`piece-btn piece-btn-black${selectedPiece === p ? ' piece-btn-active' : ''}`}
            onClick={() => onSelectPiece(selectedPiece === p ? null : p)}
            title={`Black ${NAMES[p.toUpperCase()]}`}
            aria-label={`Black ${NAMES[p.toUpperCase()]}`}
            aria-pressed={selectedPiece === p}
          >
            <PieceSvg kind={p.toUpperCase() as PieceKind} side="b" />
          </button>
        ))}
        <button
        className={`piece-btn piece-btn-remove${selectedPiece === 'REMOVE' ? ' piece-btn-active' : ''}`}
        onClick={() =>
          onSelectPiece(selectedPiece === 'REMOVE' ? null : 'REMOVE')
        }
      >
        Remove
      </button>
      </div>
    </div>
  );
}

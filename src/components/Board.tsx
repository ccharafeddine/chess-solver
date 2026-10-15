import { Chessboard, type PieceRenderObject } from 'react-chessboard';
import { PieceSvg } from './pieces';
import type { PieceKind } from './pieceArt';

type Side = 'w' | 'b';

interface HighlightSquares {
  from: string;
  to: string;
}

interface BoardProps {
  position: string;
  orientation: 'white' | 'black';
  onSquareClick: (square: string) => void;
  onPieceDrop: (from: string, to: string) => boolean;
  highlightSquares: HighlightSquares | null;
  boardWidth: number;
}

const KINDS: PieceKind[] = ['K', 'Q', 'R', 'B', 'N', 'P'];

/** react-chessboard's piece map (wK, bQ, ...) built from the app's set. */
const themedPieces: PieceRenderObject = Object.fromEntries(
  (['w', 'b'] as Side[]).flatMap((side) =>
    KINDS.map((kind) => [`${side}${kind}`, (props?: { svgStyle?: React.CSSProperties }) => <PieceSvg kind={kind} side={side} style={props?.svgStyle} />]),
  ),
);

// Every colour is a theme token, so the board restyles with the skin and mode.
const HIGHLIGHT_STYLE: React.CSSProperties = { boxShadow: 'inset 0 0 0 999px var(--sq-hl)' };
const NOTATION = { fontFamily: 'var(--font)', fontWeight: 700, fontSize: '11px' };

export default function Board({
  position,
  orientation,
  onSquareClick,
  onPieceDrop,
  highlightSquares,
  boardWidth,
}: BoardProps) {
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (highlightSquares) {
    squareStyles[highlightSquares.from] = HIGHLIGHT_STYLE;
    squareStyles[highlightSquares.to] = HIGHLIGHT_STYLE;
  }

  return (
    <div className="board-frame" style={{ width: boardWidth + 24 }}>
      <Chessboard
        options={{
          position,
          boardOrientation: orientation,
          allowDragging: true,
          pieces: themedPieces,
          darkSquareStyle: { backgroundColor: 'var(--sq-dark)' },
          lightSquareStyle: { backgroundColor: 'var(--sq-light)' },
          darkSquareNotationStyle: { ...NOTATION, color: 'var(--sq-coord-dark)' },
          lightSquareNotationStyle: { ...NOTATION, color: 'var(--sq-coord-light)' },
          dropSquareStyle: { boxShadow: 'inset 0 0 0 3px var(--accent)' },
          squareStyles,
          boardStyle: { width: boardWidth, height: boardWidth },
          onSquareClick: ({ square }) => onSquareClick(square),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare) return false;
            return onPieceDrop(sourceSquare, targetSquare);
          },
        }}
      />
    </div>
  );
}

import { Chessboard } from 'react-chessboard';

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

const HIGHLIGHT_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(0, 120, 255, 0.4)',
};

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
    <Chessboard
      options={{
        position,
        boardOrientation: orientation,
        allowDragging: true,
        darkSquareStyle: { backgroundColor: '#779952' },
        lightSquareStyle: { backgroundColor: '#edeed1' },
        squareStyles,
        boardStyle: { width: boardWidth, height: boardWidth },
        onSquareClick: ({ square }) => onSquareClick(square),
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare) return false;
          return onPieceDrop(sourceSquare, targetSquare);
        },
      }}
    />
  );
}

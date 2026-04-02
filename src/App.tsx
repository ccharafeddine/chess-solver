import { useState, useEffect, useRef, useCallback } from 'react';
import Board from './components/Board';
import PieceSelector from './components/PieceSelector';
import BoardControls from './components/BoardControls';
import AnalysisPanel from './components/AnalysisPanel';
import type { AnalysisLineDisplay } from './components/AnalysisPanel';
import { StockfishEngine } from './engine/stockfish';
import type { AnalysisLine } from './engine/stockfish';
import { uciToSan, isKingInCheck, detectGameEnd } from './engine/utils';
import { detectTactics } from './engine/tactics';
import { lookupOpening } from './engine/openings';
import './App.css';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

const FEN_PIECE_MAP: Record<string, string> = {
  K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P',
  k: 'k', q: 'q', r: 'r', b: 'b', n: 'n', p: 'p',
};

function expandRow(row: string): string {
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

function compressRow(row: string): string {
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

function buildFen(boardPart: string, turn: string): string {
  const expanded = boardPart.split('/').map(expandRow);
  const castling = computeCastling(expanded);
  return `${boardPart} ${turn} ${castling} - 0 1`;
}

function editBoard(fen: string, square: string, piece: string | null): string {
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

function movePiece(fen: string, from: string, to: string): string {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const expanded = rows.map(expandRow);

  const fromFile = from.charCodeAt(0) - 97;
  const fromRank = 8 - parseInt(from[1]);
  const toFile = to.charCodeAt(0) - 97;
  const toRank = 8 - parseInt(to[1]);

  const piece = expanded[fromRank][fromFile];
  if (piece === '.') return fen;

  // Clear source square
  const srcRow = expanded[fromRank].split('');
  srcRow[fromFile] = '.';
  expanded[fromRank] = srcRow.join('');

  // Place piece on destination
  const destRow = expanded[toRank].split('');
  destRow[toFile] = piece;
  expanded[toRank] = destRow.join('');

  // Detect castling: king moves exactly 2 files on the same rank
  if ((piece === 'K' || piece === 'k') && fromRank === toRank && Math.abs(toFile - fromFile) === 2) {
    const castleRow = expanded[fromRank].split('');
    if (toFile > fromFile) {
      // Kingside: move rook from h-file (7) to f-file (5)
      castleRow[7] = '.';
      castleRow[5] = piece === 'K' ? 'R' : 'r';
    } else {
      // Queenside: move rook from a-file (0) to d-file (3)
      castleRow[0] = '.';
      castleRow[3] = piece === 'K' ? 'R' : 'r';
    }
    expanded[fromRank] = castleRow.join('');
  }

  const boardPart = expanded.map(compressRow).join('/');
  return buildFen(boardPart, parts[1]);
}

function hasBothColors(fen: string): boolean {
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

function hasKings(fen: string): boolean {
  const board = fen.split(' ')[0];
  return board.includes('K') && board.includes('k');
}

function isAnalyzable(fen: string): boolean {
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

function computeBoardWidth(): number {
  const w = window.innerWidth;
  if (w >= 1024) return 480;
  if (w >= 768) return 400;
  return Math.min(w - 32, 400);
}

export default function App() {
  const [fen, setFen] = useState(START_FEN);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [analysisLines, setAnalysisLines] = useState<AnalysisLineDisplay[]>([]);
  const [openingName, setOpeningName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [highlightSquares, setHighlightSquares] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [boardWidth, setBoardWidth] = useState(computeBoardWidth);
  const [positionWarning, setPositionWarning] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [gameEndMessage, setGameEndMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('chess-solver-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const engineRef = useRef<StockfishEngine | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const analysisFenRef = useRef<string>('');

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine.init().then(() => setEngineReady(true));
    return () => engine.destroy();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chess-solver-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => setBoardWidth(computeBoardWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const runAnalysis = useCallback(
    (analysisFen: string) => {
      if (!engineReady || !engineRef.current) {
        setIsAnalyzing(false);
        return;
      }
      if (!isAnalyzable(analysisFen)) {
        setAnalysisLines([]);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);
      analysisFenRef.current = analysisFen;

      console.log('[App] Analyzing FEN:', analysisFen);

      engineRef.current.analyze(analysisFen, (lines: AnalysisLine[], isFinal: boolean) => {
        // Ignore results if FEN has changed since we started
        if (analysisFenRef.current !== analysisFen) {
          console.log('[App] Stale result, ignoring');
          return;
        }

        if (isFinal && lines.length === 0) {
          setAnalysisLines([]);
          setPositionWarning('Engine could not analyze this position. Try adjusting the board.');
          setIsAnalyzing(false);
          return;
        }

        const displayLines: AnalysisLineDisplay[] = lines.map((line) => ({
          move: line.move,
          san: uciToSan(analysisFen, line.move),
          from: line.from,
          to: line.to,
          promotion: line.promotion,
          evaluation: line.evaluation,
          mate: line.mate,
          depth: line.depth,
          pv: line.pv,
          tactics: detectTactics(analysisFen, line.move),
        }));

        setAnalysisLines(displayLines);
        setOpeningName(lookupOpening(analysisFen));
        if (isFinal) {
          setIsAnalyzing(false);
        }
      });
    },
    [engineReady]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAnalysisLines([]);
    setIsAnalyzing(true);

    // Immediately invalidate any in-flight analysis so stale callbacks
    // from a previous FEN are rejected before the debounce fires.
    analysisFenRef.current = fen;

    // Check for checkmate, stalemate, or draw
    const gameEnd = detectGameEnd(fen);
    setGameEndMessage(gameEnd);
    if (gameEnd) {
      setPositionWarning(null);
      setIsAnalyzing(false);
      return;
    }

    // Check if the non-moving side's king is in check (illegal position)
    const movingSide = fen.split(' ')[1] as 'w' | 'b';
    const waitingSide = movingSide === 'w' ? 'b' : 'w';
    const illegal = hasKings(fen) && isKingInCheck(fen, waitingSide);

    if (illegal) {
      const sideLabel = waitingSide === 'w' ? "White's" : "Black's";
      setPositionWarning(
        `${sideLabel} king is in check but it's not their turn. Switch to "${sideLabel} turn" to analyze ${sideLabel.toLowerCase()} responses.`
      );
      setIsAnalyzing(false);
    } else {
      setPositionWarning(null);
    }

    debounceRef.current = setTimeout(() => {
      if (!illegal) {
        runAnalysis(fen);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fen, runAnalysis]);

  const handleSquareClick = (square: string) => {
    if (!selectedPiece) return;

    if (selectedPiece === 'REMOVE') {
      setFen(editBoard(fen, square, null));
    } else {
      setFen(editBoard(fen, square, selectedPiece));
    }
  };

  const handlePieceDrop = (from: string, to: string): boolean => {
    if (from === to) return false;
    setFen(movePiece(fen, from, to));
    return true;
  };

  const handleToggleTurn = () => {
    const newTurn = turn === 'w' ? 'b' : 'w';
    setTurn(newTurn);
    const parts = fen.split(' ');
    const boardPart = parts[0];
    setFen(buildFen(boardPart, newTurn));
  };

  const handleReset = () => {
    setFen(START_FEN);
    setTurn('w');
    setSelectedPiece(null);
    setHighlightSquares(null);
  };

  const handleClear = () => {
    setFen(EMPTY_FEN);
    setTurn('w');
    setSelectedPiece(null);
    setHighlightSquares(null);
    setAnalysisLines([]);
  };

  const handleMakeMove = (from: string, to: string, promotion?: string) => {
    let newFen = movePiece(fen, from, to);
    // Handle promotion: replace the pawn with the promoted piece
    if (promotion) {
      const toFile = to.charCodeAt(0) - 97;
      const toRank = 8 - parseInt(to[1]);
      const parts = newFen.split(' ');
      const rows = parts[0].split('/');
      const expanded = rows.map(expandRow);
      const row = expanded[toRank].split('');
      // Determine color from current turn
      row[toFile] = turn === 'w' ? promotion.toUpperCase() : promotion.toLowerCase();
      expanded[toRank] = row.join('');
      const boardPart = expanded.map(compressRow).join('/');
      newFen = buildFen(boardPart, parts[1]);
    }
    // Switch turn after making a move
    const newTurn = turn === 'w' ? 'b' : 'w';
    const parts = newFen.split(' ');
    const boardPart = parts[0];
    setTurn(newTurn);
    setFen(buildFen(boardPart, newTurn));
    setHighlightSquares({ from, to });
  };

  const handleFlipBoard = () => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'));
  };

  const handleToggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  const handleReanalyze = useCallback(() => {
    setPositionWarning(null);
    setAnalysisLines([]);
    setIsAnalyzing(true);
    setHighlightSquares(null);
    analysisFenRef.current = fen;
    if (engineRef.current) {
      engineRef.current.stop();
    }
    runAnalysis(fen);
  }, [fen, runAnalysis]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chess Solver</h1>
        <button
          className="theme-toggle"
          onClick={handleToggleTheme}
          aria-label="Toggle dark mode"
        >
          <span className="theme-toggle-icon">
            {theme === 'light' ? '\u2600' : '\u263E'}
          </span>
          <span className="theme-toggle-track">
            <span className="theme-toggle-knob" />
          </span>
        </button>
      </header>

      <main className="app-main">
        <div className="board-section">
          <Board
            position={fen}
            orientation={orientation}
            onSquareClick={handleSquareClick}
            onPieceDrop={handlePieceDrop}
            highlightSquares={highlightSquares}
            boardWidth={boardWidth}
          />
          <BoardControls
            turn={turn}
            orientation={orientation}
            onToggleTurn={handleToggleTurn}
            onFlipBoard={handleFlipBoard}
            onReset={handleReset}
            onClear={handleClear}
          />
          <PieceSelector
            onSelectPiece={setSelectedPiece}
            selectedPiece={selectedPiece}
          />
        </div>

        <div className="analysis-section">
          <AnalysisPanel
            lines={analysisLines}
            openingName={openingName}
            isAnalyzing={isAnalyzing}
            turn={turn}
            positionWarning={positionWarning}
            gameEndMessage={gameEndMessage}
            onRefresh={handleReanalyze}
            onMakeMove={handleMakeMove}
            onHighlightMove={(from, to) => setHighlightSquares({ from, to })}
            onClearHighlight={() => setHighlightSquares(null)}
          />
        </div>
      </main>
    </div>
  );
}

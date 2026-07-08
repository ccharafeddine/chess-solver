import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess, validateFen, type Square } from 'chess.js';
import Board from './components/Board';
import PieceSelector from './components/PieceSelector';
import BoardControls from './components/BoardControls';
import AnalysisPanel from './components/AnalysisPanel';
import SettingsMenu from './components/SettingsMenu';
import type { AnalysisLineDisplay } from './components/AnalysisPanel';
import { StockfishEngine } from './engine/stockfish';
import type { AnalysisLine, AnalysisMeta } from './engine/stockfish';
import {
  START_FEN,
  EMPTY_FEN,
  buildFen,
  editBoard,
  movePiece,
  hasKings,
  isAnalyzable,
} from './engine/fen';
import { uciToSan, isKingInCheck, detectGameEnd } from './engine/utils';
import { detectTactics } from './engine/tactics';
import { lookupOpening } from './engine/openings';
import './App.css';

function computeBoardWidth(): number {
  const w = window.innerWidth;
  if (w >= 1024) return 480;
  if (w >= 768) return 400;
  return Math.min(w - 32, 400);
}

interface AnalysisResult {
  fen: string;
  lines: AnalysisLineDisplay[];
  final: boolean;
}

interface EngineWarning {
  fen: string | null; // null = applies regardless of position
  message: string;
}

export default function App() {
  const [fen, setFen] = useState(START_FEN);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineFailed, setEngineFailed] = useState(false);
  const [boardWidth, setBoardWidth] = useState(computeBoardWidth);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  // Analysis output is keyed by the FEN it was computed for. Results for any
  // other position are simply not displayed, so stale engine output can never
  // be shown against the wrong board — no token bookkeeping required.
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [engineWarning, setEngineWarning] = useState<EngineWarning | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta>({ depth: 0, nps: 0, threads: 0 });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('chess-solver-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [multiPV, setMultiPV] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('chess-solver-multipv') ?? '1', 10);
    return [1, 3, 5].includes(saved) ? saved : 1;
  });

  const engineRef = useRef<StockfishEngine | null>(null);

  // Everything below derives from the position, so a rendered frame can never
  // pair one position's board with another position's analysis.
  const turn: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const analyzable = useMemo(() => isAnalyzable(fen), [fen]);
  const gameEndMessage = useMemo(() => detectGameEnd(fen), [fen]);
  const openingName = useMemo(() => lookupOpening(fen), [fen]);
  const illegalWarning = useMemo(() => {
    const waitingSide = turn === 'w' ? 'b' : 'w';
    if (!hasKings(fen) || !isKingInCheck(fen, waitingSide)) return null;
    const sideLabel = waitingSide === 'w' ? "White's" : "Black's";
    return `${sideLabel} king is in check but it's not their turn. Switch to "${sideLabel} turn" to analyze ${sideLabel.toLowerCase()} responses.`;
  }, [fen, turn]);

  const resultIsFresh = analysisResult !== null && analysisResult.fen === fen;
  const analysisLines = resultIsFresh ? analysisResult.lines : [];
  const isAnalyzing =
    analyzable &&
    !gameEndMessage &&
    !illegalWarning &&
    !engineFailed &&
    !(resultIsFresh && analysisResult.final);
  const positionWarning =
    (engineWarning && (engineWarning.fen === null || engineWarning.fen === fen)
      ? engineWarning.message
      : null) ?? illegalWarning;

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    // StrictMode mounts effects twice in dev; results from a disposed
    // engine instance must not touch state.
    let disposed = false;
    engine
      .init()
      .then(() => {
        if (!disposed) setEngineReady(true);
      })
      .catch(() => {
        if (disposed) return;
        setEngineFailed(true);
        setEngineWarning({
          fen: null,
          message: 'The Stockfish engine failed to load. Restart the app to retry.',
        });
      });
    return () => {
      disposed = true;
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chess-solver-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('chess-solver-multipv', String(multiPV));
  }, [multiPV]);

  useEffect(() => {
    const handleResize = () => setBoardWidth(computeBoardWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const runAnalysis = useCallback(
    (analysisFen: string) => {
      if (!engineReady || !engineRef.current || !isAnalyzable(analysisFen)) {
        return;
      }

      engineRef.current.analyze(analysisFen, (lines: AnalysisLine[], meta: AnalysisMeta, isFinal: boolean) => {
        setAnalysisMeta(meta);

        // Drop lines that are not legal in this position — a defense against
        // stale engine output. Only applicable when chess.js can load the
        // position at all; for editor-built positions it can't validate
        // (e.g. pawns on the back rank), trust the engine's own legality.
        let legal = lines;
        if (validateFen(analysisFen).ok) {
          legal = lines.filter((line) => {
            try {
              const chess = new Chess(analysisFen);
              return Boolean(chess.move({ from: line.from, to: line.to, promotion: line.promotion ?? 'q' }));
            } catch {
              return false;
            }
          });
        }

        if (lines.length > 0 && legal.length === 0) {
          // Everything the engine sent was stale garbage; wait for the next
          // stream instead of rendering it or claiming failure.
          return;
        }

        if (isFinal && legal.length === 0) {
          setAnalysisResult({ fen: analysisFen, lines: [], final: true });
          setEngineWarning({
            fen: analysisFen,
            message: 'The engine did not return analysis for this position. Click ↻ to retry.',
          });
          return;
        }

        const displayLines: AnalysisLineDisplay[] = legal.map((line) => ({
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

        setAnalysisResult({ fen: analysisFen, lines: displayLines, final: isFinal });
      }, { multiPV });
    },
    [engineReady, multiPV]
  );

  // Debounced analysis of the current position.
  useEffect(() => {
    if (!analyzable || gameEndMessage || illegalWarning) return;
    const timer = setTimeout(() => runAnalysis(fen), 150);
    return () => clearTimeout(timer);
  }, [fen, analyzable, gameEndMessage, illegalWarning, runAnalysis]);

  const handleSquareClick = (square: string) => {
    if (!selectedPiece) return;

    if (selectedPiece === 'REMOVE') {
      setFen(editBoard(fen, square, null));
    } else {
      setFen(editBoard(fen, square, selectedPiece));
    }
  };

  // Apply a move via chess.js when the position and move are legal — this
  // produces a fully correct FEN (castling rights, en passant, move counters)
  // — and let the caller fall back to raw board editing otherwise.
  const applyMove = (from: string, to: string, promotion?: string): boolean => {
    try {
      const chess = new Chess(fen);
      const move = chess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion ?? 'q',
      });
      if (move) {
        setFen(chess.fen());
        setHighlightSquares({ from, to });
        return true;
      }
    } catch {
      // Position or move not legal for chess.js.
    }
    return false;
  };

  const handlePieceDrop = (from: string, to: string): boolean => {
    if (from === to) return false;
    if (applyMove(from, to)) return true;
    setFen(movePiece(fen, from, to));
    return true;
  };

  const handleToggleTurn = () => {
    const newTurn = turn === 'w' ? 'b' : 'w';
    const boardPart = fen.split(' ')[0];
    setFen(buildFen(boardPart, newTurn));
  };

  const handleReset = () => {
    setFen(START_FEN);
    setSelectedPiece(null);
    setHighlightSquares(null);
  };

  const handleClear = () => {
    setFen(EMPTY_FEN);
    setSelectedPiece(null);
    setHighlightSquares(null);
  };

  const handleMakeMove = (from: string, to: string, promotion?: string) => {
    if (applyMove(from, to, promotion)) return;

    // Fallback for edited positions chess.js can't validate: move the piece
    // manually, apply promotion, and flip the turn.
    let newFen = movePiece(fen, from, to);
    if (promotion) {
      const piece = turn === 'w' ? promotion.toUpperCase() : promotion.toLowerCase();
      newFen = editBoard(newFen, to, piece);
    }
    const newTurn = turn === 'w' ? 'b' : 'w';
    const boardPart = newFen.split(' ')[0];
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
    setEngineWarning(null);
    setAnalysisResult(null);
    setHighlightSquares(null);
    runAnalysis(fen);
  }, [fen, runAnalysis]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <SettingsMenu />
          <h1>Chess Solver</h1>
        </div>
        <button
          className="theme-toggle"
          onClick={handleToggleTheme}
          aria-label="Toggle dark mode"
        >
          <span className="theme-toggle-icon">
            {theme === 'light' ? '☀' : '☾'}
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
            meta={analysisMeta}
            multiPV={multiPV}
            onMultiPVChange={setMultiPV}
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

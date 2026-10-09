import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess, validateFen } from 'chess.js';
import Board from './components/Board';
import PieceSelector from './components/PieceSelector';
import BoardControls from './components/BoardControls';
import AnalysisPanel from './components/AnalysisPanel';
import NotationPanel from './components/NotationPanel';
import SettingsMenu from './components/SettingsMenu';
import { useUpdateCheck } from './useUpdateCheck';
import type { AnalysisLineDisplay } from './components/AnalysisPanel';
import { StockfishEngine, THINK_TIME_CHOICES } from './engine/stockfish';
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
import { detectTactics, type TacticalMotif } from './engine/tactics';
import { lookupOpening } from './engine/openings';
import {
  appendMove,
  emptyGame,
  fenAt,
  legalMove,
  moveSquares,
  parseFenInput,
  parsePgn,
  serializePgn,
  type GameState,
} from './engine/notation';
import './App.css';

function tacticsFor(fen: string, move: string): TacticalMotif[] {
  try {
    return detectTactics(fen, move);
  } catch {
    return [];
  }
}

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

function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [game, setGame] = useState<GameState>(() => emptyGame(START_FEN));
  const [fenError, setFenError] = useState<string | null>(null);
  const [pgnError, setPgnError] = useState<string | null>(null);
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
  // Follow the OS color scheme until the user explicitly toggles a theme;
  // an explicit choice is persisted and wins from then on.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('chess-solver-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [multiPV, setMultiPV] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('chess-solver-multipv') ?? '1', 10);
    return [1, 3, 5].includes(saved) ? saved : 1;
  });
  const [thinkTimeSec, setThinkTimeSec] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('chess-solver-think-time') ?? '3', 10);
    return THINK_TIME_CHOICES.includes(saved) ? saved : 3;
  });
  const updates = useUpdateCheck();

  const engineRef = useRef<StockfishEngine | null>(null);

  // Everything below derives from the position, so a rendered frame can never
  // pair one position's board with another position's analysis. The displayed
  // FEN is the game line replayed up to the cursor, so back/forward and a
  // pasted FEN cannot drift apart from the board.
  const fen = useMemo(
    () => fenAt(game.startFen, game.moves, game.cursor),
    [game],
  );
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
  }, [theme]);

  // Track live OS theme changes while the user hasn't picked a theme.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('chess-solver-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('chess-solver-multipv', String(multiPV));
  }, [multiPV]);

  useEffect(() => {
    localStorage.setItem('chess-solver-think-time', String(thinkTimeSec));
  }, [thinkTimeSec]);

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

        if (!isFinal && lines.length > 0 && legal.length === 0) {
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
          tactics: tacticsFor(analysisFen, line.move),
        }));

        setAnalysisResult({ fen: analysisFen, lines: displayLines, final: isFinal });
      }, { multiPV, movetimeMs: thinkTimeSec * 1000 });
    },
    [engineReady, multiPV, thinkTimeSec]
  );

  // Debounced analysis of the current position. The debounce only coalesces
  // bursts of editor clicks; the engine itself switches positions in
  // milliseconds, so keep it short.
  useEffect(() => {
    if (!analyzable || gameEndMessage || illegalWarning) return;
    const timer = setTimeout(() => runAnalysis(fen), 40);
    return () => clearTimeout(timer);
  }, [fen, analyzable, gameEndMessage, illegalWarning, runAnalysis]);

  // An edit that is not a legal move starts a new line at that position.
  // The previous game is no longer the one on the board.
  const replacePosition = (nextFen: string) => {
    setGame(emptyGame(nextFen));
    setFenError(null);
    setPgnError(null);
  };

  const handleSquareClick = (square: string) => {
    if (!selectedPiece) return;

    if (selectedPiece === 'REMOVE') {
      replacePosition(editBoard(fen, square, null));
    } else {
      replacePosition(editBoard(fen, square, selectedPiece));
    }
  };

  const recordLegalMove = (san: string, from: string, to: string) => {
    setGame((current) => appendMove(current, san));
    setHighlightSquares({ from, to });
    setFenError(null);
    setPgnError(null);
  };

  const handlePieceDrop = (from: string, to: string): boolean => {
    if (from === to) return false;
    const played = legalMove(fen, from, to);
    if (played) {
      recordLegalMove(played.san, played.from, played.to);
      return true;
    }
    replacePosition(movePiece(fen, from, to));
    return true;
  };

  const handleToggleTurn = () => {
    const newTurn = turn === 'w' ? 'b' : 'w';
    const boardPart = fen.split(' ')[0];
    replacePosition(buildFen(boardPart, newTurn));
  };

  const handleReset = () => {
    replacePosition(START_FEN);
    setSelectedPiece(null);
    setHighlightSquares(null);
  };

  const handleClear = () => {
    replacePosition(EMPTY_FEN);
    setSelectedPiece(null);
    setHighlightSquares(null);
  };

  const handleMakeMove = (from: string, to: string, promotion?: string) => {
    const played = legalMove(fen, from, to, promotion);
    if (played) {
      recordLegalMove(played.san, played.from, played.to);
      return;
    }

    // Fallback for edited positions chess.js can't validate: move the piece
    // manually, apply promotion, and flip the turn.
    let newFen = movePiece(fen, from, to);
    if (promotion) {
      const piece = turn === 'w' ? promotion.toUpperCase() : promotion.toLowerCase();
      newFen = editBoard(newFen, to, piece);
    }
    const newTurn = turn === 'w' ? 'b' : 'w';
    const boardPart = newFen.split(' ')[0];
    replacePosition(buildFen(boardPart, newTurn));
    setHighlightSquares({ from, to });
  };

  const handleJump = (cursor: number) => {
    const next = Math.max(0, Math.min(game.moves.length, cursor));
    setGame({ ...game, cursor: next });
    setHighlightSquares(moveSquares(game.startFen, game.moves, next));
  };

  const handleLoadFen = (text: string) => {
    const result = parseFenInput(text);
    if (!result.ok) {
      setFenError(result.error);
      return;
    }
    replacePosition(result.value);
    setSelectedPiece(null);
    setHighlightSquares(null);
  };

  const handleImportPgn = (text: string) => {
    const result = parsePgn(text);
    if (!result.ok) {
      setPgnError(result.error);
      return;
    }
    setGame({
      startFen: result.value.startFen,
      moves: result.value.moves,
      cursor: 0,
      headers: result.value.headers,
    });
    setFenError(null);
    setPgnError(null);
    setSelectedPiece(null);
    setHighlightSquares(null);
  };

  const handleExportPgn = () => {
    downloadText('chess-solver.pgn', serializePgn(game), 'application/x-chess-pgn');
  };

  const handleFlipBoard = () => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'));
  };

  const handleToggleTheme = () => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light';
      localStorage.setItem('chess-solver-theme', next);
      return next;
    });
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
          <SettingsMenu
            thinkTimeSec={thinkTimeSec}
            onThinkTimeChange={setThinkTimeSec}
            updateState={updates.state}
            updateAvailable={updates.available !== null}
            onCheckForUpdates={updates.check}
            autoCheck={updates.autoCheck}
            onAutoCheckChange={updates.setAutoCheck}
          />
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

      {updates.showBanner && updates.available && (
        <div className="update-banner" role="status">
          <span>
            Chess Solver <strong>v{updates.available.latestVersion}</strong> is available
            (you have v{__APP_VERSION__}).
          </span>
          <span className="update-banner-actions">
            <a href={updates.available.url} target="_blank" rel="noopener noreferrer">
              Download
            </a>
            <button onClick={updates.dismiss}>Dismiss</button>
          </span>
        </div>
      )}

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
          <NotationPanel
            fen={fen}
            moves={game.moves}
            cursor={game.cursor}
            fenError={fenError}
            pgnError={pgnError}
            onLoadFen={handleLoadFen}
            onJump={handleJump}
            onImportPgn={handleImportPgn}
            onExportPgn={handleExportPgn}
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

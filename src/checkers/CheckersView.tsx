import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CheckersBoard, { CheckerPiece } from './CheckersBoard';
import { CheckersEngine } from './engine';
import type { WireLine, WorkerReply } from './checkers.worker';
import {
  applyMove, startPosition, gameOverMessage, generateMoves, moveNotation, moveTo, parseFen, toFen, BLACK, WHITE,
  type Cell, type Move, type Position, type Side,
} from './rules';
import { positionKey } from './search';
import { blackBarPercent, checkersEvalClass, formatCheckersEval } from './format';
import { CHECKERS_TOUR, START_FEN } from './tour';

const EMPTY_FEN = 'B:W:B';
const RANK_LABELS = ['Best', '2nd', '3rd', '4th', '5th'];
const LINE_CHOICES = [1, 3, 5];

interface Game {
  startFen: string;
  moves: Move[];
  cursor: number;
}

interface Analysis {
  fen: string;
  depth: number;
  nodes: number;
  elapsedMs: number;
  lines: WireLine[];
  final: boolean;
  error?: string;
}

function positionFrom(fen: string): Position {
  const r = parseFen(fen);
  return r.ok ? r.value : startPosition();
}

function replay(game: Game, upTo: number): Position[] {
  const out = [positionFrom(game.startFen)];
  for (let i = 0; i < upTo; i++) out.push(applyMove(out[i], game.moves[i]));
  return out;
}

function formatNodes(n: number, ms: number): string {
  const nps = ms > 0 ? (n / ms) * 1000 : 0;
  if (nps >= 1_000_000) return `${(nps / 1_000_000).toFixed(1)} Mn/s`;
  if (nps >= 1_000) return `${Math.round(nps / 1_000)} kn/s`;
  return `${Math.round(nps)} n/s`;
}

type Tool = 'b1' | 'b2' | 'w1' | 'w2' | 'remove' | null;
const TOOLS: { id: Exclude<Tool, null>; cell: Cell; label: string }[] = [
  { id: 'b1', cell: 1, label: 'Black piece' },
  { id: 'b2', cell: 2, label: 'Black king' },
  { id: 'w1', cell: -1, label: 'White piece' },
  { id: 'w2', cell: -2, label: 'White king' },
];

interface Props {
  boardWidth: number;
  thinkTimeSec: number;
  multiPV: number;
  onMultiPVChange: (n: number) => void;
}

export default function CheckersView({ boardWidth, thinkTimeSec, multiPV, onMultiPVChange }: Props) {
  const [game, setGame] = useState<Game>({ startFen: START_FEN, moves: [], cursor: 0 });
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [partial, setPartial] = useState<number[]>([]); // landing squares clicked so far in a multi-jump
  const [tool, setTool] = useState<Tool>(null);
  const [mode, setMode] = useState<'analyze' | 'play'>('analyze');
  const [humanSide, setHumanSide] = useState<Side>(BLACK);
  const [showHints, setShowHints] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [hover, setHover] = useState<number[]>([]);
  const [fenDraft, setFenDraft] = useState<{ base: string; text: string }>({ base: START_FEN, text: START_FEN });
  const [fenError, setFenError] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const engineRef = useRef<CheckersEngine | null>(null);

  const positions = useMemo(() => replay(game, game.cursor), [game]);
  const pos = positions[positions.length - 1];
  const fen = useMemo(() => toFen(pos), [pos]);
  const legal = useMemo(() => generateMoves(pos), [pos]);
  const over = useMemo(() => gameOverMessage(pos), [pos]);
  const historyKeys = useMemo(() => positions.slice(0, -1).map(positionKey), [positions]);
  const engineToMove = mode === 'play' && pos.turn !== humanSide && !over && game.cursor === game.moves.length;
  const wantAnalysis = !over && (mode === 'analyze' || engineToMove || showHints);

  if (fenDraft.base !== fen) setFenDraft({ base: fen, text: fen });

  useEffect(() => {
    const engine = new CheckersEngine();
    engineRef.current = engine;
    return () => engine.stop();
  }, []);

  const playMove = useCallback((m: Move) => {
    setGame((g) => ({ ...g, moves: [...g.moves.slice(0, g.cursor), m], cursor: g.cursor + 1 }));
    setSelected(null);
    setPartial([]);
    setHover([]);
  }, []);

  // Analysis (or the engine's own move in Play), restarted whenever the position changes.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!wantAnalysis) { engine.stop(); return; }
    const movetimeMs = engineToMove ? Math.min(thinkTimeSec, 3) * 1000 : thinkTimeSec * 1000;
    const timer = setTimeout(() => {
      engine.analyse({ fen, multiPV: engineToMove ? 1 : multiPV, movetimeMs, history: historyKeys }, (r: WorkerReply) => {
        setAnalysis({ fen, depth: r.depth, nodes: r.nodes, elapsedMs: r.elapsedMs, lines: r.lines, final: r.type !== 'info', error: r.error });
        if (r.type === 'done' && engineToMove && r.lines[0]) {
          const best = generateMoves(positionFrom(fen)).find((m) => m.from === r.lines[0].from && m.path.join() === r.lines[0].path.join());
          if (best) setTimeout(() => playMove(best), 250);
        }
      });
    }, 60);
    return () => { clearTimeout(timer); engine.stop(); };
  }, [fen, wantAnalysis, engineToMove, multiPV, thinkTimeSec, historyKeys, playMove, refreshTick]);

  const fresh = analysis && analysis.fen === fen ? analysis : null;
  const lines = fresh && !engineToMove ? fresh.lines : [];
  const thinking = wantAnalysis && !(fresh?.final);

  // ---------- board clicks ----------
  const candidates = useMemo(() => {
    if (selected === null) return [];
    return legal.filter((m) => m.from === selected && partial.every((s, i) => m.path[i] === s));
  }, [legal, selected, partial]);
  const targets = useMemo(() => [...new Set(candidates.map((m) => m.path[partial.length]).filter((s) => s !== undefined))], [candidates, partial]);
  const movable = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  const humanMayMove = !over && !(mode === 'play' && pos.turn !== humanSide);

  const editSquare = (s: number) => {
    const board = new Int8Array(pos.board);
    const cell = tool === 'remove' ? 0 : TOOLS.find((t) => t.id === tool)!.cell;
    board[s] = board[s] === cell ? 0 : cell;
    // A man on its crowning row is a king.
    if (board[s] === 1 && s >= 28) board[s] = 2;
    if (board[s] === -1 && s < 4) board[s] = -2;
    loadPosition({ board, turn: pos.turn });
  };

  const onSquareClick = (s: number) => {
    if (tool) { editSquare(s); return; }
    if (!humanMayMove) return;
    if (selected !== null && targets.includes(s)) {
      const nextPartial = [...partial, s];
      const done = candidates.filter((m) => m.path.length === nextPartial.length && m.path.every((x, i) => x === nextPartial[i]));
      const still = candidates.filter((m) => m.path[partial.length] === s);
      if (done.length && still.length === done.length) { playMove(done[0]); return; }
      // Only one way to finish from here: play it in one click.
      if (still.length === 1) { playMove(still[0]); return; }
      setPartial(nextPartial);
      return;
    }
    if (movable.has(s)) { setSelected(s === selected ? null : s); setPartial([]); return; }
    setSelected(null);
    setPartial([]);
  };

  const loadPosition = (p: Position) => {
    setGame({ startFen: toFen(p), moves: [], cursor: 0 });
    setSelected(null);
    setPartial([]);
    setFenError(null);
  };
  const loadFen = (text: string): boolean => {
    const r = parseFen(text);
    if (!r.ok) { setFenError(r.error); return false; }
    loadPosition(r.value);
    return true;
  };

  const undo = () => {
    setGame((g) => {
      let cursor = g.cursor - 1;
      // In Play, step back to a position where it is your turn.
      if (mode === 'play') {
        const ps = replay(g, Math.max(0, cursor));
        while (cursor > 0 && ps[cursor].turn !== humanSide) cursor--;
      }
      cursor = Math.max(0, cursor);
      return { ...g, moves: g.moves.slice(0, cursor), cursor };
    });
    setSelected(null);
    setPartial([]);
  };

  const jump = (cursor: number) => {
    setGame((g) => ({ ...g, cursor: Math.max(0, Math.min(g.moves.length, cursor)) }));
    setSelected(null);
    setPartial([]);
  };

  const startPlay = (side: Side) => {
    setMode('play');
    setHumanSide(side);
    setTool(null);
    setFlipped(side === BLACK); // your side at the bottom
  };

  // ---------- tour ----------
  useEffect(() => {
    if (tourStep === null) return;
    const step = CHECKERS_TOUR[tourStep];
    const el = document.getElementById(step.target);
    el?.classList.add('tour-target');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return () => el?.classList.remove('tour-target');
  }, [tourStep]);
  const goTour = (i: number | null) => {
    setTourStep(i);
    if (i === null) return;
    const step = CHECKERS_TOUR[i];
    setTool(null);
    if (step.play) startPlay(BLACK); else if (step.fen) { setMode('analyze'); setFlipped(false); }
    if (step.fen) loadFen(step.fen);
  };

  const lastPlayed = game.cursor > 0 ? game.moves[game.cursor - 1] : null;
  const lastMove = lastPlayed ? [lastPlayed.from, moveTo(lastPlayed)] : [];
  const sideName = pos.turn === BLACK ? 'Black' : 'White';
  const mustJump = legal.length > 0 && legal[0].captures.length > 0;

  let header = `Top moves for ${sideName}`;
  if (over) header = 'Game over';
  else if (mode === 'play' && engineToMove) header = 'Engine is thinking';
  else if (mode === 'play' && !showHints) header = 'Your move';

  const rows: { n: number; a: Move; ai: number; b?: Move; bi?: number }[] = [];
  const firstTurn = positionFrom(game.startFen).turn;
  const offset = firstTurn === WHITE ? 1 : 0;
  for (let i = -offset; i < game.moves.length; i += 2) {
    const a = game.moves[i];
    const b = game.moves[i + 1];
    rows.push({ n: (i + offset) / 2 + 1, a, ai: i + 1, b, bi: i + 2 });
  }

  return (
    <>
      <div className="board-section">
        <div id="ck-board">
          <CheckersBoard
            board={pos.board}
            flipped={flipped}
            boardWidth={boardWidth}
            selected={selected}
            targets={tool ? [] : targets}
            lastMove={hover.length ? [] : lastMove}
            hint={hover}
            onSquareClick={onSquareClick}
          />
        </div>
        <div className="board-controls">
          <button
            className="control-btn turn-btn"
            onClick={() => loadPosition({ board: pos.board, turn: (-pos.turn) as Side })}
            disabled={mode === 'play'}
            title="Switch the side to move"
          >
            <span className="turn-indicator" style={{ backgroundColor: pos.turn === BLACK ? 'var(--pc-b-fill)' : 'var(--pc-w-fill)' }} />
            {sideName}'s turn
          </button>
          <button className="control-btn flip-btn" onClick={() => setFlipped((f) => !f)} title="Flip board">
            <span className="flip-icon">&#8693;</span>
            {flipped ? 'White' : 'Black'} on top
          </button>
          <button className="control-btn" id="ck-undo" onClick={undo} disabled={game.cursor === 0}>Undo</button>
          <button className="control-btn" onClick={() => loadFen(START_FEN)}>Reset</button>
          <button className="control-btn" onClick={() => { setMode('analyze'); loadFen(EMPTY_FEN); }}>Clear</button>
        </div>
        <div className="piece-selector" id="ck-palette">
          <div className="piece-row" role="group" aria-label="Place a piece">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`piece-btn${tool === t.id ? ' piece-btn-active' : ''}`}
                onClick={() => { setTool(tool === t.id ? null : t.id); setMode('analyze'); setSelected(null); }}
                title={t.label}
                aria-label={t.label}
                aria-pressed={tool === t.id}
              >
                <CheckerPiece cell={t.cell} size="100%" />
              </button>
            ))}
            <span className="ck-palette-hint">{tool ? 'Click squares to place. Pick again to stop.' : 'Pick a piece to edit the board.'}</span>
            <button
              className={`piece-btn piece-btn-remove${tool === 'remove' ? ' piece-btn-active' : ''}`}
              onClick={() => { setTool(tool === 'remove' ? null : 'remove'); setMode('analyze'); }}
              aria-pressed={tool === 'remove'}
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <div className="analysis-section">
        <div className="ck-mode-row" id="ck-mode">
          <div className="lines-selector" role="radiogroup" aria-label="Mode">
            <button role="radio" aria-checked={mode === 'analyze'} className={`lines-btn ck-mode-btn ${mode === 'analyze' ? 'lines-btn-active' : ''}`} onClick={() => setMode('analyze')}>Analyze</button>
            <button role="radio" aria-checked={mode === 'play' && humanSide === BLACK} className={`lines-btn ck-mode-btn ${mode === 'play' && humanSide === BLACK ? 'lines-btn-active' : ''}`} onClick={() => startPlay(BLACK)}>Play as Black</button>
            <button role="radio" aria-checked={mode === 'play' && humanSide === WHITE} className={`lines-btn ck-mode-btn ${mode === 'play' && humanSide === WHITE ? 'lines-btn-active' : ''}`} onClick={() => startPlay(WHITE)}>Play as White</button>
          </div>
          <label className={`ck-hints${mode === 'play' ? '' : ' ck-hidden'}`}>
            <input type="checkbox" checked={showHints} onChange={(e) => setShowHints(e.target.checked)} /> Hints
          </label>
          <button className="control-btn ck-tour-btn" onClick={() => goTour(0)}>Tour</button>
        </div>

        <div className="analysis-panel" id="ck-analysis">
          <div className="analysis-header">
            <h2>{header}</h2>
            <div className="analysis-header-right">
              <div className="lines-selector" title="Number of moves to rank (fewer = deeper)">
                {LINE_CHOICES.map((n) => (
                  <button key={n} className={`lines-btn ${multiPV === n ? 'lines-btn-active' : ''}`} onClick={() => onMultiPVChange(n)}>{n}</button>
                ))}
              </div>
              {thinking && lines.length === 0 && <span className="analyzing-spinner" />}
              {fresh && fresh.depth > 0 && (
                <span className="depth-badge">D{fresh.depth}<span className="nps-sub"> · {formatNodes(fresh.nodes, fresh.elapsedMs)}</span></span>
              )}
              <button className="refresh-btn" onClick={() => { setAnalysis(null); setRefreshTick((t) => t + 1); }} title="Refresh analysis">&#8635;</button>
            </div>
          </div>
          <div className="analysis-body">
            {over && <div className="game-end-bar">{over}</div>}
            {fresh?.error && <div className="position-warning"><span>{fresh.error}</span></div>}
            {!over && mustJump && <div className="opening-bar">{sideName} must capture: jumps are required.</div>}
            {mode === 'play' && !over && !engineToMove && !showHints && (
              <p className="ck-note">Your turn. Click a piece, then a dotted square. Turn on Hints to see the engine's advice.</p>
            )}
            {mode === 'play' && engineToMove && <p className="ck-note">The engine is choosing its move…</p>}
            <div className="analysis-lines">
              {lines.map((line, i) => {
                const move = legal.find((m) => m.from === line.from && m.path.join() === line.path.join());
                return (
                  <div
                    key={line.notation + i}
                    className="analysis-line analysis-line-clickable"
                    onClick={() => move && humanMayMove && playMove(move)}
                    onMouseEnter={() => setHover([line.from, ...line.path])}
                    onMouseLeave={() => setHover([])}
                  >
                    <div className="line-rank">
                      <span className={i === 0 ? 'rank-label rank-best' : 'rank-label'}>{RANK_LABELS[i]}</span>
                    </div>
                    <div className="eval-bar-mini ck-eval-bar">
                      <div className="eval-bar-white" style={{ height: `${100 - blackBarPercent(line.score, line.winIn, pos.turn === BLACK)}%` }} />
                    </div>
                    <div className="line-content">
                      <div className="line-main">
                        <span className="line-san">{line.notation}</span>
                        <span className={`line-eval ${checkersEvalClass(line.score, line.winIn)}`}>{formatCheckersEval(line.score, line.winIn)}</span>
                      </div>
                      <div className="line-pv">{line.pv.slice(0, 8).join(' ')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <section className="notation-panel" aria-label="Position and game">
          <div className="notation-label">Position</div>
          <form className="fen-row" onSubmit={(e) => { e.preventDefault(); loadFen(fenDraft.text); }}>
            <input
              className="fen-input"
              aria-label="Position text"
              aria-invalid={fenError ? true : undefined}
              spellCheck={false}
              value={fenDraft.text}
              onChange={(e) => setFenDraft({ base: fen, text: e.target.value })}
            />
            <button type="submit" className="control-btn">Load</button>
            <button type="button" className="control-btn" onClick={() => navigator.clipboard?.writeText(fen).catch(() => {})}>Copy</button>
          </form>
          {fenError && <p className="notation-error" role="alert">{fenError}</p>}
          <div className="notation-heading">
            <div className="notation-label">Moves</div>
            <span className="notation-count">{game.cursor}/{game.moves.length}</span>
          </div>
          <div className="move-list" role="list">
            {game.moves.length === 0 && <p className="notation-empty">No moves yet. Play on the board or click a ranked move.</p>}
            {rows.map((row) => (
              <div key={row.n} className="move-row" role="listitem">
                <span className="move-num">{row.n}.</span>
                {row.a ? (
                  <button type="button" className={game.cursor === row.ai ? 'move-san move-san-active' : 'move-san'} onClick={() => jump(row.ai)}>{moveNotation(row.a)}</button>
                ) : <span className="move-san ck-ellipsis">…</span>}
                {row.b && row.bi !== undefined ? (
                  <button type="button" className={game.cursor === row.bi ? 'move-san move-san-active' : 'move-san'} onClick={() => jump(row.bi!)}>{moveNotation(row.b)}</button>
                ) : <span />}
              </div>
            ))}
          </div>
          <div className="notation-nav">
            <button type="button" className="control-btn" onClick={() => jump(0)} disabled={game.cursor === 0} title="Start">|◀</button>
            <button type="button" className="control-btn" onClick={() => jump(game.cursor - 1)} disabled={game.cursor === 0} title="Back">◀</button>
            <button type="button" className="control-btn" onClick={() => jump(game.cursor + 1)} disabled={game.cursor >= game.moves.length} title="Forward">▶</button>
            <button type="button" className="control-btn" onClick={() => jump(game.moves.length)} disabled={game.cursor >= game.moves.length} title="End">▶|</button>
          </div>
        </section>
      </div>

      {tourStep !== null && (
        <div className="tour-card" role="dialog" aria-label="Checkers tour">
          <div className="tour-head">
            <span className="card-label">Tour · {tourStep + 1} of {CHECKERS_TOUR.length}</span>
            <button className="icon-btn tour-close" onClick={() => goTour(null)} aria-label="Close tour">×</button>
          </div>
          <h3>{CHECKERS_TOUR[tourStep].title}</h3>
          <p>{CHECKERS_TOUR[tourStep].body}</p>
          <div className="tour-actions">
            <button className="control-btn" onClick={() => goTour(tourStep - 1)} disabled={tourStep === 0}>Back</button>
            {tourStep < CHECKERS_TOUR.length - 1 ? (
              <button className="control-btn primary" onClick={() => goTour(tourStep + 1)}>Next</button>
            ) : (
              <button className="control-btn primary" onClick={() => goTour(null)}>Done</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

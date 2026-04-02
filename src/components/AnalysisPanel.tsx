import type { TacticalMotif } from '../engine/tactics';
import { formatEval, evalColor } from '../engine/utils';

export interface AnalysisLineDisplay {
  move: string;
  san: string;
  from: string;
  to: string;
  promotion?: string;
  evaluation: number;
  mate: number | null;
  depth: number;
  pv: string;
  tactics: TacticalMotif[];
}

interface AnalysisPanelProps {
  lines: AnalysisLineDisplay[];
  openingName: string | null;
  isAnalyzing: boolean;
  turn: 'w' | 'b';
  positionWarning: string | null;
  gameEndMessage: string | null;
  onRefresh: () => void;
  onMakeMove: (from: string, to: string, promotion?: string) => void;
  onHighlightMove: (from: string, to: string) => void;
  onClearHighlight: () => void;
}

function evalBarPercent(cp: number, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 100 : 0;
  const clamped = Math.max(-500, Math.min(500, cp));
  return Math.round(50 + (clamped / 500) * 50);
}

function truncatePv(pv: string, maxMoves: number): string {
  return pv.split(' ').slice(0, maxMoves).join(' ');
}

const TACTIC_COLORS: Record<string, string> = {
  fork: '#e74c3c',
  pin: '#e67e22',
  skewer: '#9b59b6',
  check: '#3498db',
  checkmate: '#c0392b',
  capture: '#27ae60',
  promotion: '#f1c40f',
  discovered_attack: '#1abc9c',
};

const RANK_LABELS = ['Best', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

function SkeletonLines() {
  return (
    <div className="analysis-skeleton">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton-line">
          <div className="skeleton-rank" />
          <div className="skeleton-bar" />
          <div className="skeleton-text" />
        </div>
      ))}
    </div>
  );
}

export default function AnalysisPanel({
  lines,
  openingName,
  isAnalyzing,
  turn,
  positionWarning,
  gameEndMessage,
  onRefresh,
  onMakeMove,
  onHighlightMove,
  onClearHighlight,
}: AnalysisPanelProps) {
  const depth = lines.length > 0 ? lines[0].depth : 0;
  const showSkeleton = isAnalyzing && lines.length === 0;
  const sideLabel = turn === 'w' ? 'White' : 'Black';

  return (
    <div className="analysis-panel">
      <div className="analysis-header">
        <h2>
          {gameEndMessage
            ? 'Game Over'
            : lines.length > 0 || isAnalyzing
              ? `Top moves for ${sideLabel}`
              : 'Analysis'}
        </h2>
        <div className="analysis-header-right">
          {isAnalyzing && lines.length === 0 && <span className="analyzing-spinner" />}
          {depth > 0 && <span className="depth-badge">Depth {depth}</span>}
          <button className="refresh-btn" onClick={onRefresh} title="Refresh analysis">
            &#8635;
          </button>
        </div>
      </div>

      {gameEndMessage && (
        <div className="game-end-bar">{gameEndMessage}</div>
      )}

      {positionWarning && (
        <div className="position-warning">
          <span>{positionWarning}</span>
          {!isAnalyzing && lines.length === 0 && (
            <button className="retry-btn" onClick={onRefresh}>Retry</button>
          )}
        </div>
      )}

      {openingName && (
        <div className="opening-bar">{openingName}</div>
      )}

      {showSkeleton && <SkeletonLines />}

      <div className="analysis-lines">
        {lines.map((line, index) => {
          // Stockfish reports eval from the side-to-move's perspective.
          // Positive = good for the side whose moves are listed.
          const eval_ = line.evaluation;
          const mate_ = line.mate;
          const evalStr = formatEval(eval_, mate_);
          const colorClass = evalColor(eval_, mate_);

          // Eval bar shows overall position from White's perspective
          const whiteEval = turn === 'b' ? -eval_ : eval_;
          const whiteMate = mate_ !== null ? (turn === 'b' ? -mate_ : mate_) : null;
          const whitePercent = evalBarPercent(whiteEval, whiteMate);

          return (
            <div
              key={line.move}
              className="analysis-line analysis-line-clickable"
              onClick={() => onMakeMove(line.from, line.to, line.promotion)}
              onMouseEnter={() => onHighlightMove(line.from, line.to)}
              onMouseLeave={onClearHighlight}
            >
              <div className="line-rank">
                <span className={index === 0 ? 'rank-label rank-best' : 'rank-label'}>
                  {RANK_LABELS[index] ?? `${index + 1}th`}
                </span>
              </div>

              <div className="eval-bar-mini">
                <div
                  className="eval-bar-white"
                  style={{ height: `${whitePercent}%` }}
                />
              </div>

              <div className="line-content">
                <div className="line-main">
                  <span className="line-san">{line.san}</span>
                  <span className={`line-eval ${colorClass}`}>{evalStr}</span>
                </div>

                {line.tactics.length > 0 && (
                  <div className="line-tactics">
                    {line.tactics.map((t, ti) => (
                      <span
                        key={ti}
                        className="tactic-badge"
                        style={{ backgroundColor: TACTIC_COLORS[t.type] }}
                        title={t.description}
                      >
                        {t.type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                <div className="line-pv">{truncatePv(line.pv, 6)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

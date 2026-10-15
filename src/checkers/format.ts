import { WIN } from './search';

/** Eval in men (100 = one man) from the side to move's view, or a forced result in moves. */
export function formatCheckersEval(score: number, winIn: number | null): string {
  if (winIn !== null) {
    const moves = Math.ceil(Math.abs(winIn) / 2);
    return winIn > 0 ? `Win in ${moves}` : `Loss in ${moves}`;
  }
  const v = score / 100;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;
}

export function checkersEvalClass(score: number, winIn: number | null): string {
  if (winIn !== null) return winIn > 0 ? 'eval-winning' : 'eval-losing';
  if (score >= 150) return 'eval-winning';
  if (score >= 40) return 'eval-slight-advantage';
  if (score > -40) return 'eval-equal';
  if (score > -150) return 'eval-slight-disadvantage';
  return 'eval-losing';
}

/** Percent of the bar that is Black's (the side shown at the top), 0-100. */
export function blackBarPercent(scoreForMover: number, winIn: number | null, moverIsBlack: boolean): number {
  const sign = moverIsBlack ? 1 : -1;
  if (winIn !== null) return (winIn > 0 ? 1 : -1) * sign > 0 ? 100 : 0;
  const s = Math.max(-500, Math.min(500, scoreForMover * sign));
  return Math.round(50 + (s / 500) * 50);
}

export const isWinScore = (s: number) => Math.abs(s) > WIN - 1000;

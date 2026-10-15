import { GLOSS_PATH, PIECE_ART, type PieceKind } from './pieceArt';

type Side = 'w' | 'b';

/** One piece of the app's own set, coloured by the active theme's --pc-* tokens. */
export function PieceSvg({ kind, side, style }: { kind: PieceKind; side: Side; style?: React.CSSProperties }) {
  const art = PIECE_ART[kind];
  const fill = `var(--pc-${side}-fill)`;
  const stroke = `var(--pc-${side}-stroke)`;
  const detail = `var(--pc-${side}-detail)`;
  const sw = 'var(--pc-stroke-w)';
  return (
    <svg viewBox="0 0 45 45" width="100%" height="100%" className="piece-svg" style={style} aria-hidden="true">
      {art.body.map((d, i) => (
        <path key={i} d={d} style={{ fill, stroke, strokeWidth: sw }} strokeLinejoin="round" />
      ))}
      {art.detail.map((d, i) => (
        <path key={`d${i}`} d={d} fill="none" style={{ stroke: detail, strokeWidth: sw }} strokeLinecap="round" />
      ))}
      {art.dots?.map(([cx, cy, r], i) =>
        kind === 'N' ? (
          <circle key={`o${i}`} cx={cx} cy={cy} r={r} style={{ fill: side === 'w' ? stroke : detail }} />
        ) : (
          <circle key={`o${i}`} cx={cx} cy={cy} r={r} style={{ fill, stroke, strokeWidth: sw }} />
        ),
      )}
      <path d={GLOSS_PATH} style={{ fill: '#fff', opacity: 'var(--pc-gloss)' }} />
    </svg>
  );
}

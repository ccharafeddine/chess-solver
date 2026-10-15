/**
 * The app's own piece set: geometric silhouettes drawn for Chess Solver, not a
 * stock set. Each piece is a body (filled, outlined) plus detail lines. Colours
 * come from the theme's --pc-* tokens, so every skin dresses the same shapes.
 * Coordinates are in a 45 x 45 box.
 */
export type PieceKind = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export interface PieceShape {
  /** Filled and outlined silhouette paths. */
  body: string[];
  /** Thin inner lines drawn in the detail colour. */
  detail: string[];
  /** Small solid dots drawn in the outline colour (eyes, orbs). */
  dots?: [number, number, number][];
}

// Shared plinth: a wide base with a collar above it.
const BASE = 'M11 39.5 h23 a1.5 1.5 0 0 0 1.5 -1.5 v-1.2 a1.8 1.8 0 0 0 -1.8 -1.8 h-21.4 a1.8 1.8 0 0 0 -1.8 1.8 v1.2 a1.5 1.5 0 0 0 1.5 1.5 z';

export const PIECE_ART: Record<PieceKind, PieceShape> = {
  P: {
    body: [
      BASE,
      'M15.5 35 C16 30 18.5 27 20 25.5 L25 25.5 C26.5 27 29 30 29.5 35 Z',
      'M17.5 25.5 h10 a1.2 1.2 0 0 0 0 -2.4 h-10 a1.2 1.2 0 0 0 0 2.4 z',
      'M22.5 9 a6 6 0 1 1 -0.01 0 z',
    ],
    detail: ['M18.5 31.5 h8'],
  },
  R: {
    body: [
      BASE,
      'M14.5 35 L15.5 31 L29.5 31 L30.5 35 Z',
      'M16 31 L17 17 L28 17 L29 31 Z',
      'M13.5 17 h18 v-7 h-3.6 v3 h-3.4 v-3 h-4 v3 h-3.4 v-3 h-3.6 z',
    ],
    detail: ['M16.5 24 h12', 'M17.3 20.5 h10.4'],
  },
  N: {
    body: [
      BASE,
      // Neck and head facing left: crest, ears, brow, muzzle, jaw, chest.
      'M15 35 L16.6 28 C16.8 25.6 15.6 24.4 13.8 23.6 L11 22.8 C9.6 22.3 9.4 20.6 10.4 19.6 L18.2 11.6 L18.6 7.2 L21.4 10.2 L23.6 6.8 L25 10.6 C30.8 12.2 34.2 17.6 33.6 24 L32.4 35 Z',
    ],
    detail: ['M24.6 13.4 C28.8 15.6 30.6 20 30 26', 'M12.4 21.4 L14.6 21'],
    dots: [[18.8, 15.4, 1.3]],
  },
  B: {
    body: [
      BASE,
      'M15 35 C16.5 31 18.5 29.5 19 27.5 L26 27.5 C26.5 29.5 28.5 31 30 35 Z',
      'M17 27.5 h11 a1.2 1.2 0 0 0 0 -2.4 h-11 a1.2 1.2 0 0 0 0 2.4 z',
      'M22.5 9.5 C27.5 13 29.5 18.5 27.6 25.1 L17.4 25.1 C15.5 18.5 17.5 13 22.5 9.5 Z',
      'M22.5 4.2 a2.3 2.3 0 1 1 -0.01 0 z',
    ],
    detail: ['M20.2 20.6 L25.6 14.6', 'M18.5 31.5 h8'],
  },
  Q: {
    body: [
      BASE,
      'M13.5 35 C14.5 31 15.5 29.5 16 28 L29 28 C29.5 29.5 30.5 31 31.5 35 Z',
      // Crown: five points rising from a band.
      'M15.4 28 L11.6 14.6 L17 21.4 L18.4 12.4 L22.5 20.6 L26.6 12.4 L28 21.4 L33.4 14.6 L29.6 28 Z',
    ],
    detail: ['M15.6 24.8 h13.8', 'M17.6 31.5 h9.8'],
    dots: [[11.4, 13.4, 2], [18.4, 10.8, 2], [22.5, 9.2, 2.1], [26.6, 10.8, 2], [33.6, 13.4, 2]],
  },
  K: {
    body: [
      BASE,
      'M13.5 35 C14.5 31 15.5 29.5 16 28 L29 28 C29.5 29.5 30.5 31 31.5 35 Z',
      // Dome with a band.
      'M15.6 28 C12.4 23.6 12.2 18.4 16.6 16.2 C19.2 15 21.4 16 22.5 18 C23.6 16 25.8 15 28.4 16.2 C32.8 18.4 32.6 23.6 29.4 28 Z',
      // Cross.
      'M21.3 15.6 v-4.4 h-3 v-2.4 h3 v-3 h2.4 v3 h3 v2.4 h-3 v4.4 z',
    ],
    detail: ['M16.2 24.6 h12.6', 'M22.5 18.4 v6.2', 'M17.6 31.5 h9.8'],
  },
};

/** The gloss highlight laid over each piece in glossy skins: a soft band on the upper left. */
export const GLOSS_PATH = 'M15 22 C15 15 19 11 22.5 10 C20 13.5 18.5 17.5 18.5 22 Z';

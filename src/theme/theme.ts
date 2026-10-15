/**
 * Theme state: a skin (look) plus a mode (light, dark or follow the OS).
 * The values land on <html> as data-skin and data-theme; tokens.css does the rest.
 */
export const SKINS = ['matte', 'aero', 'neon', 'brutal'] as const;
export type Skin = (typeof SKINS)[number];
export type Mode = 'light' | 'dark' | 'system';
export type Resolved = 'light' | 'dark';

export const DEFAULT_SKIN: Skin = 'matte';
export const SKIN_KEY = 'chess-solver-skin';
export const MODE_KEY = 'chess-solver-theme';

export const SKIN_LABELS: Record<Skin, { name: string; blurb: string }> = {
  matte: { name: 'Matte', blurb: 'Warm paper and wood' },
  aero: { name: 'Frutiger Aero', blurb: 'Glossy glass and sky' },
  neon: { name: 'Neon', blurb: 'Glowing edges, deep night' },
  brutal: { name: 'Neubrutalism', blurb: 'Flat colour, bold outlines' },
};

/** A skin from the URL (?skin=neon), then the saved choice, then matte. */
export function pickSkin(search: string, saved: string | null): Skin {
  const fromUrl = new URLSearchParams(search).get('skin');
  for (const s of [fromUrl, saved]) if (s && (SKINS as readonly string[]).includes(s)) return s as Skin;
  return DEFAULT_SKIN;
}

/** The saved mode; anything unknown (or nothing) means follow the OS. */
export function pickMode(saved: string | null): Mode {
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

export function resolveMode(mode: Mode, osDark: boolean): Resolved {
  return mode === 'system' ? (osDark ? 'dark' : 'light') : mode;
}

export function applyTheme(root: HTMLElement, skin: Skin, resolved: Resolved): void {
  root.setAttribute('data-skin', skin);
  root.setAttribute('data-theme', resolved);
}

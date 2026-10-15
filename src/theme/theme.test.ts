/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_SKIN, SKINS, pickMode, pickSkin, resolveMode } from './theme';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8');

const BASE: Record<string, string> = {
  matte: ":root, :root[data-skin='matte'] {",
  aero: ":root[data-skin='aero'] {",
  neon: ":root[data-skin='neon'] {",
  brutal: ":root[data-skin='brutal'] {",
};
/** Each skin's other mode overrides its base block. Neon's base is dark. */
const OVERRIDE: Record<string, [string, string]> = {
  matte: ['dark', ":root[data-skin='matte'][data-theme='dark'] {"],
  aero: ['dark', ":root[data-skin='aero'][data-theme='dark'] {"],
  neon: ['light', ":root[data-skin='neon'][data-theme='light'] {"],
  brutal: ['dark', ":root[data-skin='brutal'][data-theme='dark'] {"],
};

function block(sel: string): Map<string, string> {
  const i = css.indexOf(sel);
  expect(i, sel).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', i), close = css.indexOf('\n}', open);
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '');
  return new Map([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
/** All 8 variants, fully resolved: name -> token map. */
function variants(): [string, Map<string, string>][] {
  const out: [string, Map<string, string>][] = [];
  for (const s of SKINS) {
    const base = block(BASE[s]);
    const [other, sel] = OVERRIDE[s];
    out.push([`${s} ${other === 'dark' ? 'light' : 'dark'}`, base]);
    out.push([`${s} ${other}`, new Map([...base, ...block(sel)])]);
  }
  return out;
}

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h: string) => {
  const c = rgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const HEX = /^#[0-9a-f]{6}$/;

describe('design tokens', () => {
  it('has all 8 variants: four skins, each light and dark', () => {
    expect(variants().map(([n]) => n).sort()).toEqual(
      ['aero dark', 'aero light', 'brutal dark', 'brutal light', 'matte dark', 'matte light', 'neon dark', 'neon light'],
    );
  });

  it('every skin defines every token the default skin defines', () => {
    const matte = block(BASE.matte);
    expect(matte.size).toBeGreaterThan(60);
    for (const s of SKINS) {
      const b = block(BASE[s]);
      expect([...matte.keys()].filter((v) => !b.has(v)), s).toEqual([]);
    }
  });

  it('the other-mode blocks only override tokens that exist', () => {
    const matte = block(BASE.matte);
    for (const s of SKINS) {
      const o = block(OVERRIDE[s][1]);
      expect([...o.keys()].filter((v) => !matte.has(v)), s).toEqual([]);
      expect(o.size, s).toBeGreaterThan(40);
    }
  });

  it('declares light or dark color-scheme to match each variant', () => {
    for (const [name, t] of variants()) expect(t.get('color-scheme') ?? '', name).toBe('');
    for (const s of SKINS) {
      expect(css.slice(css.indexOf(OVERRIDE[s][1])).split('\n}')[0]).toContain(`color-scheme: ${OVERRIDE[s][0]}`);
    }
  });

  const AA = 4.5;
  const pairs: [string, string, number][] = [
    ['--text', '--surface-solid', 7],
    ['--text-muted', '--surface-solid', AA],
    ['--link', '--surface-solid', AA],
    ['--select-text', '--select-bg', AA],
    ['--select-hover-text', '--select-hover-bg', AA],
    ['--eval-winning', '--surface-solid', AA],
    ['--eval-slight-advantage', '--surface-solid', AA],
    ['--eval-equal', '--surface-solid', AA],
    ['--eval-slight-disadvantage', '--surface-solid', AA],
    ['--eval-losing', '--surface-solid', AA],
    ['--warning', '--surface-solid', AA],
    ['--opening-text', '--surface-solid', AA],
    ['--star', '--surface-solid', 3],
  ];
  for (const [fg, bg, min] of pairs) {
    it(`${fg} on ${bg} meets ${min}:1 in all 8 variants`, () => {
      for (const [name, t] of variants()) {
        const f = t.get(fg), b = t.get(bg);
        expect(f, `${name} ${fg}`).toMatch(HEX);
        expect(b, `${name} ${bg}`).toMatch(HEX);
        expect(contrast(f!, b!), `${name}: ${fg} ${f} on ${bg} ${b}`).toBeGreaterThanOrEqual(min);
      }
    });
  }

  it('board coordinates stay readable on their squares, and pieces stand out', () => {
    for (const [name, t] of variants()) {
      // Coordinates on light squares sit on --sq-light, and vice versa.
      expect(contrast(t.get('--sq-coord-light')!, t.get('--sq-light')!), name).toBeGreaterThanOrEqual(3);
      expect(contrast(t.get('--sq-coord-dark')!, t.get('--sq-dark')!), name).toBeGreaterThanOrEqual(3);
      // Each piece's outline separates it from both square colours, or its fill does.
      for (const side of ['w', 'b'])
        for (const sq of ['--sq-light', '--sq-dark']) {
          const fill = t.get(`--pc-${side}-fill`)!, stroke = t.get(`--pc-${side}-stroke`)!;
          const best = Math.max(contrast(fill, t.get(sq)!), contrast(stroke, t.get(sq)!));
          expect(best, `${name} ${side} on ${sq}`).toBeGreaterThanOrEqual(3);
        }
      // White and black pieces are told apart by fill.
      expect(contrast(t.get('--pc-w-fill')!, t.get('--pc-b-fill')!), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('respects reduced transparency', () => {
    expect(css).toMatch(/prefers-reduced-transparency: reduce/);
  });
});

describe('theme choice', () => {
  it('defaults to matte, honours ?skin= then the saved skin', () => {
    expect(DEFAULT_SKIN).toBe('matte');
    expect(pickSkin('', null)).toBe('matte');
    expect(pickSkin('?skin=neon', 'aero')).toBe('neon');
    expect(pickSkin('', 'aero')).toBe('aero');
    expect(pickSkin('?skin=bogus', 'nope')).toBe('matte');
  });
  it('defaults to System, which follows the OS', () => {
    expect(pickMode(null)).toBe('system');
    expect(pickMode('garbage')).toBe('system');
    expect(pickMode('dark')).toBe('dark');
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
    expect(resolveMode('dark', false)).toBe('dark');
  });
});

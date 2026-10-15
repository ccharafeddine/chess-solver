/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf-8');
const tokens = read('./tokens.css');
const base = read('../index.css');
const app = read('../App.css');
const appTsx = read('../App.tsx');
const settings = read('../components/SettingsMenu.tsx');
const styles = base + app;

const declared = (() => {
  const i = tokens.indexOf(":root, :root[data-skin='matte'] {");
  const body = tokens.slice(tokens.indexOf('{', i), tokens.indexOf('\n}', i));
  return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
})();

describe('component styles', () => {
  it('use only declared theme tokens (plus a few local ones)', () => {
    // '--pc-' is the prefix pieces.tsx builds per side (var(--pc-${side}-fill)).
    const local = ['--chev', '--tactic', '--analysis-h', '--pc-'];
    const sources = [styles, read('../components/Board.tsx'), read('../components/pieces.tsx'), read('../components/BoardControls.tsx')];
    for (const src of sources) {
      const used = new Set([...src.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
      expect([...used].filter((v) => !declared.has(v) && !local.includes(v) && !/^--pc-\$\{/.test(v))).toEqual([]);
    }
  });

  it('hard-code no colours outside the skin previews', () => {
    const outside = app.split('/* Previews use fixed colours')[0] + app.split('.mode-row {')[1];
    expect(outside.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
  });

  it('take panel, card, control and chip corners from the theme', () => {
    expect(base).toMatch(/dialog \{[^}]*border-radius: var\(--corner-panel\)/);
    expect(app).toMatch(/\.analysis-panel, \.notation-panel, \.piece-selector, \.update-banner \{[^}]*border-radius: var\(--corner-card\)/);
    expect(app).toMatch(/\.board-frame \{[^}]*border-radius: var\(--corner-panel\)/);
    expect(base).toMatch(/border-radius: var\(--corner-control\)/);
    expect(app).toMatch(/clip-path: var\(--panel-clip\)/);
    for (const t of ['--corner-panel', '--corner-card', '--corner-control', '--corner-chip', '--edge-detail', '--corner-art', '--panel-clip'])
      expect(declared.has(t), t).toBe(true);
  });

  it('keep selects readable on hover, focus and active, apart from button hover', () => {
    expect(base).toMatch(/select:hover, select:focus-visible, select:active, select:focus \{ color: var\(--select-hover-text\); background-color: var\(--select-hover-bg\)/);
    expect(base).toMatch(/select option, select optgroup \{ color: var\(--select-text\); background-color: var\(--select-bg\)/);
    expect(styles).not.toMatch(/select:hover \{ background:/);
  });

  it('never shift the layout: a stable scrollbar gutter and fixed-height scrolling panels', () => {
    expect(base).toMatch(/html \{ scrollbar-gutter: stable; \}/);
    expect(app).toMatch(/\.analysis-body \{ height: var\(--analysis-h[^;]*\); overflow-y: auto;/);
    expect(app).toMatch(/\.move-list \{ height: \d+px; overflow-y: auto;/);
  });

  it('respect reduced motion', () => {
    expect(base).toMatch(/prefers-reduced-motion: reduce/);
  });
});

describe('brand', () => {
  it('bundles the Bungee title font after the token import, never from a CDN', () => {
    const face = /@font-face\s*{[^}]*font-family:\s*'Bungee'[^}]*url\('([^']+)'\)/.exec(base);
    expect(face).not.toBeNull();
    expect(face![1]).not.toMatch(/^https?:|^\/\//);
    expect(existsSync(new URL(face![1], new URL('../index.css', import.meta.url)))).toBe(true);
    expect(styles).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\./);
    expect(base.indexOf('@import')).toBeLessThan(base.indexOf('@font-face'));
    expect(app).toMatch(/\.app-header h1 \{ font-family: 'Bungee'/);
  });

  it('shows no version next to the title', () => {
    const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(appTsx)![1];
    expect(h1).not.toMatch(/VERSION|version|v\d/);
  });

  it('has one gear that opens Settings with appearance, updates and the version', () => {
    const header = /<header[\s\S]*?<\/header>/.exec(appTsx)![0];
    expect(header).toContain('id="settings"');
    expect(header).not.toMatch(/theme-toggle/);
    for (const id of ['theme-skins', 'theme-modes', 'check-update', 'version', 'settings-close']) expect(settings).toContain(`id="${id}"`);
    expect(settings).toContain('<dialog');
  });

  it('keeps the update check, its settings and banner out of the web build', () => {
    expect(settings).toMatch(/\{!__WEB_BUILD__ && \(\s*<>\s*<h3>Updates<\/h3>/);
    expect(appTsx).toContain('useUpdateCheck(!__WEB_BUILD__)');
    expect(appTsx).toContain('{!__WEB_BUILD__ && updates.showBanner');
  });

  it('ships the logo, favicon, app icons and social card', () => {
    for (const f of ['../assets/logo.svg', '../../public/favicon.svg', '../../public/icon-192.png', '../../public/icon-512.png', '../../public/og-image.png', '../../build/icon.png', '../../build/icon.ico'])
      expect(existsSync(new URL(f, import.meta.url)), f).toBe(true);
    const html = read('../../index.html');
    // Domain-independent: relative paths and no og:url in the source; SITE_URL at build time makes them absolute.
    expect(html).not.toContain('og:url');
    expect(html).not.toMatch(/chafic\.me/);
    expect(html).toContain('<meta name="twitter:image" content="./og-image.png" />');
    const og = /property="og:image" content="\.\/([^"]+)"/.exec(html);
    expect(og).not.toBeNull();
    expect(existsSync(new URL(`../../public/${og![1]}`, import.meta.url))).toBe(true);
  });
});

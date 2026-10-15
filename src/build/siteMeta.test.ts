import { describe, it, expect } from 'vitest';
import { applySiteUrl, normalizeSiteUrl } from './siteMeta';

const HTML = `<head>
    <meta property="og:title" content="X" />
    <meta property="og:image" content="./og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="./og-image.png" />
</head>`;

describe('SITE_URL link previews', () => {
  it('leaves relative paths and no og:url when SITE_URL is unset or blank', () => {
    expect(applySiteUrl(HTML, undefined)).toBe(HTML);
    expect(applySiteUrl(HTML, '  ')).toBe(HTML);
    expect(applySiteUrl(HTML, undefined)).not.toContain('og:url');
  });
  it('makes og:image and twitter:image absolute and adds og:url', () => {
    const out = applySiteUrl(HTML, 'https://demo.example.com/');
    expect(out).toContain('<meta property="og:url" content="https://demo.example.com/" />');
    expect(out).toContain('<meta property="og:image" content="https://demo.example.com/og-image.png" />');
    expect(out).toContain('<meta name="twitter:image" content="https://demo.example.com/og-image.png" />');
    expect(out).not.toContain('./og-image.png');
    expect(out.match(/og:url/g)).toHaveLength(1);
  });
  it('keeps a sub-path and drops trailing slashes', () => {
    expect(normalizeSiteUrl('https://a.test/app///')).toBe('https://a.test/app');
    expect(applySiteUrl(HTML, 'https://a.test/app')).toContain('content="https://a.test/app/og-image.png"');
  });
  it('rejects a SITE_URL that is not an absolute http(s) URL', () => {
    expect(() => normalizeSiteUrl('chess.example.com')).toThrow(/SITE_URL/);
    expect(() => normalizeSiteUrl('ftp://a.test')).toThrow(/SITE_URL/);
  });
});

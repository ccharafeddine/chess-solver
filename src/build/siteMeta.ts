/**
 * Link-preview tags that depend on where the site is deployed. index.html
 * keeps relative paths and no og:url, so a build works on any host. When the
 * SITE_URL environment variable is set at build time (for example
 * SITE_URL=https://example.com npm run build), the Vite plugin in
 * vite.config.ts rewrites og:image and twitter:image to absolute URLs on that
 * origin and adds og:url, which link-preview crawlers need.
 */
export function normalizeSiteUrl(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    throw new Error(`SITE_URL must be an absolute http(s) URL, got "${v}"`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`SITE_URL must be http(s), got "${v}"`);
  return u.href.replace(/\/+$/, '');
}

export function applySiteUrl(html: string, siteUrl: string | undefined): string {
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return html;
  let out = html.replace(
    /(<meta (?:property="og:image"|name="twitter:image") content=")\.\/([^"]*)"/g,
    (_m, start: string, path: string) => `${start}${base}/${path}"`,
  );
  if (!/property="og:url"/.test(out)) {
    out = out.replace(/^([ \t]*)(<meta property="og:image")/m, (_m, indent: string, tag: string) => `${indent}<meta property="og:url" content="${base}/" />\n${indent}${tag}`);
  }
  return out;
}

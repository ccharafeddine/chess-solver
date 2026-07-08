const RELEASES_API = 'https://api.github.com/repos/ccharafeddine/chess-solver/releases/latest';
const RELEASES_PAGE = 'https://github.com/ccharafeddine/chess-solver/releases/latest';

export interface UpdateStatus {
  state: 'update-available' | 'up-to-date' | 'no-releases';
  latestVersion?: string;
  url?: string;
}

/** Compare dotted numeric versions ("1.2.0" vs "1.10"). Ignores a leading "v". */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

export async function checkForUpdates(currentVersion: string): Promise<UpdateStatus> {
  const res = await fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return { state: 'no-releases' };
  if (!res.ok) throw new Error(`GitHub API responded with ${res.status}`);

  const data = (await res.json()) as { tag_name?: string; html_url?: string };
  if (!data.tag_name) return { state: 'no-releases' };

  const latestVersion = data.tag_name.replace(/^v/i, '');
  if (compareVersions(latestVersion, currentVersion) > 0) {
    // Only trust GitHub links out of the API response.
    const url = data.html_url?.startsWith('https://github.com/') ? data.html_url : RELEASES_PAGE;
    return { state: 'update-available', latestVersion, url };
  }
  return { state: 'up-to-date', latestVersion };
}

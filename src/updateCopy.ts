import type { UpdateCheckState } from './useUpdateCheck';

/**
 * Wording for the update check. The desktop app offers a download of the new
 * installer. The web build cannot install anything: it gets new versions when
 * the site is redeployed, so it points to what's new and offers a reload.
 */
export interface UpdateCopy {
  checkButton: string;
  autoCheckLabel: string;
  linkLabel: string;
  engineCredit: string;
  banner: (latest: string, current: string) => string;
}

export function updateCopy(web: boolean): UpdateCopy {
  return web
    ? {
        checkButton: 'Check for a new version',
        autoCheckLabel: 'Check for a new version when the page opens',
        linkLabel: "What's new",
        engineCredit: 'Analysis by Stockfish 18 lite (GPL-3.0), running in your browser.',
        banner: (latest, current) =>
          `Chess Solver v${latest} is out (this page runs v${current}). Reload to pick it up once this site updates.`,
      }
    : {
        checkButton: 'Check for updates',
        autoCheckLabel: 'Check automatically at startup',
        linkLabel: 'Download',
        engineCredit: 'Analysis by Stockfish 18 (GPL-3.0).',
        banner: (latest, current) => `Chess Solver v${latest} is available (you have v${current}).`,
      };
}

export interface UpdateResult {
  message: string;
  url?: string;
  error?: boolean;
}

/** The line under the check button in Settings, or null for nothing to say. */
export function describeUpdate(state: UpdateCheckState, current: string, web: boolean): UpdateResult | null {
  if (state.phase === 'error') {
    return state.manual ? { message: 'Could not reach GitHub. Check your connection.', error: true } : null;
  }
  if (state.phase !== 'done') return null;
  const { status } = state;
  if (status.state === 'update-available') {
    return web
      ? { message: `Version ${status.latestVersion} is out. Reload once this site updates to get it.`, url: status.url }
      : { message: `Update available: v${status.latestVersion}`, url: status.url };
  }
  if (status.state === 'up-to-date') {
    return { message: web ? `You're on the latest version (v${current})` : `You're up to date (v${current})` };
  }
  return { message: 'No releases published yet.' };
}

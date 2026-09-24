import { useEffect, useRef, useState } from 'react';
import type { UpdateCheckState } from '../useUpdateCheck';
import { THINK_TIME_CHOICES } from '../engine/stockfish';

interface SettingsMenuProps {
  thinkTimeSec: number;
  onThinkTimeChange: (sec: number) => void;
  updateState: UpdateCheckState;
  updateAvailable: boolean;
  onCheckForUpdates: () => void;
  autoCheck: boolean;
  onAutoCheckChange: (on: boolean) => void;
}

function describeUpdate(state: UpdateCheckState): { message: string; url?: string; error?: boolean } | null {
  if (state.phase === 'error') {
    return state.manual ? { message: 'Could not reach GitHub. Check your connection.', error: true } : null;
  }
  if (state.phase !== 'done') return null;
  const { status } = state;
  if (status.state === 'update-available') {
    return { message: `Update available: v${status.latestVersion}`, url: status.url };
  }
  if (status.state === 'up-to-date') return { message: `You're up to date (v${__APP_VERSION__})` };
  return { message: 'No releases published yet.' };
}

export default function SettingsMenu({
  thinkTimeSec,
  onThinkTimeChange,
  updateState,
  updateAvailable,
  onCheckForUpdates,
  autoCheck,
  onAutoCheckChange,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const result = describeUpdate(updateState);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="settings-menu" ref={rootRef}>
      <button
        className="settings-gear"
        onClick={() => setOpen((o) => !o)}
        aria-label={updateAvailable ? 'Settings (update available)' : 'Settings'}
        aria-expanded={open}
        title={updateAvailable ? 'Settings — update available' : 'Settings'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {updateAvailable && <span className="settings-update-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="settings-dropdown" role="menu">
          <div className="settings-row settings-version">
            <span>Version</span>
            <span className="settings-version-value">v{__APP_VERSION__}</span>
          </div>

          <div className="settings-row">
            <span
              className="settings-label"
              title="How long the engine searches each position. Longer = stronger; the best move so far is shown immediately either way."
            >
              Think time
            </span>
            <div className="lines-selector" role="group" aria-label="Think time">
              {THINK_TIME_CHOICES.map((sec) => (
                <button
                  key={sec}
                  className={`lines-btn ${thinkTimeSec === sec ? 'lines-btn-active' : ''}`}
                  onClick={() => onThinkTimeChange(sec)}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          <div className="settings-divider" />

          <button
            className="settings-action"
            onClick={onCheckForUpdates}
            disabled={updateState.phase === 'checking'}
            role="menuitem"
          >
            {updateState.phase === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>

          {result && (
            <div className={`settings-check-result${result.error ? ' settings-check-error' : ''}`}>
              <span>{result.message}</span>
              {result.url && (
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  Download
                </a>
              )}
            </div>
          )}

          <label className="settings-row settings-toggle">
            <span>Check automatically at startup</span>
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={(e) => onAutoCheckChange(e.target.checked)}
            />
          </label>

          <a
            className="settings-action settings-link"
            href="https://github.com/ccharafeddine/chess-solver"
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
          >
            View on GitHub
          </a>
        </div>
      )}
    </div>
  );
}

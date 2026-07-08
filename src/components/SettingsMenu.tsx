import { useEffect, useRef, useState } from 'react';
import { checkForUpdates } from '../engine/updates';

type CheckState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'done'; message: string; url?: string }
  | { phase: 'error'; message: string };

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState<CheckState>({ phase: 'idle' });
  const rootRef = useRef<HTMLDivElement>(null);

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

  const handleCheckForUpdates = async () => {
    setCheck({ phase: 'checking' });
    try {
      const status = await checkForUpdates(__APP_VERSION__);
      if (status.state === 'update-available') {
        setCheck({
          phase: 'done',
          message: `Update available: v${status.latestVersion}`,
          url: status.url,
        });
      } else if (status.state === 'up-to-date') {
        setCheck({ phase: 'done', message: `You're up to date (v${__APP_VERSION__})` });
      } else {
        setCheck({ phase: 'done', message: 'No releases published yet.' });
      }
    } catch {
      setCheck({ phase: 'error', message: 'Could not reach GitHub. Check your connection.' });
    }
  };

  return (
    <div className="settings-menu" ref={rootRef}>
      <button
        className="settings-gear"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="settings-dropdown" role="menu">
          <div className="settings-row settings-version">
            <span>Version</span>
            <span className="settings-version-value">v{__APP_VERSION__}</span>
          </div>

          <button
            className="settings-action"
            onClick={handleCheckForUpdates}
            disabled={check.phase === 'checking'}
            role="menuitem"
          >
            {check.phase === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>

          {(check.phase === 'done' || check.phase === 'error') && (
            <div className={`settings-check-result${check.phase === 'error' ? ' settings-check-error' : ''}`}>
              <span>{check.message}</span>
              {check.phase === 'done' && check.url && (
                <a href={check.url} target="_blank" rel="noopener noreferrer">
                  Download
                </a>
              )}
            </div>
          )}

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

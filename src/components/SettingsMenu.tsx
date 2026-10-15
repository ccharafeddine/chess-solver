import { useEffect, useRef } from 'react';
import type { UpdateCheckState } from '../useUpdateCheck';
import { THINK_TIME_CHOICES } from '../engine/stockfish';
import { describeUpdate, updateCopy } from '../updateCopy';
import { SKINS, SKIN_LABELS, type Mode, type Skin } from '../theme/theme';

interface SettingsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skin: Skin;
  onSkinChange: (skin: Skin) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  thinkTimeSec: number;
  onThinkTimeChange: (sec: number) => void;
  updateState: UpdateCheckState;
  updateAvailable: boolean;
  onCheckForUpdates: () => void;
  autoCheck: boolean;
  onAutoCheckChange: (on: boolean) => void;
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

const copy = updateCopy(__WEB_BUILD__);

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** The Settings dialog: appearance, engine, updates and about. Opened by the header gear. */
export default function SettingsMenu(p: SettingsMenuProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const result = describeUpdate(p.updateState, __APP_VERSION__, __WEB_BUILD__);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal();
    if (!p.open && d.open) d.close();
  }, [p.open]);

  return (
    <dialog
      ref={ref}
      id="settings-dialog"
      aria-labelledby="settings-title"
      onClose={() => p.onOpenChange(false)}
      onClick={(e) => { if (e.target === ref.current) p.onOpenChange(false); }}
    >
      <div className="dialog-head">
        <h2 id="settings-title">Settings</h2>
        <button className="icon-btn" id="settings-close" onClick={() => p.onOpenChange(false)} aria-label="Close settings">
          ✕
        </button>
      </div>

      <h3>Appearance</h3>
      <div className="skin-grid" role="radiogroup" aria-label="Theme" id="theme-skins">
        {SKINS.map((s) => (
          <button
            key={s}
            className="skin-card"
            role="radio"
            aria-checked={p.skin === s}
            onClick={() => p.onSkinChange(s)}
          >
            <span className="skin-preview" data-preview={s} aria-hidden="true">
              <i /><i /><i /><i />
            </span>
            <span className="skin-name">{SKIN_LABELS[s].name}</span>
            <span className="skin-blurb">{SKIN_LABELS[s].blurb}</span>
          </button>
        ))}
      </div>
      <div className="mode-row">
        <span className="settings-label">Mode</span>
        <div className="group" role="radiogroup" aria-label="Light or dark" id="theme-modes">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={p.mode === m.id} onClick={() => p.onModeChange(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">System follows your computer's light or dark setting as it changes.</p>

      <h3>Engine</h3>
      <div className="mode-row">
        <span
          className="settings-label"
          title="How long the engine searches each position. Longer = stronger; the best move so far is shown immediately either way."
        >
          Think time
        </span>
        <div className="group" role="radiogroup" aria-label="Think time">
          {THINK_TIME_CHOICES.map((sec) => (
            <button key={sec} role="radio" aria-checked={p.thinkTimeSec === sec} onClick={() => p.onThinkTimeChange(sec)}>
              {sec}s
            </button>
          ))}
        </div>
      </div>
      <p className="muted">Longer is stronger. The best move so far shows right away either way.</p>

      <h3>Updates</h3>
      <div className="mode-row">
        <button id="check-update" onClick={p.onCheckForUpdates} disabled={p.updateState.phase === 'checking'}>
          {p.updateState.phase === 'checking' ? 'Checking…' : copy.checkButton}
        </button>
        <label className="check">
          <input type="checkbox" checked={p.autoCheck} onChange={(e) => p.onAutoCheckChange(e.target.checked)} />
          <span>{copy.autoCheckLabel}</span>
        </label>
      </div>
      <p className={`update-msg${result?.error ? ' error' : ''}`} role="status">
        {result?.message}
        {result?.url && (
          <>
            {' '}
            <a href={result.url} target="_blank" rel="noopener noreferrer">{copy.linkLabel}</a>
          </>
        )}
        {!result && p.updateAvailable && 'An update is available.'}
      </p>

      <h3>About</h3>
      <p className="about">
        Chess Solver <span className="mono" id="version">v{__APP_VERSION__}</span>
        {' · '}
        <a href="https://github.com/ccharafeddine/chess-solver" target="_blank" rel="noopener noreferrer">View on GitHub</a>
      </p>
      <p className="muted">{copy.engineCredit} Piece set and artwork are original to this app.</p>
    </dialog>
  );
}

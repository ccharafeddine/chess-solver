import { useCallback, useEffect, useState } from 'react';
import { checkForUpdates, type UpdateStatus } from './engine/updates';

export type UpdateCheckState =
  | { phase: 'idle' }
  | { phase: 'checking'; manual: boolean }
  | { phase: 'done'; status: UpdateStatus; manual: boolean }
  | { phase: 'error'; manual: boolean };

const AUTO_CHECK_KEY = 'chess-solver-auto-update-check';
const DISMISSED_KEY = 'chess-solver-dismissed-update';
// Give the engine a head start on its (CPU-heavy) startup before touching the
// network.
const STARTUP_CHECK_DELAY_MS = 4000;

/**
 * Update checking against GitHub releases: once automatically at startup
 * (unless turned off) and on demand from the settings menu. A found update
 * surfaces as a banner until dismissed for that specific version.
 */
export function useUpdateCheck() {
  const [state, setState] = useState<UpdateCheckState>({ phase: 'idle' });
  const [autoCheck, setAutoCheckState] = useState(
    () => localStorage.getItem(AUTO_CHECK_KEY) !== 'off'
  );
  const [dismissedVersion, setDismissedVersion] = useState(
    () => localStorage.getItem(DISMISSED_KEY)
  );

  const runCheck = useCallback(async (manual: boolean) => {
    setState({ phase: 'checking', manual });
    try {
      const status = await checkForUpdates(__APP_VERSION__);
      setState({ phase: 'done', status, manual });
    } catch {
      setState({ phase: 'error', manual });
    }
  }, []);

  useEffect(() => {
    if (!autoCheck) return;
    const timer = setTimeout(() => runCheck(false), STARTUP_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
    // Only the startup check is automatic; toggling the setting on later
    // doesn't need to fire one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAutoCheck = useCallback((on: boolean) => {
    localStorage.setItem(AUTO_CHECK_KEY, on ? 'on' : 'off');
    setAutoCheckState(on);
  }, []);

  const available =
    state.phase === 'done' && state.status.state === 'update-available' ? state.status : null;

  const dismiss = useCallback(() => {
    if (!available?.latestVersion) return;
    localStorage.setItem(DISMISSED_KEY, available.latestVersion);
    setDismissedVersion(available.latestVersion);
  }, [available]);

  return {
    state,
    available,
    // The settings menu still shows a dismissed update after a manual check.
    showBanner: available !== null && available.latestVersion !== dismissedVersion,
    check: () => runCheck(true),
    dismiss,
    autoCheck,
    setAutoCheck,
  };
}

import { useEffect, useState } from 'react';
import { applyTheme, MODE_KEY, pickMode, pickSkin, resolveMode, SKIN_KEY, type Mode, type Skin } from './theme';

const query = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** Skin and mode, persisted; System follows the OS live. */
export function useTheme() {
  const [skin, setSkinState] = useState<Skin>(() => pickSkin(location.search, localStorage.getItem(SKIN_KEY)));
  const [mode, setModeState] = useState<Mode>(() => pickMode(localStorage.getItem(MODE_KEY)));
  const [osDark, setOsDark] = useState<boolean>(() => query()?.matches ?? false);

  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveMode(mode, osDark);
  useEffect(() => applyTheme(document.documentElement, skin, resolved), [skin, resolved]);

  const setSkin = (s: Skin) => { localStorage.setItem(SKIN_KEY, s); setSkinState(s); };
  const setMode = (m: Mode) => {
    if (m === 'system') localStorage.removeItem(MODE_KEY); else localStorage.setItem(MODE_KEY, m);
    setModeState(m);
  };
  return { skin, mode, resolved, setSkin, setMode };
}

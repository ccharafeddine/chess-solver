/**
 * What to tell the user when the engine cannot start. Board editing, PGN and
 * FEN keep working without it; only analysis is missing.
 */
export function engineFailureMessage(err: unknown, web: boolean): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'EngineUnavailableError') {
    return web
      ? 'The chess engine needs a page served with cross-origin isolation (COOP/COEP headers), so analysis is off. You can still set up positions and read games.'
      : 'The chess engine needs cross-origin isolation, which this window did not get, so analysis is off. Restart the app to retry.';
  }
  return web
    ? "The chess engine couldn't start in this browser, so analysis is off. You can still set up positions and read games. Reload the page to try again, or use a recent Chrome, Edge, Firefox or Safari."
    : 'The Stockfish engine failed to load. Restart the app to retry.';
}

import { describe, it, expect } from 'vitest';
import { engineFailureMessage } from './engineErrors';
import { EngineUnavailableError } from './stockfish';

describe('engine failure messages', () => {
  it('tells web visitors to reload, and desktop users to restart', () => {
    expect(engineFailureMessage(new Error('boom'), true)).toMatch(/Reload the page/);
    expect(engineFailureMessage(new Error('boom'), false)).toMatch(/Restart the app/);
  });
  it('says analysis is off but the board still works on the web', () => {
    expect(engineFailureMessage(new Error('x'), true)).toMatch(/analysis is off.*still set up positions/);
  });
  it('names the missing cross-origin isolation when that is the cause', () => {
    const err = new EngineUnavailableError();
    expect(engineFailureMessage(err, true)).toMatch(/COOP\/COEP/);
    expect(engineFailureMessage(err, false)).toMatch(/cross-origin isolation/);
  });
  it('copes with non-Error values', () => {
    expect(engineFailureMessage('weird', true)).toMatch(/couldn't start/);
  });
});

import { describe, it, expect } from 'vitest';
import { describeUpdate, updateCopy } from './updateCopy';

const available = { phase: 'done', manual: true, status: { state: 'update-available', latestVersion: '1.3.0', url: 'https://example.test/r' } } as const;
const upToDate = { phase: 'done', manual: true, status: { state: 'up-to-date' } } as const;

describe('update wording', () => {
  it('desktop offers a download of the new version', () => {
    const c = updateCopy(false);
    expect(c.linkLabel).toBe('Download');
    expect(c.banner('1.3.0', '1.2.1')).toBe('Chess Solver v1.3.0 is available (you have v1.2.1).');
    expect(describeUpdate(available as never, '1.2.1', false)).toEqual({ message: 'Update available: v1.3.0', url: 'https://example.test/r' });
  });

  it('web never mentions downloading or installing, and suggests a reload', () => {
    const c = updateCopy(true);
    const all = [c.checkButton, c.autoCheckLabel, c.linkLabel, c.engineCredit, c.banner('1.3.0', '1.2.1'),
      describeUpdate(available as never, '1.2.1', true)!.message, describeUpdate(upToDate as never, '1.2.1', true)!.message].join(' ');
    expect(all).not.toMatch(/download|install/i);
    expect(c.banner('1.3.0', '1.2.1')).toMatch(/Reload/);
    expect(c.linkLabel).toBe("What's new");
    expect(c.engineCredit).toMatch(/lite/);
  });

  it('reports a failed manual check, and stays quiet on a failed automatic one', () => {
    expect(describeUpdate({ phase: 'error', manual: true }, '1.2.1', true)?.error).toBe(true);
    expect(describeUpdate({ phase: 'error', manual: false }, '1.2.1', true)).toBeNull();
    expect(describeUpdate({ phase: 'idle' }, '1.2.1', false)).toBeNull();
  });
});

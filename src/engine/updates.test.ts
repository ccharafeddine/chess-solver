import { describe, it, expect } from 'vitest';
import { compareVersions } from './updates';

describe('compareVersions', () => {
  it('orders simple versions', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('handles a leading v and unequal lengths', () => {
    expect(compareVersions('v1.2', '1.2.0')).toBe(0);
    expect(compareVersions('v1.10.0', '1.9.9')).toBe(1);
  });

  it('treats malformed segments as zero', () => {
    expect(compareVersions('1.x.0', '1.0.0')).toBe(0);
  });
});

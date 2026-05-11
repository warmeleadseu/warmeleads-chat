/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { normalizeCcBcc } from '@/lib/email/sendAsAdmin';

describe('normalizeCcBcc', () => {
  it('lowercases, trims, dedupes and returns valid addresses', () => {
    const result = normalizeCcBcc(
      ['  Test@Example.com', 'test@example.com', 'bla@x.io', '  '],
      new Set(),
      10,
    );
    expect(result.addresses).toEqual(['test@example.com', 'bla@x.io']);
    expect(result.invalid).toEqual([]);
  });

  it('filters out invalid addresses but keeps the rest', () => {
    const result = normalizeCcBcc(['ok@x.io', 'not-an-email', 'second@y.io'], new Set(), 10);
    expect(result.addresses).toEqual(['ok@x.io', 'second@y.io']);
    expect(result.invalid).toEqual(['not-an-email']);
  });

  it('respects the exclude set (e.g. primary "to" address)', () => {
    const exclude = new Set(['primary@to.io']);
    const result = normalizeCcBcc(['Primary@to.io', 'extra@cc.io'], exclude, 10);
    expect(result.addresses).toEqual(['extra@cc.io']);
  });

  it('truncates at max length', () => {
    const result = normalizeCcBcc(
      ['a@a.io', 'b@b.io', 'c@c.io', 'd@d.io', 'e@e.io'],
      new Set(),
      3,
    );
    expect(result.addresses).toHaveLength(3);
    expect(result.addresses).toEqual(['a@a.io', 'b@b.io', 'c@c.io']);
  });

  it('handles undefined and non-array input', () => {
    expect(normalizeCcBcc(undefined, new Set(), 5).addresses).toEqual([]);
    // @ts-expect-error: deliberately invalid type for runtime guard
    expect(normalizeCcBcc('foo@x.io', new Set(), 5).addresses).toEqual([]);
  });
});

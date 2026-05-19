import { describe, it, expect } from 'vitest';
import { __internal } from '../metaMarketingApi';

describe('normActId', () => {
  it('prefixes naked account id', () => {
    expect(__internal.normActId('1234567890')).toBe('act_1234567890');
  });

  it('keeps existing prefix', () => {
    expect(__internal.normActId('act_1234567890')).toBe('act_1234567890');
  });

  it('trims whitespace', () => {
    expect(__internal.normActId('  1234  ')).toBe('act_1234');
  });
});

describe('makeMetaError / isRetryable', () => {
  it('parses error message', () => {
    const err = __internal.makeMetaError(400, { error: { message: 'Bad', code: 100, type: 'OAuthException' } });
    expect(err.message).toBe('Bad');
    expect(err.code).toBe(100);
    expect(err.isUserError).toBe(true);
  });

  it('retries 5xx', () => {
    const err = __internal.makeMetaError(503, { error: { message: 'srv', code: 1, type: 'TransientError' } });
    expect(__internal.isRetryable(err)).toBe(true);
  });

  it('retries Meta transient codes', () => {
    const err = __internal.makeMetaError(200, { error: { message: 'rate-limit', code: 17, type: 'OAuthException' } });
    expect(__internal.isRetryable(err)).toBe(true);
  });

  it('does not retry user errors with 4xx', () => {
    const err = __internal.makeMetaError(400, { error: { message: 'bad input', code: 100, type: 'OAuthException' } });
    expect(__internal.isRetryable(err)).toBe(false);
  });
});

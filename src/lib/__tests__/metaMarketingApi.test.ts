import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __internal, createAdSet, createLeadAdCreative } from '../metaMarketingApi';

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

describe('createAdSet (Lead Ads payload)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.META_ACCESS_TOKEN = 'token-abc';
    process.env.META_AD_ACCOUNT_ID = '1234567890';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('always sends destination_type=ON_AD by default (zonder dit defaultet Meta naar website)', async () => {
    let capturedBody = '';
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'as_1' }), { status: 200 });
    }) as unknown as typeof fetch;

    await createAdSet({
      campaignId: 'cmp_1',
      name: 'test',
      pageId: 'page_1',
      dailyBudgetCents: 2500,
      geo: { countries: ['NL'] },
    });

    const params = new URLSearchParams(capturedBody);
    expect(params.get('destination_type')).toBe('ON_AD');
    expect(params.get('optimization_goal')).toBe('LEAD_GENERATION');
    expect(params.get('promoted_object')).toBe('{"page_id":"page_1"}');
  });

  it('respects expliciete destination_type override', async () => {
    let capturedBody = '';
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'as_2' }), { status: 200 });
    }) as unknown as typeof fetch;

    await createAdSet({
      campaignId: 'cmp_1',
      name: 'test',
      pageId: 'page_1',
      dailyBudgetCents: 2500,
      geo: { countries: ['NL'] },
      destinationType: 'WEBSITE',
    });

    expect(new URLSearchParams(capturedBody).get('destination_type')).toBe('WEBSITE');
  });
});

describe('createLeadAdCreative', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.META_ACCESS_TOKEN = 'token-abc';
    process.env.META_AD_ACCOUNT_ID = '1234567890';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('default link = page-URL en lead_gen_form_id staat in call_to_action.value', async () => {
    let capturedBody = '';
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'cr_1' }), { status: 200 });
    }) as unknown as typeof fetch;

    await createLeadAdCreative({
      pageId: 'page_42',
      formId: 'form_99',
      name: 'creative-test',
      imageHash: 'abc123',
      message: 'hello',
      headline: 'world',
    });

    const params = new URLSearchParams(capturedBody);
    const spec = JSON.parse(params.get('object_story_spec') || '{}');
    expect(spec.page_id).toBe('page_42');
    expect(spec.link_data.link).toBe('https://www.facebook.com/page_42');
    expect(spec.link_data.image_hash).toBe('abc123');
    expect(spec.link_data.call_to_action.value).toEqual({ lead_gen_form_id: 'form_99' });
  });
});

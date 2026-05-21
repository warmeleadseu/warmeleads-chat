import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLeadgenForm } from '../metaMarketingApi';

describe('createLeadgenForm · Meta payload', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTed naar /{page_id}/leadgen_forms met page-token (niet user-token)', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    global.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'form_999' }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await createLeadgenForm('page_123', 'PAGE-TOKEN-XYZ', {
      name: 'Test form',
      privacy_policy: { url: 'https://warmeleads.eu/privacy' },
      questions: [
        { type: 'CUSTOM', key: 'eigen_woning', label: 'Eigen woning?', options: [
          { value: 'ja', label: 'Ja' },
          { value: 'nee', label: 'Nee' },
        ]},
        { type: 'PHONE' },
        { type: 'EMAIL' },
      ],
      thank_you_page: { title: 'Bedankt!', body: 'We bellen je.', button_type: 'CALL_BUSINESS', business_phone_number: '+31201234567' },
    });

    expect(result.id).toBe('form_999');
    expect(capturedUrl).toContain('/page_123/leadgen_forms');
    const params = new URLSearchParams(capturedBody);
    expect(params.get('access_token')).toBe('PAGE-TOKEN-XYZ');
    const questions = JSON.parse(params.get('questions') || '[]');
    expect(questions).toHaveLength(3);
    expect(questions[0]).toMatchObject({
      type: 'CUSTOM',
      key: 'eigen_woning',
      label: 'Eigen woning?',
    });
    expect(questions[0].options).toEqual([
      { value: 'ja', label: 'Ja' },
      { value: 'nee', label: 'Nee' },
    ]);
    expect(questions[1]).toEqual({ type: 'PHONE' });
    expect(questions[2]).toEqual({ type: 'EMAIL' });

    const privacy = JSON.parse(params.get('privacy_policy') || '{}');
    expect(privacy.url).toBe('https://warmeleads.eu/privacy');
    expect(privacy.link_text).toBeDefined();

    expect(params.get('form_type')).toBe('HIGHER_INTENT');
    expect(params.get('locale')).toBe('nl_NL');
  });

  it('mapt context_card body naar array van paragraphs', async () => {
    let capturedBody = '';
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'form_2' }), { status: 200 });
    }) as unknown as typeof fetch;

    await createLeadgenForm('page_1', 'page-token', {
      name: 'Met context',
      privacy_policy: { url: 'https://warmeleads.eu/privacy' },
      questions: [{ type: 'EMAIL' }],
      context_card: {
        title: 'Welkom',
        content: 'Eén string body',
      },
      thank_you_page: { title: 'Thanks', body: 'OK' },
    });

    const params = new URLSearchParams(capturedBody);
    const cc = JSON.parse(params.get('context_card') || '{}');
    expect(cc.title).toBe('Welkom');
    expect(Array.isArray(cc.content)).toBe(true);
    expect(cc.content[0]).toBe('Eén string body');
  });

  it('default = HIGHER_INTENT en privacy.link_text wordt ingevuld', async () => {
    let capturedBody = '';
    global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ id: 'form_3' }), { status: 200 });
    }) as unknown as typeof fetch;

    await createLeadgenForm('page_1', 'page-token', {
      name: 'Default form',
      privacy_policy: { url: 'https://warmeleads.eu/privacy' },
      questions: [{ type: 'EMAIL' }],
      thank_you_page: { title: 'Thanks', body: 'OK' },
    });

    const params = new URLSearchParams(capturedBody);
    const privacy = JSON.parse(params.get('privacy_policy') || '{}');
    expect(privacy.link_text).toBe('Privacybeleid WarmeLeads');
    expect(params.get('form_type')).toBe('HIGHER_INTENT');
  });

  it('weigert wanneer pageId of pageToken ontbreekt', async () => {
    await expect(createLeadgenForm('', 'token', {
      name: 'x', privacy_policy: { url: 'https://x.com' },
      questions: [{ type: 'EMAIL' }],
      thank_you_page: { title: 'A', body: 'B' },
    })).rejects.toThrow(/pageId/);

    await expect(createLeadgenForm('page', '', {
      name: 'x', privacy_policy: { url: 'https://x.com' },
      questions: [{ type: 'EMAIL' }],
      thank_you_page: { title: 'A', body: 'B' },
    })).rejects.toThrow(/pageAccessToken/);
  });

  it('weigert wanneer er geen vragen meegegeven worden', async () => {
    await expect(createLeadgenForm('page', 'token', {
      name: 'x',
      privacy_policy: { url: 'https://warmeleads.eu/privacy' },
      questions: [],
      thank_you_page: { title: 'A', body: 'B' },
    })).rejects.toThrow(/minimaal 1 vraag/);
  });

  it('weigert wanneer privacy URL ontbreekt', async () => {
    await expect(createLeadgenForm('page', 'token', {
      name: 'x',
      // @ts-expect-error testing runtime guard
      privacy_policy: {},
      questions: [{ type: 'EMAIL' }],
      thank_you_page: { title: 'A', body: 'B' },
    })).rejects.toThrow(/privacy_policy/);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listMetaPages,
  getPageAccessToken,
  __resetMetaPagesCacheForTests,
} from '../meta';

describe('listMetaPages · filter + caching', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.META_ACCESS_TOKEN = 'user-token-abc';
    process.env.META_AD_ACCOUNT_ID = '1234567890';
    __resetMetaPagesCacheForTests();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('filtert pages zonder MANAGE/ADVERTISE/CREATE_CONTENT eruit', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: 'p1', name: 'Goede page', tasks: ['MANAGE', 'ADVERTISE'], access_token: 'tok_p1' },
        { id: 'p2', name: 'Read-only page', tasks: ['ANALYZE'], access_token: 'tok_p2' },
        { id: 'p3', name: 'Geen tasks page', tasks: [], access_token: 'tok_p3' },
        { id: 'p4', name: 'Create-content page', tasks: ['CREATE_CONTENT'], access_token: 'tok_p4' },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    const pages = await listMetaPages();
    expect(pages.map(p => p.id).sort()).toEqual(['p1', 'p4']);
  });

  it('sorteert alfabetisch op naam', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: 'b', name: 'Bravo', tasks: ['MANAGE'], access_token: 'b-tok' },
        { id: 'a', name: 'Alpha', tasks: ['MANAGE'], access_token: 'a-tok' },
        { id: 'c', name: 'Charlie', tasks: ['MANAGE'], access_token: 'c-tok' },
      ],
    }), { status: 200 })) as unknown as typeof fetch;

    const pages = await listMetaPages();
    expect(pages.map(p => p.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('cached 5 min: tweede call doet geen extra fetch', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: 'p1', name: 'X', tasks: ['MANAGE'], access_token: 'tx' }],
    }), { status: 200 })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await listMetaPages();
    await listMetaPages();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('force=true breekt de cache', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: 'p1', name: 'X', tasks: ['MANAGE'], access_token: 'tx' }],
    }), { status: 200 })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await listMetaPages();
    await listMetaPages({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gooit duidelijke fout wanneer Meta een error returnt', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'Invalid access token', code: 190, type: 'OAuthException' },
    }), { status: 401 })) as unknown as typeof fetch;

    await expect(listMetaPages()).rejects.toThrow(/Invalid access token/);
  });
});

describe('getPageAccessToken · ownership guard', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.META_ACCESS_TOKEN = 'user-token-abc';
    process.env.META_AD_ACCOUNT_ID = '1234567890';
    __resetMetaPagesCacheForTests();
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: 'page_a', name: 'A', tasks: ['MANAGE'], access_token: 'page-token-a' },
        { id: 'page_b', name: 'B', tasks: ['ADVERTISE'], access_token: 'page-token-b' },
      ],
    }), { status: 200 })) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returnt de page-token bij een matchende page-id', async () => {
    const token = await getPageAccessToken('page_a');
    expect(token).toBe('page-token-a');
  });

  it('returnt null voor een onbekende page-id (ownership guard)', async () => {
    const token = await getPageAccessToken('page_z_unknown');
    expect(token).toBeNull();
  });
});

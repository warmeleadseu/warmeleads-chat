import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { verifyCronAuth } from '../cronAuth';

describe('verifyCronAuth', () => {
  const SECRET = 'test-cron-secret-32chars!!';

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null for valid Bearer token', () => {
    const req = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(verifyCronAuth(req)).toBeNull();
  });

  it('returns 401 for wrong token', () => {
    const req = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = verifyCronAuth(req);
    expect(res?.status).toBe(401);
  });

  it('returns 500 when CRON_SECRET missing', () => {
    vi.stubEnv('CRON_SECRET', '');
    const req = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(verifyCronAuth(req)?.status).toBe(500);
  });
});

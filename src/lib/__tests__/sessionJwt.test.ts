/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('session JWT roundtrip', () => {
  beforeAll(() => {
    process.env.APP_SESSION_SECRET = 'test-session-secret-min-32-chars!!';
  });

  it('admin session', async () => {
    const { signAdminSession, verifyAdminSessionJwt } = await import('@/lib/adminSession');
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const jwt = await signAdminSession(id);
    await expect(verifyAdminSessionJwt(jwt)).resolves.toBe(id);
  });

  it('portal owner session', async () => {
    const { signPortalOwnerSession, verifyPortalSessionJwt } = await import('@/lib/portalSession');
    const id = 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
    const jwt = await signPortalOwnerSession(id);
    const claims = await verifyPortalSessionJwt(jwt);
    expect(claims?.typ).toBe('owner');
    expect(claims?.typ === 'owner' && claims.sub).toBe(id);
  });

  it('portal user session', async () => {
    const { signPortalUserSession, verifyPortalSessionJwt } = await import('@/lib/portalSession');
    const pu = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const cid = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const jwt = await signPortalUserSession(pu, cid);
    const claims = await verifyPortalSessionJwt(jwt);
    expect(claims?.typ).toBe('portal_user');
    if (claims?.typ === 'portal_user') {
      expect(claims.sub).toBe(pu);
      expect(claims.cid).toBe(cid);
    }
  });
});

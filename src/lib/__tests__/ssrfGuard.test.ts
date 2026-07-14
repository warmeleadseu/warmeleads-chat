import { describe, it, expect } from 'vitest';
import { assertPublicHttpUrl } from '@/lib/ssrfGuard';

describe('assertPublicHttpUrl', () => {
  it('weigert niet-https protocollen', async () => {
    expect((await assertPublicHttpUrl('http://example.com')).ok).toBe(false);
    expect((await assertPublicHttpUrl('ftp://example.com')).ok).toBe(false);
    expect((await assertPublicHttpUrl('not a url')).ok).toBe(false);
  });

  it('blokkeert privé/gereserveerde IPv4-literals', async () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.5', '192.168.1.1', '100.64.0.1', '0.0.0.0']) {
      const res = await assertPublicHttpUrl(`https://${ip}/hook`);
      expect(res.ok, ip).toBe(false);
    }
  });

  it('blokkeert IPv6 loopback/link-local/unique-local', async () => {
    for (const ip of ['[::1]', '[fe80::1]', '[fc00::1]', '[fd12::1]']) {
      const res = await assertPublicHttpUrl(`https://${ip}/hook`);
      expect(res.ok, ip).toBe(false);
    }
  });

  it('blokkeert interne hostnames', async () => {
    expect((await assertPublicHttpUrl('https://localhost/x')).ok).toBe(false);
    expect((await assertPublicHttpUrl('https://foo.internal/x')).ok).toBe(false);
    expect((await assertPublicHttpUrl('https://metadata.google.internal/x')).ok).toBe(false);
  });

  it('staat publieke IP-literals toe', async () => {
    expect((await assertPublicHttpUrl('https://8.8.8.8/hook')).ok).toBe(true);
    expect((await assertPublicHttpUrl('https://1.1.1.1/hook')).ok).toBe(true);
  });
});

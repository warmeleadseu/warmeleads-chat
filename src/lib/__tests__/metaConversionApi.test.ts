import { describe, it, expect } from 'vitest';
import { hashCapiUserData, normalizePhoneForCapi, __internal } from '../metaConversionApi';

describe('normalizePhoneForCapi', () => {
  it('handles Dutch numbers with leading 0', () => {
    expect(normalizePhoneForCapi('0612345678')).toBe('31612345678');
  });

  it('handles Belgian default', () => {
    expect(normalizePhoneForCapi('0412345678', '32')).toBe('32412345678');
  });

  it('handles + format', () => {
    expect(normalizePhoneForCapi('+31612345678')).toBe('31612345678');
  });

  it('handles 00 international prefix', () => {
    expect(normalizePhoneForCapi('0031612345678')).toBe('31612345678');
  });

  it('returns null for too-short input', () => {
    expect(normalizePhoneForCapi('1234')).toBe(null);
  });

  it('strips formatting characters', () => {
    expect(normalizePhoneForCapi('06-12 34 56 78')).toBe('31612345678');
  });
});

describe('hashCapiUserData', () => {
  it('hashes email lowercased', () => {
    const out = hashCapiUserData({ email: '  Jan@Voorbeeld.NL  ' });
    expect(out.em).toBe(__internal.sha256Lower('jan@voorbeeld.nl'));
  });

  it('hashes normalized phone', () => {
    const out = hashCapiUserData({ phone: '06-12345678' });
    expect(out.ph).toBe(__internal.sha256Lower('31612345678'));
  });

  it('keeps client_ip and user_agent unhashed (per CAPI spec)', () => {
    const out = hashCapiUserData({ clientIp: '1.2.3.4', clientUserAgent: 'Mozilla' });
    expect(out.client_ip_address).toBe('1.2.3.4');
    expect(out.client_user_agent).toBe('Mozilla');
  });

  it('skips fields that are not provided', () => {
    const out = hashCapiUserData({});
    expect(Object.keys(out)).toHaveLength(0);
  });

  it('hashes city without whitespace', () => {
    const out = hashCapiUserData({ city: 'Den Haag' });
    expect(out.ct).toBe(__internal.sha256Lower('denhaag'));
  });
});

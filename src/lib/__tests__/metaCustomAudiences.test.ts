import { describe, expect, it } from 'vitest';
import { __internal } from '@/lib/metaCustomAudiences';

describe('metaCustomAudiences', () => {
  describe('hashLead', () => {
    it('hasht email lowercase + trimmed', () => {
      const a = __internal.hashLead({ email: 'Test@Example.NL', phone: null });
      const b = __internal.hashLead({ email: ' test@example.nl ', phone: null });
      expect(a.em).toBe(b.em);
      expect(a.em).toMatch(/^[a-f0-9]{64}$/);
    });

    it('skipt ongeldige email', () => {
      const a = __internal.hashLead({ email: 'not-an-email', phone: null });
      expect(a.em).toBeNull();
    });

    it('normaliseert NL telefoonnummers naar 31xxxxxxxxx', () => {
      const a = __internal.hashLead({ email: null, phone: '0612345678' });
      const b = __internal.hashLead({ email: null, phone: '+31612345678' });
      const c = __internal.hashLead({ email: null, phone: '0031 6 1234 5678' });
      expect(a.ph).toBe(b.ph);
      expect(a.ph).toBe(c.ph);
    });

    it('return null voor lege input', () => {
      const a = __internal.hashLead({ email: null, phone: null });
      expect(a.em).toBeNull();
      expect(a.ph).toBeNull();
    });
  });

  describe('isEnabled', () => {
    it('default uit', () => {
      delete process.env.AI_LOOKALIKE_ENABLED;
      expect(__internal.isEnabled()).toBe(false);
    });

    it('aan met env=true', () => {
      process.env.AI_LOOKALIKE_ENABLED = 'true';
      expect(__internal.isEnabled()).toBe(true);
      delete process.env.AI_LOOKALIKE_ENABLED;
    });
  });

  describe('window-constanten', () => {
    it('exclusion window kleiner dan seed window', () => {
      expect(__internal.EXCLUSION_WINDOW_DAYS).toBeLessThan(__internal.LEAD_WINDOW_DAYS);
    });

    it('min seed minstens 100 (Meta-eis)', () => {
      expect(__internal.MIN_SEED_LEADS).toBeGreaterThanOrEqual(100);
    });
  });
});

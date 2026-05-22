import { describe, it, expect } from 'vitest';
import { formatMetaLeadFormCreateError } from '../metaMarketingApi';

describe('formatMetaLeadFormCreateError', () => {
  it('mapt Meta fout #3 naar uitleg over app-capability', () => {
    const r = formatMetaLeadFormCreateError(
      '(#3) Application does not have the capability to make this API call.',
      3,
    );
    expect(r.error).toContain('Meta-app');
    expect(r.hint).toMatch(/eigen app|Zapier|handmatig/i);
  });

  it('mapt scope-fouten naar token-hint', () => {
    const r = formatMetaLeadFormCreateError('Requires pages_manage_ads permission', 200);
    expect(r.error).toContain('scopes');
    expect(r.hint).toContain('pages_manage_ads');
  });
});

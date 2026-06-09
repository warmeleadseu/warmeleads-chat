import { describe, expect, it } from 'vitest';
import {
  PARTNER_PROSPECT_BRANCH_SLUGS,
  isPartnerProspectBranchSlug,
  normalizePartnerProspectBranchSlug,
} from '@/lib/partnerProspectConstants';
import {
  buildPartnerProspectInsertRow,
  isPartnerProspectBranch,
} from '@/lib/partnerProspectIngest';
import { pickNextRoundRobinId } from '@/lib/partnerProspectAssignment';

describe('partner prospect branches', () => {
  it('recognizes all configured partner branches', () => {
    for (const slug of PARTNER_PROSPECT_BRANCH_SLUGS) {
      expect(isPartnerProspectBranch(slug)).toBe(true);
      expect(isPartnerProspectBranchSlug(slug)).toBe(true);
      expect(normalizePartnerProspectBranchSlug(slug)).toBe(slug);
    }
    expect(isPartnerProspectBranch('airco')).toBe(false);
    expect(isPartnerProspectBranch('thuisbatterij')).toBe(false);
  });
});

describe('buildPartnerProspectInsertRow', () => {
  it('tags airco_partners on branches and source_metadata', () => {
    const row = buildPartnerProspectInsertRow(
      'airco_partners',
      { naam_klant: 'Test BV', email: 'a@b.nl' },
      { budget: '5000' },
      null,
      '64cad239-1eaf-497e-9c2b-d2ea60cb0512',
    );
    expect(row.branches).toEqual(['airco_partners']);
    expect((row.source_metadata as { partner_branch: string }).partner_branch).toBe('airco_partners');
    expect(row.source).toBe('meta_partner');
  });
});

describe('pickNextRoundRobinId', () => {
  const A = 'aaaaaaaa-1111-1111-1111-111111111111';
  const B = 'bbbbbbbb-2222-2222-2222-222222222222';
  const C = 'cccccccc-3333-3333-3333-333333333333';

  it('zonder vorige pointer kiest pool[0]', () => {
    expect(pickNextRoundRobinId([A, B], null)).toBe(A);
    expect(pickNextRoundRobinId([A, B], undefined)).toBe(A);
    expect(pickNextRoundRobinId([A, B], '')).toBe(A);
  });

  it('alterneert strict tussen 2 AMs', () => {
    expect(pickNextRoundRobinId([A, B], A)).toBe(B);
    expect(pickNextRoundRobinId([A, B], B)).toBe(A);
  });

  it('cyclisch over 3 AMs', () => {
    expect(pickNextRoundRobinId([A, B, C], A)).toBe(B);
    expect(pickNextRoundRobinId([A, B, C], B)).toBe(C);
    expect(pickNextRoundRobinId([A, B, C], C)).toBe(A);
  });

  it('pool met 1 AM geeft altijd die AM (geen alternering nodig)', () => {
    expect(pickNextRoundRobinId([A], A)).toBe(A);
    expect(pickNextRoundRobinId([A], null)).toBe(A);
    expect(pickNextRoundRobinId([A], B)).toBe(A);
  });

  it('vorige AM is verwijderd uit pool → start opnieuw bij pool[0]', () => {
    expect(pickNextRoundRobinId([A, B], C)).toBe(A);
  });

  it('robuust bij pool-volgordewijziging (gebruikt id, niet index)', () => {
    // Eerst pool [A, B]; last = A → next = B
    expect(pickNextRoundRobinId([A, B], A)).toBe(B);
    // Nu pool van volgorde gewisseld naar [B, A]; last = B → next = A
    expect(pickNextRoundRobinId([B, A], B)).toBe(A);
    // last = A → next = B (cyclisch terug)
    expect(pickNextRoundRobinId([B, A], A)).toBe(B);
  });

  it('lege pool gooit een error', () => {
    expect(() => pickNextRoundRobinId([], A)).toThrow();
  });

  it('strict alternerend over 10 picks blijft 50/50 verdeeld', () => {
    let last: string | null = null;
    const counts: Record<string, number> = { [A]: 0, [B]: 0 };
    for (let i = 0; i < 10; i++) {
      const next = pickNextRoundRobinId([A, B], last);
      counts[next]++;
      last = next;
    }
    expect(counts[A]).toBe(5);
    expect(counts[B]).toBe(5);
  });
});

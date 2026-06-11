import { describe, expect, it } from 'vitest';
import {
  PARTNER_PROSPECT_BRANCH_SLUGS,
  humanizePartnerBranchLabel,
  isPartnerBranchSlugDynamic,
  isPartnerProspectBranchSlug,
  loadPartnerBranchSlugs,
  normalizePartnerProspectBranchSlug,
} from '@/lib/partnerProspectConstants';
import {
  buildPartnerProspectInsertRow,
  isPartnerProspectBranch,
  partnerProspectIngestLabel,
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
    expect(isPartnerProspectBranch('bulk')).toBe(false);
  });
});

describe('humanizePartnerBranchLabel', () => {
  it('gebruikt expliciete labels voor well-known slugs', () => {
    expect(humanizePartnerBranchLabel('thuisbatterij_partners')).toBe('Thuisbatterij Partners');
    expect(humanizePartnerBranchLabel('airco_partners')).toBe('Airco Partners');
    expect(humanizePartnerBranchLabel('nei_begun_partners')).toBe('Nei Begun Partners');
  });

  it('humanized onbekende slugs naar Title Case', () => {
    expect(humanizePartnerBranchLabel('bulk')).toBe('Bulk');
    expect(humanizePartnerBranchLabel('mediabink_warm')).toBe('Mediabink Warm');
    expect(humanizePartnerBranchLabel('nieuwe-partner')).toBe('Nieuwe Partner');
  });

  it('valt elegant terug bij lege of vreemde input', () => {
    expect(humanizePartnerBranchLabel('')).toBe('');
    expect(humanizePartnerBranchLabel('___')).toBe('___');
  });
});

describe('partnerProspectIngestLabel', () => {
  it('matcht humanizePartnerBranchLabel voor zowel hardcoded als dynamische slugs', () => {
    expect(partnerProspectIngestLabel('thuisbatterij_partners')).toBe('Thuisbatterij Partners');
    expect(partnerProspectIngestLabel('bulk')).toBe('Bulk');
  });
});

describe('loadPartnerBranchSlugs', () => {
  function mockSupabase(rows: Array<{ slug: string }> | { error: string }) {
    return {
      from: () => ({
        select: () => ({
          eq: () =>
            'error' in rows
              ? Promise.resolve({ data: null, error: { message: rows.error } })
              : Promise.resolve({ data: rows, error: null }),
        }),
      }),
    } as unknown as Parameters<typeof loadPartnerBranchSlugs>[0];
  }

  it('combineert DB-rijen met de hardcoded fallback', async () => {
    const sb = mockSupabase([{ slug: 'bulk' }, { slug: 'mediabink_warm' }]);
    const set = await loadPartnerBranchSlugs(sb);
    expect(set.has('bulk')).toBe(true);
    expect(set.has('mediabink_warm')).toBe(true);
    for (const slug of PARTNER_PROSPECT_BRANCH_SLUGS) {
      expect(set.has(slug)).toBe(true);
    }
  });

  it('valt terug op de hardcoded lijst bij DB-fout', async () => {
    const sb = mockSupabase({ error: 'boom' });
    const set = await loadPartnerBranchSlugs(sb);
    for (const slug of PARTNER_PROSPECT_BRANCH_SLUGS) {
      expect(set.has(slug)).toBe(true);
    }
  });
});

describe('isPartnerBranchSlugDynamic', () => {
  function makeSb(dbResult: { is_partner_branch?: boolean | null } | null) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: dbResult, error: null }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof isPartnerBranchSlugDynamic>[0];
  }

  it('true voor hardcoded slug zonder DB-call', async () => {
    const sb = makeSb(null);
    expect(await isPartnerBranchSlugDynamic(sb, 'thuisbatterij_partners')).toBe(true);
  });

  it('true wanneer DB de vlag op true heeft', async () => {
    const sb = makeSb({ is_partner_branch: true });
    expect(await isPartnerBranchSlugDynamic(sb, 'bulk')).toBe(true);
  });

  it('false wanneer DB-vlag uit staat en geen hardcoded match', async () => {
    const sb = makeSb({ is_partner_branch: false });
    expect(await isPartnerBranchSlugDynamic(sb, 'badkamer')).toBe(false);
  });

  it('false bij lege input', async () => {
    const sb = makeSb(null);
    expect(await isPartnerBranchSlugDynamic(sb, '')).toBe(false);
    expect(await isPartnerBranchSlugDynamic(sb, null)).toBe(false);
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

/**
 * Normaliseert `customer_batches.meta_campaign_ids` vanuit API/PostgREST
 * (meestal string[], soms Postgres-array literal of komma-string).
 */
export function coerceCustomerBatchMetaCampaignIds(raw: unknown): string[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const x of raw) {
      const s = String(x).trim();
      if (/^\d+$/.test(s)) out.push(s);
    }
    return dedupeKeepOrder(out);
  }

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        return coerceCustomerBatchMetaCampaignIds(parsed);
      } catch {
        /* fall through */
      }
    }
    if (t.startsWith('{') && t.endsWith('}')) {
      const inner = t.slice(1, -1);
      if (!inner.trim()) return [];
      const parts = inner.split(',').map(s => s.replace(/^"(.*)"$/, '$1').trim());
      return dedupeKeepOrder(parts.filter(s => /^\d+$/.test(s)));
    }
    return dedupeKeepOrder(t.split(/[\s,;]+/).map(s => s.trim()).filter(s => /^\d+$/.test(s)));
  }

  return [];
}

function dedupeKeepOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export type MetaCampaignPick = { id: string; name: string; /** Handmatig uit in CRM → PAUSED in Meta */ paused?: boolean };

/** Zelfde volgorde als `orderedIds`; namen uit Meta lookup waar beschikbaar. */
export function mergeMetaCampaignLookupNames(
  orderedIds: string[],
  campaigns: { id: string; name: string }[],
  previous?: MetaCampaignPick[],
): MetaCampaignPick[] {
  const pausedById = new Map(
    (previous ?? []).filter(p => p.paused === true).map(p => [p.id, true] as const),
  );
  const nameById = new Map<string, string>();
  for (const c of campaigns) {
    const id = String(c.id).trim();
    if (/^\d+$/.test(id)) nameById.set(id, c.name || id);
  }
  return orderedIds.map(id => ({
    id,
    name: nameById.get(id) || id,
    ...(pausedById.has(id) ? { paused: true as const } : {}),
  }));
}

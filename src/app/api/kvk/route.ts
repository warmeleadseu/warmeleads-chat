import { NextRequest, NextResponse } from 'next/server';
import { humanizeKvkError } from '@/lib/kvkApiErrors';

const KVK_API_KEY = process.env.KVK_API_KEY || '';
const BASE = 'https://api.kvk.nl/api';
const TIMEOUT_MS = 8000;

/* ── Rate limiting ── */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; reset: number }>();

function rateOk(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

/* ── KVK helpers (shared with admin route) ── */

async function kvkFetch(url: string) {
  const res = await fetch(url, { headers: { apikey: KVK_API_KEY } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(humanizeKvkError(res.status, text));
  }
  return res.json();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('De KVK-dienst reageert te traag. Probeer het zo opnieuw.')),
      ms,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function GET(request: NextRequest) {
  if (!KVK_API_KEY) {
    return NextResponse.json({ error: 'KVK API key niet geconfigureerd' }, { status: 500 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateOk(ip)) {
    return NextResponse.json({ error: 'Te veel verzoeken, probeer het later opnieuw' }, { status: 429 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Zoekterm moet minimaal 2 tekens zijn' }, { status: 400 });
  }

  try {
    const isKvkNumber = /^\d{8}$/.test(q);
    const param = isKvkNumber ? `kvkNummer=${q}` : `naam=${encodeURIComponent(q)}`;
    const url = `${BASE}/v2/zoeken?${param}&resultatenPerPagina=10`;

    const data = await withTimeout(kvkFetch(url), TIMEOUT_MS);
    const resultaten = (data.resultaten || []).map((r: Record<string, unknown>) => {
      const adresWrapper = r.adres as Record<string, unknown> | undefined;
      const adres = (adresWrapper?.binnenlandsAdres || adresWrapper?.buitenlandsAdres || adresWrapper) as Record<string, unknown> | undefined;
      return {
        kvkNummer: r.kvkNummer,
        vestigingsnummer: r.vestigingsnummer,
        naam: r.naam,
        type: r.type,
        actief: r.actief !== 'Nee',
        straatnaam: adres?.straatnaam || '',
        huisnummer: adres?.huisnummer || '',
        postcode: adres?.postcode || '',
        plaats: adres?.plaats || '',
      };
    });

    return NextResponse.json({ resultaten, totaal: data.totaal || 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'KVK API fout';
    console.error('[kvk-public]', err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

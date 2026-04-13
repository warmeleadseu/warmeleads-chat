import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

const KVK_API_KEY = process.env.KVK_API_KEY || '';
const BASE = 'https://api.kvk.nl/api';
const TIMEOUT_MS = 8000;

async function kvkFetch(url: string) {
  const res = await fetch(url, {
    headers: { apikey: KVK_API_KEY },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KVK ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('KVK API timeout')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

// GET /api/admin/kvk?q=searchterm  → Zoeken API
// GET /api/admin/kvk?kvk=12345678  → Basisprofiel + Vestigingsprofiel (detail)
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  if (!KVK_API_KEY) {
    return NextResponse.json({ error: 'KVK API key niet geconfigureerd' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const kvk = searchParams.get('kvk')?.trim();

  try {
    if (kvk) {
      return await getDetail(kvk);
    }
    if (q && q.length >= 2) {
      return await search(q);
    }
    return NextResponse.json({ error: 'Geef ?q=zoekterm of ?kvk=nummer mee' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'KVK API fout';
    console.error('[kvk]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function search(q: string) {
  const isKvkNumber = /^\d{8}$/.test(q);
  const param = isKvkNumber ? `kvkNummer=${q}` : `naam=${encodeURIComponent(q)}`;
  const url = `${BASE}/v2/zoeken?${param}&resultatenPerPagina=10`;

  const data = await withTimeout(kvkFetch(url), TIMEOUT_MS);
  const results = (data.resultaten || []).map((r: Record<string, unknown>) => {
    const adres = r.adres as Record<string, unknown> | undefined;
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

  return NextResponse.json({ resultaten: results, totaal: data.totaal || 0 });
}

async function getDetail(kvkNummer: string) {
  const basisUrl = `${BASE}/v1/basisprofielen/${kvkNummer}`;
  const basisData = await withTimeout(kvkFetch(basisUrl), TIMEOUT_MS);

  const vestigingsnummer =
    basisData?.hoofdvestiging?.vestigingsnummer ||
    basisData?.vestigingen?.vestigingen?.[0]?.vestigingsnummer;

  let vestigingData: Record<string, unknown> | null = null;
  if (vestigingsnummer) {
    try {
      const vestUrl = `${BASE}/v1/vestigingsprofielen/${vestigingsnummer}`;
      vestigingData = await withTimeout(kvkFetch(vestUrl), TIMEOUT_MS);
    } catch (e) {
      console.warn('[kvk] vestigingsprofiel fetch failed:', e);
    }
  }

  const bezoekAdres = findBezoekadres(vestigingData) || findBezoekadres(basisData?.hoofdvestiging);

  const naam =
    basisData?.hoofdvestiging?.eersteHandelsnaam ||
    basisData?.naam ||
    '';

  const rsin = basisData?.rsin || basisData?.hoofdvestiging?.rsin || '';

  return NextResponse.json({
    kvkNummer,
    naam,
    rsin,
    vestigingsnummer: vestigingsnummer || null,
    adres: bezoekAdres
      ? formatAdres(bezoekAdres)
      : '',
    sbiActiviteiten: (vestigingData as Record<string, unknown[]>)?.sbiActiviteiten || basisData?.sbiActiviteiten || [],
  });
}

function findBezoekadres(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!obj) return null;
  const adressen = obj.adressen as Record<string, unknown>[] | undefined;
  if (Array.isArray(adressen)) {
    return adressen.find(a => a.type === 'bezoekadres') || adressen[0] || null;
  }
  if (obj.adres) return obj.adres as Record<string, unknown>;
  return null;
}

function formatAdres(a: Record<string, unknown>): string {
  if (a.volledigAdres) return String(a.volledigAdres);
  const straat = a.straatnaam || '';
  const nr = a.huisnummer || '';
  const letter = a.huisletter || '';
  const toev = a.huisnummerToevoeging || '';
  const pc = a.postcode || '';
  const plaats = a.plaats || '';

  const streetPart = `${straat} ${nr}${letter}${toev ? `-${toev}` : ''}`.trim();
  const cityPart = `${pc} ${plaats}`.trim();

  return [streetPart, cityPart].filter(Boolean).join(', ');
}

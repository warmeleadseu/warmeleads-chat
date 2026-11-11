import { createServerClient } from '@/lib/supabase';
import { factuurBetaalTokenKlopt } from '@/lib/factuurBetaallink';
import BlijfKijken from './BlijfKijken';

/**
 * Waar de klant na het betalen via de mail (src/lib/factuurBetaallink.ts)
 * terugkomt, zonder in te loggen. Ook de plek voor een link die niet klopt of
 * een factuur die niet meer openstaat.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Betalen · Warme Leads', robots: { index: false, follow: false } };

const euro = (n: number) => n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' });

export default async function BetaalKlaarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; fout?: string }>;
}) {
  const { id } = await params;
  const { t, fout } = await searchParams;

  if (!/^[0-9a-f-]{36}$/i.test(id) || !factuurBetaalTokenKlopt(id, t)) {
    return (
      <Omhulsel>
        <Melding teken="!" kleur="rose" titel="Deze link is niet geldig">
          Gebruik de knop in je mail, of betaal via het tabblad Facturen in je portaal.
        </Melding>
        <Contact />
      </Omhulsel>
    );
  }

  const supabase = createServerClient();
  const { data: f } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_incl_btw, status, batch_id')
    .eq('id', id)
    .maybeSingle();
  const { data: batch } = f?.batch_id
    ? await supabase.from('customer_batches').select('batch_size, status').eq('id', f.batch_id).maybeSingle()
    : { data: null };

  const betaalUrl = `/betalen/${id}?t=${encodeURIComponent(t ?? '')}`;

  if (!f) {
    return (
      <Omhulsel>
        <Melding teken="!" kleur="rose" titel="Deze factuur bestaat niet meer">Neem gerust contact met ons op.</Melding>
        <Contact />
      </Omhulsel>
    );
  }

  if (f.status === 'paid') {
    return (
      <Omhulsel>
        <Melding teken="✓" kleur="emerald" titel="Bedankt, je betaling is binnen">
          Factuur {f.invoice_number} ({euro(Number(f.total_incl_btw))}) is betaald.
          {batch ? ` Je batch van ${batch.batch_size} leads is actief: nieuwe leads komen in je portaal en per mail.` : ''}
        </Melding>
        <PortaalKnop />
      </Omhulsel>
    );
  }

  if (f.status !== 'open') {
    return (
      <Omhulsel>
        <Melding teken="!" kleur="slate" titel="Deze factuur staat niet meer open">
          Factuur {f.invoice_number} kan niet meer online worden betaald. Neem contact met ons op, dan zetten we het voor je klaar.
        </Melding>
        <Contact />
      </Omhulsel>
    );
  }

  return (
    <Omhulsel>
      {fout ? (
        <Melding teken="!" kleur="rose" titel="Betalen starten lukte niet">
          Er is niets afgeschreven. Probeer het over een paar minuten opnieuw.
        </Melding>
      ) : (
        <Melding teken="…" kleur="slate" titel="We hebben je betaling nog niet binnen">
          Kom je net terug van het betalen? Dan duurt het meestal een paar seconden; deze pagina ververst vanzelf.
          Nog niet betaald? Dat kan hieronder.
        </Melding>
      )}
      <a
        href={betaalUrl}
        className="mt-5 block rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 text-center text-sm font-bold text-white"
      >
        Factuur {f.invoice_number} betalen ({euro(Number(f.total_incl_btw))})
      </a>
      {!fout && <BlijfKijken />}
      <Contact />
    </Omhulsel>
  );
}

function Omhulsel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

const KLEUREN = {
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
} as const;

function Melding({ teken, kleur, titel, children }: { teken: string; kleur: keyof typeof KLEUREN; titel: string; children: React.ReactNode }) {
  return (
    <div className="py-4 text-center">
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl ${KLEUREN[kleur]}`}>{teken}</div>
      <h1 className="text-lg font-bold text-slate-900">{titel}</h1>
      <p className="mt-1 text-sm text-slate-500">{children}</p>
    </div>
  );
}

function PortaalKnop() {
  return (
    <a href="/portal" className="mt-4 block rounded-xl bg-brand-purple px-4 py-3 text-center text-sm font-bold text-white">
      Naar je portaal
    </a>
  );
}

function Contact() {
  return <p className="mt-4 text-center text-xs text-slate-400">Vragen? Bel 085 047 7067 of mail info@warmeleads.eu.</p>;
}

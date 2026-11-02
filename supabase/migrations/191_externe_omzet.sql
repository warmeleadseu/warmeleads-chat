-- Externe omzet.
--
-- Facturen die buiten WarmeLeads om zijn verstuurd (vooral bulkfacturen uit
-- Rompslomp). Ze tellen mee in de maandomzet van het live-dashboard en in
-- Winst en verlies, op de factuurdatum. Bedragen excl. btw; een creditfactuur
-- is een negatief bedrag.
--
-- Invoer met de hand of via een Excel/CSV-import op /admin/externe-omzet.
-- `bron` en `extern_id` houden een latere koppeling met Rompslomp open: die
-- kan dan per factuur bijwerken zonder dubbel te tellen.
--
-- Alleen toevoegingen; bestaande tabellen veranderen niet.

create table if not exists public.externe_omzet (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  customer_id uuid references public.customers(id) on delete set null,
  klant_naam text,
  soort text not null default 'bulk' check (soort in ('bulk', 'overig')),
  factuurnummer text,
  bedrag_excl numeric(12, 2) not null check (bedrag_excl between -1000000 and 1000000),
  omschrijving text,
  bron text not null default 'handmatig' check (bron in ('handmatig', 'import', 'rompslomp')),
  extern_id text,
  aangemaakt_door text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Eén factuurnummer telt maar één keer, ongeacht hoofdletters.
create unique index if not exists externe_omzet_factuurnummer_uniek
  on public.externe_omzet (lower(factuurnummer)) where factuurnummer is not null;
create unique index if not exists externe_omzet_extern_id_uniek
  on public.externe_omzet (bron, extern_id) where extern_id is not null;
create index if not exists externe_omzet_datum_idx on public.externe_omzet (datum);

-- Alleen de server (service role) leest en schrijft.
alter table public.externe_omzet enable row level security;

-- Losse leads kopen in het portaal.
--
-- Leads die buiten de regio's van alle klanten vielen en nog nooit zijn
-- uitgedeeld, mag elke klant met een account voor EUR 15 per stuk kopen
-- (thuisbatterij, warmtepomp, zonnepanelen, airco, financial lease).
--
-- Een aankoop reserveert de gekozen leads tijdens het betalen (20 minuten),
-- zodat twee klanten niet dezelfde lead afrekenen. Na betaling maakt de
-- webhook er een afgeronde bulkbatch van (zodat winst, facturen en
-- rapportages hem vanzelf meenemen) en levert wat nog vrij is; wat intussen
-- toch is uitgedeeld, wordt terugbetaald.

create table if not exists losse_lead_aankopen (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  portal_user_id uuid,
  branch text not null,
  lead_ids uuid[] not null,
  prijs_per_lead numeric(10,2) not null,
  totaal_excl numeric(10,2) not null,
  totaal_incl numeric(10,2) not null,
  status text not null default 'open' check (status in ('open', 'betaald', 'mislukt')),
  gereserveerd_tot timestamptz not null,
  mollie_payment_id text,
  batch_id uuid references customer_batches(id) on delete set null,
  geleverd_ids uuid[] not null default '{}',
  terugbetaald_ids uuid[] not null default '{}',
  terugbetaald_bedrag numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  betaald_op timestamptz
);

create index if not exists losse_lead_aankopen_open_idx
  on losse_lead_aankopen (gereserveerd_tot) where status = 'open';
create index if not exists losse_lead_aankopen_klant_idx
  on losse_lead_aankopen (customer_id, created_at desc);

alter table losse_lead_aankopen enable row level security;

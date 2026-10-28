-- Doorlopend op factuur.
--
-- Een keuze van de klant of de accountmanager, nooit een standaard: staat
-- `customers.doorlopend` aan, dan start bij een volledig geleverde batch
-- direct een nieuwe met dezelfde voorwaarden (tot EUR 2.500 excl. btw), die
-- meteen levert en op factuur gaat met 7 dagen betaaltermijn. Niet betaald
-- na 7 dagen: de batch pauzeert tot de betaling binnen is.
--
-- Voor elke bestaande batch is `op_factuur` false en dus `mag_leveren`
-- precies gelijk aan "betaald". Het gewone proces verandert niet.

alter table customers
  add column if not exists doorlopend boolean not null default false,
  add column if not exists doorlopend_sinds timestamptz,
  add column if not exists doorlopend_door text check (doorlopend_door in ('beheer', 'klant'));

alter table customer_batches
  add column if not exists op_factuur boolean not null default false,
  add column if not exists doorgelopen_van uuid references customer_batches(id) on delete set null,
  add column if not exists gepauzeerd_reden text check (gepauzeerd_reden in ('onbetaald')),
  add column if not exists doorloop_aangekondigd_op timestamptz,
  add column if not exists doorloop_stap smallint not null default 0,
  add column if not exists doorloop_stap_op timestamptz;

-- Mag deze batch leads krijgen? Betaald, of doorlopend op factuur. Hier lezen
-- de verdeling en de Meta-sync van; omzet en provisie blijven `is_paid` volgen.
alter table customer_batches
  add column if not exists mag_leveren boolean
  generated always as (is_paid is true or op_factuur) stored;

-- Eén vervolg per batch, ook als de webhook, de mijlpaal en de cron tegelijk lopen.
create unique index if not exists customer_batches_doorgelopen_van_uniek
  on customer_batches (doorgelopen_van) where doorgelopen_van is not null;

create index if not exists customer_batches_op_factuur_open_idx
  on customer_batches (created_at) where op_factuur and is_paid is not true;

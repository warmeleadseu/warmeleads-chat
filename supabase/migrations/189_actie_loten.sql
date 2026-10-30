-- Najaarsactie 2026: loten voor 20 gratis leads (30 okt t/m 13 nov 2026).
-- Alleen toevoegingen. Zie src/lib/lotenActie.ts voor de spelregels.

-- Per betaalde leadbatch één regel. De unieke sleutel zorgt dat een batch
-- nooit twee keer loten (of twee keer een mail) krijgt, ook als twee rondes
-- tegelijk lopen. Bulkloten worden niet opgeslagen maar per keer geteld.
create table if not exists actie_loten (
  id uuid primary key default gen_random_uuid(),
  actie text not null,
  customer_id uuid not null references customers(id) on delete cascade,
  batch_id uuid not null references customer_batches(id) on delete cascade,
  batch_size integer not null,
  loten integer not null check (loten > 0),
  betaald_op timestamptz not null,
  mail_verstuurd_op timestamptz,
  mail_pogingen integer not null default 0,
  mail_fout text,
  vervallen_op timestamptz,
  vervallen_reden text,
  created_at timestamptz not null default now(),
  unique (actie, batch_id)
);

create index if not exists actie_loten_klant_idx on actie_loten (actie, customer_id);

alter table actie_loten enable row level security;

-- De trekking, één per actie. Met het getrokken lotnummer en de volledige
-- deelnemerslijst van dat moment is de uitslag achteraf na te rekenen.
create table if not exists actie_trekkingen (
  id uuid primary key default gen_random_uuid(),
  actie text not null unique,
  winnaar_customer_id uuid not null references customers(id),
  lotnummer integer not null,
  totaal_loten integer not null,
  deelnemers jsonb not null,
  getrokken_door uuid,
  getrokken_door_naam text,
  getrokken_op timestamptz not null default now()
);

alter table actie_trekkingen enable row level security;

-- Acties met loten als gegevens in plaats van vast in de code, zodat beheer
-- zelf een nieuwe actie met eigen datums kan aanmaken. Elke actie heeft haar
-- eigen loten (actie_loten.actie) en trekking (actie_trekkingen.actie); die
-- kolommen bestonden al en verwijzen nu naar deze tabel.
-- Alleen toevoegingen. Zie src/lib/lotenActie.ts.

create table if not exists acties (
  code text primary key,
  naam text not null,
  -- Eerste moment dat meetelt en eerste moment dat niet meer meetelt.
  start_op timestamptz not null,
  eind_op timestamptz not null,
  prijs_leads integer not null check (prijs_leads > 0),
  leads_per_lot integer not null check (leads_per_lot > 0),
  bulk_per_lot integer not null check (bulk_per_lot > 0),
  aangemaakt_door uuid,
  aangemaakt_door_naam text,
  created_at timestamptz not null default now(),
  check (eind_op > start_op)
);

alter table acties enable row level security;

-- De eerste actie, zoals die sinds 30 oktober 2026 loopt.
insert into acties (code, naam, start_op, eind_op, prijs_leads, leads_per_lot, bulk_per_lot, aangemaakt_door_naam)
values ('najaar-2026', 'Najaarsactie: 20 gratis leads', '2026-10-29T23:00:00Z', '2026-11-13T23:00:00Z', 20, 10, 100, 'Systeem')
on conflict (code) do nothing;

alter table actie_loten
  add constraint actie_loten_actie_fkey foreign key (actie) references acties(code);
alter table actie_trekkingen
  add constraint actie_trekkingen_actie_fkey foreign key (actie) references acties(code);

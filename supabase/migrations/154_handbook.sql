-- Handboek: eigen aanvullingen en voortgang.
--
-- De inhoud van het handboek staat in code (src/app/admin/handboek/content.ts),
-- zodat die versiebeheerd en review-baar is. Wat hier in de database staat is
-- alles wat de beheerders er zelf aan toevoegen: notities per onderdeel en hun
-- persoonlijke voortgang door de inwerkcursus.
--
-- Zo veroudert het fundament niet stilletjes en kan het team het toch bijwerken
-- zonder developer.

create table if not exists public.handbook_notes (
  section_id     text primary key,
  body           text not null default '',
  updated_by     uuid references public.admin_users(id) on delete set null,
  updated_by_name text,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

comment on table public.handbook_notes is
  'Eigen aanvullingen per handboekonderdeel. section_id verwijst naar een id uit content.ts.';

create table if not exists public.handbook_progress (
  admin_user_id  uuid not null references public.admin_users(id) on delete cascade,
  section_id     text not null,
  completed_at   timestamptz not null default now(),
  primary key (admin_user_id, section_id)
);

comment on table public.handbook_progress is
  'Welke handboekonderdelen een beheerder heeft afgerond in de cursusmodus.';

create index if not exists handbook_progress_user_idx
  on public.handbook_progress (admin_user_id);

-- Beide tabellen worden uitsluitend via de admin-API benaderd met de
-- service-role sleutel. RLS staat aan zodat de anon-sleutel er niet bij kan.
alter table public.handbook_notes enable row level security;
alter table public.handbook_progress enable row level security;
